export type MessageSearchOptions = {
  query?: string;
  roomId?: string;
  roomIds?: string[];
  onlyImportant?: boolean;
  onlyFiles?: boolean;
  requiresAck?: boolean;
  threadTopic?: string | null;
  messageType?: string | null;
};

const buildDateFragments = (value: unknown) => {
  const timestamp = typeof value === 'number' ? value : Date.parse(String(value || ''));
  if (!timestamp || Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  return [
    date.toISOString(),
    date.toLocaleDateString('es-ES'),
    date.toLocaleString('es-ES'),
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  ].join(' ');
};

const IMPORTANT_TYPES = new Set(['announcement', 'required_read', 'assessable', 'urgent']);
const FILE_MEDIA_TYPES = new Set(['file', 'image', 'video']);

const ensureArray = (value: unknown) => Array.isArray(value) ? value : [];

const parseJsonSafely = (value: unknown, fallback: any) => {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const isImportantMessage = (message: any): boolean => {
  if (!message) return false;
  if (message.important === true || message.important === 1) return true;
  if (IMPORTANT_TYPES.has(String(message.messageType || ''))) return true;
  return Boolean(message.metadata?.important);
};

export const isFileMessage = (message: any): boolean => {
  if (!message) return false;
  if (FILE_MEDIA_TYPES.has(String(message.mediaType || ''))) return true;
  if (message.image) return true;
  if (String(message.mimeType || '').startsWith('image/')) return true;
  if (String(message.mimeType || '').startsWith('video/')) return true;
  if (message.fileName) return true;
  return /^https?:\/\//i.test(String(message.text || ''));
};

export const getFileCategory = (message: any): 'image' | 'video' | 'link' | 'file' | 'other' => {
  if (!message) return 'other';
  if (/^https?:\/\//i.test(String(message.text || ''))) return 'link';
  if (message.mediaType === 'image' || String(message.mimeType || '').startsWith('image/')) return 'image';
  if (message.mediaType === 'video' || String(message.mimeType || '').startsWith('video/')) return 'video';
  if (message.mediaType === 'file' || message.fileName) return 'file';
  return 'other';
};

export const buildMetadataIndex = (message: any): string => {
  if (!message) return '';
  const metadata = message.metadata && typeof message.metadata === 'object'
    ? Object.values(message.metadata).join(' ')
    : String(message.metadata || '');

  return [
    message.text,
    message.contenido,
    message.senderName,
    message.roomName,
    message.fileName,
    message.threadTopic,
    message.messageType,
    metadata,
    buildDateFragments(message.timestamp || message.startsAt || message.pinnedAt || message.expiresAt || message.expiresAt),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

export const normalizeMessage = (raw: any) => {
  const metadata = parseJsonSafely(raw?.metadata, {});
  const reactions = ensureArray(parseJsonSafely(raw?.reactions, []));
  const replyTo = parseJsonSafely(raw?.replyTo, null);
  const ackReaders = ensureArray(parseJsonSafely(raw?.ackReaders, []));
  const important = isImportantMessage({ ...raw, metadata });
  const text = raw?.text ?? raw?.contenido ?? '';

  return {
    ...raw,
    text,
    contenido: raw?.contenido ?? text,
    roomName: raw?.roomName || metadata?.roomName || null,
    senderName: raw?.senderName || raw?.nombreEmisor || 'Usuario',
    metadata,
    reactions,
    replyTo,
    ackReaders,
    requiresAck: Boolean(raw?.requiresAck),
    important,
    status: raw?.status || (raw?.readByRecipient ? 'read' : raw?.delivered ? 'delivered' : raw?.isMe ? 'sent' : undefined),
    delivered: raw?.delivered === true || raw?.delivered === 1,
    readByRecipient: raw?.readByRecipient === true || raw?.readByRecipient === 1,
    metadataIndex: raw?.metadataIndex || buildMetadataIndex({ ...raw, text, metadata }),
  };
};

export const prepareMessageForStorage = (raw: any) => {
  const normalized = normalizeMessage(raw);
  return {
    ...normalized,
    reactions: JSON.stringify(normalized.reactions || []),
    replyTo: normalized.replyTo ? JSON.stringify(normalized.replyTo) : null,
    metadata: normalized.metadata ? JSON.stringify(normalized.metadata) : null,
    ackReaders: JSON.stringify(normalized.ackReaders || []),
    important: normalized.important ? 1 : 0,
    metadataIndex: normalized.metadataIndex || '',
  };
};

export const matchMessageAgainstSearch = (message: any, options: MessageSearchOptions) => {
  const normalized = normalizeMessage(message);
  const query = (options.query || '').trim().toLowerCase();

  if (options.roomId && String(normalized.roomId) !== String(options.roomId)) return false;
  if (options.roomIds?.length && !options.roomIds.some((roomId) => String(roomId) === String(normalized.roomId))) return false;
  if (options.onlyImportant && !normalized.important) return false;
  if (options.onlyFiles && !isFileMessage(normalized)) return false;
  if (options.requiresAck && !normalized.requiresAck) return false;
  if (options.threadTopic && normalized.threadTopic !== options.threadTopic) return false;
  if (options.messageType && normalized.messageType !== options.messageType) return false;

  if (!query) return true;
  return (normalized.metadataIndex || buildMetadataIndex(normalized)).includes(query);
};

export const searchMessages = (messages: any[], options: MessageSearchOptions) => {
  return messages
    .map(normalizeMessage)
    .filter((message) => matchMessageAgainstSearch(message, options))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};
