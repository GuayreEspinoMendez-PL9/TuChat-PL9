import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView, TextInput, Linking
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchRoomPresence } from '../../services/chatExtras.service';
import { getFilesByRoom } from '../../db/database';
import { getFileCategory, isImportantMessage, normalizeMessage } from '../../db/messageModel';

const API_URL = "https://tuchat-pl9.onrender.com";

const getStorageItem = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
};

// Iconos
const UserIcon = ({ color }: { color: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </Svg>
);

const ShieldIcon = ({ color }: { color: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
  </Svg>
);

const CheckIcon = ({ color }: { color: string }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: 14, height: 14 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </Svg>
);

interface ChatInfoScreenProps {
  roomId: string;
  nombre: string;
  esProfesor?: boolean; // Ahora es opcional porque lo validaremos dentro
  onOpenMessage?: (message: any) => void;
}

type PermissionMode = 'todos' | 'solo_profesor' | 'profesor_delegados';

export const ChatInfoScreen = ({ roomId, nombre, esProfesor: esProfesorProp, onOpenMessage }: ChatInfoScreenProps) => {
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('todos');
  const [delegados, setDelegados] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [presenceByUser, setPresenceByUser] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'participants' | 'files'>('participants');
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [fileQuery, setFileQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | 'image' | 'video' | 'file' | 'link' | 'important' | 'requiresAck'>('all');
  
  // ✅ NUEVO ESTADO: Para asegurar que el rol es correcto
  const [esProfesorInterno, setEsProfesorInterno] = useState(false);

  const { socket } = useSocket();
  const { colors } = useTheme();

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        // 1. Validar ROL internamente para no depender del padre
        const userStr = await getStorageItem('usuario');
        if (userStr) {
          const user = JSON.parse(userStr);
          // Según tu tabla: Rol 2 = PROFESOR
          const soyProfe = user.esProfesor === true || user.tipo === 'PROFESOR' || user.id_rol === 2;
          setEsProfesorInterno(soyProfe);
        }

        // 2. Cargar participantes
        const token = await getStorageItem('token');
        const res = await axios.get(`${API_URL}/academico/miembros-detalle/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data.ok) {
          setParticipantes(res.data.usuarios || []);
          const config = res.data.config;
          if (config) {
            if (config.soloProfesores && config.delegados?.length > 0) {
              setPermissionMode('profesor_delegados');
            } else if (config.soloProfesores) {
              setPermissionMode('solo_profesor');
            } else {
              setPermissionMode('todos');
            }
            setDelegados(config.delegados || []);
          }
        }

        try {
          const presence = await fetchRoomPresence(roomId);
          setPresenceByUser(Object.fromEntries((presence || []).map((entry: any) => [String(entry.userId), entry])));
        } catch (e) {
          console.log("No se pudo cargar presencia:", e);
        }

        setSharedFiles(typeof getFilesByRoom === 'function' ? getFilesByRoom(roomId).map(normalizeMessage) : []);
      } catch (e) {
        console.error("Error en ChatInfoScreen:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDatos();
  }, [roomId]);

  const updatePermissions = (mode: PermissionMode, newDelegados?: string[]) => {
    if (!roomId) return;
    setSaving(true);
    const delegadosList = newDelegados !== undefined ? newDelegados : delegados;

    const settings = {
      roomId: roomId,
      soloProfesores: mode !== 'todos',
      delegados: mode === 'profesor_delegados' ? delegadosList : [],
      esProfesor: true
    };

    if (socket) {
      socket.emit("chat:update_settings", settings);
    }

    setPermissionMode(mode);
    if (newDelegados !== undefined) setDelegados(newDelegados);
    setTimeout(() => setSaving(false), 500);
  };

  const toggleDelegado = (userId: string) => {
    const newDelegados = delegados.includes(userId)
      ? delegados.filter(id => id !== userId)
      : [...delegados, userId];
    setDelegados(newDelegados);
    if (permissionMode === 'profesor_delegados') {
      updatePermissions('profesor_delegados', newDelegados);
    }
  };

  const profesores = participantes.filter(p => p.es_profesor);
  const alumnos = participantes.filter(p => !p.es_profesor);
  const filteredFiles = sharedFiles.filter((message) => {
    const normalized = normalizeMessage(message);
    const query = fileQuery.trim().toLowerCase();
    const matchesQuery = !query || [
      normalized.fileName,
      normalized.text,
      normalized.senderName,
      normalized.threadTopic,
      normalized.messageType,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);

    if (!matchesQuery) return false;
    if (fileFilter === 'all') return true;
    if (fileFilter === 'important') return isImportantMessage(normalized);
    if (fileFilter === 'requiresAck') return Boolean(normalized.requiresAck);
    return getFileCategory(normalized) === fileFilter;
  });

  const handleOpenFileMessage = (message: any) => {
    if (onOpenMessage) {
      onOpenMessage(message);
      return;
    }

    router.push({
      pathname: '/chat',
      params: {
        id: roomId,
        nombre,
        targetMsgId: message.msg_id,
      }
    });
  };

  const handleOpenFileAsset = async (message: any) => {
    const url = message.image || (typeof message.text === 'string' && /^https?:\/\//i.test(message.text) ? message.text : null);
    if (!url) {
      handleOpenFileMessage(message);
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      handleOpenFileMessage(message);
    }
  };

  const getPresenceLabel = (userId: string) => {
    const current = presenceByUser[String(userId)];
    if (!current) return 'Desconectado';
    if (current.online) {
      if (current.status === 'in_class') return 'En clase';
      if (current.status === 'busy') return 'Ocupado';
      return 'Conectado';
    }
    return 'Desconectado';
  };

  // ✅ DEBUG REAL: Ahora comparamos la prop con lo que detectamos nosotros
  console.log("🔍 DEBUG ROL:", { 
    víaProp: esProfesorProp, 
    víaInterna: esProfesorInterno 
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const themedSection = { backgroundColor: colors.surface, borderColor: colors.border };

  // Componentes locales de UI...
  const RadioButton = ({ selected, onPress, label, description }: any) => (
    <TouchableOpacity
      style={[styles.radioOption, { backgroundColor: selected ? colors.primaryBg : colors.surface, borderColor: selected ? colors.primary : colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.radioCircle, { borderColor: selected ? colors.primary : colors.border }]}>
        {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
      </View>
      <View style={styles.radioContent}>
        <Text style={[styles.radioLabel, { color: selected ? colors.primary : colors.textPrimary }]}>{label}</Text>
        {description && <Text style={[styles.radioDescription, { color: colors.textSecondary }]}>{description}</Text>}
      </View>
    </TouchableOpacity>
  );

  const Checkbox = ({ checked, onPress, label, sublabel }: any) => (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' }]}>{checked && <CheckIcon color={colors.textOnPrimary} />}</View>
      <View style={styles.checkboxContent}>
        <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel && <Text style={[styles.checkboxSublabel, { color: colors.textMuted }]}>{sublabel}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.headerSection, themedSection]}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarLargeText}>{nombre.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.chatName, { color: colors.textPrimary }]}>{nombre}</Text>
        <Text style={[styles.chatSubtitle, { color: colors.textSecondary }]}>Grupo · {participantes.length} participantes</Text>
      </View>

      {/* ✅ SECCIÓN CORREGIDA: Usamos esProfesorInterno */}
      {esProfesorInterno && (
        <View style={[styles.section, themedSection]}>
          <View style={styles.sectionHeader}>
            <ShieldIcon color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Permisos del chat</Text>
            {saving && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
          </View>

          <View style={[styles.permissionsCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.permissionsLabel, { color: colors.textSecondary }]}>¿Quién puede enviar mensajes?</Text>
            <RadioButton
              selected={permissionMode === 'todos'}
              onPress={() => updatePermissions('todos')}
              label="Todos los participantes"
              description="Cualquier miembro puede escribir"
            />
            <RadioButton
              selected={permissionMode === 'solo_profesor'}
              onPress={() => updatePermissions('solo_profesor')}
              label="Solo profesores"
              description="Los alumnos solo pueden leer"
            />
            <RadioButton
              selected={permissionMode === 'profesor_delegados'}
              onPress={() => updatePermissions('profesor_delegados')}
              label="Profesores y delegados"
              description="Solo profesores y alumnos delegados pueden escribir"
            />

            {permissionMode === 'profesor_delegados' && alumnos.length > 0 && (
              <View style={styles.delegadosSection}>
                <Text style={[styles.delegadosTitle, { color: colors.textSecondary }]}>Seleccionar delegados:</Text>
                {alumnos.map((alumno) => (
                  <Checkbox
                    key={alumno.id}
                    checked={delegados.includes(alumno.id)}
                    onPress={() => toggleDelegado(alumno.id)}
                    label={alumno.nombre}
                    sublabel={alumno.email}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Lista de participantes */}
      <View style={[styles.section, themedSection]}>
        <View style={styles.sectionHeader}>
          <UserIcon color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{activeTab === 'participants' ? `Participantes (${participantes.length})` : `Archivos (${sharedFiles.length})`}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setActiveTab('participants')} style={[styles.radioOption, { flex: 1, marginBottom: 0, backgroundColor: activeTab === 'participants' ? colors.primaryBg : colors.background, borderColor: activeTab === 'participants' ? colors.primary : colors.border }]}>
            <Text style={{ color: activeTab === 'participants' ? colors.primary : colors.textPrimary, fontWeight: '700' }}>Participantes</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('files')} style={[styles.radioOption, { flex: 1, marginBottom: 0, backgroundColor: activeTab === 'files' ? colors.primaryBg : colors.background, borderColor: activeTab === 'files' ? colors.primary : colors.border }]}>
            <Text style={{ color: activeTab === 'files' ? colors.primary : colors.textPrimary, fontWeight: '700' }}>Archivos</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'participants' && profesores.length > 0 && (
          <View style={styles.participantGroup}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>Profesores</Text>
            {profesores.map((profesor) => (
              <View key={profesor.id} style={styles.participantItem}>
                <View style={[styles.participantAvatar, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.participantAvatarText, { color: colors.primary }]}>{profesor.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.participantInfo}>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]}>{profesor.nombre}</Text>
                  <Text style={[styles.participantRole, { color: colors.textSecondary }]}>Profesor • {getPresenceLabel(profesor.id)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'participants' && alumnos.length > 0 && (
          <View style={styles.participantGroup}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>Alumnos</Text>
            {alumnos.map((alumno) => (
              <View key={alumno.id} style={styles.participantItem}>
                <View style={[styles.participantAvatar, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.participantAvatarText, { color: colors.primary }]}>{alumno.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.participantInfo}>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]}>{alumno.nombre}</Text>
                  <View style={styles.participantMeta}>
                    <Text style={[styles.participantRole, { color: colors.textSecondary }]}>Alumno • {getPresenceLabel(alumno.id)}</Text>
                    {delegados.includes(alumno.id) && (
                      <View style={[styles.delegadoBadge, { backgroundColor: colors.primaryBg }]}>
                        <Text style={[styles.delegadoBadgeText, { color: colors.primary }]}>Delegado</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'files' && (
          <View>
            <TextInput
              value={fileQuery}
              onChangeText={setFileQuery}
              placeholder="Buscar por nombre, hilo o remitente"
              placeholderTextColor={colors.textMuted}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, color: colors.textPrimary, backgroundColor: colors.background }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {[
                ['all', 'Todos'],
                ['file', 'Docs'],
                ['image', 'Imagenes'],
                ['video', 'Videos'],
                ['link', 'Enlaces'],
                ['important', 'Importantes'],
                ['requiresAck', 'Checker'],
              ].map(([key, label]) => {
                const selected = fileFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFileFilter(key as typeof fileFilter)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryBg : colors.background }}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {filteredFiles.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>No hay coincidencias en el centro de archivos.</Text>
            ) : filteredFiles.map((file) => (
              <TouchableOpacity key={file.msg_id} style={styles.participantItem} activeOpacity={0.8} onPress={() => handleOpenFileMessage(file)}>
                <View style={[styles.participantAvatar, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.participantAvatarText, { color: colors.primary }]}>{(file.fileName || file.mediaType || 'F').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.participantInfo}>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]} numberOfLines={1}>{file.fileName || file.text || 'Archivo'}</Text>
                  <Text style={[styles.participantRole, { color: colors.textSecondary }]} numberOfLines={1}>
                    {[file.mediaType || 'enlace', file.threadTopic, file.messageType].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.checkboxSublabel, { color: colors.textMuted }]} numberOfLines={1}>
                    {(file.senderName || 'Usuario')} · {new Date(file.timestamp).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <TouchableOpacity onPress={() => handleOpenFileAsset(file)} style={[styles.actionPill, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.actionPillText, { color: colors.textOnPrimary }]}>Abrir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOpenFileMessage(file)} style={[styles.actionPill, { backgroundColor: colors.primaryBg }]}>
                    <Text style={[styles.actionPillText, { color: colors.primary }]}>Ir al mensaje</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  headerSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'transparent' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarLargeText: { fontSize: 32, fontWeight: '600', color: '#fff' },
  chatName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  chatSubtitle: { fontSize: 14 },
  section: { marginTop: 16, backgroundColor: 'transparent', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'transparent', paddingHorizontal: 16, paddingVertical: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  permissionsCard: { backgroundColor: 'transparent', borderRadius: 12, padding: 16 },
  permissionsLabel: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  radioOption: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  radioOptionSelected: {},
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  radioCircleSelected: {},
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioContent: { flex: 1 },
  radioLabel: { fontSize: 15, fontWeight: '500' },
  radioLabelSelected: {},
  radioDescription: { fontSize: 13, marginTop: 2 },
  delegadosSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'transparent' },
  delegadosTitle: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkboxChecked: {},
  checkboxContent: { flex: 1 },
  checkboxLabel: { fontSize: 15 },
  checkboxSublabel: { fontSize: 12, marginTop: 2 },
  participantGroup: { marginBottom: 16 },
  groupLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  participantItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  participantAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  participantAvatarText: { fontSize: 16, fontWeight: '600' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 15, fontWeight: '500' },
  participantMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  participantRole: { fontSize: 13 },
  delegadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  delegadoBadgeText: { fontSize: 11, fontWeight: '600' },
  actionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  actionPillSecondary: {},
  actionPillText: { fontSize: 11, fontWeight: '700' },
  actionPillTextSecondary: {},
});

export default ChatInfoScreen;
