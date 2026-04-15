import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Platform, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme, ThemeMode } from '../context/ThemeContext';

const SunIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#f59e0b" style={{ width: 22, height: 22 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </Svg>
);

const MoonIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#6366f1" style={{ width: 22, height: 22 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </Svg>
);

const SystemIcon = () => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#64748b" style={{ width: 22, height: 22 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </Svg>
);

const ColorDotIcon = ({ color }: { color: string }) => (
    <Svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
        <Circle cx="12" cy="12" r="10" fill={color} />
        <Circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={0.3} />
    </Svg>
);

const CheckIcon = ({ color }: { color?: string }) => (
    <Svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke={color || '#6366f1'} style={{ width: 20, height: 20 }}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </Svg>
);

interface Props {
    visible: boolean;
    onClose: () => void;
}

const options: { mode: ThemeMode; label: string; desc: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Claro', desc: 'Tema claro siempre activo.', icon: <SunIcon /> },
    { mode: 'dark', label: 'Oscuro', desc: 'Tema oscuro siempre activo.', icon: <MoonIcon /> },
    { mode: 'system', label: 'Sistema', desc: 'Sigue la configuración del dispositivo.', icon: <SystemIcon /> },
    { mode: 'green', label: 'Verde', desc: 'Tema verde natural.', icon: <ColorDotIcon color="#16a34a" /> },
    { mode: 'red', label: 'Rojo', desc: 'Tema rojo intenso.', icon: <ColorDotIcon color="#dc2626" /> },
    { mode: 'yellow', label: 'Amarillo', desc: 'Tema amarillo cálido.', icon: <ColorDotIcon color="#ca8a04" /> },
];

// Componente para seleccionar el tema de la aplicación
export const ThemeSelector = ({ visible, onClose }: Props) => {
    const { mode, setMode, colors } = useTheme();

    const handleSelect = (selected: ThemeMode) => {
        setMode(selected);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={st.overlay} onPress={onClose}>
                <Pressable style={[st.modal, { backgroundColor: colors.surface }]} onPress={() => { }}>
                    <Text style={[st.title, { color: colors.textPrimary }]}>Seleccionar tema</Text>
                    <Text style={[st.subtitle, { color: colors.textMuted }]}>
                        Elige cómo se ve la aplicación.
                    </Text>

                    <ScrollView style={st.scrollArea} showsVerticalScrollIndicator={false}>
                        <View style={st.optionsContainer}>
                            {options.map((opt) => {
                                const isSelected = mode === opt.mode;
                                return (
                                    <TouchableOpacity
                                        key={opt.mode}
                                        style={[
                                            st.option,
                                            {
                                                borderColor: isSelected ? colors.primary : colors.border,
                                                backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                                            },
                                        ]}
                                        onPress={() => handleSelect(opt.mode)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={st.optionTop}>
                                            {opt.icon}
                                            {isSelected && <CheckIcon color={colors.primary} />}
                                        </View>
                                        <Text style={[st.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
                                        <Text style={[st.optionDesc, { color: colors.textMuted }]}>{opt.desc}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <TouchableOpacity style={[st.closeBtn, { backgroundColor: colors.primaryBg }]} onPress={onClose}>
                        <Text style={[st.closeBtnText, { color: colors.primary }]}>Cerrar</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const st = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    modal: {
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
        maxHeight: '85%',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
            android: { elevation: 12 },
            web: { boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.15)' as any },
        }),
    },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    subtitle: { fontSize: 14, marginBottom: 20 },
    scrollArea: { flexGrow: 0 },
    optionsContainer: { gap: 10 },
    option: {
        borderRadius: 12, borderWidth: 2, padding: 16,
    },
    optionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    optionLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    optionDesc: { fontSize: 13 },
    closeBtn: { marginTop: 16, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    closeBtnText: { fontSize: 15, fontWeight: '600' },
});

export default ThemeSelector;