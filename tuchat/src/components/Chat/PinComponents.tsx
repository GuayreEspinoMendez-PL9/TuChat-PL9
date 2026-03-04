import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback,
    ScrollView
} from 'react-native';
import { Pin, ChevronDown, ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

// 30 colores organizados en filas
const COLOR_PALETTE = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
    '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6',
    '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#FB7185', '#FDA4AF',
    '#FBBF24', '#A3E635', '#4ADE80', '#2DD4BF', '#38BDF8', '#818CF8',
    '#C084FC', '#F0ABFC', '#94A3B8', '#64748B', '#475569', '#1E293B',
];

const CATEGORIES = [
    { label: 'Tarea', icon: '📝' },
    { label: 'Exámen', icon: '📋' },
    { label: 'Salida', icon: '🚪' },
    { label: 'Aviso', icon: '⚠️' },
];

const DURATIONS = [
    { label: '24 horas', value: 24 * 60 * 60 * 1000 },
    { label: '7 días', value: 7 * 24 * 60 * 60 * 1000 },
    { label: '1 mes', value: 30 * 24 * 60 * 60 * 1000 },
];

interface PinWizardModalProps {
    visible: boolean;
    messageToPin: any;
    onClose: () => void;
    onPin: (data: {
        messageId: string;
        duration: number;
        durationLabel: string;
        category: string;
        color: string;
    }) => void;
}

export const PinWizardModal: React.FC<PinWizardModalProps> = ({
    visible,
    messageToPin,
    onClose,
    onPin,
}) => {
    const { colors } = useTheme();
    const [step, setStep] = useState(1);
    const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
    const [selectedDurationLabel, setSelectedDurationLabel] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Tarea');
    const [selectedColor, setSelectedColor] = useState('#6366F1');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const resetAndClose = () => {
        setStep(1);
        setSelectedDuration(null);
        setSelectedDurationLabel('');
        setSelectedCategory('Tarea');
        setSelectedColor('#6366F1');
        setShowCategoryDropdown(false);
        setShowColorPicker(false);
        onClose();
    };

    const handlePin = () => {
        if (!messageToPin || !selectedDuration) return;
        onPin({
            messageId: messageToPin.msg_id,
            duration: selectedDuration,
            durationLabel: selectedDurationLabel,
            category: selectedCategory,
            color: selectedColor,
        });
        resetAndClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={resetAndClose}
        >
            <TouchableWithoutFeedback onPress={resetAndClose}>
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20,
                }}>
                    <TouchableWithoutFeedback onPress={() => {
                        setShowCategoryDropdown(false);
                        setShowColorPicker(false);
                    }}>
                        <View style={{
                            backgroundColor: colors.surface,
                            borderRadius: 20,
                            width: '100%',
                            maxWidth: 370,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.25,
                            shadowRadius: 20,
                            elevation: 15,
                        }}>
                            {/* ══════ HEADER ══════ */}
                            <View style={{
                                backgroundColor: '#F8FAFC',
                                padding: 20,
                                borderBottomWidth: 1,
                                borderBottomColor: '#E2E8F0',
                                alignItems: 'center',
                            }}>
                                <View style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 26,
                                    backgroundColor: '#EEF2FF',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                }}>
                                    <Pin size={26} color="#6366F1" fill="#6366F1" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', textAlign: 'center' }}>
                                    Fijar Mensaje
                                </Text>
                                <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 4 }}>
                                    {step === 1
                                        ? 'Selecciona la duración del mensaje fijado'
                                        : 'Elige la categoría y el color'}
                                </Text>
                                {/* Step indicator */}
                                <View style={{ flexDirection: 'row', marginTop: 12, gap: 6 }}>
                                    <View style={{
                                        width: 24, height: 4, borderRadius: 2,
                                        backgroundColor: '#6366F1',
                                    }} />
                                    <View style={{
                                        width: 24, height: 4, borderRadius: 2,
                                        backgroundColor: step === 2 ? '#6366F1' : '#E2E8F0',
                                    }} />
                                </View>
                            </View>

                            {/* ══════ STEP 1: DURATION ══════ */}
                            {step === 1 && (
                                <View style={{ padding: 20 }}>
                                    {DURATIONS.map((option, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 16,
                                                backgroundColor: selectedDuration === option.value ? '#EEF2FF' : '#F8FAFC',
                                                borderRadius: 12,
                                                marginBottom: 10,
                                                borderWidth: 2,
                                                borderColor: selectedDuration === option.value ? '#6366F1' : '#E2E8F0',
                                            }}
                                            onPress={() => {
                                                setSelectedDuration(option.value);
                                                setSelectedDurationLabel(option.label);
                                            }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{
                                                    fontSize: 16,
                                                    fontWeight: '600',
                                                    color: selectedDuration === option.value ? '#6366F1' : '#334155',
                                                }}>
                                                    {option.label}
                                                </Text>
                                            </View>
                                            <View style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                borderWidth: 2,
                                                borderColor: selectedDuration === option.value ? '#6366F1' : '#CBD5E1',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}>
                                                {selectedDuration === option.value && (
                                                    <View style={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: 6,
                                                        backgroundColor: '#6366F1',
                                                    }} />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* ══════ STEP 2: CATEGORY + COLOR ══════ */}
                            {step === 2 && (
                                <View style={{ padding: 20 }}>
                                    {/* Category Label */}
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Categoría
                                    </Text>

                                    {/* Category Dropdown + Color Square */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        {/* Dropdown Button */}
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowCategoryDropdown(!showCategoryDropdown);
                                                setShowColorPicker(false);
                                            }}
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: 14,
                                                backgroundColor: '#F8FAFC',
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                borderColor: showCategoryDropdown ? '#6366F1' : '#E2E8F0',
                                            }}
                                        >
                                            <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>
                                                {CATEGORIES.find(c => c.label === selectedCategory)?.icon} {selectedCategory}
                                            </Text>
                                            <ChevronDown
                                                size={20}
                                                color="#94A3B8"
                                                style={{ transform: [{ rotate: showCategoryDropdown ? '180deg' : '0deg' }] }}
                                            />
                                        </TouchableOpacity>

                                        {/* Color Square */}
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowColorPicker(!showColorPicker);
                                                setShowCategoryDropdown(false);
                                            }}
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                backgroundColor: selectedColor,
                                                borderWidth: 2,
                                                borderColor: showColorPicker ? '#1E293B' : '#E2E8F0',
                                                shadowColor: selectedColor,
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 4,
                                                elevation: 3,
                                            }}
                                        />
                                    </View>

                                    {/* Category Dropdown List */}
                                    {showCategoryDropdown && (
                                        <View style={{
                                            backgroundColor: 'white',
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#E2E8F0',
                                            marginBottom: 16,
                                            overflow: 'hidden',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 8,
                                            elevation: 5,
                                        }}>
                                            {CATEGORIES.map((cat, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => {
                                                        setSelectedCategory(cat.label);
                                                        setShowCategoryDropdown(false);
                                                    }}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        padding: 14,
                                                        backgroundColor: selectedCategory === cat.label ? '#EEF2FF' : 'white',
                                                        borderBottomWidth: idx < CATEGORIES.length - 1 ? 1 : 0,
                                                        borderBottomColor: '#F1F5F9',
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 18, marginRight: 10 }}>{cat.icon}</Text>
                                                    <Text style={{
                                                        fontSize: 15,
                                                        fontWeight: selectedCategory === cat.label ? '700' : '500',
                                                        color: selectedCategory === cat.label ? '#6366F1' : '#334155',
                                                    }}>
                                                        {cat.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Color Picker Grid */}
                                    {showColorPicker && (
                                        <View style={{
                                            backgroundColor: 'white',
                                            borderRadius: 16,
                                            padding: 16,
                                            borderWidth: 1,
                                            borderColor: '#E2E8F0',
                                            marginBottom: 16,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 8,
                                            elevation: 5,
                                        }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                Seleccionar color
                                            </Text>
                                            <View style={{
                                                flexDirection: 'row',
                                                flexWrap: 'wrap',
                                                gap: 8,
                                                justifyContent: 'center',
                                            }}>
                                                {COLOR_PALETTE.map((color, idx) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        onPress={() => {
                                                            setSelectedColor(color);
                                                            setShowColorPicker(false);
                                                        }}
                                                        style={{
                                                            width: 38,
                                                            height: 38,
                                                            borderRadius: 10,
                                                            backgroundColor: color,
                                                            borderWidth: selectedColor === color ? 3 : 0,
                                                            borderColor: '#1E293B',
                                                            shadowColor: color,
                                                            shadowOffset: { width: 0, height: 1 },
                                                            shadowOpacity: 0.3,
                                                            shadowRadius: 2,
                                                            elevation: 2,
                                                        }}
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Preview */}
                                    {!showCategoryDropdown && !showColorPicker && (
                                        <View style={{
                                            backgroundColor: '#F8FAFC',
                                            borderRadius: 12,
                                            padding: 14,
                                            borderLeftWidth: 4,
                                            borderLeftColor: selectedColor,
                                            marginTop: 4,
                                        }}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>
                                                Vista previa
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={{
                                                    width: 8, height: 8, borderRadius: 4,
                                                    backgroundColor: selectedColor,
                                                }} />
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                                                    {CATEGORIES.find(c => c.label === selectedCategory)?.icon} {selectedCategory}
                                                </Text>
                                                <Text style={{ fontSize: 13, color: '#64748B' }}>• {selectedDurationLabel}</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#475569', marginTop: 4 }} numberOfLines={1}>
                                                {messageToPin?.text || messageToPin?.contenido || 'Mensaje adjunto'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* ══════ FOOTER BUTTONS ══════ */}
                            <View style={{
                                flexDirection: 'row',
                                borderTopWidth: 1,
                                borderTopColor: '#E2E8F0',
                            }}>
                                {/* Left Button */}
                                <TouchableOpacity
                                    onPress={() => {
                                        if (step === 1) {
                                            resetAndClose();
                                        } else {
                                            setStep(1);
                                            setShowCategoryDropdown(false);
                                            setShowColorPicker(false);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'row',
                                        gap: 6,
                                        borderRightWidth: 1,
                                        borderRightColor: '#E2E8F0',
                                    }}
                                >
                                    {step === 2 && <ChevronLeft size={18} color="#64748B" />}
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#64748B' }}>
                                        {step === 1 ? 'Cancelar' : 'Anterior'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Right Button */}
                                <TouchableOpacity
                                    onPress={() => {
                                        if (step === 1) {
                                            if (selectedDuration) setStep(2);
                                        } else {
                                            handlePin();
                                        }
                                    }}
                                    disabled={step === 1 && !selectedDuration}
                                    style={{
                                        flex: 1,
                                        padding: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'row',
                                        gap: 6,
                                        backgroundColor: (step === 1 && !selectedDuration) ? '#F8FAFC' : '#6366F1',
                                        borderBottomRightRadius: 20,
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '700',
                                        color: (step === 1 && !selectedDuration) ? '#CBD5E1' : '#FFFFFF',
                                    }}>
                                        {step === 1 ? 'Siguiente' : '📌 Fijar'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

// ═══════════════════════════════════
// PINNED MESSAGES BANNER
// ═══════════════════════════════════

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

export const PinnedMessagesBanner: React.FC<PinnedBannerProps> = ({
    pinnedMessages,
    onPressBanner,
    expanded,
    onUnpin,
    esProfesor,
}) => {
    const { colors } = useTheme();
    if (pinnedMessages.length === 0) return null;

    const latestPin = pinnedMessages[0];

    const getTimeRemaining = (expiresAt: number) => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) return 'Expirado';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h restantes`;
        return `${hours}h restantes`;
    };

    return (
        <View>
            {/* Main Banner */}
            <TouchableOpacity
                onPress={onPressBanner}
                activeOpacity={0.8}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E2E8F0',
                    borderLeftWidth: 4,
                    borderLeftColor: latestPin.color,
                }}
            >
                <Pin size={16} color={latestPin.color} fill={latestPin.color} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{
                            backgroundColor: latestPin.color + '20',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                        }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: latestPin.color }}>
                                {latestPin.category}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>
                            {latestPin.senderName}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#334155', marginTop: 2 }} numberOfLines={1}>
                        {latestPin.text}
                    </Text>
                </View>
                <ChevronDown
                    size={18}
                    color="#94A3B8"
                    style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                />
            </TouchableOpacity>

            {/* Expanded List */}
            {expanded && (
                <View style={{
                    backgroundColor: colors.background,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}>
                    {pinnedMessages.map((pin, idx) => (
                        <View
                            key={pin.id}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderBottomWidth: idx < pinnedMessages.length - 1 ? 1 : 0,
                                borderBottomColor: '#E2E8F0',
                                borderLeftWidth: 3,
                                borderLeftColor: pin.color,
                            }}
                        >
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: pin.color,
                                marginRight: 12,
                            }} />
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>
                                        {pin.category}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                        • {pin.senderName}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 13, color: '#475569' }} numberOfLines={2}>
                                    {pin.text}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                                    ⏱ {getTimeRemaining(pin.expiresAt)}
                                </Text>
                            </View>
                            {esProfesor && onUnpin && (
                                <TouchableOpacity
                                    onPress={() => onUnpin(pin.msgId)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={{
                                        padding: 6,
                                        backgroundColor: '#FEE2E2',
                                        borderRadius: 8,
                                    }}
                                >
                                    <X size={14} color="#EF4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};