import { appDb } from "../db/db.js";

/**
 * Middleware que verifica que el usuario autenticado tiene rol ADMIN (id_rol = 7)
 * DEBE usarse DESPUÉS de requireAuth
 */
export const requireAdmin = async (req, res, next) => {
    try {
        const { id_usuario_app, id_rol } = req.currentUser;

        // Verificación rápida por el payload del middleware anterior
        if (id_rol !== 7) {
            console.log(`[Admin] Acceso denegado para usuario ${id_usuario_app} (rol: ${id_rol})`);
            return res.status(403).json({
                ok: false,
                error: "FORBIDDEN",
                msg: "No tienes permisos de administrador"
            });
        }

        // Doble verificación contra la BD (por seguridad)
        const { rows } = await appDb.query(
            `SELECT id_rol, activo FROM seguridad.usuarios_app WHERE id_usuario_app = $1`,
            [id_usuario_app]
        );

        if (rows.length === 0 || rows[0].id_rol !== 7 || !rows[0].activo) {
            return res.status(403).json({
                ok: false,
                error: "FORBIDDEN",
                msg: "No tienes permisos de administrador"
            });
        }

        next();
    } catch (error) {
        console.error("[Admin Middleware Error]:", error);
        return res.status(500).json({
            ok: false,
            error: "INTERNAL_ERROR",
            msg: "Error al verificar permisos de administrador"
        });
    }
};

/**
 * Helper: Registra una acción en el log de auditoría
 */
export const logAdminAction = async (id_admin, accion, entidad, id_entidad, detalle = {}, ip = null) => {
    try {
        await appDb.query(
            `INSERT INTO seguridad.admin_audit_log (id_admin, accion, entidad, id_entidad, detalle, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_admin, accion, entidad, id_entidad, JSON.stringify(detalle), ip]
        );
    } catch (err) {
        console.error("[Audit Log Error]:", err.message);
    }
};