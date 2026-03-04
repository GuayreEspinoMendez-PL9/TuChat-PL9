import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { saveMessageLocal, getAllUnreadCounts } from '../db/database';
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

  // Usamos ref para el chat activo para que el listener de socket 
  // siempre tenga el valor real sin reiniciarse
  const activeRoomIdRef = useRef<string | null>(null);
  const appState = useRef(AppState.currentState);

  // Función para refrescar contadores
  const refreshUnreadCounts = useCallback(() => {
    try {
      const counts = typeof getAllUnreadCounts === 'function' ? getAllUnreadCounts() : {};
      setUnreadCounts(counts);
      console.log('🔄 Contadores actualizados:', counts);
    } catch (e) {
      console.error("Error refreshing unread counts:", e);
    }
  }, []);

  // Función para establecer chat activo
  const setActiveRoom = useCallback((roomId: string | null) => {
    activeRoomIdRef.current = roomId;
    console.log('🎯 Chat activo (Ref):', roomId);
  }, []);

  useEffect(() => {
    let newSocket: Socket | null = null;

    const initSocket = async () => {
      try {
        const token = Platform.OS === 'web'
          ? localStorage.getItem('token')
          : await SecureStore.getItemAsync('token');

        if (!token) {
          console.log('⚠️ No hay token, reintentando en breve...');
          return;
        }

        // Decodificación segura del token (Cross-Platform)
        const decoded = decodeJwt(token);
        const userId = decoded?.sub;

        if (!userId) {
          console.error("Token inválido o error al decodificar");
          return;
        }

        // Configuración optimizada para INCÓGNITO y WEB
        newSocket = io(API_URL, {
          autoConnect: true,
          query: { userId },
          transports: ['websocket'], // Obligatorio para evitar bloqueos en incógnito
          upgrade: false,
          reconnection: true,
          reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
          console.log('🟢 Socket conectado globalmente:', newSocket?.id);
          setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
          console.log('🔴 Socket desconectado');
          setIsConnected(false);
        });

        // ESCUCHA GLOBAL PERMANENTE
        newSocket.on('chat:receive', (msg) => {
          console.log('📨 Mensaje recibido globalmente:', msg);

          const isMe = msg.senderId === userId;

          const messageToSave = {
            ...msg,
            isMe,
            read: isMe || msg.roomId === activeRoomIdRef.current ? true : false
          };

          // 1. Guardar siempre en local
          if (typeof saveMessageLocal === 'function') saveMessageLocal(messageToSave);

          // 2. Si no es mi mensaje y no estoy viendo ese chat, actualizar globos (badges)
          if (!isMe && msg.roomId !== activeRoomIdRef.current) {
            refreshUnreadCounts();
          }
        });

        setSocket(newSocket);
        refreshUnreadCounts();

      } catch (error) {
        console.error('Error inicializando socket:', error);
      }
    };

    initSocket();

    return () => {
      if (newSocket) {
        console.log('🔌 Desconectando socket global');
        newSocket.disconnect();
      }
    };
  }, [refreshUnreadCounts]); // refreshUnreadCounts es estable gracias a useCallback

  // Manejar AppState
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App volvió al primer plano');
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