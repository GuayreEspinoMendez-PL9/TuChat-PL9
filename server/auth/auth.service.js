import { appDb, gobDb } from "../db/db.js";
import { crearChatsPrivadosAuto } from "../academico/academico.controller.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();

/**
 * Función auxiliar para generar hash SHA256
 * Se utiliza para verificar las credenciales almacenadas en la base de datos externa.
 */
const sha256 = (input) => crypto.createHash("sha256").update(input).digest("hex");

/**
 * SERVICIO PRINCIPAL DE AUTENTICACIÓN Y SINCRONIZACIÓN
 * ----------------------------------------------------
 * Este servicio gestiona el acceso desde la base de datos externa de educación
 * y replica la estructura necesaria en la base de datos local de la aplicación.
 * * @param {Object} credenciales - identificador (DNI/CIAL) y password
 * @returns {Object} Token JWT y datos del perfil de usuario
 */
export const loginConCredenciales = async ({ identificador, password }) => {
    
    console.log(`[Auth] Iniciando flujo de autenticación para identificador: ${identificador}`);

    // 1. BUSCAR PERSONA EN DB EXTERNA
    // Buscamos en el esquema 'externo' unificando DNI y CIAL para mayor compatibilidad.
    const { rows: personas } = await gobDb.query(
        `SELECT p.*, ug.id_usuario_externo, ug.tipo, cred.salt, cred.password_sha256_hex, c.codigo_centro
         FROM externo.personas p
         JOIN externo.usuarios_gobierno ug ON ug.id_persona = p.id_persona
         JOIN externo.credenciales_acceso cred ON cred.id_usuario_externo = ug.id_usuario_externo
         JOIN externo.centros c ON c.id_centro = ug.id_centro
         WHERE (TRIM(UPPER(p.dni)) = TRIM(UPPER($1)) OR TRIM(p.cial) = $1)
           AND ug.activo = true AND p.activo = true`,
        [identificador.trim()]
    );

    if (!personas.length) {
        console.error(`[Auth Error] Usuario no encontrado en DB Externa: ${identificador}`);
        throw new Error("INVALID_CREDENTIALS");
    }

    const extUser = personas[0];

    // 2. VERIFICACIÓN DE SEGURIDAD (PASSWORD)
    // Se utiliza el salt almacenado para recrear el hash y comparar con la DB.
    const saltDB = extUser.salt?.trim() || "";
    const hashDB = extUser.password_sha256_hex?.trim() || "";
    const hashCalculado = sha256(saltDB + password);

    console.log("---------- VERIFICACIÓN DE CREDENCIALES ----------");
    console.log("- ID Externo:", extUser.id_usuario_externo);
    console.log("- Tipo Externo:", extUser.tipo);
    console.log("- Hash validado correctamente");
    console.log("--------------------------------------------------");

    if (hashCalculado !== hashDB) {
        console.warn("[Auth Warning] Intento de acceso con contraseña incorrecta.");
        throw new Error("INVALID_CREDENTIALS");
    }

    // 3. MAPEO DE ROLES SEGÚN CONFIGURACIÓN DE BASE DE DATOS LOCAL
    // Basado en: 2=PROFESOR, 3=ALUMNO, 7=ADMIN
    const { rows: roles } = await appDb.query(
        "SELECT id_rol FROM seguridad.roles WHERE nombre = $1", 
        [extUser.tipo.trim()]
    );
    
    // Fallback manual por si la tabla de roles no devuelve el registro exacto
    let idRol = roles[0]?.id_rol;
    if (!idRol) {
        idRol = extUser.tipo.trim() === 'PROFESOR' ? 2 : 3;
    }

    // 4. UPSERT DEL USUARIO EN DB LOCAL
    // Mantiene los datos sincronizados con la fuente oficial de Educación.
    const { rows: usuariosApp } = await appDb.query(
        `INSERT INTO seguridad.usuarios_app (
            id_usuario_externo, dni, cial, id_rol, nombre, apellidos, tipo_externo, codigo_centro, activo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (id_usuario_externo) DO UPDATE SET
            dni = EXCLUDED.dni,
            nombre = EXCLUDED.nombre,
            apellidos = EXCLUDED.apellidos,
            id_rol = EXCLUDED.id_rol,
            updated_at = NOW()
        RETURNING *`,
        [
            extUser.id_usuario_externo, 
            extUser.dni.trim(), 
            extUser.cial?.trim() || null, 
            idRol, 
            extUser.nombre.trim(), 
            extUser.apellidos.trim(), 
            extUser.tipo.trim(), 
            extUser.codigo_centro.trim()
        ]
    );

    const localUser = usuariosApp[0];

    // 5. PROCESO DE SINCRONIZACIÓN ACADÉMICA (ESTRUCTURA Y CACHÉ)
    console.log(`[Sync] Sincronizando datos académicos para: ${localUser.nombre}`);
    
    try {
        // --- FLUJO PARA ALUMNOS ---
        if (localUser.tipo_externo === 'ALUMNO') {
            console.log("[Sync] Procesando matrículas de Alumno...");

            const { rows: extData } = await gobDb.query(`
                SELECT 
                    m.id_alumno_externo as id_usuario_externo, m.id_clase, ma.id_oferta, COALESCE(ma.estado, 'CURSANDO') as estado,
                    c.id_plan, c.curso, c.grupo, c.nombre as nombre_clase,
                    p.nombre as nombre_plan,
                    oa.id_asignatura,
                    a.codigo as codigo_asig, a.nombre as nombre_asig
                FROM academico.matriculas m
                JOIN academico.matriculas_asignaturas ma ON ma.id_matricula = m.id_matricula
                JOIN academico.clases c ON m.id_clase = c.id_clase
                JOIN academico.planes_estudio p ON c.id_plan = p.id_plan
                JOIN academico.oferta_asignaturas oa ON ma.id_oferta = oa.id_oferta
                JOIN academico.asignaturas a ON oa.id_asignatura = a.id_asignatura
                WHERE m.id_alumno_externo = $1`, 
                [localUser.id_usuario_externo]
            );

            // Limpieza atómica de la caché del alumno antes de repoblar
            await appDb.query(`
                DELETE FROM cache_academico.matriculas_asignaturas 
                WHERE id_matricula IN (SELECT id_matricula FROM cache_academico.matriculas WHERE id_usuario_app = $1)`, 
                [localUser.id_usuario_app]
            );
            await appDb.query("DELETE FROM cache_academico.matriculas WHERE id_usuario_app = $1", [localUser.id_usuario_app]);

            const matriculasPorClase = {};

            for (const d of extData) {
                // Sincronización de entidades maestras (planes, asignaturas, ofertas)
                await appDb.query(`INSERT INTO cache_academico.planes_estudio (id_plan, nombre, version) VALUES ($1, $2, '1.0') ON CONFLICT (id_plan) DO NOTHING`, [d.id_plan, d.nombre_plan || 'Plan']);
                await appDb.query(`INSERT INTO cache_academico.asignaturas (id_asignatura, codigo, nombre) VALUES ($1, $2, $3) ON CONFLICT (id_asignatura) DO NOTHING`, [d.id_asignatura, d.codigo_asig, d.nombre_asig]);
                await appDb.query(`INSERT INTO cache_academico.oferta_asignaturas (id_oferta, id_plan, id_asignatura, curso) VALUES ($1, $2, $3, $4) ON CONFLICT (id_oferta) DO NOTHING`, [d.id_oferta, d.id_plan, d.id_asignatura, d.curso]);
                await appDb.query(`INSERT INTO cache_academico.clases (id_clase, id_plan, curso, grupo, nombre) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id_clase) DO NOTHING`, [d.id_clase, d.id_plan, d.curso, d.grupo, d.nombre_clase]);

                let idMatricula;
                if (!matriculasPorClase[d.id_clase]) {
                    idMatricula = crypto.randomUUID(); 
                    await appDb.query(
                        `INSERT INTO cache_academico.matriculas (id_matricula, id_usuario_app, id_clase, id_alumno_externo)
                         VALUES ($1, $2, $3, $4)`,
                        [idMatricula, localUser.id_usuario_app, d.id_clase, localUser.id_usuario_externo]
                    );
                    matriculasPorClase[d.id_clase] = idMatricula;
                } else {
                    idMatricula = matriculasPorClase[d.id_clase];
                }

                await appDb.query(
                    `INSERT INTO cache_academico.matriculas_asignaturas (id_matricula, id_oferta, estado)
                     VALUES ($1, $2, $3) ON CONFLICT (id_matricula, id_oferta) DO NOTHING`,
                    [idMatricula, d.id_oferta, d.estado]
                );

                // Asegurar existencia de sala de chat técnica
                await appDb.query(`INSERT INTO comunicacion.salas_chat (id_clase, id_oferta) VALUES ($1, $2) ON CONFLICT (id_clase, id_oferta) DO NOTHING`, [d.id_clase, d.id_oferta]);
            }
        }
        
        // --- FLUJO PARA PROFESORES ---
        else if (localUser.tipo_externo === 'PROFESOR') {
            console.log("[Sync] Procesando asignaciones de Profesor...");

            const { rows: profData } = await gobDb.query(`
                SELECT 
                    ap.id_clase, ap.id_oferta,
                    c.id_plan, c.curso, c.grupo, c.nombre as nombre_clase,
                    pl.nombre as nombre_plan,
                    oa.id_asignatura,
                    a.codigo as codigo_asig, a.nombre as nombre_asig
                FROM externo.v_asignaciones_profesor ap
                JOIN academico.clases c ON ap.id_clase = c.id_clase
                JOIN academico.planes_estudio pl ON c.id_plan = pl.id_plan
                JOIN academico.oferta_asignaturas oa ON ap.id_oferta = oa.id_oferta
                JOIN academico.asignaturas a ON oa.id_asignatura = a.id_asignatura
                WHERE TRIM(UPPER(ap.dni)) = TRIM(UPPER($1))`, 
                [localUser.dni]
            );

            // Limpieza de asignaciones previas para evitar duplicidad o residuales
            await appDb.query(`DELETE FROM cache_academico.asignaciones_profesor WHERE id_usuario_app = $1`, [localUser.id_usuario_app]);

            for (const p of profData) {
                // CORRECCIÓN: Inserción de 'version' obligatoria (NOT NULL) en planes_estudio
                await appDb.query(
                    `INSERT INTO cache_academico.planes_estudio (id_plan, nombre, version) 
                     VALUES ($1, $2, $3) ON CONFLICT (id_plan) DO NOTHING`, 
                    [p.id_plan, p.nombre_plan || 'Plan Docente', '1.0']
                );
                
                await appDb.query(`INSERT INTO cache_academico.asignaturas (id_asignatura, codigo, nombre) VALUES ($1, $2, $3) ON CONFLICT (id_asignatura) DO NOTHING`, [p.id_asignatura, p.codigo_asig, p.nombre_asig]);
                await appDb.query(`INSERT INTO cache_academico.oferta_asignaturas (id_oferta, id_plan, id_asignatura, curso) VALUES ($1, $2, $3, $4) ON CONFLICT (id_oferta) DO NOTHING`, [p.id_oferta, p.id_plan, p.id_asignatura, p.curso]);
                await appDb.query(`INSERT INTO cache_academico.clases (id_clase, id_plan, curso, grupo, nombre) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id_clase) DO NOTHING`, [p.id_clase, p.id_plan, p.curso, p.grupo, p.nombre_clase]);

                await appDb.query(
                    `INSERT INTO cache_academico.asignaciones_profesor (id_usuario_app, id_clase, id_oferta)
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [localUser.id_usuario_app, p.id_clase, p.id_oferta]
                );

                // Asegurar que las salas de chat para las asignaturas del profesor existan
                await appDb.query(`INSERT INTO comunicacion.salas_chat (id_clase, id_oferta) VALUES ($1, $2) ON CONFLICT (id_clase, id_oferta) DO NOTHING`, [p.id_clase, p.id_oferta]);
            }
        }

        // 6. CREACIÓN DE CHATS PRIVADOS (ALUMNO <-> PROFESOR)
        // Se ejecuta después de la sincronización de asignaturas para tener los vínculos correctos.
        await crearChatsPrivadosAuto(localUser.id_usuario_app, localUser.tipo_externo);
        
        // 7. REGISTRO DE ÉXITO EN EL LOG DE SINCRONIZACIÓN
        await appDb.query(
            `INSERT INTO seguridad.sync_estado_usuario (id_usuario_app, ultimo_sync, ultimo_sync_ok)
             VALUES ($1, NOW(), true)
             ON CONFLICT (id_usuario_app) DO UPDATE SET ultimo_sync = NOW(), ultimo_sync_ok = true`,
            [localUser.id_usuario_app]
        );

    } catch (syncErr) {
        console.error("CRITICAL SYNC ERROR:", syncErr.message);
        
        // Registro de fallo para auditoría técnica
        await appDb.query(
            `INSERT INTO seguridad.sync_estado_usuario (id_usuario_app, ultimo_sync, ultimo_sync_ok, detalle_ultimo_error)
             VALUES ($1, NOW(), false, $2)
             ON CONFLICT (id_usuario_app) DO UPDATE SET ultimo_sync = NOW(), ultimo_sync_ok = false, detalle_ultimo_error = $2`,
            [localUser.id_usuario_app, syncErr.message]
        );
    }

    // 8. GENERACIÓN DEL TOKEN DE ACCESO (JWT)
    // Se incluyen flags explícitos para facilitar la lógica en React Native (móvil).
    const esProfesor = localUser.tipo_externo === 'PROFESOR';
    
    const token = jwt.sign(
        { 
            sub: localUser.id_usuario_app, 
            rol: localUser.id_rol, 
            tipo: localUser.tipo_externo,
            esProfesor: esProfesor 
        },
        process.env.JWT_SECRET || 'clave_secreta_temporal',
        { expiresIn: "7d" }
    );

    console.log(`[Auth Success] Sesión emitida para ${localUser.nombre} (ID: ${localUser.id_usuario_app})`);

    // 9. RESPUESTA AL CONTROLADOR
    return {
        token,
        usuario: {
            id: localUser.id_usuario_app,
            id_usuario_externo: localUser.id_usuario_externo,
            nombre: localUser.nombre,
            apellidos: localUser.apellidos,
            cial: localUser.cial,
            email: extUser.email?.trim() || '',
            telefono: extUser.telefono?.trim() || '',
            tipo: localUser.tipo_externo,
            esProfesor: esProfesor, // Clave para ChatInfoScreen
            dni: localUser.dni,
            id_rol: localUser.id_rol,
            codigo_centro: localUser.codigo_centro
        }
    };
};
