import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, TextInput, TouchableOpacity, Text,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Modal, Dimensions, useWindowDimensions, TouchableWithoutFeedback, ScrollView
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
import { router, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { styles } from './chat.styles';
import {
  getMessagesByRoom,
  saveMessageLocal,
  updateMessageLocal,
  saveDraftLocal,
  getDraftLocal,
  markMessagesAsRead,
  updateMessageAckReaders,
  toggleReactionFn,
  savePinnedMessage,
  saveRoomEventLocal,
  saveRoomPollLocal,
  removeRoomEventLocal,
  removeRoomPollLocal,
  getPinnedMessagesByRoom,
  removePinnedMessage,
  cleanExpiredPins
} from '../../db/database';
import { useSocket } from '../../context/SocketContext';
import { ChatInfoScreen } from './ChatInfoScreen';
import { ReactionPicker } from './ReactionPicker';
import { MentionDropdown, MentionCandidate } from './MentionDropdown';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown, Copy, Smile, CornerUpLeft, X, FileText, Pin, Download, CalendarDays, ListChecks, AtSign } from 'lucide-react-native';
import { Alert, Linking } from 'react-native';
import { decodeJwt } from '../../utils/auth';
import { PinWizardModal, PinnedMessagesBanner } from './PinComponents';
import { useTheme } from '../../context/ThemeContext';
import {
  closePollRequest,
  createRoomEventRequest,
  createRoomPollRequest,
  deletePollRequest,
  deleteRoomEventRequest,
  fetchRoomEvents,
  fetchRoomPins,
  fetchRoomPolls,
  fetchRoomPresence,
  votePollRequest,
} from '../../services/chatExtras.service';
import { buildMentionsPayload, messageMentionsCurrentUser } from '../../utils/mentions';

const API_URL = "https://tuchat-pl9.onrender.com";
const DEFAULT_INPUT_EMOJIS = [
  String.fromCodePoint(0x1F600), // 😀
  String.fromCodePoint(0x1F602), // 😂
  String.fromCodePoint(0x1F60D), // 😍
  String.fromCodePoint(0x1F44D), // 👍
  String.fromCodePoint(0x1F64F), // 🙏
  String.fromCodePoint(0x1F389), // 🎉
  String.fromCodePoint(0x1F525), // 🔥
  '\u2764\uFE0F',                // ❤️
  String.fromCodePoint(0x2705),  // ✅
  String.fromCodePoint(0x1F914), // 🤔
  String.fromCodePoint(0x1F44F), // 👏
  String.fromCodePoint(0x1F60E), // 😎
];

const PRESENCE_META: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: '#16A34A' },
  in_class: { label: 'En clase', color: '#2563EB' },
  busy: { label: 'Ocupado', color: '#EA580C' },
  offline: { label: 'Desconectado', color: '#94A3B8' },
};

const TEACHER_MESSAGE_TYPES = [
  { id: 'announcement', label: 'Anuncio oficial' },
  { id: 'required_read', label: 'Obligatorio leer' },
  { id: 'assessable', label: 'Material evaluable' },
  { id: 'urgent', label: 'Cambio urgente' },
] as const;

const THREAD_TOPICS = ['General', 'Examen', 'Tarea', 'Dudas', 'Material'] as const;
const CONVERSATION_FILTERS = ['Todos', 'Importantes', 'Checker', 'Menciones', 'Encuestas', 'Eventos'] as const;

const normalizeEmojiValue = (candidate: unknown): string | null => {
  if (typeof candidate !== 'string') return null;
  const value = candidate.trim();
  if (!value || value.length > 8) return null;
  if (/^U\+/i.test(value)) return null;
  if (/^[A-Za-z0-9_:-]+$/.test(value)) return null;
  return value;
};

const extractEmojiList = (payload: unknown): string[] => {
  const collected: string[] = [];

  const push = (value: unknown) => {
    const normalized = normalizeEmojiValue(value);
    if (normalized) collected.push(normalized);
  };

  const parseItem = (item: unknown) => {
    if (typeof item === 'string') {
      push(item);
      return;
    }

    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      push(record.emoji);
      push(record.character);
      push(record.symbol);
      push(record.char);
      push(record.value);
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach(parseItem);
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.emojis)) {
      record.emojis.forEach(parseItem);
    } else {
      Object.values(record).forEach(parseItem);
    }
  }

  return Array.from(new Set(collected));
};

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDateTimeLocalValue = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatDateTimeLocal(parsed);
};

// ─── FILE HELPERS ────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const getFileIcon = (fileName: string, mimeType?: string): { icon: string; color: string; label: string } => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const mime = (mimeType || '').toLowerCase();
  // icon = SVG path d attribute for each file type
  const pdf = "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zM14 4v5h5M9 13h2v4H9v-4zm4 0h1a1 1 0 011 1v0a1 1 0 01-1 1h-1v2m-6-4h1.5a1.5 1.5 0 010 3H7";
  const doc = "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zM14 4v5h5M9 13h6M9 17h4";
  const xls = "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zM14 4v5h5M9 13l3 4m0-4l-3 4";
  const ppt = "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zM14 4v5h5M9 17v-4h2a2 2 0 010 4H9";
  const zip = "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zM14 4v5h5M10 12h1m-1 2h1m-1 2h1";
  const audio = "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z";
  const txt = "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zM14 4v5h5M9 13h6M9 17h6M9 9h1";
  const code = "M16 18l6-6-6-6M8 6l-6 6 6 6";
  const clip = "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48";

  if (['pdf'].includes(ext) || mime.includes('pdf')) return { icon: pdf, color: '#DC2626', label: 'PDF' };
  if (['doc', 'docx'].includes(ext) || mime.includes('word')) return { icon: doc, color: '#2563EB', label: 'DOC' };
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) return { icon: xls, color: '#16A34A', label: 'XLS' };
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation')) return { icon: ppt, color: '#EA580C', label: 'PPT' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return { icon: zip, color: '#7C3AED', label: 'ZIP' };
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext) || mime.includes('audio')) return { icon: audio, color: '#0891B2', label: 'AUDIO' };
  if (['txt', 'md', 'rtf'].includes(ext) || mime.includes('text/plain')) return { icon: txt, color: '#64748B', label: 'TXT' };
  if (['json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java'].includes(ext)) return { icon: code, color: '#475569', label: 'CODE' };
  return { icon: clip, color: '#64748B', label: 'FILE' };
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const inferMediaType = (fileName?: string, mimeType?: string): 'image' | 'video' | 'file' => {
  const mime = (mimeType || '').toLowerCase();
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video';

  return 'file';
};

const fileToBase64Web = (uri: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (e) { reject(e); }
  });
};

const fileToBase64Native = async (uri: string, mimeType: string): Promise<string> => {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: (FileSystem as any).EncodingType.Base64 });
  return `data:${mimeType || 'application/octet-stream'};base64,${b64}`;
};

// --- ICONOS SVG ---
const ChevronLeftIcon = ({ color = '#1e293b' }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: 24, height: 24 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </Svg>
);

const PhoneIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 22, height: 22 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
  </Svg>
);

const VideoIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 22, height: 22 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
  </Svg>
);

const InfoIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 22, height: 22 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </Svg>
);

const PaperclipIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#64748b" style={{ width: 22, height: 22 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
  </Svg>
);

const SendIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </Svg>
);

const SmileyIcon = ({ color = '#64748b' }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm6 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Z" />
  </Svg>
);

// Componente de doble tick
const MessageTick = ({ status }: { status: 'sending' | 'retrying' | 'sent' | 'delivered' | 'read' | 'failed' }) => {
  if (status === 'sending' || status === 'retrying') {
    return (
      <Svg viewBox="0 0 12 12" width={12} height={12} fill="none">
        <Path d="M6 12A6 6 0 1 0 6 0a6 6 0 0 0 0 12Zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" fill="rgba(255,255,255,0.5)" />
      </Svg>
    );
  }

  if (status === 'failed') {
    return (
      <Svg viewBox="0 0 12 12" width={12} height={12} fill="none">
        <Path d="M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1Zm0 2.1a.8.8 0 0 0-.8.8v2.4a.8.8 0 1 0 1.6 0V3.9A.8.8 0 0 0 6 3.1Zm0 5.8a.95.95 0 1 0 0-1.9.95.95 0 0 0 0 1.9Z" fill="#F87171" />
      </Svg>
    );
  }

  const color = status === 'read' ? '#34B7F1' : 'rgba(255,255,255,0.7)';

  if (status === 'sent') {
    return (
      <Svg viewBox="0 0 16 11" width={16} height={11} fill="none">
        <Path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.32-.143.462.462 0 0 0-.312.106l-.311.296a.455.455 0 0 0-.14.337c0 .136.047.25.14.337l2.996 2.996a.497.497 0 0 0 .501.14.493.493 0 0 0 .39-.28l6.846-8.932a.485.485 0 0 0-.063-.577l-.417-.32Z" fill={color} />
      </Svg>
    );
  }

  // delivered o read - doble tick
  return (
    <Svg viewBox="0 0 16 11" width={16} height={11} fill="none">
      <Path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.32-.143.462.462 0 0 0-.312.106l-.311.296a.455.455 0 0 0-.14.337c0 .136.047.25.14.337l2.996 2.996a.497.497 0 0 0 .501.14.493.493 0 0 0 .39-.28l6.846-8.932a.485.485 0 0 0-.063-.577l-.417-.32Z" fill={color} />
      <Path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.405-1.328-.696.9 2.076 2.076a.497.497 0 0 0 .501.14.493.493 0 0 0 .39-.28l6.846-8.932a.485.485 0 0 0-.063-.577l-.417-.32Z" fill={color} />
    </Svg>
  );
};

interface ChatScreenProps {
  id: string;
  nombre: string;
  tipo?: string;
  esProfesor?: boolean;
  targetMsgId?: string;
  targetPanel?: 'events' | 'polls' | 'mentions' | 'info';
  isEmbedded?: boolean;
  onBack?: () => void;
}

export const ChatScreen = ({ id, nombre, tipo = 'grupo', esProfesor: esProfesorProp = false, targetMsgId, targetPanel, isEmbedded = false, onBack }: ChatScreenProps) => {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [myUserId, setMyUserId] = useState("");
  const myUserIdRef = useRef(""); // Ref to always have current value in socket closures
  const [myUserName, setMyUserName] = useState("Usuario");
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const [esProfesor, setEsProfesor] = useState(esProfesorProp);
  const [loading, setLoading] = useState(true);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [messageToPin, setMessageToPin] = useState<any>(null);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [miembros, setMiembros] = useState<string[]>([]);
  const [memberDetails, setMemberDetails] = useState<any[]>([]);
  const [delegados, setDelegados] = useState<string[]>([]); // Delegados del chat
  const [presenceByUser, setPresenceByUser] = useState<Record<string, any>>({});
  const [myPresenceStatus, setMyPresenceStatus] = useState<'available' | 'in_class' | 'busy'>('available');
  const [events, setEvents] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [showExtrasPanel, setShowExtrasPanel] = useState<'events' | 'polls' | 'mentions' | 'threads' | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollExpiry, setPollExpiry] = useState('');
  const [typingUserName, setTypingUserName] = useState<string | null>(null);
  const [selectedThreadTopic, setSelectedThreadTopic] = useState<string>('General');
  const [teacherMessageType, setTeacherMessageType] = useState<string | null>(null);
  const [requiresAck, setRequiresAck] = useState(false);
  const [showComposerMeta, setShowComposerMeta] = useState(false);
  const [activeThreadFilter, setActiveThreadFilter] = useState<string>('Todos');
  const [showThreadFilterMenu, setShowThreadFilterMenu] = useState(false);
  const [expandedCheckerInfoId, setExpandedCheckerInfoId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pendingScrollTargetRef = useRef<string | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const inputRef = useRef<TextInput>(null); // New ref for input
  const typingTimeoutRef = useRef<any>(null);
  const hasScrolledToTargetRef = useRef(false);
  const messageAckTimeoutsRef = useRef<Record<string, any>>({});
  const autoRetriedOnConnectRef = useRef(false);

  // States for Reactions
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null); // For touch/click
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null); // New state for reply
  const [inputEmojis, setInputEmojis] = useState<string[]>(DEFAULT_INPUT_EMOJIS);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setOpenMenuId(null);
  };

  const handleInsertEmoji = (emoji: string) => {
    const next = `${input}${emoji}`;
    setInput(next);
    saveDraftLocal(id, next);
  };

  const { socket, refreshUnreadCounts, setActiveRoom, isConnected } = useSocket();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  };

  const applyMessagePatch = useCallback((msgId: string, patch: any) => {
    if (['sent', 'delivered', 'read', 'failed'].includes(String(patch?.status || ''))) {
      const timeout = messageAckTimeoutsRef.current[msgId];
      if (timeout) {
        clearTimeout(timeout);
        delete messageAckTimeoutsRef.current[msgId];
      }
    }
    setMessages((prev) => prev.map((message) => (
      message.msg_id === msgId ? { ...message, ...patch } : message
    )));
    if (typeof updateMessageLocal === 'function') updateMessageLocal(msgId, patch);
  }, []);

  const scheduleFailedMessage = useCallback((msgId: string) => {
    const previous = messageAckTimeoutsRef.current[msgId];
    if (previous) clearTimeout(previous);
    messageAckTimeoutsRef.current[msgId] = setTimeout(() => {
      applyMessagePatch(msgId, { status: 'failed' });
    }, 8000);
  }, [applyMessagePatch]);

  const emitChatMessage = useCallback((message: any) => {
    if (!socket) {
      applyMessagePatch(message.msg_id, { status: 'failed' });
      return;
    }

    scheduleFailedMessage(message.msg_id);
    socket.emit(message.image ? "chat:send_media" : "chat:send", message, (ack: any) => {
      if (ack?.ok) {
        applyMessagePatch(message.msg_id, { status: 'sent' });
        return;
      }
      applyMessagePatch(message.msg_id, { status: 'failed' });
    });
  }, [socket, applyMessagePatch, scheduleFailedMessage]);

  const reconcilePersistedStatuses = useCallback((statuses: any[] = []) => {
    if (!Array.isArray(statuses) || statuses.length === 0) return;
    const statusMap = new Map(statuses.map((item) => [String(item.msg_id), item]));

    setMessages((prev) => prev.map((message) => {
      const persisted = statusMap.get(String(message.msg_id));
      if (!persisted) return message;
      return {
        ...message,
        status: persisted.status,
        delivered: persisted.delivered,
        readByRecipient: persisted.read,
      };
    }));

    statuses.forEach((item) => {
      if (typeof updateMessageLocal === 'function') {
        updateMessageLocal(String(item.msg_id), {
          status: item.status,
          delivered: item.delivered,
          readByRecipient: item.read,
        });
      }
    });
  }, []);

  // Calcular si el usuario puede fijar mensajes (profesor O delegado)
  const canPin = esProfesor || delegados.includes(myUserId);
  const canManageExtras = canPin;

  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [id]);

  useEffect(() => {
    return () => {
      Object.values(messageAckTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
      messageAckTimeoutsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (loading || messages.length === 0 || hasAutoScrolledRef.current) return;
    hasAutoScrolledRef.current = true;
    const timer = setTimeout(() => scrollToBottom(false), 80);
    return () => clearTimeout(timer);
  }, [loading, messages.length]);

  useEffect(() => {
    let cancelled = false;

    const loadInputEmojis = async () => {
      try {
        const token = Platform.OS === 'web'
          ? localStorage.getItem('token')
          : await SecureStore.getItemAsync('token');
        const response = await fetch(`${API_URL}/chat/emojis`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error(`Emoji API status ${response.status}`);

        const payload: any = await response.json();
        const emojiPayload: unknown = payload?.emojis ?? payload;
        const fromApi = extractEmojiList(emojiPayload);

        if (!cancelled && fromApi.length >= 5) {
          setInputEmojis(fromApi.slice(0, 42));
        }
      } catch {
        // Fallback silencioso: mantenemos emojis locales por defecto
      }
    };

    loadInputEmojis();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const setup = async () => {
      try {
        let currentUserId = '';
        const token = Platform.OS === 'web'
          ? localStorage.getItem('token')
          : await SecureStore.getItemAsync('token');

        if (token) {
          const decoded = decodeJwt(token);
          const uid = decoded?.sub;
          currentUserId = String(uid || '');
          setMyUserId(uid);
          myUserIdRef.current = uid; // Keep ref in sync

          const userDataStr = Platform.OS === 'web'
            ? localStorage.getItem('usuario')
            : await SecureStore.getItemAsync('usuario');

          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            setMyUserName(userData.nombre || "Usuario");
            const esProfessorUsuario = 
            userData.tipo === 'PROFESOR' || 
            userData.tipo_externo === 'PROFESOR' || 
            userData.id_rol === 2 ||
            userData.esProfesor === true;

          setEsProfesor(esProfessorUsuario);
          console.log("👨‍🏫 ChatScreen detectó Rol:", {
            tipo: userData.tipo,
            id_rol: userData.id_rol,
            resultado: esProfessorUsuario
          });
        }

          const response = await axios.get(`${API_URL}/academico/miembros/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.ok) setMiembros(response.data.ids || []);

          try {
            const detailResponse = await axios.get(`${API_URL}/academico/miembros-detalle/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (detailResponse.data.ok) {
              setMemberDetails(detailResponse.data.usuarios || []);
              setDelegados(detailResponse.data.config?.delegados || []);
            }
          } catch (e) {
            console.log("âš ï¸ No se pudieron cargar detalles de miembros:", e);
          }

          // Fetch chat settings to get delegates (safe - won't break if endpoint unavailable)
          try {
            const settingsResponse = await axios.get(`${API_URL}/chat/settings/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (settingsResponse.data.ok) {
              setDelegados(settingsResponse.data.settings?.delegados || []);
            }
          } catch (e) {
            console.log("⚠️ No se pudieron cargar los delegados:", e);
          }
          try {
            const [presenceData, eventsData, pollsData, pinsData] = await Promise.all([
              fetchRoomPresence(id),
              fetchRoomEvents(id),
              fetchRoomPolls(id),
              fetchRoomPins(id),
            ]);
            setPresenceByUser(Object.fromEntries((presenceData || []).map((entry: any) => [String(entry.userId), entry])));
            setEvents(eventsData || []);
            setPolls(pollsData || []);
            setPinnedMessages(pinsData || []);
            if (typeof saveRoomEventLocal === 'function') {
              (eventsData || []).forEach((event: any) => saveRoomEventLocal({ ...event, roomId: id, roomName: nombre }));
            }
            if (typeof saveRoomPollLocal === 'function') {
              (pollsData || []).forEach((poll: any) => saveRoomPollLocal({ ...poll, roomId: id, roomName: nombre }));
            }
            if (typeof cleanExpiredPins === 'function') cleanExpiredPins();
            if (typeof savePinnedMessage === 'function') {
              (pinsData || []).forEach((pin: any) => savePinnedMessage(pin));
            }
          } catch (e) {
            console.log("No se pudieron cargar extras del chat:", e);
            if (typeof cleanExpiredPins === 'function') cleanExpiredPins();
            if (typeof getPinnedMessagesByRoom === 'function') {
              const loadedPins = getPinnedMessagesByRoom(id);
              setPinnedMessages(loadedPins);
            }
          }

          try {
            const privacyResponse = await axios.get(`${API_URL}/auth/read-receipts-preference`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (privacyResponse.data?.ok) {
              setReadReceiptsEnabled(Boolean(privacyResponse.data.confirmaciones_lectura_activas));
            }
          } catch (e) {
            console.log("No se pudo cargar la preferencia de lectura:", e);
          }
        }

        const localMessages = typeof getMessagesByRoom === 'function' ? getMessagesByRoom(id) : [];
        setMessages(localMessages);
        setInput(typeof getDraftLocal === 'function' ? getDraftLocal(id) : '');
        if (typeof markMessagesAsRead === 'function') markMessagesAsRead(id);
        refreshUnreadCounts();

        if (socket) {
          socket.emit("join_room", id);
          localMessages
            .filter((message: any) => String(message.senderId || '') !== currentUserId && !message.read)
            .forEach((message: any) => {
              if (readReceiptsEnabled) {
                socket.emit("chat:read_receipt", { msg_id: message.msg_id, roomId: id, userId: currentUserId });
              }
            });
        }

        if (token && localMessages.length > 0) {
          try {
            const statusResponse = await axios.post(`${API_URL}/mensajes/estados`, {
              roomId: id,
              msgIds: localMessages.map((message: any) => String(message.msg_id)).filter(Boolean),
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (statusResponse.data?.ok) {
              reconcilePersistedStatuses(statusResponse.data.statuses || []);
            }
          } catch (e) {
            console.log("No se pudieron sincronizar estados persistidos:", e);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error en setup del Chat:', error);
        setLoading(false);
      }
    };
    setup();
  }, [id, socket, reconcilePersistedStatuses, readReceiptsEnabled]);

  useFocusEffect(
    useCallback(() => {
      if (typeof markMessagesAsRead === 'function') markMessagesAsRead(id);
      refreshUnreadCounts();
      setActiveRoom(id);
      if (readReceiptsEnabled) {
        messages
          .filter((message) => String(message.senderId || '') !== String(myUserIdRef.current || '') && !message.read)
          .forEach((message) => {
            socket?.emit("chat:read_receipt", { msg_id: message.msg_id, roomId: id, userId: myUserIdRef.current });
          });
      }
      return () => setActiveRoom(null);
    }, [id, messages, socket, readReceiptsEnabled])
  );

  useEffect(() => {
    if (!socket) return;
    socket.emit("presence:set_status", { status: myPresenceStatus });
  }, [socket, myPresenceStatus]);

  useEffect(() => {
    if (!targetPanel) return;
    if (targetPanel === 'info') {
      setShowInfo(true);
      return;
    }
    setShowExtrasPanel(targetPanel);
  }, [targetPanel]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      if (msg.roomId === id) {
        setMessages(prev => {
          const existing = prev.find(m => m.msg_id === msg.msg_id);
          // Si el mensaje ya existe (enviado por nosotros optimisticamente), actualizar su estado a 'sent'
          if (existing) {
            if (existing.status === 'sending') {
              if (typeof updateMessageLocal === 'function') updateMessageLocal(msg.msg_id, { status: 'sent' });
              return prev.map(m =>
                m.msg_id === msg.msg_id ? { ...m, status: 'sent' } : m
              );
            }
            return prev;
          }
          const newMessages = [...prev, msg];
          setTimeout(() => {
            if (typeof markMessagesAsRead === 'function') markMessagesAsRead(id);
            refreshUnreadCounts();
            if (msg.senderId !== myUserId && readReceiptsEnabled) {
              socket.emit("chat:read_receipt", { msg_id: msg.msg_id, roomId: id, userId: myUserId });
            }
          }, 100);
          return newMessages;
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    // Evento explícito del servidor confirmando que recibió el mensaje
    const handleMsgSent = ({ msg_id }: { msg_id: string }) => {
      applyMessagePatch(msg_id, { status: 'sent' });
    };

    // Evento del servidor confirmando que el mensaje fue entregado a todos (2 ticks grises)
    const handleDelivered = ({ msg_id }: { msg_id: string }) => {
      applyMessagePatch(msg_id, { status: 'delivered', delivered: true });
    };

    const handleReadReceipt = ({ msg_id }: { msg_id: string }) => {
      applyMessagePatch(msg_id, { status: 'read', read: true, readByRecipient: true, delivered: true });
    };

    const handleIncomingReaction = ({ msgId, reaction }: { msgId: string, reaction: any }) => {
      if (String(reaction.userId) === String(myUserIdRef.current)) return;

      setMessages(prev => prev.map(m => {
        if (m.msg_id === msgId) {
          let reactions = m.reactions ? [...m.reactions] : [];
          const existingIndex = reactions.findIndex((r: any) => String(r.userId) === String(reaction.userId));
          if (existingIndex >= 0) {
            if (reactions[existingIndex].emoji === reaction.emoji) {
              reactions.splice(existingIndex, 1);
            } else {
              reactions[existingIndex] = reaction;
            }
          } else {
            reactions.push(reaction);
          }
          return { ...m, reactions };
        }
        return m;
      }));
      // Update local DB
      if (typeof toggleReactionFn === 'function') toggleReactionFn(msgId, reaction);
    };

    const handleIncomingPin = (pinData: any) => {
      console.log('📌 Pin recibido:', pinData);
      const newPin = {
        id: pinData.id || `pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        roomId: pinData.roomId || id,
        msgId: pinData.msgId || pinData.messageId,
        text: pinData.text || pinData.contenido || 'Archivo adjunto',
        senderName: pinData.senderName || 'Profesor',
        category: pinData.category,
        color: pinData.color,
        duration: pinData.duration,
        durationLabel: pinData.durationLabel,
        pinnedAt: pinData.pinnedAt || Date.now(),
        expiresAt: pinData.expiresAt || (Date.now() + pinData.duration),
      };
      setPinnedMessages(prev => {
        if (prev.some(pin => pin.id === newPin.id || pin.msgId === newPin.msgId)) return prev;
        return [newPin, ...prev];
      });
      if (typeof savePinnedMessage === 'function') savePinnedMessage(newPin);
    };

    const handleUnpin = (data: any) => {
      console.log('📌 Unpin recibido:', data);
      setPinnedMessages(prev => prev.filter(p => p.msgId !== data.messageId));
    };

    const handlePresenceUpdate = (presence: any) => {
      if (!presence?.userId) return;
      setPresenceByUser(prev => ({ ...prev, [String(presence.userId)]: presence }));
    };

    const handleEventCreated = (event: any) => {
      if (String(event?.roomId) !== String(id)) return;
      if (typeof saveRoomEventLocal === 'function') saveRoomEventLocal({ ...event, roomName: nombre });
      setEvents(prev => {
        if (prev.some(item => item.id === event.id)) return prev;
        return [...prev, event].sort((a, b) => a.startsAt - b.startsAt);
      });
    };

    const handlePollCreated = (poll: any) => {
      if (String(poll?.roomId) !== String(id)) return;
      if (typeof saveRoomPollLocal === 'function') saveRoomPollLocal({ ...poll, roomName: nombre });
      setPolls(prev => {
        if (prev.some(item => item.id === poll.id)) return prev;
        return [poll, ...prev];
      });
    };

    const handlePollUpdated = (poll: any) => {
      if (String(poll?.roomId) !== String(id)) return;
      if (typeof saveRoomPollLocal === 'function') saveRoomPollLocal({ ...poll, roomName: nombre });
      setPolls(prev => prev.map(item => item.id === poll.id ? poll : item));
    };

    const handleEventDeleted = ({ eventId }: { eventId: string }) => {
      if (typeof removeRoomEventLocal === 'function') removeRoomEventLocal(eventId);
      setEvents(prev => prev.filter(item => item.id !== eventId));
    };

    const handlePollDeleted = ({ pollId }: { pollId: string }) => {
      if (typeof removeRoomPollLocal === 'function') removeRoomPollLocal(pollId);
      setPolls(prev => prev.filter(item => item.id !== pollId));
    };

    const handleTyping = ({ userName }: { userName: string }) => {
      setTypingUserName(userName || 'Alguien');
    };

    const handleStopTyping = () => {
      setTypingUserName(null);
    };

    const handleStrongRead = ({ msg_id, reader }: { msg_id: string; reader: any }) => {
      setMessages(prev => prev.map(message => {
        if (message.msg_id !== msg_id) return message;
        const currentReaders = Array.isArray(message.ackReaders) ? message.ackReaders : [];
        if (currentReaders.some((item: any) => String(item.userId) === String(reader.userId))) {
          return message;
        }
        const nextReaders = [...currentReaders, reader];
        if (typeof updateMessageAckReaders === 'function') updateMessageAckReaders(msg_id, nextReaders);
        return { ...message, ackReaders: nextReaders };
      }));
    };

    socket.on("chat:receive", handleNewMessage);
    socket.on("chat:msg_sent", handleMsgSent);
    socket.on("chat:update_delivered_status", handleDelivered);
    socket.on("chat:update_read_status", handleReadReceipt);
    socket.on("chat:reaction", handleIncomingReaction);
    socket.on("chat:receive_pin", handleIncomingPin);
    socket.on("chat:receive_unpin", handleUnpin);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("chat:event_created", handleEventCreated);
    socket.on("chat:poll_created", handlePollCreated);
    socket.on("chat:poll_updated", handlePollUpdated);
    socket.on("chat:event_deleted", handleEventDeleted);
    socket.on("chat:poll_deleted", handlePollDeleted);
    socket.on("chat:user_typing", handleTyping);
    socket.on("chat:user_stopped_typing", handleStopTyping);
    socket.on("chat:update_strong_read", handleStrongRead);

    return () => {
      socket.off("chat:receive", handleNewMessage);
      socket.off("chat:msg_sent", handleMsgSent);
      socket.off("chat:update_delivered_status", handleDelivered);
      socket.off("chat:update_read_status", handleReadReceipt);
      socket.off("chat:reaction", handleIncomingReaction);
      socket.off("chat:receive_pin", handleIncomingPin);
      socket.off("chat:receive_unpin", handleUnpin);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("chat:event_created", handleEventCreated);
      socket.off("chat:poll_created", handlePollCreated);
      socket.off("chat:poll_updated", handlePollUpdated);
      socket.off("chat:event_deleted", handleEventDeleted);
      socket.off("chat:poll_deleted", handlePollDeleted);
      socket.off("chat:user_typing", handleTyping);
      socket.off("chat:user_stopped_typing", handleStopTyping);
      socket.off("chat:update_strong_read", handleStrongRead);
    };
  }, [socket, id, refreshUnreadCounts, myUserId, applyMessagePatch, readReceiptsEnabled]);

  const handleReaction = (msgId: string, emoji: string) => {
    const reaction = { emoji, userId: myUserId };

    // 1. Optimistic Update
    setMessages(prev => prev.map(m => {
      if (m.msg_id === msgId) {
        let reactions = m.reactions ? [...m.reactions] : [];
        const existingIndex = reactions.findIndex((r: any) => r.userId === myUserId);
        if (existingIndex >= 0) {
          if (reactions[existingIndex].emoji === emoji) {
            reactions.splice(existingIndex, 1); // Remove toggle
          } else {
            reactions[existingIndex] = reaction; // Update
          }
        } else {
          reactions.push(reaction); // Add
        }
        return { ...m, reactions };
      }
      return m;
    }));

    // Update local DB
    if (typeof toggleReactionFn === 'function') toggleReactionFn(msgId, reaction);
    setShowReactionPicker(null);
    setShowInputEmojiPicker(false);

    // 3. Socket
    if (socket) {
      socket.emit("chat:reaction", { roomId: id, msgId, reaction, recipients: miembros });
    }
  };

  const handleBack = () => {
    if (isEmbedded && onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const iniciarLlamada = (tipoLlamada: 'audio' | 'video') => {
    router.push({
      pathname: "/llamada" as any,
      params: { type: tipoLlamada, from: myUserId, roomId: id }
    });
  };

  const quickMention = (token: string) => {
    const next = `${input}${token}`;
    setInput(next);
    saveDraftLocal(id, next);
    setShowInputEmojiPicker(false);
    inputRef.current?.focus();
  };

  // --- Mention autocomplete logic ---
  const normalizeMention = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const detectMentionQuery = (text: string): string | null => {
    // Find the last '@' that is either at position 0 or preceded by a space
    const lastAt = text.lastIndexOf('@');
    if (lastAt < 0) return null;
    if (lastAt > 0 && text[lastAt - 1] !== ' ' && text[lastAt - 1] !== '\n') return null;
    const afterAt = text.substring(lastAt + 1);
    // If there's a space after the query started, the mention is "closed"
    if (afterAt.includes(' ')) return null;
    return afterAt;
  };

  const updateMentionCandidates = (text: string) => {
    const query = detectMentionQuery(text);
    setMentionQuery(query);
    if (query === null) {
      setMentionCandidates([]);
      return;
    }
    const normalizedQuery = normalizeMention(query);
    const specialOptions: MentionCandidate[] = [
      { id: '__todos__', nombre: 'todos' },
      { id: '__delegados__', nombre: 'delegados' },
      { id: '__profesor__', nombre: 'profesor' },
    ];
    const allCandidates = [
      ...specialOptions,
      ...memberDetails
        .filter((m: any) => m.id !== myUserId)
        .map((m: any) => ({ id: String(m.id), nombre: m.nombre || 'Usuario', es_profesor: m.es_profesor })),
    ];
    if (normalizedQuery === '') {
      setMentionCandidates(allCandidates.slice(0, 6));
    } else {
      const filtered = allCandidates.filter((c) =>
        normalizeMention(c.nombre).includes(normalizedQuery)
      );
      setMentionCandidates(filtered.slice(0, 6));
    }
  };

  const handleMentionSelect = (member: MentionCandidate) => {
    const query = mentionQuery ?? '';
    const lastAt = input.lastIndexOf('@');
    if (lastAt < 0) return;
    const before = input.substring(0, lastAt);
    const mentionText = member.nombre.includes(' ')
      ? member.nombre.split(' ')[0]
      : member.nombre;
    const next = `${before}@${mentionText} `;
    setInput(next);
    saveDraftLocal(id, next);
    setMentionQuery(null);
    setMentionCandidates([]);
    inputRef.current?.focus();
  };

  const emitTyping = (text: string) => {
    if (!socket) return;
    if (text.trim()) {
      socket.emit("chat:typing", { roomId: id, userName: myUserName });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("chat:stop_typing", { roomId: id });
      }, 1200);
    } else {
      socket.emit("chat:stop_typing", { roomId: id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const createEvent = async () => {
    if (!canManageExtras) {
      Alert.alert('Sin permisos', 'Solo profesorado o delegados pueden crear eventos.');
      return;
    }
    if (!eventTitle.trim() || !eventDate.trim()) {
      Alert.alert('Faltan datos', 'Indica al menos un título y una fecha válida.');
      return;
    }

    try {
      const parsedEventDate = new Date(eventDate);
      if (Number.isNaN(parsedEventDate.getTime())) {
        Alert.alert('Fecha invÃ¡lida', 'Selecciona una fecha y hora vÃ¡lidas para el evento.');
        return;
      }

      const event = await createRoomEventRequest({
        roomId: id,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        startsAt: parsedEventDate.toISOString(),
        kind: 'academico',
      });

	      if (event) {
	        if (typeof saveRoomEventLocal === 'function') saveRoomEventLocal({ ...event, roomId: id, roomName: nombre });
	        setEvents(prev => [...prev, event].sort((a, b) => a.startsAt - b.startsAt));
        setShowEventModal(false);
        setShowExtrasPanel('events');
        setEventTitle('');
        setEventDescription('');
        setEventDate('');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear el evento.');
    }
  };

  const createPoll = async () => {
    if (!canManageExtras) {
      Alert.alert('Sin permisos', 'Solo profesorado o delegados pueden crear encuestas.');
      return;
    }
    const cleanOptions = pollOptions.map(option => option.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) {
      Alert.alert('Faltan datos', 'La encuesta necesita una pregunta y al menos dos opciones.');
      return;
    }

    try {
      const parsedPollExpiry = pollExpiry.trim() ? new Date(pollExpiry) : null;
      if (parsedPollExpiry && Number.isNaN(parsedPollExpiry.getTime())) {
        Alert.alert('Fecha invÃ¡lida', 'Selecciona una fecha y hora vÃ¡lidas para el cierre de la encuesta.');
        return;
      }

      const poll = await createRoomPollRequest({
        roomId: id,
        question: pollQuestion.trim(),
        options: cleanOptions,
        expiresAt: parsedPollExpiry ? parsedPollExpiry.toISOString() : null,
      });

	      if (poll) {
	        if (typeof saveRoomPollLocal === 'function') saveRoomPollLocal({ ...poll, roomId: id, roomName: nombre });
	        setPolls(prev => [poll, ...prev]);
        setShowPollModal(false);
        setShowExtrasPanel('polls');
        setPollQuestion('');
        setPollOptions(['', '']);
        setPollExpiry('');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear la encuesta.');
    }
  };

  const votePoll = async (pollId: string, optionId: string) => {
    try {
	      const updated = await votePollRequest({ roomId: id, pollId, optionId });
	      if (updated) {
	        if (typeof saveRoomPollLocal === 'function') saveRoomPollLocal({ ...updated, roomId: id, roomName: nombre });
	        setPolls(prev => prev.map(item => item.id === updated.id ? updated : item));
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo registrar el voto.');
    }
  };

  const deleteEvent = async (eventId: string) => {
	    try {
	      await deleteRoomEventRequest({ roomId: id, eventId });
	      if (typeof removeRoomEventLocal === 'function') removeRoomEventLocal(eventId);
	      setEvents(prev => prev.filter(item => item.id !== eventId));
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el evento.');
    }
  };

  const closePoll = async (pollId: string) => {
    try {
	      const updated = await closePollRequest({ roomId: id, pollId });
	      if (updated) {
	        if (typeof saveRoomPollLocal === 'function') saveRoomPollLocal({ ...updated, roomId: id, roomName: nombre });
	        setPolls(prev => prev.map(item => item.id === updated.id ? updated : item));
      }
    } catch {
      Alert.alert('Error', 'No se pudo cerrar la encuesta.');
    }
  };

  const deletePoll = async (pollId: string) => {
	    try {
	      await deletePollRequest({ roomId: id, pollId });
	      if (typeof removeRoomPollLocal === 'function') removeRoomPollLocal(pollId);
	      setPolls(prev => prev.filter(item => item.id !== pollId));
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la encuesta.');
    }
  };

  const sendMessage = async (mediaUri?: string, mediaType: 'text' | 'image' | 'video' | 'file' = 'text', fileName?: string, fileSize?: number, mimeType?: string) => {
    console.log("SENDING MESSAGE...", { input, mediaUri: mediaUri?.substring(0, 60), socket: !!socket, myUserId, mediaType, fileName });
    if (!input.trim() && !mediaUri) return;
    setSending(true);
    const textoLimpio = input.trim();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mentions = buildMentionsPayload(textoLimpio, memberDetails, myUserId);

    const msg = {
      msg_id: msgId,
      roomId: id,
      roomName: nombre,
      text: textoLimpio || (mediaType === 'file' ? fileName : ''),
      contenido: textoLimpio,
      image: mediaUri || null,
      mediaType: mediaType,
      fileName: fileName || null,
      fileSize: fileSize || null,
      mimeType: mimeType || null,
      senderId: myUserId,
      senderName: myUserName,
      nombreEmisor: myUserName,
      timestamp: Date.now(),
      recipients: miembros,
      mentions,
      threadTopic: selectedThreadTopic,
      messageType: teacherMessageType,
      requiresAck,
      ackReaders: [],
      metadata: {
        important: ['announcement', 'required_read', 'assessable', 'urgent'].includes(teacherMessageType || ''),
        threadTopic: selectedThreadTopic,
        messageType: teacherMessageType,
      },
      esProfesor: esProfesor,
      status: 'sending',
      read: true,
      readByRecipient: false,
      isMe: true,
      replyTo: replyingTo ? {
        id: replyingTo.msg_id,
        senderName: replyingTo.senderName || replyingTo.nombreEmisor || "Usuario",
        text: replyingTo.text || replyingTo.contenido || "Archivo adjunto"
      } : null
    };

    // Añadir mensaje localmente primero
    setMessages(prev => [...prev, msg]);
    if (typeof saveMessageLocal === 'function') saveMessageLocal(msg);
    setInput("");
    saveDraftLocal(id, "");
    setMentionQuery(null);
    setMentionCandidates([]);
    socket?.emit("chat:stop_typing", { roomId: id });
    setReplyingTo(null); // Clear reply state
    setTeacherMessageType(null);
    setRequiresAck(false);
    setSelectedThreadTopic('General');

    // Enviar por socket
    // If it is a file, we might need a different event or same 'chat:send_media'
    // Assuming backend handles base64 string in 'image' field for now, or we need to upload.
    // For now, reuse send_media logic which likely handles base64 in 'image' field.
    emitChatMessage(msg);
    setSending(false);
    setTimeout(() => scrollToBottom(true), 100);
  };

  const retryMessage = useCallback((message: any) => {
    if (!message?.msg_id) return;
    applyMessagePatch(message.msg_id, { status: 'retrying' });
    emitChatMessage({
      ...message,
      status: 'retrying',
    });
  }, [applyMessagePatch, emitChatMessage]);

  useEffect(() => {
    if (!socket?.connected) {
      autoRetriedOnConnectRef.current = false;
      return;
    }
    if (autoRetriedOnConnectRef.current) return;
    autoRetriedOnConnectRef.current = true;
    const pending = messages.filter((message) => message.isMe && message.status === 'failed').slice(0, 5);
    pending.forEach((message) => retryMessage(message));
  }, [socket?.connected, messages, retryMessage]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const { uri, name, mimeType, size } = result.assets[0];
        const mediaType = inferMediaType(name, mimeType);

        // Validar tamaño
        if (size && size > MAX_FILE_SIZE) {
          Alert.alert('Archivo muy grande', `El límite es 10 MB. Tu archivo pesa ${formatFileSize(size)}.`);
          return;
        }

        // Convertir a base64 data URI
        try {
          let dataUri: string;
          if (Platform.OS === 'web') {
            dataUri = await fileToBase64Web(uri);
          } else {
            dataUri = await fileToBase64Native(uri, mimeType || 'application/octet-stream');
          }
          sendMessage(dataUri, mediaType, name || 'archivo', size || 0, mimeType || 'application/octet-stream');
        } catch (convErr) {
          console.error("Error convirtiendo archivo a base64:", convErr);
          // Fallback: enviar URI directamente
          sendMessage(uri, mediaType, name || 'archivo', size || 0, mimeType || 'application/octet-stream');
        }
      }
    } catch (err) {
      console.log("Error picking document", err);
    }
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.4,
      base64: true
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      const mime = isVideo ? 'video/mp4' : 'image/jpeg';
      const data = asset.base64
        ? `data:${mime};base64,${asset.base64}`
        : asset.uri;
      const size = asset.fileSize || (asset.base64 ? Math.round(asset.base64.length * 0.75) : 0);
      sendMessage(data, isVideo ? 'video' : 'image', undefined, size, mime);
    }
  };

  const handleAttachment = () => {
    if (Platform.OS === 'web') {
      // On web we can just use pickDocument for everything or show a custom modal
      // For simplicity, let's just trigger pickDocument which allows all files including images
      pickDocument();
      // OR offer choice:
      // const choice = window.confirm("¿Enviar imagen/video? (Cancelar para documento)");
      // if (choice) pickMedia(); else pickDocument();
    } else {
      Alert.alert(
        "Enviar adjunto",
        "¿Qué deseas enviar?",
        [
          { text: "Galería (Fotos/Videos)", onPress: pickMedia },
          { text: "Documento (PDF, etc.)", onPress: pickDocument },
          { text: "Cancelar", style: "cancel" }
        ]
      );
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const getMessageStatus = (msg: any): 'sending' | 'retrying' | 'sent' | 'delivered' | 'read' | 'failed' => {
    if (msg.status === 'failed') return 'failed';
    if (msg.status === 'retrying') return 'retrying';
    if (msg.status === 'sending') return 'sending';
    // Para mensajes propios, usar readByRecipient para el doble tick azul
    if (msg.isMe) {
      if (msg.readByRecipient) return 'read';
      if (msg.delivered || msg.status === 'delivered') return 'delivered';
      if (msg.status === 'sent') return 'sent';
      return 'sent';
    }
    // Para mensajes de otros
    if (msg.read) return 'read';
    if (msg.delivered) return 'delivered';
    return 'sent';
  };

  const getMessageStatusLabel = (status: 'sending' | 'retrying' | 'sent' | 'delivered' | 'read' | 'failed') => {
    switch (status) {
      case 'sending':
        return 'Enviando...';
      case 'retrying':
        return 'Reintentando...';
      case 'failed':
        return 'No enviado. Toca para reintentar.';
      case 'delivered':
        return 'Entregado';
      case 'read':
        return 'Leido';
      case 'sent':
      default:
        return 'Enviado';
    }
  };

  const failedOwnMessages = messages.filter((message) => message?.isMe && getMessageStatus(message) === 'failed');
  const pendingOwnMessages = messages.filter((message) => message?.isMe && ['sending', 'retrying'].includes(getMessageStatus(message)));

  useEffect(() => {
    if (!targetMsgId || hasScrolledToTargetRef.current || messages.length === 0) return;
    if (activeThreadFilter !== 'Todos') {
      setActiveThreadFilter('Todos');
    }
    const found = messages.some((message) => message.msg_id === targetMsgId);
    if (!found) return;
    hasScrolledToTargetRef.current = true;
    setTimeout(() => scrollToMessage(targetMsgId), 150);
  }, [targetMsgId, messages]);

  const threadOptions = [
    ...CONVERSATION_FILTERS,
    ...Array.from(new Set(messages.map((message) => message.threadTopic).filter(Boolean))),
  ];
  const filteredMessages = (() => {
    if (activeThreadFilter === 'Todos') return messages;
    if (activeThreadFilter === 'Importantes') return messages.filter((message) => message.important || message.messageType);
    if (activeThreadFilter === 'Checker') return messages.filter((message) => message.requiresAck);
    if (activeThreadFilter === 'Menciones') return messages.filter((message) => messageMentionsCurrentUser(message, myUserId, myUserName));
    if (activeThreadFilter === 'Encuestas') return messages.filter((message) => String(message.messageType || '').includes('poll'));
    if (activeThreadFilter === 'Eventos') return messages.filter((message) => String(message.messageType || '').includes('event'));
    return messages.filter((message) => message.threadTopic === activeThreadFilter);
  })();

  useEffect(() => {
    if (!pendingScrollTargetRef.current || filteredMessages.length === 0) return;
    const targetId = pendingScrollTargetRef.current;
    if (!filteredMessages.some((message) => message.msg_id === targetId)) return;
    const timeoutId = setTimeout(() => scrollToMessage(targetId), 80);
    return () => clearTimeout(timeoutId);
  }, [filteredMessages]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isEmbedded && { paddingTop: 0 }, { backgroundColor: colors.background }]}>
        <View style={{ width: '100%', maxWidth: 460, paddingHorizontal: 24, gap: 14 }}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={{ textAlign: 'center', color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
            Preparando la conversacion
          </Text>
          <Text style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
            Cargando mensajes recientes y recuperando tu contexto para que el chat se abra sin saltos.
          </Text>
          {[0, 1, 2].map((index) => (
            <View
              key={`chat-skeleton-${index}`}
              style={{
                alignSelf: index === 1 ? 'flex-end' : 'flex-start',
                width: index === 1 ? '58%' : index === 2 ? '48%' : '64%',
                borderRadius: 18,
                paddingVertical: 18,
                paddingHorizontal: 16,
                backgroundColor: index === 1 ? colors.primaryBg : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  function scrollToMessage(targetMsgId: string) {
    const index = filteredMessages.findIndex(m => m.msg_id === targetMsgId);
    if (index !== -1) {
      pendingScrollTargetRef.current = null;
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHoveredMessageId(targetMsgId);
      setTimeout(() => setHoveredMessageId(null), 1400);
    } else {
      pendingScrollTargetRef.current = targetMsgId;
      if (activeThreadFilter !== 'Todos') {
        setActiveThreadFilter('Todos');
      }
    }
  }

  const handleOpenMessageFromInfo = (message: any) => {
    setShowInfo(false);
    pendingScrollTargetRef.current = message.msg_id;
    if (showExtrasPanel) setShowExtrasPanel(null);
    if (activeThreadFilter !== 'Todos') {
      setActiveThreadFilter('Todos');
      return;
    }
    setTimeout(() => scrollToMessage(message.msg_id), 120);
  };

  // Modal de info del chat
  if (showInfo) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.header, isEmbedded && { paddingTop: 16 }, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.backButton}>
            <ChevronLeftIcon color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Info del chat</Text>
          </View>
        </View>
        <ChatInfoScreen
          roomId={id}
          nombre={nombre}
          esProfesor={esProfesor}
          onOpenMessage={handleOpenMessageFromInfo}
        />
      </View>
    );
  }

  const CellRenderer = (props: any) => {
    const item = messages[props.index];
    if (!item) return <View {...props} />;

    const isOpen = showReactionPicker === item.msg_id || openMenuId === item.msg_id;
    return (
      <View {...props} style={[props.style, { zIndex: isOpen ? 9999 : 1, elevation: isOpen ? 10 : 0 }]} />
    );
  };

  const presenceEntries = Object.values(presenceByUser);
  const onlineCount = presenceEntries.filter((entry: any) => entry?.online).length;
  const upcomingEvents = events.filter((event: any) => (event?.startsAt || 0) >= Date.now()).slice(0, 3);
  const visiblePolls = polls.slice(0, 3);

  const myMentionBadge = memberDetails
    .filter(member => member.id !== myUserId)
    .slice(0, 4)
    .map(member => ({
      id: member.id,
      label: `@${(member.nombre || '').split(' ')[0]}`,
    }));

  const selectConversationFilter = (filter: string) => {
    setActiveThreadFilter(filter);
    setShowThreadFilterMenu(false);
    if (filter === 'Eventos') {
      setShowExtrasPanel('events');
      return;
    }
    if (filter === 'Encuestas') {
      setShowExtrasPanel('polls');
      return;
    }
    setShowExtrasPanel('threads');
  };

  const getUserDisplayName = (userId: string) => {
    const normalizedUserId = String(userId);
    if (normalizedUserId === String(myUserId)) return myUserName || 'Tú';
    const detailed = memberDetails.find((member) => String(member.id) === normalizedUserId);
    if (detailed?.nombre) return detailed.nombre;
    const fromPresence = presenceByUser[normalizedUserId];
    if (fromPresence?.userName) return fromPresence.userName;
    if (fromPresence?.nombre) return fromPresence.nombre;
    return `Usuario ${normalizedUserId.slice(0, 8)}`;
  };

  const getCheckerBreakdown = (message: any) => {
    const readers = Array.isArray(message?.ackReaders) ? message.ackReaders : [];
    const readSet = new Set(readers.map((reader: any) => String(reader.userId)));
    const sourceMembers = memberDetails.length > 0
      ? memberDetails.map((member: any) => ({ userId: String(member.id), userName: member.nombre || getUserDisplayName(String(member.id)) }))
      : miembros.map((memberId: string) => ({ userId: String(memberId), userName: getUserDisplayName(String(memberId)) }));

    const confirmed = sourceMembers.filter((member) => readSet.has(String(member.userId)));
    const pending = sourceMembers.filter((member) => !readSet.has(String(member.userId)));

    const normalizedConfirmed = readers.map((reader: any) => ({
      userId: String(reader.userId),
      userName: reader.userName || getUserDisplayName(String(reader.userId)),
      readAt: reader.readAt,
    }));

    return {
      confirmed: normalizedConfirmed.length > 0 ? normalizedConfirmed : confirmed,
      pending,
    };
  };

  const content = (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, isEmbedded && { paddingTop: 16 }, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {!isEmbedded && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeftIcon />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.headerInfo} onPress={() => setShowInfo(true)}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{nombre}</Text>
          <Text style={styles.headerSubtitle}>{miembros.length} participantes • {onlineCount} conectados</Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => iniciarLlamada('audio')} style={styles.iconButton}>
            <PhoneIcon />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => iniciarLlamada('video')} style={styles.iconButton}>
            <VideoIcon />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.iconButton}>
            <InfoIcon />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner de mensajes fijados */}
      <PinnedMessagesBanner
        pinnedMessages={pinnedMessages}
        onPressBanner={() => setPinnedExpanded(!pinnedExpanded)}
        expanded={pinnedExpanded}
        esProfesor={canPin} // Allow professors AND delegates
        onUnpin={(msgId) => {
          setPinnedMessages(prev => prev.filter(p => p.msgId !== msgId));
          if (typeof removePinnedMessage === 'function') removePinnedMessage(id, msgId);
          socket?.emit('chat:unpin_message', {
            roomId: id,
            messageId: msgId,
          });
        }}
      />

      <View style={{
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 10,
      }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 12 }}>
          {(['available', 'in_class', 'busy'] as const).map((statusKey) => {
            const meta = PRESENCE_META[statusKey];
            const selected = myPresenceStatus === statusKey;
            return (
              <TouchableOpacity
                key={statusKey}
                onPress={() => setMyPresenceStatus(statusKey)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? meta.color : colors.surface,
                  borderWidth: 1,
                  borderColor: selected ? meta.color : colors.border,
                }}
              >
                <Text style={{ color: selected ? '#fff' : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setShowExtrasPanel(prev => prev === 'events' ? null : 'events')}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <CalendarDays size={15} color={colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Calendario</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowExtrasPanel(prev => prev === 'polls' ? null : 'polls')}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <ListChecks size={15} color={colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Encuestas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowExtrasPanel(prev => prev === 'mentions' ? null : 'mentions')}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <AtSign size={15} color={colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Menciones</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowExtrasPanel(prev => prev === 'threads' ? null : 'threads')}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <ChevronDown size={15} color={colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>{activeThreadFilter}</Text>
          </TouchableOpacity>
        </ScrollView>

        {showExtrasPanel === 'threads' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
            {threadOptions.map((topic) => {
              const selected = activeThreadFilter === topic;
              return (
                <TouchableOpacity
                  key={topic}
                  onPress={() => selectConversationFilter(topic)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: selected ? colors.primaryBg : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                >
                  <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>{topic}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showExtrasPanel === 'mentions' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
            <TouchableOpacity onPress={() => quickMention('@todos ')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primaryBg }}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>@todos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => quickMention('@delegados ')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primaryBg }}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>@delegados</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => quickMention('@profesor ')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primaryBg }}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>@profesor</Text>
            </TouchableOpacity>
            {myMentionBadge.map((badge) => (
              <TouchableOpacity key={badge.id} onPress={() => quickMention(`${badge.label} `)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>{badge.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {showExtrasPanel === 'events' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>Próximos eventos</Text>
              {canManageExtras && (
                <TouchableOpacity onPress={() => setShowEventModal(true)}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Nuevo</Text>
                </TouchableOpacity>
              )}
            </View>
            {upcomingEvents.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Todavía no hay eventos programados.</Text>
            ) : upcomingEvents.map((event) => (
              <View key={event.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', flex: 1 }}>{event.title}</Text>
                  {canManageExtras && (
                    <TouchableOpacity onPress={() => deleteEvent(event.id)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.dangerBg }}>
                      <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!event.description && <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{event.description}</Text>}
                <Text style={{ color: colors.primary, marginTop: 4, fontWeight: '600' }}>
                  {new Date(event.startsAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {showExtrasPanel === 'polls' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>Encuestas rápidas</Text>
              {canManageExtras && (
                <TouchableOpacity onPress={() => setShowPollModal(true)}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Nueva</Text>
                </TouchableOpacity>
              )}
            </View>
            {visiblePolls.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Todavía no hay encuestas activas.</Text>
            ) : visiblePolls.map((poll) => (
              <View key={poll.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{poll.question}</Text>
                    {!!poll.expiresAt && (
                      <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>
                        {poll.closedAt ? 'Cerrada' : `Cierra: ${new Date(poll.expiresAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                      </Text>
                    )}
                  </View>
                  {canManageExtras && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {!poll.closedAt && (
                        <TouchableOpacity onPress={() => closePoll(poll.id)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryBg }}>
                          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Cerrar</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => deletePoll(poll.id)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.dangerBg }}>
                        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {poll.options.map((option: any) => {
                  const voted = option.votes?.some((vote: any) => String(vote.userId) === String(myUserId));
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => !poll.closedAt && votePoll(poll.id, option.id)}
                      disabled={!!poll.closedAt}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: poll.closedAt ? colors.surfaceHover : voted ? colors.primaryBg : colors.background,
                        borderWidth: 1,
                        borderColor: voted ? colors.primary : colors.border,
                        marginBottom: 8,
                        opacity: poll.closedAt ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{option.text}</Text>
                      <Text style={{ color: colors.textMuted, marginTop: 4 }}>{option.votes?.length || 0} votos</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Lista de mensajes */}
      {!isConnected && (
        <View style={{
          marginHorizontal: 20,
          marginBottom: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: colors.dangerBg,
          borderWidth: 1,
          borderColor: colors.danger,
        }}>
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>
            Sin conexion en tiempo real
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
            Puedes seguir escribiendo. Los mensajes pendientes se reenviaran cuando vuelva la conexion.
          </Text>
        </View>
      )}
      {failedOwnMessages.length > 0 && (
        <View style={{
          marginHorizontal: 20,
          marginBottom: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: colors.dangerBg,
          borderWidth: 1,
          borderColor: colors.danger,
        }}>
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>
            Hay {failedOwnMessages.length === 1 ? '1 mensaje pendiente de reenviar' : `${failedOwnMessages.length} mensajes pendientes de reenviar`}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
            Pulsa "Reintentar" en el mensaje que fallo para enviarlo de nuevo cuando tengas mejor conexion.
          </Text>
        </View>
      )}
      {failedOwnMessages.length === 0 && pendingOwnMessages.length > 0 && (
        <View style={{
          marginHorizontal: 20,
          marginBottom: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: colors.primaryBg,
          borderWidth: 1,
          borderColor: colors.primary,
        }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
            {pendingOwnMessages.length === 1 ? '1 mensaje aun se esta confirmando' : `${pendingOwnMessages.length} mensajes aun se estan confirmando`}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
            El chat seguira actualizando los ticks en cuanto el servidor y el otro dispositivo respondan.
          </Text>
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.msg_id}
        contentContainerStyle={[styles.messagesList, { paddingHorizontal: 35 }]}
        onContentSizeChange={() => {
          if (!hasAutoScrolledRef.current && !loading && messages.length > 0) {
            hasAutoScrolledRef.current = true;
            scrollToBottom(false);
            return;
          }
          if (sending) scrollToBottom(true);
        }}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          if (pendingScrollTargetRef.current) {
            setTimeout(() => scrollToMessage(pendingScrollTargetRef.current as string), 120);
          }
        }}
        onScrollBeginDrag={() => {
          setOpenMenuId(null);
          setShowReactionPicker(null);
          setShowInputEmojiPicker(false);
          setSelectedMessageId(null);
        }}
        CellRendererComponent={CellRenderer} // Inject custom z-index logic
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aún no hay mensajes.{'\n'}¡Sé el primero en escribir!</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.senderId === myUserId;
          const isVideo = item.mediaType === 'video' || item.image?.includes('video');
          const messageStatus = getMessageStatus(item);
          const mentionsMe = !isMe && messageMentionsCurrentUser(item, myUserId, myUserName);

          const isHovered = hoveredMessageId === item.msg_id;
          const isSelected = selectedMessageId === item.msg_id; // Touch/click selection
          const showPicker = showReactionPicker === item.msg_id;
          const reactions = item.reactions || [];

          // Heuristic: If it's one of the last 3 messages, open UP.
          const isNearBottom = index >= filteredMessages.length - 3;

          return (
            <View
              style={[
                styles.messageContainer,
                isMe ? styles.myMessageContainer : styles.theirMessageContainer,
                {
                  zIndex: (showPicker || openMenuId === item.msg_id) ? 999 : 1,
                  position: 'relative',
                  paddingBottom: reactions.length > 0 ? 18 : 0, // Space for reactions badge
                }
              ]}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredMessageId(item.msg_id),
                onMouseLeave: () => {
                  setHoveredMessageId(null);
                  if (!showPicker && openMenuId !== item.msg_id) {
                    setShowReactionPicker(null);
                    setShowInputEmojiPicker(false);
                  }
                }
              } : {})}
            >
              {!isMe && (
                <Text style={[styles.senderName, { color: colors.primary }]}>
                  {item.senderName || item.nombreEmisor || "Usuario"}
                </Text>
              )}

              <View style={{ flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'center', maxWidth: '80%' }}>

                {/* Message Bubble with TouchableOpacity for Click/Touch */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    // Toggle selection on touch/click
                    setSelectedMessageId(prev => prev === item.msg_id ? null : item.msg_id);
                  }}
                  style={[
                    styles.messageBubble,
                    isMe ? styles.myMessage : styles.theirMessage, isMe ? { backgroundColor: colors.bubbleOwn } : { backgroundColor: colors.bubbleOther },
                    {
                      position: 'relative',
                      maxWidth: '100%',
                      borderWidth: mentionsMe ? 2 : 0,
                      borderColor: mentionsMe ? colors.primary : 'transparent'
                    }
                  ]}
                >
                  {mentionsMe && (
                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primaryBg, marginBottom: 8 }}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Mención para ti</Text>
                    </View>
                  )}

                  {/* REPLY CONTEXT */}
                  {item.replyTo && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => scrollToMessage(item.replyTo.id)}
                    >
                      <View style={{
                        backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.04)',
                        padding: 8,
                        borderRadius: 8,
                        marginBottom: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: isMe ? 'rgba(255,255,255,0.5)' : colors.primary,
                      }}>
                        <Text style={{
                          fontSize: 12,
                          fontWeight: 'bold',
                          color: isMe ? 'rgba(255,255,255,0.9)' : colors.primary,
                          marginBottom: 2
                        }}>
                          {item.replyTo.senderName}
                        </Text>
                        <Text style={{
                          fontSize: 12,
                          color: isMe ? 'rgba(255,255,255,0.7)' : '#64748b'
                        }} numberOfLines={2}>
                          {item.replyTo.text}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Imagen / GIF */}
                  {item.image && item.mediaType !== 'file' && !isVideo && (
                    <TouchableOpacity onPress={() => setSelectedImage(item.image)}>
                      <Image source={{ uri: item.image }} style={styles.messageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}

                  {/* Vídeo */}
                  {item.image && isVideo && (
                    <TouchableOpacity onPress={() => setSelectedVideo(item.image)}>
                      <View style={styles.videoContainer}>
                        <Video
                          source={{ uri: item.image }}
                          style={styles.videoPreview}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                        />
                        <View style={styles.videoPlayButton}>
                          <Text style={styles.videoPlayText}>▶ Vídeo</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Archivo (Documento) */}
                  {item.mediaType === 'file' && (() => {
                    const fIcon = getFileIcon(item.fileName || '', item.mimeType);
                    const fSize = formatFileSize(item.fileSize || 0);
                    const ext = (item.fileName || '').split('.').pop()?.toUpperCase() || 'FILE';

                    const handleFileOpen = () => {
                      if (item.image && item.image.startsWith('data:')) {
                        // base64 data URI - create blob and open
                        if (Platform.OS === 'web') {
                          try {
                            const byteString = atob(item.image.split(',')[1]);
                            const mimeString = item.image.split(',')[0].split(':')[1].split(';')[0];
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                            const blob = new Blob([ab], { type: mimeString });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = item.fileName || 'archivo';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch (e) { console.error('Error downloading file:', e); }
                        } else {
                          // Native: save to file system and open
                          try {
                            const b64Data = item.image.split(',')[1];
                            const fileUri = ((FileSystem as any).cacheDirectory || '') + (item.fileName || 'archivo');
                            FileSystem.writeAsStringAsync(fileUri, b64Data, { encoding: (FileSystem as any).EncodingType.Base64 })
                              .then(() => Linking.openURL(fileUri))
                              .catch(e => console.error('Error saving file:', e));
                          } catch (e) { Linking.openURL(item.image); }
                        }
                      } else if (item.image) {
                        Linking.openURL(item.image);
                      }
                    };

                    return (
                      <TouchableOpacity onPress={handleFileOpen} activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#f8fafc',
                          padding: 12, borderRadius: 12, marginBottom: 4,
                          maxWidth: 260, minWidth: 200,
                          borderWidth: isMe ? 0 : 1, borderColor: '#e2e8f0',
                        }}>
                        <View style={{
                          width: 44, height: 44, borderRadius: 10,
                          backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : fIcon.color + '15',
                          justifyContent: 'center', alignItems: 'center', marginRight: 12,
                        }}>
                          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={isMe ? '#fff' : fIcon.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={fIcon.icon}/></Svg>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            color: isMe ? '#ffffff' : '#1e293b',
                            fontWeight: '600', fontSize: 14,
                          }} numberOfLines={2}>
                            {item.fileName || 'Documento'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                            <View style={{
                              backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : fIcon.color + '20',
                              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                            }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: isMe ? '#fff' : fIcon.color }}>{ext}</Text>
                            </View>
                            {fSize ? <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>{fSize}</Text> : null}
                          </View>
                        </View>
                        <View style={{
                          width: 32, height: 32, borderRadius: 16,
                          backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                          justifyContent: 'center', alignItems: 'center', marginLeft: 8,
                        }}>
                          <Download size={16} color={isMe ? '#fff' : '#475569'} />
                        </View>
                      </TouchableOpacity>
                    );
                  })()}

                  {/* Texto */}
                  {(item.threadTopic || item.messageType || item.requiresAck) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {item.threadTopic && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: isMe ? 'rgba(255,255,255,0.16)' : colors.primaryBg }}>
                          <Text style={{ color: isMe ? colors.textOnPrimary : colors.primary, fontSize: 11, fontWeight: '700' }}>{item.threadTopic}</Text>
                        </View>
                      )}
                      {item.messageType && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: isMe ? 'rgba(255,255,255,0.16)' : colors.dangerBg }}>
                          <Text style={{ color: isMe ? colors.textOnPrimary : colors.danger, fontSize: 11, fontWeight: '700' }}>{item.messageType}</Text>
                        </View>
                      )}
                      {item.requiresAck && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: isMe ? 'rgba(255,255,255,0.16)' : colors.successBg }}>
                          <Text style={{ color: isMe ? colors.textOnPrimary : colors.success, fontSize: 11, fontWeight: '700' }}>Checker</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {(item.text || item.contenido) && item.mediaType !== 'file' && (
                    <Text style={[styles.messageText, isMe ? { color: colors.bubbleOwnText } : { color: colors.bubbleOtherText }]}>
                      {item.text || item.contenido}
                    </Text>
                  )}

                  {item.requiresAck && !isMe && !item.ackReaders?.some((reader: any) => String(reader.userId) === String(myUserId)) && (
                    <TouchableOpacity
                      onPress={() => {
                        const reader = { userId: myUserId, userName: myUserName, readAt: Date.now() };
                        const nextReaders = [...(item.ackReaders || []), reader];
                        setMessages(prev => prev.map(message => message.msg_id === item.msg_id ? { ...message, ackReaders: nextReaders } : message));
                        if (typeof updateMessageAckReaders === 'function') updateMessageAckReaders(item.msg_id, nextReaders);
                        socket?.emit("chat:strong_read", { msg_id: item.msg_id, roomId: id, userId: myUserId, userName: myUserName });
                      }}
                      style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: isMe ? 'rgba(255,255,255,0.16)' : colors.primaryBg }}
                    >
                      <Text style={{ color: isMe ? colors.textOnPrimary : colors.primary, fontWeight: '700', fontSize: 12 }}>Marcar checker</Text>
                    </TouchableOpacity>
                  )}

                  {item.requiresAck && (
                    <View style={{ marginTop: 6, gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setExpandedCheckerInfoId((current) => current === item.msg_id ? null : item.msg_id)}
                        style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: isMe ? 'rgba(255,255,255,0.14)' : colors.surfaceHover }}
                      >
                        <Text style={{ color: isMe ? 'rgba(255,255,255,0.9)' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                          Checker: {(item.ackReaders || []).length}/{miembros.length || memberDetails.length || 0} · Info
                        </Text>
                      </TouchableOpacity>
                      {expandedCheckerInfoId === item.msg_id && (() => {
                        const checker = getCheckerBreakdown(item);
                        return (
                          <View style={{ padding: 10, borderRadius: 12, backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : colors.surfaceHover, borderWidth: 1, borderColor: isMe ? 'rgba(255,255,255,0.18)' : colors.border }}>
                            <Text style={{ color: isMe ? colors.textOnPrimary : colors.textPrimary, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>Confirmados</Text>
                            <Text style={{ color: isMe ? 'rgba(255,255,255,0.85)' : colors.textSecondary, fontSize: 12 }}>
                              {checker.confirmed.length > 0 ? checker.confirmed.map((member: any) => member.userName).join(', ') : 'Nadie todavia'}
                            </Text>
                            <Text style={{ color: isMe ? colors.textOnPrimary : colors.textPrimary, fontWeight: '700', fontSize: 12, marginTop: 10, marginBottom: 6 }}>Pendientes</Text>
                            <Text style={{ color: isMe ? 'rgba(255,255,255,0.85)' : colors.textSecondary, fontSize: 12 }}>
                              {checker.pending.length > 0 ? checker.pending.map((member: any) => member.userName).join(', ') : 'Nadie pendiente'}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* Hora y ticks */}
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
                      {formatTime(item.timestamp)}
                    </Text>
                    {isMe && (
                      <View style={styles.tickWrapper}>
                        <MessageTick status={messageStatus} />
                      </View>
                    )}
                  </View>
                  {isMe && (
                    <Text
                      style={{
                        marginTop: 4,
                        alignSelf: 'flex-end',
                        color: item.status === 'failed' ? '#FCA5A5' : 'rgba(255,255,255,0.78)',
                        fontSize: 11,
                        fontWeight: item.status === 'failed' ? '700' : '500',
                      }}
                    >
                      {getMessageStatusLabel(messageStatus)}
                    </Text>
                  )}
                  {isMe && item.status === 'failed' && (
                    <TouchableOpacity
                      onPress={() => retryMessage(item)}
                      style={{ marginTop: 8, alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.18)' }}
                    >
                      <Text style={{ color: '#FCA5A5', fontWeight: '700', fontSize: 12 }}>Reintentar</Text>
                    </TouchableOpacity>
                  )}

                  {/* CHEVRON MENU BUTTON (Visible on Hover/Click or Menu Open) */}
                  {(isHovered || isSelected || openMenuId === item.msg_id) && (
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => setOpenMenuId(item.msg_id === openMenuId ? null : item.msg_id)}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 8,
                        backgroundColor: isMe ? colors.primary : colors.surface,
                        borderRadius: 12,
                        padding: 2,
                        zIndex: 20
                      }}
                    >
                      <ChevronDown size={18} color={isMe ? colors.textOnPrimary : colors.textMuted} />
                    </TouchableOpacity>
                  )}

                  {/* DROP DOWN MENU */}
                  {openMenuId === item.msg_id && (
                    <View style={{
                      position: 'absolute',
                      // Vertical positioning
                      top: isNearBottom ? undefined : 20,
                      bottom: isNearBottom ? 0 : undefined,

                      // Horizontal positioning
                      right: isMe ? 0 : undefined,
                      left: !isMe ? '85%' : undefined, // Start near right edge, extend right

                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      paddingVertical: 4,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                      elevation: 10,
                      zIndex: 9999,
                      minWidth: 160,
                      borderWidth: 1,
                      borderColor: colors.border
                    }}>
                      {/* ACTIONS */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 12 }}
                        onPress={() => {
                          setReplyingTo(item);
                          setOpenMenuId(null);
                          // Small delay to ensure render happens before focus
                          setTimeout(() => inputRef.current?.focus(), 100);
                        }}
                      >
                        <CornerUpLeft size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>Responder</Text>
                      </TouchableOpacity>

                      <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 8 }} />

                      <TouchableOpacity
                        onPress={() => {
                          setOpenMenuId(null); // Close menu
                          setShowReactionPicker(item.msg_id); // Open emoji picker
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 12 }}
                      >
                        <Smile size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>Reaccionar</Text>
                      </TouchableOpacity>
                      {/* FIJAR MENSAJE (SOLO PROFESOR O DELEGADO) */}
                      {canPin && (
                        <>
                          <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 8 }} />
                          <TouchableOpacity
                            onPress={() => {
                              setOpenMenuId(null);
                              setMessageToPin(item);
                              setPinModalVisible(true);
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 12 }}
                          >
                            <Pin size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>Fijar</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 8 }} />

                      <TouchableOpacity
                        onPress={() => handleCopy(item.text || item.contenido || "")}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 12 }}
                      >
                        <Copy size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>Copiar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>

                {/* REACTIONS DISPLAY (Outside bubble, below it) */}
                {reactions.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    bottom: -14,
                    [isMe ? 'right' : 'left']: 8,
                    flexDirection: 'row',
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderWidth: 1,
                    borderColor: colors.border,
                    elevation: 3,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.12,
                    shadowRadius: 2,
                    zIndex: 10,
                  }}>
                    {Array.from(new Set(reactions.map((r: any) => r.emoji))).slice(0, 3).map((e: any) => (
                      <Text key={e} style={{ fontSize: 14, marginRight: 2 }}>{e}</Text>
                    ))}
                    {reactions.length > 1 && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 2, alignSelf: 'center' }}>{reactions.length}</Text>
                    )}
                  </View>
                )}

                {/* ADD REACTION BUTTON (Outside Bubble) */}
                {(isHovered || isSelected || showPicker) && !openMenuId && (
                  <View style={{
                    marginLeft: isMe ? 0 : 8,
                    marginRight: isMe ? 8 : 0,
                    position: 'relative'
                  }}>
                    <TouchableOpacity
                      onPress={() => setShowReactionPicker(prev => prev === item.msg_id ? null : item.msg_id)}
                      style={{
                        backgroundColor: colors.surfaceHover,
                        borderRadius: 20,
                        width: 28,
                        height: 28,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 1,
                      }}
                    >
                      <SmileyIcon color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* REACTION PICKER POPUP (Anchored to button) */}
                    {showPicker && (
                      <ReactionPicker
                        onSelect={(emoji) => handleReaction(item.msg_id, emoji)}
                        isMe={isMe}
                      />
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {typingUserName && (
        <View style={{
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}>
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 12 }}>
            {typingUserName} está escribiendo...
          </Text>
        </View>
      )}

      {/* REPLY BANNER */}
      {replyingTo && (
        <View style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <CornerUpLeft size={20} color="rgba(255,255,255,0.85)" style={{ marginRight: 10 }} />
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', marginBottom: 2 }}>
                Respondiendo a
              </Text>
              <Text style={{ color: colors.textOnPrimary, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>
                {replyingTo.senderName || replyingTo.nombreEmisor || "Usuario"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setReplyingTo(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}
          >
            <X size={18} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, isEmbedded && { paddingBottom: 16 }, replyingTo && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {(showComposerMeta || teacherMessageType || requiresAck || selectedThreadTopic !== 'General') && (
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {THREAD_TOPICS.map((topic) => (
                <TouchableOpacity key={topic} onPress={() => setSelectedThreadTopic(topic)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: selectedThreadTopic === topic ? colors.primary : colors.surfaceHover }}>
                  <Text style={{ color: selectedThreadTopic === topic ? colors.textOnPrimary : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>{topic}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {canManageExtras && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity onPress={() => setTeacherMessageType(null)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: !teacherMessageType ? colors.primary : colors.surfaceHover }}>
                  <Text style={{ color: !teacherMessageType ? colors.textOnPrimary : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Normal</Text>
                </TouchableOpacity>
                {TEACHER_MESSAGE_TYPES.map((type) => (
                  <TouchableOpacity key={type.id} onPress={() => setTeacherMessageType(type.id)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: teacherMessageType === type.id ? colors.primary : colors.surfaceHover }}>
                    <Text style={{ color: teacherMessageType === type.id ? colors.textOnPrimary : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setRequiresAck(prev => !prev)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: requiresAck ? colors.primary : colors.surfaceHover }}>
                  <Text style={{ color: requiresAck ? colors.textOnPrimary : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Checker</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        )}
        {showInputEmojiPicker && (
          <View style={{
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 74 : 66,
            left: isDesktop ? 24 : 16,
            right: isDesktop ? 24 : 16,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 10,
            zIndex: 2000,
            maxHeight: isDesktop ? 250 : 185,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            elevation: 8,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
                Emojis
              </Text>
              <TouchableOpacity onPress={() => setShowInputEmojiPicker(false)}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: isDesktop ? 8 : 6,
              }}
            >
              {inputEmojis.map((emoji, idx) => (
                <TouchableOpacity
                  key={`${emoji}-${idx}`}
                  onPress={() => handleInsertEmoji(emoji)}
                  style={{
                    width: isDesktop ? 40 : 34,
                    height: isDesktop ? 40 : 34,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: colors.surfaceHover,
                  }}
                >
                  <Text style={{ fontSize: isDesktop ? 22 : 20 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: colors.borderLight,
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                Toca un emoji para insertarlo en el mensaje.
              </Text>
            </View>
          </View>
        )}

        {mentionCandidates.length > 0 && (
          <MentionDropdown
            candidates={mentionCandidates}
            onSelect={handleMentionSelect}
            colors={colors}
          />
        )}

        <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <TouchableOpacity onPress={() => setShowComposerMeta(prev => !prev)} style={styles.attachButton}>
            <FileText size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowInputEmojiPicker(false); handleAttachment(); }} style={styles.attachButton}>
            <PaperclipIcon />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowInputEmojiPicker(prev => !prev)}
            style={styles.attachButton}
          >
            <SmileyIcon color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef} // Ensure ref is attached
            style={[styles.input, { color: colors.inputText }]}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              saveDraftLocal(id, text);
              emitTyping(text);
              updateMentionCandidates(text);
            }}
            onFocus={() => setShowInputEmojiPicker(false)}
            onBlur={() => socket?.emit("chat:stop_typing", { roomId: id })}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.placeholder}
            multiline
            onKeyPress={(e: any) => {
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Escape') {
                setMentionCandidates([]);
                setMentionQuery(null);
              }
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setShowInputEmojiPicker(false);
                setMentionCandidates([]);
                setMentionQuery(null);
                sendMessage();
              }
            }}
          />
          <TouchableOpacity
            onPress={() => {
              setShowInputEmojiPicker(false);
              sendMessage();
            }}
            disabled={!input.trim() || sending}
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          >
            {sending ? <ActivityIndicator size="small" color="white" /> : <SendIcon />}
          </TouchableOpacity>
        </View>
      </View>
    </View >
  );

  if (isEmbedded) {
    return (
      <>
        <TouchableWithoutFeedback onPress={() => {
          setOpenMenuId(null);
          setShowReactionPicker(null);
          setShowInputEmojiPicker(false);
          setShowThreadFilterMenu(false);
          setSelectedMessageId(null);
        }}>
          {content}
        </TouchableWithoutFeedback>
        <ImageViewerModal
          visible={!!selectedImage}
          uri={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
        <VideoViewerModal
          visible={!!selectedVideo}
          uri={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />

        {/* MODAL FIJAR MENSAJE */}
        <PinWizardModal
          visible={pinModalVisible}
          messageToPin={messageToPin}
          onClose={() => {
            setPinModalVisible(false);
            setMessageToPin(null);
          }}
          onPin={(data) => {
            const now = Date.now();
            // NO añadimos localmente, el servidor lo devolverá via chat:receive_pin
            socket?.emit('chat:pin_message', {
              roomId: id,
              messageId: data.messageId,
              duration: data.duration,
              durationLabel: data.durationLabel,
              category: data.category,
              color: data.color,
              senderName: myUserName,
              text: messageToPin?.text || messageToPin?.contenido || 'Archivo adjunto',
            });
            Alert.alert('📌 Mensaje fijado', `Fijado como "${data.category}" por ${data.durationLabel}.`);
            setPinModalVisible(false);
            setMessageToPin(null);
          }}
        />
        <QuickFormModal
          visible={showEventModal}
          title="Nuevo evento"
          fields={[
            { value: eventTitle, onChangeText: setEventTitle, placeholder: 'Examen de Matemáticas' },
            { value: eventDescription, onChangeText: setEventDescription, placeholder: 'Descripción opcional' },
            { value: eventDate, onChangeText: setEventDate, placeholder: 'Fecha y hora del evento', type: 'datetime' },
          ]}
          confirmLabel="Crear evento"
          onClose={() => setShowEventModal(false)}
          onConfirm={createEvent}
        />
        <QuickFormModal
          visible={showPollModal}
          title="Nueva encuesta"
          fields={[
            { value: pollQuestion, onChangeText: setPollQuestion, placeholder: '¿Movemos la tutoría al viernes?' },
            { value: pollExpiry, onChangeText: setPollExpiry, placeholder: 'Cierre opcional', type: 'datetime' },
            ...pollOptions.map((option, index) => ({
              value: option,
              onChangeText: (value: string) => setPollOptions(prev => prev.map((item, idx) => idx === index ? value : item)),
              placeholder: `Opción ${index + 1}`,
              removable: pollOptions.length > 2,
              onRemove: () => setPollOptions(prev => prev.filter((_, idx) => idx !== index)),
            })),
          ]}
          footerAction={{
            label: 'Añadir opción',
            onPress: () => setPollOptions(prev => [...prev, '']),
          }}
          confirmLabel="Crear encuesta"
          onClose={() => setShowPollModal(false)}
          onConfirm={createPoll}
        />

      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <React.Fragment>
      <TouchableWithoutFeedback onPress={() => {
        setOpenMenuId(null);
        setShowReactionPicker(null);
        setShowInputEmojiPicker(false);
        setShowThreadFilterMenu(false);
        setSelectedMessageId(null);
      }}>
          {content}
        </TouchableWithoutFeedback>
      </React.Fragment>
      <ImageViewerModal
        visible={!!selectedImage}
        uri={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
      <VideoViewerModal
        visible={!!selectedVideo}
        uri={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />

      {/* MODAL FIJAR MENSAJE */}
      <PinWizardModal
        visible={pinModalVisible}
        messageToPin={messageToPin}
        onClose={() => {
          setPinModalVisible(false);
          setMessageToPin(null);
        }}
        onPin={(data) => {
          const now = Date.now();
          // NO añadimos localmente, el servidor lo devolverá via chat:receive_pin
          socket?.emit('chat:pin_message', {
            roomId: id,
            messageId: data.messageId,
            duration: data.duration,
            durationLabel: data.durationLabel,
            category: data.category,
            color: data.color,
            senderName: myUserName,
            text: messageToPin?.text || messageToPin?.contenido || 'Archivo adjunto',
          });
          Alert.alert('📌 Mensaje fijado', `Fijado como "${data.category}" por ${data.durationLabel}.`);
          setPinModalVisible(false);
          setMessageToPin(null);
        }}
      />
      <QuickFormModal
        visible={showEventModal}
        title="Nuevo evento"
        fields={[
          { value: eventTitle, onChangeText: setEventTitle, placeholder: 'Examen de Matemáticas' },
          { value: eventDescription, onChangeText: setEventDescription, placeholder: 'Descripción opcional' },
          { value: eventDate, onChangeText: setEventDate, placeholder: 'Fecha y hora del evento', type: 'datetime' },
        ]}
        confirmLabel="Crear evento"
        onClose={() => setShowEventModal(false)}
        onConfirm={createEvent}
      />
      <QuickFormModal
        visible={showPollModal}
        title="Nueva encuesta"
        fields={[
          { value: pollQuestion, onChangeText: setPollQuestion, placeholder: '¿Movemos la tutoría al viernes?' },
          { value: pollExpiry, onChangeText: setPollExpiry, placeholder: 'Cierre opcional', type: 'datetime' },
          ...pollOptions.map((option, index) => ({
            value: option,
            onChangeText: (value: string) => setPollOptions(prev => prev.map((item, idx) => idx === index ? value : item)),
            placeholder: `Opción ${index + 1}`,
            removable: pollOptions.length > 2,
            onRemove: () => setPollOptions(prev => prev.filter((_, idx) => idx !== index)),
          })),
        ]}
        footerAction={{
          label: 'Añadir opción',
          onPress: () => setPollOptions(prev => [...prev, '']),
        }}
        confirmLabel="Crear encuesta"
        onClose={() => setShowPollModal(false)}
        onConfirm={createPoll}
      />
    </KeyboardAvoidingView>
  );
};

// Componentes auxiliares para modales
const QuickFormModal = ({
  visible,
  title,
  fields,
  onClose,
  onConfirm,
  confirmLabel,
  footerAction,
}: {
  visible: boolean;
  title: string;
  fields: Array<{ value: string; onChangeText: (value: string) => void; placeholder: string; type?: 'text' | 'datetime'; removable?: boolean; onRemove?: () => void }>;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  footerAction?: { label: string; onPress: () => void };
}) => {
  const { colors } = useTheme();
  const [iosPickerField, setIosPickerField] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) setIosPickerField(null);
  }, [visible]);

  const openNativeDatePicker = (field: { value: string; onChangeText: (value: string) => void; placeholder: string }, index: number) => {
    const initialDate = field.value ? new Date(field.value) : new Date();
    const safeDate = Number.isNaN(initialDate.getTime()) ? new Date() : initialDate;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: safeDate,
        mode: 'date',
        is24Hour: true,
        onChange: (_, selectedDate) => {
          if (!selectedDate) return;
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: 'time',
            is24Hour: true,
            onChange: (_timeEvent, selectedTime) => {
              if (!selectedTime) return;
              const next = new Date(selectedDate);
              next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              field.onChangeText(next.toISOString());
            },
          });
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setIosPickerField((current) => (current === index ? null : index));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 }}>{title}</Text>
          {fields.map((field, index) => (
            <View key={`${field.placeholder}-${index}`} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {field.type === 'datetime' ? (
                  Platform.OS === 'web' ? (
                    <input
                      value={toDateTimeLocalValue(field.value)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        field.onChangeText(nextValue ? new Date(nextValue).toISOString() : '');
                      }}
                      placeholder={field.placeholder}
                      type="datetime-local"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: 12,
                        padding: '10px 12px',
                        color: colors.inputText,
                        backgroundColor: colors.inputBg,
                      } as React.CSSProperties}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => openNativeDatePicker(field, index)}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        backgroundColor: colors.inputBg,
                      }}
                    >
                      <Text style={{ color: field.value ? colors.inputText : colors.placeholder }}>
                        {field.value
                          ? new Date(field.value).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : field.placeholder}
                      </Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChangeText}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.placeholder}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.inputText,
                      backgroundColor: colors.inputBg,
                    }}
                  />
                )}
                
                {field.removable && field.onRemove && (
                  <TouchableOpacity onPress={field.onRemove} style={{ paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.dangerBg }}>
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>X</Text>
                  </TouchableOpacity>
                )}
              </View>
              {field.type === 'datetime' && Platform.OS === 'ios' && iosPickerField === index && (
                <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.inputBg }}>
                  <DateTimePicker
                    value={field.value ? new Date(field.value) : new Date()}
                    mode="datetime"
                    display="inline"
                    onChange={(_, selectedDate) => {
                      if (selectedDate) field.onChangeText(selectedDate.toISOString());
                    }}
                  />
                </View>
              )}
            </View>
          ))}
          {footerAction && (
            <TouchableOpacity onPress={footerAction.onPress} style={{ marginBottom: 14 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{footerAction.label}</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: colors.textOnPrimary, fontWeight: '700' }}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ImageViewerModal = ({ visible, uri, onClose }: { visible: boolean; uri: string | null; onClose: () => void }) => {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width - 24, 980);
  const frameHeight = Math.min(height * 0.82, 780);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
          <TouchableWithoutFeedback>
            <View
              style={{
                width: frameWidth,
                maxWidth: '100%',
                borderRadius: 22,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderLight,
                  backgroundColor: colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>Vista previa de imagen</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.primaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 10 }}>
                {uri && (
                  <Image
                    source={{ uri }}
                    style={{ width: frameWidth - 20, height: frameHeight }}
                    resizeMode="contain"
                  />
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const VideoViewerModal = ({ visible, uri, onClose }: { visible: boolean; uri: string | null; onClose: () => void }) => {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width - 24, 1100);
  const videoWidth = frameWidth - 20;
  const videoHeight = Math.min(height * 0.72, Math.max(240, videoWidth * 0.5625));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
          <TouchableWithoutFeedback>
            <View
              style={{
                width: frameWidth,
                maxWidth: '100%',
                borderRadius: 22,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderLight,
                  backgroundColor: colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>Vista previa de video</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.primaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 10 }}>
                {uri && Platform.OS === 'web' ? (
                  <video
                    src={uri}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      maxWidth: videoWidth,
                      maxHeight: videoHeight,
                      display: 'block',
                      borderRadius: 14,
                      backgroundColor: '#000',
                    }}
                  />
                ) : uri ? (
                  <Video
                    source={{ uri }}
                    style={{ width: videoWidth, height: videoHeight, backgroundColor: '#000', borderRadius: 14 }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping={false}
                  />
                ) : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

