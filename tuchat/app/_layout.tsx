import { Slot, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { SocketProvider } from "../src/context/SocketContext";
import { ThemeProvider } from "../src/context/ThemeContext";
import { decodeJwt } from "../src/utils/auth";

const ADMIN_ROL_ID = 7;

const getUserIdFromToken = (token: string) => {
  const decoded = decodeJwt(token);
  return decoded ? decoded.sub : null;
};

/**
 * Obtiene los datos del usuario guardados en storage
 */
const getStoredUser = async () => {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = localStorage.getItem("usuario");
    } else {
      raw = await SecureStore.getItemAsync("usuario");
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const segments = useSegments();

  const checkAuth = async () => {
    try {
      let token = Platform.OS === 'web'
        ? localStorage.getItem("token")
        : await SecureStore.getItemAsync("token");

      if (token) {
        setHasToken(true);

        // Detectar si es admin por los datos guardados O por el JWT
        const user = await getStoredUser();
        const payload = decodeJwt(token);

        const userIsAdmin = user?.id_rol === ADMIN_ROL_ID || payload?.rol === ADMIN_ROL_ID;
        setIsAdmin(userIsAdmin);
      } else {
        setHasToken(false);
        setIsAdmin(false);
      }
    } catch (e) {
      setHasToken(false);
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => { checkAuth(); }, [segments]);

  useEffect(() => {
    if (!ready) return;
    const currentSegments = segments as string[];
    const inAuthGroup = currentSegments[0] === "login";
    const inAdminPage = currentSegments[0] === "admin";

    // 1. Sin token → mandar a login
    if (!hasToken && !inAuthGroup) {
      router.replace("/login");
      return;
    }

    // 2. Con token en login → redirigir según rol
    if (hasToken && inAuthGroup) {
      if (isAdmin) {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
      return;
    }

    // 3. No-admin intentando entrar a /admin → mandar a home
    if (hasToken && inAdminPage && !isAdmin) {
      router.replace("/");
      return;
    }

  }, [ready, hasToken, isAdmin, segments]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleNotificationOpenRoom = () => {
      if (!hasToken) return;
      const currentSegments = segments as string[];
      const onHome = currentSegments.length === 0 || currentSegments[0] === '(tabs)' || currentSegments[0] === 'index';
      if (!onHome) {
        router.replace('/' as any);
      }
    };

    window.addEventListener('tuchat:notification-open-room', handleNotificationOpenRoom as EventListener);
    return () => {
      window.removeEventListener('tuchat:notification-open-room', handleNotificationOpenRoom as EventListener);
    };
  }, [hasToken, segments]);

  if (!ready) return null;

  // Envolver con ThemeProvider y SocketProvider
  return (
    <ThemeProvider>
      <SocketProvider>
        <Slot />
      </SocketProvider>
    </ThemeProvider>
  );
}
