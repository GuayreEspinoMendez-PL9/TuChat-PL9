import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';

const API_URL = "https://tuchat-pl9.onrender.com";

const getStorageItem = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
};

// Iconos
const UserIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </Svg>
);

const ShieldIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
  </Svg>
);

const CheckIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 14, height: 14 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </Svg>
);

interface ChatInfoScreenProps {
  roomId: string;
  nombre: string;
  esProfesor?: boolean; // Ahora es opcional porque lo validaremos dentro
}

type PermissionMode = 'todos' | 'solo_profesor' | 'profesor_delegados';

export const ChatInfoScreen = ({ roomId, nombre, esProfesor: esProfesorProp }: ChatInfoScreenProps) => {
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('todos');
  const [delegados, setDelegados] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
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

  // ✅ DEBUG REAL: Ahora comparamos la prop con lo que detectamos nosotros
  console.log("🔍 DEBUG ROL:", { 
    víaProp: esProfesorProp, 
    víaInterna: esProfesorInterno 
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Componentes locales de UI...
  const RadioButton = ({ selected, onPress, label, description }: any) => (
    <TouchableOpacity
      style={[styles.radioOption, selected && styles.radioOptionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <View style={styles.radioContent}>
        <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>{label}</Text>
        {description && <Text style={styles.radioDescription}>{description}</Text>}
      </View>
    </TouchableOpacity>
  );

  const Checkbox = ({ checked, onPress, label, sublabel }: any) => (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <CheckIcon />}</View>
      <View style={styles.checkboxContent}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        {sublabel && <Text style={styles.checkboxSublabel}>{sublabel}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.headerSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarLargeText}>{nombre.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.chatName, { color: colors.textPrimary }]}>{nombre}</Text>
        <Text style={[styles.chatSubtitle, { color: colors.textSecondary }]}>Grupo · {participantes.length} participantes</Text>
      </View>

      {/* ✅ SECCIÓN CORREGIDA: Usamos esProfesorInterno */}
      {esProfesorInterno && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <ShieldIcon />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Permisos del chat</Text>
            {saving && <ActivityIndicator size="small" color="#6366f1" style={{ marginLeft: 8 }} />}
          </View>

          <View style={[styles.permissionsCard, { backgroundColor: colors.background }]}>
            <Text style={styles.permissionsLabel}>¿Quién puede enviar mensajes?</Text>
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
                <Text style={styles.delegadosTitle}>Seleccionar delegados:</Text>
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
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <UserIcon />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Participantes ({participantes.length})</Text>
        </View>

        {profesores.length > 0 && (
          <View style={styles.participantGroup}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>Profesores</Text>
            {profesores.map((profesor) => (
              <View key={profesor.id} style={styles.participantItem}>
                <View style={[styles.participantAvatar, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.participantAvatarText, { color: colors.primary }]}>{profesor.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.participantInfo}>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]}>{profesor.nombre}</Text>
                  <Text style={[styles.participantRole, { color: colors.textSecondary }]}>Profesor</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {alumnos.length > 0 && (
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
                    <Text style={[styles.participantRole, { color: colors.textSecondary }]}>Alumno</Text>
                    {delegados.includes(alumno.id) && (
                      <View style={styles.delegadoBadge}>
                        <Text style={styles.delegadoBadgeText}>Delegado</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  headerSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarLargeText: { fontSize: 32, fontWeight: '600', color: '#fff' },
  chatName: { fontSize: 20, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  chatSubtitle: { fontSize: 14, color: '#64748b' },
  section: { marginTop: 16, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginLeft: 8 },
  permissionsCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16 },
  permissionsLabel: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 12 },
  radioOption: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  radioOptionSelected: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  radioCircleSelected: { borderColor: '#6366f1' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1' },
  radioContent: { flex: 1 },
  radioLabel: { fontSize: 15, fontWeight: '500', color: '#334155' },
  radioLabelSelected: { color: '#4f46e5' },
  radioDescription: { fontSize: 13, color: '#64748b', marginTop: 2 },
  delegadosSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  delegadosTitle: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  checkboxContent: { flex: 1 },
  checkboxLabel: { fontSize: 15, color: '#334155' },
  checkboxSublabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  participantGroup: { marginBottom: 16 },
  groupLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  participantItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  participantAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  participantAvatarText: { fontSize: 16, fontWeight: '600', color: '#6366f1' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  participantMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  participantRole: { fontSize: 13, color: '#64748b' },
  delegadoBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  delegadoBadgeText: { fontSize: 11, fontWeight: '600', color: '#d97706' },
});

export default ChatInfoScreen;