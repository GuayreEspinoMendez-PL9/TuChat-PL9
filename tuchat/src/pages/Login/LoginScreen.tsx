import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
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

const API_URL = "https://tuchat-pl9.onrender.com";
const HOVER_GRID_COLUMNS = 10;
const HOVER_GRID_TILES = Array.from({ length: HOVER_GRID_COLUMNS * HOVER_GRID_COLUMNS }, (_, index) => index);

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

const buildTileShadow = () => {
  const parts: string[] = [];
  const gap = 48;
  const coef = -4.5;

  for (let i = 1; i <= 4; i += 1) {
    parts.push(`${i * gap}px 0 0 ${i * coef}px rgba(169, 201, 255, 0.95)`);
    parts.push(`${i * -gap}px 0 0 ${i * coef}px rgba(169, 201, 255, 0.95)`);
    parts.push(`0 ${i * gap}px 0 ${i * coef}px rgba(169, 201, 255, 0.95)`);
    parts.push(`0 ${i * -gap}px 0 ${i * coef}px rgba(169, 201, 255, 0.95)`);

    for (let j = 1; j <= 4; j += 1) {
      const spread = i * j * 1.5 * coef;
      parts.push(`${i * gap}px ${j * gap}px 0 ${spread}px rgba(169, 201, 255, 0.9)`);
      parts.push(`${i * gap}px ${j * -gap}px 0 ${spread}px rgba(169, 201, 255, 0.9)`);
      parts.push(`${i * -gap}px ${j * gap}px 0 ${spread}px rgba(169, 201, 255, 0.9)`);
      parts.push(`${i * -gap}px ${j * -gap}px 0 ${spread}px rgba(169, 201, 255, 0.9)`);
    }
  }

  return parts.join(", ");
};

const TILE_SHADOW = buildTileShadow();

function WebHoverBackground() {
  const [activeTile, setActiveTile] = useState<number | null>(null);

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "linear-gradient(180deg, #A9C9FF 0%, #D7DFFF 52%, #EAF4FF 100%)",
  };

  const gridStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
    gridTemplateRows: "repeat(10, 1fr)",
  };

  const tileStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  };

  const dotStyle: React.CSSProperties = {
    width: "5px",
    height: "5px",
    borderRadius: "999px",
    background: "#A9C9FF",
    transition: "all 500ms linear",
    pointerEvents: "none",
  };

  const activeDotStyle: React.CSSProperties = {
    width: "48px",
    height: "48px",
    transition: "all 70ms linear",
    boxShadow: TILE_SHADOW,
  };

  return (
    <div style={layerStyle}>
      <div style={gridStyle}>
        {HOVER_GRID_TILES.map((tile) => (
          <a
            key={tile}
            href="#"
            aria-hidden="true"
            onClick={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveTile(tile)}
            onMouseLeave={() => setActiveTile((current) => (current === tile ? null : current))}
            style={tileStyle}
          >
            <span style={activeTile === tile ? { ...dotStyle, ...activeDotStyle } : dotStyle} />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function LoginScreen() {
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  const [fieldErrors, setFieldErrors] = useState<{ identificador?: string; password?: string }>({});
  const [loginError, setLoginError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputScaleUser = useRef(new Animated.Value(1)).current;
  const inputScalePass = useRef(new Animated.Value(1)).current;
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });

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

    return () => {
      subscription?.remove();
    };
  }, []);

  const isDesktop = dimensions.width >= 1024;
  const isTablet = dimensions.width >= 768 && dimensions.width < 1024;
  const isMobile = dimensions.width < 768;

  const handleLogin = async () => {
    Keyboard.dismiss();

    const errors: { identificador?: string; password?: string } = {};
    if (!identificador.trim()) errors.identificador = "Introduce tu CIAL o DNI.";
    if (!password.trim()) errors.password = "Introduce tu contraseña.";
    setFieldErrors(errors);
    setLoginError(null);
    if (Object.keys(errors).length > 0) return;

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
        password,
      });

      if (data.ok) {
        if (Platform.OS === "web") {
          localStorage.setItem("token", data.token);
          localStorage.setItem("usuario", JSON.stringify(data.usuario));
        } else {
          await SecureStore.setItemAsync("token", data.token);
          await SecureStore.setItemAsync("usuario", JSON.stringify(data.usuario));
        }

        if (data.usuario.id_rol === 7) {
          setTimeout(() => router.replace("/admin" as any), 100);
        } else {
          setTimeout(() => router.replace("/" as any), 100);
        }
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (!err?.response) {
        setLoginError("No pudimos conectarnos. Revisa tu conexion e intentalo de nuevo.");
      } else if (status === 401 || status === 403) {
        setLoginError("Las credenciales no coinciden. Revisa CIAL/DNI y contraseña.");
      } else if (status >= 500) {
        setLoginError("El servidor esta teniendo problemas. Intentalo en unos minutos.");
      } else {
        setLoginError(err?.response?.data?.msg || "No pudimos iniciar sesion. Vuelve a intentarlo.");
      }
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
    if (isDesktop) return [styles.formContainer, styles.formContainerDesktop];
    if (isTablet) return [styles.formContainer, styles.formContainerTablet];
    return styles.formContainer;
  };

  const getLogoSize = () => {
    if (isDesktop) return styles.logoDesktop;
    if (isTablet) return styles.logoTablet;
    return styles.logo;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <View style={styles.headerBarStripe} />
      </View>

      {Platform.OS === "web" ? (
        <WebHoverBackground />
      ) : (
        <View style={styles.mobileBackground}>
          <View style={styles.gradientOverlay} />
        </View>
      )}

      <Animated.View
        pointerEvents={Platform.OS === "web" ? "box-none" : "auto"}
        style={[
          styles.scrollContainer,
          Platform.OS === "web" && styles.scrollContainerWeb,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <ScrollView
          pointerEvents={Platform.OS === "web" ? "box-none" : "auto"}
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
            Platform.OS === "web" && styles.contentWrapperWeb,
            isDesktop && styles.contentWrapperDesktop,
            isTablet && styles.contentWrapperTablet
          ]}>
            <Animated.View
              style={[
                styles.logoContainer,
                isMobile && styles.logoContainerMobile,
                { transform: [{ scale: logoScale }] }
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
                Sistema de Comunicacion Institucional
              </Text>
            </View>

            <View style={getContainerStyle()}>
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Iniciar sesion</Text>
                {loginError ? (
                  <View style={styles.formErrorBanner}>
                    <Text style={styles.formErrorText}>{loginError}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CIAL/DNI</Text>
                  <Animated.View style={{ transform: [{ scale: inputScaleUser }] }}>
                    <View style={[
                      styles.inputContainer,
                      focusedInput === "user" && styles.inputContainerFocused,
                      fieldErrors.identificador && styles.inputContainerError
                    ]}>
                      <View style={styles.inputIcon}>
                        <UserIcon focused={focusedInput === "user"} />
                      </View>
                      <TextInput
                        placeholder="Ingrese su CIAL o DNI"
                        placeholderTextColor="#94a3b8"
                        value={identificador}
                        onChangeText={(value) => {
                          setIdentificador(value);
                          if (fieldErrors.identificador) setFieldErrors((prev) => ({ ...prev, identificador: undefined }));
                          if (loginError) setLoginError(null);
                        }}
                        style={styles.input}
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                        onFocus={() => handleInputFocus("user", inputScaleUser)}
                        onBlur={() => handleInputBlur(inputScaleUser)}
                      />
                    </View>
                    {fieldErrors.identificador ? <Text style={styles.inlineErrorText}>{fieldErrors.identificador}</Text> : null}
                  </Animated.View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contraseña</Text>
                  <Animated.View style={{ transform: [{ scale: inputScalePass }] }}>
                    <View style={[
                      styles.inputContainer,
                      focusedInput === "password" && styles.inputContainerFocused,
                      fieldErrors.password && styles.inputContainerError
                    ]}>
                      <View style={styles.inputIcon}>
                        <LockIcon focused={focusedInput === "password"} />
                      </View>
                      <TextInput
                        ref={passwordInputRef}
                        placeholder="Ingrese su contraseña"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={(value) => {
                          setPassword(value);
                          if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                          if (loginError) setLoginError(null);
                        }}
                        secureTextEntry={!showPassword}
                        style={[styles.input, { paddingRight: 50 }]}
                        returnKeyType="go"
                        onSubmitEditing={handleLogin}
                        onFocus={() => handleInputFocus("password", inputScalePass)}
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
                    {fieldErrors.password ? <Text style={styles.inlineErrorText}>{fieldErrors.password}</Text> : null}
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
                      <Text style={styles.buttonText}>Acceder al sistema</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.footer}>
                <View style={styles.footerBadge}>
                  <Text style={styles.footerBadgeText}>Conexion segura</Text>
                </View>
                <Text style={styles.footerText}>
                  Ministerio de Educacion
                </Text>
                <Text style={styles.footerSubtext}>
                  Sistema seguro de comunicacion institucional
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {isTablet && (
        <>
          <View style={styles.tabletDecoration1} />
          <View style={styles.tabletDecoration2} />
        </>
      )}
    </View>
  );
}
