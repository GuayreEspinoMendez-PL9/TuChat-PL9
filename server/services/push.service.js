import { Expo } from 'expo-server-sdk';
import { appDb } from "../db/db.js";

const expo = new Expo();

export const enviarNotificacionPush = async (idUsuarioApp, mensaje, idChat) => {
  try {
    // 1. Comprobar si el usuario tiene notificaciones activas
    const { rows: prefRows } = await appDb.query(
      `SELECT notificaciones_activas FROM seguridad.usuarios_app WHERE id_usuario_app = $1`,
      [idUsuarioApp]
    );

    // Si desactivó notificaciones, no enviar
    if (prefRows.length > 0 && prefRows[0].notificaciones_activas === false) {
      console.log(`[Push] Notificaciones desactivadas para usuario ${idUsuarioApp}`);
      return;
    }

    // 2. Obtener tokens push (con schema correcto)
    const { rows: tokenRows } = await appDb.query(
      `SELECT token FROM seguridad.tokens_push WHERE id_usuario_app = $1`,
      [idUsuarioApp]
    );

    const tokens = tokenRows.map(row => row.token);
    if (tokens.length === 0) {
      console.log(`[Push] Sin tokens registrados para usuario ${idUsuarioApp}`);
      return;
    }

    // 3. Construir mensajes
    let messages = [];
    for (let pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`[Push] Token invalido para usuario ${idUsuarioApp}: ${pushToken}`);
        continue;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title: 'TUCHAT',
        body: mensaje,
        priority: 'high',
        channelId: 'default',
        data: { chatId: idChat },
      });
    }

    if (!messages.length) {
      console.log(`[Push] Todos los tokens fueron descartados para usuario ${idUsuarioApp}`);
      return;
    }

    // 4. Enviar en chunks
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log(`[Push] Enviadas ${chunk.length} notificaciones a usuario ${idUsuarioApp}`, tickets);
    }
  } catch (error) {
    console.error("Error en enviarNotificacionPush:", error);
  }
};
