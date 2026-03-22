import { Platform } from 'react-native';
import Push from 'push.js';

let permissionRequested = false;
const PENDING_NOTIFICATION_ROOM_KEY = 'tuchat_pending_notification_room';

export type BrowserNotificationTarget = {
  roomId: string;
  msgId?: string;
  targetPanel?: 'events' | 'polls' | 'mentions' | 'info';
};

const persistNotificationTarget = (payload: BrowserNotificationTarget) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_NOTIFICATION_ROOM_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Error guardando destino de notificacion:', error);
  }
};

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

export const clearPendingNotificationTarget = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_NOTIFICATION_ROOM_KEY);
  } catch (error) {
    console.error('Error limpiando destino de notificacion:', error);
  }
};

export const initBrowserNotifications = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (permissionRequested) return;
  permissionRequested = true;

  try {
    Push.Permission.request();
  } catch (error) {
    console.error('Error solicitando permisos de navegador:', error);
  }
};

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
