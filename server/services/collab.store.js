const userPresence = new Map();

// Función para actualizar la presencia de un usuario
export const setUserPresence = (userId, next = {}) => {
  const current = userPresence.get(String(userId)) || {
    status: "available",
    online: false,
    lastSeen: Date.now(),
  };

  const merged = {
    ...current,
    ...next,
    userId: String(userId),
    lastSeen: next.online === false ? Date.now() : current.lastSeen,
    updatedAt: Date.now(),
  };

  if (next.online === true) {
    merged.lastSeen = current.lastSeen || Date.now();
  }

  userPresence.set(String(userId), merged);
  return merged;
};

// Función para obtener la presencia de un usuario
export const getUserPresence = (userId) => {
  return userPresence.get(String(userId)) || {
    userId: String(userId),
    status: "offline",
    online: false,
    lastSeen: Date.now(),
    updatedAt: Date.now(),
  };
};

// Función para obtener la presencia de múltiples usuarios
export const getPresenceSnapshot = (userIds = []) => {
  return userIds.map((userId) => getUserPresence(userId));
};
