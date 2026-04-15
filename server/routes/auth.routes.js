import express from "express";
import { login, checkStatus, registrarPushToken, cambiarPassword } from "../auth/auth.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { appDb } from "../db/db.js";

const router = express.Router();

let privacyPrefReady = false;
const ensurePrivacyPreferenceColumn = async () => {
    if (privacyPrefReady) return;
    try {
        await appDb.query(
            `ALTER TABLE seguridad.usuarios_app
             ADD COLUMN sonidos_activos BOOLEAN NOT NULL DEFAULT TRUE`
        );
    } catch (error) {
        // Ingnorar si ya existe
    }
    try {
        await appDb.query(
            `ALTER TABLE seguridad.usuarios_app
             ADD COLUMN confirmaciones_lectura_activas BOOLEAN NOT NULL DEFAULT TRUE`
        );
    } catch (error) {
        // Ingnorar si ya existe
    }
    privacyPrefReady = true;
};

router.post("/login", login);
router.get("/status", requireAuth, checkStatus);
router.post("/registrar-token", requireAuth, registrarPushToken);
router.post("/cambiar-password", requireAuth, cambiarPassword);

// Obtener preferencia de notificaciones
router.get('/notif-preference', requireAuth, async (req, res) => {
    try {
        await ensurePrivacyPreferenceColumn();
        const { rows } = await appDb.query(
            `SELECT notificaciones_activas, sonidos_activos
             FROM seguridad.usuarios_app
             WHERE id_usuario_app = $1`,
            [req.currentUser.id_usuario_app]
        );
        res.json({
            ok: true,
            notificaciones_activas: rows[0]?.notificaciones_activas ?? true,
            sonidos_activos: rows[0]?.sonidos_activos ?? true,
        });
    } catch (error) {
        console.error("Error obteniendo preferencia:", error);
        res.status(500).json({ ok: false });
    }
});

// Actualizar preferencia de notificaciones
router.put('/notif-preference', requireAuth, async (req, res) => {
    try {
        await ensurePrivacyPreferenceColumn();
        const { notificaciones_activas, sonidos_activos } = req.body;
        await appDb.query(
            `UPDATE seguridad.usuarios_app
             SET notificaciones_activas = COALESCE($1, notificaciones_activas),
                 sonidos_activos = COALESCE($2, sonidos_activos)
             WHERE id_usuario_app = $3`,
            [
                typeof notificaciones_activas === 'boolean' ? notificaciones_activas : null,
                typeof sonidos_activos === 'boolean' ? sonidos_activos : null,
                req.currentUser.id_usuario_app
            ]
        );
        res.json({ ok: true });
    } catch (error) {
        console.error("Error actualizando preferencia:", error);
        res.status(500).json({ ok: false });
    }
});

// Obtener preferencia de confirmaciones de lectura
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

// Actualizar preferencia de confirmaciones de lectura
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
