import { Router } from "express";
import { getRedis } from "../redis.js";
import { listMessageStatusesByIdsDb } from "../services/messageStatus.persistence.js";
import {
  clearPendingMessages,
  getPendingDevice,
  listPendingMessages,
} from "../services/pendingMessages.service.js";

const router = Router();

// T3: Descargar mensajes guardados mientras el usuario estaba offline
router.get("/pendientes/:userId", async (req, res) => {
  try {
    const redis = getRedis();
    const { userId } = req.params;
    const device = getPendingDevice(req.query.device);
    const mensajes = await listPendingMessages(redis, userId, device);

    res.json({ ok: true, mensajes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// T3: Confirmación de descarga (Borrar de Redis)
router.post("/ack", async (req, res) => {
  try {
    const redis = getRedis();
    const { userId, device } = req.body;
    const targetDevice = getPendingDevice(device);
    await clearPendingMessages(redis, userId, targetDevice);
    res.json({ ok: true, device: targetDevice });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

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
