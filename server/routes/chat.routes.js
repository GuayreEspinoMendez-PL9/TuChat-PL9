import express from "express";
import { appDb } from "../db/db.js";

const router = express.Router();
const EMOJI_SOURCE_URL = "https://www.emoji.family/api/emojis/";
const EMOJI_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let emojiCache = { data: null, fetchedAt: 0 };

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

// GET /chat/emojis - Proxy para evitar CORS en web + cache simple en memoria
router.get("/emojis", async (_req, res) => {
    const now = Date.now();
    const hasFreshCache = emojiCache.data && (now - emojiCache.fetchedAt) < EMOJI_CACHE_TTL_MS;

    if (hasFreshCache) {
        return res.json({ ok: true, source: "cache", emojis: emojiCache.data });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(EMOJI_SOURCE_URL, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Emoji API status ${response.status}`);
        }

        const payload = await response.json();
        emojiCache = { data: payload, fetchedAt: now };

        res.set("Cache-Control", "public, max-age=3600");
        return res.json({ ok: true, source: "remote", emojis: payload });
    } catch (err) {
        if (emojiCache.data) {
            return res.json({ ok: true, source: "stale-cache", emojis: emojiCache.data });
        }

        return res.status(502).json({
            ok: false,
            error: "No se pudieron cargar emojis remotos",
            detail: err?.message || "Proxy error"
        });
    }
});

export default router;
