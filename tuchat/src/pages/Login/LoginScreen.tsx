import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Animated,
  Keyboard,
  Dimensions
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { styles } from "./Login.styles";
import { useNavigation } from '@react-navigation/native';

const API_URL = "http://localhost:4000";

// Iconos SVG
const UserIcon = ({ focused }: { focused: boolean }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={focused ? "#2563EB" : "#94a3b8"} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </Svg>
);

const LockIcon = ({ focused }: { focused: boolean }) => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={focused ? "#2563EB" : "#94a3b8"} style={{ width: 20, height: 20 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </Svg>
);

const EyeIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#64748B" style={{ width: 22, height: 22 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </Svg>
);

const EyeSlashIcon = () => (
  <Svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#64748B" style={{ width: 22, height: 22 }}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </Svg>
);

export default function LoginScreen() {
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));

  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputScaleUser = useRef(new Animated.Value(1)).current;
  const inputScalePass = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });

    // Animaciones de entrada 
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    return () => subscription?.remove();
  }, []);

  const isDesktop = dimensions.width >= 1024;
  const isTablet = dimensions.width >= 768 && dimensions.width < 1024;
  const isMobile = dimensions.width < 768;

  const handleLogin = async () => {
    console.log("BOTÓN PULSADO");
    Keyboard.dismiss();

    if (!identificador || !password) {
      Alert.alert("Campos requeridos", "Por favor, introduce tu CIAL/DNI y contraseña");
      return;
    }

    // Animación sutil del botón
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      setLoading(true);
      const { data } = await axios.post(`${API_URL}/auth/login`, {
        identificador: identificador.trim().toUpperCase(),
        password: password
      });

      if (data.ok) {
        // Guardar token y datos de usuario
        if (Platform.OS === 'web') {
          localStorage.setItem("token", data.token);
          localStorage.setItem("usuario", JSON.stringify(data.usuario));
        } else {
          await SecureStore.setItemAsync("token", data.token);
          await SecureStore.setItemAsync("usuario", JSON.stringify(data.usuario));
        }

        // REDIRECCIÓN SEGÚN ROL
        if (data.usuario.id_rol === 7) {
          console.log("[Login] Usuario ADMIN detectado → /admin");
          setTimeout(() => router.replace("/admin" as any), 100);
        } else {
          console.log("[Login] Usuario normal → /");
          setTimeout(() => router.replace("/" as any), 100);
        }
      }
    } catch (err: any) {
      Alert.alert("Error de autenticación", "Las credenciales ingresadas son incorrectas");
    } finally {
      setLoading(false);
    }
  };

  const handleInputFocus = (inputName: string, scaleAnim: Animated.Value) => {
    setFocusedInput(inputName);
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleInputBlur = (scaleAnim: Animated.Value) => {
    setFocusedInput(null);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const getContainerStyle = () => {
    if (isDesktop) {
      return [styles.formContainer, styles.formContainerDesktop];
    } else if (isTablet) {
      return [styles.formContainer, styles.formContainerTablet];
    }
    return styles.formContainer;
  };

  const getLogoSize = () => {
    if (isDesktop) return styles.logoDesktop;
    if (isTablet) return styles.logoTablet;
    return styles.logo;
  };

  return (
    <View style={styles.container}>
      {/* Diseño profesional de gobierno */}
      <View style={styles.headerBar}>
        <View style={styles.headerBarStripe} />
      </View>

      {/* Fondo con patrón y degradado para todas las pantallas */}
      <View style={styles.mobileBackground}>
        <View style={styles.gradientOverlay} />
      </View>

      <Animated.View
        style={[
          styles.scrollContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
            isTablet && styles.scrollContentTablet
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[
            styles.contentWrapper,
            isDesktop && styles.contentWrapperDesktop,
            isTablet && styles.contentWrapperTablet
          ]}>
            {/* Logo institucional con fondo para móvil */}
            <Animated.View
              style={[
                styles.logoContainer,
                isMobile && styles.logoContainerMobile,
                {
                  transform: [{ scale: logoScale }]
                }
              ]}
            >
              <View style={[styles.logoWrapper, isMobile && styles.logoWrapperMobile]}>
                <Image
                  source={require("../../../assets/images/logo.png")}
                  style={getLogoSize()}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Título institucional */}
            <View style={styles.headerContainer}>
              <Text style={[
                styles.title,
                isDesktop && styles.titleDesktop,
                isTablet && styles.titleTablet
              ]}>
                TUCHAT
              </Text>
              <Text style={[
                styles.subtitle,
                isDesktop && styles.subtitleDesktop,
                isTablet && styles.subtitleTablet
              ]}>
                Sistema de Comunicación Institucional
              </Text>
            </View>

            {/* Formulario */}
            <View style={getContainerStyle()}>
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Iniciar Sesión</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CIAL/DNI</Text>
                  <Animated.View
                    style={{
                      transform: [{ scale: inputScaleUser }]
                    }}
                  >
                    <View style={[
                      styles.inputContainer,
                      focusedInput === 'user' && styles.inputContainerFocused
                    ]}>
                      <View style={styles.inputIcon}>
                        <UserIcon focused={focusedInput === 'user'} />
                      </View>
                      <TextInput
                        placeholder="Ingrese su CIAL o DNI"
                        placeholderTextColor="#94a3b8"
                        value={identificador}
                        onChangeText={setIdentificador}
                        style={styles.input}
                        autoCapitalize="none"
                        onFocus={() => handleInputFocus('user', inputScaleUser)}
                        onBlur={() => handleInputBlur(inputScaleUser)}
                      />
                    </View>
                  </Animated.View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contraseña</Text>
                  <Animated.View
                    style={{
                      transform: [{ scale: inputScalePass }]
                    }}
                  >
                    <View style={[
                      styles.inputContainer,
                      focusedInput === 'password' && styles.inputContainerFocused
                    ]}>
                      <View style={styles.inputIcon}>
                        <LockIcon focused={focusedInput === 'password'} />
                      </View>
                      <TextInput
                        placeholder="Ingrese su contraseña"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        style={[styles.input, { paddingRight: 50 }]}
                        onFocus={() => handleInputFocus('password', inputScalePass)}
                        onBlur={() => handleInputBlur(inputScalePass)}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                      >
                        {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </View>

                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <View style={styles.buttonContent}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={[styles.buttonText, { marginLeft: 12 }]}>
                          Verificando credenciales...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Acceder al Sistema</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Footer institucional */}
              <View style={styles.footer}>
                <View style={styles.footerBadge}>
                  <Text style={styles.footerBadgeText}>Conexión Segura</Text>
                </View>
                <Text style={styles.footerText}>
                  Ministerio de Educación
                </Text>
                <Text style={styles.footerSubtext}>
                  Sistema seguro de comunicación institucional
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Elementos decorativos de fondo para tablet */}
      {isTablet && (
        <>
          <View style={styles.tabletDecoration1} />
          <View style={styles.tabletDecoration2} />
        </>
      )}
    </View>
  );
}