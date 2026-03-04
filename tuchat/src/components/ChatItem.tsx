import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router'; 
import { styles } from '../pages/home/home.styles';
import { useTheme } from '../context/ThemeContext';

export interface ChatData {
  id_chat: string;
  nombre: string;
  subtitulo: string;
  esProfesor: boolean;
}

const BookIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2563EB" style={{ width: 24, height: 24 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </Svg>
);

export const ChatItem = ({ chat }: { chat: ChatData }) => {
  const { colors } = useTheme();
  const handlePress = () => {
    router.push({
      pathname: "/chat", 
      params: { 
        id: chat.id_chat, // IMPORTANTE: Enviamos id_chat como 'id'
        nombre: chat.nombre, 
        esProfesor: String(chat.esProfesor) 
      }
    });
  };

  return (
    <TouchableOpacity style={styles.chatCard} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.iconContainer}>
        <BookIcon />
      </View>
      <View style={styles.chatContent}>
        <Text style={styles.subjectName} numberOfLines={1}>{chat.nombre}</Text>
        <Text style={styles.className} numberOfLines={1}>{chat.subtitulo}</Text>
      </View>
    </TouchableOpacity>
  );
};