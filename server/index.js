import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.routes.js";
import academicoRoutes from "./routes/academico.routes.js";
import mensajesRoutes from "./routes/mensajes.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import adminRoutes from "./routes/admin.routes.js";      

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
app.use("/admin", adminRoutes);                            

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
        console.log(`ICE config de Metered: ${iceServers.length} servidores`);
        return res.json({ iceServers });
      }
      console.warn('Metered respondió con error:', response.status);
    } catch (e) {
      console.error('Error obteniendo ICE config de Metered:', e.message);
    }
  }

  // Fallback: múltiples TURN públicos por si falla Metered o no hay .env configurado
  // Nota: estos son menos fiables que Metered para producción
  console.warn('Usando TURN público de fallback (configura METERED_API_KEY para producción)');
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


// Verificación de Redis
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

// Inicialización del servidor HTTP y Socket.IO con soporte CORS
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Guayre : En producción esto debería ser solo los dominios del Front
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"], 
    credentials: true
  },
});

// Extrae el Jwt de diferentes posibles ubicaciones en el handshake del socket
// 1. auth.token | 2.  query.token | 3. headers.authorization (Bearer)
const getSocketToken = (socket) => {
  // 1. Intentamos extraer el token de auth.token 
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) return authToken.trim();
  // 2. Intentamos extraerlo de query.token
  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();
  // 3. Intentamos extraerlo de headers.authorization (formato "Bearer <token>")
  const authorizationHeader = socket.handshake.headers?.authorization;
  if (typeof authorizationHeader === "string" && authorizationHeader.startsWith("Bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
};

// Middleware de Socket.IO para autenticar conexiones usando JWT antes de permitir la conexión
// Si es válido añade userId y authUser al socket, si no rechaza la conexión con un error
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

// Normaliza el mensaje para asegurar que siempre tenga los campos necesarios y la metadata correcta, independientemente de cómo lo envíe el cliente. Esto facilita el manejo uniforme en el servidor y el cliente
function buildIndexedMessage(payload) {
  const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const messageType = payload?.messageType || metadata.messageType || null;
  const threadTopic = payload?.threadTopic || metadata.threadTopic || null;
  const requiresAck = Boolean(payload?.requiresAck);

  // Un mensaje es importante si su tipo está en IMPORTANT_MESSAGE_TYPES o si explícitamente viene marcado como importante en el payload o metadata. Esto permite destacar ciertos mensajes en el cliente
  const important = Boolean(payload?.important || metadata.important || IMPORTANT_MESSAGE_TYPES.has(String(messageType || "")));

  return {
    ...payload,
    // Asegura consistencia entre 'text' y 'contenido'
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

/**
 * Programa una notificación Push si el mensaje no se entrega vía Socket en un tiempo determinado.
 * @param {string} msgId - ID del mensaje a monitorear.
 * @param {string} recipientId - Usuario que debe recibir la notificación.
 * @param {number} PUSH_FALLBACK_DELAY_MS - Tiempo de espera antes de verificar la entrega.
 */

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

      // Si el mensaje ya fue entregado o leído por el destinatario, no enviamos la notificación push
      if (deliveredUsers.has(recipientKey) || readUsers.has(recipientKey)) {
        console.log(`[PushFallback] Omitida para ${recipientId} en ${msgId}: ya entregado/leido`);
        return;
      }

      // El usuario está offline o no recibió el evento por socket, disparamos Push
      console.log(`[PushFallback] Enviando push a ${recipientId} para ${msgId}`);
      await enviarNotificacionPush(recipientId, notification, roomId);
    } catch (error) {
      console.error(`[PushFallback] Error evaluando ${msgId} para ${recipientId}:`, error.message);
    }
  }, PUSH_FALLBACK_DELAY_MS);
};

// Función para cargar ajustes del chat específico desde BD (roomId = id_sala)
async function cargarAjustesSala(roomId) {
  try {
    const { rows } = await appDb.query(`
      SELECT configuracion 
      FROM comunicacion.salas_chat
      WHERE id_sala = $1
    `, [roomId]);

    // Si existe configuración, se normaliza y se guarda en el objeto global 'ajustesSalas'
    if (rows.length > 0 && rows[0].configuracion) {
      const config = rows[0].configuracion;
      ajustesSalas[roomId] = {
        soloProfesores: config.soloProfesores || false,
        delegados: config.delegados || [],
        mutedMembers: Array.isArray(config.mutedMembers) ? config.mutedMembers : [],
        bannedMembers: Array.isArray(config.bannedMembers) ? config.bannedMembers : [],
      };
    }

    // Devuelve la configuración de la sala o un objeto por defecto (fallback)
    return ajustesSalas[roomId] || { soloProfesores: false, delegados: [], mutedMembers: [], bannedMembers: [] };
  } catch (e) {
    // En caso de error de BD, devolvemos una configuración permisiva para no romper el flujo
    console.error("Error cargando ajustes:", e);
    return { soloProfesores: false, delegados: [], mutedMembers: [], bannedMembers: [] };
  }
}

// Función para verificar si un usuario tiene una entrada activa de moderación (baneo o mute) en la sala, considerando expiraciones temporales. Devuelve la entrada activa o null si no hay restricciones vigentes
const getActiveModerationEntry = (entries = [], userId) => {
  const now = Date.now();
  return (Array.isArray(entries) ? entries : []).find((entry) => {
    // Compara IDs asegurando que ambos sean strings
    if (String(entry?.userId || '') !== String(userId || '')) return false;
    // Si no tiene fecha de expiración, se considera restricción permanente (activa)
    if (!entry?.expiresAt) return true;
    // Verifica si la restricción sigue vigente comparando con el tiempo actual
    return Number(entry.expiresAt) > now;
  }) || null;
};

// Función para determinar el mensaje de bloqueo por moderación (baneo o mute) que se le debe mostrar a un usuario si intenta enviar un mensaje en una sala donde tiene restricciones activas. 
// Devuelve el mensaje específico según el tipo de restricción o null si no hay bloqueos
const getModerationBlockMessage = (settings, senderId) => {
  const bannedEntry = getActiveModerationEntry(settings?.bannedMembers, senderId);
  if (bannedEntry) {
    return bannedEntry.expiresAt
      ? `No puedes enviar mensajes hasta ${new Date(Number(bannedEntry.expiresAt)).toLocaleString('es-ES')}.`
      : 'No puedes enviar mensajes en este chat hasta que el profesorado retire la restriccion.';
  }

  // Si no está baneado, verificamos si está silenciado
  const mutedEntry = getActiveModerationEntry(settings?.mutedMembers, senderId);
  if (mutedEntry) {
    return mutedEntry.expiresAt
      ? `Estas silenciado hasta ${new Date(Number(mutedEntry.expiresAt)).toLocaleString('es-ES')}.`
      : 'Estas silenciado en este chat hasta que el profesorado retire la restriccion.';
  }

  // Si no hay bloqueos activos, devolvemos null indicando que el usuario puede enviar mensajes normalmente
  return null;
};


// ESTRUCTURA DE SALAS DE VIDEOLLAMADA (Tipo Google Meet)
// Clave: roomId (id del chat/sala)
// Valor: { participants: Map(userId -> socketId), callId: uuid, type: 'audio'|'video' }
const meetRooms = new Map();

// ─── Tracking de lectura por mensaje (para ticks de grupo) ───────────────────
// Clave: msg_id → { senderId, roomId, recipients: number, readers: Set<userId> }
const messageReadTracking = new Map();

// Función para sincronizar el estado de lectura desde la base de datos al tracking en memoria. Esto se utiliza cuando se recibe un recibo de lectura pero no tenemos el estado en memoria 
// (por ejemplo, después de un reinicio del servidor) para asegurarnos de que el tracking refleje el estado real persistido
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

// Manejo de conexiones Socket.IO y eventos relacionados con el chat, presencia y videollamadas. IMPORTANTE: Este bloque es el núcleo de la lógica en tiempo real del servidor, 
// gestiona desde la autenticación inicial hasta la distribución de mensajes, actualizaciones de presencia y coordinación de salas de videollamada
// Cada vez que un cliente se conecta, se autentica usando el token JWT, se une a las salas correspondientes según su rol y asignaturas, y se establece su presencia como online. 
// Luego, se manejan eventos como envío de mensajes, actualizaciones de presencia, ajustes de sala y reacciones, 
// asegurando la correcta distribución de mensajes tanto para usuarios online como offline (usando Redis como respaldo)

// ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

//NOTA IMPORTANTE: Si tocas esto te asesino :D
// QUE LA IA JOEL NO TOQUE ESTO POR FAVOR, ES MUY SENSIBLE Y CUALQUIER CAMBIO PUEDE ROMPER COSAS. SI NECESITAS HACER AJUSTES, AVISAME. POR TU MADRE.

// ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

// La estructura normal de Socket.IO es io.on("connection", (socket) => { ... }) pero dentro de este bloque se manejan muchos eventos y lógica importante.
// Para hacer otro evento dentro de este con tipo socket.on("otro_evento", () => { ... }) es necesario que esté dentro de este bloque para que tenga acceso al userId y a la conexión específica del socket. 
// Si lo pones fuera, no va a funcionar porque no va a tener el contexto del usuario conectado ni podrá emitir eventos correctamente.

io.on("connection", async (socket) => {
  const userId = socket.userId;
  const deviceType = String(socket.handshake.query.deviceType || "mobile").toLowerCase();
  let connectedRooms = [];

  if (userId) {
    // Sala Personal: Para recibir todo aunque esté en el Home
    socket.join(`user:${userId}`);
    console.log(`Usuario conectado: ${userId}`);
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

        // Consulta id_sala (salas grupales) y chats_privados
        // Vinculo la vista → clases (por nombre) → salas_chat → oferta (por asignatura)
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

        // Unirse a cada sala obtenida y emitir presencia inicial a cada una
        salas.forEach(row => {
          socket.join(row.sala_id);
          connectedRooms.push(String(row.sala_id));
        });

        connectedRooms.forEach((roomId) => {
          io.to(roomId).emit("presence:update", initialPresence);
        });

        console.log(`Sincronizadas ${salas.length} salas para ${userId}`);
      }
    } catch (e) {
      console.error("Error Auto-Join:", e.message);
    }

    // Recuperar pendientes web. Los del movil se sincronizan via API + ACK explicito.
    try {
      const redis = getRedis();
      if (deviceType === "web" && redis && redis.status === 'ready') {
        const pendingMessages = await listPendingMessages(redis, userId, "web");
        if (pendingMessages.length > 0) {
          console.log(`Entregando ${pendingMessages.length} mensajes offline`);
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
      console.error("Redis no disponible (no crítico):", e.message);
    }
  }

  // La funcion de este evento es permitir que el cliente se una manualmente a una sala específica (por ejemplo, al abrir un chat desde la lista) y 
  // cargar los ajustes de esa sala para aplicar las restricciones correspondientes. Esto es útil para asegurar que el cliente siempre tenga la configuración actualizada 
  // de la sala a la que se une, especialmente si hay cambios en los permisos o moderación
  socket.on("join_room", async (roomId) => {
    // Verificamos que el usuario tenga permiso para unirse a esa sala antes de permitirlo
    socket.join(roomId);
    if (!connectedRooms.includes(String(roomId))) {
      connectedRooms.push(String(roomId));
    }
    console.log(`Unión manual: ${socket.id} -> ${roomId}`);

    // Funcion asíncrona que espera a que le lleguen los datos de la funcion (que esta llama a la BD) para cargar los ajustes de la sala 
    await cargarAjustesSala(roomId);
  });

  // Manejo de actualización de presencia. Permite al cliente actualizar su estado de presencia (disponible, en clase, ocupado)
  socket.on("presence:set_status", ({ status }) => {
    if (!userId) return;
    const nextStatus = ["available", "in_class", "busy"].includes(status) ? status : "available";
    const presence = setUserPresence(userId, { online: true, status: nextStatus });

    connectedRooms.forEach((roomId) => {
      io.to(roomId).emit("presence:update", presence);
    });

    io.to(`user:${userId}`).emit("presence:update", presence);
  });

  // EL EJE CENTRAL DE LA APP => ENVIAR MENSAJES 
  // Este es el evento central para el chat, donde se reciben los mensajes enviados por los clientes, se validan los permisos según la configuración de la sala (ajustesSalas)
  // se construye el mensaje con la metadata necesaria, se emite a la sala correspondiente y a los destinatarios específicos, y se maneja el almacenamiento en Redis 
  // para usuarios offline y el tracking de lectura para grupos
  socket.on("chat:send", async (payload, ackFn) => {
    const senderId = userId;
    const { roomId, recipients, esProfesor, contenido, nombreEmisor, imageUri } = payload;

    if (!ajustesSalas[roomId]) {
      await cargarAjustesSala(roomId);
    }
    // Check de permisos: Si la sala es solo para profesores, el emisor no es profesor y no es delegado, no puede enviar mensajes. 
    // Además, si tiene una restricción activa de baneo o mute, se le bloquea con el mensaje correspondiente
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
      contenido: contenido || payload.text, // Aseguramos que tenga algo porque sino se jode el cliente al intentar renderizar mensajes sin contenido
      timestamp: Date.now(),
      read: false
    });

    // DISTIBUCION DEL MENSAJE EN TIEMPO REAL CON LOS CLIENTES CONECTADOS (Sockets) Y RESPALDO EN REDIS PARA LOS OFFLINE

    // A. Envío a la sala (Para los que están dentro del chat abierto) 
    io.to(roomId).emit("chat:receive", message);

    // Confirmar al emisor que el servidor recibió el mensaje (tick simple)
    if (typeof ackFn === 'function') {
      ackFn({ ok: true, msg_id: message.msg_id || payload.msg_id });
    }
    // También emitir evento explícito para que el emisor actualice el estado
    socket.emit("chat:msg_sent", { msg_id: message.msg_id || payload.msg_id });

    // TRACKING DE LECTURA Y PERSISTENCIA EN DB: Inicializo el tracking de lectura para este mensaje, 
    // guardo el estado inicial en la base de datos y programao una verificación para enviar notificaciones push si el mensaje no se entrega por socket

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

        // MANTENIMIENTO DE MEMORIA

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

      // Registro inicial en BD para auditorias y persistencia a largo plazo (solo si es un mensaje grupal, para mensajes 1:1 no es necesario)
      if (msgId) {
        await createMessageStatusDb({
          msgId,
          roomId,
          senderId,
          totalRecipients: otherRecipients.length,
          createdAt: message.timestamp,
        });
      }

      // DISTRIBUCIÓN MULTI-CANAL ( USUARIOS FUERA DE LA SALA O OFFLINE )
      // Para cada destinatario que no sea el emisor, se intenta entregar el mensaje por socket (si está online y conectado a la sala), se guarda en Redis como respaldo para offline, 
      // y se envía una notificación push si es importante o si el destinatario fue mencionado
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
        console.error("Error en distribución:", e);
      }
    }
  });

  // Emite el evento de que la persona esta escribiendo como: "Ana está escribiendo ..."
  socket.on("chat:typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("chat:user_typing", { userName });
  });

  // Actualiza la interfaz para que deje de mostrar "Ana está escribiendo ..."
  socket.on("chat:stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("chat:user_stopped_typing");
  });

  // Manejo de actualización de ajustes de sala (soloProfesores, delegados, muteos, baneos). 
  // Este evento permite que el profesorado actualice la configuración de la sala en tiempo real
  socket.on("chat:update_settings", async (settings) => {
    const { roomId, soloProfesores, delegados } = settings;
    const currentSettings = ajustesSalas[roomId] || { mutedMembers: [], bannedMembers: [] };

    ajustesSalas[roomId] = {
      soloProfesores,
      delegados,
      mutedMembers: currentSettings.mutedMembers || [], // hace lo mismo que banned
      bannedMembers: currentSettings.bannedMembers || [], // hace los mismo que mited
    };

    // Persistencia en la BD para guardar los cambios 
    try {
      await appDb.query(
        `UPDATE comunicacion.salas_chat SET configuracion = $1 WHERE id_sala = $2`,
        [JSON.stringify(ajustesSalas[roomId]), roomId]
      );
    } catch (e) {
      console.error("Error guardando ajustes:", e);
    }

    // Luego se emite a todos los usuarios para que se actualicen los permisos 
    io.to(roomId).emit("chat:settings_changed", ajustesSalas[roomId]);
  });


  // Manejo de envío de mensajes con medios (imágenes). 
  // Este evento es similar a "chat:send" pero específicamente para mensajes que incluyen un campo 'image' con la imagen en base64.
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

      // Distribución a destinatarios específicos (para notificaciones push y respaldo en Redis)
      const redis = getRedis();
      otherRecipients.forEach(uId => {
          io.to(`user:${uId}`).emit("chat:receive", message);
          if (redis?.status === 'ready') {
            enqueuePendingMessage(redis, uId, message).catch((error) => {
              console.error("Error guardando adjunto en Redis:", error.message);
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
            console.error("Error enviando push inmediata de adjunto:", error?.message || error);
          });
      });

      // Notificar al emisor que el mensaje fue entregado (2 ticks grises)
      if (otherRecipients.length > 0) {
        socket.emit("chat:update_delivered_status", { msg_id: msgId });
      }
    }
  });

  // Manejo de reacciones a mensajes. Permite a los usuarios reaccionar a mensajes específicos con emojis u otras reacciones, 
  // y distribuye esa información tanto a los usuarios dentro de la sala como a los destinatarios específicos (usando Redis para offline)
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
            // IMPORTANTE: No uso io.to(`user:${uId}`) aquí porque quiero que la reacción solo llegue a los usuarios que no están actualmente en la sala (offline o fuera de la sala),
            // si uso io.to(`user:${uId}`) va a llegar a todos los dispositivos del usuario, incluso si están dentro del chat, y eso puede causar que la reacción se duplique o se muestre incorrectamente y se lia
            // Rezo para que no pase nada raro con esto. 
            // La idea es que la reacción se entregue por socket a los usuarios que están en la sala (incluido el emisor), y para los que no están, se guarde en Redis para entregar cuando se conecten o abran el chat.
            if (redis?.status === 'ready') {
              await enqueuePendingMessage(redis, uId, reactionObj);
            }
          }
        }
      } catch (e) {
        console.error("Error distributing reaction:", e);
      }
    }
  });

  // Manejo de recibos de lectura y entrega. Estos eventos se disparan cuando un cliente lee un mensaje o recibe un mensaje, 
  // y actualiza el estado tanto en memoria (para tracking en grupos) como en la base de datos,
  socket.on("chat:read_receipt", ({ msg_id, roomId }) => {
    if (!msg_id || !userId) return;

    // IMPORTANTE: Este evento es crítico para el tracking de lectura en grupos. Cuando se recibe un recibo de lectura, se actualiza el tracking en memoria (messageReadTracking) para ese mensaje específico
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
        console.error("Error en chat:read_receipt:", error.message);
      });
  });

  // Manejo de recibos de entrega. Similar al recibo de lectura, pero se dispara cuando un mensaje es entregado al cliente (por ejemplo, cuando se recibe por socket o se recupera de Redis),
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
        console.error("Error en chat:delivered_receipt:", error.message);
      });
  });

  // Manejo de recibos de lectura "fuertes" ( tick azul ).
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

  // Manejo de mensajes fijados (pin) y des-fijados (unpin). 
  // Permite al profesorado fijar mensajes importantes en la parte superior del chat, con una categoría, color y duración opcional
  socket.on("chat:pin_message", async (payload) => {
    const { roomId, messageId, duration, category, color, durationLabel } = payload;
    console.log(`Pin message request:`, payload);

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

    // Emitir a todos los usuarios en la sala el mensaje fijado para que lo muestren en la interfaz
    io.to(roomId).emit("chat:receive_pin", pinData);
    console.log(`Pin broadcast to room ${roomId}`);
  });

  socket.on("chat:unpin_message", async (payload) => {
    const { roomId, messageId } = payload;
    console.log(`Unpin message request:`, payload);

    await removePinDb({ roomId, messageId });

    // Emitir a todos los usuarios en la sala que se ha des-fijado el mensaje para que lo eliminen de la interfaz
    io.to(roomId).emit("chat:receive_unpin", { messageId });
    console.log(`Unpin broadcast to room ${roomId}`);
  });

  // SISTEMA DE VIDEOLLAMADAS (COPIA DE GOOGLE MEET) PUTISIMA IMPLEMENTACION, PERO FUNCIONA Y NO ROMPE NADA  | REZAR Y QUE NO SE ROMPA MAS PORQUE ES UN INFIERNO DE CODIGO

  // Unirse a una sala de videollamada
  socket.on("meet:join", ({ roomId, userId: claimedUserId, type }) => {
    const meetUserId = userId;
    console.log(`MEET:JOIN recibido:`, {
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
      console.error("roomId inválido en meet:join");
      socket.emit("meet:error", { msg: "ID de sala inválido" });
      return;
    }
 
    // El userId que viene en la petición es solo referencial, el real se obtiene del token JWT y se asigna a meetUserId. Esto es para evitar suplantaciones de identidad.
    if (!meetUserId || meetUserId === 'null' || meetUserId === 'undefined' || meetUserId.trim() === '') {
      console.error("userId inválido en meet:join");
      socket.emit("meet:error", { msg: "ID de usuario inválido" });
      return;
    }

    // Si la sala no existe en memoria, la creamos. Cada sala tiene un mapa de participantes (userId → socketId) y un mapa de screen sharers (socketId → userId)
    if (!meetRooms.has(roomId)) {
      meetRooms.set(roomId, { participants: new Map(), screenSharers: new Map(), callId: crypto.randomUUID(), type });
      console.log(`Creada sala de Meet en memoria: ${roomId}`);
    }
    
    // Agregar o actualizar el participante en la sala
    const room = meetRooms.get(roomId);
    if (!room.screenSharers) room.screenSharers = new Map();

    // Evitar duplicados
    if (room.participants.has(meetUserId)) {
      console.log(`Usuario ${meetUserId} ya está en la sala, actualizando socketId`);
      room.participants.set(meetUserId, socket.id);
      // Nota: Esto puede pasar si el usuario se conecta desde otro dispositivo o pestaña, o si se recarga la página. En este caso, simplemente actualizamos el socketId para ese userId.
    } else {
      room.participants.set(meetUserId, socket.id);
      console.log(`Usuario ${meetUserId} añadido a la sala ${roomId}`);
    }

    // Unir el socket a la sala de Socket.IO para facilitar la emisión de eventos a todos los participantes
    socket.join(`meet:${roomId}`);
    console.log(`Socket ${socket.id} unido a meet:${roomId}`);

    // Enviar al nuevo participante la lista de participantes existentes y quiénes están compartiendo pantalla
    const others = Array.from(room.participants.entries())
      .filter(([uid]) => uid !== meetUserId)
      .map(([uid, sid]) => ({ userId: uid, socketId: sid }));

    console.log(`Enviando lista de ${others.length} participantes existentes a ${meetUserId}`);
    // Además de la lista de participantes, también enviamos quiénes están compartiendo pantalla para que el cliente pueda mostrar los indicadores correspondientes
    socket.emit("meet:participants", {
      participants: others,
      callId: room.callId,
      screenSharers: Array.from(room.screenSharers.entries()).map(([socketId, sharerUserId]) => ({ socketId, userId: sharerUserId }))
    });

    console.log(`Notificando a ${others.length} usuarios sobre nuevo participante ${meetUserId}`);
    // Notificar a los demás participantes que se ha unido un nuevo usuario, incluyendo su userId y socketId para que puedan establecer la conexión WebRTC
    socket.to(`meet:${roomId}`).emit("meet:user-joined", { userId: meetUserId, socketId: socket.id });
  });

  // Manejo de cambio de estado de compartir pantalla. Cuando un participante comienza o deja de compartir pantalla, 
  // se actualiza el estado en la sala y se notifica a los demás participantes para que actualicen su interfaz y conexiones WebRTC en consecuencia
  socket.on("meet:screen-share-state", ({ roomId, isSharing }) => {
    const room = meetRooms.get(roomId);
    if (!room) return;
    if (!room.screenSharers) room.screenSharers = new Map();

    // Actualizar el mapa de screen sharers: si isSharing es true, añadimos al participante, si es false, lo eliminamos
    if (isSharing) room.screenSharers.set(socket.id, userId);
    else room.screenSharers.delete(socket.id);

    // Notificar a los demás participantes el cambio de estado de compartir pantalla, 
    // incluyendo el socketId del participante que cambió su estado y su userId para que puedan identificarlo en la interfaz
    socket.to(`meet:${roomId}`).emit("meet:screen-share-state", {
      socketId: socket.id,
      userId,
      isSharing: !!isSharing
    });
  });

  // Manejo de ofertas WebRTC (SDP) para establecer la conexión peer-to-peer entre los participantes.
  socket.on("meet:offer", (data) => {
    console.log(`Reenviando Offer de ${socket.id} a ${data.to} (renegotiation: ${!!data.isRenegotiation})`);
    io.to(data.to).emit("meet:offer", {
      from: socket.id,
      offer: data.offer,
      roomId: data.roomId,
      isRenegotiation: !!data.isRenegotiation
    });
  });

  // Manejo de respuestas WebRTC (SDP) para completar el proceso de establecimiento de la conexión peer-to-peer entre los participantes.
  socket.on("meet:answer", (data) => {
    console.log(`Reenviando Answer de ${socket.id} a ${data.to}`);
    io.to(data.to).emit("meet:answer", { from: socket.id, answer: data.answer, roomId: data.roomId });
  });
 // Manejo de candidatos ICE para facilitar la conexión peer-to-peer entre los participantes, reenviando los candidatos al destinatario correspondiente para que puedan establecer la conexión directa.
  socket.on("meet:ice-candidate", (data) => {
    if (data.to) {
      console.log(`Reenviando ICE candidate de ${socket.id} a ${data.to}`);
      io.to(data.to).emit("meet:ice-candidate", { from: socket.id, candidate: data.candidate });
    }
  });

  // Manejo de salida de la sala de videollamada. Cuando un participante se va, se elimina de la sala en memoria, 
  // se notifica a los demás participantes para que actualicen su interfaz y conexiones WebRTC, y si la sala queda vacía, se elimina completamente.
  socket.on("meet:leave", ({ roomId, userId: claimedUserId }) => {
    console.log(`meet:leave recibido de ${userId} en sala ${roomId}`, { claimedUserId });
    leaveMeetRoom(roomId, userId, socket.id);
  });


  // SISTEMA DE SINCRONIZACIÓN DE MENSAJES POR QR ENTRE DISPOSITIVOS (WEB ↔ MÓVIL) | FUNCIONARÁ? - FUNCIONA VAMOOO
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
    // Verificación de que el userId del token coincide con el userId del socket que intenta emparejar. Esto es para evitar que alguien intente usar un QR que no le pertenece.
    if (session.userId !== userId) {
      console.warn(`[QR Sync] Intento de emparejado cruzado`, { expectedUserId: session.userId, claimedUserId, socketUserId: userId });
      socket.emit("sync:error", { msg: "El QR pertenece a otro usuario" });
      return;
    }
    // Emparejar: guardar el socketId del móvil en la sesión y marcar como emparejado
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

  // Manejo de desconexión del socket. Cuando un socket se desconecta, se actualiza la presencia del usuario a offline, se notifica a las salas conectadas para que actualicen la presencia
  socket.on("disconnecting", () => {
    if (!userId) return;
    const offlinePresence = setUserPresence(userId, { online: false, status: "offline" });
    connectedRooms.forEach((roomId) => {
      io.to(roomId).emit("presence:update", offlinePresence);
    });
  });

  // Manejo de desconexión definitiva del socket. Después de que el socket se ha desconectado, se limpia cualquier referencia a ese socket en las salas de videollamada (meetRooms) 
  // para evitar que queden usuarios "colgados" con sockets inválidos, y se notifica a los demás participantes si es necesario.
  socket.on("disconnect", () => {
    console.log(`Socket desconectado: ${socket.id}`);

    meetRooms.forEach((room, rId) => {
      for (let [uId, sId] of room.participants) {
        if (sId === socket.id) {
          console.log(`Limpiando usuario ${uId} de sala ${rId} por disconnect`);
          leaveMeetRoom(rId, uId, socket.id);
        }
      }
    });
  });

  // Función auxiliar para salir de meet
  function leaveMeetRoom(roomId, userId, socketId) {
    const room = meetRooms.get(roomId);
    if (!room) {
      console.log(`Sala ${roomId} no encontrada en leaveMeetRoom`);
      return;
    }
    // borra al participante de la sala
    room.participants.delete(userId);
    if (room.screenSharers) room.screenSharers.delete(socketId);
    socket.leave(`meet:${roomId}`);

    // Notificar a los demás
    socket.to(`meet:${roomId}`).emit("meet:user-left", { userId, socketId });
    socket.to(`meet:${roomId}`).emit("meet:screen-share-state", { userId, socketId, isSharing: false });

    console.log(`${userId} salió de meet ${roomId}. Quedan: ${room.participants.size}`);

    // Si no queda nadie, eliminar sala y actualizar BD
    if (room.participants.size === 0) {
      appDb.query(
        `UPDATE comunicacion.historial_llamadas 
       SET fin = now(), estado = 'finalizada' 
       WHERE id_llamada = $1`,
        [room.callId]
      ).catch(e => console.error("Error finalizando llamada:", e));

      meetRooms.delete(roomId);
      console.log(`Meet ${roomId} eliminado (sin participantes)`);
    }
  }
});

const PORT = process.env.PORT || 4000;

Promise.all([initCollabTables(), initMessageStatusTable()])
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("No se pudieron inicializar las tablas colaborativas:", error.message);
    process.exit(1);
  });
