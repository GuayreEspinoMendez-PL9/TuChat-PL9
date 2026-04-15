import { Platform } from 'react-native';
import axios from 'axios';
import Push from 'push.js';

let permissionRequested = false;
const PENDING_NOTIFICATION_ROOM_KEY = 'tuchat_pending_notification_room';
const BROWSER_NOTIFICATIONS_ENABLED_KEY = 'tuchat_browser_notifications_enabled';
const API_URL = "https://tuchat-pl9.onrender.com";
let browserNotificationsEnabled = true;

export type BrowserNotificationTarget = {
  roomId: string;
  msgId?: string;
  targetPanel?: 'events' | 'polls' | 'mentions' | 'info';
};

// Función para guardar el destino de una notificación en sessionStorage, lo que permite que al hacer clic en una notificación se pueda navegar a la sala y mensaje correspondientes. 
// Esto es especialmente útil para manejar la navegación desde notificaciones web.
const persistNotificationTarget = (payload: BrowserNotificationTarget) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_NOTIFICATION_ROOM_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Error guardando destino de notificacion:', error);
  }
};

// Función para guardar la preferencia de notificaciones web en localStorage, lo que permite recordar si el usuario ha habilitado o deshabilitado las notificaciones web incluso después de cerrar el navegador.
const persistBrowserNotificationsEnabled = (enabled: boolean) => {
  browserNotificationsEnabled = enabled;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BROWSER_NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled));
  } catch (error) {
    console.error('Error guardando preferencia de notificaciones web:', error);
  }
};

export const setBrowserNotificationsEnabled = (enabled: boolean) => {
  persistBrowserNotificationsEnabled(Boolean(enabled));
};

// Función para verificar si las notificaciones web están habilitadas, leyendo la preferencia desde localStorage. 
// Si no se encuentra una preferencia guardada, se asume que las notificaciones están habilitadas por defecto.
export const areBrowserNotificationsEnabled = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(BROWSER_NOTIFICATIONS_ENABLED_KEY);
    if (raw == null) return browserNotificationsEnabled;
    browserNotificationsEnabled = JSON.parse(raw) !== false;
    return browserNotificationsEnabled;
  } catch {
    return browserNotificationsEnabled;
  }
};

// Función para sincronizar la preferencia de notificaciones web con el servidor, obteniendo el estado actual desde una API protegida por token.
export const syncBrowserNotificationsPreference = async (token?: string | null) => {
  if (Platform.OS !== 'web' || !token) return areBrowserNotificationsEnabled();
  try {
    const res = await axios.get(`${API_URL}/auth/notif-preference`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const enabled = res.data?.ok ? res.data.notificaciones_activas !== false : true;
    persistBrowserNotificationsEnabled(enabled);
    return enabled;
  } catch (error) {
    console.error('Error sincronizando preferencia de notificaciones web:', error);
    return areBrowserNotificationsEnabled();
  }
};

// Función para consumir el destino de una notificación pendiente, leyendo los datos guardados en sessionStorage y luego eliminándolos para evitar que se reutilicen.
export const consumePendingNotificationTarget = (): BrowserNotificationTarget | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_NOTIFICATION_ROOM_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PENDING_NOTIFICATION_ROOM_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed?.roomId) return null;
    const targetPanel = ['events', 'polls', 'mentions', 'info'].includes(parsed?.targetPanel)
      ? parsed.targetPanel
      : undefined;
    return {
      roomId: String(parsed.roomId),
      msgId: parsed?.msgId ? String(parsed.msgId) : undefined,
      targetPanel,
    };
  } catch (error) {
    console.error('Error leyendo destino de notificacion:', error);
    return null;
  }
};

// Función para limpiar el destino de una notificación pendiente, eliminando cualquier dato guardado en sessionStorage relacionado con notificaciones. 
export const clearPendingNotificationTarget = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_NOTIFICATION_ROOM_KEY);
  } catch (error) {
    console.error('Error limpiando destino de notificacion:', error);
  }
};

// Función para inicializar las notificaciones web, solicitando permisos al usuario si aún no se han solicitado.
export const initBrowserNotifications = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!areBrowserNotificationsEnabled()) return;
  if (permissionRequested) return;
  permissionRequested = true;

  try {
    Push.Permission.request();
  } catch (error) {
    console.error('Error solicitando permisos de navegador:', error);
  }
};

// Función para mostrar una notificación web, utilizando la biblioteca push.js para crear una notificación con un título, cuerpo y un manejador de clics que 
// permite navegar a la sala y mensaje correspondientes al hacer clic en la notificación.
export const showBrowserMessageNotification = ({
  title,
  body,
  roomId,
  msgId,
  roomName,
  targetPanel,
}: {
  title: string;
  body: string;
  roomId?: string;
  msgId?: string;
  roomName?: string;
  targetPanel?: 'events' | 'polls' | 'mentions' | 'info';
}) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!areBrowserNotificationsEnabled()) return;

  try {
    const resolvedTitle = roomName ? `${title} - ${roomName}` : title;
    Push.create(resolvedTitle, {
      body,
      timeout: 4000,
      onClick() {
        window.focus();
        if (roomId) {
          const payload = { roomId, msgId, targetPanel };
          persistNotificationTarget(payload);
          window.dispatchEvent(new CustomEvent('tuchat:notification-open-room', { detail: payload }));
        }
      },
    });
  } catch (error) {
    console.error('Error mostrando notificacion web:', error);
  }
};
