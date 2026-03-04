import { Platform } from 'react-native';

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
      senderId TEXT,
      senderName TEXT,
      text TEXT,
      image TEXT,
      mediaType TEXT,
      fileName TEXT, 
      timestamp INTEGER,
      read INTEGER DEFAULT 0,
      reactions TEXT,
      replyTo TEXT
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
  `);

  // Migration for existing tables
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN reactions TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN replyTo TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN mediaType TEXT'); } catch (e) { }
  try { db.execSync('ALTER TABLE mensajes_locales ADD COLUMN fileName TEXT'); } catch (e) { }
};

export const saveMessageLocal = (msg: any) => {
  if (!db) return;
  try {
    const isRead = msg.isMe ? 1 : 0;
    const reactions = msg.reactions ? JSON.stringify(msg.reactions) : null;
    const replyTo = msg.replyTo ? JSON.stringify(msg.replyTo) : null;

    db.runSync(
      'INSERT OR IGNORE INTO mensajes_locales (msg_id, roomId, senderId, senderName, text, image, mediaType, fileName, timestamp, read, reactions, replyTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [msg.msg_id, msg.roomId, msg.senderId, msg.senderName || "Usuario", msg.text, msg.image, msg.mediaType || 'image', msg.fileName || null, msg.timestamp, isRead, reactions, replyTo]
    );
  } catch (e) { console.error("Error saveMessageLocal:", e); }
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
    return rows.map(row => ({
      ...row,
      reactions: row.reactions ? JSON.parse(row.reactions) : [],
      replyTo: row.replyTo ? JSON.parse(row.replyTo) : null
    }));
  } catch (e) { return []; }
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