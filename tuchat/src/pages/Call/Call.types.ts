export interface CallScreenProps {
  /**
   * ID de la sala de chat (id_sala de la BD)
   */
  roomId: string;
  
  /**
   * ID del usuario actual
   */
  userId: string;
  
  /**
   * Tipo de llamada
   */
  type: 'audio' | 'video';
  
  /**
   * Callback al finalizar la llamada
   */
  onEndCall?: () => void;
}

export interface Peer {
  peerConnection: RTCPeerConnection;
  stream: MediaStream | null;
}

export interface MeetParticipant {
  userId: string;
  socketId: string;
}

export interface MeetRoom {
  participants: Map<string, string>; // userId -> socketId
  callId: string;
  type: 'audio' | 'video';
  createdAt: number;
}