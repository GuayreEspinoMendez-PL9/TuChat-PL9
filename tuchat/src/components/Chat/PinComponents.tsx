import React, { useMemo, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const COLOR_PALETTE = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
    '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6',
    '#A855F7', '#D946EF', '#EC4899', '#F43F5E'
];

const CATEGORIES = [
    { label: 'Tarea', icon: 'notebook-edit-outline' },
    { label: 'Examen', icon: 'clipboard-text-outline' },
    { label: 'Salida', icon: 'door-open' },
    { label: 'Aviso', icon: 'alert-circle-outline' },
] as const;

const DURATIONS = [
    { label: '24 horas', value: 24 * 60 * 60 * 1000 },
    { label: '7 dias', value: 7 * 24 * 60 * 60 * 1000 },
    { label: '1 mes', value: 30 * 24 * 60 * 60 * 1000 },
    { label: 'Personalizada', value: 'custom' as const },
];

type DurationUnit = 'minutes' | 'hours' | 'days';

interface PinWizardModalProps {
    visible: boolean;
    messageToPin: any;
    onClose: () => void;
    onPin: (data: { messageId: string; duration: number; durationLabel: string; category: string; color: string }) => void;
}

const toCustomDuration = (raw: string, unit: DurationUnit) => {
    const amount = parseInt(raw, 10);
    if (!amount || amount < 1) return null;
    const unitMs = { minutes: 60000, hours: 3600000, days: 86400000 }[unit];
    const unitLabel = {
        minutes: amount === 1 ? 'minuto' : 'minutos',
        hours: amount === 1 ? 'hora' : 'horas',
        days: amount === 1 ? 'dia' : 'dias',
    }[unit];
    return { value: amount * unitMs, label: `${amount} ${unitLabel}` };
};

// Modal para configurar el pin de un mensaje
export const PinWizardModal: React.FC<PinWizardModalProps> = ({ visible, messageToPin, onClose, onPin }) => {
    const { colors } = useTheme();
    const accent = colors.primary;

    const [step, setStep] = useState(1);
    const [selectedDurationOption, setSelectedDurationOption] = useState<number | 'custom' | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
    const [selectedDurationLabel, setSelectedDurationLabel] = useState('');
    const [customAmount, setCustomAmount] = useState('');
    const [customUnit, setCustomUnit] = useState<DurationUnit>('hours');
    const [selectedCategory, setSelectedCategory] = useState('Tarea');
    const [selectedColor, setSelectedColor] = useState('#6366F1');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const customData = useMemo(() => toCustomDuration(customAmount, customUnit), [customAmount, customUnit]);
    const canContinue = selectedDuration !== null;
    const selectedCategoryMeta = CATEGORIES.find((c) => c.label === selectedCategory) || CATEGORIES[0];

    const resetAndClose = () => {
        setStep(1);
        setSelectedDurationOption(null);
        setSelectedDuration(null);
        setSelectedDurationLabel('');
        setCustomAmount('');
        setCustomUnit('hours');
        setSelectedCategory('Tarea');
        setSelectedColor('#6366F1');
        setShowCategoryDropdown(false);
        setShowColorPicker(false);
        onClose();
    };

    const selectDuration = (value: number | 'custom', label?: string) => {
        setSelectedDurationOption(value);
        if (value === 'custom') {
            if (customData) {
                setSelectedDuration(customData.value);
                setSelectedDurationLabel(customData.label);
            } else {
                setSelectedDuration(null);
                setSelectedDurationLabel('');
            }
            return;
        }
        setSelectedDuration(value);
        setSelectedDurationLabel(label || '');
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
            <TouchableWithoutFeedback onPress={resetAndClose}>
                <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <TouchableWithoutFeedback onPress={() => { setShowCategoryDropdown(false); setShowColorPicker(false); }}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 20, width: '100%', maxWidth: 370, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                            <View style={{ backgroundColor: colors.background, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }}>
                                <MaterialCommunityIcons name="pin" size={28} color={accent} />
                                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>Fijar Mensaje</Text>
                                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{step === 1 ? 'Selecciona la duracion' : 'Categoria y color'}</Text>
                            </View>

                            {step === 1 && (
                                <View style={{ padding: 16, gap: 8 }}>
                                    {DURATIONS.map((d) => {
                                        const active = selectedDurationOption === d.value;
                                        return (
                                            <TouchableOpacity
                                                key={d.label}
                                                onPress={() => selectDuration(d.value, d.label)}
                                                style={{
                                                    padding: 14,
                                                    borderRadius: 12,
                                                    borderWidth: 1,
                                                    borderColor: active ? accent : colors.border,
                                                    backgroundColor: active ? colors.primaryBg : colors.background
                                                }}
                                            >
                                                <Text style={{ color: active ? accent : colors.textPrimary, fontWeight: '600' }}>{d.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}

                                    {selectedDurationOption === 'custom' && (
                                        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 8, backgroundColor: colors.background }}>
                                            <TextInput
                                                value={customAmount}
                                                placeholder="Cantidad"
                                                placeholderTextColor={colors.placeholder}
                                                keyboardType="numeric"
                                                onChangeText={(raw) => {
                                                    const digits = raw.replace(/[^0-9]/g, '');
                                                    setCustomAmount(digits);
                                                    const next = toCustomDuration(digits, customUnit);
                                                    setSelectedDuration(next ? next.value : null);
                                                    setSelectedDurationLabel(next ? next.label : '');
                                                }}
                                                style={{
                                                    borderWidth: 1,
                                                    borderColor: colors.inputBorder,
                                                    borderRadius: 10,
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 8,
                                                    backgroundColor: colors.inputBg,
                                                    color: colors.inputText
                                                }}
                                            />
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {([{ unit: 'minutes', label: 'Min' }, { unit: 'hours', label: 'Horas' }, { unit: 'days', label: 'Dias' }] as const).map(({ unit, label }) => {
                                                    const active = customUnit === unit;
                                                    return (
                                                        <TouchableOpacity
                                                            key={unit}
                                                            onPress={() => {
                                                                setCustomUnit(unit);
                                                                const next = toCustomDuration(customAmount, unit);
                                                                setSelectedDuration(next ? next.value : null);
                                                                setSelectedDurationLabel(next ? next.label : '');
                                                            }}
                                                            style={{
                                                                flex: 1,
                                                                alignItems: 'center',
                                                                paddingVertical: 8,
                                                                borderWidth: 1,
                                                                borderColor: active ? accent : colors.inputBorder,
                                                                borderRadius: 10,
                                                                backgroundColor: active ? colors.primaryBg : colors.surface
                                                            }}
                                                        >
                                                            <Text style={{ color: active ? accent : colors.textSecondary, fontWeight: '600' }}>{label}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                            {!!customData && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Se fijara por {customData.label}</Text>}
                                        </View>
                                    )}
                                </View>
                            )}

                            {step === 2 && (
                                <View style={{ padding: 16, gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowColorPicker(false); }}
                                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.background }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <MaterialCommunityIcons name={selectedCategoryMeta.icon} size={18} color={colors.textPrimary} />
                                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{selectedCategory}</Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                                    </TouchableOpacity>

                                    {showCategoryDropdown && CATEGORIES.map((cat) => (
                                        <TouchableOpacity
                                            key={cat.label}
                                            onPress={() => { setSelectedCategory(cat.label); setShowCategoryDropdown(false); }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: selectedCategory === cat.label ? colors.primaryBg : colors.background }}
                                        >
                                            <MaterialCommunityIcons name={cat.icon} size={18} color={selectedCategory === cat.label ? accent : colors.textSecondary} />
                                            <Text style={{ fontWeight: selectedCategory === cat.label ? '700' : '500', color: selectedCategory === cat.label ? accent : colors.textPrimary }}>{cat.label}</Text>
                                        </TouchableOpacity>
                                    ))}

                                    <TouchableOpacity onPress={() => { setShowColorPicker(!showColorPicker); setShowCategoryDropdown(false); }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: selectedColor, borderWidth: 2, borderColor: colors.border, alignSelf: 'flex-end' }} />

                                    {showColorPicker && (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: colors.background, borderRadius: 10, padding: 8 }}>
                                            {COLOR_PALETTE.map((c) => (
                                                <TouchableOpacity key={c} onPress={() => { setSelectedColor(c); setShowColorPicker(false); }} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c, borderWidth: selectedColor === c ? 2 : 0, borderColor: colors.textPrimary }} />
                                            ))}
                                        </View>
                                    )}

                                    <View style={{ borderLeftWidth: 4, borderLeftColor: selectedColor, backgroundColor: colors.background, borderRadius: 10, padding: 10 }}>
                                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{selectedCategory} - {selectedDurationLabel}</Text>
                                        <Text numberOfLines={1} style={{ color: colors.textSecondary }}>{messageToPin?.text || messageToPin?.contenido || 'Mensaje adjunto'}</Text>
                                    </View>
                                </View>
                            )}

                            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
                                <TouchableOpacity onPress={() => (step === 1 ? resetAndClose() : setStep(1))} style={{ flex: 1, padding: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border }}>
                                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{step === 1 ? 'Cancelar' : 'Anterior'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={!canContinue && step === 1}
                                    onPress={() => {
                                        if (step === 1) return canContinue ? setStep(2) : undefined;
                                        if (!messageToPin || !selectedDuration) return;
                                        onPin({ messageId: messageToPin.msg_id, duration: selectedDuration, durationLabel: selectedDurationLabel, category: selectedCategory, color: selectedColor });
                                        resetAndClose();
                                    }}
                                    style={{ flex: 1, padding: 14, alignItems: 'center', backgroundColor: (!canContinue && step === 1) ? colors.background : accent }}
                                >
                                    <Text style={{ color: (!canContinue && step === 1) ? colors.textMuted : colors.textOnPrimary, fontWeight: '700' }}>{step === 1 ? 'Siguiente' : 'Fijar'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

interface PinnedMessage {
    id: string;
    msgId: string;
    text: string;
    senderName: string;
    category: string;
    color: string;
    duration: number;
    durationLabel: string;
    pinnedAt: number;
    expiresAt: number;
}

interface PinnedBannerProps {
    pinnedMessages: PinnedMessage[];
    onPressBanner: () => void;
    expanded: boolean;
    onUnpin?: (msgId: string) => void;
    esProfesor: boolean;
}

export const PinnedMessagesBanner: React.FC<PinnedBannerProps> = ({ pinnedMessages, onPressBanner, expanded, onUnpin, esProfesor }) => {
    const { colors } = useTheme();
    if (!pinnedMessages.length) return null;

    const latestPin = pinnedMessages[0];

    const getTimeRemaining = (expiresAt: number) => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) return 'Expirado';
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(h / 24);
        return d > 0 ? `${d}d ${h % 24}h restantes` : `${h}h restantes`;
    };

    return (
        <View>
            <TouchableOpacity
                onPress={onPressBanner}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, borderLeftWidth: 4, borderLeftColor: latestPin.color }}
            >
                <MaterialCommunityIcons name="pin" size={16} color={latestPin.color} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: latestPin.color + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: latestPin.color }}>{latestPin.category}</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>{latestPin.senderName}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 2 }} numberOfLines={1}>{latestPin.text}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {expanded && (
                <View style={{ backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    {pinnedMessages.map((pin, idx) => (
                        <View key={pin.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: idx < pinnedMessages.length - 1 ? 1 : 0, borderBottomColor: colors.border, borderLeftWidth: 3, borderLeftColor: pin.color }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pin.color, marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{pin.category}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted }}>- {pin.senderName}</Text>
                                </View>
                                <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={2}>{pin.text}</Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{getTimeRemaining(pin.expiresAt)}</Text>
                            </View>
                            {esProfesor && onUnpin && (
                                <TouchableOpacity onPress={() => onUnpin(pin.msgId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 6, backgroundColor: colors.dangerBg, borderRadius: 8 }}>
                                    <Ionicons name="close" size={14} color={colors.danger} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};
