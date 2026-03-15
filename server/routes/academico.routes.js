import { Router } from "express";
import { getChatsDisponibles, forzarSync, getMiembrosClase } from "../academico/academico.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { appDb } from "../db/db.js";

const router = Router();

router.use(requireAuth);

router.get("/chats-disponibles", getChatsDisponibles);
router.post("/sync-forzar", forzarSync);
router.get("/miembros/:id", getMiembrosClase);

// ✅ Endpoint para chats privados
router.get("/chats-privados", async (req, res) => {
  try {
    const { id_usuario_app, tipo_externo } = req.currentUser;
    
    let query;
    if (tipo_externo === 'PROFESOR') {
      query = `
        SELECT 
          cp.id_chat_privado,
          u.nombre as nombre_contacto,
          u.id_usuario_app as id_contacto,
          false as es_profesor_contacto
        FROM comunicacion.chats_privados cp
        JOIN seguridad.usuarios_app u ON u.id_usuario_app = cp.id_alumno_usuario_app
        WHERE cp.id_profesor_usuario_app = $1
        ORDER BY u.nombre ASC
      `;
    } else {
      query = `
        SELECT 
          cp.id_chat_privado,
          u.nombre as nombre_contacto,
          u.id_usuario_app as id_contacto,
          true as es_profesor_contacto
        FROM comunicacion.chats_privados cp
        JOIN seguridad.usuarios_app u ON u.id_usuario_app = cp.id_profesor_usuario_app
        WHERE cp.id_alumno_usuario_app = $1
        ORDER BY u.nombre ASC
      `;
    }
    
    const { rows } = await appDb.query(query, [id_usuario_app]);

    console.log("[ChatsPrivados][Listado]", {
      id_usuario_app,
      tipo_externo,
      rows,
    });
    
    res.json({ ok: true, chats: rows });
  } catch (e) {
    console.error("Error en chats-privados:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Endpoint para miembros con detalles + config (roomId = id_sala)
router.get("/miembros-detalle/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params; // Ahora es id_sala
    
    // 1. Obtener id_asignatura, id_clase y nombre_clase desde la sala
    const { rows: salaInfo } = await appDb.query(`
      SELECT sc.id_sala, sc.id_clase, sc.configuracion, oa.id_asignatura, cl.nombre as nombre_clase
      FROM comunicacion.salas_chat sc
      JOIN cache_academico.oferta_asignaturas oa ON oa.id_oferta = sc.id_oferta
      JOIN cache_academico.clases cl ON cl.id_clase = sc.id_clase
      WHERE sc.id_sala = $1
    `, [roomId]);
    
    if (salaInfo.length === 0) {
      return res.status(404).json({ ok: false, msg: "Sala no encontrada" });
    }
    
    const { id_asignatura, nombre_clase, configuracion } = salaInfo[0];
    
    // 2. Obtener usuarios de las vistas (filtrando por asignatura Y clase)
    const { rows: usuarios } = await appDb.query(`
      SELECT DISTINCT
        u.id_usuario_app as id,
        u.nombre,
        u.email,
        CASE WHEN u.tipo_externo = 'PROFESOR' THEN true ELSE false END as es_profesor
      FROM seguridad.usuarios_app u
      WHERE u.id_usuario_app IN (
        SELECT va.id_usuario_app 
        FROM cache_academico.v_asignaturas_visibles_chat_alumno va
        WHERE va.id_asignatura = $1 AND va.nombre_clase = $2
        UNION
        SELECT vp.id_usuario_app 
        FROM cache_academico.v_asignaturas_visibles_chat_profesor vp
        WHERE vp.id_asignatura = $1 AND vp.nombre_clase = $2
      )
      ORDER BY es_profesor DESC, u.nombre ASC
    `, [id_asignatura, nombre_clase]);
    
    const config = configuracion || {};
    
    res.json({ 
      ok: true, 
      usuarios,
      config: {
        soloProfesores: config.soloProfesores || false,
        delegados: config.delegados || []
      }
    });
    
  } catch (e) {
    console.error("Error en miembros-detalle:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
