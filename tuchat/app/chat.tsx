import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../src/components/Chat/ChatScreen';

export default function ChatPage() {
  const params = useLocalSearchParams();
  
  const chatId = Array.isArray(params.id) ? params.id[0] : (params.id || "");
  const chatNombre = Array.isArray(params.nombre) ? params.nombre[0] : (params.nombre || "Chat");
  const esProf = params.esProfesor === 'true';
  const targetMsgId = Array.isArray(params.targetMsgId) ? params.targetMsgId[0] : (params.targetMsgId || "");
  const targetPanel = Array.isArray(params.targetPanel) ? params.targetPanel[0] : (params.targetPanel || "");
  const safeTargetPanel = ['events', 'polls', 'mentions', 'info'].includes(targetPanel) ? targetPanel as 'events' | 'polls' | 'mentions' | 'info' : undefined;

  return (
    <ChatScreen 
      id={chatId} 
      nombre={chatNombre} 
      esProfesor={esProf} 
      targetMsgId={targetMsgId || undefined}
      targetPanel={safeTargetPanel}
    />
  );
}
