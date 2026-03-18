import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Platform, StyleSheet, useWindowDimensions,
  Modal, Pressable, Image, TextInput
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router, useFocusEffect } from "expo-router";
import { useSocket } from '../../context/SocketContext';
import { dismissImportantItem, getImportantMessages, markMessagesAsRead, getMessagesByRoom, searchMessagesAdvanced } from '../../db/database';
import { ChatScreen } from '../../components/Chat/ChatScreen';
import { useTheme } from '../../context/ThemeContext';

const API_URL = "https://tuchat-pl9.onrender.com";
const DESKTOP_BREAKPOINT = 768;

// ============ ICONOS SVG ============

// Logo TuChat desde archivo PNG
const TuChatLogoImage = ({ size = 32 }: { size?: number }) => (
  <Image
    source={require('../../../../tuchat/assets/images/logo.png')}
    style={{ width: size, height: size, tintColor: '#fff' }}
    resizeMode="contain"
  />
);

// Logo para fondo claro (sin tint)
const TuChatLogoColor = ({ size = 80 }: { size?: number }) => (
  <Image
    source={require('../../../../tuchat/assets/images/logo.png')}
    style={{ width: size, height: size, opacity: 0.4 }}
    resizeMode="contain"
  />
);

// Icono de 3 puntos verticales
const DotsVerticalIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 24, height: 24 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
  </Svg>
);

// Iconos del menÃº
const ProfileIcon = ({ color = "#475569" }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </Svg>
);

const SettingsIcon = ({ color = "#475569" }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </Svg>
);

const HelpIcon = ({ color = "#475569" }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </Svg>
);

const AdminIcon = ({ color = "#475569" }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </Svg>
);

const LogoutIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#EF4444" style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
  </Svg>
);

const UsersIcon = ({ color = "currentColor" }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
  </Svg>
);

const UserIcon = ({ color = "currentColor" }: { color?: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </Svg>
);

// Componente de doble tick
const MessageStatus = ({ status }: { status: 'sent' | 'delivered' | 'read' }) => {
  const color = status === 'read' ? '#34B7F1' : '#8696A0';

  if (status === 'sent') {
    return (
      <Svg viewBox="0 0 16 11" width={16} height={11} fill="none">
        <Path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.32-.143.462.462 0 0 0-.312.106l-.311.296a.455.455 0 0 0-.14.337c0 .136.047.25.14.337l2.996 2.996a.497.497 0 0 0 .501.14.493.493 0 0 0 .39-.28l6.846-8.932a.485.485 0 0 0-.063-.577l-.417-.32Z" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg viewBox="0 0 16 11" width={16} height={11} fill="none">
      <Path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.32-.143.462.462 0 0 0-.312.106l-.311.296a.455.455 0 0 0-.14.337c0 .136.047.25.14.337l2.996 2.996a.497.497 0 0 0 .501.14.493.493 0 0 0 .39-.28l6.846-8.932a.485.485 0 0 0-.063-.577l-.417-.32Z" fill={color} />
      <Path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.405-1.328-.696.9 2.076 2.076a.497.497 0 0 0 .501.14.493.493 0 0 0 .39-.28l6.846-8.932a.485.485 0 0 0-.063-.577l-.417-.32Z" fill={color} />
    </Svg>
  );
};

// ============ COMPONENTE PRINCIPAL ============

export const HomeScreen = () => {
  const { colors } = useTheme();
  const [chats, setChats] = useState<any[]>([]);
  const [privateChats, setPrivateChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'grupos' | 'privados'>('grupos');
  const [userType, setUserType] = useState<'ALUMNO' | 'PROFESOR'>('ALUMNO');
  const [userName, setUserName] = useState('');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [userRol, setUserRol] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [panelMode, setPanelMode] = useState<'chats' | 'search' | 'important'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFilters, setSearchFilters] = useState({
    onlyImportant: false,
    onlyFiles: false,
    requiresAck: false,
  });

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const { unreadCounts, refreshUnreadCounts, isConnected } = useSocket();
  const [lastMessages, setLastMessages] = useState<Record<string, any>>({});
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [importantItems, setImportantItems] = useState<any[]>([]);

  const currentScopeChats = activeTab === 'grupos' ? chats : privateChats;
  const scopeRoomIdsKey = currentScopeChats.map((chat) => String(chat.id_chat)).join('|');
  const scopeLabel = activeTab === 'grupos' ? 'grupos' : (userType === 'ALUMNO' ? 'profesores' : 'alumnos');

  const resetSessionViewState = useCallback(() => {
    setChats([]);
    setPrivateChats([]);
    setLastMessages({});
    setSearchResults([]);
    setImportantItems([]);
    setSelectedChat(null);
    setSearchQuery('');
    setRecentSearches([]);
    setPanelMode('chats');
  }, []);

  const getPreferenceStorage = useCallback(async () => {
    if (Platform.OS === 'web') {
      return {
        getItem: async (key: string) => localStorage.getItem(key),
        setItem: async (key: string, value: string) => localStorage.setItem(key, value),
      };
    }
    return {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const userDataStr = Platform.OS === 'web'
        ? localStorage.getItem('usuario')
        : await SecureStore.getItemAsync('usuario');

      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setUserType(userData.tipo || userData.tipo_externo || 'ALUMNO');
        setUserName(userData.nombre || '');
        setUserRol(userData.id_rol || null);
        setUserId(String(userData.id || userData.id_usuario_app || userData.sub || ''));
      } else {
        setUserType('ALUMNO');
        setUserName('');
        setUserRol(null);
        setUserId('');
        resetSessionViewState();
      }
    } catch (e) {
      console.error("Error obteniendo datos de usuario:", e);
    }
  };

  const fetchChats = useCallback(async () => {
    try {
      const storage = await getPreferenceStorage();
      const cachedListsRaw = await storage.getItem('home_cached_chat_lists');
      if (cachedListsRaw) {
        try {
          const cachedLists = JSON.parse(cachedListsRaw);
          const cachedGroups = Array.isArray(cachedLists?.groups) ? cachedLists.groups : [];
          const cachedPrivates = Array.isArray(cachedLists?.privates) ? cachedLists.privates : [];
          setChats(cachedGroups);
          setPrivateChats(cachedPrivates);

          const cachedLastMessages: Record<string, any> = {};
          [...cachedGroups, ...cachedPrivates].forEach((chat: any) => {
            const messages = typeof getMessagesByRoom === 'function' ? getMessagesByRoom(chat.id_chat) : [];
            if (messages && messages.length > 0) {
              cachedLastMessages[chat.id_chat] = messages[messages.length - 1];
            }
          });
          setLastMessages(cachedLastMessages);
          setLoading(false);
        } catch {}
      }
      setLoading(false);

      const token = Platform.OS === 'web'
        ? localStorage.getItem('token')
        : await SecureStore.getItemAsync('token');

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/academico/chats-disponibles`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.ok && response.data.chats) {
        const processed = response.data.chats.map((item: any) => ({
          id_chat: item.id_chat,
          nombre: item.nombre || "Asignatura",
          subtitulo: item.subtitulo || "General",
          esProfesor: item.esProfesor || false,
          tipo: 'grupo',
        }));
        setChats(processed);

        const messagesMap: Record<string, any> = {};
        processed.forEach((chat: any) => {
          const messages = typeof getMessagesByRoom === 'function' ? getMessagesByRoom(chat.id_chat) : [];
          if (messages && messages.length > 0) {
            messagesMap[chat.id_chat] = messages[messages.length - 1];
          }
        });
        setLastMessages(prev => ({ ...prev, ...messagesMap }));

        await storage.setItem('home_cached_chat_lists', JSON.stringify({
          groups: processed,
          privates: privateChats,
        }));
      }

      try {
        const privateResponse = await axios.get(`${API_URL}/academico/chats-privados`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (privateResponse.data.ok && privateResponse.data.chats) {
          const processedPrivate = privateResponse.data.chats.map((item: any) => ({
            id_chat: item.id_chat_privado,
            nombre: item.nombre_contacto || "Usuario",
            subtitulo: item.asignatura || "Chat privado",
            esProfesor: item.es_profesor_contacto || false,
            tipo: 'privado',
          }));
          setPrivateChats(processedPrivate);

          const privateMessagesMap: Record<string, any> = {};
          processedPrivate.forEach((chat: any) => {
            const messages = typeof getMessagesByRoom === 'function' ? getMessagesByRoom(chat.id_chat) : [];
            if (messages && messages.length > 0) {
              privateMessagesMap[chat.id_chat] = messages[messages.length - 1];
            }
          });
          setLastMessages(prev => ({ ...prev, ...privateMessagesMap }));
          await storage.setItem('home_cached_chat_lists', JSON.stringify({
            groups: response.data.ok && response.data.chats ? response.data.chats.map((item: any) => ({
              id_chat: item.id_chat,
              nombre: item.nombre || "Asignatura",
              subtitulo: item.subtitulo || "General",
              esProfesor: item.esProfesor || false,
              tipo: 'grupo',
            })) : chats,
            privates: processedPrivate,
          }));
        }
      } catch (e) {
        console.log("Chats privados no disponibles");
      }

    } catch (e) {
      console.error("Error cargando chats:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resetSessionViewState]);

  const refreshImportantItems = useCallback(() => {
    const roomIds = currentScopeChats.map((chat) => String(chat.id_chat));
    setImportantItems(typeof getImportantMessages === 'function' ? getImportantMessages(userId, roomIds) : []);
  }, [userId, scopeRoomIdsKey, activeTab]);

  useEffect(() => {
    fetchUserData();
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storage = await getPreferenceStorage();
        const raw = await storage.getItem('home_view_preferences');
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw);
        if (parsed.activeTab === 'grupos' || parsed.activeTab === 'privados') setActiveTab(parsed.activeTab);
        if (parsed.panelMode === 'chats' || parsed.panelMode === 'search' || parsed.panelMode === 'important') setPanelMode(parsed.panelMode);
        if (typeof parsed.searchQuery === 'string') setSearchQuery(parsed.searchQuery);
        if (Array.isArray(parsed.recentSearches)) setRecentSearches(parsed.recentSearches.slice(0, 4));
      } catch {}
    })();
    return () => { mounted = false; };
  }, [getPreferenceStorage]);

  useEffect(() => {
    (async () => {
      try {
        const storage = await getPreferenceStorage();
        await storage.setItem('home_view_preferences', JSON.stringify({
          activeTab,
          panelMode,
          searchQuery,
          recentSearches: recentSearches.slice(0, 4),
        }));
      } catch {}
    })();
  }, [activeTab, panelMode, searchQuery, recentSearches, getPreferenceStorage]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCounts();
      fetchChats();
    }, [refreshUnreadCounts, fetchChats])
  );

  useEffect(() => {
    refreshImportantItems();
  }, [refreshImportantItems, unreadCounts]);

  useEffect(() => {
    const roomIds = currentScopeChats.map((chat) => String(chat.id_chat));
    if (!searchQuery.trim() && !searchFilters.onlyImportant && !searchFilters.onlyFiles && !searchFilters.requiresAck) {
      setSearchResults([]);
      return;
    }
    setSearchResults(typeof searchMessagesAdvanced === 'function' ? searchMessagesAdvanced({
      query: searchQuery,
      roomIds,
      onlyImportant: searchFilters.onlyImportant,
      onlyFiles: searchFilters.onlyFiles,
      requiresAck: searchFilters.requiresAck,
    }) : []);
  }, [searchQuery, searchFilters, currentScopeChats, scopeRoomIdsKey]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 3) return;
    const timeout = setTimeout(() => {
      setRecentSearches((prev) => [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 4));
    }, 450);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const toggleSearchFilter = (key: 'onlyImportant' | 'onlyFiles' | 'requiresAck') => {
    setSearchFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resolveChatName = (item: any) => {
    if (item?.roomName) return item.roomName;
    const roomId = String(item?.roomId || '');
    const matched = [...chats, ...privateChats].find((chat) => String(chat.id_chat) === roomId);
    return matched?.nombre || item?.senderName || roomId || 'Chat';
  };

  const handleChatPress = (item: any) => {
    if (typeof markMessagesAsRead === 'function') markMessagesAsRead(item.id_chat);
    refreshUnreadCounts();

    if (isDesktop) {
      setSelectedChat(item);
    } else {
      router.push({
        pathname: "/chat",
        params: {
          id: item.id_chat,
          nombre: item.nombre,
          tipo: item.tipo
        }
      });
    }
  };

  const openMessageResult = (item: any) => {
    if (isDesktop) {
      setSelectedChat({
        id_chat: item.roomId,
        nombre: resolveChatName(item),
        tipo: 'grupo',
        targetMsgId: item.msg_id,
        targetPanel: item.targetPanel,
        navigationKey: `${item.roomId}:${item.msg_id || item.targetPanel || 'chat'}:${Date.now()}`,
      });
      return;
    }

    router.push({
        pathname: "/chat",
        params: {
          id: item.roomId,
          nombre: resolveChatName(item),
          targetMsgId: item.msg_id,
          targetPanel: item.targetPanel,
        }
    });
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    try {
      resetSessionViewState();
      if (Platform.OS === 'web') {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      } else {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('usuario');
      }
      router.replace('/login' as any);
    } catch (e) {
      console.error("Error al cerrar sesion:", e);
    }
  };

  useEffect(() => {
    setSearchResults([]);
    setImportantItems([]);
    setSelectedChat(null);
  }, [userId]);

  const hideImportantItem = (item: any) => {
    if (typeof dismissImportantItem === 'function') dismissImportantItem(item.msg_id, userId);
    setImportantItems((prev) => prev.filter((current) => current.msg_id !== item.msg_id));
  };

  const handleTabChange = (tab: 'grupos' | 'privados') => {
    setActiveTab(tab);
    setPanelMode('chats');
  };

  const handleMenuOption = (option: string) => {
    setMenuVisible(false);
    switch (option) {
      case 'profile':
        router.push('/profile' as any);
        break;
      case 'settings':
        router.push('/settings' as any);
        break;
      case 'help':
        router.push('/faq' as any);
        break;
      case 'admin':
        router.push('/admin' as any);
        break;
      case 'logout':
        handleLogout();
        break;
    }
  };

  const formatLastMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  const truncateMessage = (text: string, maxLength: number = 35) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const renderItem = ({ item }: { item: any }) => {
    const initial = item.nombre.charAt(0).toUpperCase();
    const unreadCount = unreadCounts[item.id_chat] || 0;
    const lastMessage = lastMessages[item.id_chat];
    const lastMessageText = lastMessage?.text || lastMessage?.contenido || '';
    const lastMessageTime = lastMessage?.timestamp;
    const isMyMessage = lastMessage?.isMe || String(lastMessage?.senderId || '') === String(userId);
    const messageStatus: 'sent' | 'delivered' | 'read' =
      lastMessage?.readByRecipient || lastMessage?.status === 'read'
        ? 'read'
        : lastMessage?.delivered || lastMessage?.status === 'delivered'
          ? 'delivered'
          : 'sent';
    const isSelected = isDesktop && selectedChat?.id_chat === item.id_chat;

    return (
      <TouchableOpacity
        style={[s.chatCard, isSelected && s.chatCardSelected, { backgroundColor: colors.surface }]}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.7}
      >
        <View style={[s.avatar, { backgroundColor: colors.primary }, item.tipo === 'privado' && s.avatarPrivate]}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>

        <View style={s.chatContent}>
          <View style={s.chatTopRow}>
            <Text style={[s.chatTitle, { color: colors.textPrimary }, unreadCount > 0 && s.chatTitleUnread]} numberOfLines={1}>
              {item.nombre}
            </Text>
            {lastMessageTime && (
              <Text style={[s.timeText, { color: colors.textMuted }, unreadCount > 0 && { color: colors.primary, fontWeight: '600' }]}>
                {formatLastMessageTime(lastMessageTime)}
              </Text>
            )}
          </View>

          <View style={s.chatBottomRow}>
            <View style={s.lastMessageContainer}>
              {isMyMessage && lastMessage && (
                <View style={s.tickContainer}>
                  <MessageStatus status={messageStatus} />
                </View>
              )}
              <Text style={[s.lastMessage, { color: colors.textSecondary }, unreadCount > 0 && { color: colors.textPrimary, fontWeight: '500' }]} numberOfLines={1}>
                {lastMessageText ? truncateMessage(lastMessageText) : item.subtitulo}
              </Text>
            </View>

            {unreadCount > 0 && (
              <View style={[s.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={s.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const currentChats = currentScopeChats;
  const gruposUnread = chats.reduce((sum, chat) => sum + (unreadCounts[chat.id_chat] || 0), 0);
  const privadosUnread = privateChats.reduce((sum, chat) => sum + (unreadCounts[chat.id_chat] || 0), 0);
  const isSearchMode = panelMode === 'search';
  const isImportantMode = panelMode === 'important';

  // ============ MENÃš DESPLEGABLE ============
  const dropdownMenu = (
    <Modal
      visible={menuVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setMenuVisible(false)}
    >
      <Pressable style={[s.menuOverlay, { backgroundColor: colors.overlay }]} onPress={() => setMenuVisible(false)}>
        <View style={[s.menuContainer, isDesktop && s.menuContainerDesktop, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={s.menuItem} onPress={() => handleMenuOption('profile')}>
            <ProfileIcon color={colors.textSecondary} />
            <Text style={[s.menuItemText, { color: colors.textPrimary }]}>Mi perfil</Text>
          </TouchableOpacity>

          <View style={[s.menuDivider, { backgroundColor: colors.borderLight }]} />

          <TouchableOpacity style={s.menuItem} onPress={() => handleMenuOption('settings')}>
            <SettingsIcon color={colors.textSecondary} />
            <Text style={[s.menuItemText, { color: colors.textPrimary }]}>Configuracion</Text>
          </TouchableOpacity>

          <View style={[s.menuDivider, { backgroundColor: colors.borderLight }]} />

          <TouchableOpacity style={s.menuItem} onPress={() => handleMenuOption('help')}>
            <HelpIcon color={colors.textSecondary} />
            <Text style={[s.menuItemText, { color: colors.textPrimary }]}>Preguntas</Text>
          </TouchableOpacity>

          {userRol === 7 && (
            <>
              <View style={[s.menuDivider, { backgroundColor: colors.borderLight }]} />
              <TouchableOpacity style={s.menuItem} onPress={() => handleMenuOption('admin')}>
                <AdminIcon color={colors.primary} />
                <Text style={[s.menuItemText, { color: colors.primary }]}>Panel Admin</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={[s.menuDivider, { backgroundColor: colors.borderLight }]} />

          <TouchableOpacity style={s.menuItem} onPress={() => handleMenuOption('logout')}>
            <LogoutIcon />
            <Text style={[s.menuItemText, s.menuItemTextDanger]}>Cerrar sesion</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const chatListContent = (
    <View style={[s.chatListContainer, isDesktop && s.chatListContainerDesktop, { backgroundColor: colors.surface }]}>
      {/* Header con logo + tÃ­tulo + menÃº 3 puntos */}
      <View style={[s.header, isDesktop && s.headerDesktop, { backgroundColor: colors.primary }]}>
        <View style={s.headerLeft}>
          <TuChatLogoImage size={30} />
          <View>
            <Text style={s.mainTitle}>TuChat</Text>
            <Text style={[s.mainSubtitle, { color: 'rgba(255,255,255,0.82)' }]}>
              {isConnected ? `Todo al dia en ${scopeLabel}` : 'Sin conexion. Mostrando tu copia local'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={s.menuButton}
          activeOpacity={0.7}
        >
          <DotsVerticalIcon />
        </TouchableOpacity>
        </View>
      </View>

      <View style={[s.quickActionsBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setPanelMode('search')}
          style={[s.quickActionIconButton, { backgroundColor: isSearchMode ? colors.primaryBg : colors.background, borderColor: isSearchMode ? colors.primary : colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={isSearchMode ? colors.primary : colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPanelMode('important')}
          style={[s.quickActionButton, { backgroundColor: isImportantMode ? colors.primaryBg : colors.background, borderColor: isImportantMode ? colors.primary : colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="tray-full" size={18} color={isImportantMode ? colors.primary : colors.textPrimary} />
          <Text style={[s.quickActionText, { color: isImportantMode ? colors.primary : colors.textPrimary }]}>Importantes</Text>
        </TouchableOpacity>
      </View>
      {panelMode !== 'chats' && (
        <View style={[s.scopeBanner, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[s.scopeBannerTitle, { color: colors.textPrimary }]}>
            {panelMode === 'search' ? 'Busqueda acotada' : 'Bandeja acotada'}
          </Text>
          <Text style={[s.scopeBannerText, { color: colors.textSecondary }]}>
            Mostrando resultados solo de {scopeLabel}. Cambia de pestaña para cambiar el alcance.
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={[s.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'grupos' && { borderBottomColor: colors.primary }]}
          onPress={() => handleTabChange('grupos')}
        >
          <UsersIcon color={activeTab === 'grupos' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === 'grupos' && { color: colors.primary }]}>Grupos</Text>
          {gruposUnread > 0 && (
            <View style={[s.tabBadge]}>
              <Text style={s.tabBadgeText}>{gruposUnread > 99 ? '99+' : gruposUnread}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tab, activeTab === 'privados' && { borderBottomColor: colors.primary }]}
          onPress={() => handleTabChange('privados')}
        >
          <UserIcon color={activeTab === 'privados' ? colors.primary : colors.textSecondary} />
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === 'privados' && { color: colors.primary }]}>
            {userType === 'ALUMNO' ? 'Profesores' : 'Alumnos'}
          </Text>
          {privadosUnread > 0 && (
            <View style={[s.tabBadge]}>
              <Text style={s.tabBadgeText}>{privadosUnread > 99 ? '99+' : privadosUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : panelMode === 'chats' ? (
        <FlatList
          data={currentChats}
          keyExtractor={(item) => item.id_chat.toString()}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchChats();
                refreshUnreadCounts();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                {activeTab === 'grupos' ? (
                  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="#94A3B8" style={{ width: 48, height: 48 }}>
                    <Path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                  </Svg>
                ) : (
                  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="#94A3B8" style={{ width: 48, height: 48 }}>
                    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </Svg>
                )}
              </View>
              <Text style={s.emptyTitle}>
                {activeTab === 'grupos' ? 'No tienes grupos' : `Sin chats con ${userType === 'ALUMNO' ? 'profesores' : 'alumnos'}`}
              </Text>
              <Text style={s.emptyText}>
                {activeTab === 'grupos' ? 'Apareceran cuando te asignen a clases' : 'Los chats privados apareceran aqui'}
              </Text>
            </View>
          }
        />
      ) : panelMode === 'search' ? (
        <View style={s.sidePanelBody}>
          <View style={[s.searchPanelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.searchPanelTitle, { color: colors.textPrimary }]}>Buscar en {scopeLabel}</Text>
            <Text style={[s.searchPanelSubtitle, { color: colors.textSecondary }]}>Mensajes, archivos, eventos, encuestas y fijados dentro del alcance actual.</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por mensaje, archivo, persona o fecha"
              placeholderTextColor={colors.textMuted}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12, marginBottom: 12, color: colors.textPrimary, backgroundColor: colors.background }}
            />
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {!searchQuery && recentSearches.length > 0 && recentSearches.map((item) => (
              <TouchableOpacity key={item} onPress={() => setSearchQuery(item)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceHover }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{item}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => toggleSearchFilter('onlyImportant')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: searchFilters.onlyImportant ? colors.primary : colors.border, backgroundColor: searchFilters.onlyImportant ? colors.primaryBg : colors.background }}>
              <Text style={{ color: searchFilters.onlyImportant ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Importantes</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleSearchFilter('onlyFiles')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: searchFilters.onlyFiles ? colors.primary : colors.border, backgroundColor: searchFilters.onlyFiles ? colors.primaryBg : colors.background }}>
              <Text style={{ color: searchFilters.onlyFiles ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Archivos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleSearchFilter('requiresAck')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: searchFilters.requiresAck ? colors.primary : colors.border, backgroundColor: searchFilters.requiresAck ? colors.primaryBg : colors.background }}>
              <Text style={{ color: searchFilters.requiresAck ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Checker</Text>
            </TouchableOpacity>
            {(searchQuery || searchFilters.onlyImportant || searchFilters.onlyFiles || searchFilters.requiresAck) ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchFilters({ onlyImportant: false, onlyFiles: false, requiresAck: false });
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Limpiar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.msg_id}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <TouchableOpacity onPress={() => openMessageResult(item)}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>{resolveChatName(item)}</Text>
                  <Text style={{ color: colors.textSecondary }} numberOfLines={2}>{item.text || item.fileName || item.messageType || 'Sin contenido'}</Text>
                  <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>
                    {[item.itemType, item.threadTopic, item.messageType, item.requiresAck ? 'Checker' : null].filter(Boolean).join(' · ') || 'Mensaje'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => hideImportantItem(item)} style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Ocultar</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: colors.textMuted, padding: 16 }}>No encontré coincidencias en {scopeLabel}. Prueba con otra palabra o quita algún filtro.</Text>}
          />
        </View>
      ) : (
        <FlatList
          data={importantItems}
          keyExtractor={(item) => item.msg_id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <TouchableOpacity onPress={() => openMessageResult(item)}>
                <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 4 }}>{item.messageType || 'Importante'}</Text>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>{resolveChatName(item)}</Text>
                <Text style={{ color: colors.textSecondary }} numberOfLines={2}>{item.text || item.fileName || 'Sin contenido'}</Text>
                <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>
                  {[item.itemType, item.threadTopic, item.requiresAck ? 'Checker' : null].filter(Boolean).join(' · ') || 'Mensaje destacado'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => hideImportantItem(item)} style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Quitar de mi bandeja</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: colors.textMuted, padding: 16 }}>Tu bandeja de importantes en {scopeLabel} esta tranquila por ahora.</Text>}
        />
      )}


      {/* MenÃº desplegable */}
      {dropdownMenu}
    </View>
  );

  const EmptyChatPanel = () => (
    <View style={[s.emptyChatPanel, { backgroundColor: colors.background }]}>
      <TuChatLogoColor size={80} />
      <Text style={[s.emptyChatTitle, { color: colors.textPrimary }]}>TuChat para Educacion</Text>
      <Text style={[s.emptyChatSubtitle, { color: colors.textSecondary }]}>Selecciona una conversacion para ver los mensajes</Text>
    </View>
  );

  if (isDesktop) {
    return (
      <View style={[s.desktopContainer, { backgroundColor: colors.background }]}>
        {chatListContent}
        <View style={[s.chatPanelContainer, { backgroundColor: colors.background }]}>
          {selectedChat ? (
            <ChatScreen
              key={selectedChat.navigationKey || `${selectedChat.id_chat}:${selectedChat.targetMsgId || selectedChat.targetPanel || 'chat'}`}
              id={selectedChat.id_chat}
              nombre={selectedChat.nombre}
              tipo={selectedChat.tipo}
              targetMsgId={selectedChat.targetMsgId}
              targetPanel={selectedChat.targetPanel}
              isEmbedded={true}
              onBack={() => setSelectedChat(null)}
            />
          ) : (
            <EmptyChatPanel />
          )}
        </View>
      </View>
    );
  }

  return <View style={[s.container, { backgroundColor: colors.background }]}>{chatListContent}</View>;
};

// ============ ESTILOS ============

const s = StyleSheet.create({
  container: { flex: 1 },
  desktopContainer: { flex: 1, flexDirection: 'row' },
  chatListContainer: { flex: 1 },
  chatListContainerDesktop: { width: 380, maxWidth: 380, borderRightWidth: 1, borderRightColor: '#e2e8f0' }, // border will be themed
  chatPanelContainer: { flex: 1 },
  quickActionsBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1 },
  quickActionIconButton: { width: 48, minHeight: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quickActionButton: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: '700' },
  sidePanelBody: { flex: 1 },
  scopeBanner: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  scopeBannerTitle: { fontSize: 13, fontWeight: '700' },
  scopeBannerText: { fontSize: 12, marginTop: 2 },
  searchPanelCard: { margin: 16, marginBottom: 12, borderWidth: 1, borderRadius: 18, padding: 16 },
  searchPanelTitle: { fontSize: 16, fontWeight: '700' },
  searchPanelSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },

  emptyChatPanel: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyChatTitle: { fontSize: 26, fontWeight: '300', marginTop: 20, marginBottom: 10 },
  emptyChatSubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 350 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#6366f1',
    paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 44 : 14,
  },
  headerDesktop: { paddingTop: 14 },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  mainSubtitle: { fontSize: 12, marginTop: 2 },
  menuButton: {
    padding: 8,
    borderRadius: 20,
  },
  // MenÃº desplegable
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : Platform.OS === 'android' ? 80 : 52,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  menuContainerDesktop: {
    left: 180,
    top: 52,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  menuItemTextDanger: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
  },

  // Tabs
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: {},
  tabBadge: { backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Lista
  list: { paddingVertical: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Chat card
  chatCard: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', backgroundColor: '#fff' },
  chatCardSelected: { backgroundColor: '#ede9fe' }, // will be overridden dynamically

  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarPrivate: { backgroundColor: '#10b981' },
  avatarText: { color: '#fff', fontWeight: '600', fontSize: 18 },

  chatContent: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  chatTitle: { fontSize: 16, fontWeight: '500', flex: 1, marginRight: 8 },
  chatTitleUnread: { fontWeight: '700' },

  timeText: { fontSize: 12 },
  timeTextUnread: { fontWeight: '600' },

  lastMessageContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  tickContainer: { marginRight: 4 },
  lastMessage: { fontSize: 14, flex: 1 },
  lastMessageUnread: { color: '#1e293b', fontWeight: '500' },

  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});


