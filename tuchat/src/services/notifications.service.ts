import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants'; 
import { Platform } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = "https://tuchat-pl9.onrender.com";

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return;

  if (!Device.isDevice) {
    console.log('Debes usar un dispositivo físico para las notificaciones push');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  try {
    // Obtiene el ID que generaste con 'npx eas project:init' automáticamente
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.error("No se encontró el projectId en app.json");
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("Token obtenido:", token);

    const authToken = await SecureStore.getItemAsync('token');
    if (!authToken) return;

    await axios.post(`${API_URL}/auth/registrar-token`, {
      token: token,
      plataforma: Platform.OS
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log("Token guardado en BD");
  } catch (error) {
    console.error("Error en notificaciones:", error);
  }
}