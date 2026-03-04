import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../src/components/Chat/ChatScreen';

export default function ChatPage() {
  const params = useLocalSearchParams();
  
  const chatId = Array.isArray(params.id) ? params.id[0] : (params.id || "");
  const chatNombre = Array.isArray(params.nombre) ? params.nombre[0] : (params.nombre || "Chat");
  const esProf = params.esProfesor === 'true';

  return (
    <ChatScreen 
      id={chatId} 
      nombre={chatNombre} 
      esProfesor={esProf} 
    />
  );
}