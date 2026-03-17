import express from "express";
import { login, checkStatus, registrarPushToken, cambiarPassword } from "../auth/auth.controller.js";
// --- AÑADE ESTA LÍNEA (Ajusta la ruta si es necesario) ---
import { requireAuth } from "../auth/auth.middleware.js";
import { appDb } from "../db/db.js";

const router = express.Router();

let privacyPrefReady = false;
const ensurePrivacyPreferenceColumn = async () => {
    if (privacyPrefReady) return;
    try {
        await appDb.query(
            `ALTER TABLE seguridad.usuarios_app
             ADD COLUMN confirmaciones_lectura_activas BOOLEAN NOT NULL DEFAULT TRUE`
        );
    } catch (error) {
        // ignore if it already exists
    }
    privacyPrefReady = true;
};

router.post("/login", login);
router.get("/status", requireAuth, checkStatus);
router.post("/registrar-token", requireAuth, registrarPushToken);
router.post("/cambiar-password", requireAuth, cambiarPassword);

// GET /auth/notif-preference - Obtener preferencia de notificaciones
router.get('/notif-preference', requireAuth, async (req, res) => {
    try {
        await ensurePrivacyPreferenceColumn();
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
        await ensurePrivacyPreferenceColumn();
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

router.get('/read-receipts-preference', requireAuth, async (req, res) => {
    try {
        await ensurePrivacyPreferenceColumn();
        const { rows } = await appDb.query(
            `SELECT confirmaciones_lectura_activas
             FROM seguridad.usuarios_app
             WHERE id_usuario_app = $1`,
            [req.currentUser.id_usuario_app]
        );
        res.json({
            ok: true,
            confirmaciones_lectura_activas: rows[0]?.confirmaciones_lectura_activas ?? true
        });
    } catch (error) {
        console.error("Error obteniendo confirmaciones de lectura:", error);
        res.status(500).json({ ok: false });
    }
});

router.put('/read-receipts-preference', requireAuth, async (req, res) => {
    try {
        await ensurePrivacyPreferenceColumn();
        const { confirmaciones_lectura_activas } = req.body;
        await appDb.query(
            `UPDATE seguridad.usuarios_app
             SET confirmaciones_lectura_activas = $1
             WHERE id_usuario_app = $2`,
            [confirmaciones_lectura_activas, req.currentUser.id_usuario_app]
        );
        res.json({ ok: true });
    } catch (error) {
        console.error("Error actualizando confirmaciones de lectura:", error);
        res.status(500).json({ ok: false });
    }
});

export default router;
