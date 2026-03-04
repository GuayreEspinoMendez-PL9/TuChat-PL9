import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Alert } from 'react-native';
import { io } from 'socket.io-client';
import { styles } from './Call.styles';
import type { CallScreenProps } from './Call.types';
import { MicIcon, VideoIcon, ScreenShareIcon } from './Call.icons';

const WebRTC = Platform.OS !== 'web' ? require('react-native-webrtc') : null;
const API_URL = "https://tuchat-pl9.onrender.com";
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const CallScreen: React.FC<CallScreenProps> = ({ 
  roomId, 
  userId, 
  type, 
  onEndCall 
}) => {
  useEffect(() => {
    if (!roomId || roomId === 'null' || roomId.trim() === '') {
      console.error('❌ roomId inválido:', roomId);
      Alert.alert("Error", "ID de sala inválido", [
        { text: "OK", onPress: () => onEndCall?.() }
      ]);
      return;
    }
    
    if (!userId || userId === 'null' || userId.trim() === '') {
      console.error('❌ userId inválido:', userId);
      Alert.alert("Error", "ID de usuario inválido", [
        { text: "OK", onPress: () => onEndCall?.() }
      ]);
      return;
    }

    console.log(`🎬 CallScreen inicializado:`, { roomId, userId, type });
  }, [roomId, userId, type]);

  const [localStream, setLocalStream] = useState<any>(null);
  const [status, setStatus] = useState("Solicitando permisos...");
  const [participants, setParticipants] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, any>>(new Map());
  
  const socket = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const screenStreamRef = useRef<any>(null);
  const peersRef = useRef<Map<string, any>>(new Map());

  const requestPermissions = async () => {
    const wantsVideo = type === 'video';
    
    if (wantsVideo) {
      try {
        const stream = Platform.OS === 'web'
          ? await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          : await WebRTC.mediaDevices.getUserMedia({ audio: true, video: true });
        
        console.log('✅ Permisos obtenidos: Audio + Video');
        setHasAudio(stream.getAudioTracks().length > 0);
        setHasVideo(stream.getVideoTracks().length > 0);
        return stream;
      } catch (e) {
        console.log("⚠️ No se pudo obtener video, intentando solo audio");
      }
    }

    try {
      const stream = Platform.OS === 'web'
        ? await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        : await WebRTC.mediaDevices.getUserMedia({ audio: true, video: false });
      
      console.log('✅ Permisos obtenidos: Solo Audio');
      setHasAudio(stream.getAudioTracks().length > 0);
      setHasVideo(false);
      return stream;
    } catch (e) {
      console.log("⚠️ Intentando solo video");
    }

    if (wantsVideo) {
      try {
        const stream = Platform.OS === 'web'
          ? await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
          : await WebRTC.mediaDevices.getUserMedia({ audio: false, video: true });
        
        console.log('✅ Permisos obtenidos: Solo Video');
        setHasAudio(false);
        setHasVideo(stream.getVideoTracks().length > 0);
        return stream;
      } catch (e) {
        console.log("❌ No se pudo obtener ningún medio");
      }
    }

    setHasAudio(false);
    setHasVideo(false);
    return null;
  };

  const createPeerConnection = (socketId: string, stream?: any) => {
    console.log(`🔗 Creando PeerConnection con ${socketId}`);
    
    const PC = Platform.OS === 'web' ? RTCPeerConnection : WebRTC.RTCPeerConnection;
    const pc = new PC(configuration);

    const currentStream = stream || localStreamRef.current;
    
    if (currentStream) {
      if (Platform.OS === 'web') {
        currentStream.getTracks().forEach((track: any) => {
          pc.addTrack(track, currentStream);
        });
      } else {
        pc.addStream(currentStream);
      }
    }

    pc.onicecandidate = (e: any) => {
      if (e.candidate) {
        socket.current.emit("meet:ice-candidate", {
          to: socketId,
          candidate: e.candidate,
          roomId
        });
      }
    };

    if (Platform.OS === 'web') {
      pc.ontrack = (e: any) => {
        if (e.streams && e.streams[0]) {
          console.log(`🎬 Stream recibido de ${socketId}`);
          const peer = peersRef.current.get(socketId);
          if (peer) {
            peer.stream = e.streams[0];
            setRemoteStreams(prev => {
              const newMap = new Map(prev);
              newMap.set(socketId, e.streams[0]);
              return newMap;
            });
            setParticipants(prev => prev); // Force re-render
          }
        }
      };
    } else {
      pc.onaddstream = (e: any) => {
        console.log(`🎬 Stream recibido de ${socketId}`);
        const peer = peersRef.current.get(socketId);
        if (peer) {
          peer.stream = e.stream;
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.set(socketId, e.stream);
            return newMap;
          });
          setParticipants(prev => prev); // Force re-render
        }
      };
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`🔌 ICE state con ${socketId}:`, pc.iceConnectionState);
    };

    return pc;
  };

  const renegotiateWithAllPeers = async (newStream: any) => {
    console.log("🔄 Renegociando con todos los peers...");
    
    for (const [socketId, peer] of peersRef.current.entries()) {
      const pc = peer.peerConnection;
      const senders = pc.getSenders();
      senders.forEach((sender: any) => pc.removeTrack(sender));
      
      if (Platform.OS === 'web') {
        newStream.getTracks().forEach((track: any) => {
          pc.addTrack(track, newStream);
        });
      } else {
        pc.addStream(newStream);
      }
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.current.emit("meet:offer", { to: socketId, offer, roomId });
    }
  };

  useEffect(() => {
    if (!roomId || !userId) {
      console.error("❌ Props inválidos, abortando");
      return;
    }

    console.log(`🔌 Creando socket para CallScreen con userId: ${userId}`);
    
    socket.current = io(API_URL, { 
      query: { userId },
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      transports: ['websocket']
    });

      const init = async () => {
      const stream = await requestPermissions();
      
      if (stream) {
        setLocalStream(stream);
        localStreamRef.current = stream;
        setStatus("Conectando...");
      } else {
        setStatus("Modo observador");
      }

      // ESPERAR CONEXIÓN
      socket.current.on('connect', () => {
        console.log(`🟢 Socket CallScreen conectado: ${socket.current.id}`);
        
        const joinData = { roomId, userId, type };
        console.log(`📞 Emitiendo meet:join:`, joinData);
        socket.current.emit("meet:join", joinData);
      });

      socket.current.on('connect_error', (error: any) => {
        console.error('❌ Error de conexión:', error);
        setStatus("Error de conexión");
      });

      socket.current.on("meet:participants", async (data: any) => {
        console.log(`👥 Participantes existentes: ${data.participants.length}`);
        
        if (data.participants.length > 0) {
          setStatus("Conectando con participantes...");
        }

        for (const participant of data.participants) {
          const pc = createPeerConnection(participant.socketId);
          peersRef.current.set(participant.socketId, { peerConnection: pc, stream: null });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.current.emit("meet:offer", { to: participant.socketId, offer, roomId });
        }

        setStatus("");
        setParticipants(data.participants.length + 1);
      });

      socket.current.on("meet:user-joined", async (data: any) => {
        console.log(`➕ Nuevo participante: ${data.userId} (${data.socketId})`);
        const pc = createPeerConnection(data.socketId);
        peersRef.current.set(data.socketId, { peerConnection: pc, stream: null });
        setParticipants(prev => prev + 1);
      });

      socket.current.on("meet:offer", async (data: any) => {
        console.log(`📥 Offer recibida de ${data.from}`);
        
        let peer = peersRef.current.get(data.from);
        
        if (!peer) {
          const pc = createPeerConnection(data.from);
          peer = { peerConnection: pc, stream: null };
          peersRef.current.set(data.from, peer);
        }

        const SD = Platform.OS === 'web' ? RTCSessionDescription : WebRTC.RTCSessionDescription;
        await peer.peerConnection.setRemoteDescription(new SD(data.offer));
        
        const answer = await peer.peerConnection.createAnswer();
        await peer.peerConnection.setLocalDescription(answer);
        socket.current.emit("meet:answer", { to: data.from, answer, roomId });
      });

      socket.current.on("meet:answer", async (data: any) => {
        console.log(`📥 Answer recibida de ${data.from}`);
        const peer = peersRef.current.get(data.from);
        if (peer) {
          const SD = Platform.OS === 'web' ? RTCSessionDescription : WebRTC.RTCSessionDescription;
          await peer.peerConnection.setRemoteDescription(new SD(data.answer));
        }
      });

      socket.current.on("meet:ice-candidate", async (data: any) => {
        const peer = peersRef.current.get(data.from);
        if (peer && peer.peerConnection.remoteDescription) {
          const ICE = Platform.OS === 'web' ? RTCIceCandidate : WebRTC.RTCIceCandidate;
          try {
            await peer.peerConnection.addIceCandidate(new ICE(data.candidate));
          } catch (e) {
            console.error("Error añadiendo ICE candidate:", e);
          }
        }
      });

      socket.current.on("meet:user-left", (data: any) => {
        console.log(`👋 Participante salió: ${data.socketId}`);
        const peer = peersRef.current.get(data.socketId);
        if (peer) {
          peer.peerConnection.close();
          peersRef.current.delete(data.socketId);
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.socketId);
            return newMap;
          });
          setParticipants(prev => prev - 1);
        }
      });

      socket.current.on("meet:error", (data: any) => {
        console.error("❌ Error del servidor:", data.msg);
        Alert.alert("Error", data.msg);
        setTimeout(handleEndCall, 3000);
      });
    };

    init();
    return () => handleEndCall();
  }, [roomId, userId, type]);

  const toggleMute = () => {
    if (!localStreamRef.current || !hasAudio) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach((track: any) => { track.enabled = !track.enabled; });
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current || !hasVideo) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach((track: any) => { track.enabled = !track.enabled; });
    setIsVideoOff(!isVideoOff);
  };

  const toggleScreenShare = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert("No disponible", "Compartir pantalla solo está disponible en web");
      return;
    }

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track: any) => track.stop());
      }
      if (localStreamRef.current) {
        setLocalStream(localStreamRef.current);
        await renegotiateWithAllPeers(localStreamRef.current);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { cursor: "always" },
          audio: false
        });
        
        screenStreamRef.current = screenStream;
        setLocalStream(screenStream);
        await renegotiateWithAllPeers(screenStream);
        setIsScreenSharing(true);
        
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      } catch (e) {
        console.error("Error compartiendo pantalla:", e);
        Alert.alert("Error", "No se pudo compartir pantalla");
      }
    }
  };

  const handleEndCall = () => {
    console.log("🔚 Finalizando llamada...");
    
    peersRef.current.forEach((peer) => {
      if (peer.peerConnection) peer.peerConnection.close();
    });
    peersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t: any) => t.stop());
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t: any) => t.stop());
    }

    if (socket.current && socket.current.connected) {
      socket.current.emit("meet:leave", { roomId, userId });
      socket.current.disconnect();
    }

    if (onEndCall) onEndCall();
  };

  const renderParticipants = () => {
    const remotePeers = Array.from(peersRef.current.values()).filter(p => p.stream);
    if (remotePeers.length === 0) return null;

    return (
      <ScrollView horizontal style={styles.participantsStrip}>
        {remotePeers.map((peer, idx) => (
          <View key={idx} style={styles.participantBox}>
            {Platform.OS === 'web' ? (
              <video
                autoPlay
                playsInline
                ref={el => { if (el && peer.stream) el.srcObject = peer.stream }}
                style={styles.participantVideo}
              />
            ) : (
              peer.stream && (
                <WebRTC.RTCView 
                  streamURL={peer.stream.toURL()} 
                  style={styles.participantVideo} 
                  objectFit="cover" 
                />
              )
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainVideo}>
        {localStream ? (
          Platform.OS === 'web' ? (
            <video
              autoPlay
              playsInline
              muted
              ref={el => { if (el && localStream) el.srcObject = localStream }}
              style={styles.webLocalVideo}
            />
          ) : (
            localStream.getVideoTracks && localStream.getVideoTracks().length > 0 && (
              <WebRTC.RTCView 
                streamURL={localStream.toURL()} 
                style={styles.nativeLocalVideo} 
                objectFit="cover" 
              />
            )
          )
        ) : (
          <View style={styles.noVideoPlaceholder}>
            <Text style={styles.placeholderText}>🎥</Text>
            <Text style={styles.placeholderSubtext}>Sin permisos de cámara/micrófono</Text>
          </View>
        )}
      </View>

      {renderParticipants()}

      {status !== "" && (
        <View style={styles.statusOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      <View style={styles.infoBar}>
        <Text style={styles.participantCount}>
          👥 {participants} participante{participants !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.controlBtn, isMuted && styles.controlBtnDanger]} 
            onPress={toggleMute}
            disabled={!hasAudio}
          >
            <MicIcon muted={isMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlBtn, isVideoOff && styles.controlBtnDanger]} 
            onPress={toggleVideo}
            disabled={!hasVideo}
          >
            <VideoIcon disabled={isVideoOff} />
          </TouchableOpacity>

          {Platform.OS === 'web' && (
            <TouchableOpacity 
              style={[styles.controlBtn, isScreenSharing && styles.controlBtnActive]} 
              onPress={toggleScreenShare}
            >
              <ScreenShareIcon />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.hangupBtn} onPress={handleEndCall}>
            <Text style={styles.btnText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};