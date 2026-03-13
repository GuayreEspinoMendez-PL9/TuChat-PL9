import {
  buildMetadataIndex,
  isFileMessage,
  matchMessageAgainstSearch,
  normalizeMessage,
} from './messageModel';

export const initDB = () => {
  console.log("DB: Usando LocalStorage (Web Mode)");
};

export const saveMessageLocal = (msg: any) => {
  try {
    const key = `chat_${msg.roomId}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]').map(normalizeMessage);
    const nextMessage = normalizeMessage({
      ...msg,
      read: typeof msg.read === 'boolean' ? msg.read : Boolean(msg.isMe),
    });
    const index = history.findIndex((m: any) => m.msg_id === msg.msg_id);
    if (index >= 0) {
      history[index] = nextMessage;
    } else {
      history.push(nextMessage);
    }
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) { console.error("Error saveMessageLocal Web", e); }
};

const DISMISSED_IMPORTANT_KEY = 'tuchat_dismissed_important';

const getDismissedImportant = (): Record<string, string[]> => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_IMPORTANT_KEY) || '{}');
  } catch {
    return {};
  }
};

const isImportantDismissed = (userId?: string, itemId?: string) => {
  if (!userId || !itemId) return false;
  const all = getDismissedImportant();
  return Array.isArray(all[userId]) && all[userId].includes(itemId);
};

export const getUnreadCountByRoom = (roomId: string): number => {
  try {
    const history = JSON.parse(localStorage.getItem(`chat_${roomId}`) || '[]');
    return history.filter((m: any) => m.read === false).length;
  } catch (e) { return 0; }
};

export const markMessagesAsRead = (roomId: string) => {
  try {
    const key = `chat_${roomId}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = history.map((m: any) => ({ ...m, read: true }));
    localStorage.setItem(key, JSON.stringify(updated));
    console.log(`✅ Mensajes marcados como leídos en ${roomId}`);
  } catch (e) { console.error("Error markMessagesAsRead Web", e); }
};

export const getMessagesByRoom = (roomId: string): any[] => {
  try {
    return JSON.parse(localStorage.getItem(`chat_${roomId}`) || '[]').map(normalizeMessage);
  } catch (e) { return []; }
};

export const updateMessageAckReaders = (msgId: string, ackReaders: any[]) => {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (!key.startsWith('chat_')) continue;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      const next = history.map((message: any) =>
        message.msg_id === msgId ? { ...message, ackReaders: ackReaders || [] } : message
      );
      localStorage.setItem(key, JSON.stringify(next));
    }
  } catch (e) { console.error("Error updateMessageAckReaders Web", e); }
};

export const saveDraftLocal = (roomId: string, content: string) => {
  try { localStorage.setItem(`draft_${roomId}`, content); } catch (e) { }
};

export const getDraftLocal = (roomId: string): string => {
  try { return localStorage.getItem(`draft_${roomId}`) || ""; } catch (e) { return ""; }
};

export const getAllUnreadCounts = (): Record<string, number> => {
  try {
    const counts: Record<string, number> = {};
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith('chat_')) {
        const roomId = key.replace('chat_', '');
        counts[roomId] = getUnreadCountByRoom(roomId);
      }
    });

    return counts;
  } catch (e) {
    console.error("Error getAllUnreadCounts:", e);
    return {};
  }
};

export const getTotalUnreadCount = (): number => {
  try {
    let total = 0;
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith('chat_')) {
        const roomId = key.replace('chat_', '');
        total += getUnreadCountByRoom(roomId);
      }
    });

    return total;
  } catch (e) {
    console.error("Error getTotalUnreadCount:", e);
    return 0;
  }
};

export const toggleReactionFn = (msgId: string, reaction: { emoji: string, userId: string }) => {
  console.log("🟢 [DB Web] toggleReactionFn called:", msgId, reaction);
  try {
    // Find the chat room containing the message
    // Since we don't have roomId passed here, we have to search all chats in localStorage
    // This is inefficient but necessary given the current structure of localStorage keys
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith('chat_')) {
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        const msgIndex = history.findIndex((m: any) => m.msg_id === msgId);

        if (msgIndex >= 0) {
          const msg = history[msgIndex];
          let reactions = msg.reactions || [];

          // Check if user already reacted
          const existingIndex = reactions.findIndex((r: any) => r.userId === reaction.userId);

          if (existingIndex >= 0) {
            // Toggle logic
            if (reactions[existingIndex].emoji === reaction.emoji) {
              reactions.splice(existingIndex, 1);
            } else {
              reactions[existingIndex] = reaction;
            }
          } else {
            reactions.push(reaction);
          }

          // Update message in history
          history[msgIndex] = { ...msg, reactions };
          localStorage.setItem(key, JSON.stringify(history));
          return reactions;
        }
      }
    }
    return [];
  } catch (e) {
    console.error("Error toggleReactionFn Web:", e);
    return [];
  }
};

// Alias para compatibilidad
export const toggleMessageReaction = toggleReactionFn;
export const toggleReactionLocal = toggleReactionFn;

// ═══════════════════════════════════════════════════════════
// PINNED MESSAGES (Web - localStorage)
// ═══════════════════════════════════════════════════════════

const PINS_KEY = 'tuchat_pins';
const EVENTS_KEY = 'tuchat_events';
const POLLS_KEY = 'tuchat_polls';

const getAllPins = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem(PINS_KEY) || '[]');
  } catch (e) { return []; }
};

const saveAllPins = (pins: any[]) => {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  } catch (e) { console.error("Error guardando pins:", e); }
};

export const savePinnedMessage = (pin: any) => {
  try {
    const pins = getAllPins();
    const index = pins.findIndex((p: any) => p.id === pin.id);
    if (index >= 0) {
      pins[index] = pin;
    } else {
      pins.push(pin);
    }
    saveAllPins(pins);
    console.log(`📌 Pin guardado (web): ${pin.id} en ${pin.roomId}`);
  } catch (e) {
    console.error("Error savePinnedMessage Web:", e);
  }
};

export const getPinnedMessagesByRoom = (roomId: string): any[] => {
  try {
    const now = Date.now();
    const pins = getAllPins();
    const active = pins.filter((p: any) => p.roomId === roomId && p.expiresAt > now);
    active.sort((a: any, b: any) => b.pinnedAt - a.pinnedAt);
    console.log(`📌 Pins cargados (web): ${active.length} en ${roomId}`);
    return active;
  } catch (e) {
    console.error("Error getPinnedMessagesByRoom Web:", e);
    return [];
  }
};

export const removePinnedMessage = (roomId: string, msgId: string) => {
  try {
    const pins = getAllPins();
    const filtered = pins.filter((p: any) => !(p.roomId === roomId && p.msgId === msgId));
    saveAllPins(filtered);
    console.log(`📌 Pin eliminado (web): ${msgId} de ${roomId}`);
  } catch (e) {
    console.error("Error removePinnedMessage Web:", e);
  }
};

export const cleanExpiredPins = () => {
  try {
    const now = Date.now();
    const pins = getAllPins();
    const active = pins.filter((p: any) => p.expiresAt > now);
    saveAllPins(active);
    console.log(`📌 Pins expirados limpiados (web)`);
  } catch (e) {
    console.error("Error cleanExpiredPins Web:", e);
  }
};

// ─── CLEAR OLD MESSAGES (>20 days) ───────────────────────
export const clearOldMessages = (days: number = 20): number => {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith('chat_')) {
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = history.filter((m: any) => (m.timestamp || 0) >= cutoff);
        const deleted = history.length - filtered.length;
        if (deleted > 0) {
          totalDeleted += deleted;
          if (filtered.length > 0) {
            localStorage.setItem(key, JSON.stringify(filtered));
          } else {
            localStorage.removeItem(key);
          }
        }
      }
    }
    console.log(`🗑️ ${totalDeleted} mensajes antiguos eliminados (>${days} días) [web]`);
    return totalDeleted;
  } catch (e) {
    console.error("Error clearOldMessages Web:", e);
    return 0;
  }
};

// ─── QR SYNC: Importar mensajes recibidos desde móvil ───
export const importSyncedMessages = (roomId: string, messages: any[]): number => {
  try {
    const key = `chat_${roomId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const existingIds = new Set(existing.map((m: any) => m.msg_id));
    
    let imported = 0;
    for (const msg of messages) {
      if (!existingIds.has(msg.msg_id)) {
        existing.push(msg);
        imported++;
      }
    }
    
    // Ordenar por timestamp
    existing.sort((a: any, b: any) => a.timestamp - b.timestamp);
    localStorage.setItem(key, JSON.stringify(existing));
    return imported;
  } catch (e) {
    console.error("Error importSyncedMessages:", e);
    return 0;
  }
};

// ─── QR SYNC: Obtener todos los mensajes para sincronizar (web → se usa si web quiere enviar a móvil) ───
export const getMessagesForSync = (days: number = 30): { roomId: string; messages: any[] }[] => {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const results: { roomId: string; messages: any[] }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chat_')) {
        const roomId = key.replace('chat_', '');
        const all = JSON.parse(localStorage.getItem(key) || '[]');
        const recent = all.filter((m: any) => m.timestamp >= cutoff);
        if (recent.length > 0) results.push({ roomId, messages: recent });
      }
    }
    return results;
  } catch (e) {
    console.error("Error getMessagesForSync:", e);
    return [];
  }
};

const getAllMessages = (): any[] => {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('chat_'));
    return keys.flatMap((key) => JSON.parse(localStorage.getItem(key) || '[]').map(normalizeMessage));
  } catch (e) {
    console.error("Error getAllMessages Web:", e);
    return [];
  }
};

const getStoredEvents = (roomId?: string): any[] => {
  try {
    const items = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    return items
      .filter((item: any) => !roomId || String(item.roomId) === String(roomId))
      .map((item: any) => ({
        msg_id: `event:${item.id}`,
        ...item,
        text: item.title,
        timestamp: item.startsAt || item.createdAt,
        itemType: 'event',
        targetPanel: 'events',
        important: true,
      }));
  } catch {
    return [];
  }
};

const getStoredPolls = (roomId?: string): any[] => {
  try {
    const items = JSON.parse(localStorage.getItem(POLLS_KEY) || '[]');
    return items
      .filter((item: any) => !roomId || String(item.roomId) === String(roomId))
      .map((item: any) => ({
        msg_id: `poll:${item.id}`,
        ...item,
        text: item.question,
        timestamp: item.createdAt,
        itemType: 'poll',
        targetPanel: 'polls',
        important: true,
      }));
  } catch {
    return [];
  }
};

const getStoredPins = (roomId?: string): any[] => {
  try {
    const now = Date.now();
    return getAllPins()
      .filter((item: any) => (!roomId || String(item.roomId) === String(roomId)) && item.expiresAt > now)
      .map((item: any) => ({
        msg_id: item.msgId || `pin:${item.id}`,
        ...item,
        timestamp: item.pinnedAt,
        itemType: 'pin',
        targetPanel: item.msgId ? undefined : 'info',
        important: true,
      }));
  } catch {
    return [];
  }
};

export const getImportantMessages = (userId?: string): any[] => {
  return [
    ...getAllMessages().filter((message: any) => Boolean(message.important)),
    ...getStoredEvents(),
    ...getStoredPolls(),
    ...getStoredPins(),
  ]
    .filter((item: any) => !isImportantDismissed(userId, item.msg_id))
    .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const getFilesByRoom = (roomId: string): any[] => {
  return getMessagesByRoom(roomId).filter(isFileMessage);
};

export const searchMessagesAdvanced = (queryOrOptions: string | any): any[] => {
  const options = typeof queryOrOptions === 'string'
    ? { query: queryOrOptions }
    : (queryOrOptions || {});
  if (!String(options.query || '').trim() && !options.onlyImportant && !options.onlyFiles && !options.requiresAck && !options.threadTopic && !options.messageType) {
    return [];
  }
  return [
    ...getAllMessages(),
    ...getStoredEvents(options.roomId),
    ...getStoredPolls(options.roomId),
    ...getStoredPins(options.roomId),
  ]
    .filter((message: any) => matchMessageAgainstSearch(message, options))
    .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const saveRoomEventLocal = (event: any) => {
  try {
    const items = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    const next = {
      ...event,
      startsAt: event.startsAt ? new Date(event.startsAt).getTime() : Date.now(),
      createdAt: event.createdAt ? new Date(event.createdAt).getTime() : Date.now(),
      metadataIndex: buildMetadataIndex({
        text: event.title,
        roomName: event.roomName,
        senderName: event.createdByName,
        metadata: { description: event.description, kind: 'evento' },
        timestamp: event.startsAt || event.createdAt,
      }),
    };
    const index = items.findIndex((item: any) => item.id === event.id);
    if (index >= 0) items[index] = next;
    else items.push(next);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Error saveRoomEventLocal Web:", e);
  }
};

export const removeRoomEventLocal = (eventId: string) => {
  try {
    const items = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    localStorage.setItem(EVENTS_KEY, JSON.stringify(items.filter((item: any) => item.id !== eventId)));
  } catch (e) {
    console.error("Error removeRoomEventLocal Web:", e);
  }
};

export const saveRoomPollLocal = (poll: any) => {
  try {
    const items = JSON.parse(localStorage.getItem(POLLS_KEY) || '[]');
    const next = {
      ...poll,
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt).getTime() : null,
      closedAt: poll.closedAt ? new Date(poll.closedAt).getTime() : null,
      createdAt: poll.createdAt ? new Date(poll.createdAt).getTime() : Date.now(),
      metadataIndex: buildMetadataIndex({
        text: poll.question,
        roomName: poll.roomName,
        senderName: poll.createdByName,
        metadata: { options: (poll.options || []).map((item: any) => item.text || ''), kind: 'encuesta' },
        timestamp: poll.expiresAt || poll.createdAt,
      }),
    };
    const index = items.findIndex((item: any) => item.id === poll.id);
    if (index >= 0) items[index] = next;
    else items.push(next);
    localStorage.setItem(POLLS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Error saveRoomPollLocal Web:", e);
  }
};

export const dismissImportantItem = (itemId: string, userId?: string) => {
  if (!itemId || !userId) return;
  try {
    const all = getDismissedImportant();
    const next = Array.from(new Set([...(all[userId] || []), itemId]));
    localStorage.setItem(DISMISSED_IMPORTANT_KEY, JSON.stringify({ ...all, [userId]: next }));
  } catch (e) {
    console.error("Error dismissImportantItem Web:", e);
  }
};

export const removeRoomPollLocal = (pollId: string) => {
  try {
    const items = JSON.parse(localStorage.getItem(POLLS_KEY) || '[]');
    localStorage.setItem(POLLS_KEY, JSON.stringify(items.filter((item: any) => item.id !== pollId)));
  } catch (e) {
    console.error("Error removeRoomPollLocal Web:", e);
  }
};
