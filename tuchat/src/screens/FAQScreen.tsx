import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    Platform, StyleSheet, LayoutAnimation, UIManager
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

// Habilitar animaciones en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============ ICONOS ============
const BackIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 24, height: 24 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </Svg>
);

const SearchIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" style={{ width: 18, height: 18 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </Svg>
);

const ChevronIcon = ({ rotated }: { rotated: boolean }) => (
    <Svg
        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8"
        style={{ width: 16, height: 16, transform: [{ rotate: rotated ? '90deg' : '0deg' }] }}
    >
        <Path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </Svg>
);

const MailIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </Svg>
);

// Iconos para cada FAQ
const ChatIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </Svg>
);

const BellIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </Svg>
);

const GroupIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </Svg>
);

const PhoneCallIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </Svg>
);

const ShieldIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </Svg>
);

const SyncIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
    </Svg>
);

// ============ DATOS ============

const FAQS = [
    {
        icon: <ChatIcon />,
        q: "¿Cómo puedo enviar un mensaje?",
        a: "Selecciona una conversación de grupo o un chat privado, escribe tu mensaje en el campo de texto y pulsa el botón de enviar. También puedes adjuntar imágenes y vídeos pulsando el icono de clip.",
    },
    {
        icon: <BellIcon />,
        q: "¿Cómo activo las notificaciones?",
        a: "Ve a Configuración > Notificaciones y activa el interruptor de 'Recibir Notificaciones'. Asegúrate de que tu dispositivo también tiene las notificaciones habilitadas para TuChat.",
    },
    {
        icon: <GroupIcon />,
        q: "¿Cómo se crean los grupos?",
        a: "Los grupos se crean automáticamente según las asignaturas y clases en las que estés matriculado. No es necesario crear grupos manualmente.",
    },
    {
        icon: <PhoneCallIcon />,
        q: "¿Puedo hacer llamadas de voz o vídeo?",
        a: "Sí. Dentro de cualquier chat, encontrarás los iconos de teléfono y cámara en la parte superior. Pulsa uno de ellos para iniciar una llamada de audio o vídeo.",
    },
    {
        icon: <ShieldIcon />,
        q: "¿Mis mensajes son privados?",
        a: "Sí, los mensajes en chats privados solo son visibles para ti y la otra persona. Los mensajes de grupo son visibles para todos los miembros del grupo (profesor y alumnos de esa asignatura).",
    },
    {
        icon: <SyncIcon />,
        q: "¿Cómo sincronizo mis datos?",
        a: "Tus datos se sincronizan automáticamente cada vez que inicias sesión. Si necesitas forzar una sincronización, cierra sesión y vuelve a entrar.",
    },
];

// ============ PANTALLA PRINCIPAL ============

export const FAQScreen = () => {
    const { colors } = useTheme();
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');

    const toggleFaq = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenIndex(openIndex === index ? null : index);
    };

    const filteredFaqs = FAQS.filter(
        faq => faq.q.toLowerCase().includes(searchText.toLowerCase()) ||
            faq.a.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <View style={[st.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[st.header, { backgroundColor: colors.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <BackIcon />
                </TouchableOpacity>
                <Text style={st.headerTitle}>Preguntas frecuentes</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
                {/* Buscador */}
                <View style={st.searchContainer}>
                    <View style={[st.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <SearchIcon />
                        <TextInput
                            style={[st.searchInput, { color: colors.inputText }]}
                            placeholder="Buscar pregunta..."
                            placeholderTextColor={colors.placeholder}
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                    </View>
                </View>

                {/* FAQs */}
                <Text style={[st.sectionTitle, { color: colors.textMuted }]}>PREGUNTAS FRECUENTES</Text>

                {filteredFaqs.map((faq, i) => {
                    const isOpen = openIndex === i;
                    return (
                        <View key={i} style={[st.faqItem, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
                            <TouchableOpacity
                                style={st.faqHeader}
                                onPress={() => toggleFaq(i)}
                                activeOpacity={0.6}
                            >
                                <View style={[st.faqIconBox, { backgroundColor: colors.primaryBg }]}>{faq.icon}</View>
                                <Text style={[st.faqQuestion, { color: colors.textPrimary }]}>{faq.q}</Text>
                                <ChevronIcon rotated={isOpen} />
                            </TouchableOpacity>
                            {isOpen && (
                                <View style={st.faqAnswerContainer}>
                                    <Text style={[st.faqAnswer, { color: colors.textSecondary }]}>{faq.a}</Text>
                                </View>
                            )}
                        </View>
                    );
                })}

                {filteredFaqs.length === 0 && (
                    <View style={st.emptyState}>
                        <Text style={st.emptyIcon}>🔍</Text>
                        <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin resultados</Text>
                        <Text style={st.emptyText}>No se encontraron preguntas con "{searchText}"</Text>
                    </View>
                )}

                {/* Contacto */}
                <Text style={[st.sectionTitle, { color: colors.textMuted }]}>¿NO ENCUENTRAS LO QUE BUSCAS?</Text>
                <TouchableOpacity style={[st.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]} onPress={() => { }} activeOpacity={0.6}>
                    <View style={[st.faqIconBox, { backgroundColor: colors.primaryBg }]}><MailIcon /></View>
                    <View style={st.rowContent}>
                        <Text style={[st.rowTitle, { color: colors.textPrimary }]}>Contactar soporte</Text>
                        <Text style={[st.rowSubtitle, { color: colors.textMuted }]}>Envíanos un correo con tu consulta.</Text>
                    </View>
                    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" style={{ width: 16, height: 16 }}>
                        <Path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </Svg>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

// ============ ESTILOS ============

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#6366f1',
        paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 44 : 14,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    // Search
    searchContainer: { padding: 16, paddingBottom: 8 },
    searchBox: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    searchInput: { flex: 1, fontSize: 14 },

    // Section
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase',
        letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10,
    },

    // FAQ items
    faqItem: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    faqHeader: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14,
    },
    faqIconBox: {
        width: 38, height: 38, borderRadius: 10, backgroundColor: '#eef2ff',
        justifyContent: 'center', alignItems: 'center',
    },
    faqQuestion: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1e293b' },
    faqAnswerContainer: { paddingHorizontal: 20, paddingBottom: 16, paddingLeft: 72 },
    faqAnswer: { fontSize: 14, color: '#64748b', lineHeight: 22 },

    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
    emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },

    // Contact row
    row: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 14,
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
    rowSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
});

export default FAQScreen;