import express from "express";
import { appDb } from "../db/db.js";

const router = express.Router();

// GET /chat/settings/:roomId — Obtener ajustes de la sala (delegados, soloProfesores)
router.get("/settings/:roomId", async (req, res) => {
    try {
        const { roomId } = req.params;

        const { rows } = await appDb.query(
            `SELECT configuracion FROM comunicacion.salas_chat WHERE id_sala = $1`,
            [roomId]
        );

        if (rows.length === 0) {
            return res.json({
                ok: true,
                settings: { soloProfesores: false, delegados: [] }
            });
        }

        const config = rows[0].configuracion || {};

        res.json({
            ok: true,
            settings: {
                soloProfesores: config.soloProfesores || false,
                delegados: config.delegados || []
            }
        });
    } catch (err) {
        console.error("❌ Error en /chat/settings:", err);
        res.json({ ok: false, error: err.message });
    }
});

export default router;
