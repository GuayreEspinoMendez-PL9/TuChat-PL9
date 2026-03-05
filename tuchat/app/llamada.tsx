import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet, Alert, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSocket } from '../src/context/SocketContext';

const WebRTC = Platform.OS !== 'web' ? require('react-native-webrtc') : null;
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
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

  // Contador para forzar re-mount de <video> tras renegociación (pantalla compartida)
  const [renegotiationCount, setRenegotiationCount] = useState(0);

  // Map de participantes remotos (con o sin stream)
  const [participants, setParticipants] = useState<Map<string, ParticipantInfo>>(new Map());
  // Contador independiente: no depende de si hay stream, sube al conectarse
  const [remoteCount, setRemoteCount] = useState(0);

  const localStreamRef = useRef<any>(null);
  const screenStreamRef = useRef<any>(null);
  const peersRef = useRef<Map<string, any>>(new Map());
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

  // ─── PeerConnection ───────────────────────────────────
  const createPeerConnection = (socketId: string, participantUserId: string) => {
    console.log(`🔗 Creando PC con ${socketId}`);
    const PC = Platform.OS === 'web' ? RTCPeerConnection : WebRTC.RTCPeerConnection;
    const pc = new PC(configuration);

    const currentStream = localStreamRef.current;
    if (currentStream) {
      if (Platform.OS === 'web') {
        currentStream.getTracks().forEach((track: any) => pc.addTrack(track, currentStream));
      } else {
        pc.addStream(currentStream);
      }
    }

    pc.onicecandidate = (e: any) => {
      if (e.candidate && socket) {
        socket.emit('meet:ice-candidate', { to: socketId, candidate: e.candidate, roomId });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`🔌 ICE ${socketId}: ${state}`);
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

  // ─── Renegociación (compartir pantalla) ───────────────
  const renegotiateWithAllPeers = async (newStream: any) => {
    console.log('🔄 Renegociando...');
    for (const [socketId, peer] of peersRef.current.entries()) {
      const pc = peer.peerConnection;
      pc.getSenders().forEach((s: any) => pc.removeTrack(s));
      if (Platform.OS === 'web') {
        newStream.getTracks().forEach((track: any) => pc.addTrack(track, newStream));
      } else {
        pc.addStream(newStream);
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('meet:offer', { to: socketId, offer, roomId, isRenegotiation: true });
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

      setStatus('Conectando...');
      socket.emit('meet:join', { roomId, userId, type: callType });

      const handleParticipants = async (data: any) => {
        console.log(`👥 Participantes existentes: ${data.participants.length}`);
        // Registrar contador inmediatamente, sin esperar stream
        setRemoteCount(data.participants.length);

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
      socket.on('meet:error', handleError);

      return () => {
        socket.off('meet:participants', handleParticipants);
        socket.off('meet:user-joined', handleUserJoined);
        socket.off('meet:offer', handleOffer);
        socket.off('meet:answer', handleAnswer);
        socket.off('meet:ice-candidate', handleIceCandidate);
        socket.off('meet:user-left', handleUserLeft);
        socket.off('meet:error', handleError);
      };
    };

    const cleanup = init();
    return () => {
      cleanup.then(fn => fn?.());
      endCall();
    };
  }, [socket, roomId, userId, callType]);

  // ─── Controles ────────────────────────────────────────
  const toggleMute = () => {
    if (!localStreamRef.current || !hasAudio) return;
    localStreamRef.current.getAudioTracks().forEach((t: any) => { t.enabled = !t.enabled; });
    setIsMuted(v => !v);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current || !hasVideo) return;
    localStreamRef.current.getVideoTracks().forEach((t: any) => { t.enabled = !t.enabled; });
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
        await renegotiateWithAllPeers(screenStream);

        screenStream.getVideoTracks()[0].onended = async () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
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
    socket?.emit('meet:leave', { roomId, userId });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // ─── Render ───────────────────────────────────────────
  const remoteParticipants = Array.from(participants.values());

  // Usar remoteCount: sube al unirse, no depende de si hay stream
  const totalParticipants = remoteCount + 1;

  const hasLocalVideo = localStream &&
    localStream.getVideoTracks &&
    localStream.getVideoTracks().length > 0 &&
    !isVideoOff;

  const hasRemoteVideo = remoteParticipants.some(p =>
    p.stream && p.stream.getVideoTracks && p.stream.getVideoTracks().length > 0
  );

  const showAvatarGrid = !hasLocalVideo && !hasRemoteVideo;

  const allParticipants = [
    { userId, isLocal: true },
    ...remoteParticipants.map(p => ({ userId: p.userId, isLocal: false }))
  ];

  return (
    <View style={st.container}>
      {showAvatarGrid ? (
        <View style={st.gridContainer}>
          {allParticipants.map((p, idx) => (
            <View key={idx} style={[st.avatarBox, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
              <Text style={st.avatarText}>{p.userId.charAt(0).toUpperCase()}</Text>
              <Text style={st.avatarName}>{p.isLocal ? 'Tú' : p.userId.slice(0, 10)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={st.videoGrid}>
          {remoteParticipants.map((p, idx) => p.stream && (
            <View key={idx} style={st.videoBox}>
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
                <Text style={st.nameText}>{p.userId.slice(0, 8)}</Text>
              </View>
            </View>
          ))}

          {hasLocalVideo && (
            <View style={st.localVideoBox}>
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

      <View style={st.infoBar}>
        <Text style={st.participantCount}>👥 {totalParticipants}</Text>
      </View>

      <View style={st.controls}>
        <View style={st.controlsRow}>
          <TouchableOpacity style={[st.controlBtn, isMuted && st.controlBtnDanger]} onPress={toggleMute} disabled={!hasAudio}>
            <MicIcon muted={isMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[st.controlBtn, isVideoOff && st.controlBtnDanger]} onPress={toggleVideo} disabled={!hasVideo}>
            <VideoIcon disabled={isVideoOff} />
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

  gridContainer: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap',
    padding: 20, justifyContent: 'center', alignContent: 'center', gap: 20
  },
  avatarBox: {
    width: SCREEN_WIDTH > 768 ? 200 : (SCREEN_WIDTH - 60) / 2,
    height: SCREEN_WIDTH > 768 ? 200 : (SCREEN_WIDTH - 60) / 2,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  avatarText: { fontSize: SCREEN_WIDTH > 768 ? 72 : 48, fontWeight: 'bold', color: '#fff' },
  avatarName: { marginTop: 8, fontSize: 14, color: '#fff', fontWeight: '600' },

  videoGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#000' },
  videoBox: { width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' },
  video: { width: '100%', height: '100%', objectFit: 'contain' as any },

  localVideoBox: {
    position: 'absolute', bottom: 110, right: 20,
    width: 100, height: 150, borderRadius: 12,
    overflow: 'hidden', borderWidth: 2, borderColor: 'white', zIndex: 20
  },
  localVideo: { width: '100%', height: '100%', objectFit: 'cover' as any },

  nameTag: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8
  },
  nameText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  statusOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', zIndex: 100
  },
  statusText: { color: '#fff', marginTop: 10, fontSize: 16 },

  infoBar: {
    position: 'absolute', top: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, zIndex: 10
  },
  participantCount: { color: '#fff', fontSize: 14, fontWeight: '600' },

  controls: { position: 'absolute', bottom: 40, width: '100%', paddingHorizontal: 20, zIndex: 10 },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, alignItems: 'center' },
  controlBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center'
  },
  controlBtnDanger: { backgroundColor: '#ef4444' },
  controlBtnActive: { backgroundColor: '#10b981' },
  hangupBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center'
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});