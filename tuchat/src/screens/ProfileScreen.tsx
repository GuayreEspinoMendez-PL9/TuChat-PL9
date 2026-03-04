import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    Platform, StyleSheet, Modal, TextInput, Alert, ActivityIndicator
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const API_URL = "https://tuchat-pl9.onrender.com";

const BackIcon = () => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 24, height: 24 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></Svg>);
const ChevronRight = ({ color = "#94a3b8" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: 16, height: 16 }}><Path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></Svg>);
const XIcon = ({ color = "#94a3b8" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></Svg>);

const UserIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></Svg>);
const IdIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" /></Svg>);
const MailIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></Svg>);
const PhoneIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></Svg>);
const BuildingIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" /></Svg>);
const AcademicIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></Svg>);
const KeyIcon = ({ color = "#6366f1" }: { color?: string }) => (<Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}><Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></Svg>);

const getToken = async () => Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');

const SectionTitle = ({ children, color }: { children: string; color: string }) => (
    <Text style={[st.sectionTitle, { color }]}>{children}</Text>
);

const SettingRow = ({ icon, title, subtitle, onPress, colors }: any) => (
    <TouchableOpacity style={[st.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]} onPress={onPress} activeOpacity={onPress ? 0.6 : 1} disabled={!onPress}>
        <View style={[st.iconBox, { backgroundColor: colors.primaryBg }]}>{icon}</View>
        <View style={st.rowContent}>
            <Text style={[st.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle ? <Text style={[st.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {onPress ? <ChevronRight color={colors.textMuted} /> : null}
    </TouchableOpacity>
);

export const ProfileScreen = () => {
    const { colors } = useTheme();
    const [user, setUser] = useState({ nombre: '', apellidos: '', dni: '', cial: '', email: '', telefono: '', tipo: 'ALUMNO', centro: '' });
    const [showPw, setShowPw] = useState(false);
    const [pwActual, setPwActual] = useState('');
    const [pwNueva, setPwNueva] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => { loadUser(); }, []);

    const loadUser = async () => {
        try {
            const str = Platform.OS === 'web' ? localStorage.getItem('usuario') : await SecureStore.getItemAsync('usuario');
            if (str) {
                const d = JSON.parse(str);
                setUser({
                    nombre: d.nombre || '', apellidos: d.apellidos || '', dni: d.dni || '',
                    cial: d.cial || '', email: d.email || '', telefono: d.telefono || '',
                    tipo: d.tipo || d.tipo_externo || 'ALUMNO',
                    centro: d.codigo_centro || d.centro || '',
                });
            }
        } catch (e) { console.error("Error cargando datos:", e); }
    };

    const handleChangePw = async () => {
        if (!pwActual.trim()) return Alert.alert('Error', 'Introduce tu contraseña actual');
        if (!pwNueva.trim() || pwNueva.length < 4) return Alert.alert('Error', 'La nueva contraseña debe tener al menos 4 caracteres');
        if (pwNueva !== pwConfirm) return Alert.alert('Error', 'Las contraseñas nuevas no coinciden');
        setPwLoading(true);
        try {
            const token = await getToken();
            const res = await axios.post(`${API_URL}/auth/cambiar-password`, { password_actual: pwActual, password_nueva: pwNueva }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.ok) { Alert.alert('Listo', 'Contraseña actualizada correctamente'); setShowPw(false); }
            else Alert.alert('Error', res.data.msg || 'Error');
        } catch (e: any) { Alert.alert('Error', e.response?.data?.msg || 'Error al cambiar contraseña'); }
        finally { setPwLoading(false); }
    };

    const initial = (user.nombre || '?').charAt(0).toUpperCase();

    return (
        <View style={[st.container, { backgroundColor: colors.background }]}>
            <View style={[st.header, { backgroundColor: colors.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}><BackIcon /></TouchableOpacity>
                <Text style={st.headerTitle}>Mi Perfil</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
                <View style={[st.profileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <View style={[st.avatar, { backgroundColor: colors.primary }]}><Text style={st.avatarText}>{initial}</Text></View>
                    <Text style={[st.profileName, { color: colors.textPrimary }]}>{user.nombre} {user.apellidos}</Text>
                    <View style={[st.badge, { backgroundColor: colors.primaryBg }]}><Text style={[st.badgeText, { color: colors.primary }]}>{user.tipo}</Text></View>
                </View>

                <SectionTitle color={colors.textMuted}>Información personal</SectionTitle>
                <SettingRow colors={colors} icon={<UserIcon color={colors.primary} />} title="DNI" subtitle={user.dni || 'No disponible'} />
                <SettingRow colors={colors} icon={<IdIcon color={colors.primary} />} title="CIAL" subtitle={user.cial || 'No disponible'} />
                <SettingRow colors={colors} icon={<MailIcon color={colors.primary} />} title="Correo electrónico" subtitle={user.email || 'No configurado'} />
                <SettingRow colors={colors} icon={<PhoneIcon color={colors.primary} />} title="Teléfono" subtitle={user.telefono || 'No configurado'} />

                <SectionTitle color={colors.textMuted}>Académico</SectionTitle>
                <SettingRow colors={colors} icon={<BuildingIcon color={colors.primary} />} title="Centro educativo" subtitle={user.centro || 'No disponible'} />
                <SettingRow colors={colors} icon={<AcademicIcon color={colors.primary} />} title="Rol" subtitle={user.tipo} />

                <SectionTitle color={colors.textMuted}>Seguridad</SectionTitle>
                <SettingRow colors={colors} icon={<KeyIcon color={colors.primary} />} title="Cambiar contraseña" subtitle="Actualiza tu contraseña de acceso" onPress={() => { setShowPw(true); setPwActual(''); setPwNueva(''); setPwConfirm(''); }} />

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal cambiar contraseña */}
            <Modal visible={showPw} transparent animationType="slide">
                <TouchableOpacity activeOpacity={1} onPress={() => setShowPw(false)} style={st.overlay}>
                    <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[st.modalBox, { backgroundColor: colors.surface }]}>
                        <View style={[st.modalHead, { borderBottomColor: colors.borderLight }]}>
                            <Text style={[st.modalTitle, { color: colors.textPrimary }]}>Cambiar contraseña</Text>
                            <TouchableOpacity onPress={() => setShowPw(false)}><XIcon color={colors.textMuted} /></TouchableOpacity>
                        </View>
                        <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                            <Text style={[st.fieldLabel, { color: colors.textSecondary }]}>Contraseña actual</Text>
                            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]} value={pwActual} onChangeText={setPwActual} secureTextEntry placeholder="Tu contraseña actual" placeholderTextColor={colors.placeholder} />

                            <Text style={[st.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>Nueva contraseña</Text>
                            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]} value={pwNueva} onChangeText={setPwNueva} secureTextEntry placeholder="Mínimo 4 caracteres" placeholderTextColor={colors.placeholder} />

                            <Text style={[st.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>Confirmar nueva contraseña</Text>
                            <TextInput style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]} value={pwConfirm} onChangeText={setPwConfirm} secureTextEntry placeholder="Repite la nueva contraseña" placeholderTextColor={colors.placeholder} />

                            <TouchableOpacity onPress={handleChangePw} disabled={pwLoading} style={[st.saveBtn, { backgroundColor: colors.primary, opacity: pwLoading ? 0.6 : 1 }]}>
                                {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Cambiar contraseña</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 44 : 14 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    profileHeader: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, borderBottomWidth: 1 },
    avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
    profileName: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
    badge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: '600' },
    sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, gap: 14 },
    iconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '500' },
    rowSubtitle: { fontSize: 13, marginTop: 2 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    modalTitle: { fontSize: 17, fontWeight: '700' },
    fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500' },
    saveBtn: { marginTop: 20, marginBottom: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default ProfileScreen;