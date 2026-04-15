export type MentionableMember = {
  id: string;
  nombre: string;
  es_profesor?: boolean;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

    // Función para construir el payload de menciones a partir del texto del mensaje, la lista de miembros de la sala y el ID del usuario actual.
export const buildMentionsPayload = (
  text: string,
  members: MentionableMember[],
  currentUserId: string
) => {
  const lowered = normalize(text);
  const tokens: string[] = [];
  const targetUserIds = new Set<string>();

  if (lowered.includes('@todos')) {
    tokens.push('todos');
    members.forEach((member) => {
      if (member.id !== currentUserId) targetUserIds.add(member.id);
    });
  }

  if (lowered.includes('@delegados')) {
    tokens.push('delegados');
  }

  if (lowered.includes('@profesor') || lowered.includes('@profesores')) {
    tokens.push('profesor');
    members.forEach((member) => {
      if (member.es_profesor && member.id !== currentUserId) {
        targetUserIds.add(member.id);
      }
    });
  }

  members.forEach((member) => {
    const firstName = member.nombre?.split(' ')[0];
    const fullNameTag = `@${normalize(member.nombre).replace(/\s+/g, '')}`;
    const firstNameTag = firstName ? `@${normalize(firstName)}` : '';
    if (
      member.id !== currentUserId &&
      (lowered.includes(fullNameTag) || (firstNameTag && lowered.includes(firstNameTag)))
    ) {
      targetUserIds.add(member.id);
    }
  });

  return {
    tokens,
    targetUserIds: Array.from(targetUserIds),
    hasMentions: tokens.length > 0 || targetUserIds.size > 0,
  };
};

// Función para verificar si un mensaje menciona al usuario actual, ya sea a través de menciones directas por ID o por nombre de usuario.
export const messageMentionsCurrentUser = (
  message: any,
  currentUserId: string,
  currentUserName: string
) => {
  const direct = Array.isArray(message?.mentions?.targetUserIds)
    && message.mentions.targetUserIds.includes(currentUserId);

  if (direct) return true;

  const rawText = String(message?.text || message?.contenido || '');
  const normalizedName = normalize(currentUserName || '').split(' ')[0];
  return normalizedName ? normalize(rawText).includes(`@${normalizedName}`) : false;
};
