import { loginConCredenciales } from "./auth.service.js";
import { appDb, gobDb } from "../db/db.js";
import crypto from "crypto";

const sha256 = (input) => crypto.createHash("sha256").update(input).digest("hex");

// Login con DNI/CIAL y contraseña
export const login = async (req, res) => {
  try {
    const { identificador, password } = req.body;

    if (!identificador || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: "MISSING_FIELDS",
        msg: "DNI/CIAL y contraseña son obligatorios" 
      });
    }

    console.log(`[Auth] Intento de login para: ${identificador}`);

    const result = await loginConCredenciales({ identificador, password });

    console.log(`[Auth] Login y Sincronización exitosa: ${result.usuario.nombre}`);

    return res.json({
      ok: true,
      token: result.token,
      usuario: result.usuario
    });

  } catch (err) {
    console.error("[Login Error]:", err);

    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ 
        ok: false, 
        error: "INVALID_CREDENTIALS",
        msg: "Usuario o contraseña incorrectos" 
      });
    }

    if (err.message.includes("getaddrinfo") || err.message.includes("connection") || err.message.includes("ECONNREFUSED")) {
      return res.status(503).json({
        ok: false,
        error: "DB_CONNECTION_ERROR",
        msg: "Error de conexión con los servicios de base de datos."
      });
    }

    if (err.code && err.code.startsWith('23')) {
      return res.status(500).json({
        ok: false,
        error: "DB_INTEGRITY_ERROR",
        msg: "Error al sincronizar los datos locales."
      });
    }

    return res.status(500).json({ 
      ok: false, 
      error: "SERVER_ERROR", 
      msg: "Ocurrió un error inesperado en el servidor." 
    });
  }
};

// Endpoint para verificar el estado de autenticación
export const checkStatus = async (req, res) => {
  return res.json({
    ok: true,
    usuario: req.currentUser
  });
};

// Registrar o actualizar token de push para el usuario autenticado
export const registrarPushToken = async (req, res) => {
  try {
    const { token, plataforma } = req.body;
    const { id_usuario_app } = req.currentUser;

    if (!token) {
      return res.status(400).json({ ok: false, msg: "Token requerido" });
    }

    const normalizedToken = String(token).trim();
    const normalizedPlatform = plataforma || 'unknown';

    if (!normalizedToken) {
      return res.status(400).json({ ok: false, msg: "Token invalido" });
    }

    await appDb.query(
      `DELETE FROM seguridad.tokens_push
       WHERE id_usuario_app = $1
         AND plataforma = $2
         AND token <> $3`,
      [id_usuario_app, normalizedPlatform, normalizedToken]
    );

    const updateByToken = await appDb.query(
      `UPDATE seguridad.tokens_push
       SET id_usuario_app = $1,
           plataforma = $2
       WHERE token = $3`,
      [id_usuario_app, normalizedPlatform, normalizedToken]
    );

    if (updateByToken.rowCount === 0) {
      const existingForUser = await appDb.query(
        `SELECT token
         FROM seguridad.tokens_push
         WHERE id_usuario_app = $1 AND plataforma = $2
         LIMIT 1`,
        [id_usuario_app, normalizedPlatform]
      );

      if (existingForUser.rows.length > 0) {
        await appDb.query(
          `UPDATE seguridad.tokens_push
           SET token = $1
           WHERE id_usuario_app = $2 AND plataforma = $3`,
          [normalizedToken, id_usuario_app, normalizedPlatform]
        );
      } else {
        await appDb.query(
          `INSERT INTO seguridad.tokens_push (id_usuario_app, token, plataforma)
           VALUES ($1, $2, $3)`,
          [id_usuario_app, normalizedToken, normalizedPlatform]
        );
      }
    }

    console.log(`[PushToken] Registrado token para usuario ${id_usuario_app} en ${normalizedPlatform}`);

    return res.json({ ok: true, msg: "Token registrado correctamente" });

  } catch (error) {
    console.error("[Push Token Error]:", error);
    return res.status(500).json({ ok: false, msg: "Error al guardar token" });
  }
};

// Cambiar contraseña para el usuario autenticado
export const cambiarPassword = async (req, res) => {
  try {
    const { password_actual, password_nueva } = req.body;
    const { dni } = req.currentUser;

    if (!password_actual || !password_nueva) {
      return res.status(400).json({ ok: false, msg: "Contraseña actual y nueva son obligatorias" });
    }
    if (password_nueva.length < 4) {
      return res.status(400).json({ ok: false, msg: "La nueva contraseña debe tener al menos 4 caracteres" });
    }

    // Buscar credenciales del usuario
    const { rows: personas } = await gobDb.query(
      `SELECT ug.id_usuario_externo, cred.salt, cred.password_sha256_hex
       FROM externo.personas p
       JOIN externo.usuarios_gobierno ug ON ug.id_persona = p.id_persona
       JOIN externo.credenciales_acceso cred ON cred.id_usuario_externo = ug.id_usuario_externo
       WHERE TRIM(UPPER(p.dni)) = TRIM(UPPER($1)) AND ug.activo = true`,
      [dni]
    );

    if (!personas.length) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }

    const ext = personas[0];
    const saltDB = ext.salt?.trim() || "";
    const hashDB = ext.password_sha256_hex?.trim() || "";
    const hashActual = sha256(saltDB + password_actual);

    if (hashActual !== hashDB) {
      return res.status(401).json({ ok: false, msg: "La contraseña actual es incorrecta" });
    }

    // Generar nuevo salt y hash
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = sha256(newSalt + password_nueva);

    await gobDb.query(
      `UPDATE externo.credenciales_acceso SET salt = $1, password_sha256_hex = $2 WHERE id_usuario_externo = $3`,
      [newSalt, newHash, ext.id_usuario_externo]
    );

    console.log(`[Auth] Contraseña cambiada para usuario ${dni}`);
    return res.json({ ok: true, msg: "Contraseña actualizada correctamente" });

  } catch (error) {
    console.error("[Cambiar Password Error]:", error);
    return res.status(500).json({ ok: false, msg: "Error al cambiar la contraseña" });
  }
};
