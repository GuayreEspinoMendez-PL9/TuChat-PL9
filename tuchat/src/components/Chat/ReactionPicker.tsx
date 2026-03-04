import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    ZoomIn,
    FadeIn
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

const EMOJIS = ['👍', '👎', '❤️', '✅', '🤔'];

interface ReactionPickerProps {
    onSelect: (emoji: string) => void;
    isMe: boolean;
}

const ReactionItem = ({ emoji, index, onSelect }: { emoji: string, index: number, onSelect: (e: string) => void }) => {
    const scale = useSharedValue(1);
    const backgroundColor = useSharedValue('transparent');

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: backgroundColor.value,
    }));

    const handleMouseEnter = () => {
        scale.value = withSpring(1.3); // "ligeramente más grande"
        backgroundColor.value = withTiming('#f1f5f9', { duration: 150 }); // "cambia de color el fondo"
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

export const ReactionPicker = ({ onSelect, isMe }: ReactionPickerProps) => {
    const { colors } = useTheme();
    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            style={{
                position: 'absolute',
                bottom: 35,
                [isMe ? 'right' : 'left']: -10,
                backgroundColor: colors.surface,
                borderRadius: 25,
                flexDirection: 'row',
                padding: 5,
                elevation: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                zIndex: 1000,
                minWidth: 180,
                justifyContent: 'space-around'
            }}
        >
            {EMOJIS.map((emoji, index) => (
                <ReactionItem key={emoji} emoji={emoji} index={index} onSelect={onSelect} />
            ))}
        </Animated.View>
    );
};