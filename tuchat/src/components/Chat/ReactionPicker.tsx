import React from 'react';
import { Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    ZoomIn,
    FadeIn
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🎉', '🤔'];

interface ReactionPickerProps {
    onSelect: (emoji: string) => void;
    isMe: boolean;
    emojis?: string[];
}

const ReactionItem = ({
    emoji,
    index,
    onSelect,
    hoverColor
}: {
    emoji: string;
    index: number;
    onSelect: (e: string) => void;
    hoverColor: string;
}) => {
    const scale = useSharedValue(1);
    const backgroundColor = useSharedValue('transparent');

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: backgroundColor.value,
    }));

    const handleMouseEnter = () => {
        scale.value = withSpring(1.3); // "ligeramente más grande"
        backgroundColor.value = withTiming(hoverColor, { duration: 150 }); // "cambia de color el fondo"
    };

    const handleMouseLeave = () => {
        scale.value = withSpring(1);
        backgroundColor.value = withTiming('transparent', { duration: 150 });
    };

    return (
        <Animated.View
            entering={ZoomIn.delay(index * 60).springify().damping(12).stiffness(200)} // "aparecen 1 a uno... se inflan un poco más"
            style={[{ borderRadius: 20, padding: 4 }, animatedStyle]}
        >
            <TouchableOpacity
                onPress={() => onSelect(emoji)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                {...(Platform.OS === 'web' ? {
                    onMouseEnter: handleMouseEnter,
                    onMouseLeave: handleMouseLeave
                } : {})}
            >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
        </Animated.View >
    );
};

export const ReactionPicker = ({ onSelect, isMe, emojis }: ReactionPickerProps) => {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const pickerEmojis = (emojis && emojis.length > 0 ? emojis : DEFAULT_EMOJIS).slice(0, 8);
    const isCompact = width < 420;
    const horizontalOffset = isCompact ? 0 : -10;

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            style={{
                position: 'absolute',
                bottom: 35,
                [isMe ? 'right' : 'left']: horizontalOffset,
                backgroundColor: colors.surface,
                borderRadius: 25,
                flexDirection: 'row',
                flexWrap: isCompact ? 'wrap' : 'nowrap',
                paddingVertical: 5,
                paddingHorizontal: isCompact ? 8 : 5,
                borderWidth: 1,
                borderColor: colors.border,
                elevation: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                zIndex: 1000,
                minWidth: isCompact ? 140 : 180,
                maxWidth: Math.min(width - 24, 320),
                justifyContent: 'space-around',
            }}
        >
            {pickerEmojis.map((emoji, index) => (
                <ReactionItem
                    key={`${emoji}-${index}`}
                    emoji={emoji}
                    index={index}
                    onSelect={onSelect}
                    hoverColor={colors.surfaceHover}
                />
            ))}
        </Animated.View>
    );
};
