import { appDb } from "../db/db.js";

let initPromise = null;

export const initCollabTables = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await appDb.query(`
        CREATE TABLE IF NOT EXISTS comunicacion.chat_eventos (
          id_evento TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          titulo TEXT NOT NULL,
          descripcion TEXT,
          tipo TEXT NOT NULL DEFAULT 'evento',
          starts_at BIGINT NOT NULL,
          created_at BIGINT NOT NULL,
          created_by TEXT NOT NULL,
          created_by_name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comunicacion.chat_encuestas (
          id_encuesta TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          pregunta TEXT NOT NULL,
          multiple BOOLEAN NOT NULL DEFAULT FALSE,
          created_at BIGINT NOT NULL,
          created_by TEXT NOT NULL,
          created_by_name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comunicacion.chat_encuesta_opciones (
          id_opcion TEXT PRIMARY KEY,
          id_encuesta TEXT NOT NULL REFERENCES comunicacion.chat_encuestas(id_encuesta) ON DELETE CASCADE,
          texto TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comunicacion.chat_encuesta_votos (
          id_encuesta TEXT NOT NULL REFERENCES comunicacion.chat_encuestas(id_encuesta) ON DELETE CASCADE,
          id_opcion TEXT NOT NULL REFERENCES comunicacion.chat_encuesta_opciones(id_opcion) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          voted_at BIGINT NOT NULL,
          PRIMARY KEY (id_encuesta, user_id)
        );

        CREATE TABLE IF NOT EXISTS comunicacion.chat_pins (
          id_pin TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          msg_id TEXT NOT NULL,
          texto TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          categoria TEXT NOT NULL,
          color TEXT NOT NULL,
          duration BIGINT NOT NULL,
          duration_label TEXT NOT NULL,
          pinned_at BIGINT NOT NULL,
          expires_at BIGINT NOT NULL
        );
      `);
    })();
  }

  return initPromise;
};

export const listEventsByRoomDb = async (roomId) => {
  await initCollabTables();
  const { rows } = await appDb.query(`
    SELECT
      id_evento AS id,
      room_id AS "roomId",
      titulo AS title,
      descripcion AS description,
      tipo AS kind,
      starts_at AS "startsAt",
      created_at AS "createdAt",
      created_by AS "createdBy",
      created_by_name AS "createdByName"
    FROM comunicacion.chat_eventos
    WHERE room_id = $1
    ORDER BY starts_at ASC
  `, [String(roomId)]);

  return rows;
};

export const createRoomEventDb = async ({ roomId, title, description, startsAt, createdBy, createdByName, kind = "evento" }) => {
  await initCollabTables();
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: String(roomId),
    title: String(title || "").trim(),
    description: String(description || "").trim(),
    kind,
    startsAt: typeof startsAt === "number" ? startsAt : Date.parse(startsAt),
    createdAt: Date.now(),
    createdBy: String(createdBy),
    createdByName: String(createdByName || "Usuario"),
  };

  await appDb.query(`
    INSERT INTO comunicacion.chat_eventos
      (id_evento, room_id, titulo, descripcion, tipo, starts_at, created_at, created_by, created_by_name)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [event.id, event.roomId, event.title, event.description, event.kind, event.startsAt, event.createdAt, event.createdBy, event.createdByName]);

  return event;
};

export const listPollsByRoomDb = async (roomId) => {
  await initCollabTables();
  const { rows } = await appDb.query(`
    SELECT
      e.id_encuesta,
      e.room_id,
      e.pregunta,
      e.multiple,
      e.created_at,
      e.created_by,
      e.created_by_name,
      o.id_opcion,
      o.texto,
      v.user_id,
      v.user_name,
      v.voted_at
    FROM comunicacion.chat_encuestas e
    JOIN comunicacion.chat_encuesta_opciones o ON o.id_encuesta = e.id_encuesta
    LEFT JOIN comunicacion.chat_encuesta_votos v
      ON v.id_encuesta = e.id_encuesta AND v.id_opcion = o.id_opcion
    WHERE e.room_id = $1
    ORDER BY e.created_at DESC, o.id_opcion ASC, v.voted_at ASC
  `, [String(roomId)]);

  const pollMap = new Map();
  for (const row of rows) {
    if (!pollMap.has(row.id_encuesta)) {
      pollMap.set(row.id_encuesta, {
        id: row.id_encuesta,
        roomId: row.room_id,
        question: row.pregunta,
        multiple: row.multiple,
        createdAt: row.created_at,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        options: [],
      });
    }

    const poll = pollMap.get(row.id_encuesta);
    let option = poll.options.find((item) => item.id === row.id_opcion);
    if (!option) {
      option = { id: row.id_opcion, text: row.texto, votes: [] };
      poll.options.push(option);
    }

    if (row.user_id) {
      option.votes.push({
        userId: row.user_id,
        userName: row.user_name,
        votedAt: row.voted_at,
      });
    }
  }

  return Array.from(pollMap.values());
};

export const createRoomPollDb = async ({ roomId, question, options, createdBy, createdByName, multiple = false }) => {
  await initCollabTables();
  const poll = {
    id: `poll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: String(roomId),
    question: String(question || "").trim(),
    options: options.map((option, index) => ({
      id: `opt_${Date.now()}_${index + 1}_${Math.random().toString(36).slice(2, 5)}`,
      text: String(option || "").trim(),
      votes: [],
    })),
    multiple: Boolean(multiple),
    createdAt: Date.now(),
    createdBy: String(createdBy),
    createdByName: String(createdByName || "Usuario"),
  };

  await appDb.query("BEGIN");
  try {
    await appDb.query(`
      INSERT INTO comunicacion.chat_encuestas
        (id_encuesta, room_id, pregunta, multiple, created_at, created_by, created_by_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [poll.id, poll.roomId, poll.question, poll.multiple, poll.createdAt, poll.createdBy, poll.createdByName]);

    for (const option of poll.options) {
      await appDb.query(`
        INSERT INTO comunicacion.chat_encuesta_opciones (id_opcion, id_encuesta, texto)
        VALUES ($1,$2,$3)
      `, [option.id, poll.id, option.text]);
    }

    await appDb.query("COMMIT");
    return poll;
  } catch (error) {
    await appDb.query("ROLLBACK");
    throw error;
  }
};

export const voteRoomPollDb = async ({ roomId, pollId, optionId, userId, userName }) => {
  await initCollabTables();
  await appDb.query("BEGIN");
  try {
    await appDb.query(`
      DELETE FROM comunicacion.chat_encuesta_votos
      WHERE id_encuesta = $1 AND user_id = $2
    `, [pollId, String(userId)]);

    await appDb.query(`
      INSERT INTO comunicacion.chat_encuesta_votos
        (id_encuesta, id_opcion, user_id, user_name, voted_at)
      VALUES ($1,$2,$3,$4,$5)
    `, [pollId, optionId, String(userId), String(userName || "Usuario"), Date.now()]);

    await appDb.query("COMMIT");
  } catch (error) {
    await appDb.query("ROLLBACK");
    throw error;
  }

  const polls = await listPollsByRoomDb(roomId);
  return polls.find((poll) => poll.id === pollId) || null;
};

export const listPinsByRoomDb = async (roomId) => {
  await initCollabTables();
  const now = Date.now();
  await appDb.query(`
    DELETE FROM comunicacion.chat_pins
    WHERE expires_at <= $1
  `, [now]);

  const { rows } = await appDb.query(`
    SELECT
      id_pin AS id,
      room_id AS "roomId",
      msg_id AS "msgId",
      texto AS text,
      sender_name AS "senderName",
      categoria AS category,
      color,
      duration,
      duration_label AS "durationLabel",
      pinned_at AS "pinnedAt",
      expires_at AS "expiresAt"
    FROM comunicacion.chat_pins
    WHERE room_id = $1
    ORDER BY pinned_at DESC
  `, [String(roomId)]);

  return rows;
};

export const createPinDb = async ({ roomId, messageId, duration, category, color, durationLabel, senderName, text }) => {
  await initCollabTables();
  const pin = {
    id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: String(roomId),
    msgId: String(messageId),
    text: String(text || "Mensaje fijado"),
    senderName: String(senderName || "Usuario"),
    category: String(category || "General"),
    color: String(color || "#6366f1"),
    duration: Number(duration || 0),
    durationLabel: String(durationLabel || ""),
    pinnedAt: Date.now(),
    expiresAt: Date.now() + Number(duration || 0),
  };

  await appDb.query(`
    INSERT INTO comunicacion.chat_pins
      (id_pin, room_id, msg_id, texto, sender_name, categoria, color, duration, duration_label, pinned_at, expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [pin.id, pin.roomId, pin.msgId, pin.text, pin.senderName, pin.category, pin.color, pin.duration, pin.durationLabel, pin.pinnedAt, pin.expiresAt]);

  return pin;
};

export const removePinDb = async ({ roomId, messageId }) => {
  await initCollabTables();
  await appDb.query(`
    DELETE FROM comunicacion.chat_pins
    WHERE room_id = $1 AND msg_id = $2
  `, [String(roomId), String(messageId)]);
  return { roomId: String(roomId), messageId: String(messageId) };
};
