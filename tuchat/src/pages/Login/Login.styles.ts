import { StyleSheet, Platform } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    position: 'relative',
  },

  // Barra superior institucional
  headerBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#0F172A',
    zIndex: 10,
  },

  headerBarStripe: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2563EB',
  },

  // Fondo degradado para todas las pantallas
  mobileBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#EFF6FF',
    zIndex: 0,
  },

  webEffectBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 0,
  },

  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        background: 'linear-gradient(180deg, #A9C9FF 0%, #D7DFFF 52%, #EAF4FF 100%)',
      } as any,
      ios: {
        backgroundColor: '#EFF6FF',
      },
      android: {
        backgroundColor: '#EFF6FF',
      }
    }),
  },

  // Decoraciones para tablet
  tabletDecoration1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#DBEAFE',
    opacity: 0.3,
    zIndex: 0,
  },

  tabletDecoration2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#BFDBFE',
    opacity: 0.25,
    zIndex: 0,
  },
  
  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },

  scrollContainerWeb: {
    pointerEvents: 'box-none',
  },
  
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    minHeight: '100%',
  },

  scrollContentTablet: {
    paddingHorizontal: 60,
    paddingVertical: 60,
  },

  scrollContentDesktop: {
    paddingHorizontal: 80,
    paddingVertical: 80,
  },

  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 480,
    alignSelf: 'center',
  },

  contentWrapperWeb: {
    pointerEvents: 'auto',
    zIndex: 2,
  },

  contentWrapperTablet: {
    maxWidth: 600,
  },

  contentWrapperDesktop: {
    maxWidth: 520,
  },
  
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },

  logoContainerMobile: {
    marginBottom: 32,
  },

  logoWrapper: {
    padding: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0px 20px 60px rgba(15, 23, 42, 0.12)",
        backdropFilter: "blur(10px)",
      }
    }),
  },

  logoWrapperFallbackGlow: {
    position: 'absolute',
    top: -30,
    right: -22,
    bottom: -24,
    left: -22,
    borderRadius: 40,
    backgroundColor: 'rgba(191, 219, 254, 0.3)',
  },

  webEffectPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    ...Platform.select({
      web: {
        backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.24) 1px, transparent 1px)',
        backgroundSize: '42px 42px',
        backgroundPosition: 'center center',
      } as any,
    }),
  },

  webEffectGlow: {
    position: 'absolute',
    top: -180,
    right: -180,
    bottom: -180,
    left: -180,
    opacity: 1,
    ...Platform.select({
      web: {
        transition: 'background-image 90ms linear',
        willChange: 'background-image',
      } as any,
    }),
  },

  logoWrapperMobile: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0px 8px 32px rgba(37, 99, 235, 0.2)",
      }
    }),
  },
  
  logo: {
    width: 100,
    height: 100,
  },

  logoTablet: {
    width: 120,
    height: 120,
  },

  logoDesktop: {
    width: 130,
    height: 130,
  },

  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },

  titleTablet: {
    fontSize: 32,
  },

  titleDesktop: {
    fontSize: 36,
  },

  subtitle: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  subtitleTablet: {
    fontSize: 15,
    lineHeight: 22,
  },

  subtitleDesktop: {
    fontSize: 16,
    lineHeight: 24,
  },
  
  formContainer: {
    width: '100%',
  },

  formContainerTablet: {
    paddingHorizontal: 20,
  },

  formContainerDesktop: {
    paddingHorizontal: 0,
  },

  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0px 30px 90px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(16px)",
      }
    }),
  },

  formCardFallbackGlow: {
    position: 'absolute',
    top: -40,
    right: -24,
    bottom: -36,
    left: -24,
    borderRadius: 30,
    backgroundColor: 'rgba(219, 234, 254, 0.38)',
  },

  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 24,
    textAlign: 'center',
  },

  inputGroup: {
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 2,
  },

  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)",
      }
    }),
  },

  inputContainerFocused: {
    borderColor: "#2563EB",
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0px 4px 16px rgba(37, 99, 235, 0.25)",
      }
    }),
  },

  inputContainerError: {
    borderColor: "#DC2626",
  },

  inputIcon: {
    paddingLeft: 15,
    paddingRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingRight: 15,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      }
    }),
  },

  eyeButton: {
    position: 'absolute',
    right: 15,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: '100%',
  },
  inlineErrorText: {
    marginTop: 6,
    marginLeft: 4,
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "500",
  },
  formErrorBanner: {
    marginBottom: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0px 4px 16px rgba(37, 99, 235, 0.35)",
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
      }
    }),
  },
  
  buttonDisabled: {
    backgroundColor: "#94A3B8",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0px 2px 8px rgba(148, 163, 184, 0.2)",
      }
    }),
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  footerBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },

  footerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },

  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },

  footerSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
