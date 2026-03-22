import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Switch,
    Platform, StyleSheet, Alert
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { setBrowserNotificationsEnabled } from '../services/browserNotifications.service';
import { ThemeSelector } from '../components/ThemeSelector';
import { clearOldMessages } from '../db/database';
import { QRSyncScreen } from './QrSyncScreen';

const API_URL = "https://tuchat-pl9.onrender.com";

// Iconos (con color parametrizable)
const BackIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 24, height: 24 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </Svg>
);
const ChevronRight = ({ color = "#94a3b8" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: 16, height: 16 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </Svg>
);
const BellIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </Svg>
);
const SoundIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </Svg>
);
const ShieldIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </Svg>
);
const PaletteIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
    </Svg>
);
const StorageIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </Svg>
);
const SyncIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </Svg>
);
const TrashIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#ef4444" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </Svg>
);
const InfoIcon = ({ color = "#6366f1" }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </Svg>
);

// Componentes reutilizables
const SectionTitle = ({ children, color }: { children: string; color: string }) => (
    <Text style={[st.sectionTitle, { color }]}>{children}</Text>
);

const SectionHint = ({ children, color }: { children: string; color: string }) => (
    <Text style={[st.sectionHint, { color }]}>{children}</Text>
);

const SettingRow = ({ icon, title, subtitle, right, onPress, danger, colors }: any) => (
    <TouchableOpacity
        style={[st.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
        onPress={onPress} activeOpacity={onPress ? 0.6 : 1} disabled={!onPress && !right}
    >
        <View style={[st.iconBox, { backgroundColor: danger ? colors.dangerBg : colors.primaryBg }]}>{icon}</View>
        <View style={st.rowContent}>
            <Text style={[st.rowTitle, { color: danger ? colors.danger : colors.textPrimary }]}>{title}</Text>
            {subtitle ? <Text style={[st.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {right || (onPress ? <ChevronRight color={colors.textMuted} /> : null)}
    </TouchableOpacity>
);

// Pantalla principal
export const SettingsScreen = () => {
    const { colors, mode } = useTheme();
    const [notifs, setNotifs] = useState(true);
    const [sound, setSound] = useState(true);
    const [readReceipts, setReadReceipts] = useState(true);
    const [autoDownload, setAutoDownload] = useState(false);
    const [themeModalVisible, setThemeModalVisible] = useState(false);
    const [syncVisible, setSyncVisible] = useState(false);

    useEffect(() => {
        loadNotifPref();
        loadReadReceiptsPref();
    }, []);

    const loadNotifPref = async () => {
        try {
            const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/auth/notif-preference`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.ok) {
                setNotifs(res.data.notificaciones_activas);
                if (Platform.OS === 'web') setBrowserNotificationsEnabled(res.data.notificaciones_activas);
            }
        } catch (e) {  }
    };

    const toggleNotifs = async (value: boolean) => {
        setNotifs(value);
        if (Platform.OS === 'web') setBrowserNotificationsEnabled(value);
        try {
            const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
            if (!token) return;
            await axios.put(`${API_URL}/auth/notif-preference`, { notificaciones_activas: value }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) {
            setNotifs(!value); // revertir si falla
            if (Platform.OS === 'web') setBrowserNotificationsEnabled(!value);
        }
    };

    const loadReadReceiptsPref = async () => {
        try {
            const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/auth/read-receipts-preference`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.ok) setReadReceipts(res.data.confirmaciones_lectura_activas);
        } catch (e) { }
    };

    const toggleReadReceipts = async (value: boolean) => {
        setReadReceipts(value);
        try {
            const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
            if (!token) return;
            await axios.put(`${API_URL}/auth/read-receipts-preference`, { confirmaciones_lectura_activas: value }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) {
            setReadReceipts(!value);
        }
    };

    const handleClearCache = () => {
        Alert.alert(
            "Borrar mensajes antiguos",
            "Se eliminarán los mensajes con más de 20 días de antigüedad. Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Borrar", style: "destructive", onPress: () => {
                        try {
                            const count = clearOldMessages(20);
                            Alert.alert("Listo", count > 0
                                ? `Se eliminaron ${count} mensajes antiguos`
                                : "No había mensajes con más de 20 días de antigüedad");
                        } catch (e) {
                            Alert.alert("Error", "No se pudo limpiar la cache");
                        }
                    }
                },
            ]
        );
    };

    const syncLabel = Platform.OS === 'web'
        ? 'Importa mensajes desde tu móvil'
        : 'Envía mensajes a TuChat Web';

    const themeLabel = mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Sistema';
    const comfortSummary = [
        notifs ? 'Alertas activas' : 'Alertas pausadas',
        readReceipts ? 'Lectura visible' : 'Lectura privada',
        autoDownload ? 'Multimedia automatica' : 'Multimedia manual',
    ].join('  ·  ');

    return (
        <View style={[st.container, { backgroundColor: colors.background }]}>
            <View style={[st.header, { backgroundColor: colors.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}><BackIcon /></TouchableOpacity>
                <Text style={st.headerTitle}>Configuración</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
                <View style={[st.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[st.heroEyebrow, { color: colors.primary }]}>Control rapido</Text>
                    <Text style={[st.heroTitle, { color: colors.textPrimary }]}>Ajusta privacidad, avisos y sincronizacion sin perderte.</Text>
                    <Text style={[st.heroDescription, { color: colors.textSecondary }]}>
                        Tu configuracion actual: {comfortSummary}
                    </Text>
                </View>
                <SectionTitle color={colors.textMuted}>Notificaciones</SectionTitle>
                <SectionHint color={colors.textMuted}>Decide como quieres enterarte de actividad nueva y si la app debe sonar al momento.</SectionHint>
                <SettingRow colors={colors} icon={<BellIcon color={colors.primary} />} title="Recibir Notificaciones" subtitle="Gestiona tus alertas de chat y actividad."
                    right={<Switch value={notifs} onValueChange={toggleNotifs} trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }} thumbColor={notifs ? colors.switchThumbOn : colors.switchThumbOff} />} />
                <SettingRow colors={colors} icon={<SoundIcon color={colors.primary} />} title="Sonidos" subtitle="Reproduce sonido al recibir mensajes."
                    right={<Switch value={sound} onValueChange={setSound} trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }} thumbColor={sound ? colors.switchThumbOn : colors.switchThumbOff} />} />

                <SectionTitle color={colors.textMuted}>Privacidad</SectionTitle>
                <SectionHint color={colors.textMuted}>Estas opciones cambian lo que otros pueden saber sobre tu actividad dentro del chat.</SectionHint>
                <SettingRow colors={colors} icon={<ShieldIcon color={colors.primary} />} title="Confirmaciones de lectura" subtitle="Permite mostrar cuando has abierto un mensaje."
                    right={<Switch value={readReceipts} onValueChange={toggleReadReceipts} trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }} thumbColor={readReceipts ? colors.switchThumbOn : colors.switchThumbOff} />} />
                <SettingRow colors={colors} icon={<ShieldIcon color={colors.primary} />} title="Política de Privacidad" subtitle="Revisa cómo manejamos tus datos." onPress={() => router.push({ pathname: '/settings-info' as any, params: { type: 'privacy' } } as any)} />

                <SectionTitle color={colors.textMuted}>Apariencia</SectionTitle>
                <SectionHint color={colors.textMuted}>Personaliza el aspecto general de la app para que se sienta mas comoda al usarla a diario.</SectionHint>
                <SettingRow colors={colors} icon={<PaletteIcon color={colors.primary} />} title="Tema" subtitle={themeLabel} onPress={() => setThemeModalVisible(true)} />

                <SectionTitle color={colors.textMuted}>Almacenamiento</SectionTitle>
                <SectionHint color={colors.textMuted}>Gestiona como se descargan los archivos y cuanto contenido local quieres conservar.</SectionHint>
                <SettingRow colors={colors} icon={<StorageIcon color={colors.primary} />} title="Descarga automática de medios" subtitle="Descarga imágenes y vídeos automáticamente."
                    right={<Switch value={autoDownload} onValueChange={setAutoDownload} trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }} thumbColor={autoDownload ? colors.switchThumbOn : colors.switchThumbOff} />} />
                <SectionTitle color={colors.textMuted}>Sincronizacion</SectionTitle>
                <SectionHint color={colors.textMuted}>Conecta esta sesion con tu otro dispositivo para mantener el estado mas alineado.</SectionHint>
                <SettingRow colors={colors} icon={<SyncIcon color={colors.primary} />} title="Sincronizar con Web" subtitle={syncLabel} onPress={() => setSyncVisible(true)} />
                <SectionTitle color={colors.textMuted}>Mantenimiento</SectionTitle>
                <SectionHint color={colors.textMuted}>Herramientas para limpiar contenido local y mantener la app ligera.</SectionHint>
                <SettingRow colors={colors} icon={<TrashIcon />} title="Borrar mensajes antiguos" subtitle="Elimina mensajes con más de 20 días" onPress={handleClearCache} danger />

                <SectionTitle color={colors.textMuted}>Informacion</SectionTitle>
                <SectionHint color={colors.textMuted}>Datos basicos de la app y accesos para revisar soporte o version instalada.</SectionHint>
                <SettingRow colors={colors} icon={<InfoIcon color={colors.primary} />} title="Acerca de TuChat" subtitle="Versión 1.0.0" onPress={() => router.push({ pathname: '/settings-info' as any, params: { type: 'about' } } as any)} />
                <View style={{ height: 40 }} />
            </ScrollView>

            <ThemeSelector visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
            <QRSyncScreen visible={syncVisible} onClose={() => setSyncVisible(false)} />
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
    heroCard: { marginHorizontal: 16, marginTop: 18, paddingHorizontal: 18, paddingVertical: 18, borderRadius: 18, borderWidth: 1 },
    heroEyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    heroTitle: { marginTop: 8, fontSize: 20, lineHeight: 28, fontWeight: '800' },
    heroDescription: { marginTop: 8, fontSize: 13, lineHeight: 20 },
    sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
    sectionHint: { fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, gap: 14 },
    iconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '500' },
    rowSubtitle: { fontSize: 13, marginTop: 2 },
});

export default SettingsScreen;


