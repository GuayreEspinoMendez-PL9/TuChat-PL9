import { Expo } from 'expo-server-sdk';
import { appDb } from "../db/db.js";

const expo = new Expo();

export const enviarNotificacionPush = async (idUsuarioApp, payload, idChat) => {
  try {
    const notification = typeof payload === "string"
      ? { title: "TUCHAT", body: payload }
      : {
          title: payload?.title || "TUCHAT",
          body: payload?.body || "Nuevo mensaje",
        };

    const { rows: prefRows } = await appDb.query(
      `SELECT notificaciones_activas, sonidos_activos
       FROM seguridad.usuarios_app
       WHERE id_usuario_app = $1`,
      [idUsuarioApp]
    );

    const notifEnabled = prefRows.length > 0 ? prefRows[0].notificaciones_activas !== false : true;
    const soundEnabled = prefRows.length > 0 ? prefRows[0].sonidos_activos !== false : true;

    if (!notifEnabled) {
      console.log(`[Push] Notificaciones desactivadas para usuario ${idUsuarioApp}`);
      return;
    }

    const { rows: tokenRows } = await appDb.query(
      `SELECT token FROM seguridad.tokens_push WHERE id_usuario_app = $1`,
      [idUsuarioApp]
    );

    const tokens = tokenRows.map(row => row.token);
    if (tokens.length === 0) {
      console.log(`[Push] Sin tokens registrados para usuario ${idUsuarioApp}`);
      return;
    }

    const messages = [];
    for (const pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`[Push] Token invalido para usuario ${idUsuarioApp}: ${pushToken}`);
        continue;
      }

      messages.push({
        to: pushToken,
        ...(soundEnabled ? { sound: 'default' } : {}),
        title: notification.title,
        body: notification.body,
        priority: 'high',
        channelId: 'default',
        data: { chatId: idChat },
      });
    }

    if (!messages.length) {
      console.log(`[Push] Todos los tokens fueron descartados para usuario ${idUsuarioApp}`);
      return;
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log(`[Push] Enviadas ${chunk.length} notificaciones a usuario ${idUsuarioApp}`, tickets);
    }
  } catch (error) {
    console.error("Error en enviarNotificacionPush:", error);
  }
};
