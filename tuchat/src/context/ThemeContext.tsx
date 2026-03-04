import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============ PALETAS DE COLORES ============

const lightColors = {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceHover: '#f8fafc',
    card: '#ffffff',
    primary: '#6366f1',
    primaryLight: '#a5b4fc',
    primaryBg: '#eef2ff',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    textOnPrimary: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    danger: '#ef4444',
    dangerBg: '#fef2f2',
    success: '#10b981',
    successBg: '#ecfdf5',
    bubbleOwn: '#6366f1',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#f1f5f9',
    bubbleOtherText: '#1e293b',
    inputBg: '#ffffff',
    inputBorder: '#e2e8f0',
    inputText: '#1e293b',
    placeholder: '#94a3b8',
    badgeBg: '#6366f1',
    badgeText: '#ffffff',
    tabInactive: '#64748b',
    tabActive: '#6366f1',
    tabBorder: '#e2e8f0',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#cbd5e1',
    switchTrackOn: '#a5b4fc',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#6366f1',
};

const darkColors = {
    background: '#0f172a',
    surface: '#1e293b',
    surfaceHover: '#334155',
    card: '#1e293b',
    primary: '#818cf8',
    primaryLight: '#6366f1',
    primaryBg: '#1e1b4b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textOnPrimary: '#ffffff',
    border: '#334155',
    borderLight: '#1e293b',
    danger: '#f87171',
    dangerBg: '#450a0a',
    success: '#34d399',
    successBg: '#064e3b',
    bubbleOwn: '#6366f1',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#334155',
    bubbleOtherText: '#f1f5f9',
    inputBg: '#1e293b',
    inputBorder: '#334155',
    inputText: '#f1f5f9',
    placeholder: '#64748b',
    badgeBg: '#818cf8',
    badgeText: '#ffffff',
    tabInactive: '#64748b',
    tabActive: '#818cf8',
    tabBorder: '#334155',
    overlay: 'rgba(0,0,0,0.6)',
    switchTrackOff: '#475569',
    switchTrackOn: '#6366f1',
    switchThumbOff: '#94a3b8',
    switchThumbOn: '#818cf8',
};

const greenColors = {
    background: '#f0fdf4',
    surface: '#ffffff',
    surfaceHover: '#f0fdf4',
    card: '#ffffff',
    primary: '#16a34a',
    primaryLight: '#4ade80',
    primaryBg: '#dcfce7',
    textPrimary: '#14532d',
    textSecondary: '#3f6212',
    textMuted: '#65a30d',
    textOnPrimary: '#ffffff',
    border: '#bbf7d0',
    borderLight: '#dcfce7',
    danger: '#ef4444',
    dangerBg: '#fef2f2',
    success: '#16a34a',
    successBg: '#dcfce7',
    bubbleOwn: '#16a34a',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#dcfce7',
    bubbleOtherText: '#14532d',
    inputBg: '#ffffff',
    inputBorder: '#bbf7d0',
    inputText: '#14532d',
    placeholder: '#86efac',
    badgeBg: '#16a34a',
    badgeText: '#ffffff',
    tabInactive: '#3f6212',
    tabActive: '#16a34a',
    tabBorder: '#bbf7d0',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#bbf7d0',
    switchTrackOn: '#4ade80',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#16a34a',
};

const redColors = {
    background: '#fef2f2',
    surface: '#ffffff',
    surfaceHover: '#fef2f2',
    card: '#ffffff',
    primary: '#dc2626',
    primaryLight: '#f87171',
    primaryBg: '#fee2e2',
    textPrimary: '#450a0a',
    textSecondary: '#7f1d1d',
    textMuted: '#b91c1c',
    textOnPrimary: '#ffffff',
    border: '#fecaca',
    borderLight: '#fee2e2',
    danger: '#dc2626',
    dangerBg: '#fee2e2',
    success: '#16a34a',
    successBg: '#dcfce7',
    bubbleOwn: '#dc2626',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#fee2e2',
    bubbleOtherText: '#450a0a',
    inputBg: '#ffffff',
    inputBorder: '#fecaca',
    inputText: '#450a0a',
    placeholder: '#fca5a5',
    badgeBg: '#dc2626',
    badgeText: '#ffffff',
    tabInactive: '#7f1d1d',
    tabActive: '#dc2626',
    tabBorder: '#fecaca',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#fecaca',
    switchTrackOn: '#f87171',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#dc2626',
};

const yellowColors = {
    background: '#fefce8',
    surface: '#ffffff',
    surfaceHover: '#fefce8',
    card: '#ffffff',
    primary: '#ca8a04',
    primaryLight: '#facc15',
    primaryBg: '#fef9c3',
    textPrimary: '#422006',
    textSecondary: '#713f12',
    textMuted: '#a16207',
    textOnPrimary: '#ffffff',
    border: '#fde68a',
    borderLight: '#fef9c3',
    danger: '#ef4444',
    dangerBg: '#fef2f2',
    success: '#16a34a',
    successBg: '#dcfce7',
    bubbleOwn: '#ca8a04',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#fef9c3',
    bubbleOtherText: '#422006',
    inputBg: '#ffffff',
    inputBorder: '#fde68a',
    inputText: '#422006',
    placeholder: '#fcd34d',
    badgeBg: '#ca8a04',
    badgeText: '#ffffff',
    tabInactive: '#713f12',
    tabActive: '#ca8a04',
    tabBorder: '#fde68a',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#fde68a',
    switchTrackOn: '#facc15',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#ca8a04',
};

// ============ MAPA DE TEMAS ============

const themeColorMap: Record<string, ThemeColors> = {
    light: lightColors,
    dark: darkColors,
    green: greenColors,
    red: redColors,
    yellow: yellowColors,
};

// ============ TIPOS ============

export type ThemeMode = 'light' | 'dark' | 'system' | 'green' | 'red' | 'yellow';
export type ThemeColors = typeof lightColors;

interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    colors: ThemeColors;
    isDark: boolean;
}

// ============ CONTEXTO ============

const STORAGE_KEY = '@tuchat_theme';

const ThemeContext = createContext<ThemeContextType>({
    mode: 'system',
    setMode: () => { },
    colors: lightColors,
    isDark: false,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemScheme = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
            if (saved && isValidThemeMode(saved)) {
                setModeState(saved as ThemeMode);
            }
            setLoaded(true);
        });
    }, []);

    const setMode = (newMode: ThemeMode) => {
        setModeState(newMode);
        AsyncStorage.setItem(STORAGE_KEY, newMode);
    };

    const isDark = useMemo(() => {
        if (mode === 'system') return systemScheme === 'dark';
        return mode === 'dark';
    }, [mode, systemScheme]);

    const colors = useMemo(() => {
        if (mode === 'system') {
            return systemScheme === 'dark' ? darkColors : lightColors;
        }
        return themeColorMap[mode] || lightColors;
    }, [mode, systemScheme]);

    const value = useMemo(() => ({ mode, setMode, colors, isDark }), [mode, colors, isDark]);

    if (!loaded) return null;

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

function isValidThemeMode(value: string): value is ThemeMode {
    return ['light', 'dark', 'system', 'green', 'red', 'yellow'].includes(value);
}

export { lightColors, darkColors, greenColors, redColors, yellowColors, themeColorMap };