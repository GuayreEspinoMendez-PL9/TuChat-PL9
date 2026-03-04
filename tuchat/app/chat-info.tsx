// app/chat-info.tsx
import { useLocalSearchParams } from 'expo-router';
import { ChatInfoScreen } from '../src/components/Chat/ChatInfoScreen';

export default function ChatInfoPage() {
  const params = useLocalSearchParams();
  
  return (
    <ChatInfoScreen 
      roomId={params.roomId as string}
      nombre={params.nombre as string}
      esProfesor={params.esProfesor === 'true'}
    />
  );
}