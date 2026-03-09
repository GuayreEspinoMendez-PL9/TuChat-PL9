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
    background: '#f5fbf7',
    surface: '#ffffff',
    surfaceHover: '#edf8f0',
    card: '#ffffff',
    primary: '#2f9e63',
    primaryLight: '#6bcf9a',
    primaryBg: '#e8f7ee',
    textPrimary: '#133727',
    textSecondary: '#2b5a44',
    textMuted: '#5d7d6e',
    textOnPrimary: '#ffffff',
    border: '#d2eadb',
    borderLight: '#e8f4ee',
    danger: '#d75a5a',
    dangerBg: '#fff2f1',
    success: '#2f9e63',
    successBg: '#e8f7ee',
    bubbleOwn: '#2f9e63',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#eff8f2',
    bubbleOtherText: '#133727',
    inputBg: '#ffffff',
    inputBorder: '#d2eadb',
    inputText: '#133727',
    placeholder: '#8ba999',
    badgeBg: '#2f9e63',
    badgeText: '#ffffff',
    tabInactive: '#507363',
    tabActive: '#2f9e63',
    tabBorder: '#d2eadb',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#d2eadb',
    switchTrackOn: '#6bcf9a',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#2f9e63',
};

const redColors = {
    background: '#fff7f6',
    surface: '#ffffff',
    surfaceHover: '#fff1ee',
    card: '#ffffff',
    primary: '#c65b4b',
    primaryLight: '#e38c7e',
    primaryBg: '#fcebe8',
    textPrimary: '#4a1f1a',
    textSecondary: '#6b342d',
    textMuted: '#97625a',
    textOnPrimary: '#ffffff',
    border: '#f3d1ca',
    borderLight: '#fbe6e2',
    danger: '#d64545',
    dangerBg: '#fee9e7',
    success: '#2f9e63',
    successBg: '#e8f7ee',
    bubbleOwn: '#c65b4b',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#fdf0ee',
    bubbleOtherText: '#4a1f1a',
    inputBg: '#ffffff',
    inputBorder: '#f3d1ca',
    inputText: '#4a1f1a',
    placeholder: '#d2a49c',
    badgeBg: '#c65b4b',
    badgeText: '#ffffff',
    tabInactive: '#855047',
    tabActive: '#c65b4b',
    tabBorder: '#f3d1ca',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#f3d1ca',
    switchTrackOn: '#e38c7e',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#c65b4b',
};

const yellowColors = {
    background: '#fffdf5',
    surface: '#ffffff',
    surfaceHover: '#fcf6e8',
    card: '#ffffff',
    primary: '#b8892c',
    primaryLight: '#dfbe72',
    primaryBg: '#f9efd7',
    textPrimary: '#4a3713',
    textSecondary: '#6b5428',
    textMuted: '#92764a',
    textOnPrimary: '#ffffff',
    border: '#f2dfb6',
    borderLight: '#f9efd7',
    danger: '#d75a5a',
    dangerBg: '#fff2f1',
    success: '#2f9e63',
    successBg: '#e8f7ee',
    bubbleOwn: '#b8892c',
    bubbleOwnText: '#ffffff',
    bubbleOther: '#fbf2df',
    bubbleOtherText: '#4a3713',
    inputBg: '#ffffff',
    inputBorder: '#f2dfb6',
    inputText: '#4a3713',
    placeholder: '#c8ad77',
    badgeBg: '#b8892c',
    badgeText: '#ffffff',
    tabInactive: '#8a7044',
    tabActive: '#b8892c',
    tabBorder: '#f2dfb6',
    overlay: 'rgba(0,0,0,0.3)',
    switchTrackOff: '#f2dfb6',
    switchTrackOn: '#dfbe72',
    switchThumbOff: '#f4f3f4',
    switchThumbOn: '#b8892c',
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
