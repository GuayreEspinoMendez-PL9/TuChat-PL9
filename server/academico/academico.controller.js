import { appDb, gobDb } from "../db/db.js";
import crypto from "crypto";

/**
 * Obtiene los chats disponibles - USANDO LAS VISTAS QUE FUNCIONAN
 */
export const getChatsDisponibles = async (req, res) => {
    const { id_usuario_app, tipo_externo } = req.currentUser;
    
    try {
        let rows;

        if (tipo_externo === 'ALUMNO') {
            // Alumnos: query directa por matriculas (tiene id_clase, robusto)
            const result = await appDb.query(
                `SELECT DISTINCT ON (sc.id_sala)
                    sc.id_sala as id_chat,
                    sc.id_oferta,
                    m.id_clase,
                    a.nombre as nombre,
                    cl.nombre as subtitulo,
                    false as "esProfesor"
                 FROM cache_academico.matriculas m
                 JOIN cache_academico.matriculas_asignaturas ma ON ma.id_matricula = m.id_matricula
                 JOIN cache_academico.oferta_asignaturas oa ON oa.id_oferta = ma.id_oferta
                 JOIN cache_academico.asignaturas a ON a.id_asignatura = oa.id_asignatura
                 JOIN cache_academico.clases cl ON cl.id_clase = m.id_clase
                 JOIN comunicacion.salas_chat sc
                    ON sc.id_clase = m.id_clase
                    AND sc.id_oferta = ma.id_oferta
                 WHERE m.id_usuario_app = $1
                 ORDER BY sc.id_sala, a.nombre ASC`,
                [id_usuario_app]
            );
            rows = result.rows;
            console.log("[ChatsDisponibles][Alumno]", { id_usuario_app, rows });
        } else {
            // Profesores: query via vista (no tienen matriculas en cache)
            const vista = 'cache_academico.v_asignaturas_visibles_chat_profesor';
            const result = await appDb.query(
                `SELECT DISTINCT ON (sc.id_sala)
                    sc.id_sala as id_chat,
                    sc.id_oferta,
                    cl.id_clase,
                    v.nombre_asignatura as nombre,
                    v.nombre_clase as subtitulo,
                    true as "esProfesor"
                 FROM ${vista} v
                 JOIN cache_academico.clases cl ON cl.nombre = v.nombre_clase
                 JOIN comunicacion.salas_chat sc ON sc.id_clase = cl.id_clase
                 JOIN cache_academico.oferta_asignaturas oa
                    ON oa.id_oferta = sc.id_oferta
                    AND oa.id_asignatura = v.id_asignatura
                 WHERE v.id_usuario_app = $1
                 ORDER BY sc.id_sala, v.nombre_asignatura ASC`,
                [id_usuario_app]
            );
            rows = result.rows;
            console.log("[ChatsDisponibles][Profesor]", { id_usuario_app, rows });
        }

        return res.json({ ok: true, chats: rows });

    } catch (error) {
        console.error("Error al obtener chats:", error);
        return res.status(500).json({ ok: false, msg: "Error al obtener chats" });
    }
};

/**
 * Sincroniza las salas de chat para las clases/asignaturas del usuario.
 * Se llama tras forzarSync para que los nuevos chats aparezcan sin re-login.
 */
async function sincronizarSalasChat(id_usuario_app, tipo_externo, dni) {
    try {
        if (tipo_externo === 'ALUMNO') {
            // Obtener todas las clases+ofertas del alumno desde gobDb
            const { rows: extData } = await gobDb.query(`
                SELECT DISTINCT m.id_clase, m.id_oferta
                FROM externo.v_matriculas_actuales m
                WHERE m.dni = $1
            `, [dni]);

            for (const d of extData) {
                // Crear sala si no existe para esa clase+oferta
                await appDb.query(`
                    INSERT INTO comunicacion.salas_chat (id_clase, id_oferta)
                    VALUES ($1, $2)
                    ON CONFLICT (id_clase, id_oferta) DO NOTHING
                `, [d.id_clase, d.id_oferta]);
            }
            console.log(`[Sync] Salas de chat sincronizadas para alumno (${extData.length} clase/oferta).`);

        } else if (tipo_externo === 'PROFESOR') {
            // Obtener las clases del profesor desde la cache local
            const { rows: asignaciones } = await appDb.query(`
                SELECT DISTINCT ap.id_clase, oa.id_oferta
                FROM cache_academico.asignaciones_profesor ap
                JOIN cache_academico.oferta_asignaturas oa ON oa.id_plan = (
                    SELECT id_plan FROM cache_academico.clases WHERE id_clase = ap.id_clase LIMIT 1
                )
                WHERE ap.id_usuario_app = $1
            `, [id_usuario_app]);

            for (const d of asignaciones) {
                await appDb.query(`
                    INSERT INTO comunicacion.salas_chat (id_clase, id_oferta)
                    VALUES ($1, $2)
                    ON CONFLICT (id_clase, id_oferta) DO NOTHING
                `, [d.id_clase, d.id_oferta]);
            }
            console.log(`[Sync] Salas de chat sincronizadas para profesor (${asignaciones.length} clase/oferta).`);
        }
    } catch (err) {
        console.error("[Sync] Error sincronizando salas de chat:", err.message);
        // No lanzamos error: es mejor mostrar menos chats que bloquear el sync
    }
}

/**
 * Crea chats privados automáticamente entre alumnos y profesores de la misma clase
 */
async function crearChatsPrivadosAuto(id_usuario_app, tipo_externo) {
    try {
        if (tipo_externo === 'ALUMNO') {
            const { rows: profesores } = await appDb.query(`
                SELECT DISTINCT ap.id_usuario_app as id_profesor
                FROM cache_academico.matriculas m
                JOIN cache_academico.matriculas_asignaturas ma ON ma.id_matricula = m.id_matricula
                JOIN cache_academico.asignaciones_profesor ap
                    ON ap.id_clase = m.id_clase
                   AND ap.id_oferta = ma.id_oferta
                WHERE m.id_usuario_app = $1
            `, [id_usuario_app]);

            console.log("[ChatsPrivadosAuto][Alumno]", { id_usuario_app, profesores });

            for (const prof of profesores) {
                await appDb.query(`
                    INSERT INTO comunicacion.chats_privados (id_profesor_usuario_app, id_alumno_usuario_app)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [prof.id_profesor, id_usuario_app]);
            }
            console.log(`[Sync] ${profesores.length} chats privados sincronizados (alumno→profesores).`);

        } else if (tipo_externo === 'PROFESOR') {
            const { rows: alumnos } = await appDb.query(`
                SELECT DISTINCT m.id_usuario_app as id_alumno
                FROM cache_academico.asignaciones_profesor ap
                JOIN cache_academico.matriculas m ON m.id_clase = ap.id_clase
                JOIN cache_academico.matriculas_asignaturas ma
                    ON ma.id_matricula = m.id_matricula
                   AND ma.id_oferta = ap.id_oferta
                WHERE ap.id_usuario_app = $1
            `, [id_usuario_app]);

            console.log("[ChatsPrivadosAuto][Profesor]", { id_usuario_app, alumnos });

            for (const alu of alumnos) {
                await appDb.query(`
                    INSERT INTO comunicacion.chats_privados (id_profesor_usuario_app, id_alumno_usuario_app)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [id_usuario_app, alu.id_alumno]);
            }
            console.log(`[Sync] ${alumnos.length} chats privados sincronizados (profesor→alumnos).`);
        }
    } catch (chatErr) {
        console.error("[Sync] Error creando chats privados:", chatErr.message);
    }
}

/**
 * Sincronización completa con la DB del Gobierno
 */
export const forzarSync = async (req, res) => {
    const { id_usuario_app, dni, tipo_externo } = req.currentUser;

    try {
        if (tipo_externo === 'ALUMNO') {
            const { rows: extData } = await gobDb.query(`
                SELECT 
                    m.id_usuario_externo, m.id_clase, m.id_oferta, m.estado,
                    c.id_plan, c.curso, c.grupo, c.nombre as nombre_clase,
                    oa.id_asignatura,
                    a.codigo as codigo_asig, a.nombre as nombre_asig
                FROM externo.v_matriculas_actuales m
                JOIN academico.clases c ON m.id_clase = c.id_clase
                JOIN academico.oferta_asignaturas oa ON m.id_oferta = oa.id_oferta
                JOIN academico.asignaturas a ON oa.id_asignatura = a.id_asignatura
                WHERE m.dni = $1`, 
                [dni]
            );

            if (extData.length === 0) return res.json({ ok: true, msg: "Sin datos" });

            await appDb.query("BEGIN");

            await appDb.query(`
                DELETE FROM cache_academico.matriculas_asignaturas 
                WHERE id_matricula IN (SELECT id_matricula FROM cache_academico.matriculas WHERE id_usuario_app = $1)`, 
                [id_usuario_app]
            );
            await appDb.query("DELETE FROM cache_academico.matriculas WHERE id_usuario_app = $1", [id_usuario_app]);

            const matriculasProcesadas = {};

            for (const d of extData) {
                await appDb.query(`INSERT INTO cache_academico.asignaturas (id_asignatura, codigo, nombre) VALUES ($1, $2, $3) ON CONFLICT (id_asignatura) DO UPDATE SET nombre = EXCLUDED.nombre`, [d.id_asignatura, d.codigo_asig, d.nombre_asig]);
                await appDb.query(`INSERT INTO cache_academico.clases (id_clase, id_plan, curso, grupo, nombre) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id_clase) DO UPDATE SET nombre = EXCLUDED.nombre`, [d.id_clase, d.id_plan, d.curso, d.grupo, d.nombre_clase]);
                await appDb.query(`INSERT INTO cache_academico.oferta_asignaturas (id_oferta, id_plan, id_asignatura, curso) VALUES ($1, $2, $3, $4) ON CONFLICT (id_oferta) DO NOTHING`, [d.id_oferta, d.id_plan, d.id_asignatura, d.curso]);

                let idMat;
                if (!matriculasProcesadas[d.id_clase]) {
                    idMat = crypto.randomUUID();
                    await appDb.query(
                        `INSERT INTO cache_academico.matriculas (id_matricula, id_usuario_app, id_clase, id_alumno_externo)
                         VALUES ($1, $2, $3, $4)`,
                        [idMat, id_usuario_app, d.id_clase, d.id_usuario_externo]
                    );
                    matriculasProcesadas[d.id_clase] = idMat;
                } else {
                    idMat = matriculasProcesadas[d.id_clase];
                }

                await appDb.query(
                    `INSERT INTO cache_academico.matriculas_asignaturas (id_matricula, id_oferta, estado)
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [idMat, d.id_oferta, d.estado]
                );
            }
            await appDb.query("COMMIT");

        // Crear/sincronizar salas de chat para las nuevas clases
        await sincronizarSalasChat(id_usuario_app, tipo_externo, dni);
        }

        // Crear chats privados automáticos después de sincronizar
        await crearChatsPrivadosAuto(id_usuario_app, tipo_externo);

        return res.json({ ok: true, msg: "Sincronización OK" });
    } catch (error) {
        await appDb.query("ROLLBACK");
        console.error("Error Sync:", error);
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

/**
 * Obtiene los IDs de miembros de una clase/asignatura (para notificaciones)
 */
export const getMiembrosClase = async (req, res) => {
    const { id } = req.params; // id_sala
    try {
        const { rows } = await appDb.query(`
            SELECT DISTINCT sub.id_usuario_app FROM (
                SELECT va.id_usuario_app
                FROM comunicacion.salas_chat sc
                JOIN cache_academico.oferta_asignaturas oa ON oa.id_oferta = sc.id_oferta
                JOIN cache_academico.v_asignaturas_visibles_chat_alumno va 
                    ON va.id_asignatura = oa.id_asignatura
                JOIN cache_academico.clases cl ON cl.id_clase = sc.id_clase
                WHERE sc.id_sala = $1
                UNION
                SELECT vp.id_usuario_app
                FROM comunicacion.salas_chat sc
                JOIN cache_academico.oferta_asignaturas oa ON oa.id_oferta = sc.id_oferta
                JOIN cache_academico.v_asignaturas_visibles_chat_profesor vp 
                    ON vp.id_asignatura = oa.id_asignatura
                JOIN cache_academico.clases cl ON cl.id_clase = sc.id_clase
                WHERE sc.id_sala = $1
            ) sub
        `, [id]);
        
        const ids = rows.map(r => r.id_usuario_app);
        res.json({ ok: true, ids });
    } catch (error) {
        console.error("Error en getMiembrosClase:", error);
        res.status(500).json({ ok: false, msg: "Error al obtener miembros" });
    }
};

// Exportar para usar desde auth.service.js
export { crearChatsPrivadosAuto };
