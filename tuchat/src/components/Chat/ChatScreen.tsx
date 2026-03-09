import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, TextInput, TouchableOpacity, Text,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Modal, Dimensions, useWindowDimensions, TouchableWithoutFeedback
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
import { router, useFocusEffect } from 'expo-router';
import { styles } from './chat.styles';
import {
  getMessagesByRoom,
  saveMessageLocal,
  saveDraftLocal,
  getDraftLocal,
  markMessagesAsRead,
  toggleReactionFn,
  savePinnedMessage,
  getPinnedMessagesByRoom,
  removePinnedMessage,
  cleanExpiredPins
} from '../../db/database';
import { useSocket } from '../../context/SocketContext';
import { ChatInfoScreen } from './ChatInfoScreen';
import { ReactionPicker } from './ReactionPicker';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown, Copy, Smile, CornerUpLeft, X, FileText, Pin, Download } from 'lucide-react-native';
import { Alert, Linking } from 'react-native';
import { decodeJwt } from '../../utils/auth';
import { PinWizardModal, PinnedMessagesBanner } from './PinComponents';
import { useTheme } from '../../context/ThemeContext';

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
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mimeType || 'application/octet-stream'};base64,${b64}`;
};

// --- ICONOS SVG ---
const ChevronLeftIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#1e293b" style={{ width: 24, height: 24 }}>
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
const MessageTick = ({ status }: { status: 'sending' | 'sent' | 'delivered' | 'read' }) => {
  if (status === 'sending') {
    return (
      <Svg viewBox="0 0 12 12" width={12} height={12} fill="none">
        <Path d="M6 12A6 6 0 1 0 6 0a6 6 0 0 0 0 12Zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" fill="rgba(255,255,255,0.5)" />
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
  isEmbedded?: boolean;
  onBack?: () => void;
}

export const ChatScreen = ({ id, nombre, tipo = 'grupo', isEmbedded = false, onBack }: ChatScreenProps) => {
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
  const [esProfesor, setEsProfesor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [messageToPin, setMessageToPin] = useState<any>(null);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [miembros, setMiembros] = useState<string[]>([]);
  const [delegados, setDelegados] = useState<string[]>([]); // Delegados del chat
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null); // New ref for input

  // States for Reactions
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null); // For touch/click
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null); // New state for reply
  const [inputEmojis, setInputEmojis] = useState<string[]>(DEFAULT_INPUT_EMOJIS);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setOpenMenuId(null);
  };

  const handleInsertEmoji = (emoji: string) => {
    const next = `${input}${emoji}`;
    setInput(next);
    saveDraftLocal(id, next);
  };

  const { socket, refreshUnreadCounts, setActiveRoom } = useSocket();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Calcular si el usuario puede fijar mensajes (profesor O delegado)
  const canPin = esProfesor || delegados.includes(myUserId);

  useEffect(() => {
    let cancelled = false;

    const loadInputEmojis = async () => {
      try {
        const response = await fetch(`${API_URL}/chat/emojis`);
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
        const token = Platform.OS === 'web'
          ? localStorage.getItem('token')
          : await SecureStore.getItemAsync('token');

        if (token) {
          const decoded = decodeJwt(token);
          const uid = decoded?.sub;
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
        }

        setMessages(typeof getMessagesByRoom === 'function' ? getMessagesByRoom(id) : []);
        setInput(typeof getDraftLocal === 'function' ? getDraftLocal(id) : '');

        // Load pinned messages from database (safe for web where expo-sqlite unavailable)
        if (typeof cleanExpiredPins === 'function') cleanExpiredPins();
        if (typeof getPinnedMessagesByRoom === 'function') {
          const loadedPins = getPinnedMessagesByRoom(id);
          setPinnedMessages(loadedPins);
        }
        if (typeof markMessagesAsRead === 'function') markMessagesAsRead(id);
        refreshUnreadCounts();

        if (socket) {
          socket.emit("join_room", id);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error en setup del Chat:', error);
        setLoading(false);
      }
    };
    setup();
  }, [id, socket]);

  useFocusEffect(
    useCallback(() => {
      if (typeof markMessagesAsRead === 'function') markMessagesAsRead(id);
      refreshUnreadCounts();
      setActiveRoom(id);
      return () => setActiveRoom(null);
    }, [id])
  );

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      if (msg.roomId === id) {
        setMessages(prev => {
          if (prev.find(m => m.msg_id === msg.msg_id)) return prev;
          const newMessages = [...prev, msg];
          setTimeout(() => {
            if (typeof markMessagesAsRead === 'function') markMessagesAsRead(id);
            refreshUnreadCounts();
            if (msg.senderId !== myUserId) {
              socket.emit("chat:read_receipt", { msg_id: msg.msg_id, roomId: id });
            }
          }, 100);
          return newMessages;
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    const handleReadReceipt = ({ msg_id }: { msg_id: string }) => {
      setMessages(prev => prev.map(m =>
        m.msg_id === msg_id ? { ...m, read: true } : m
      ));
    };

    const handleIncomingReaction = ({ msgId, reaction }: { msgId: string, reaction: any }) => {
      // Use ref instead of state value to avoid stale closure bug
      if (String(reaction.userId) === String(myUserIdRef.current)) return;

      setMessages(prev => prev.map(m => {
        if (m.msg_id === msgId) {
          // ... (existing logic) ...
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
        id: `pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        roomId: id, // Add roomId for per-chat pins
        msgId: pinData.messageId,
        text: pinData.text || pinData.contenido || 'Archivo adjunto',
        senderName: pinData.senderName || 'Profesor',
        category: pinData.category,
        color: pinData.color,
        duration: pinData.duration,
        durationLabel: pinData.durationLabel,
        pinnedAt: pinData.pinnedAt || Date.now(),
        expiresAt: pinData.expiresAt || (Date.now() + pinData.duration),
      };
      setPinnedMessages(prev => [newPin, ...prev]);
      if (typeof savePinnedMessage === 'function') savePinnedMessage(newPin);
    };

    const handleUnpin = (data: any) => {
      console.log('📌 Unpin recibido:', data);
      setPinnedMessages(prev => prev.filter(p => p.msgId !== data.messageId));
    };

    socket.on("chat:receive", handleNewMessage);
    socket.on("chat:update_read_status", handleReadReceipt);
    socket.on("chat:reaction", handleIncomingReaction);
    socket.on("chat:receive_pin", handleIncomingPin);
    socket.on("chat:receive_unpin", handleUnpin);

    return () => {
      socket.off("chat:receive", handleNewMessage);
      socket.off("chat:update_read_status", handleReadReceipt);
      socket.off("chat:reaction", handleIncomingReaction);
      socket.off("chat:receive_pin", handleIncomingPin);
      socket.off("chat:receive_unpin", handleUnpin);
    };
  }, [socket, id, refreshUnreadCounts, myUserId]);

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

  const sendMessage = async (mediaUri?: string, mediaType: 'image' | 'video' | 'file' = 'image', fileName?: string, fileSize?: number, mimeType?: string) => {
    console.log("SENDING MESSAGE...", { input, mediaUri: mediaUri?.substring(0, 60), socket: !!socket, myUserId, mediaType, fileName });
    if (!input.trim() && !mediaUri) return;
    if (!socket) {
      console.error("NO SOCKET CONNECTION");
      return;
    }

    setSending(true);
    const textoLimpio = input.trim();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const msg = {
      msg_id: msgId,
      roomId: id,
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
      esProfesor: esProfesor,
      status: 'sending',
      read: false,
      replyTo: replyingTo ? {
        id: replyingTo.msg_id,
        senderName: replyingTo.senderName || replyingTo.nombreEmisor || "Usuario",
        text: replyingTo.text || replyingTo.contenido || "Archivo adjunto"
      } : null
    };

    // Añadir mensaje localmente primero
    setMessages(prev => [...prev, msg]);
    setInput("");
    saveDraftLocal(id, "");
    setReplyingTo(null); // Clear reply state

    // Enviar por socket
    // If it is a file, we might need a different event or same 'chat:send_media'
    // Assuming backend handles base64 string in 'image' field for now, or we need to upload.
    // For now, reuse send_media logic which likely handles base64 in 'image' field.
    socket.emit(mediaUri ? "chat:send_media" : "chat:send", msg, (ack: any) => {
      // Actualizar estado cuando el servidor confirma
      setMessages(prev => prev.map(m =>
        m.msg_id === msgId ? { ...m, status: 'sent', delivered: true } : m
      ));
    });

    if (typeof saveMessageLocal === 'function') saveMessageLocal({ ...msg, status: 'sent', delivered: true });
    setSending(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const { uri, name, mimeType, size } = result.assets[0];

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
          sendMessage(dataUri, 'file', name || 'archivo', size || 0, mimeType || 'application/octet-stream');
        } catch (convErr) {
          console.error("Error convirtiendo archivo a base64:", convErr);
          // Fallback: enviar URI directamente
          sendMessage(uri, 'file', name || 'archivo', size || 0, mimeType || 'application/octet-stream');
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

  const getMessageStatus = (msg: any): 'sending' | 'sent' | 'delivered' | 'read' => {
    if (msg.status === 'sending') return 'sending';
    if (msg.read) return 'read';
    if (msg.delivered) return 'delivered';
    return 'sent';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isEmbedded && { paddingTop: 0 }, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Modal de info del chat
  if (showInfo) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.header, isEmbedded && { paddingTop: 16 }, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.backButton}>
            <ChevronLeftIcon />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Info del chat</Text>
          </View>
        </View>
        <ChatInfoScreen
          roomId={id}
          nombre={nombre}
          esProfesor={esProfesor}
        />
      </View>
    );
  }

  const scrollToMessage = (targetMsgId: string) => {
    const index = messages.findIndex(m => m.msg_id === targetMsgId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      // Optional: Trigger a highlight animation here
      setHoveredMessageId(targetMsgId);
      setTimeout(() => setHoveredMessageId(null), 1000);
    } else {
      console.log("Message not found (might be paginated)");
    }
  };

  const CellRenderer = (props: any) => {
    const item = messages[props.index];
    if (!item) return <View {...props} />;

    const isOpen = showReactionPicker === item.msg_id || openMenuId === item.msg_id;
    return (
      <View {...props} style={[props.style, { zIndex: isOpen ? 9999 : 1, elevation: isOpen ? 10 : 0 }]} />
    );
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
          <Text style={styles.headerSubtitle}>{miembros.length} participantes • Toca para más info</Text>
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

      {/* Lista de mensajes */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.msg_id}
        contentContainerStyle={[styles.messagesList, { paddingHorizontal: 35 }]}
        onContentSizeChange={() => {
          // Only scroll to end if we are near the bottom or sending
          if (sending) flatListRef.current?.scrollToEnd({ animated: true });
        }}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
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

          const isHovered = hoveredMessageId === item.msg_id;
          const isSelected = selectedMessageId === item.msg_id; // Touch/click selection
          const showPicker = showReactionPicker === item.msg_id;
          const reactions = item.reactions || [];

          // Heuristic: If it's one of the last 3 messages, open UP.
          const isNearBottom = index >= messages.length - 3;

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
                    { position: 'relative', maxWidth: '100%' }
                  ]}
                >

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
                            const fileUri = FileSystem.cacheDirectory + (item.fileName || 'archivo');
                            FileSystem.writeAsStringAsync(fileUri, b64Data, { encoding: FileSystem.EncodingType.Base64 })
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
                  {(item.text || item.contenido) && item.mediaType !== 'file' && (
                    <Text style={[styles.messageText, isMe ? { color: colors.bubbleOwnText } : { color: colors.bubbleOtherText }]}>
                      {item.text || item.contenido}
                    </Text>
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
        {showInputEmojiPicker && (
          <View style={{
            position: 'absolute',
            bottom: 66,
            left: 16,
            right: 16,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 10,
            zIndex: 2000,
            maxHeight: 170,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            elevation: 8,
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {inputEmojis.map((emoji, idx) => (
                <TouchableOpacity
                  key={`${emoji}-${idx}`}
                  onPress={() => handleInsertEmoji(emoji)}
                  style={{
                    width: 34,
                    height: 34,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: colors.surfaceHover,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
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
            }}
            onFocus={() => setShowInputEmojiPicker(false)}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.placeholder}
            multiline
            onKeyPress={(e: any) => {
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setShowInputEmojiPicker(false);
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
    </KeyboardAvoidingView>
  );
};

// Componentes auxiliares para modales
const ImageViewerModal = ({ visible, uri, onClose }: { visible: boolean; uri: string | null; onClose: () => void }) => {
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={onClose}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Cerrar</Text>
        </TouchableOpacity>
        {uri && <Image source={{ uri }} style={{ width: screenWidth, height: screenHeight * 0.8 }} resizeMode="contain" />}
      </View>
    </Modal>
  );
};

const VideoViewerModal = ({ visible, uri, onClose }: { visible: boolean; uri: string | null; onClose: () => void }) => {
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={onClose}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Cerrar</Text>
        </TouchableOpacity>
        {uri && (
          <Video
            source={{ uri }}
            style={{ width: screenWidth, height: screenHeight * 0.8 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
          />
        )}
      </View>
    </Modal>
  );
};

