import { appDb } from "../db/db.js";

let initPromise = null;

// Helper de lectura de arrays de usuarios desde la base de datos, manejando tanto formatos JSON como strings simples
const parseUserArray = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

// Normaliza una fila de la base de datos al formato esperado por la aplicación, calculando los estados de entrega y lectura
const normalizeRow = (row) => {
  if (!row) return null;
  const deliveredUsers = parseUserArray(row.delivered_users);
  const readUsers = parseUserArray(row.read_users);
  const totalRecipients = Number(row.total_recipients || 0);
  const delivered = totalRecipients > 0 && deliveredUsers.length >= totalRecipients;
  const read = totalRecipients > 0 && readUsers.length >= totalRecipients;

  return {
    msg_id: row.msg_id,
    roomId: row.room_id,
    senderId: row.sender_id,
    totalRecipients,
    deliveredUsers,
    readUsers,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    createdAt: row.created_at,
    delivered,
    read,
    status: read ? "read" : delivered ? "delivered" : "sent",
  };
};
 // Inicializa la tabla de estado de mensajes si no existe, con un índice para optimizar consultas por room_id
export const initMessageStatusTable = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await appDb.query(`
        CREATE TABLE IF NOT EXISTS comunicacion.chat_message_status (
          msg_id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          total_recipients INTEGER NOT NULL DEFAULT 0,
          delivered_users JSONB NOT NULL DEFAULT '[]'::jsonb,
          read_users JSONB NOT NULL DEFAULT '[]'::jsonb,
          delivered_at BIGINT,
          read_at BIGINT,
          created_at BIGINT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chat_message_status_room_id
          ON comunicacion.chat_message_status(room_id);
      `);
    })();
  }

  return initPromise;
};

// Crea o actualiza el estado de un mensaje, asegurando que el número total de destinatarios se mantenga actualizado y consistente
export const createMessageStatusDb = async ({ msgId, roomId, senderId, totalRecipients = 0, createdAt = Date.now() }) => {
  if (!msgId || !roomId || !senderId) return null;
  await initMessageStatusTable();
  await appDb.query(`
    INSERT INTO comunicacion.chat_message_status
      (msg_id, room_id, sender_id, total_recipients, created_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (msg_id) DO UPDATE
      SET room_id = EXCLUDED.room_id,
          sender_id = EXCLUDED.sender_id,
          total_recipients = GREATEST(comunicacion.chat_message_status.total_recipients, EXCLUDED.total_recipients)
  `, [String(msgId), String(roomId), String(senderId), Number(totalRecipients || 0), Number(createdAt || Date.now())]);

  return getMessageStatusDb(msgId);
};

export const getMessageStatusDb = async (msgId) => {
  if (!msgId) return null;
  await initMessageStatusTable();
  const { rows } = await appDb.query(`
    SELECT *
    FROM comunicacion.chat_message_status
    WHERE msg_id = $1
  `, [String(msgId)]);
  return normalizeRow(rows[0]);
};

export const markMessageDeliveredDb = async ({ msgId, userId }) => {
  if (!msgId || !userId) return null;
  await initMessageStatusTable();
  const { rows } = await appDb.query(`
    UPDATE comunicacion.chat_message_status
    SET delivered_users = CASE
          WHEN delivered_users @> to_jsonb(ARRAY[$2::text])
          THEN delivered_users
          ELSE delivered_users || to_jsonb(ARRAY[$2::text])
        END,
        delivered_at = COALESCE(delivered_at, $3)
    WHERE msg_id = $1
    RETURNING *
  `, [String(msgId), String(userId), Date.now()]);
  return normalizeRow(rows[0]);
};

// Marca un mensaje como leído por un usuario, actualizando tanto la lista de usuarios que han leído como la fecha de lectura, 
// y asegurando que el estado se actualice correctamente cuando todos los destinatarios hayan leído el mensaje
export const markMessageReadDb = async ({ msgId, userId }) => {
  if (!msgId || !userId) return null;
  await initMessageStatusTable();
  const now = Date.now();
  const { rows } = await appDb.query(`
    UPDATE comunicacion.chat_message_status
    SET delivered_users = CASE
          WHEN delivered_users @> to_jsonb(ARRAY[$2::text])
          THEN delivered_users
          ELSE delivered_users || to_jsonb(ARRAY[$2::text])
        END,
        read_users = CASE
          WHEN read_users @> to_jsonb(ARRAY[$2::text])
          THEN read_users
          ELSE read_users || to_jsonb(ARRAY[$2::text])
        END,
        delivered_at = COALESCE(delivered_at, $3),
        read_at = CASE
          WHEN jsonb_array_length(
            CASE
              WHEN read_users @> to_jsonb(ARRAY[$2::text])
              THEN read_users
              ELSE read_users || to_jsonb(ARRAY[$2::text])
            END
          ) >= total_recipients AND total_recipients > 0
          THEN COALESCE(read_at, $3)
          ELSE read_at
        END
    WHERE msg_id = $1
    RETURNING *
  `, [String(msgId), String(userId), now]);
  return normalizeRow(rows[0]);
};

// Lista los estados de mensajes para un conjunto de IDs dentro de una sala específica, 
// optimizando la consulta para manejar grandes volúmenes de mensajes
export const listMessageStatusesByIdsDb = async ({ roomId, msgIds }) => {
  if (!roomId || !Array.isArray(msgIds) || msgIds.length === 0) return [];
  await initMessageStatusTable();
  const normalizedIds = Array.from(new Set(msgIds.filter(Boolean).map(String)));
  if (!normalizedIds.length) return [];

  const { rows } = await appDb.query(`
    SELECT *
    FROM comunicacion.chat_message_status
    WHERE room_id = $1
      AND msg_id = ANY($2::text[])
  `, [String(roomId), normalizedIds]);

  return rows.map(normalizeRow).filter(Boolean);
};
