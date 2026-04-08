import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from "jsonwebtoken";

// fetch está disponible de forma nativa en Node 18+
// Si usas Node 16 o anterior, instala node-fetch: npm install node-fetch
// y descomenta: import fetch from 'node-fetch';

import authRoutes from "./routes/auth.routes.js";
import academicoRoutes from "./routes/academico.routes.js";
import mensajesRoutes from "./routes/mensajes.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import adminRoutes from "./routes/admin.routes.js";       // ✅ AÑADIDO

import { appDb } from "./db/db.js";
import { getRedis } from "./redis.js";
import { enviarNotificacionPush } from "./services/push.service.js";
import { setUserPresence } from "./services/collab.store.js";
import { createPinDb, initCollabTables, removePinDb } from "./services/collab.persistence.js";
import {
  clearPendingMessages,
  enqueuePendingMessage,
  listPendingMessages,
} from "./services/pendingMessages.service.js";
import {
  createMessageStatusDb,
  getMessageStatusDb,
  initMessageStatusTable,
  markMessageDeliveredDb,
  markMessageReadDb,
} from "./services/messageStatus.persistence.js";

dotenv.config();
const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/academico", academicoRoutes);
app.use("/mensajes", mensajesRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);                            // ✅ AÑADIDO

app.get("/health", (req, res) => res.json({ ok: true, name: "tuchat-server" }));

app.get("/health/db", async (req, res) => {
  try {
    const result = await appDb.query("SELECT 1 AS ok");
    res.json({ ok: true, db: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── TURN credentials endpoint ────────────────────────────────────────────────
// Usa Metered.ca para TURN servers fiables (tier gratuito: 50GB/mes)
// 1. Regístrate gratis en https://dashboard.metered.ca
// 2. Crea una app y copia el nombre y la API key
// 3. Añade en tu .env:
//    METERED_API_KEY=tu_api_key_aqui
//    METERED_APP_NAME=tu_app_name_aqui  (el subdominio, ej: "tuchat")
app.get("/meet/ice-config", async (req, res) => {
  const apiKey = process.env.METERED_API_KEY;
  const appName = process.env.METERED_APP_NAME;

  if (apiKey && appName) {
    try {
      // Metered genera credenciales temporales (TTL 1h) por llamada — más seguro
      const response = await fetch(
        `https://${appName}.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`
      );
      if (response.ok) {
        const iceServers = await response.json();
        console.log(`✅ ICE config de Metered: ${iceServers.length} servidores`);
        return res.json({ iceServers });
      }
      console.warn('⚠️ Metered respondió con error:', response.status);
    } catch (e) {
      console.error('❌ Error obteniendo ICE config de Metered:', e.message);
    }
  }

  // Fallback: múltiples TURN públicos por si falla Metered o no hay .env configurado
  // Nota: estos son menos fiables que Metered para producción
  console.warn('⚠️ Usando TURN público de fallback (configura METERED_API_KEY para producción)');
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
    {
      urls: "turn:standard.relay.metered.ca:80?transport=tcp",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
    {
      urls: "turns:standard.relay.metered.ca:443?transport=tcp",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
  ];

  res.json({ iceServers });
});

app.get("/health/redis", async (req, res) => {
  try {
    const redis = getRedis();
    await redis.set("tuchat:ping", "pong", "EX", 10);
    const val = await redis.get("tuchat:ping");
    res.json({ ok: true, redis: val });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"], credentials: true
  },
});

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) return authToken.trim();

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();

  const authorizationHeader = socket.handshake.headers?.authorization;
  if (typeof authorizationHeader === "string" && authorizationHeader.startsWith("Bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
};

io.use((socket, next) => {
  try {
    const token = getSocketToken(socket);
    if (!token) {
      return next(new Error("AUTH_REQUIRED"));
    }

    const secret = process.env.JWT_SECRET || 'clave_secreta_temporal';
    const payload = jwt.verify(token, secret);

    if (!payload?.sub) {
      return next(new Error("INVALID_TOKEN_PAYLOAD"));
    }

    socket.userId = String(payload.sub);
    socket.authUser = payload;
    next();
  } catch (error) {
    next(new Error(error.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN"));
  }
});

app.set('io', io);

let ajustesSalas = {};

const PRESENCE_LABELS = {
  available: "Disponible",
  in_class: "En clase",
  busy: "Ocupado",
  offline: "Desconectado",
};

const IMPORTANT_MESSAGE_TYPES = new Set(["announcement", "required_read", "assessable", "urgent"]);
const PUSH_FALLBACK_DELAY_MS = 8000;

function buildIndexedMessage(payload) {
  const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const messageType = payload?.messageType || metadata.messageType || null;
  const threadTopic = payload?.threadTopic || metadata.threadTopic || null;
  const requiresAck = Boolean(payload?.requiresAck);
  const important = Boolean(payload?.important || metadata.important || IMPORTANT_MESSAGE_TYPES.has(String(messageType || "")));

  return {
    ...payload,
    text: payload?.text ?? payload?.contenido ?? "",
    contenido: payload?.contenido ?? payload?.text ?? "",
    messageType,
    threadTopic,
    requiresAck,
    important,
    ackReaders: Array.isArray(payload?.ackReaders) ? payload.ackReaders : [],
    metadata: {
      ...metadata,
      important,
      messageType,
      threadTopic,
      requiresAck,
    },
  };
}

const schedulePushFallback = ({
  msgId,
  roomId,
  recipientId,
  notification,
}) => {
  if (!msgId || !roomId || !recipientId || !notification?.body) return;

  setTimeout(async () => {
    try {
      const status = await getMessageStatusDb(msgId);
      const deliveredUsers = new Set((status?.deliveredUsers || []).map(String));
      const readUsers = new Set((status?.readUsers || []).map(String));
      const recipientKey = String(recipientId);

      if (deliveredUsers.has(recipientKey) || readUsers.has(recipientKey)) {
        console.log(`[PushFallback] Omitida para ${recipientId} en ${msgId}: ya entregado/leido`);
        return;
      }

      console.log(`[PushFallback] Enviando push a ${recipientId} para ${msgId}`);
      await enviarNotificacionPush(recipientId, notification, roomId);
    } catch (error) {
      console.error(`[PushFallback] Error evaluando ${msgId} para ${recipientId}:`, error.message);
    }
  }, PUSH_FALLBACK_DELAY_MS);
};

// Función para cargar ajustes desde BD (roomId = id_sala)
async function cargarAjustesSala(roomId) {
  try {
    const { rows } = await appDb.query(`
      SELECT configuracion 
      FROM comunicacion.salas_chat
      WHERE id_sala = $1
    `, [roomId]);

    if (rows.length > 0 && rows[0].configuracion) {
      const config = rows[0].configuracion;
      ajustesSalas[roomId] = {
        soloProfesores: config.soloProfesores || false,
        delegados: config.delegados || [],
        mutedMembers: Array.isArray(config.mutedMembers) ? config.mutedMembers : [],
        bannedMembers: Array.isArray(config.bannedMembers) ? config.bannedMembers : [],
      };
    }

    return ajustesSalas[roomId] || { soloProfesores: false, delegados: [], mutedMembers: [], bannedMembers: [] };
  } catch (e) {
    console.error("Error cargando ajustes:", e);
    return { soloProfesores: false, delegados: [], mutedMembers: [], bannedMembers: [] };
  }
}

const getActiveModerationEntry = (entries = [], userId) => {
  const now = Date.now();
  return (Array.isArray(entries) ? entries : []).find((entry) => {
    if (String(entry?.userId || '') !== String(userId || '')) return false;
    if (!entry?.expiresAt) return true;
    return Number(entry.expiresAt) > now;
  }) || null;
};

const getModerationBlockMessage = (settings, senderId) => {
  const bannedEntry = getActiveModerationEntry(settings?.bannedMembers, senderId);
  if (bannedEntry) {
    return bannedEntry.expiresAt
      ? `No puedes enviar mensajes hasta ${new Date(Number(bannedEntry.expiresAt)).toLocaleString('es-ES')}.`
      : 'No puedes enviar mensajes en este chat hasta que el profesorado retire la restriccion.';
  }

  const mutedEntry = getActiveModerationEntry(settings?.mutedMembers, senderId);
  if (mutedEntry) {
    return mutedEntry.expiresAt
      ? `Estas silenciado hasta ${new Date(Number(mutedEntry.expiresAt)).toLocaleString('es-ES')}.`
      : 'Estas silenciado en este chat hasta que el profesorado retire la restriccion.';
  }

  return null;
};


// ESTRUCTURA DE SALAS DE VIDEOLLAMADA (Tipo Google Meet)
// Clave: roomId (id del chat/sala)
// Valor: { participants: Map(userId -> socketId), callId: uuid, type: 'audio'|'video' }
const meetRooms = new Map();

// ─── Tracking de lectura por mensaje (para ticks de grupo) ───────────────────
// Clave: msg_id → { senderId, roomId, recipients: number, readers: Set<userId> }
const messageReadTracking = new Map();

const syncTrackingFromStatus = async (msgId) => {
  const persisted = await getMessageStatusDb(msgId);
  if (!persisted) return null;
  const tracking = {
    senderId: persisted.senderId,
    roomId: persisted.roomId,
    totalRecipients: persisted.totalRecipients,
    readers: new Set(persisted.readUsers || []),
    deliveredUsers: new Set(persisted.deliveredUsers || []),
    createdAt: persisted.createdAt || Date.now(),
  };
  messageReadTracking.set(msgId, tracking);
  return tracking;
};

io.on("connection", async (socket) => {
  const userId = socket.userId;
  const deviceType = String(socket.handshake.query.deviceType || "mobile").toLowerCase();
  let connectedRooms = [];

  if (userId) {
    // Sala Personal: Para recibir todo aunque esté en el Home
    socket.join(`user:${userId}`);
    console.log(`🚀 Usuario conectado: ${userId}`);
    const initialPresence = setUserPresence(userId, { online: true, status: "available" });

    // AUTO-JOIN: Unirse a todas las salas (Vistas + Privados)
    try {
      // Obtenemos el tipo para saber qué vista consultar
      const { rows: userRes } = await appDb.query(
        "SELECT tipo_externo FROM seguridad.usuarios_app WHERE id_usuario_app = $1",
        [userId]
      );

      if (userRes.length > 0) {
        const tipo = userRes[0].tipo_externo;
        const vista = (tipo === 'ALUMNO')
          ? 'cache_academico.v_asignaturas_visibles_chat_alumno'
          : 'cache_academico.v_asignaturas_visibles_chat_profesor';

        // Consultamos id_sala (salas grupales) y chats_privados
        // Vinculamos vista → clases (por nombre) → salas_chat → oferta (por asignatura)
        const querySalas = `
          SELECT DISTINCT sc.id_sala::text as sala_id 
          FROM ${vista} v
          JOIN cache_academico.clases cl ON cl.nombre = v.nombre_clase
          JOIN comunicacion.salas_chat sc ON sc.id_clase = cl.id_clase
          JOIN cache_academico.oferta_asignaturas oa 
            ON oa.id_oferta = sc.id_oferta 
            AND oa.id_asignatura = v.id_asignatura
          WHERE v.id_usuario_app = $1
          UNION
          SELECT id_chat_privado::text as sala_id FROM comunicacion.chats_privados 
          WHERE id_profesor_usuario_app = $1 OR id_alumno_usuario_app = $1
        `;

        const { rows: salas } = await appDb.query(querySalas, [userId]);

        salas.forEach(row => {
          socket.join(row.sala_id);
          connectedRooms.push(String(row.sala_id));
          // console.log(`📡 Escuchando sala: ${row.sala_id}`);
        });

        connectedRooms.forEach((roomId) => {
          io.to(roomId).emit("presence:update", initialPresence);
        });

        console.log(`✅ Sincronizadas ${salas.length} salas para ${userId}`);
      }
    } catch (e) {
      console.error("❌ Error Auto-Join:", e.message);
    }

    // Recuperar pendientes web. Los del movil se sincronizan via API + ACK explicito.
    try {
      const redis = getRedis();
      if (deviceType === "web" && redis && redis.status === 'ready') {
        const pendingMessages = await listPendingMessages(redis, userId, "web");
        if (pendingMessages.length > 0) {
          console.log(`📦 Entregando ${pendingMessages.length} mensajes offline`);
          pendingMessages.forEach(obj => {
            try {
              if (obj.type === 'reaction') {
                socket.emit("chat:reaction", obj);
              } else {
                socket.emit("chat:receive", obj);
              }
            } catch { }
          });
          await clearPendingMessages(redis, userId, "web");
        }
      }
    } catch (e) {
      console.error("⚠️ Redis no disponible (no crítico):", e.message);
    }
  }

  // --- EVENTOS DE CHAT ---

  socket.on("join_room", async (roomId) => {
    socket.join(roomId);
    if (!connectedRooms.includes(String(roomId))) {
      connectedRooms.push(String(roomId));
    }
    console.log(`👤 Unión manual: ${socket.id} -> ${roomId}`);

    await cargarAjustesSala(roomId);
  });

  socket.on("presence:set_status", ({ status }) => {
    if (!userId) return;
    const nextStatus = ["available", "in_class", "busy"].includes(status) ? status : "available";
    const presence = setUserPresence(userId, { online: true, status: nextStatus });

    connectedRooms.forEach((roomId) => {
      io.to(roomId).emit("presence:update", presence);
    });

    io.to(`user:${userId}`).emit("presence:update", presence);
  });

  socket.on("chat:send", async (payload, ackFn) => {
    const senderId = userId;
    const { roomId, recipients, esProfesor, contenido, nombreEmisor, imageUri } = payload;

    if (!ajustesSalas[roomId]) {
      await cargarAjustesSala(roomId);
    }
    // Check de permisos (ajustesSalas debe estar definido arriba en tu index.js)
    const settings = ajustesSalas[roomId] || { soloProfesores: false, delegados: [], mutedMembers: [], bannedMembers: [] };
    const puedeHablar = !settings.soloProfesores || esProfesor || settings.delegados?.includes(senderId);
    const moderationBlockMessage = esProfesor ? null : getModerationBlockMessage(settings, senderId);

    if (!puedeHablar) {
      return socket.emit("error_permisos", { msg: "Chat restringido" });
    }
    if (moderationBlockMessage) {
      return socket.emit("error_permisos", { msg: moderationBlockMessage });
    }

    const message = buildIndexedMessage({
      ...payload,
      senderId,
      contenido: contenido || payload.text, // Aseguramos que tenga algo
      timestamp: Date.now(),
      read: false
    });

    // A. Envío a la sala (Para los que están dentro del chat abierto)
    io.to(roomId).emit("chat:receive", message);

    // Confirmar al emisor que el servidor recibió el mensaje (tick simple)
    if (typeof ackFn === 'function') {
      ackFn({ ok: true, msg_id: message.msg_id || payload.msg_id });
    }
    // También emitir evento explícito para que el emisor actualice el estado
    socket.emit("chat:msg_sent", { msg_id: message.msg_id || payload.msg_id });

    // B. Envío Global y Redis (Para los que están fuera o offline)
    if (recipients && Array.isArray(recipients)) {
      const otherRecipients = recipients.filter(uId => uId !== senderId);

      // Inicializar tracking de lectura para este mensaje (solo si hay más de 1 destinatario = grupo)
      const msgId = message.msg_id || payload.msg_id;
      if (msgId && otherRecipients.length > 0) {
        messageReadTracking.set(msgId, {
          senderId,
          roomId,
          totalRecipients: otherRecipients.length,
          readers: new Set(),
          deliveredUsers: new Set(),
        });
        // Limpiar tracking antiguo (>24h) para evitar memory leak
        const now = Date.now();
        if (!messageReadTracking._lastCleanup || now - messageReadTracking._lastCleanup > 3600000) {
          messageReadTracking._lastCleanup = now;
          for (const [key, val] of messageReadTracking) {
            if (key === '_lastCleanup') continue;
            if (val.createdAt && now - val.createdAt > 86400000) messageReadTracking.delete(key);
          }
        }
        messageReadTracking.get(msgId).createdAt = now;
      }
      if (msgId) {
        await createMessageStatusDb({
          msgId,
          roomId,
          senderId,
          totalRecipients: otherRecipients.length,
          createdAt: message.timestamp,
        });
      }

      try {
        const redis = getRedis();
        for (const uId of otherRecipients) {
            // 1. Entrega inmediata a su canal personal (Home)
            io.to(`user:${uId}`).emit("chat:receive", message);

            // 2. Guardar en Redis como backup (Buzón)
            if (redis?.status === 'ready') {
              await enqueuePendingMessage(redis, uId, message);
            }

            // 3. Notificación Push
            const mentionTargets = payload.mentions?.targetUserIds || [];
            const mentionLabels = payload.mentions?.tokens || [];
            const hasDirectMention = mentionTargets.includes(uId);
            const hasRoleMention = mentionLabels.some((label) => ["todos", "delegados", "profesor"].includes(label));
            const textoNotif = hasDirectMention || hasRoleMention
              ? `${nombreEmisor || 'Usuario'} te mencionó: ${contenido || 'Nuevo mensaje'}`
              : `${nombreEmisor || 'Usuario'}: ${contenido || 'Nuevo mensaje'}`;
            await enviarNotificacionPush(uId, {
              title: String(message.roomName || '').trim() && !/^usuario$/i.test(String(message.roomName || '').trim()) && !/^chat privado$/i.test(String(message.roomName || '').trim())
                ? String(message.roomName || '').trim()
                : (nombreEmisor || message.senderName || 'Usuario'),
              body: String(message.roomName || '').trim() && !/^usuario$/i.test(String(message.roomName || '').trim()) && !/^chat privado$/i.test(String(message.roomName || '').trim())
                ? `${nombreEmisor || message.senderName || 'Usuario'}: ${hasDirectMention || hasRoleMention ? `Te menciono: ${contenido || 'Nuevo mensaje'}` : `${contenido || 'Nuevo mensaje'}`}`
                : `${hasDirectMention || hasRoleMention ? `Te menciono: ${contenido || 'Nuevo mensaje'}` : `${contenido || 'Nuevo mensaje'}`}`,
            }, roomId);
        }

        // Después de distribuir a todos, notificar al emisor que el mensaje fue entregado (2 ticks grises)
        if (otherRecipients.length > 0) {
          socket.emit("chat:update_delivered_status", { msg_id: msgId });
        }
      } catch (e) {
        console.error("❌ Error en distribución:", e);
      }
    }
  });

  // --- TYPING ---
  socket.on("chat:typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("chat:user_typing", { userName });
  });

  socket.on("chat:stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("chat:user_stopped_typing");
  });

  // --- SETTINGS ---
  socket.on("chat:update_settings", async (settings) => {
    const { roomId, soloProfesores, delegados } = settings;
    const currentSettings = ajustesSalas[roomId] || { mutedMembers: [], bannedMembers: [] };

    ajustesSalas[roomId] = {
      soloProfesores,
      delegados,
      mutedMembers: currentSettings.mutedMembers || [],
      bannedMembers: currentSettings.bannedMembers || [],
    };

    try {
      await appDb.query(
        `UPDATE comunicacion.salas_chat SET configuracion = $1 WHERE id_sala = $2`,
        [JSON.stringify(ajustesSalas[roomId]), roomId]
      );
    } catch (e) {
      console.error("Error guardando ajustes:", e);
    }

    io.to(roomId).emit("chat:settings_changed", ajustesSalas[roomId]);
  });

  socket.on("chat:send_media", async (payload, ackFn) => {
    // 1. Extraemos los datos (payload trae el campo 'image' con el base64)
    const senderId = userId;
    const { roomId, recipients, image, nombreEmisor } = payload;

    if (!ajustesSalas[roomId]) {
      await cargarAjustesSala(roomId);
    }
    const settings = ajustesSalas[roomId] || { soloProfesores: false, delegados: [], mutedMembers: [], bannedMembers: [] };
    const moderationBlockMessage = payload.esProfesor ? null : getModerationBlockMessage(settings, senderId);
    if (moderationBlockMessage) {
      return socket.emit("error_permisos", { msg: moderationBlockMessage });
    }

    const message = buildIndexedMessage({
      ...payload,
      senderId,
      timestamp: Date.now(),
      read: false
    });

    // 2. IMPORTANTE: Reenviar a la sala
    // Esto hace que el Usuario 2 reciba el objeto con el campo 'image'
    io.to(roomId).emit("chat:receive", message);

    // Confirmar al emisor que el servidor recibió el mensaje (tick simple)
    if (typeof ackFn === 'function') {
      ackFn({ ok: true, msg_id: message.msg_id || payload.msg_id });
    }
    // También emitir evento explícito para que el emisor actualice el estado
    socket.emit("chat:msg_sent", { msg_id: message.msg_id || payload.msg_id });

    // 3. Notificaciones (Para que no se bugee)
    if (recipients) {
      const otherRecipients = recipients.filter(uId => uId !== senderId);

      // Inicializar tracking de lectura para media
      const msgId = message.msg_id || payload.msg_id;
      if (msgId && otherRecipients.length > 0) {
        messageReadTracking.set(msgId, {
          senderId,
          roomId,
          totalRecipients: otherRecipients.length,
          readers: new Set(),
          deliveredUsers: new Set(),
          createdAt: Date.now(),
        });
      }
      if (msgId) {
        await createMessageStatusDb({
          msgId,
          roomId,
          senderId,
          totalRecipients: otherRecipients.length,
          createdAt: message.timestamp,
        });
      }

      const redis = getRedis();
      otherRecipients.forEach(uId => {
          io.to(`user:${uId}`).emit("chat:receive", message);
          if (redis?.status === 'ready') {
            enqueuePendingMessage(redis, uId, message).catch((error) => {
              console.error("❌ Error guardando adjunto en Redis:", error.message);
            });
          }
          const mentionTargets = payload.mentions?.targetUserIds || [];
          const mentionLabels = payload.mentions?.tokens || [];
          const hasMention = mentionTargets.includes(uId) || mentionLabels.some((label) => ["todos", "delegados", "profesor"].includes(label));
          const notifText = hasMention
            ? `${nombreEmisor}: te mencionó en un adjunto`
            : `${nombreEmisor}: 📷 Envió un adjunto`;
          enviarNotificacionPush(uId, {
            title: String(message.roomName || '').trim() && !/^usuario$/i.test(String(message.roomName || '').trim()) && !/^chat privado$/i.test(String(message.roomName || '').trim())
              ? String(message.roomName || '').trim()
              : (nombreEmisor || message.senderName || 'Usuario'),
            body: String(message.roomName || '').trim() && !/^usuario$/i.test(String(message.roomName || '').trim()) && !/^chat privado$/i.test(String(message.roomName || '').trim())
              ? `${nombreEmisor || message.senderName || 'Usuario'}: ${hasMention ? 'Te menciono en un adjunto' : 'Adjunto recibido'}`
              : `${hasMention ? 'Te menciono en un adjunto' : 'Adjunto recibido'}`,
          }, roomId).catch((error) => {
            console.error("❌ Error enviando push inmediata de adjunto:", error?.message || error);
          });
      });

      // Notificar al emisor que el mensaje fue entregado (2 ticks grises)
      if (otherRecipients.length > 0) {
        socket.emit("chat:update_delivered_status", { msg_id: msgId });
      }
    }
  });

  socket.on("chat:reaction", async (payload) => {
    const senderId = userId;
    const { roomId, msgId, reaction, recipients } = payload;

    // 1. Broadcast to room EXCLUDING the sender (they already updated optimistically)
    socket.to(roomId).emit("chat:reaction", { msgId, reaction });

    // 2. Offline Queue via Redis (for users not currently in the room)
    if (recipients && Array.isArray(recipients)) {
      try {
        const redis = getRedis();
        const reactionObj = { type: 'reaction', msgId, reaction, roomId };

        for (const uId of recipients) {
          if (uId !== senderId) {
            // Only send to personal channel (for users not in the room/offline)
            // socket.to(roomId) already covered users inside the room
            if (redis?.status === 'ready') {
              await enqueuePendingMessage(redis, uId, reactionObj);
            }
          }
        }
      } catch (e) {
        console.error("❌ Error distributing reaction:", e);
      }
    }
  });

  socket.on("chat:read_receipt", ({ msg_id, roomId }) => {
    if (!msg_id || !userId) return;

    Promise.resolve()
      .then(async () => {
        let tracking = messageReadTracking.get(msg_id);
        if (!tracking) tracking = await syncTrackingFromStatus(msg_id);

        const persisted = await markMessageReadDb({ msgId: msg_id, userId });
        if (!persisted) return;

        if (tracking) {
          tracking.readers.add(String(userId));
          tracking.deliveredUsers?.add(String(userId));
        }

        if (persisted.delivered) {
          io.to(roomId).emit("chat:update_delivered_status", { msg_id });
        }

        if (persisted.read) {
          io.to(roomId).emit("chat:update_read_status", { msg_id });
          messageReadTracking.delete(msg_id);
        }
      })
      .catch((error) => {
        console.error("❌ Error en chat:read_receipt:", error.message);
      });
  });

  socket.on("chat:delivered_receipt", ({ msg_id, roomId }) => {
    if (!msg_id || !userId) return;

    Promise.resolve()
      .then(async () => {
        let tracking = messageReadTracking.get(msg_id);
        if (!tracking) tracking = await syncTrackingFromStatus(msg_id);

        const persisted = await markMessageDeliveredDb({ msgId: msg_id, userId });
        if (!persisted) return;

        if (tracking) {
          if (!tracking.deliveredUsers) tracking.deliveredUsers = new Set();
          tracking.deliveredUsers.add(String(userId));
        }

        if (persisted.delivered) {
          io.to(roomId).emit("chat:update_delivered_status", { msg_id });
        }
      })
      .catch((error) => {
        console.error("❌ Error en chat:delivered_receipt:", error.message);
      });
  });

  socket.on("chat:strong_read", ({ msg_id, roomId, userName }) => {
    if (!msg_id || !roomId || !userId) return;
    io.to(roomId).emit("chat:update_strong_read", {
      msg_id,
      reader: {
        userId,
        userName: userName || 'Usuario',
        readAt: Date.now(),
      }
    });
  });

  // ==================================
  // PIN MESSAGE HANDLERS
  // ==================================
  socket.on("chat:pin_message", async (payload) => {
    const { roomId, messageId, duration, category, color, durationLabel } = payload;
    console.log(`📌 Pin message request:`, payload);

    const pinData = await createPinDb({
      roomId,
      messageId,
      duration,
      durationLabel,
      category,
      color,
      senderName: payload.senderName || 'Profesor',
      text: payload.text || payload.contenido || 'Mensaje fijado',
    });

    // Broadcast to all users in the room
    io.to(roomId).emit("chat:receive_pin", pinData);
    console.log(`📌 Pin broadcast to room ${roomId}`);
  });

  socket.on("chat:unpin_message", async (payload) => {
    const { roomId, messageId } = payload;
    console.log(`📌 Unpin message request:`, payload);

    await removePinDb({ roomId, messageId });

    // Broadcast to all users in the room
    io.to(roomId).emit("chat:receive_unpin", { messageId });
    console.log(`📌 Unpin broadcast to room ${roomId}`);
  });

  // ==================================
  // SISTEMA DE VIDEOLLAMADAS TIPO MEET
  // ==================================

  // Unirse a una sala de videollamada
  socket.on("meet:join", ({ roomId, userId: claimedUserId, type }) => {
    const meetUserId = userId;
    // LOG DETALLADO PARA DEBUGGING
    console.log(`📞 MEET:JOIN recibido:`, {
      roomId,
      userId: meetUserId,
      claimedUserId,
      type,
      roomIdType: typeof roomId,
      userIdType: typeof meetUserId,
      socketId: socket.id,
      isRoomIdValid: roomId && roomId !== 'null' && roomId !== 'undefined',
      isUserIdValid: meetUserId && meetUserId !== 'null' && meetUserId !== 'undefined'
    });

    // VALIDACIÓN DE DATOS
    if (!roomId || roomId === 'null' || roomId === 'undefined' || roomId.trim() === '') {
      console.error("❌ roomId inválido en meet:join");
      socket.emit("meet:error", { msg: "ID de sala inválido" });
      return;
    }

    if (!meetUserId || meetUserId === 'null' || meetUserId === 'undefined' || meetUserId.trim() === '') {
      console.error("❌ userId inválido en meet:join");
      socket.emit("meet:error", { msg: "ID de usuario inválido" });
      return;
    }

    if (!meetRooms.has(roomId)) {
      meetRooms.set(roomId, { participants: new Map(), screenSharers: new Map(), callId: crypto.randomUUID(), type });
      console.log(`✨ Creada sala de Meet en memoria: ${roomId}`);
    }

    const room = meetRooms.get(roomId);
    if (!room.screenSharers) room.screenSharers = new Map();

    // Evitar duplicados
    if (room.participants.has(meetUserId)) {
      console.log(`⚠️ Usuario ${meetUserId} ya está en la sala, actualizando socketId`);
      room.participants.set(meetUserId, socket.id);
    } else {
      room.participants.set(meetUserId, socket.id);
      console.log(`➕ Usuario ${meetUserId} añadido a la sala ${roomId}`);
    }

    socket.join(`meet:${roomId}`);
    console.log(`🚪 Socket ${socket.id} unido a meet:${roomId}`);

    const others = Array.from(room.participants.entries())
      .filter(([uid]) => uid !== meetUserId)
      .map(([uid, sid]) => ({ userId: uid, socketId: sid }));

    console.log(`👥 Enviando lista de ${others.length} participantes existentes a ${meetUserId}`);
    socket.emit("meet:participants", {
      participants: others,
      callId: room.callId,
      screenSharers: Array.from(room.screenSharers.entries()).map(([socketId, sharerUserId]) => ({ socketId, userId: sharerUserId }))
    });

    console.log(`📢 Notificando a ${others.length} usuarios sobre nuevo participante ${meetUserId}`);
    socket.to(`meet:${roomId}`).emit("meet:user-joined", { userId: meetUserId, socketId: socket.id });
  });

  socket.on("meet:screen-share-state", ({ roomId, isSharing }) => {
    const room = meetRooms.get(roomId);
    if (!room) return;
    if (!room.screenSharers) room.screenSharers = new Map();

    if (isSharing) room.screenSharers.set(socket.id, userId);
    else room.screenSharers.delete(socket.id);

    socket.to(`meet:${roomId}`).emit("meet:screen-share-state", {
      socketId: socket.id,
      userId,
      isSharing: !!isSharing
    });
  });

  socket.on("meet:offer", (data) => {
    console.log(`📤 Reenviando Offer de ${socket.id} a ${data.to} (renegotiation: ${!!data.isRenegotiation})`);
    // FIX: propagar isRenegotiation al receptor para que fuerce re-mount del <video>
    io.to(data.to).emit("meet:offer", {
      from: socket.id,
      offer: data.offer,
      roomId: data.roomId,
      isRenegotiation: !!data.isRenegotiation
    });
  });

  socket.on("meet:answer", (data) => {
    console.log(`📥 Reenviando Answer de ${socket.id} a ${data.to}`);
    io.to(data.to).emit("meet:answer", { from: socket.id, answer: data.answer, roomId: data.roomId });
  });

  socket.on("meet:ice-candidate", (data) => {
    if (data.to) {
      console.log(`🧊 Reenviando ICE candidate de ${socket.id} a ${data.to}`);
      io.to(data.to).emit("meet:ice-candidate", { from: socket.id, candidate: data.candidate });
    }
  });

  socket.on("meet:leave", ({ roomId, userId: claimedUserId }) => {
    console.log(`👋 meet:leave recibido de ${userId} en sala ${roomId}`, { claimedUserId });
    leaveMeetRoom(roomId, userId, socket.id);
  });

  // ==================================
  // QR SYNC - Sincronizar mensajes móvil → web
  // ==================================
  // Mapa global de tokens QR activos: token → { webSocketId, userId, createdAt }
  const qrSyncSessions = io._qrSyncSessions || (io._qrSyncSessions = new Map());

  // 1. Web solicita un token QR para mostrar
  socket.on("sync:request_qr", () => {
    const token = crypto.randomBytes(16).toString('hex');
    qrSyncSessions.set(token, { 
      webSocketId: socket.id, 
      userId, 
      createdAt: Date.now(),
      paired: false 
    });
    // Limpiar tokens expirados (>5 min)
    for (const [t, s] of qrSyncSessions) {
      if (Date.now() - s.createdAt > 5 * 60 * 1000) qrSyncSessions.delete(t);
    }
    socket.emit("sync:qr_token", { token });
    console.log(`[QR Sync] Token generado para usuario ${userId}: ${token.substring(0, 8)}...`);
  });

  // 2. Móvil escanea QR y envía el token para emparejar
  socket.on("sync:pair", ({ token, userId: claimedUserId }) => {
    const session = qrSyncSessions.get(token);
    if (!session) {
      socket.emit("sync:error", { msg: "Código QR expirado o inválido" });
      return;
    }
    if (session.userId !== userId) {
      console.warn(`[QR Sync] Intento de emparejado cruzado`, { expectedUserId: session.userId, claimedUserId, socketUserId: userId });
      socket.emit("sync:error", { msg: "El QR pertenece a otro usuario" });
      return;
    }
    session.mobileSocketId = socket.id;
    session.paired = true;
    qrSyncSessions.set(token, session);

    // Notificar a web que se emparejó
    io.to(session.webSocketId).emit("sync:paired", { mobileSocketId: socket.id });
    socket.emit("sync:paired_ack", { ok: true });
    console.log(`[QR Sync] Emparejado: móvil ${socket.id} ↔ web ${session.webSocketId}`);
  });

  // 3. Móvil envía un chunk de mensajes
  socket.on("sync:chunk", ({ token, roomId, messages, chunkIndex, totalChunks }) => {
    const session = qrSyncSessions.get(token);
    if (!session || !session.paired) return;
    // Relay al socket web
    io.to(session.webSocketId).emit("sync:chunk", { roomId, messages, chunkIndex, totalChunks });
  });

  // 4. Móvil indica que terminó de enviar todo
  socket.on("sync:complete", ({ token, totalRooms, totalMessages }) => {
    const session = qrSyncSessions.get(token);
    if (!session) return;
    io.to(session.webSocketId).emit("sync:complete", { totalRooms, totalMessages });
    qrSyncSessions.delete(token);
    console.log(`[QR Sync] Completado: ${totalMessages} mensajes en ${totalRooms} salas`);
  });

  // --- LIMPIEZA EN DISCONNECT ---
  socket.on("disconnecting", () => {
    if (!userId) return;
    const offlinePresence = setUserPresence(userId, { online: false, status: "offline" });
    connectedRooms.forEach((roomId) => {
      io.to(roomId).emit("presence:update", offlinePresence);
    });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket desconectado: ${socket.id}`);

    meetRooms.forEach((room, rId) => {
      for (let [uId, sId] of room.participants) {
        if (sId === socket.id) {
          console.log(`🧹 Limpiando usuario ${uId} de sala ${rId} por disconnect`);
          leaveMeetRoom(rId, uId, socket.id);
        }
      }
    });
  });

  // Función auxiliar para salir de meet
  function leaveMeetRoom(roomId, userId, socketId) {
    const room = meetRooms.get(roomId);
    if (!room) {
      console.log(`⚠️ Sala ${roomId} no encontrada en leaveMeetRoom`);
      return;
    }

    room.participants.delete(userId);
    if (room.screenSharers) room.screenSharers.delete(socketId);
    socket.leave(`meet:${roomId}`);

    // Notificar a los demás
    socket.to(`meet:${roomId}`).emit("meet:user-left", { userId, socketId });
    socket.to(`meet:${roomId}`).emit("meet:screen-share-state", { userId, socketId, isSharing: false });

    console.log(`👋 ${userId} salió de meet ${roomId}. Quedan: ${room.participants.size}`);

    // Si no queda nadie, eliminar sala y actualizar BD
    if (room.participants.size === 0) {
      appDb.query(
        `UPDATE comunicacion.historial_llamadas 
       SET fin = now(), estado = 'finalizada' 
       WHERE id_llamada = $1`,
        [room.callId]
      ).catch(e => console.error("Error finalizando llamada:", e));

      meetRooms.delete(roomId);
      console.log(`🗑️ Meet ${roomId} eliminado (sin participantes)`);
    }
  }
});

const PORT = process.env.PORT || 4000;

Promise.all([initCollabTables(), initMessageStatusTable()])
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ No se pudieron inicializar las tablas colaborativas:", error.message);
    process.exit(1);
  });
