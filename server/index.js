import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from 'dotenv';
import crypto from 'crypto';

import authRoutes from "./routes/auth.routes.js";
import academicoRoutes from "./routes/academico.routes.js";
import mensajesRoutes from "./routes/mensajes.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import adminRoutes from "./routes/admin.routes.js";       // ✅ AÑADIDO

import { appDb } from "../server/db/db.js";
import { getRedis } from "./redis.js";
import { enviarNotificacionPush } from "./services/push.service.js";

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

app.set('io', io);

let ajustesSalas = {};

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
        delegados: config.delegados || []
      };
    }

    return ajustesSalas[roomId] || { soloProfesores: false, delegados: [] };
  } catch (e) {
    console.error("Error cargando ajustes:", e);
    return { soloProfesores: false, delegados: [] };
  }
}


// ESTRUCTURA DE SALAS DE VIDEOLLAMADA (Tipo Google Meet)
// Clave: roomId (id del chat/sala)
// Valor: { participants: Map(userId -> socketId), callId: uuid, type: 'audio'|'video' }
const meetRooms = new Map();

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    // Sala Personal: Para recibir todo aunque esté en el Home
    socket.join(`user:${userId}`);
    console.log(`🚀 Usuario conectado: ${userId}`);

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
          // console.log(`📡 Escuchando sala: ${row.sala_id}`);
        });

        console.log(`✅ Sincronizadas ${salas.length} salas para ${userId}`);
      }
    } catch (e) {
      console.error("❌ Error Auto-Join:", e.message);
    }

    // VACIAR REDIS: Recuperar lo enviado mientras estaba offline
    try {
      const redis = getRedis();
      if (redis && redis.status === 'ready') {
        const key = `pendientes:usuario:${userId}`;
        const pendingMessages = await redis.lrange(key, 0, -1);

        if (pendingMessages.length > 0) {
          console.log(`📦 Entregando ${pendingMessages.length} mensajes offline`);
          pendingMessages.forEach(msgStr => {
            try {
              const obj = JSON.parse(msgStr);
              if (obj.type === 'reaction') {
                socket.emit("chat:reaction", obj);
              } else {
                socket.emit("chat:receive", obj);
              }
            } catch { }
          });
          await redis.del(key);
        }
      }
    } catch (e) {
      console.error("⚠️ Redis no disponible (no crítico):", e.message);
    }
  }

  // --- EVENTOS DE CHAT ---

  socket.on("join_room", async (roomId) => {
    socket.join(roomId);
    console.log(`👤 Unión manual: ${socket.id} -> ${roomId}`);
      const redis = getRedis();
    if (userId && redis?.status === 'ready') {
        const key = `pendientes:usuario:${userId}`;
        const pendingMessages = await redis.lrange(key, 0, -1);
        const roomMessages = pendingMessages
            .map(msg => JSON.parse(msg))
            .filter(msg => msg.roomId === roomId);

        for (const msg of roomMessages) {
            socket.emit("chat:receive", msg);
        }
    }

    await cargarAjustesSala(roomId);
  });

  socket.on("chat:send", async (payload) => {
    const { roomId, senderId, recipients, esProfesor, contenido, nombreEmisor, imageUri } = payload;

    if (!ajustesSalas[roomId]) {
      await cargarAjustesSala(roomId);
    }
    // Check de permisos (ajustesSalas debe estar definido arriba en tu index.js)
    const settings = ajustesSalas[roomId] || { soloProfesores: false, delegados: [] };
    const puedeHablar = !settings.soloProfesores || esProfesor || settings.delegados?.includes(senderId);

    if (!puedeHablar) {
      return socket.emit("error_permisos", { msg: "Chat restringido" });
    }

    const message = {
      ...payload,
      contenido: contenido || payload.text, // Aseguramos que tenga algo
      timestamp: Date.now(),
      read: false
    };

    // A. Envío a la sala (Para los que están dentro del chat abierto)
    io.to(roomId).emit("chat:receive", message);

    // B. Envío Global y Redis (Para los que están fuera o offline)
    if (recipients && Array.isArray(recipients)) {
      try {
        const redis = getRedis();
        for (const uId of recipients) {
          if (uId !== senderId) {
            // 1. Entrega inmediata a su canal personal (Home)
            io.to(`user:${uId}`).emit("chat:receive", message);

            // 2. Guardar en Redis como backup (Buzón)
            if (redis?.status === 'ready') {
              const key = `pendientes:usuario:${uId}`;
              await redis.rpush(key, JSON.stringify(message));
              await redis.expire(key, 604800); // 7 días
            }

            // 3. Notificación Push
            const textoNotif = `${nombreEmisor || 'Usuario'}: ${contenido || 'Nuevo mensaje'}`;
            enviarNotificacionPush(uId, textoNotif, roomId);
          }
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

    ajustesSalas[roomId] = { soloProfesores, delegados };

    try {
      await appDb.query(
        `UPDATE comunicacion.salas_chat SET configuracion = $1 WHERE id_sala = $2`,
        [JSON.stringify({ soloProfesores, delegados }), roomId]
      );
    } catch (e) {
      console.error("Error guardando ajustes:", e);
    }

    io.to(roomId).emit("chat:settings_changed", { soloProfesores, delegados });
  });

  socket.on("chat:send_media", async (payload) => {
    // 1. Extraemos los datos (payload trae el campo 'image' con el base64)
    const { roomId, senderId, recipients, image, nombreEmisor } = payload;

    const message = {
      ...payload,
      timestamp: Date.now(),
      read: false
    };

    // 2. IMPORTANTE: Reenviar a la sala
    // Esto hace que el Usuario 2 reciba el objeto con el campo 'image'
    io.to(roomId).emit("chat:receive", message);

    // 3. Notificaciones (Para que no se bugee)
    if (recipients) {
      recipients.forEach(uId => {
        if (uId !== senderId) {
          io.to(`user:${uId}`).emit("chat:receive", message);
          // Enviamos texto fijo porque 'contenido' viene vacío en fotos
          enviarNotificacionPush(uId, `${nombreEmisor}: 📷 Envió una imagen`, roomId);
        }
      });
    }
  });

  socket.on("chat:reaction", async (payload) => {
    const { roomId, msgId, reaction, recipients, senderId } = payload;

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
              const key = `pendientes:usuario:${uId}`;
              await redis.rpush(key, JSON.stringify(reactionObj));
              await redis.expire(key, 604800);
            }
          }
        }
      } catch (e) {
        console.error("❌ Error distributing reaction:", e);
      }
    }
  });

  socket.on("chat:read_receipt", ({ msg_id, roomId }) => {
    // Reenviar a la sala para que el emisor vea el doble tick azul
    io.to(roomId).emit("chat:update_read_status", { msg_id });
  });

  // ==================================
  // PIN MESSAGE HANDLERS
  // ==================================
  socket.on("chat:pin_message", async (payload) => {
    const { roomId, messageId, duration, category, color, durationLabel } = payload;
    console.log(`📌 Pin message request:`, payload);

    // Buscar el mensaje para obtener su contenido
    // (En una implementación completa, esto vendría de la DB)
    const pinData = {
      messageId,
      duration,
      durationLabel,
      category,
      color,
      senderName: payload.senderName || 'Profesor',
      text: payload.text || payload.contenido || 'Mensaje fijado',
      pinnedAt: Date.now(),
      expiresAt: Date.now() + duration,
    };

    // Broadcast to all users in the room
    io.to(roomId).emit("chat:receive_pin", pinData);
    console.log(`📌 Pin broadcast to room ${roomId}`);
  });

  socket.on("chat:unpin_message", async (payload) => {
    const { roomId, messageId } = payload;
    console.log(`📌 Unpin message request:`, payload);

    // Broadcast to all users in the room
    io.to(roomId).emit("chat:receive_unpin", { messageId });
    console.log(`📌 Unpin broadcast to room ${roomId}`);
  });

  // ==================================
  // SISTEMA DE VIDEOLLAMADAS TIPO MEET
  // ==================================

  // Unirse a una sala de videollamada
  socket.on("meet:join", ({ roomId, userId, type }) => {
    // LOG DETALLADO PARA DEBUGGING
    console.log(`📞 MEET:JOIN recibido:`, {
      roomId,
      userId,
      type,
      roomIdType: typeof roomId,
      userIdType: typeof userId,
      socketId: socket.id,
      isRoomIdValid: roomId && roomId !== 'null' && roomId !== 'undefined',
      isUserIdValid: userId && userId !== 'null' && userId !== 'undefined'
    });

    // VALIDACIÓN DE DATOS
    if (!roomId || roomId === 'null' || roomId === 'undefined' || roomId.trim() === '') {
      console.error("❌ roomId inválido en meet:join");
      socket.emit("meet:error", { msg: "ID de sala inválido" });
      return;
    }

    if (!userId || userId === 'null' || userId === 'undefined' || userId.trim() === '') {
      console.error("❌ userId inválido en meet:join");
      socket.emit("meet:error", { msg: "ID de usuario inválido" });
      return;
    }

    if (!meetRooms.has(roomId)) {
      meetRooms.set(roomId, { participants: new Map(), callId: crypto.randomUUID(), type });
      console.log(`✨ Creada sala de Meet en memoria: ${roomId}`);
    }

    const room = meetRooms.get(roomId);

    // Evitar duplicados
    if (room.participants.has(userId)) {
      console.log(`⚠️ Usuario ${userId} ya está en la sala, actualizando socketId`);
      room.participants.set(userId, socket.id);
    } else {
      room.participants.set(userId, socket.id);
      console.log(`➕ Usuario ${userId} añadido a la sala ${roomId}`);
    }

    socket.join(`meet:${roomId}`);
    console.log(`🚪 Socket ${socket.id} unido a meet:${roomId}`);

    const others = Array.from(room.participants.entries())
      .filter(([uid]) => uid !== userId)
      .map(([uid, sid]) => ({ userId: uid, socketId: sid }));

    console.log(`👥 Enviando lista de ${others.length} participantes existentes a ${userId}`);
    socket.emit("meet:participants", { participants: others, callId: room.callId });

    console.log(`📢 Notificando a ${others.length} usuarios sobre nuevo participante ${userId}`);
    socket.to(`meet:${roomId}`).emit("meet:user-joined", { userId, socketId: socket.id });
  });

  socket.on("meet:offer", (data) => {
    console.log(`📤 Reenviando Offer de ${socket.id} a ${data.to}`);
    io.to(data.to).emit("meet:offer", { from: socket.id, offer: data.offer, roomId: data.roomId });
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

  socket.on("meet:leave", ({ roomId, userId }) => {
    console.log(`👋 meet:leave recibido de ${userId} en sala ${roomId}`);
    leaveMeetRoom(roomId, userId, socket.id);
  });

  // ==================================
  // QR SYNC - Sincronizar mensajes móvil → web
  // ==================================
  // Mapa global de tokens QR activos: token → { webSocketId, userId, createdAt }
  const qrSyncSessions = io._qrSyncSessions || (io._qrSyncSessions = new Map());

  // 1. Web solicita un token QR para mostrar
  socket.on("sync:request_qr", ({ userId }) => {
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
  socket.on("sync:pair", ({ token, userId }) => {
    const session = qrSyncSessions.get(token);
    if (!session) {
      socket.emit("sync:error", { msg: "Código QR expirado o inválido" });
      return;
    }
    if (session.userId !== userId) {
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
    socket.leave(`meet:${roomId}`);

    // Notificar a los demás
    socket.to(`meet:${roomId}`).emit("meet:user-left", { userId, socketId });

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
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});