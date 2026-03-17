import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { saveMessageLocal, getAllUnreadCounts, updateMessageLocal } from '../db/database';
import { decodeJwt } from '../utils/auth';

const API_URL = "https://tuchat-pl9.onrender.com";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  unreadCounts: Record<string, number>;
  refreshUnreadCounts: () => void;
  setActiveRoom: (roomId: string | null) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  unreadCounts: {},
  refreshUnreadCounts: () => { },
  setActiveRoom: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Ref para saber que chat esta abierto sin reinstalar listeners
  const activeRoomIdRef = useRef<string | null>(null);
  const appState = useRef(AppState.currentState);

  const refreshUnreadCounts = useCallback(() => {
    try {
      const counts = typeof getAllUnreadCounts === 'function' ? getAllUnreadCounts() : {};
      setUnreadCounts(counts);
      console.log('Contadores actualizados:', counts);
    } catch (e) {
      console.error('Error refreshing unread counts:', e);
    }
  }, []);

  const setActiveRoom = useCallback((roomId: string | null) => {
    activeRoomIdRef.current = roomId;
    console.log('Chat activo (Ref):', roomId);
  }, []);

  useEffect(() => {
    let newSocket: Socket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const scheduleRetry = (ms = 600) => {
      if (destroyed || newSocket) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!destroyed) initSocket();
      }, ms);
    };

    const initSocket = async () => {
      try {
        if (destroyed || newSocket) return;

        const token = Platform.OS === 'web'
          ? localStorage.getItem('token')
          : await SecureStore.getItemAsync('token');

        // Cuando app arranca sin token (antes de login), reintenta solo.
        if (!token) {
          scheduleRetry(600);
          return;
        }

        const decoded = decodeJwt(token);
        const userId = decoded?.sub;

        if (!userId) {
          console.error('Token invalido o error al decodificar');
          scheduleRetry(1200);
          return;
        }

        newSocket = io(API_URL, {
          autoConnect: true,
          query: { userId },
          transports: ['websocket'],
          upgrade: false,
          reconnection: true,
          reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
          console.log('Socket conectado globalmente:', newSocket?.id);
          setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
          console.log('Socket desconectado');
          setIsConnected(false);
        });

        newSocket.on('chat:receive', (msg) => {
          const isMe = msg.senderId === userId;

          const messageToSave = {
            ...msg,
            isMe,
            read: isMe || msg.roomId === activeRoomIdRef.current ? true : false
          };

          if (typeof saveMessageLocal === 'function') saveMessageLocal(messageToSave);

          if (!isMe && msg.roomId !== activeRoomIdRef.current) {
            refreshUnreadCounts();
          }
        });

        newSocket.on('chat:msg_sent', ({ msg_id }) => {
          if (typeof updateMessageLocal === 'function') updateMessageLocal(msg_id, { status: 'sent' });
        });

        newSocket.on('chat:update_delivered_status', ({ msg_id }) => {
          if (typeof updateMessageLocal === 'function') updateMessageLocal(msg_id, { status: 'delivered', delivered: true });
        });

        newSocket.on('chat:update_read_status', ({ msg_id }) => {
          if (typeof updateMessageLocal === 'function') updateMessageLocal(msg_id, {
            status: 'read',
            delivered: true,
            read: true,
            readByRecipient: true,
          });
        });

        setSocket(newSocket);
        refreshUnreadCounts();

      } catch (error) {
        console.error('Error inicializando socket:', error);
        scheduleRetry(1500);
      }
    };

    initSocket();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (newSocket) {
        console.log('Desconectando socket global');
        newSocket.disconnect();
      }
    };
  }, [refreshUnreadCounts]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App volvio al primer plano');
        refreshUnreadCounts();
        if (socket && !socket.connected) socket.connect();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [refreshUnreadCounts, socket]);

  const value = {
    socket,
    isConnected,
    unreadCounts,
    refreshUnreadCounts,
    setActiveRoom,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
