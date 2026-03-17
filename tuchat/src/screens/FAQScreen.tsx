import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    Platform, StyleSheet, LayoutAnimation, UIManager
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BackIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff" style={{ width: 24, height: 24 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </Svg>
);

const SearchIcon = ({ color = '#94a3b8', size = 18 }: { color?: string; size?: number }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} style={{ width: size, height: size }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </Svg>
);

const ChevronIcon = ({ rotated }: { rotated: boolean }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" style={{ width: 16, height: 16, transform: [{ rotate: rotated ? '90deg' : '0deg' }] }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </Svg>
);

const MailIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </Svg>
);

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

const FAQS = [
    {
        icon: <ChatIcon />,
        q: 'Como puedo enviar un mensaje',
        a: 'Selecciona una conversacion de grupo o un chat privado, escribe tu mensaje en el campo de texto y pulsa el boton de enviar. Tambien puedes adjuntar imagenes y videos desde el icono de clip.',
    },
    {
        icon: <BellIcon />,
        q: 'Como activo las notificaciones',
        a: 'Ve a Configuracion > Notificaciones y activa la opcion de recibir avisos. Revisa tambien los permisos del dispositivo para TuChat.',
    },
    {
        icon: <GroupIcon />,
        q: 'Como se crean los grupos',
        a: 'Los grupos se crean automaticamente segun las asignaturas y clases en las que estes matriculado. No necesitas crearlos manualmente.',
    },
    {
        icon: <PhoneCallIcon />,
        q: 'Puedo hacer llamadas de voz o video',
        a: 'Si. Dentro de cada chat veras los accesos de telefono y camara en la parte superior para iniciar una llamada.',
    },
    {
        icon: <ShieldIcon />,
        q: 'Mis mensajes son privados',
        a: 'Los chats privados solo son visibles para ti y la otra persona. En los grupos pueden ver los mensajes los miembros de esa conversacion.',
    },
    {
        icon: <SyncIcon />,
        q: 'Como se sincronizan mis datos',
        a: 'La aplicacion sincroniza automaticamente al iniciar sesion y al recibir actividad nueva. Si notas desfase, cierra sesion y vuelve a entrar.',
    },
];

export const FAQScreen = () => {
    const { colors } = useTheme();
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');

    const toggleFaq = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenIndex(openIndex === index ? null : index);
    };

    const filteredFaqs = FAQS.filter(
        (faq) => faq.q.toLowerCase().includes(searchText.toLowerCase()) ||
            faq.a.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <View style={[st.container, { backgroundColor: colors.background }]}>
            <View style={[st.header, { backgroundColor: colors.primary }]}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <BackIcon />
                </TouchableOpacity>
                <Text style={st.headerTitle}>Preguntas frecuentes</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
                <View style={st.searchContainer}>
                    <View style={[st.searchPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={st.searchPanelHeader}>
                            <View style={[st.searchPanelIconWrap, { backgroundColor: colors.primaryBg }]}>
                                <SearchIcon color="#6366f1" size={22} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[st.searchPanelTitle, { color: colors.textPrimary }]}>Encuentra ayuda rapido</Text>
                                <Text style={[st.searchPanelSubtitle, { color: colors.textSecondary }]}>Busca por funcion, problema o palabra clave sin salir de esta pantalla.</Text>
                            </View>
                        </View>

                        <View style={[st.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <SearchIcon />
                            <TextInput
                                style={[st.searchInput, { color: colors.inputText }]}
                                placeholder="Buscar en preguntas frecuentes"
                                placeholderTextColor={colors.placeholder}
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                            {!!searchText && (
                                <TouchableOpacity onPress={() => setSearchText('')} style={[st.clearBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <Text style={[st.clearBtnText, { color: colors.textSecondary }]}>Limpiar</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                <Text style={[st.sectionTitle, { color: colors.textMuted }]}>Preguntas frecuentes</Text>

                {filteredFaqs.map((faq, index) => {
                    const isOpen = openIndex === index;
                    return (
                        <View key={index} style={[st.faqItem, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
                            <TouchableOpacity style={st.faqHeader} onPress={() => toggleFaq(index)} activeOpacity={0.7}>
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
                        <View style={[st.emptyIconWrap, { backgroundColor: colors.primaryBg }]}>
                            <SearchIcon color="#6366f1" size={24} />
                        </View>
                        <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sin resultados</Text>
                        <Text style={[st.emptyText, { color: colors.textMuted }]}>No se encontraron preguntas con "{searchText}"</Text>
                    </View>
                )}

                <Text style={[st.sectionTitle, { color: colors.textMuted }]}>Necesitas mas ayuda</Text>
                <TouchableOpacity style={[st.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]} activeOpacity={0.7}>
                    <View style={[st.faqIconBox, { backgroundColor: colors.primaryBg }]}><MailIcon /></View>
                    <View style={st.rowContent}>
                        <Text style={[st.rowTitle, { color: colors.textPrimary }]}>Contactar soporte</Text>
                        <Text style={[st.rowSubtitle, { color: colors.textMuted }]}>Usa este acceso para escribir una consulta mas concreta.</Text>
                    </View>
                    <ChevronIcon rotated={false} />
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
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
    scrollContent: { paddingBottom: 40 },
    searchContainer: { padding: 16, paddingBottom: 8 },
    searchPanel: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
    },
    searchPanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
    },
    searchPanelIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchPanelTitle: { fontSize: 16, fontWeight: '700' },
    searchPanelSubtitle: { fontSize: 13, marginTop: 3, lineHeight: 18 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
    },
    searchInput: { flex: 1, fontSize: 14 },
    clearBtn: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    clearBtnText: { fontSize: 12, fontWeight: '700' },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 10,
    },
    faqItem: { borderBottomWidth: 1 },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 14,
    },
    faqIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    faqQuestion: { flex: 1, fontSize: 15, fontWeight: '600' },
    faqAnswerContainer: { paddingHorizontal: 20, paddingBottom: 16, paddingLeft: 74 },
    faqAnswer: { fontSize: 14, lineHeight: 22 },
    emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    emptyText: { fontSize: 14, textAlign: 'center' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        gap: 14,
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600' },
    rowSubtitle: { fontSize: 13, marginTop: 2 },
});

export default FAQScreen;
