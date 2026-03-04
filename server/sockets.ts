import { Server, Socket } from "socket.io";
import { getRedis } from "./redis"; 

const redis = getRedis();

export const socketLogic = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`📡 Usuario conectado: ${userId}`);
    }

    // EVENTO: Unirse a una sala y cargar mensajes pendientes
    socket.on("join_room", async (roomId: string) => {
      socket.join(roomId);
      console.log(`📥 Usuario ${userId} se unió a sala: ${roomId}`);

      // Enviar mensajes pendientes de Redis al usuario que se une
      if (userId && redis && redis.status === 'ready') {
        try {
          const key = `pendientes:usuario:${userId}`;
          const pendingMessages = await redis.lrange(key, 0, -1);
          
          if (pendingMessages.length > 0) {
            console.log(`📨 Enviando ${pendingMessages.length} mensajes pendientes a ${userId}`);
            
            // Filtrar solo los mensajes de esta sala
            const roomMessages = pendingMessages
            .map((msg: string) => JSON.parse(msg)) // Definimos msg como string
            .filter((msg: any) => msg.roomId === roomId); // El objeto parseado es any

            // Enviar mensajes al cliente
            for (const msg of roomMessages) {
              socket.emit("chat:receive", msg);
            }

            // Opcional: Limpiar mensajes pendientes de esta sala
            // await redis.del(key);
          }
        } catch (error) {
          console.error("❌ Error cargando mensajes pendientes:", error);
        }
      }
    });

    // EVENTO: Enviar mensaje de texto
    socket.on("chat:send", async (data) => {
      handleMessage(io, data, 'text');
    });

    // EVENTO: Enviar media (imagen/archivo)
    socket.on("chat:send_media", async (data) => {
      handleMessage(io, data, 'image');
    });

    // EVENTO: Confirmar lectura de mensaje
    socket.on("chat:read_receipt", ({ msg_id, roomId }) => {
      io.to(roomId).emit("chat:update_read_status", { msg_id });
    });

    // EVENTO: Actualizar configuración de sala
    socket.on("chat:update_settings", (settings) => {
      const { roomId, soloProfesores, delegados } = settings;
      io.to(roomId).emit("chat:settings_changed", { soloProfesores, delegados });
    });

    // EVENTO: Usuario escribiendo
    socket.on("chat:typing", ({ roomId, userName }) => {
      socket.to(roomId).emit("chat:user_typing", { userName });
    });

    // EVENTO: Usuario dejó de escribir
    socket.on("chat:stop_typing", ({ roomId }) => {
      socket.to(roomId).emit("chat:user_stopped_typing");
    });

    socket.on("disconnect", () => {
      console.log(`❌ Usuario desconectado: ${userId}`);
    });
  });
};

// Función auxiliar para manejar mensajes
async function handleMessage(io: any, data: any, type: string) {
  const { roomId, senderId, text, msg_id, recipients, senderName, image } = data;
  
  const message = { 
    ...data,
    type,
    timestamp: Date.now(),
    read: false 
  };

  // Emitir mensaje a todos en la sala
  io.to(roomId).emit("chat:receive", message);
  console.log(`💬 Mensaje enviado a sala ${roomId} por ${senderName || senderId}`);

  // Guardar en Redis para usuarios offline
  if (recipients && Array.isArray(recipients)) {
    try {
      const redis = getRedis();
      if (redis && redis.status === 'ready') {
        for (const targetId of recipients) {
          if (targetId !== senderId) {
            const key = `pendientes:usuario:${targetId}`;
            await redis.lpush(key, JSON.stringify(message));
            await redis.expire(key, 604800); // 7 días
            console.log(`💾 Mensaje guardado en Redis para usuario ${targetId}`);
          }
        }
      }
    } catch (error) {
      console.error("⚠️ Error guardando en Redis:", error);
    }
  }
}