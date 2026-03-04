import express from "express";
import { login, checkStatus, registrarPushToken, cambiarPassword } from "../auth/auth.controller.js";
// --- AÑADE ESTA LÍNEA (Ajusta la ruta si es necesario) ---
import { requireAuth } from "../auth/auth.middleware.js";
import { appDb } from "../db/db.js";

const router = express.Router();

router.post("/login", login);
router.get("/status", requireAuth, checkStatus);
router.post("/registrar-token", requireAuth, registrarPushToken);
router.post("/cambiar-password", requireAuth, cambiarPassword);

// GET /auth/notif-preference - Obtener preferencia de notificaciones
router.get('/notif-preference', requireAuth, async (req, res) => {
    try {
        const { rows } = await appDb.query(
            `SELECT notificaciones_activas FROM seguridad.usuarios_app WHERE id_usuario_app = $1`,
            [req.currentUser.id_usuario_app]
        );
        res.json({
            ok: true,
            notificaciones_activas: rows[0]?.notificaciones_activas ?? true
        });
    } catch (error) {
        console.error("Error obteniendo preferencia:", error);
        res.status(500).json({ ok: false });
    }
});

// PUT /auth/notif-preference - Actualizar preferencia de notificaciones
router.put('/notif-preference', requireAuth, async (req, res) => {
    try {
        const { notificaciones_activas } = req.body;
        await appDb.query(
            `UPDATE seguridad.usuarios_app SET notificaciones_activas = $1 WHERE id_usuario_app = $2`,
            [notificaciones_activas, req.currentUser.id_usuario_app]
        );
        res.json({ ok: true });
    } catch (error) {
        console.error("Error actualizando preferencia:", error);
        res.status(500).json({ ok: false });
    }
});

export default router;