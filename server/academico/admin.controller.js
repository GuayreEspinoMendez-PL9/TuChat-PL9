import { appDb, gobDb } from "../db/db.js";
import { logAdminAction } from "../auth/admin.middleware.js";
import crypto from "crypto";

const sha256 = (input) => crypto.createHash("sha256").update(input).digest("hex");

// ============================================================
// DASHBOARD
// ============================================================
export const getDashboard = async (req, res) => {
    try {
        const { rows: [stats] } = await appDb.query(`SELECT * FROM seguridad.v_admin_estadisticas`);
        const { rows: ultimosUsuarios } = await appDb.query(`SELECT nombre, apellidos, tipo_externo, created_at FROM seguridad.usuarios_app ORDER BY created_at DESC LIMIT 10`);
        const { rows: ultimasAcciones } = await appDb.query(`SELECT al.accion, al.entidad, al.detalle, al.created_at, u.nombre as admin_nombre FROM seguridad.admin_audit_log al JOIN seguridad.usuarios_app u ON u.id_usuario_app = al.id_admin ORDER BY al.created_at DESC LIMIT 10`);
        const { rows: porCentro } = await appDb.query(`SELECT codigo_centro, count(*) as total FROM seguridad.usuarios_app WHERE codigo_centro IS NOT NULL AND activo = true GROUP BY codigo_centro ORDER BY total DESC LIMIT 10`);

        // Contar en gobDb
        const { rows: [gobStats] } = await gobDb.query(`SELECT (SELECT count(*) FROM externo.centros) as centros, (SELECT count(*) FROM externo.personas) as personas, (SELECT count(*) FROM academico.cursos_escolares) as cursos_escolares, (SELECT count(*) FROM academico.planes_estudio) as planes_estudio, (SELECT count(*) FROM academico.oferta_asignaturas) as ofertas, (SELECT count(*) FROM academico.asignaciones_profesor) as asignaciones_profesor`);

        return res.json({ ok: true, stats: { ...stats, ...gobStats }, ultimosUsuarios, ultimasAcciones, porCentro });
    } catch (error) {
        console.error("[Admin Dashboard Error]:", error);
        return res.status(500).json({ ok: false, msg: "Error al obtener estadísticas" });
    }
};

// ============================================================
// CENTROS (gobDb - externo.centros)
// ============================================================
export const getCentros = async (req, res) => {
    try {
        const { rows } = await gobDb.query(`
            SELECT c.*, 
                (SELECT count(*) FROM externo.usuarios_gobierno ug WHERE ug.id_centro = c.id_centro AND ug.activo = true) as total_usuarios,
                (SELECT count(*) FROM externo.usuarios_gobierno ug WHERE ug.id_centro = c.id_centro AND ug.tipo = 'ALUMNO' AND ug.activo = true) as total_alumnos,
                (SELECT count(*) FROM externo.usuarios_gobierno ug WHERE ug.id_centro = c.id_centro AND ug.tipo = 'PROFESOR' AND ug.activo = true) as total_profesores
            FROM externo.centros c ORDER BY c.nombre`);
        return res.json({ ok: true, centros: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener centros" });
    }
};

export const crearCentro = async (req, res) => {
    try {
        const { codigo_centro, nombre, isla, municipio } = req.body;
        if (!codigo_centro || !nombre) return res.status(400).json({ ok: false, msg: "codigo_centro y nombre obligatorios" });
        const { rows: [centro] } = await gobDb.query(
            `INSERT INTO externo.centros (codigo_centro, nombre, isla, municipio) VALUES ($1, $2, $3, $4) RETURNING *`,
            [codigo_centro.trim(), nombre.trim(), isla?.trim() || null, municipio?.trim() || null]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'centro', centro.id_centro, { codigo_centro, nombre }, req.ip);
        return res.json({ ok: true, msg: "Centro creado", centro });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ ok: false, msg: "Ya existe un centro con ese código" });
        return res.status(500).json({ ok: false, msg: "Error al crear centro" });
    }
};

export const actualizarCentro = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo_centro, nombre, isla, municipio, activo } = req.body;
        const { rows: [centro] } = await gobDb.query(
            `UPDATE externo.centros SET codigo_centro = COALESCE($1, codigo_centro), nombre = COALESCE($2, nombre), isla = COALESCE($3, isla), municipio = COALESCE($4, municipio), activo = COALESCE($5, activo), updated_at = NOW() WHERE id_centro = $6 RETURNING *`,
            [codigo_centro?.trim(), nombre?.trim(), isla?.trim(), municipio?.trim(), activo, id]);
        if (!centro) return res.status(404).json({ ok: false, msg: "Centro no encontrado" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'centro', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Centro actualizado", centro });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al actualizar centro" });
    }
};

export const eliminarCentro = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: [centro] } = await gobDb.query(`UPDATE externo.centros SET activo = false, updated_at = NOW() WHERE id_centro = $1 RETURNING nombre`, [id]);
        if (!centro) return res.status(404).json({ ok: false, msg: "Centro no encontrado" });
        await logAdminAction(req.currentUser.id_usuario_app, 'DESACTIVAR', 'centro', id, { nombre: centro.nombre }, req.ip);
        return res.json({ ok: true, msg: "Centro desactivado" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// CURSOS ESCOLARES (gobDb - academico.cursos_escolares)
// ============================================================
export const getCursosEscolares = async (req, res) => {
    try {
        const { rows } = await gobDb.query(`SELECT * FROM academico.cursos_escolares ORDER BY fecha_inicio DESC`);
        return res.json({ ok: true, cursos: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener cursos escolares" });
    }
};

export const crearCursoEscolar = async (req, res) => {
    try {
        const { nombre, fecha_inicio, fecha_fin } = req.body;
        if (!nombre) return res.status(400).json({ ok: false, msg: "nombre obligatorio" });

        const isValidDate = (str) => {
            if (!str || !str.trim()) return false;
            const d = new Date(str);
            return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(str.trim());
        };

        const fechaInicio = isValidDate(fecha_inicio) ? fecha_inicio.trim() : null;
        const fechaFin = isValidDate(fecha_fin) ? fecha_fin.trim() : null;

        const { rows: [curso] } = await gobDb.query(
            `INSERT INTO academico.cursos_escolares (nombre, fecha_inicio, fecha_fin) VALUES ($1, $2, $3) RETURNING *`,
            [nombre.trim(), fechaInicio, fechaFin]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'curso_escolar', curso.id_curso_escolar, { nombre }, req.ip);
        return res.json({ ok: true, msg: "Curso escolar creado", curso });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ ok: false, msg: "Ya existe un curso con ese nombre" });
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const actualizarCursoEscolar = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, fecha_inicio, fecha_fin, activo } = req.body;

        // Validar formato de fecha si se proporciona
        const isValidDate = (str) => {
            if (!str || !str.trim()) return false;
            const d = new Date(str);
            return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(str.trim());
        };

        const fechaInicio = isValidDate(fecha_inicio) ? fecha_inicio.trim() : null;
        const fechaFin = isValidDate(fecha_fin) ? fecha_fin.trim() : null;

        const { rows: [curso] } = await gobDb.query(
            `UPDATE academico.cursos_escolares SET nombre = COALESCE($1, nombre), fecha_inicio = COALESCE($2, fecha_inicio), fecha_fin = COALESCE($3, fecha_fin), activo = COALESCE($4, activo), updated_at = NOW() WHERE id_curso_escolar = $5 RETURNING *`,
            [nombre?.trim() || null, fechaInicio, fechaFin, activo ?? null, id]);

        if (!curso) return res.status(404).json({ ok: false, msg: "Curso no encontrado" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'curso_escolar', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Curso actualizado", curso });
    } catch (error) {
        console.error("[actualizarCursoEscolar]:", error);
        return res.status(500).json({ ok: false, msg: "Error", detail: error.message });
    }
};

export const eliminarCursoEscolar = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: clases } = await gobDb.query(
            `SELECT id_clase FROM academico.clases WHERE id_curso_escolar = $1 LIMIT 1`, [id]);
        if (clases.length > 0)
            return res.status(409).json({ ok: false, msg: "No se puede eliminar: tiene clases asociadas" });

        const { rows: [curso] } = await gobDb.query(
            `DELETE FROM academico.cursos_escolares WHERE id_curso_escolar = $1 RETURNING nombre`, [id]);
        if (!curso) return res.status(404).json({ ok: false, msg: "Curso no encontrado" });

        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'curso_escolar', id, { nombre: curso.nombre }, req.ip);
        return res.json({ ok: true, msg: "Curso escolar eliminado" });
    } catch (error) {
        if (error.code === '23503')
            return res.status(409).json({ ok: false, msg: "No se puede eliminar: tiene clases asociadas" });
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// PLANES DE ESTUDIO (gobDb - academico.planes_estudio)
// ============================================================
export const getPlanes = async (req, res) => {
    try {
        const { rows } = await gobDb.query(`
            SELECT p.*,
                (SELECT count(*) FROM academico.oferta_asignaturas oa WHERE oa.id_plan = p.id_plan) as total_ofertas,
                (SELECT count(*) FROM academico.clases c WHERE c.id_plan = p.id_plan) as total_clases
            FROM academico.planes_estudio p ORDER BY p.nombre`);
        return res.json({ ok: true, planes: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener planes" });
    }
};

export const crearPlan = async (req, res) => {
    try {
        const { nombre, version, descripcion } = req.body;
        if (!nombre || !version) return res.status(400).json({ ok: false, msg: "nombre y version obligatorios" });
        const { rows: [plan] } = await gobDb.query(
            `INSERT INTO academico.planes_estudio (nombre, version, descripcion) VALUES ($1, $2, $3) RETURNING *`,
            [nombre.trim(), version.trim(), descripcion?.trim() || null]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'plan_estudio', plan.id_plan, { nombre, version }, req.ip);
        return res.json({ ok: true, msg: "Plan creado", plan });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const actualizarPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, version, descripcion } = req.body;
        const { rows: [plan] } = await gobDb.query(
            `UPDATE academico.planes_estudio SET nombre = COALESCE($1, nombre), version = COALESCE($2, version), descripcion = COALESCE($3, descripcion) WHERE id_plan = $4 RETURNING *`,
            [nombre?.trim(), version?.trim(), descripcion?.trim(), id]);
        if (!plan) return res.status(404).json({ ok: false, msg: "Plan no encontrado" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'plan_estudio', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Plan actualizado", plan });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const eliminarPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: [plan] } = await gobDb.query(`DELETE FROM academico.planes_estudio WHERE id_plan = $1 RETURNING nombre`, [id]);
        if (!plan) return res.status(404).json({ ok: false, msg: "Plan no encontrado" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'plan_estudio', id, { nombre: plan.nombre }, req.ip);
        return res.json({ ok: true, msg: "Plan eliminado" });
    } catch (error) {
        if (error.code === '23503') return res.status(409).json({ ok: false, msg: "No se puede eliminar: tiene clases u ofertas asociadas" });
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// ASIGNATURAS (gobDb - academico.asignaturas)
// ============================================================
export const getAsignaturas = async (req, res) => {
    try {
        const { buscar, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const params = [];
        let where = '';
        if (buscar) { params.push(`%${buscar}%`); where = `WHERE a.nombre ILIKE $1 OR a.codigo ILIKE $1`; }
        const { rows: [{ total }] } = await gobDb.query(`SELECT count(*) as total FROM academico.asignaturas a ${where}`, params);
        params.push(limit, offset);
        const { rows } = await gobDb.query(
            `SELECT a.*, (SELECT count(*) FROM academico.oferta_asignaturas oa WHERE oa.id_asignatura = a.id_asignatura) as total_ofertas
             FROM academico.asignaturas a ${where} ORDER BY a.nombre LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({ ok: true, asignaturas: rows, paginacion: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener asignaturas" });
    }
};

export const crearAsignatura = async (req, res) => {
    try {
        const { codigo, nombre, descripcion, horas } = req.body;
        if (!codigo || !nombre) return res.status(400).json({ ok: false, msg: "codigo y nombre obligatorios" });
        const { rows: [asig] } = await gobDb.query(
            `INSERT INTO academico.asignaturas (codigo, nombre, descripcion, horas) VALUES ($1, $2, $3, $4) RETURNING *`,
            [codigo.trim().toUpperCase(), nombre.trim(), descripcion?.trim() || null, horas || null]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'asignatura', asig.id_asignatura, { codigo, nombre }, req.ip);
        return res.json({ ok: true, msg: "Asignatura creada", asignatura: asig });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ ok: false, msg: "Ya existe una asignatura con ese código" });
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const actualizarAsignatura = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, horas } = req.body;
        const { rows: [asig] } = await gobDb.query(
            `UPDATE academico.asignaturas SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre), descripcion = COALESCE($3, descripcion), horas = COALESCE($4, horas), updated_at = NOW() WHERE id_asignatura = $5 RETURNING *`,
            [codigo?.trim().toUpperCase(), nombre?.trim(), descripcion?.trim(), horas, id]);
        if (!asig) return res.status(404).json({ ok: false, msg: "No encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'asignatura', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Asignatura actualizada", asignatura: asig });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const eliminarAsignatura = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: [asig] } = await gobDb.query(`DELETE FROM academico.asignaturas WHERE id_asignatura = $1 RETURNING nombre`, [id]);
        if (!asig) return res.status(404).json({ ok: false, msg: "No encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'asignatura', id, { nombre: asig.nombre }, req.ip);
        return res.json({ ok: true, msg: "Asignatura eliminada" });
    } catch (error) {
        if (error.code === '23503') return res.status(409).json({ ok: false, msg: "No se puede eliminar: tiene ofertas asociadas. Elimine las ofertas primero." });
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// CLASES (gobDb - academico.clases)
// ============================================================
export const getClases = async (req, res) => {
    try {
        const { buscar, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const params = [];
        let where = '';
        if (buscar) { params.push(`%${buscar}%`); where = `WHERE c.nombre ILIKE $1 OR p.nombre ILIKE $1`; }
        const { rows: [{ total }] } = await gobDb.query(`SELECT count(*) as total FROM academico.clases c LEFT JOIN academico.planes_estudio p ON p.id_plan = c.id_plan ${where}`, params);
        params.push(limit, offset);
        const { rows } = await gobDb.query(`
            SELECT c.*, p.nombre as nombre_plan, p.version as version_plan, ce.nombre as nombre_centro, ce.codigo_centro,
                (SELECT count(*) FROM academico.matriculas m WHERE m.id_clase = c.id_clase) as total_alumnos,
                (SELECT count(DISTINCT ap.id_profesor_externo) FROM academico.asignaciones_profesor ap WHERE ap.id_clase = c.id_clase) as total_profesores
            FROM academico.clases c
            LEFT JOIN academico.planes_estudio p ON p.id_plan = c.id_plan
            LEFT JOIN externo.centros ce ON ce.id_centro = c.id_centro
            ${where} ORDER BY c.nombre LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({ ok: true, clases: rows, paginacion: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener clases" });
    }
};

export const getClaseDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: [clase] } = await gobDb.query(`
            SELECT c.*, p.nombre as nombre_plan, ce.nombre as nombre_centro FROM academico.clases c
            LEFT JOIN academico.planes_estudio p ON p.id_plan = c.id_plan LEFT JOIN externo.centros ce ON ce.id_centro = c.id_centro
            WHERE c.id_clase = $1`, [id]);
        if (!clase) return res.status(404).json({ ok: false, msg: "Clase no encontrada" });
        const { rows: alumnos } = await gobDb.query(`SELECT m.id_matricula, pe.nombre, pe.apellidos, pe.dni FROM academico.matriculas m JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = m.id_alumno_externo JOIN externo.personas pe ON pe.id_persona = ug.id_persona WHERE m.id_clase = $1 ORDER BY pe.nombre`, [id]);
        const { rows: profesores } = await gobDb.query(`SELECT DISTINCT pe.nombre, pe.apellidos, a.nombre as asignatura FROM academico.asignaciones_profesor ap JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = ap.id_profesor_externo JOIN externo.personas pe ON pe.id_persona = ug.id_persona JOIN academico.oferta_asignaturas oa ON oa.id_oferta = ap.id_oferta JOIN academico.asignaturas a ON a.id_asignatura = oa.id_asignatura WHERE ap.id_clase = $1 ORDER BY pe.nombre`, [id]);
        return res.json({ ok: true, clase, alumnos, profesores });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const crearClase = async (req, res) => {
    try {
        const { nombre, id_plan, id_centro, id_curso_escolar, curso, grupo } = req.body;
        if (!nombre || !id_plan || !id_centro || !id_curso_escolar || !curso || !grupo) return res.status(400).json({ ok: false, msg: "Todos los campos son obligatorios" });
        const { rows: [clase] } = await gobDb.query(
            `INSERT INTO academico.clases (nombre, id_plan, id_centro, id_curso_escolar, curso, grupo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [nombre.trim(), id_plan, id_centro, id_curso_escolar, parseInt(curso), grupo.trim().toUpperCase()]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'clase', clase.id_clase, { nombre, curso, grupo }, req.ip);
        return res.json({ ok: true, msg: "Clase creada", clase });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al crear clase" });
    }
};

export const actualizarClase = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, curso, grupo, id_plan, id_centro, id_curso_escolar, activa } = req.body;
        const { rows: [clase] } = await gobDb.query(
            `UPDATE academico.clases SET nombre = COALESCE($1, nombre), curso = COALESCE($2, curso), grupo = COALESCE($3, grupo), id_plan = COALESCE($4, id_plan), id_centro = COALESCE($5, id_centro), id_curso_escolar = COALESCE($6, id_curso_escolar), activa = COALESCE($7, activa), updated_at = NOW() WHERE id_clase = $8 RETURNING *`,
            [nombre?.trim(), curso ? parseInt(curso) : null, grupo?.trim().toUpperCase(), id_plan, id_centro, id_curso_escolar, activa, id]);
        if (!clase) return res.status(404).json({ ok: false, msg: "Clase no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'clase', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Clase actualizada", clase });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const eliminarClase = async (req, res) => {
    try {
        const { id } = req.params;
        await gobDb.query(`DELETE FROM academico.matriculas_asignaturas WHERE id_matricula IN (SELECT id_matricula FROM academico.matriculas WHERE id_clase = $1)`, [id]);
        await gobDb.query(`DELETE FROM academico.matriculas WHERE id_clase = $1`, [id]);
        await gobDb.query(`DELETE FROM academico.asignaciones_profesor WHERE id_clase = $1`, [id]);
        const { rows: [clase] } = await gobDb.query(`DELETE FROM academico.clases WHERE id_clase = $1 RETURNING nombre`, [id]);
        if (!clase) return res.status(404).json({ ok: false, msg: "Clase no encontrada" });
        // También limpiar cache
        await appDb.query(`DELETE FROM comunicacion.salas_chat WHERE id_clase = $1`, [id]).catch(() => {});
        await appDb.query(`DELETE FROM cache_academico.matriculas_asignaturas WHERE id_matricula IN (SELECT id_matricula FROM cache_academico.matriculas WHERE id_clase = $1)`, [id]).catch(() => {});
        await appDb.query(`DELETE FROM cache_academico.matriculas WHERE id_clase = $1`, [id]).catch(() => {});
        await appDb.query(`DELETE FROM cache_academico.asignaciones_profesor WHERE id_clase = $1`, [id]).catch(() => {});
        await appDb.query(`DELETE FROM cache_academico.clases WHERE id_clase = $1`, [id]).catch(() => {});
        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'clase', id, { nombre: clase.nombre }, req.ip);
        return res.json({ ok: true, msg: "Clase eliminada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al eliminar" });
    }
};

export const toggleClaseActiva = async (req, res) => {
    try {
        const { id } = req.params;
        const { activa } = req.body;
        const { rows: [clase] } = await gobDb.query(`UPDATE academico.clases SET activa = $1, updated_at = NOW() WHERE id_clase = $2 RETURNING nombre, activa`, [activa, id]);
        if (!clase) return res.status(404).json({ ok: false, msg: "Clase no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, activa ? 'ACTIVAR' : 'DESACTIVAR', 'clase', id, { nombre: clase.nombre }, req.ip);
        return res.json({ ok: true, msg: `Clase ${activa ? 'activada' : 'desactivada'}`, clase });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// OFERTAS DE ASIGNATURAS (gobDb - academico.oferta_asignaturas)
// ============================================================
export const getOfertas = async (req, res) => {
    try {
        const { id_plan } = req.query;
        let where = ''; const params = [];
        if (id_plan) { params.push(id_plan); where = `WHERE oa.id_plan = $1`; }
        const { rows } = await gobDb.query(`
            SELECT oa.*, a.nombre as nombre_asignatura, a.codigo as codigo_asignatura, p.nombre as nombre_plan
            FROM academico.oferta_asignaturas oa
            JOIN academico.asignaturas a ON a.id_asignatura = oa.id_asignatura
            JOIN academico.planes_estudio p ON p.id_plan = oa.id_plan
            ${where} ORDER BY p.nombre, oa.curso, a.nombre`, params);
        return res.json({ ok: true, ofertas: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener ofertas" });
    }
};

export const crearOferta = async (req, res) => {
    try {
        const { id_plan, id_asignatura, curso, obligatoria } = req.body;
        if (!id_plan || !id_asignatura || !curso) return res.status(400).json({ ok: false, msg: "id_plan, id_asignatura y curso obligatorios" });
        const { rows: [oferta] } = await gobDb.query(
            `INSERT INTO academico.oferta_asignaturas (id_plan, id_asignatura, curso, obligatoria) VALUES ($1, $2, $3, $4) RETURNING *`,
            [id_plan, id_asignatura, parseInt(curso), obligatoria !== false]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'oferta', oferta.id_oferta, req.body, req.ip);
        return res.json({ ok: true, msg: "Oferta creada", oferta });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const actualizarOferta = async (req, res) => {
    try {
        const { id } = req.params;
        const { curso, obligatoria } = req.body;
        const { rows: [oferta] } = await gobDb.query(
            `UPDATE academico.oferta_asignaturas SET curso = COALESCE($1, curso), obligatoria = COALESCE($2, obligatoria) WHERE id_oferta = $3 RETURNING *`,
            [curso ? parseInt(curso) : null, obligatoria, id]);
        if (!oferta) return res.status(404).json({ ok: false, msg: "Oferta no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'oferta', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Oferta actualizada", oferta });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const eliminarOferta = async (req, res) => {
    try {
        const { id } = req.params;
        await gobDb.query(`DELETE FROM academico.matriculas_asignaturas WHERE id_oferta = $1`, [id]);
        await gobDb.query(`DELETE FROM academico.asignaciones_profesor WHERE id_oferta = $1`, [id]);
        const { rows: [oferta] } = await gobDb.query(`DELETE FROM academico.oferta_asignaturas WHERE id_oferta = $1 RETURNING *`, [id]);
        if (!oferta) return res.status(404).json({ ok: false, msg: "Oferta no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'oferta', id, oferta, req.ip);
        return res.json({ ok: true, msg: "Oferta eliminada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// MATRÍCULAS (gobDb - academico.matriculas)
// ============================================================
export const getMatriculas = async (req, res) => {
    try {
        const { id_clase, buscar, page = 1, limit = 30 } = req.query;
        const offset = (page - 1) * limit;
        const params = []; const conds = [];
        if (id_clase) { params.push(id_clase); conds.push(`m.id_clase = $${params.length}`); }
        if (buscar) { params.push(`%${buscar}%`); conds.push(`(pe.nombre ILIKE $${params.length} OR pe.dni ILIKE $${params.length})`); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const { rows: [{ total }] } = await gobDb.query(`SELECT count(*) as total FROM academico.matriculas m JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = m.id_alumno_externo JOIN externo.personas pe ON pe.id_persona = ug.id_persona ${where}`, params);
        params.push(limit, offset);
        const { rows } = await gobDb.query(`
            SELECT m.id_matricula, m.id_clase, m.fecha_matricula, m.created_at,
                pe.nombre, pe.apellidos, pe.dni, ug.id_usuario_externo,
                c.nombre as nombre_clase, c.curso, c.grupo
            FROM academico.matriculas m
            JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = m.id_alumno_externo
            JOIN externo.personas pe ON pe.id_persona = ug.id_persona
            JOIN academico.clases c ON c.id_clase = m.id_clase
            ${where} ORDER BY m.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({ ok: true, matriculas: rows, paginacion: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener matrículas" });
    }
};

export const crearMatricula = async (req, res) => {
    try {
        const { id_alumno_externo, id_clase } = req.body;
        if (!id_alumno_externo || !id_clase) return res.status(400).json({ ok: false, msg: "id_alumno_externo e id_clase obligatorios" });
        const { rows: dup } = await gobDb.query(`SELECT id_matricula FROM academico.matriculas WHERE id_alumno_externo = $1 AND id_clase = $2`, [id_alumno_externo, id_clase]);
        if (dup.length > 0) return res.status(409).json({ ok: false, msg: "El alumno ya está matriculado en esa clase" });
        const { rows: [mat] } = await gobDb.query(`INSERT INTO academico.matriculas (id_alumno_externo, id_clase) VALUES ($1, $2) RETURNING *`, [id_alumno_externo, id_clase]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'matricula', mat.id_matricula, { id_alumno_externo, id_clase }, req.ip);
        return res.json({ ok: true, msg: "Matrícula creada", matricula: mat });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const eliminarMatricula = async (req, res) => {
    try {
        const { id } = req.params;
        await gobDb.query(`DELETE FROM academico.matriculas_asignaturas WHERE id_matricula = $1`, [id]);
        const { rows: [mat] } = await gobDb.query(`DELETE FROM academico.matriculas WHERE id_matricula = $1 RETURNING *`, [id]);
        if (!mat) return res.status(404).json({ ok: false, msg: "Matrícula no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'matricula', id, mat, req.ip);
        return res.json({ ok: true, msg: "Matrícula eliminada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// ASIGNACIONES PROFESOR (gobDb - academico.asignaciones_profesor)
// ============================================================
export const getAsignaciones = async (req, res) => {
    try {
        const { id_clase } = req.query;
        let where = ''; const params = [];
        if (id_clase) { params.push(id_clase); where = `WHERE ap.id_clase = $1`; }
        const { rows } = await gobDb.query(`
            SELECT ap.*, pe.nombre as nombre_profesor, pe.apellidos as apellidos_profesor,
                a.nombre as nombre_asignatura, a.codigo as codigo_asignatura,
                c.nombre as nombre_clase, c.curso, c.grupo
            FROM academico.asignaciones_profesor ap
            JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = ap.id_profesor_externo
            JOIN externo.personas pe ON pe.id_persona = ug.id_persona
            JOIN academico.oferta_asignaturas oa ON oa.id_oferta = ap.id_oferta
            JOIN academico.asignaturas a ON a.id_asignatura = oa.id_asignatura
            JOIN academico.clases c ON c.id_clase = ap.id_clase
            ${where} ORDER BY c.nombre, a.nombre`, params);
        return res.json({ ok: true, asignaciones: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener asignaciones" });
    }
};

export const crearAsignacion = async (req, res) => {
    try {
        const { id_profesor_externo, id_clase, id_oferta } = req.body;
        if (!id_profesor_externo || !id_clase || !id_oferta) return res.status(400).json({ ok: false, msg: "id_profesor_externo, id_clase e id_oferta obligatorios" });
        const { rows: [asig] } = await gobDb.query(
            `INSERT INTO academico.asignaciones_profesor (id_profesor_externo, id_clase, id_oferta) VALUES ($1, $2, $3) RETURNING *`,
            [id_profesor_externo, id_clase, id_oferta]);
        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'asignacion_profesor', asig.id_asignacion, req.body, req.ip);
        return res.json({ ok: true, msg: "Asignación creada", asignacion: asig });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const eliminarAsignacion = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: [asig] } = await gobDb.query(`DELETE FROM academico.asignaciones_profesor WHERE id_asignacion = $1 RETURNING *`, [id]);
        if (!asig) return res.status(404).json({ ok: false, msg: "Asignación no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ELIMINAR', 'asignacion_profesor', id, asig, req.ip);
        return res.json({ ok: true, msg: "Asignación eliminada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// PERSONAS Y USUARIOS GOB (gobDb - externo.personas + externo.usuarios_gobierno + credenciales)
// ============================================================
export const getPersonas = async (req, res) => {
    try {
        const { buscar, page = 1, limit = 30 } = req.query;
        const offset = (page - 1) * limit;
        const params = []; let where = '';
        if (buscar) { params.push(`%${buscar}%`); where = `WHERE pe.nombre ILIKE $1 OR pe.apellidos ILIKE $1 OR pe.dni ILIKE $1 OR pe.cial ILIKE $1`; }
        const { rows: [{ total }] } = await gobDb.query(`SELECT count(*) as total FROM externo.personas pe ${where}`, params);
        params.push(limit, offset);
        const { rows } = await gobDb.query(`
            SELECT pe.*, ug.id_usuario_externo, ug.tipo, ug.id_centro, ug.activo as usuario_activo, ce.codigo_centro, ce.nombre as nombre_centro
            FROM externo.personas pe
            LEFT JOIN externo.usuarios_gobierno ug ON ug.id_persona = pe.id_persona
            LEFT JOIN externo.centros ce ON ce.id_centro = ug.id_centro
            ${where} ORDER BY pe.nombre LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({ ok: true, personas: rows, paginacion: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener personas" });
    }
};

export const crearPersonaCompleta = async (req, res) => {
    try {
        const { dni, cial, nombre, apellidos, email, telefono, tipo, id_centro, password } = req.body;
        if (!dni || !cial || !nombre || !apellidos || !tipo || !id_centro || !password) {
            return res.status(400).json({ ok: false, msg: "Campos obligatorios: dni, cial, nombre, apellidos, tipo, id_centro, password" });
        }
        // 1. Crear persona
        const { rows: [persona] } = await gobDb.query(
            `INSERT INTO externo.personas (dni, cial, nombre, apellidos, email, telefono) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [dni.trim().toUpperCase(), cial.trim(), nombre.trim(), apellidos.trim(), email?.trim() || null, telefono?.trim() || null]);
        // 2. Crear usuario_gobierno
        const { rows: [usuario] } = await gobDb.query(
            `INSERT INTO externo.usuarios_gobierno (id_persona, id_centro, tipo) VALUES ($1, $2, $3) RETURNING *`,
            [persona.id_persona, id_centro, tipo.trim().toUpperCase()]);
        // 3. Crear credenciales
        const salt = crypto.randomBytes(16).toString('hex');
        const hashPw = sha256(salt + password);
        await gobDb.query(
            `INSERT INTO externo.credenciales_acceso (id_usuario_externo, salt, password_sha256_hex) VALUES ($1, $2, $3)`,
            [usuario.id_usuario_externo, salt, hashPw]);

        await logAdminAction(req.currentUser.id_usuario_app, 'CREAR', 'persona_completa', persona.id_persona, { dni, nombre, tipo }, req.ip);
        return res.json({ ok: true, msg: "Persona, usuario y credenciales creados", persona, usuario });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ ok: false, msg: "Ya existe una persona con ese DNI o CIAL" });
        return res.status(500).json({ ok: false, msg: "Error al crear persona" });
    }
};

export const actualizarPersona = async (req, res) => {
    try {
        const { id } = req.params; // id_persona
        const { nombre, apellidos, dni, cial, email, telefono, activo } = req.body;
        const { rows: [persona] } = await gobDb.query(
            `UPDATE externo.personas SET nombre = COALESCE($1, nombre), apellidos = COALESCE($2, apellidos), dni = COALESCE($3, dni), cial = COALESCE($4, cial), email = COALESCE($5, email), telefono = COALESCE($6, telefono), activo = COALESCE($7, activo), updated_at = NOW() WHERE id_persona = $8 RETURNING *`,
            [nombre?.trim(), apellidos?.trim(), dni?.trim().toUpperCase(), cial?.trim(), email?.trim(), telefono?.trim(), activo, id]);
        if (!persona) return res.status(404).json({ ok: false, msg: "Persona no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR', 'persona', id, req.body, req.ip);
        return res.json({ ok: true, msg: "Persona actualizada", persona });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { id_usuario_externo, nueva_password } = req.body;
        if (!id_usuario_externo || !nueva_password) return res.status(400).json({ ok: false, msg: "id_usuario_externo y nueva_password obligatorios" });
        const salt = crypto.randomBytes(16).toString('hex');
        const hashPw = sha256(salt + nueva_password);
        await gobDb.query(`UPDATE externo.credenciales_acceso SET salt = $1, password_sha256_hex = $2, updated_at = NOW() WHERE id_usuario_externo = $3`, [salt, hashPw, id_usuario_externo]);
        await logAdminAction(req.currentUser.id_usuario_app, 'RESET_PASSWORD', 'credencial', id_usuario_externo, {}, req.ip);
        return res.json({ ok: true, msg: "Contraseña actualizada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// USUARIOS APP (appDb - seguridad.usuarios_app)
// ============================================================
export const getUsuariosApp = async (req, res) => {
    try {
        const { tipo, activo, centro, buscar, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const params = []; const conds = [];
        if (tipo) { params.push(tipo); conds.push(`tipo_externo = $${params.length}`); }
        if (activo !== undefined && activo !== '') { params.push(activo === 'true'); conds.push(`activo = $${params.length}`); }
        if (centro) { params.push(centro); conds.push(`codigo_centro = $${params.length}`); }
        if (buscar) { params.push(`%${buscar}%`); conds.push(`(nombre ILIKE $${params.length} OR apellidos ILIKE $${params.length} OR dni ILIKE $${params.length} OR cial ILIKE $${params.length})`); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const { rows: [{ total }] } = await appDb.query(`SELECT count(*) as total FROM seguridad.v_admin_usuarios ${where}`, params);
        params.push(limit, offset);
        const { rows } = await appDb.query(`SELECT * FROM seguridad.v_admin_usuarios ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return res.json({ ok: true, usuarios: rows, paginacion: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener usuarios" });
    }
};

export const toggleUsuarioAppActivo = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        const adminId = req.currentUser.id_usuario_app;
        if (id === adminId) return res.status(400).json({ ok: false, msg: "No puedes desactivarte a ti mismo" });
        const { rows: [usuario] } = await appDb.query(`UPDATE seguridad.usuarios_app SET activo = $1, updated_at = NOW() WHERE id_usuario_app = $2 RETURNING nombre, activo`, [activo, id]);
        if (!usuario) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        await logAdminAction(adminId, activo ? 'ACTIVAR' : 'DESACTIVAR', 'usuario_app', id, { nombre: usuario.nombre }, req.ip);
        return res.json({ ok: true, msg: `Usuario ${activo ? 'activado' : 'desactivado'}`, usuario });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const cambiarRolUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_rol } = req.body;
        const adminId = req.currentUser.id_usuario_app;
        if (id === adminId) return res.status(400).json({ ok: false, msg: "No puedes cambiar tu propio rol" });
        const { rows: [usuario] } = await appDb.query(`UPDATE seguridad.usuarios_app SET id_rol = $1, updated_at = NOW() WHERE id_usuario_app = $2 RETURNING nombre, id_rol`, [id_rol, id]);
        if (!usuario) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        await logAdminAction(adminId, 'CAMBIAR_ROL', 'usuario_app', id, { id_rol }, req.ip);
        return res.json({ ok: true, msg: "Rol actualizado", usuario });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// SALAS DE CHAT (appDb)
// ============================================================
export const getSalas = async (req, res) => {
    try {
        const { rows } = await appDb.query(`
            SELECT sc.id_sala, sc.configuracion, sc.created_at, c.nombre as nombre_clase, c.curso, c.grupo,
                a.nombre as nombre_asignatura, a.codigo as codigo_asignatura
            FROM comunicacion.salas_chat sc
            JOIN cache_academico.clases c ON c.id_clase = sc.id_clase
            JOIN cache_academico.oferta_asignaturas oa ON oa.id_oferta = sc.id_oferta
            JOIN cache_academico.asignaturas a ON a.id_asignatura = oa.id_asignatura
            ORDER BY c.nombre, a.nombre`);
        return res.json({ ok: true, salas: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const updateSalaConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { configuracion } = req.body;
        const { rows: [sala] } = await appDb.query(`UPDATE comunicacion.salas_chat SET configuracion = $1 WHERE id_sala = $2 RETURNING id_sala`, [JSON.stringify(configuracion), id]);
        if (!sala) return res.status(404).json({ ok: false, msg: "Sala no encontrada" });
        await logAdminAction(req.currentUser.id_usuario_app, 'ACTUALIZAR_CONFIG', 'sala', id, configuracion, req.ip);
        return res.json({ ok: true, msg: "Configuración actualizada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// ROLES + AUDIT LOG
// ============================================================
export const getRoles = async (req, res) => {
    try {
        const { rows } = await appDb.query(`SELECT r.id_rol, r.nombre, (SELECT count(*) FROM seguridad.usuarios_app u WHERE u.id_rol = r.id_rol) as total_usuarios FROM seguridad.roles r ORDER BY r.id_rol`);
        return res.json({ ok: true, roles: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// ============================================================
// WIZARD — ASISTENTE DE CREACIÓN DE CLASE COMPLETA
// ============================================================

// Paso 1 helper: obtener ofertas de un plan (asignaturas disponibles por curso)
export const getOfertasPorPlan = async (req, res) => {
    try {
        const { id_plan } = req.params;
        const { rows } = await gobDb.query(`
            SELECT oa.id_oferta, oa.curso, oa.obligatoria, a.id_asignatura, a.nombre, a.codigo, a.horas
            FROM academico.oferta_asignaturas oa
            JOIN academico.asignaturas a ON a.id_asignatura = oa.id_asignatura
            WHERE oa.id_plan = $1
            ORDER BY oa.curso, a.nombre`, [id_plan]);
        return res.json({ ok: true, ofertas: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al obtener ofertas del plan" });
    }
};

// Helper: profesores disponibles (con su info)
export const getProfesoresDisponibles = async (req, res) => {
    try {
        const { id_centro } = req.query;
        let where = `WHERE ug.tipo = 'PROFESOR' AND ug.activo = true`;
        const params = [];
        if (id_centro) { params.push(id_centro); where += ` AND ug.id_centro = $${params.length}`; }
        const { rows } = await gobDb.query(`
            SELECT ug.id_usuario_externo, pe.nombre, pe.apellidos, pe.dni, ce.nombre as nombre_centro
            FROM externo.usuarios_gobierno ug
            JOIN externo.personas pe ON pe.id_persona = ug.id_persona
            LEFT JOIN externo.centros ce ON ce.id_centro = ug.id_centro
            ${where} ORDER BY pe.nombre`, params);
        return res.json({ ok: true, profesores: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// Helper: alumnos disponibles
export const getAlumnosDisponibles = async (req, res) => {
    try {
        const { id_centro } = req.query;
        let where = `WHERE ug.tipo = 'ALUMNO' AND ug.activo = true`;
        const params = [];
        if (id_centro) { params.push(id_centro); where += ` AND ug.id_centro = $${params.length}`; }
        const { rows } = await gobDb.query(`
            SELECT ug.id_usuario_externo, pe.nombre, pe.apellidos, pe.dni, ce.nombre as nombre_centro
            FROM externo.usuarios_gobierno ug
            JOIN externo.personas pe ON pe.id_persona = ug.id_persona
            LEFT JOIN externo.centros ce ON ce.id_centro = ug.id_centro
            ${where} ORDER BY pe.nombre`, params);
        return res.json({ ok: true, alumnos: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// CREAR CLASE COMPLETA (transaccional)
// Body: { clase: {...}, ofertas_seleccionadas: [id_oferta,...], asignaciones: [{id_oferta, id_profesor_externo},...], matriculas: [{id_alumno_externo, ofertas_alumno: [id_oferta,...]},...] }
export const crearClaseCompleta = async (req, res) => {
    const client = await gobDb.connect();
    try {
        const { clase, ofertas_seleccionadas, asignaciones, matriculas } = req.body;
        const adminId = req.currentUser.id_usuario_app;

        if (!clase || !clase.nombre || !clase.id_plan || !clase.id_centro || !clase.id_curso_escolar || !clase.curso || !clase.grupo) {
            return res.status(400).json({ ok: false, msg: "Datos de la clase incompletos" });
        }

        await client.query('BEGIN');

        // 1. Crear la clase
        const { rows: [nuevaClase] } = await client.query(
            `INSERT INTO academico.clases (nombre, id_plan, id_centro, id_curso_escolar, curso, grupo)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [clase.nombre.trim(), clase.id_plan, clase.id_centro, clase.id_curso_escolar, parseInt(clase.curso), clase.grupo.trim().toUpperCase()]
        );

        const id_clase = nuevaClase.id_clase;
        let totalAsignaciones = 0;
        let totalMatriculas = 0;
        let totalMatriculasAsig = 0;

        // 2. Crear asignaciones de profesor
        if (asignaciones && asignaciones.length > 0) {
            for (const asig of asignaciones) {
                if (asig.id_profesor_externo && asig.id_oferta) {
                    await client.query(
                        `INSERT INTO academico.asignaciones_profesor (id_profesor_externo, id_clase, id_oferta) VALUES ($1, $2, $3)`,
                        [asig.id_profesor_externo, id_clase, asig.id_oferta]
                    );
                    totalAsignaciones++;
                }
            }
        }

        // 3. Crear matrículas con sus asignaturas individuales
        if (matriculas && matriculas.length > 0) {
            for (const mat of matriculas) {
                if (mat.id_alumno_externo) {
                    const { rows: [nuevaMat] } = await client.query(
                        `INSERT INTO academico.matriculas (id_alumno_externo, id_clase) VALUES ($1, $2) RETURNING id_matricula`,
                        [mat.id_alumno_externo, id_clase]
                    );
                    totalMatriculas++;

                    // Inscribir en asignaturas seleccionadas para este alumno
                    const ofertasAlumno = mat.ofertas_alumno || ofertas_seleccionadas || [];
                    for (const id_oferta of ofertasAlumno) {
                        await client.query(
                            `INSERT INTO academico.matriculas_asignaturas (id_matricula, id_oferta) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                            [nuevaMat.id_matricula, id_oferta]
                        );
                        totalMatriculasAsig++;
                    }
                }
            }
        }

        await client.query('COMMIT');

        await logAdminAction(adminId, 'WIZARD_CREAR_CLASE', 'clase', id_clase, {
            nombre: clase.nombre, asignaciones: totalAsignaciones, matriculas: totalMatriculas, asignaturas_alumno: totalMatriculasAsig
        }, req.ip);

        return res.json({
            ok: true,
            msg: `Clase creada: ${totalAsignaciones} asignaciones, ${totalMatriculas} matrículas, ${totalMatriculasAsig} inscripciones`,
            clase: nuevaClase, resumen: { totalAsignaciones, totalMatriculas, totalMatriculasAsig }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[Wizard Crear Clase Error]:", error);
        return res.status(500).json({ ok: false, msg: error.message || "Error al crear clase completa" });
    } finally {
        client.release();
    }
};

// DETALLE de clase para edición individual de matrículas
export const getClaseDetalladoWizard = async (req, res) => {
    try {
        const { id } = req.params;
        // Clase
        const { rows: [clase] } = await gobDb.query(`
            SELECT c.*, p.nombre as nombre_plan, ce.nombre as nombre_centro, ce.id_centro
            FROM academico.clases c
            LEFT JOIN academico.planes_estudio p ON p.id_plan = c.id_plan
            LEFT JOIN externo.centros ce ON ce.id_centro = c.id_centro
            WHERE c.id_clase = $1`, [id]);
        if (!clase) return res.status(404).json({ ok: false, msg: "Clase no encontrada" });

        // Ofertas del plan (asignaturas posibles)
        const { rows: ofertas } = await gobDb.query(`
            SELECT oa.id_oferta, oa.curso, oa.obligatoria, a.id_asignatura, a.nombre, a.codigo
            FROM academico.oferta_asignaturas oa
            JOIN academico.asignaturas a ON a.id_asignatura = oa.id_asignatura
            WHERE oa.id_plan = $1 ORDER BY oa.curso, a.nombre`, [clase.id_plan]);

        // Asignaciones profesor
        const { rows: asignaciones } = await gobDb.query(`
            SELECT ap.id_asignacion, ap.id_oferta, ap.id_profesor_externo, pe.nombre, pe.apellidos
            FROM academico.asignaciones_profesor ap
            JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = ap.id_profesor_externo
            JOIN externo.personas pe ON pe.id_persona = ug.id_persona
            WHERE ap.id_clase = $1`, [id]);

        // Matrículas con sus asignaturas individuales
        const { rows: matriculas } = await gobDb.query(`
            SELECT m.id_matricula, m.id_alumno_externo, pe.nombre, pe.apellidos, pe.dni,
                array_agg(json_build_object('id_oferta', ma.id_oferta, 'estado', ma.estado)) FILTER (WHERE ma.id_oferta IS NOT NULL) as asignaturas_matricula
            FROM academico.matriculas m
            JOIN externo.usuarios_gobierno ug ON ug.id_usuario_externo = m.id_alumno_externo
            JOIN externo.personas pe ON pe.id_persona = ug.id_persona
            LEFT JOIN academico.matriculas_asignaturas ma ON ma.id_matricula = m.id_matricula
            WHERE m.id_clase = $1
            GROUP BY m.id_matricula, m.id_alumno_externo, pe.nombre, pe.apellidos, pe.dni
            ORDER BY pe.nombre`, [id]);

        return res.json({ ok: true, clase, ofertas, asignaciones, matriculas });
    } catch (error) {
        console.error("[Wizard Detalle Error]:", error);
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

// Actualizar asignaturas individuales de una matrícula (convalidaciones, quitar, añadir)
export const updateMatriculaAsignaturas = async (req, res) => {
    try {
        const { id } = req.params; // id_matricula
        const { ofertas } = req.body; // [{id_oferta, estado: 'CURSANDO'|'CONVALIDADA'|'EXENTA'}]  o null para eliminar
        const adminId = req.currentUser.id_usuario_app;

        if (!Array.isArray(ofertas)) return res.status(400).json({ ok: false, msg: "ofertas debe ser un array" });

        // Borrar todas las asignaturas actuales
        await gobDb.query(`DELETE FROM academico.matriculas_asignaturas WHERE id_matricula = $1`, [id]);

        // Insertar las nuevas
        let count = 0;
        for (const o of ofertas) {
            if (o.id_oferta) {
                await gobDb.query(
                    `INSERT INTO academico.matriculas_asignaturas (id_matricula, id_oferta, estado) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [id, o.id_oferta, o.estado || 'CURSANDO']
                );
                count++;
            }
        }

        await logAdminAction(adminId, 'ACTUALIZAR_MATRICULA_ASIGNATURAS', 'matricula', id, { total: count, ofertas }, req.ip);
        return res.json({ ok: true, msg: `${count} asignaturas actualizadas` });
    } catch (error) {
        console.error("[Update Matricula Asig Error]:", error);
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};

export const actualizarClaseCompleta = async (req, res) => {
    const client = await gobDb.connect();
    try {
        const { id } = req.params;
        const { clase, ofertas_seleccionadas, asignaciones, matriculas } = req.body;
        const adminId = req.currentUser.id_usuario_app;

        if (!clase || !clase.nombre || !clase.id_plan || !clase.id_centro || !clase.id_curso_escolar || !clase.curso || !clase.grupo) {
            return res.status(400).json({ ok: false, msg: "Datos de la clase incompletos" });
        }

        await client.query('BEGIN');

        const ofertasSeleccionadas = Array.isArray(ofertas_seleccionadas) ? ofertas_seleccionadas : [];
        const asignacionesValidas = Array.isArray(asignaciones)
            ? asignaciones.filter(a => a?.id_oferta && ofertasSeleccionadas.includes(a.id_oferta) && a.id_profesor_externo)
            : [];
        const matriculasRecibidas = Array.isArray(matriculas) ? matriculas.filter(m => m?.id_alumno_externo) : [];

        const { rows: [claseActualizada] } = await client.query(
            `UPDATE academico.clases
             SET nombre = $1, id_plan = $2, id_centro = $3, id_curso_escolar = $4, curso = $5, grupo = $6, updated_at = NOW()
             WHERE id_clase = $7
             RETURNING *`,
            [clase.nombre.trim(), clase.id_plan, clase.id_centro, clase.id_curso_escolar, parseInt(clase.curso), clase.grupo.trim().toUpperCase(), id]
        );
        if (!claseActualizada) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, msg: "Clase no encontrada" });
        }

        await client.query(`DELETE FROM academico.asignaciones_profesor WHERE id_clase = $1`, [id]);
        let totalAsignaciones = 0;
        for (const asig of asignacionesValidas) {
            await client.query(
                `INSERT INTO academico.asignaciones_profesor (id_profesor_externo, id_clase, id_oferta) VALUES ($1, $2, $3)`,
                [asig.id_profesor_externo, id, asig.id_oferta]
            );
            totalAsignaciones++;
        }

        const { rows: matriculasExistentes } = await client.query(
            `SELECT id_matricula, id_alumno_externo FROM academico.matriculas WHERE id_clase = $1`,
            [id]
        );
        const existentesPorAlumno = new Map(matriculasExistentes.map(m => [m.id_alumno_externo, m.id_matricula]));
        const alumnosRecibidos = new Set(matriculasRecibidas.map(m => m.id_alumno_externo));

        for (const matExistente of matriculasExistentes) {
            if (!alumnosRecibidos.has(matExistente.id_alumno_externo)) {
                await client.query(`DELETE FROM academico.matriculas_asignaturas WHERE id_matricula = $1`, [matExistente.id_matricula]);
                await client.query(`DELETE FROM academico.matriculas WHERE id_matricula = $1`, [matExistente.id_matricula]);
            }
        }

        let totalMatriculas = 0;
        let totalMatriculasAsig = 0;
        for (const mat of matriculasRecibidas) {
            let idMatricula = existentesPorAlumno.get(mat.id_alumno_externo);
            if (!idMatricula) {
                const { rows: [nuevaMat] } = await client.query(
                    `INSERT INTO academico.matriculas (id_alumno_externo, id_clase) VALUES ($1, $2) RETURNING id_matricula`,
                    [mat.id_alumno_externo, id]
                );
                idMatricula = nuevaMat.id_matricula;
                totalMatriculas++;
            }

            const ofertasAlumno = Array.isArray(mat.ofertas_alumno)
                ? mat.ofertas_alumno.filter(idOferta => ofertasSeleccionadas.includes(idOferta))
                : ofertasSeleccionadas;

            await client.query(`DELETE FROM academico.matriculas_asignaturas WHERE id_matricula = $1`, [idMatricula]);
            for (const id_oferta of ofertasAlumno) {
                await client.query(
                    `INSERT INTO academico.matriculas_asignaturas (id_matricula, id_oferta) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [idMatricula, id_oferta]
                );
                totalMatriculasAsig++;
            }
        }

        await client.query('COMMIT');

        await logAdminAction(adminId, 'WIZARD_ACTUALIZAR_CLASE', 'clase', id, {
            nombre: claseActualizada.nombre,
            totalAsignaciones,
            nuevasMatriculas: totalMatriculas,
            asignaturas_alumno: totalMatriculasAsig
        }, req.ip);

        return res.json({
            ok: true,
            msg: `Clase actualizada: ${totalAsignaciones} asignaciones y ${totalMatriculasAsig} inscripciones revisadas`,
            clase: claseActualizada,
            resumen: { totalAsignaciones, totalMatriculas, totalMatriculasAsig }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[Wizard Actualizar Clase Error]:", error);
        return res.status(500).json({ ok: false, msg: error.message || "Error al actualizar clase completa" });
    } finally {
        client.release();
    }
};

export const getAuditLog = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const { rows: [{ total }] } = await appDb.query(`SELECT count(*) as total FROM seguridad.admin_audit_log`);
        const { rows } = await appDb.query(`SELECT al.*, u.nombre as admin_nombre FROM seguridad.admin_audit_log al JOIN seguridad.usuarios_app u ON u.id_usuario_app = al.id_admin ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return res.json({ ok: true, logs: rows, paginacion: { total: parseInt(total), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error" });
    }
};
