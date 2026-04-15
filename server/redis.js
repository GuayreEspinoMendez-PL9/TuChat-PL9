import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

let redis = null;

export function getRedis() { 
  if (!redis) {
    const connectionString = process.env.REDIS_URL;

    if (connectionString) {
      // Conexión Render/Producción
      redis = new Redis(connectionString, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } else {
      // Conexión para local (.env)
      redis = new Redis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
        retryStrategy(times) {
          return Math.min(times * 50, 2000);
        },
      });
    }
    redis.on("error", (err) => {
      console.error("Redis error:", err.message);
    });
  }
  return redis;
}