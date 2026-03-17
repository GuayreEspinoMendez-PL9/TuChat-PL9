import express from "express";
import { appDb } from "../db/db.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
    getPresenceSnapshot,
} from "../services/collab.store.js";
import {
    buildPollResultMessage,
    closePollDb,
    createRoomEventDb,
    createRoomPollDb,
    deletePollDb,
    deleteRoomEventDb,
    expirePollsAndCollectAnnouncementsDb,
    listEventsByRoomDb,
    listPinsByRoomDb,
    listPollsByRoomDb,
    voteRoomPollDb,
} from "../services/collab.persistence.js";

const router = express.Router();
const EMOJI_SOURCE_URL = "https://www.emoji.family/api/emojis/";
const EMOJI_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let emojiCache = { data: null, fetchedAt: 0 };

router.use(requireAuth);

const getRoomMemberIds = async (roomId) => {
    const privateChat = await appDb.query(
        `SELECT id_profesor_usuario_app, id_alumno_usuario_app
         FROM comunicacion.chats_privados
         WHERE id_chat_privado = $1`,
        [roomId]
    );

    if (privateChat.rows.length > 0) {
        const row = privateChat.rows[0];
        return [row.id_profesor_usuario_app, row.id_alumno_usuario_app].filter(Boolean);
    }

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
    `, [roomId]);

    return rows.map((row) => row.id_usuario_app);
};

const canManageRoomExtras = async (roomId, currentUser) => {
    if (currentUser?.tipo_externo === 'PROFESOR' || currentUser?.id_rol === 2) {
        return true;
    }

    const privateChat = await appDb.query(
        `SELECT 1
         FROM comunicacion.chats_privados
         WHERE id_chat_privado = $1`,
        [roomId]
    );
    if (privateChat.rows.length > 0) {
        return false;
    }

    const { rows } = await appDb.query(
        `SELECT configuracion FROM comunicacion.salas_chat WHERE id_sala = $1`,
        [roomId]
    );

    const config = rows[0]?.configuracion || {};
    return Array.isArray(config.delegados) && config.delegados.includes(currentUser?.id_usuario_app);
};

const sanitizeModerationEntries = (entries = []) => {
    const now = Date.now();
    return (Array.isArray(entries) ? entries : [])
        .filter((entry) => entry?.userId)
        .map((entry) => ({
            userId: String(entry.userId),
            userName: entry.userName || 'Alumno',
            reason: entry.reason || '',
            createdAt: Number(entry.createdAt) || now,
            createdBy: entry.createdBy ? String(entry.createdBy) : null,
            createdByName: entry.createdByName || '',
            expiresAt: entry.expiresAt ? Number(entry.expiresAt) : null,
        }))
        .filter((entry) => !entry.expiresAt || entry.expiresAt > now);
};

const emitChatSystemMessage = async (req, roomId, message, memberIds = []) => {
    const io = req.app.get("io");
    io?.to(String(roomId)).emit("chat:receive", message);
    memberIds.forEach((userId) => {
        if (String(userId) !== String(message.senderId)) {
            io?.to(`user:${userId}`).emit("chat:receive", message);
        }
    });
};

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
                delegados: config.delegados || [],
                mutedMembers: sanitizeModerationEntries(config.mutedMembers || []),
                bannedMembers: sanitizeModerationEntries(config.bannedMembers || []),
            }
        });
    } catch (err) {
        console.error("❌ Error en /chat/settings:", err);
        res.json({ ok: false, error: err.message });
    }
});

router.post("/moderation/:roomId", async (req, res) => {
    try {
        const { roomId } = req.params;
        const { targetUserId, targetUserName, action, durationMinutes, customUntil, reason } = req.body || {};

        if (!(req.currentUser?.tipo_externo === 'PROFESOR' || req.currentUser?.id_rol === 2)) {
            return res.status(403).json({ ok: false, msg: "Solo el profesorado puede moderar este chat" });
        }

        if (!targetUserId || !['mute', 'ban', 'clear_mute', 'clear_ban'].includes(action)) {
            return res.status(400).json({ ok: false, msg: "Datos de moderacion no validos" });
        }

        const { rows } = await appDb.query(
            `SELECT configuracion FROM comunicacion.salas_chat WHERE id_sala = $1`,
            [roomId]
        );

        const currentConfig = rows[0]?.configuracion || {};
        const nextConfig = {
            soloProfesores: currentConfig.soloProfesores || false,
            delegados: currentConfig.delegados || [],
            mutedMembers: sanitizeModerationEntries(currentConfig.mutedMembers || []),
            bannedMembers: sanitizeModerationEntries(currentConfig.bannedMembers || []),
        };

        const normalizedTargetId = String(targetUserId);
        nextConfig.mutedMembers = nextConfig.mutedMembers.filter((entry) => String(entry.userId) !== normalizedTargetId);
        nextConfig.bannedMembers = nextConfig.bannedMembers.filter((entry) => String(entry.userId) !== normalizedTargetId);

        if (action === 'mute' || action === 'ban') {
            const expiresAt = customUntil
                ? Number(new Date(customUntil).getTime())
                : durationMinutes
                    ? Date.now() + Number(durationMinutes) * 60 * 1000
                    : null;

            const nextEntry = {
                userId: normalizedTargetId,
                userName: targetUserName || 'Alumno',
                reason: reason || '',
                createdAt: Date.now(),
                createdBy: String(req.currentUser.id_usuario_app),
                createdByName: req.currentUser.nombre || 'Profesor',
                expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
            };

            if (action === 'mute') nextConfig.mutedMembers.push(nextEntry);
            if (action === 'ban') nextConfig.bannedMembers.push(nextEntry);
        }

        await appDb.query(
            `UPDATE comunicacion.salas_chat SET configuracion = $1 WHERE id_sala = $2`,
            [JSON.stringify(nextConfig), roomId]
        );

        req.app.get("io")?.to(String(roomId)).emit("chat:settings_changed", nextConfig);

        return res.json({ ok: true, settings: nextConfig });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/presence/:roomId", async (req, res) => {
    try {
        const { roomId } = req.params;
        const memberIds = await getRoomMemberIds(roomId);
        const snapshot = getPresenceSnapshot(memberIds);
        return res.json({ ok: true, presence: snapshot });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/events/:roomId", async (req, res) => {
    try {
        return res.json({ ok: true, events: await listEventsByRoomDb(req.params.roomId) });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/events", async (req, res) => {
    try {
        const { roomId, title, description, startsAt, kind } = req.body || {};
        if (!roomId || !title || !startsAt) {
            return res.status(400).json({ ok: false, msg: "roomId, title y startsAt son obligatorios" });
        }
        if (!(await canManageRoomExtras(roomId, req.currentUser))) {
            return res.status(403).json({ ok: false, msg: "Solo profesorado o delegados pueden gestionar eventos" });
        }

        const event = await createRoomEventDb({
            roomId,
            title,
            description,
            startsAt,
            kind,
            createdBy: req.currentUser.id_usuario_app,
            createdByName: req.currentUser.nombre,
        });

        req.app.get("io")?.to(String(roomId)).emit("chat:event_created", event);
        return res.json({ ok: true, event });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.delete("/events/:eventId", async (req, res) => {
    try {
        const { eventId } = req.params;
        const { roomId } = req.body || {};
        if (!roomId) {
            return res.status(400).json({ ok: false, msg: "roomId es obligatorio" });
        }
        if (!(await canManageRoomExtras(roomId, req.currentUser))) {
            return res.status(403).json({ ok: false, msg: "Solo profesorado o delegados pueden eliminar eventos" });
        }

        await deleteRoomEventDb({ roomId, eventId });
        req.app.get("io")?.to(String(roomId)).emit("chat:event_deleted", { eventId, roomId });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/polls/:roomId", async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const announcements = await expirePollsAndCollectAnnouncementsDb(roomId);
        if (announcements.length > 0) {
            const memberIds = await getRoomMemberIds(roomId);
            for (const item of announcements) {
                req.app.get("io")?.to(String(roomId)).emit("chat:poll_updated", item.poll);
                await emitChatSystemMessage(req, roomId, item.message, memberIds);
            }
        }
        return res.json({ ok: true, polls: await listPollsByRoomDb(roomId) });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/pins/:roomId", async (req, res) => {
    try {
        return res.json({ ok: true, pins: await listPinsByRoomDb(req.params.roomId) });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/polls", async (req, res) => {
    try {
        const { roomId, question, options, multiple } = req.body || {};
        const cleanOptions = Array.isArray(options)
            ? options.map((item) => String(item || "").trim()).filter(Boolean)
            : [];

        if (!roomId || !question || cleanOptions.length < 2) {
            return res.status(400).json({ ok: false, msg: "roomId, question y al menos 2 opciones son obligatorios" });
        }
        if (!(await canManageRoomExtras(roomId, req.currentUser))) {
            return res.status(403).json({ ok: false, msg: "Solo profesorado o delegados pueden crear encuestas" });
        }

        const poll = await createRoomPollDb({
            roomId,
            question,
            options: cleanOptions,
            multiple,
            expiresAt: req.body?.expiresAt || null,
            createdBy: req.currentUser.id_usuario_app,
            createdByName: req.currentUser.nombre,
        });

        req.app.get("io")?.to(String(roomId)).emit("chat:poll_created", poll);
        return res.json({ ok: true, poll });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/polls/:pollId/vote", async (req, res) => {
    try {
        const { pollId } = req.params;
        const { roomId, optionId } = req.body || {};
        if (!roomId || !optionId) {
            return res.status(400).json({ ok: false, msg: "roomId y optionId son obligatorios" });
        }

        const announcements = await expirePollsAndCollectAnnouncementsDb(roomId);
        if (announcements.length > 0) {
            const memberIds = await getRoomMemberIds(roomId);
            for (const item of announcements) {
                req.app.get("io")?.to(String(roomId)).emit("chat:poll_updated", item.poll);
                await emitChatSystemMessage(req, roomId, item.message, memberIds);
            }
        }

        const poll = await voteRoomPollDb({
            roomId,
            pollId,
            optionId,
            userId: req.currentUser.id_usuario_app,
            userName: req.currentUser.nombre,
        });

        if (!poll) {
            return res.status(404).json({ ok: false, msg: "Encuesta no encontrada o ya cerrada" });
        }

        req.app.get("io")?.to(String(roomId)).emit("chat:poll_updated", poll);
        return res.json({ ok: true, poll });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/polls/:pollId/close", async (req, res) => {
    try {
        const { pollId } = req.params;
        const { roomId } = req.body || {};
        if (!roomId) {
            return res.status(400).json({ ok: false, msg: "roomId es obligatorio" });
        }
        if (!(await canManageRoomExtras(roomId, req.currentUser))) {
            return res.status(403).json({ ok: false, msg: "Solo profesorado o delegados pueden cerrar encuestas" });
        }

        const poll = await closePollDb({ roomId, pollId, announceResults: true });
        if (!poll) {
            return res.status(404).json({ ok: false, msg: "Encuesta no encontrada" });
        }

        const memberIds = await getRoomMemberIds(roomId);
        const message = buildPollResultMessage(poll);
        req.app.get("io")?.to(String(roomId)).emit("chat:poll_updated", poll);
        await emitChatSystemMessage(req, roomId, message, memberIds);
        return res.json({ ok: true, poll, message });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.delete("/polls/:pollId", async (req, res) => {
    try {
        const { pollId } = req.params;
        const { roomId } = req.body || {};
        if (!roomId) {
            return res.status(400).json({ ok: false, msg: "roomId es obligatorio" });
        }
        if (!(await canManageRoomExtras(roomId, req.currentUser))) {
            return res.status(403).json({ ok: false, msg: "Solo profesorado o delegados pueden eliminar encuestas" });
        }

        const poll = await deletePollDb({ roomId, pollId });
        req.app.get("io")?.to(String(roomId)).emit("chat:poll_deleted", { roomId, pollId });
        if (poll) {
            const memberIds = await getRoomMemberIds(roomId);
            await emitChatSystemMessage(req, roomId, buildPollResultMessage(poll), memberIds);
        }
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
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
