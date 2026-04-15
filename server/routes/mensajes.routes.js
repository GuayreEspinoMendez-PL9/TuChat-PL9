import { Router } from "express";
import { getRedis } from "../redis.js";
import { listMessageStatusesByIdsDb } from "../services/messageStatus.persistence.js";
import {
  clearPendingMessages,
  clearPendingMessagesByIds,
  clearPendingMessagesByRoom,
  getPendingDevice,
  listPendingMessages,
} from "../services/pendingMessages.service.js";

const router = Router();

//Descargar mensajes guardados mientras el usuario estaba offline
router.get("/pendientes/:userId", async (req, res) => {
  try {
    const redis = getRedis();
    const { userId } = req.params;
    const device = getPendingDevice(req.query.device);
    const roomId = req.query.roomId ? String(req.query.roomId) : null;
    const mensajes = await listPendingMessages(redis, userId, device);
    const filtered = roomId
      ? mensajes.filter((message) => String(message?.roomId || '') === roomId)
      : mensajes;

    res.json({ ok: true, mensajes: filtered });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Confirmación de descarga (Borrar de Redis)
router.post("/ack", async (req, res) => {
  try {
    const redis = getRedis();
    const { userId, device, roomId, msgIds } = req.body;
    const targetDevice = getPendingDevice(device);

    if (Array.isArray(msgIds) && msgIds.length > 0) {
      await clearPendingMessagesByIds(redis, userId, targetDevice, msgIds);
      return res.json({ ok: true, device: targetDevice, scope: "messages" });
    }

    if (roomId) {
      await clearPendingMessagesByRoom(redis, userId, targetDevice, roomId);
      return res.json({ ok: true, device: targetDevice, scope: "room" });
    }

    await clearPendingMessages(redis, userId, targetDevice);
    res.json({ ok: true, device: targetDevice, scope: "all" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Obtener estados de mensajes por IDs
router.post("/estados", async (req, res) => {
  try {
    const { roomId, msgIds } = req.body || {};
    if (!roomId || !Array.isArray(msgIds)) {
      return res.status(400).json({ ok: false, msg: "roomId y msgIds son obligatorios" });
    }

    const statuses = await listMessageStatusesByIdsDb({ roomId, msgIds });
    res.json({ ok: true, statuses });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
