import { Platform } from 'react-native';
import {
  buildMetadataIndex,
  isFileMessage,
  matchMessageAgainstSearch,
  normalizeMessage,
  prepareMessageForStorage,
} from './messageModel';

// ─────────────────────────────────────────────────────
// expo-sqlite SOLO funciona en iOS/Android.
// En web, el import estático de expo-sqlite ROMPE el módulo entero
// haciendo que TODAS las funciones exportadas sean undefined.
// Solución: usar require() condicional para que en web ni se cargue.
// ─────────────────────────────────────────────────────

let db: any = null;

if (Platform.OS !== 'web') {
  try {
    const SQLite = require('expo-sqlite');
    db = SQLite.openDatabaseSync('tuchat.db');
  } catch (e) {
    console.warn('⚠️ expo-sqlite no disponible:', e);
  }
}

export { db };

export const initDB = () => {
  if (!db) return;
  db.execSync(`
    CREATE TABLE IF NOT EXISTS mensajes_locales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msg_id TEXT UNIQUE,
      roomId TEXT,
      roomName TEXT,
      senderId TEXT,
      senderName TEXT,
      text TEXT,
      image TEXT,
      mediaType TEXT,
      fileName TEXT, 
      timestamp INTEGER,
      status TEXT,
      delivered INTEGER DEFAULT 0,
      readByRecipient INTEGER DEFAULT 0,
      read INTEGER DEFAULT 0,
      reactions TEXT,
      replyTo TEXT,
      metadata TEXT,
      threadTopic TEXT,
      messageType TEXT,
      important INTEGER DEFAULT 0,
      metadataIndex TEXT,
      requiresAck INTEGER DEFAULT 0,
      ackReaders TEXT
    );
    CREATE TABLE IF NOT EXISTS drafts (
      roomId TEXT PRIMARY KEY,
      content TEXT
    );
    CREATE TABLE IF NOT EXISTS mensajes_fijados (
      id TEXT PRIMARY KEY,
      roomId TEXT,
      msgId TEXT,
      text TEXT,
      senderName TEXT,
      category TEXT,
      color TEXT,
      duration INTEGER,
      durationLabel TEXT,
      pinnedAt INTEGER,
      expiresAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS chat_eventos_locales (
      id TEXT PRIMARY KEY,
      roomId TEXT,
      roomName TEXT,
      title TEXT,
      description TEXT,
      startsAt INTEGER,
      createdAt INTEGER,
      createdBy TEXT,
      createdByName TEXT,
      metadataIndex TEXT
    );
    CREATE TABLE IF NOT EXISTS chat_encuestas_locales (
      id TEXT PRIMARY KEY,
      roomId TEXT,
      roomName TEXT,
      question TEXT,
      expiresAt INTEGER,
      closedAt INTEGER,
      createdAt INTEGER,
      createdBy TEXT,
      createdByName TEXT,
      optionsJson TEXT,
      metadataIndex TEXT
    );
    CREATE TABLE IF NOT EXISTS importantes_descartados (
      userId TEXT,
      itemId TEXT,
      dismissedAt INTEGER,
      PRIMARY KEY (userId, itemId)
    );
  `);

  // Migration for existing tables
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN reactions TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN replyTo TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN mediaType TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN fileName TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN status TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN delivered INTEGER DEFAULT 0'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN readByRecipient INTEGER DEFAULT 0'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN roomName TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN metadata TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN threadTopic TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN messageType TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN important INTEGER DEFAULT 0'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN metadataIndex TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN requiresAck INTEGER DEFAULT 0'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN ackReaders TEXT'); } catch (e) { }
};

export const saveMessageLocal = (msg: any) => {
  if (!db) return;
  try {
    const serialized = prepareMessageForStorage(msg);
    const isRead = typeof msg.read === 'boolean' ? (msg.read ? 1 : 0) : (msg.isMe ? 1 : 0);
    const delivered = msg.delivered ? 1 : 0;
    const readByRecipient = msg.readByRecipient ? 1 : 0;

    db.runSync(
      'INSERT OR REPLACE INTO mensajes_locales (msg_id, roomId, roomName, senderId, senderName, text, image, mediaType, fileName, timestamp, status, delivered, readByRecipient, read, reactions, replyTo, metadata, threadTopic, messageType, important, metadataIndex, requiresAck, ackReaders) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [serialized.msg_id, serialized.roomId, serialized.roomName || null, serialized.senderId, serialized.senderName || "Usuario", serialized.text, serialized.image, serialized.mediaType || null, serialized.fileName || null, serialized.timestamp, serialized.status || null, delivered, readByRecipient, isRead, serialized.reactions, serialized.replyTo, serialized.metadata, serialized.threadTopic || null, serialized.messageType || null, serialized.important ? 1 : 0, serialized.metadataIndex || '', serialized.requiresAck ? 1 : 0, serialized.ackReaders]
    );
  } catch (e) { console.error("Error saveMessageLocal:", e); }
};

export const updateMessageLocal = (msgId: string, patch: any) => {
  if (!db || !msgId || !patch || typeof patch !== 'object') return;
  try {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (!entries.length) return;
    const normalizedEntries = entries.map(([key, value]) => {
      if (key === 'reactions' || key === 'ackReaders' || key === 'replyTo' || key === 'metadata') {
        return [key, value == null ? null : JSON.stringify(value)];
      }
      if (key === 'read' || key === 'delivered' || key === 'readByRecipient' || key === 'important' || key === 'requiresAck') {
        return [key, value ? 1 : 0];
      }
      return [key, value];
    });
    const setClause = normalizedEntries.map(([key]) => `${key} = ?`).join(', ');
    const values = normalizedEntries.map(([, value]) => value);
    db.runSync(`UPDATE mensajes_locales SET ${setClause} WHERE msg_id = ?`, [...values, msgId]);
  } catch (e) {
    console.error("Error updateMessageLocal:", e);
  }
};

const isImportantDismissed = (userId?: string, itemId?: string) => {
  if (!db || !userId || !itemId) return false;
  try {
    const row: any = db.getFirstSync('SELECT 1 as dismissed FROM importantes_descartados WHERE userId = ? AND itemId = ?', [String(userId), String(itemId)]);
    return Boolean(row?.dismissed);
  } catch {
    return false;
  }
};

export const getUnreadCountByRoom = (roomId: string): number => {
  if (!db) return 0;
  try {
    const row: any = db.getFirstSync(
      'SELECT COUNT(*) as count FROM mensajes_locales WHERE roomId = ? AND read = 0',
      [roomId]
    );
    return row ? row.count : 0;
  } catch (e) { return 0; }
};

export const markMessagesAsRead = (roomId: string) => {
  if (!db) return;
  try {
    db.runSync('UPDATE mensajes_locales SET read = 1 WHERE roomId = ?', [roomId]);
    console.log(`✅ Mensajes marcados como leídos en ${roomId}`);
  } catch (e) { console.error("Error marking read:", e); }
};

export const getMessagesByRoom = (roomId: string): any[] => {
  if (!db) return [];
  try {
    const rows: any[] = db.getAllSync('SELECT * FROM mensajes_locales WHERE roomId = ? ORDER BY timestamp ASC', [roomId]);
    return rows.map(normalizeMessage);
  } catch (e) { return []; }
};

export const updateMessageAckReaders = (msgId: string, ackReaders: any[]) => {
  if (!db) return;
  try {
    db.runSync('UPDATE mensajes_locales SET ackReaders = ? WHERE msg_id = ?', [JSON.stringify(ackReaders || []), msgId]);
  } catch (e) {
    console.error("Error updateMessageAckReaders:", e);
  }
};

const normalizeEventRecord = (row: any) => ({
  msg_id: `event:${row.id}`,
  id: row.id,
  roomId: row.roomId,
  roomName: row.roomName || null,
  text: row.title,
  title: row.title,
  description: row.description,
  senderId: row.createdBy,
  senderName: row.createdByName || 'Profesor',
  timestamp: row.startsAt || row.createdAt,
  startsAt: row.startsAt,
  itemType: 'event',
  targetPanel: 'events',
  important: true,
  metadataIndex: row.metadataIndex || buildMetadataIndex({
    text: row.title,
    roomName: row.roomName,
    senderName: row.createdByName,
    metadata: { description: row.description, kind: 'evento' },
    timestamp: row.startsAt || row.createdAt,
  }),
});

const normalizePollRecord = (row: any) => ({
  msg_id: `poll:${row.id}`,
  id: row.id,
  roomId: row.roomId,
  roomName: row.roomName || null,
  text: row.question,
  question: row.question,
  senderId: row.createdBy,
  senderName: row.createdByName || 'Profesor',
  timestamp: row.createdAt,
  expiresAt: row.expiresAt,
  closedAt: row.closedAt,
  options: row.optionsJson ? JSON.parse(row.optionsJson) : [],
  itemType: 'poll',
  targetPanel: 'polls',
  important: true,
  metadataIndex: row.metadataIndex || buildMetadataIndex({
    text: row.question,
    roomName: row.roomName,
    senderName: row.createdByName,
    metadata: { options: row.optionsJson ? JSON.parse(row.optionsJson) : [], kind: 'encuesta' },
    timestamp: row.expiresAt || row.createdAt,
  }),
});

const normalizePinRecord = (row: any) => ({
  msg_id: row.msgId ? String(row.msgId) : `pin:${row.id}`,
  id: row.id,
  pinId: row.id,
  roomId: row.roomId,
  text: row.text,
  senderName: row.senderName || 'Profesor',
  timestamp: row.pinnedAt,
  pinnedAt: row.pinnedAt,
  expiresAt: row.expiresAt,
  itemType: 'pin',
  important: true,
  targetPanel: row.msgId ? undefined : 'info',
  metadataIndex: buildMetadataIndex({
    text: row.text,
    senderName: row.senderName,
    metadata: { category: row.category, kind: 'pin' },
    timestamp: row.pinnedAt,
  }),
});

const getStoredEvents = (roomId?: string) => {
  if (!db) return [];
  const rows: any[] = roomId
    ? db.getAllSync('SELECT * FROM chat_eventos_locales WHERE roomId = ? ORDER BY startsAt ASC', [roomId])
    : db.getAllSync('SELECT * FROM chat_eventos_locales ORDER BY startsAt ASC');
  return rows.map(normalizeEventRecord);
};

const getStoredPolls = (roomId?: string) => {
  if (!db) return [];
  const rows: any[] = roomId
    ? db.getAllSync('SELECT * FROM chat_encuestas_locales WHERE roomId = ? ORDER BY createdAt DESC', [roomId])
    : db.getAllSync('SELECT * FROM chat_encuestas_locales ORDER BY createdAt DESC');
  return rows.map(normalizePollRecord);
};

const getStoredPins = (roomId?: string) => {
  if (!db) return [];
  const now = Date.now();
  const rows: any[] = roomId
    ? db.getAllSync('SELECT * FROM mensajes_fijados WHERE roomId = ? AND expiresAt > ? ORDER BY pinnedAt DESC', [roomId, now])
    : db.getAllSync('SELECT * FROM mensajes_fijados WHERE expiresAt > ? ORDER BY pinnedAt DESC', [now]);
  return rows.map(normalizePinRecord);
};

export const getImportantMessages = (userId?: string, roomIds?: string[]): any[] => {
  if (!db) return [];
  try {
    const scopedRoomIds = Array.isArray(roomIds) && roomIds.length > 0 ? roomIds.map(String) : null;
    const rows: any[] = db.getAllSync(`SELECT * FROM mensajes_locales WHERE important = 1 ORDER BY timestamp DESC`);
    return [
      ...rows.map(normalizeMessage),
      ...getStoredEvents(),
      ...getStoredPolls(),
      ...getStoredPins(),
    ]
      .filter((item) => !scopedRoomIds || scopedRoomIds.includes(String(item.roomId)))
      .filter((item) => !isImportantDismissed(userId, item.msg_id))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (e) {
    console.error("Error getImportantMessages:", e);
    return [];
  }
};

export const dismissImportantItem = (itemId: string, userId?: string) => {
  if (!db || !itemId || !userId) return;
  try {
    db.runSync('INSERT OR REPLACE INTO importantes_descartados (userId, itemId, dismissedAt) VALUES (?, ?, ?)', [String(userId), String(itemId), Date.now()]);
  } catch (e) {
    console.error("Error dismissImportantItem:", e);
  }
};

export const getFilesByRoom = (roomId: string): any[] => {
  if (!db) return [];
  try {
    const rows: any[] = db.getAllSync('SELECT * FROM mensajes_locales WHERE roomId = ? ORDER BY timestamp DESC', [roomId]);
    return rows.map(normalizeMessage).filter(isFileMessage);
  } catch (e) {
    console.error("Error getFilesByRoom:", e);
    return [];
  }
};

export const searchMessagesAdvanced = (queryOrOptions: string | any): any[] => {
  if (!db) return [];
  try {
    const options = typeof queryOrOptions === 'string'
      ? { query: queryOrOptions }
      : (queryOrOptions || {});
    const rows: any[] = db.getAllSync('SELECT * FROM mensajes_locales ORDER BY timestamp DESC');
    return [
      ...rows.map(normalizeMessage),
      ...getStoredEvents(options.roomId),
      ...getStoredPolls(options.roomId),
      ...getStoredPins(options.roomId),
    ].filter((row) => matchMessageAgainstSearch(row, options));
  } catch (e) {
    console.error("Error searchMessagesAdvanced:", e);
    return [];
  }
};

export const saveDraftLocal = (roomId: string, content: string) => {
  if (!db) return;
  try {
    db.runSync('INSERT OR REPLACE INTO drafts (roomId, content) VALUES (?, ?)', [roomId, content]);
  } catch (e) { console.error("Error saveDraftLocal:", e); }
};

export const getDraftLocal = (roomId: string): string => {
  if (!db) return "";
  try {
    const row: any = db.getFirstSync('SELECT content FROM drafts WHERE roomId = ?', [roomId]);
    return row ? row.content : "";
  } catch (e) { return ""; }
};

export const getAllUnreadCounts = (): Record<string, number> => {
  if (!db) return {};
  try {
    const rows: any[] = db.getAllSync(
      'SELECT roomId, COUNT(*) as count FROM mensajes_locales WHERE read = 0 GROUP BY roomId'
    );

    const counts: Record<string, number> = {};
    rows.forEach(row => {
      counts[row.roomId] = row.count;
    });

    return counts;
  } catch (e) {
    console.error("Error getAllUnreadCounts:", e);
    return {};
  }
};

export const getTotalUnreadCount = (): number => {
  if (!db) return 0;
  try {
    const row: any = db.getFirstSync(
      'SELECT COUNT(*) as count FROM mensajes_locales WHERE read = 0'
    );
    return row ? row.count : 0;
  } catch (e) {
    return 0;
  }
};

export const toggleReactionFn = (msgId: string, reaction: { emoji: string, userId: string }) => {
  console.log("🟢 [DB] toggleReactionFn called:", msgId, reaction);
  if (!db) return [];
  try {
    const row: any = db.getFirstSync('SELECT reactions FROM mensajes_locales WHERE msg_id = ?', [msgId]);
    let reactions: any[] = [];
    if (row && row.reactions) {
      try { reactions = JSON.parse(row.reactions); } catch (e) { }
    }

    const existingIndex = reactions.findIndex((r: any) => r.userId === reaction.userId);

    if (existingIndex >= 0) {
      if (reactions[existingIndex].emoji === reaction.emoji) {
        reactions.splice(existingIndex, 1);
      } else {
        reactions[existingIndex] = reaction;
      }
    } else {
      reactions.push(reaction);
    }

    db.runSync('UPDATE mensajes_locales SET reactions = ? WHERE msg_id = ?', [JSON.stringify(reactions), msgId]);
    return reactions;
  } catch (e) {
    console.error("Error toggleReactionFn:", e);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════
// PINNED MESSAGES
// ═══════════════════════════════════════════════════════════

export const savePinnedMessage = (pin: any) => {
  if (!db) { console.log('⚠️ savePinnedMessage: sin DB (web)'); return; }
  try {
    db.runSync(
      'INSERT OR REPLACE INTO mensajes_fijados (id, roomId, msgId, text, senderName, category, color, duration, durationLabel, pinnedAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pin.id, pin.roomId, pin.msgId, pin.text, pin.senderName, pin.category, pin.color, pin.duration, pin.durationLabel, pin.pinnedAt, pin.expiresAt]
    );
    console.log(`📌 Pin guardado: ${pin.id} en ${pin.roomId}`);
  } catch (e) {
    console.error("Error savePinnedMessage:", e);
  }
};

export const getPinnedMessagesByRoom = (roomId: string): any[] => {
  if (!db) return [];
  try {
    const now = Date.now();
    const rows: any[] = db.getAllSync(
      'SELECT * FROM mensajes_fijados WHERE roomId = ? AND expiresAt > ? ORDER BY pinnedAt DESC',
      [roomId, now]
    );
    console.log(`📌 Pins cargados: ${rows.length} en ${roomId}`);
    return rows;
  } catch (e) {
    console.error("Error getPinnedMessagesByRoom:", e);
    return [];
  }
};

export const saveRoomEventLocal = (event: any) => {
  if (!db || !event?.id) return;
  try {
    const startsAt = event.startsAt ? new Date(event.startsAt).getTime() : Date.now();
    const createdAt = event.createdAt ? new Date(event.createdAt).getTime() : Date.now();
    db.runSync(
      'INSERT OR REPLACE INTO chat_eventos_locales (id, roomId, roomName, title, description, startsAt, createdAt, createdBy, createdByName, metadataIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        event.id,
        String(event.roomId),
        event.roomName || null,
        event.title || '',
        event.description || '',
        startsAt,
        createdAt,
        event.createdBy || null,
        event.createdByName || null,
        buildMetadataIndex({
          text: event.title,
          roomName: event.roomName,
          senderName: event.createdByName,
          metadata: { description: event.description, kind: 'evento' },
          timestamp: startsAt,
        }),
      ]
    );
  } catch (e) {
    console.error("Error saveRoomEventLocal:", e);
  }
};

export const removeRoomEventLocal = (eventId: string) => {
  if (!db) return;
  try {
    db.runSync('DELETE FROM chat_eventos_locales WHERE id = ?', [String(eventId)]);
  } catch (e) {
    console.error("Error removeRoomEventLocal:", e);
  }
};

export const saveRoomPollLocal = (poll: any) => {
  if (!db || !poll?.id) return;
  try {
    const expiresAt = poll.expiresAt ? new Date(poll.expiresAt).getTime() : null;
    const closedAt = poll.closedAt ? new Date(poll.closedAt).getTime() : null;
    const createdAt = poll.createdAt ? new Date(poll.createdAt).getTime() : Date.now();
    db.runSync(
      'INSERT OR REPLACE INTO chat_encuestas_locales (id, roomId, roomName, question, expiresAt, closedAt, createdAt, createdBy, createdByName, optionsJson, metadataIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        poll.id,
        String(poll.roomId),
        poll.roomName || null,
        poll.question || '',
        expiresAt,
        closedAt,
        createdAt,
        poll.createdBy || null,
        poll.createdByName || null,
        JSON.stringify(poll.options || []),
        buildMetadataIndex({
          text: poll.question,
          roomName: poll.roomName,
          senderName: poll.createdByName,
          metadata: { options: (poll.options || []).map((item: any) => item.text || ''), kind: 'encuesta' },
          timestamp: expiresAt || createdAt,
        }),
      ]
    );
  } catch (e) {
    console.error("Error saveRoomPollLocal:", e);
  }
};

export const removeRoomPollLocal = (pollId: string) => {
  if (!db) return;
  try {
    db.runSync('DELETE FROM chat_encuestas_locales WHERE id = ?', [String(pollId)]);
  } catch (e) {
    console.error("Error removeRoomPollLocal:", e);
  }
};

export const removePinnedMessage = (roomId: string, msgId: string) => {
  if (!db) return;
  try {
    db.runSync('DELETE FROM mensajes_fijados WHERE roomId = ? AND msgId = ?', [roomId, msgId]);
    console.log(`📌 Pin eliminado: ${msgId} de ${roomId}`);
  } catch (e) {
    console.error("Error removePinnedMessage:", e);
  }
};

export const cleanExpiredPins = () => {
  if (!db) return;
  try {
    const now = Date.now();
    db.runSync('DELETE FROM mensajes_fijados WHERE expiresAt <= ?', [now]);
    console.log(`📌 Pins expirados limpiados`);
  } catch (e) {
    console.error("Error cleanExpiredPins:", e);
  }
};

// ─── CLEAR OLD MESSAGES (>20 days) ───────────────────────
export const clearOldMessages = (days: number = 20): number => {
  if (!db) return 0;
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const countRow: any = db.getFirstSync(
      'SELECT COUNT(*) as count FROM mensajes_locales WHERE timestamp < ?', [cutoff]
    );
    const count = countRow?.count || 0;
    if (count > 0) {
      db.runSync('DELETE FROM mensajes_locales WHERE timestamp < ?', [cutoff]);
      console.log(`🗑️ ${count} mensajes antiguos eliminados (>${days} días)`);
    }
    return count;
  } catch (e) {
    console.error("Error clearOldMessages:", e);
    return 0;
  }
};

export const getMessagesForSync = (days: number = 30): { roomId: string; messages: any[] }[] => {
  if (!db) return [];
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const rooms: any[] = db.getAllSync(
      'SELECT DISTINCT roomId FROM mensajes_locales WHERE timestamp >= ?', [cutoff]
    );
    return rooms.map(r => {
      const msgs: any[] = db.getAllSync(
        'SELECT * FROM mensajes_locales WHERE roomId = ? AND timestamp >= ? ORDER BY timestamp ASC',
        [r.roomId, cutoff]
      );
      // Parsear reactions y replyTo
      const parsed = msgs.map(m => ({
        ...m,
        reactions: m.reactions ? JSON.parse(m.reactions) : [],
        replyTo: m.replyTo ? JSON.parse(m.replyTo) : null,
      }));
      return { roomId: r.roomId, messages: parsed };
    });
  } catch (e) {
    console.error("Error getMessagesForSync:", e);
    return [];
  }
};
