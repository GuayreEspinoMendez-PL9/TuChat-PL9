import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = "https://tuchat-pl9.onrender.com";
let notificationsConfigured = false;
let lastRegisteredToken: string | null = null;

export function configureNotifications() {
  if (notificationsConfigured || Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  notificationsConfigured = true;
}

export async function presentIncomingMessageNotification({
  title,
  body,
  chatId,
}: {
  title: string;
  body: string;
  chatId?: string | null;
}) {
  if (Platform.OS === 'web') return;
  configureNotifications();

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: chatId ? { chatId } : {},
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error mostrando notificacion local:', error);
  }
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return;
  configureNotifications();

  if (!Device.isDevice) {
    console.log('Debes usar un dispositivo fisico para las notificaciones push');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.error("No se encontro el projectId en app.json");
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("Token obtenido:", token);

    if (lastRegisteredToken === token) {
      return token;
    }

    const authToken = await SecureStore.getItemAsync('token');
    if (!authToken) return;

    await axios.post(`${API_URL}/auth/registrar-token`, {
      token,
      plataforma: Platform.OS
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log("Token guardado en BD");
    lastRegisteredToken = token;
    return token;
  } catch (error) {
    console.error("Error en notificaciones:", error);
  }
}
