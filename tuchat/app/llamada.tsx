import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet, Alert, Dimensions, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { MonitorUp, Users } from 'lucide-react-native';
import { useSocket } from '../src/context/SocketContext';

const WebRTC = Platform.OS !== 'web' ? require('react-native-webrtc') : null;
const API_URL = "https://tuchat-pl9.onrender.com";

// Configuración ICE por defecto (solo STUN, funciona en misma red)
// Se sobreescribe con TURN al conectar (necesario para móvil 4G ↔ escritorio)
let iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

// Cargar configuración ICE con servidores TURN desde el servidor
const loadIceConfig = async () => {
  try {
    const res = await fetch(`${API_URL}/meet/ice-config`);
    const data = await res.json();
    if (data.iceServers) {
      iceConfiguration = { iceServers: data.iceServers };
      console.log('✅ ICE config cargada con TURN:', data.iceServers.length, 'servidores');
    }
  } catch (e) {
    console.warn('⚠️ No se pudo cargar ICE config, usando solo STUN:', e);
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Detectar si es web móvil (iOS Safari / Chrome Android)
const isMobileWeb =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad/i.test(navigator.userAgent ?? '');

const AVATAR_COLORS = [
  '#1e40af', '#be123c', '#065f46', '#7c2d12',
  '#581c87', '#0f766e', '#a16207', '#1e3a8a'
];

// ─── Iconos ───────────────────────────────────────────────
const MicIcon = ({ muted }: { muted: boolean }) => (
  <Svg viewBox="0 0 24 24" fill="none" stroke={muted ? '#ef4444' : '#fff'} strokeWidth={2} style={{ width: 24, height: 24 }}>
    {muted ? (
      <>
        <Path d="M2 2l20 20M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </Svg>
);

const VideoIcon = ({ disabled }: { disabled: boolean }) => (
  <Svg viewBox="0 0 24 24" fill="none" stroke={disabled ? '#ef4444' : '#fff'} strokeWidth={2} style={{ width: 24, height: 24 }}>
    {disabled ? (
      <>
        <Path d="m2 2 20 20M10.66 5H14l3.5 3.5v6.17" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 18h-6L4 14V8.83M16 16v2l4 2V4l-4 2v4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <Path d="m16 10 4-4v12l-4-4M2 6h12v12H2z" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </Svg>
);

const ScreenShareIcon = () => (
  <Svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} style={{ width: 24, height: 24 }}>
    <Path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m8 21 4-4 4 4M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m17 8 5-5M22 8h-5V3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
// ─── Tipos ────────────────────────────────────────────────
interface ParticipantInfo {
  userId: string;
  stream: any;
  connected: boolean;
}

const getToken = async () => Platform.OS === 'web'
  ? localStorage.getItem('token')
  : await SecureStore.getItemAsync('token');

const getStoredUserData = async () => {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem('userData')
      : await SecureStore.getItemAsync('userData');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getFallbackName = (id: string) => {
  const normalized = String(id || '').trim();
  if (!normalized) return 'Participante';
  return `Usuario ${normalized.slice(0, 6)}`;
};

// ─── Componente principal ─────────────────────────────────
export default function MeetScreen() {
  const params = useLocalSearchParams();
  const { socket } = useSocket();

  const roomId = String(params.roomId || '');
  const userId = String(params.from || '');
  const callType = String(params.type || 'audio');

  const [localStream, setLocalStream] = useState<any>(null);
  const [status, setStatus] = useState('Conectando...');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [screenSharers, setScreenSharers] = useState<Map<string, string>>(new Map());
  const [selectedMainStream, setSelectedMainStream] = useState<string | null>(null);
  const [speakingStates, setSpeakingStates] = useState<Record<string, boolean>>({});

  // Contador para forzar re-mount de <video> tras renegociación (pantalla compartida)
  const [renegotiationCount, setRenegotiationCount] = useState(0);

  // Map de participantes remotos (con o sin stream)
  const [participants, setParticipants] = useState<Map<string, ParticipantInfo>>(new Map());
  // Contador independiente: no depende de si hay stream, sube al conectarse
  const [remoteCount, setRemoteCount] = useState(0);

  const localStreamRef = useRef<any>(null);
  const screenStreamRef = useRef<any>(null);
  const peersRef = useRef<Map<string, any>>(new Map());
  const audioAnalyzersRef = useRef<Map<string, { intervalId: number; cleanup: () => void }>>(new Map());
  const [, forceUpdate] = useState(0);

  // ─── Validación ───────────────────────────────────────
  useEffect(() => {
    if (!roomId || roomId === 'null' || roomId === 'undefined' || roomId.trim() === '') {
      Alert.alert('Error', 'ID de sala inválido', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      Alert.alert('Error', 'ID de usuario inválido', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    console.log(`🎬 Iniciando llamada:`, { roomId, userId, type: callType });
  }, []);

  useEffect(() => {
    const loadParticipantNames = async () => {
      try {
        const [token, userData] = await Promise.all([getToken(), getStoredUserData()]);
        const currentUserName = userData?.nombre || userData?.name || '';

        setParticipantNames(prev => ({
          ...prev,
          ...(currentUserName ? { [userId]: currentUserName } : {})
        }));

        if (!token || !roomId) return;

        const res = await fetch(`${API_URL}/academico/miembros-detalle/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data?.ok || !Array.isArray(data.usuarios)) return;

        const nextNames: Record<string, string> = {};
        data.usuarios.forEach((u: any) => {
          nextNames[String(u.id)] = u.nombre || getFallbackName(String(u.id));
        });
        if (currentUserName) nextNames[userId] = currentUserName;
        setParticipantNames(prev => ({ ...prev, ...nextNames }));
      } catch (e) {
        console.log('⚠️ No se pudieron cargar nombres de participantes:', e);
      }
    };

    loadParticipantNames();
  }, [roomId, userId]);

  // ─── Permisos adaptados a web móvil ───────────────────
  const requestPermissions = async () => {
    const wantsVideo = callType === 'video';

    if (Platform.OS === 'web') {
      const videoConstraints = isMobileWeb
        ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        : true;

      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          wantsVideo ? { audio: true, video: videoConstraints } : { audio: true, video: false }
        );
        console.log('✅ getUserMedia OK:', wantsVideo ? 'Audio+Video' : 'Audio');
        setHasAudio(stream.getAudioTracks().length > 0);
        setHasVideo(stream.getVideoTracks().length > 0);
        return stream;
      } catch (e: any) {
        console.log('⚠️ getUserMedia falló:', e.name, e.message);
        if (wantsVideo && e.name !== 'NotAllowedError' && e.name !== 'PermissionDeniedError') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            console.log('✅ Fallback: Solo audio');
            setHasAudio(stream.getAudioTracks().length > 0);
            setHasVideo(false);
            return stream;
          } catch (e2: any) {
            console.log('❌ Audio también falló:', e2.name);
          }
        }
      }
      setHasAudio(false);
      setHasVideo(false);
      return null;
    }

    // Nativo
    if (wantsVideo) {
      try {
        const stream = await WebRTC.mediaDevices.getUserMedia({ audio: true, video: true });
        setHasAudio(stream.getAudioTracks().length > 0);
        setHasVideo(stream.getVideoTracks().length > 0);
        return stream;
      } catch (e) { console.log('⚠️ Nativo audio+video falló:', e); }
    }
    try {
      const stream = await WebRTC.mediaDevices.getUserMedia({ audio: true, video: false });
      setHasAudio(stream.getAudioTracks().length > 0);
      setHasVideo(false);
      return stream;
    } catch (e) { console.log('⚠️ Nativo audio falló:', e); }

    setHasAudio(false);
    setHasVideo(false);
    return null;
  };

  const getDisplayName = (participantUserId: string, isLocal = false) => {
    if (isLocal) return 'Tú';
    return participantNames[String(participantUserId)] || getFallbackName(String(participantUserId));
  };

  const monitorSpeaking = (key: string, stream: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !stream?.getAudioTracks?.().length) return;
    if (audioAnalyzersRef.current.has(key)) return;

    const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const intervalId = window.setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, value) => sum + value, 0) / Math.max(1, dataArray.length);
        const speaking = avg > 14;
        setSpeakingStates(prev => prev[key] === speaking ? prev : { ...prev, [key]: speaking });
      }, 180);

      audioAnalyzersRef.current.set(key, {
        intervalId,
        cleanup: () => {
          window.clearInterval(intervalId);
          source.disconnect();
          analyser.disconnect();
          context.close?.();
        }
      });
    } catch (e) {
      console.log('⚠️ No se pudo iniciar detección de voz:', e);
    }
  };

  const stopMonitoringSpeaking = (key: string) => {
    const current = audioAnalyzersRef.current.get(key);
    if (!current) return;
    current.cleanup();
    audioAnalyzersRef.current.delete(key);
    setSpeakingStates(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ─── PeerConnection ───────────────────────────────────
  const createPeerConnection = (socketId: string, participantUserId: string) => {
    console.log(`🔗 Creando PC con ${socketId}`);
    const PC = Platform.OS === 'web' ? RTCPeerConnection : WebRTC.RTCPeerConnection;
    const pc = new PC(iceConfiguration);

    const currentStream = localStreamRef.current;
    if (currentStream) {
      if (Platform.OS === 'web') {
        currentStream.getTracks().forEach((track: any) => pc.addTrack(track, currentStream));
        console.log(`📡 Añadidos ${currentStream.getTracks().length} tracks locales a PC ${socketId}`);
      } else {
        pc.addStream(currentStream);
      }
    } else if (Platform.OS === 'web') {
      // Sin stream local (ej: ordenador sin cámara/micro), SIEMPRE añadir transceivers.
      // Sin transceivers el navegador no genera candidatos ICE → ICE se queda en "checking"
      // sendrecv en lugar de recvonly para que el peer remoto también pueda enviar sin problemas
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
      console.log(`📡 Sin stream local: añadidos transceivers recvonly a PC ${socketId}`);
    }

    pc.onicecandidate = (e: any) => {
      if (e.candidate && socket) {
        console.log(`🧊 ICE candidate generado para ${socketId}: ${e.candidate.type}`);
        socket.emit('meet:ice-candidate', { to: socketId, candidate: e.candidate, roomId });
      } else if (!e.candidate) {
        console.log(`🧊 ICE gathering completo para ${socketId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`🔌 ICE ${socketId}: ${state}`);

      // Guardar estado ICE en el peer para que renegotiateWithAllPeers pueda esperarlo
      const peer = peersRef.current.get(socketId);
      if (peer) peer.iceState = state;

      if (state === 'failed') {
        console.log('🔁 ICE failed, reiniciando...');
        pc.restartIce();
      }
    };

    if (Platform.OS === 'web') {
      pc.ontrack = (e: any) => {
        if (e.streams && e.streams[0]) {
          console.log(`🎬 Track recibido de ${socketId}: ${e.track.kind}`);
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(socketId, { userId: participantUserId, stream: e.streams[0], connected: true });
            return newMap;
          });
          forceUpdate(n => n + 1);
        }
      };
    } else {
      pc.onaddstream = (e: any) => {
        console.log(`🎬 Stream nativo de ${socketId}`);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(socketId, { userId: participantUserId, stream: e.stream, connected: true });
          return newMap;
        });
        forceUpdate(n => n + 1);
      };
    }

    return pc;
  };

  // Esperar a que un peer tenga ICE connected/completed (con timeout de seguridad)
  const waitForIceConnected = (socketId: string, timeoutMs = 8000): Promise<void> => {
    return new Promise(resolve => {
      const peer = peersRef.current.get(socketId);
      if (!peer) { resolve(); return; }
      const state = peer.peerConnection.iceConnectionState;
      if (state === 'connected' || state === 'completed') { resolve(); return; }

      const timeout = setTimeout(resolve, timeoutMs);
      const handler = () => {
        const s = peer.peerConnection.iceConnectionState;
        if (s === 'connected' || s === 'completed' || s === 'failed' || s === 'closed') {
          clearTimeout(timeout);
          peer.peerConnection.removeEventListener?.('iceconnectionstatechange', handler);
          resolve();
        }
      };
      peer.peerConnection.addEventListener?.('iceconnectionstatechange', handler);
    });
  };

  // ─── Renegociación (compartir pantalla) ───────────────
  const renegotiateWithAllPeers = async (newStream: any) => {
    console.log('🔄 Iniciando renegociación para', peersRef.current.size, 'peers');

    for (const [socketId, peer] of peersRef.current.entries()) {
      const pc = peer.peerConnection;
      const iceState = pc.iceConnectionState;
      console.log(`🔌 Estado ICE antes de renegociar con ${socketId}: ${iceState}`);

      // Esperar a que ICE esté estable antes de renegociar
      // Si renegociamos mientras ICE está en "checking", la conexión se rompe
      if (iceState === 'checking' || iceState === 'new') {
        console.log(`⏳ Esperando ICE connected para ${socketId}...`);
        await new Promise<void>(resolve => {
          const timeout = setTimeout(() => {
            console.warn(`⚠️ Timeout esperando ICE connected para ${socketId}, continuando de todas formas`);
            resolve();
          }, 10000);
          const check = () => {
            const s = pc.iceConnectionState;
            if (s === 'connected' || s === 'completed' || s === 'failed' || s === 'closed') {
              clearTimeout(timeout);
              pc.removeEventListener('iceconnectionstatechange', check);
              resolve();
            }
          };
          pc.addEventListener('iceconnectionstatechange', check);
          // Comprobar de inmediato por si ya cambió
          check();
        });
        console.log(`✅ ICE resuelto para ${socketId}: ${pc.iceConnectionState}`);
      }

      if (pc.iceConnectionState === 'closed' || pc.signalingState === 'closed') {
        console.warn(`⚠️ PC cerrada para ${socketId}, saltando renegociación`);
        continue;
      }

      if (Platform.OS === 'web') {
        const senders = pc.getSenders();
        const newTracks = newStream.getTracks();
        let needsFullRenegotiation = false;

        for (const newTrack of newTracks) {
          const matchingSender = senders.find((s: any) => s.track?.kind === newTrack.kind);
          if (matchingSender) {
            try {
              await matchingSender.replaceTrack(newTrack);
              console.log(`🔄 replaceTrack OK: ${newTrack.kind} → ${socketId}`);
            } catch (e) {
              console.warn(`⚠️ replaceTrack falló, forzando renegociación:`, e);
              needsFullRenegotiation = true;
              break;
            }
          } else {
            needsFullRenegotiation = true;
          }
        }

        if (!needsFullRenegotiation) {
          console.log(`✅ replaceTrack fue suficiente para ${socketId}, sin renegociación`);
          continue;
        }

        // Renegociación completa (nuevo tipo de track)
        senders.forEach((s: any) => pc.removeTrack(s));
        newStream.getTracks().forEach((track: any) => pc.addTrack(track, newStream));
      } else {
        pc.getSenders().forEach((s: any) => pc.removeTrack(s));
        pc.addStream(newStream);
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('meet:offer', { to: socketId, offer, roomId, isRenegotiation: true });
        console.log(`📤 Offer de renegociación enviada a ${socketId}`);
      } catch (e) {
        console.error(`❌ Error creando offer de renegociación para ${socketId}:`, e);
      }
    }

    setRenegotiationCount(n => n + 1);
  };

  // ─── Efecto principal ─────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId || !socket) return;
    console.log(`🎯 Socket global:`, socket.id);

    const init = async () => {
      // CRÍTICO: obtener stream ANTES de emitir meet:join
      // Si emitimos antes, el ordenador nos envía offer cuando aún no tenemos tracks
      const stream = await requestPermissions();
      if (stream) {
        setLocalStream(stream);
        localStreamRef.current = stream;
        console.log('📡 Stream listo, tracks:', stream.getTracks().map((t: any) => t.kind));
      }

      // Cargar servidores TURN antes de crear ninguna PeerConnection
      // Sin TURN, móvil 4G ↔ escritorio falla siempre (ICE queda en "checking")
      await loadIceConfig();

      setStatus('Conectando...');
      socket.emit('meet:join', { roomId, userId, type: callType });

      const handleParticipants = async (data: any) => {
        console.log(`👥 Participantes existentes: ${data.participants.length}`);
        // Registrar contador inmediatamente, sin esperar stream
        setRemoteCount(data.participants.length);
        if (Array.isArray(data.screenSharers)) {
          setScreenSharers(new Map(data.screenSharers.map((item: any) => [item.socketId, item.userId])));
        }

        for (const p of data.participants) {
          // Registrar en mapa aunque no haya stream aún
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(p.socketId, { userId: p.userId, stream: null, connected: false });
            return newMap;
          });

          const pc = createPeerConnection(p.socketId, p.userId);
          peersRef.current.set(p.socketId, { peerConnection: pc, userId: p.userId });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('meet:offer', { to: p.socketId, offer, roomId });
        }
        setStatus('');
      };

      const handleUserJoined = (data: any) => {
        console.log(`➕ Nuevo participante: ${data.userId} (${data.socketId})`);
        // Registrar inmediatamente en contador y mapa
        setRemoteCount(prev => prev + 1);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(data.socketId, { userId: data.userId, stream: null, connected: false });
          return newMap;
        });

        const pc = createPeerConnection(data.socketId, data.userId);
        peersRef.current.set(data.socketId, { peerConnection: pc, userId: data.userId });
      };

      const handleScreenShareState = (data: any) => {
        setScreenSharers(prev => {
          const next = new Map(prev);
          if (data.isSharing) next.set(data.socketId, data.userId);
          else next.delete(data.socketId);
          return next;
        });
      };

      const handleOffer = async (data: any) => {
        console.log(`📥 Offer de ${data.from} (renegotiation: ${!!data.isRenegotiation})`);

        let peer = peersRef.current.get(data.from);
        if (!peer) {
          const pc = createPeerConnection(data.from, 'unknown');
          peer = { peerConnection: pc, userId: 'unknown' };
          peersRef.current.set(data.from, peer);
          setRemoteCount(prev => prev + 1);
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(data.from, { userId: 'unknown', stream: null, connected: false });
            return newMap;
          });
        }

        // Al recibir renegociación, forzar re-mount del <video> (fix pantalla negra en móvil)
        if (data.isRenegotiation) {
          setRenegotiationCount(n => n + 1);
        }

        const SD = Platform.OS === 'web' ? RTCSessionDescription : WebRTC.RTCSessionDescription;
        await peer.peerConnection.setRemoteDescription(new SD(data.offer));

        // Procesar candidatos ICE que llegaron antes que la descripción remota
        if (peer.pendingCandidates?.length) {
          const ICE = Platform.OS === 'web' ? RTCIceCandidate : WebRTC.RTCIceCandidate;
          for (const c of peer.pendingCandidates) {
            try { await peer.peerConnection.addIceCandidate(new ICE(c)); } catch (e) { }
          }
          peer.pendingCandidates = [];
        }

        const answer = await peer.peerConnection.createAnswer();
        await peer.peerConnection.setLocalDescription(answer);
        socket.emit('meet:answer', { to: data.from, answer, roomId });
      };

      const handleAnswer = async (data: any) => {
        const peer = peersRef.current.get(data.from);
        if (peer) {
          const SD = Platform.OS === 'web' ? RTCSessionDescription : WebRTC.RTCSessionDescription;
          await peer.peerConnection.setRemoteDescription(new SD(data.answer));

          // Procesar candidatos ICE pendientes
          if (peer.pendingCandidates?.length) {
            const ICE = Platform.OS === 'web' ? RTCIceCandidate : WebRTC.RTCIceCandidate;
            for (const c of peer.pendingCandidates) {
              try { await peer.peerConnection.addIceCandidate(new ICE(c)); } catch (e) { }
            }
            peer.pendingCandidates = [];
          }
        }
      };

      const handleIceCandidate = async (data: any) => {
        const peer = peersRef.current.get(data.from);
        if (!peer) return;
        const ICE = Platform.OS === 'web' ? RTCIceCandidate : WebRTC.RTCIceCandidate;
        try {
          if (peer.peerConnection.remoteDescription) {
            await peer.peerConnection.addIceCandidate(new ICE(data.candidate));
          } else {
            // Guardar candidato hasta que llegue la descripción remota
            if (!peer.pendingCandidates) peer.pendingCandidates = [];
            peer.pendingCandidates.push(data.candidate);
          }
        } catch (e) {
          console.error('Error ICE candidate:', e);
        }
      };

      const handleUserLeft = (data: any) => {
        console.log(`👋 Salió: ${data.socketId}`);
        const peer = peersRef.current.get(data.socketId);
        if (peer) {
          peer.peerConnection.close();
          peersRef.current.delete(data.socketId);
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.socketId);
            return newMap;
          });
          setRemoteCount(prev => Math.max(0, prev - 1));
        }
        setScreenSharers(prev => {
          const next = new Map(prev);
          next.delete(data.socketId);
          return next;
        });
      };

      const handleError = (data: any) => {
        console.error('❌ Error servidor:', data.msg);
        Alert.alert('Error', data.msg);
      };

      socket.on('meet:participants', handleParticipants);
      socket.on('meet:user-joined', handleUserJoined);
      socket.on('meet:offer', handleOffer);
      socket.on('meet:answer', handleAnswer);
      socket.on('meet:ice-candidate', handleIceCandidate);
      socket.on('meet:user-left', handleUserLeft);
      socket.on('meet:screen-share-state', handleScreenShareState);
      socket.on('meet:error', handleError);

      return () => {
        socket.off('meet:participants', handleParticipants);
        socket.off('meet:user-joined', handleUserJoined);
        socket.off('meet:offer', handleOffer);
        socket.off('meet:answer', handleAnswer);
        socket.off('meet:ice-candidate', handleIceCandidate);
        socket.off('meet:user-left', handleUserLeft);
        socket.off('meet:screen-share-state', handleScreenShareState);
        socket.off('meet:error', handleError);
      };
    };

    const cleanup = init();
    return () => {
      cleanup.then(fn => fn?.());
      endCall();
    };
  }, [socket, roomId, userId, callType]);

  useEffect(() => {
    const remoteKeys = new Set<string>();
    participants.forEach((participant, socketId) => {
      if (participant.stream?.getAudioTracks?.().length) {
        const key = `remote:${socketId}`;
        remoteKeys.add(key);
        monitorSpeaking(key, participant.stream);
      }
    });

    if (localStream?.getAudioTracks?.().length) {
      monitorSpeaking('local', localStream);
    } else {
      stopMonitoringSpeaking('local');
    }

    for (const existingKey of Array.from(audioAnalyzersRef.current.keys())) {
      if (existingKey === 'local') continue;
      if (!remoteKeys.has(existingKey)) stopMonitoringSpeaking(existingKey);
    }

    return () => {
      if (!localStream?.getAudioTracks?.().length) stopMonitoringSpeaking('local');
    };
  }, [participants, localStream]);

  useEffect(() => {
    return () => {
      for (const key of Array.from(audioAnalyzersRef.current.keys())) {
        stopMonitoringSpeaking(key);
      }
    };
  }, []);

  // ─── Controles ────────────────────────────────────────
  const toggleMute = () => {
    if (!localStreamRef.current || !hasAudio) return;
    localStreamRef.current.getAudioTracks().forEach((t: any) => { t.enabled = !t.enabled; });
    setIsMuted(v => !v);
  };

  const enableCamera = async () => {
    try {
      const videoConstraints = Platform.OS === 'web'
        ? (isMobileWeb ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : true)
        : true;

      const cameraStream = Platform.OS === 'web'
        ? await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints })
        : await WebRTC.mediaDevices.getUserMedia({ audio: false, video: true });

      const videoTrack = cameraStream.getVideoTracks?.()[0];
      if (!videoTrack) throw new Error('No se obtuvo track de vídeo');

      if (localStreamRef.current) {
        localStreamRef.current.addTrack(videoTrack);
      } else {
        const MediaStreamCtor = Platform.OS === 'web' ? MediaStream : WebRTC.MediaStream;
        localStreamRef.current = new MediaStreamCtor([videoTrack]);
      }

      setLocalStream(localStreamRef.current);
      setHasVideo(true);
      setIsVideoOff(false);
      await renegotiateWithAllPeers(localStreamRef.current);
      return true;
    } catch (e: any) {
      console.error('❌ No se pudo activar la cámara:', e);
      Alert.alert('Cámara', 'No se pudo activar la cámara. Revisa los permisos del navegador o del dispositivo.');
      return false;
    }
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current && !hasVideo) {
      await enableCamera();
      return;
    }

    const videoTracks = localStreamRef.current?.getVideoTracks?.() || [];
    if (!videoTracks.length) {
      await enableCamera();
      return;
    }

    videoTracks.forEach((t: any) => { t.enabled = !t.enabled; });
    setHasVideo(true);
    setIsVideoOff(v => !v);
  };

  const toggleScreenShare = async () => {
    if (Platform.OS !== 'web' || isMobileWeb) {
      Alert.alert('No disponible', 'Compartir pantalla solo está disponible en navegadores de escritorio');
      return;
    }
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t: any) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      socket?.emit('meet:screen-share-state', { roomId, userId, isSharing: false });
      if (localStreamRef.current) {
        setLocalStream(localStreamRef.current);
        await renegotiateWithAllPeers(localStreamRef.current);
      }
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { cursor: 'always' }, audio: false
        });
        screenStreamRef.current = screenStream;
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        socket?.emit('meet:screen-share-state', { roomId, userId, isSharing: true });
        await renegotiateWithAllPeers(screenStream);

        screenStream.getVideoTracks()[0].onended = async () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          socket?.emit('meet:screen-share-state', { roomId, userId, isSharing: false });
          if (localStreamRef.current) {
            setLocalStream(localStreamRef.current);
            await renegotiateWithAllPeers(localStreamRef.current);
          }
        };
      } catch (e) {
        console.error('Error compartiendo pantalla:', e);
      }
    }
  };

  const endCall = () => {
    peersRef.current.forEach(p => p.peerConnection?.close());
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    socket?.emit('meet:screen-share-state', { roomId, userId, isSharing: false });
    socket?.emit('meet:leave', { roomId, userId });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // ─── Render ───────────────────────────────────────────
  const remoteParticipantEntries = Array.from(participants.entries()).map(([socketId, info]) => ({ socketId, ...info }));
  const remoteParticipants = remoteParticipantEntries;

  // Usar remoteCount: sube al unirse, no depende de si hay stream
  const totalParticipants = remoteCount + 1;

  const hasLocalVideo = localStream &&
    localStream.getVideoTracks &&
    localStream.getVideoTracks().length > 0 &&
    !isVideoOff;

  const localCameraPreviewStream = !isScreenSharing
    ? localStream
    : (localStreamRef.current &&
      localStreamRef.current.getVideoTracks &&
      localStreamRef.current.getVideoTracks().length > 0 &&
      !isVideoOff
        ? localStreamRef.current
        : null);

  const hasRemoteVideo = remoteParticipants.some(p =>
    p.stream && p.stream.getVideoTracks && p.stream.getVideoTracks().length > 0
  );

  const showAvatarGrid = !hasLocalVideo && !hasRemoteVideo;

  const screenSharePresenters = Array.from(screenSharers.entries())
    .map(([socketId, sharerUserId]) => {
      const participant = participants.get(socketId);
      return participant?.stream ? {
        key: `remote:${socketId}`,
        socketId,
        userId: sharerUserId,
        stream: participant.stream,
        isLocal: false
      } : null;
    })
    .filter(Boolean) as Array<{ key: string; socketId: string; userId: string; stream: any; isLocal: boolean }>;

  if (isScreenSharing && localStream?.getVideoTracks?.().length) {
    screenSharePresenters.unshift({
      key: 'local',
      socketId: 'local',
      userId,
      stream: localStream,
      isLocal: true
    });
  }

  const mainPresenter = screenSharePresenters.find(p => p.key === selectedMainStream) || screenSharePresenters[0] || null;

  const remoteVideoThumbnails = remoteParticipants
    .filter(p => p.stream && p.stream.getVideoTracks && p.stream.getVideoTracks().length > 0 && `remote:${p.socketId}` !== mainPresenter?.key);
  const selectablePresenters = screenSharePresenters.filter(p => p.key !== mainPresenter?.key);
  const screenSharePresenterKeys = screenSharePresenters.map(p => p.key).join('|');

  useEffect(() => {
    if (!screenSharePresenters.length) {
      if (selectedMainStream !== null) setSelectedMainStream(null);
      return;
    }
    if (!selectedMainStream || !screenSharePresenters.some(p => p.key === selectedMainStream)) {
      setSelectedMainStream(screenSharePresenters[0].key);
    }
  }, [selectedMainStream, screenSharePresenterKeys]);

  const allParticipants = [
    { userId, isLocal: true },
    ...remoteParticipants.map(p => ({ userId: p.userId, isLocal: false }))
  ];

  const getSpeakingForParticipant = (participantUserId: string, isLocal: boolean) => {
    if (isLocal) return !!speakingStates.local;
    const entry = remoteParticipants.find(p => p.userId === participantUserId);
    return entry ? !!speakingStates[`remote:${entry.socketId}`] : false;
  };

  return (
    <View style={st.container}>
      <View pointerEvents="none" style={st.bgOrbTop} />
      <View pointerEvents="none" style={st.bgOrbBottom} />
      {showAvatarGrid ? (
        <View style={st.gridContainer}>
          {allParticipants.map((p, idx) => (
            <View key={idx} style={[st.avatarBox, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }, getSpeakingForParticipant(p.userId, p.isLocal) && st.speakingBox]}>
              <Text style={st.avatarText}>{getDisplayName(p.userId, p.isLocal).charAt(0).toUpperCase()}</Text>
              <Text style={st.avatarName}>{getDisplayName(p.userId, p.isLocal)}</Text>
            </View>
          ))}
        </View>
      ) : mainPresenter ? (
        <View style={st.presenterLayout}>
          <View style={[st.presenterStage, speakingStates[mainPresenter.key] && st.speakingBox]}>
            {Platform.OS === 'web' ? (
              <>
                <video
                  key={`main-${mainPresenter.key}-${renegotiationCount}`}
                  autoPlay
                  playsInline
                  muted={mainPresenter.isLocal}
                  ref={el => { if (el) el.srcObject = mainPresenter.stream; }}
                  style={st.video}
                />
                {!mainPresenter.isLocal && (
                  <audio
                    key={`main-audio-${mainPresenter.key}-${renegotiationCount}`}
                    autoPlay
                    playsInline
                    ref={el => { if (el) el.srcObject = mainPresenter.stream; }}
                    style={{ display: 'none' } as any}
                  />
                )}
              </>
            ) : (
              <WebRTC.RTCView streamURL={mainPresenter.stream.toURL()} style={st.video} objectFit="contain" />
            )}
            <View style={st.shareBadge}>
              <MonitorUp color="#fff" size={14} strokeWidth={2.2} />
              <Text style={st.shareBadgeText}>Compartiendo pantalla</Text>
            </View>
            <View style={st.nameTag}>
              <Text style={st.nameText}>{getDisplayName(mainPresenter.userId, mainPresenter.isLocal)}</Text>
            </View>
          </View>

          {selectablePresenters.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.presenterPicker} contentContainerStyle={st.presenterPickerContent}>
              {selectablePresenters.map(p => (
                <TouchableOpacity key={p.key} onPress={() => setSelectedMainStream(p.key)} style={[st.presenterChip, selectedMainStream === p.key && st.presenterChipActive]}>
                  <Text style={[st.presenterChipText, selectedMainStream === p.key && st.presenterChipTextActive]}>
                    {getDisplayName(p.userId, p.isLocal)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {remoteVideoThumbnails.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.thumbnailStrip} contentContainerStyle={st.thumbnailStripContent}>
              {remoteVideoThumbnails.map((p) => (
                <TouchableOpacity
                  key={p.socketId}
                  activeOpacity={0.92}
                  onPress={() => {
                    if (screenSharers.has(p.socketId)) setSelectedMainStream(`remote:${p.socketId}`);
                  }}
                  style={[
                    st.thumbnailCard,
                    screenSharers.has(p.socketId) && st.thumbnailCardSelectable,
                    speakingStates[`remote:${p.socketId}`] && st.speakingBox
                  ]}
                >
                  {Platform.OS === 'web' ? (
                    <>
                      <video
                        key={`thumb-${p.socketId}-${renegotiationCount}`}
                        autoPlay
                        playsInline
                        ref={el => { if (el) el.srcObject = p.stream; }}
                        style={st.thumbnailVideo}
                      />
                      <audio
                        key={`thumb-audio-${p.socketId}-${renegotiationCount}`}
                        autoPlay
                        playsInline
                        ref={el => { if (el) el.srcObject = p.stream; }}
                        style={{ display: 'none' } as any}
                      />
                    </>
                  ) : (
                    <WebRTC.RTCView streamURL={p.stream.toURL()} style={st.thumbnailVideo} objectFit="cover" />
                  )}
                  {screenSharers.has(p.socketId) && (
                    <View style={st.shareBadgeSmall}>
                      <MonitorUp color="#fff" size={12} strokeWidth={2.2} />
                    </View>
                  )}
                  <View style={st.nameTag}>
                    <Text style={st.nameText}>{getDisplayName(p.userId)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {isScreenSharing && localCameraPreviewStream && (
            <View style={[st.localVideoBox, speakingStates.local && st.speakingBox]}>
              {Platform.OS === 'web' ? (
                <video
                  key={`local-camera-preview-${localCameraPreviewStream.id}`}
                  autoPlay
                  playsInline
                  muted
                  ref={el => { if (el) el.srcObject = localCameraPreviewStream; }}
                  style={st.localVideo}
                />
              ) : (
                <WebRTC.RTCView streamURL={localCameraPreviewStream.toURL()} style={st.localVideo} objectFit="cover" />
              )}
              <View style={st.nameTag}>
                <Text style={st.nameText}>Tú</Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={st.videoGrid}>
          {remoteParticipants.map((p, idx) => p.stream && (
            <View key={idx} style={[st.videoBox, speakingStates[`remote:${p.socketId}`] && st.speakingBox]}>
              {Platform.OS === 'web' ? (
                <>
                  {/*
                    key incluye renegotiationCount: fuerza re-mount del <video> cuando
                    el emisor cambia a pantalla compartida. Sin esto el móvil se queda en negro.
                  */}
                  <video
                    key={`remote-${p.stream.id}-${renegotiationCount}`}
                    autoPlay
                    playsInline
                    ref={el => { if (el) el.srcObject = p.stream; }}
                    style={st.video}
                  />
                  {/*
                    Elemento <audio> separado para iOS Safari: garantiza que el audio
                    se escuche aunque el <video> no tenga contenido visual.
                  */}
                  <audio
                    key={`audio-${p.stream.id}-${renegotiationCount}`}
                    autoPlay
                    playsInline
                    ref={el => { if (el) el.srcObject = p.stream; }}
                    style={{ display: 'none' } as any}
                  />
                </>
              ) : (
                <WebRTC.RTCView streamURL={p.stream.toURL()} style={st.video} objectFit="cover" />
              )}
              <View style={st.nameTag}>
                <Text style={st.nameText}>{getDisplayName(p.userId)}</Text>
              </View>
            </View>
          ))}

          {hasLocalVideo && (
            <View style={[st.localVideoBox, speakingStates.local && st.speakingBox]}>
              {Platform.OS === 'web' ? (
                <video
                  key={`local-${localStream.id}`}
                  autoPlay playsInline muted
                  ref={el => { if (el) el.srcObject = localStream; }}
                  style={st.localVideo}
                />
              ) : (
                <WebRTC.RTCView streamURL={localStream.toURL()} style={st.localVideo} objectFit="cover" />
              )}
              <View style={st.nameTag}>
                <Text style={st.nameText}>Tú</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {status !== '' && (
        <View style={st.statusOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={st.statusText}>{status}</Text>
        </View>
      )}

      <View style={st.topBar}>
        <View style={st.callStatusPill}>
          <View style={st.callStatusDot} />
          <Text style={st.callStatusText}>{callType === 'video' ? 'Videollamada' : 'Llamada de audio'}</Text>
        </View>
      </View>

      <View style={st.infoBar}>
        <Users color="#a78bfa" size={14} strokeWidth={2.3} />
        <Text style={st.participantCount}>{totalParticipants}</Text>
      </View>

      <View style={st.controls}>
        <View style={st.controlsRow}>
          <TouchableOpacity style={[st.controlBtn, hasAudio && !isMuted && st.controlBtnEnabled, isMuted && st.controlBtnDanger]} onPress={toggleMute} disabled={!hasAudio}>
            <MicIcon muted={isMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[st.controlBtn, hasVideo && !isVideoOff && st.controlBtnEnabled, (isVideoOff || !hasVideo) && st.controlBtnDanger]} onPress={toggleVideo}>
            <VideoIcon disabled={isVideoOff || !hasVideo} />
          </TouchableOpacity>

          {Platform.OS === 'web' && !isMobileWeb && (
            <TouchableOpacity style={[st.controlBtn, isScreenSharing && st.controlBtnActive]} onPress={toggleScreenShare}>
              <ScreenShareIcon />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={st.hangupBtn} onPress={endCall}>
            <Text style={st.btnText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  bgOrbTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.18)'
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: 120,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.10)'
  },

  gridContainer: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap',
    padding: 24, justifyContent: 'center', alignContent: 'center', gap: 20
  },
  avatarBox: {
    width: SCREEN_WIDTH > 768 ? 200 : (SCREEN_WIDTH - 60) / 2,
    height: SCREEN_WIDTH > 768 ? 200 : (SCREEN_WIDTH - 60) / 2,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  avatarText: { fontSize: SCREEN_WIDTH > 768 ? 72 : 48, fontWeight: 'bold', color: '#fff' },
  avatarName: { marginTop: 10, fontSize: 14, color: '#fff', fontWeight: '700' },

  presenterLayout: { flex: 1, backgroundColor: '#000' },
  presenterStage: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 16,
    marginBottom: 10,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 10
  },
  presenterPicker: { position: 'absolute', top: 18, left: 14, right: 150, zIndex: 15, maxHeight: 44 },
  presenterPickerContent: { gap: 8, paddingRight: 12 },
  presenterChip: {
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  presenterChipActive: { backgroundColor: '#2563eb', borderColor: '#60a5fa' },
  presenterChipText: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  presenterChipTextActive: { color: '#fff' },
  thumbnailStrip: { position: 'absolute', left: 0, right: 0, bottom: 118, maxHeight: 118 },
  thumbnailStripContent: { paddingHorizontal: 14, gap: 10 },
  thumbnailCard: {
    width: 144,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  thumbnailCardSelectable: { borderColor: 'rgba(96,165,250,0.78)' },
  thumbnailVideo: { width: '100%', height: '100%', objectFit: 'cover' as any },
  videoGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#000' },
  videoBox: { width: '100%', height: '100%', position: 'relative', backgroundColor: '#000', borderWidth: 2, borderColor: 'rgba(255,255,255,0.04)' },
  video: { width: '100%', height: '100%', objectFit: 'contain' as any },

  localVideoBox: {
    position: 'absolute', bottom: 118, right: 20,
    width: 100, height: 150, borderRadius: 12,
    overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', zIndex: 20,
    backgroundColor: '#0f172a',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8
  },
  localVideo: { width: '100%', height: '100%', objectFit: 'cover' as any },
  speakingBox: { borderColor: '#22c55e', shadowColor: '#22c55e', shadowOpacity: 0.55, shadowRadius: 16, elevation: 8 },
  shareBadge: {
    position: 'absolute',
    top: 72,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37,99,235,0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  shareBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  shareBadgeSmall: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.92)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  nameTag: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: 'rgba(2,6,23,0.72)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  nameText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  statusOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', zIndex: 100
  },
  statusText: { color: '#fff', marginTop: 10, fontSize: 16 },

  topBar: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10
  },
  callStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  callStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e'
  },
  callStatusText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoBar: {
    position: 'absolute', top: 20, right: 20,
    backgroundColor: 'rgba(15,23,42,0.78)', paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  participantCount: { color: '#fff', fontSize: 14, fontWeight: '600' },

  controls: { position: 'absolute', bottom: 32, width: '100%', paddingHorizontal: 20, zIndex: 10 },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  controlBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center'
  },
  controlBtnEnabled: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#60a5fa'
  },
  controlBtnDanger: { backgroundColor: '#ef4444' },
  controlBtnActive: { backgroundColor: '#10b981' },
  hangupBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center'
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});
