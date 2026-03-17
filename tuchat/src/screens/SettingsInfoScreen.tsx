import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

const BackIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 24, height: 24 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </Svg>
);

const ShieldIcon = ({ color }: { color: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 24, height: 24 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </Svg>
);

const InfoIcon = ({ color }: { color: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color} style={{ width: 24, height: 24 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </Svg>
);

const PRIVACY_SECTIONS = [
    {
        title: 'Datos que usamos',
        body: 'TuChat guarda tu nombre visible, tu correo educativo, tu foto de perfil y el contenido de los mensajes para que puedas acceder a tus conversaciones desde distintos dispositivos.',
    },
    {
        title: 'Como protegemos la informacion',
        body: 'Aplicamos controles de acceso, sesiones autenticadas y almacenamiento cifrado en partes sensibles del sistema. El acceso a conversaciones queda limitado a los participantes del chat y al personal tecnico cuando sea necesario resolver incidencias.',
    },
    {
        title: 'Uso interno de los datos',
        body: 'La informacion se usa para entregar mensajes, sincronizar tu cuenta, prevenir abuso y mejorar la experiencia general de la plataforma. No vendemos tus datos a terceros.',
    },
    {
        title: 'Tiempo de conservacion',
        body: 'Los mensajes y archivos se mantienen mientras tu cuenta siga activa o hasta que una solicitud institucional requiera su eliminacion. Algunos registros tecnicos pueden conservarse temporalmente para auditoria y seguridad.',
    },
];

const ABOUT_SECTIONS = [
    {
        title: 'Que es TuChat',
        body: 'TuChat es una plataforma de mensajeria pensada para conectar alumnado, profesorado y equipos de apoyo en un entorno rapido, sencillo y centrado en la vida academica.',
    },
    {
        title: 'Nuestra idea',
        body: 'Queremos que comunicarse dentro del centro sea tan natural como abrir una conversacion. Por eso mezclamos chats privados, grupos por clase y herramientas de sincronizacion entre movil y web.',
    },
    {
        title: 'Version actual',
        body: 'Esta compilacion corresponde a la version 1.0.0 de TuChat. Incluye personalizacion de tema, gestion de privacidad, preguntas frecuentes y sincronizacion entre dispositivos.',
    },
    {
        title: 'Equipo',
        body: 'TuChat ha sido disenado por un pequeno equipo ficticio obsesionado con hacer la comunicacion escolar mas clara, menos ruidosa y mucho mas humana.',
    },
];

export const SettingsInfoScreen = () => {
    const { colors } = useTheme();
    const params = useLocalSearchParams<{ type?: string }>();
    const isPrivacy = params.type === 'privacy';

    const page = isPrivacy
        ? {
            title: 'Politica de privacidad',
            eyebrow: 'Privacidad',
            description: 'Resumen practico de como TuChat recoge, usa y protege la informacion dentro de la plataforma.',
            icon: <ShieldIcon color={colors.primary} />,
            sections: PRIVACY_SECTIONS,
        }
        : {
            title: 'Acerca de TuChat',
            eyebrow: 'Informacion de la app',
            description: 'Una vista general de la idea, el enfoque y la version actual de la plataforma.',
            icon: <InfoIcon color={colors.primary} />,
            sections: ABOUT_SECTIONS,
        };

    return (
        <View style={[st.container, { backgroundColor: colors.background }]}>
            <View style={[st.header, { backgroundColor: colors.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <BackIcon />
                </TouchableOpacity>
                <Text style={st.headerTitle}>{page.title}</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
                <View style={[st.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[st.heroIconBox, { backgroundColor: colors.primaryBg }]}>{page.icon}</View>
                    <Text style={[st.heroEyebrow, { color: colors.primary }]}>{page.eyebrow}</Text>
                    <Text style={[st.heroTitle, { color: colors.textPrimary }]}>{page.title}</Text>
                    <Text style={[st.heroDescription, { color: colors.textSecondary }]}>{page.description}</Text>
                </View>

                {page.sections.map((section) => (
                    <View key={section.title} style={[st.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                        <Text style={[st.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
                        <Text style={[st.sectionBody, { color: colors.textSecondary }]}>{section.body}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 44 : 14,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    heroCard: { borderWidth: 1, borderRadius: 22, padding: 20, marginBottom: 18 },
    heroIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    heroEyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    heroTitle: { marginTop: 6, fontSize: 24, lineHeight: 30, fontWeight: '800' },
    heroDescription: { marginTop: 10, fontSize: 14, lineHeight: 22 },
    sectionCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    sectionBody: { fontSize: 14, lineHeight: 22 },
});

export default SettingsInfoScreen;
