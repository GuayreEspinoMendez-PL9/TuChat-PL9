import { Router } from "express";
import { getRedis } from "../redis.js";

const router = Router();

// T3: Descargar mensajes guardados mientras el usuario estaba offline
router.get("/pendientes/:userId", async (req, res) => {
  try {
    const redis = getRedis();
    const { userId } = req.params;
    const key = `pendientes:usuario:${userId}`;

    const rawMessages = await redis.lrange(key, 0, -1);
    const mensajes = rawMessages.map(m => JSON.parse(m));

    res.json({ ok: true, mensajes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// T3: Confirmación de descarga (Borrar de Redis)
router.post("/ack", async (req, res) => {
  try {
    const redis = getRedis();
    const { userId } = req.body;
    await redis.del(`pendientes:usuario:${userId}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;