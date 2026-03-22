const SUPPORTED_DEVICES = new Set(["web", "mobile"]);

const getQueueKey = (userId, device) => `pendientes:${device}:usuario:${userId}`;

const normalizeDevice = (device) => {
  const candidate = String(device || "mobile").toLowerCase();
  return SUPPORTED_DEVICES.has(candidate) ? candidate : "mobile";
};

export const enqueuePendingMessage = async (redis, userId, message) => {
  if (!redis || redis.status !== "ready" || !userId || !message) return;

  const serialized = JSON.stringify(message);
  const keys = [
    getQueueKey(userId, "web"),
    getQueueKey(userId, "mobile"),
  ];

  for (const key of keys) {
    await redis.rpush(key, serialized);
    await redis.expire(key, 604800);
  }
};

export const listPendingMessages = async (redis, userId, device) => {
  if (!redis || !userId) return [];
  const key = getQueueKey(userId, normalizeDevice(device));
  const rawMessages = await redis.lrange(key, 0, -1);
  return rawMessages.map((item) => JSON.parse(item));
};

export const clearPendingMessages = async (redis, userId, device) => {
  if (!redis || !userId) return;
  const key = getQueueKey(userId, normalizeDevice(device));
  await redis.del(key);
};

export const getPendingDevice = normalizeDevice;
