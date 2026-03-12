import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
      }
    }),
  },

  backButton: {
    padding: 4,
    marginRight: 12,
  },

  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },

  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },

  iconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },

  // Lista de mensajes
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 8,
  },

  messageContainer: {
    marginBottom: 16,
    width: '100%',
  },

  myMessageContainer: {
    alignItems: 'flex-end',
  },

  theirMessageContainer: {
    alignItems: 'flex-start',
  },

  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    marginLeft: 12,
  },

  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 20, // Increased from 16
    paddingVertical: 12,   // Increased from 10
    maxWidth: '85%',       // Increased from 80%
    minWidth: 120,         // Ensure minimum width so time fits nicely
    flexShrink: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)',
        // ✅ TRUCO WEB: Evita que palabras súper largas rompan el diseño
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }
    }),
  },

  myMessage: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
  },

  theirMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  messageText: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.1,
    flexWrap: 'wrap',
  },

  myMessageText: {
    color: '#FFFFFF',
  },

  theirMessageText: {
    color: '#1E293B',
  },

  // ✅ NUEVO: Footer del mensaje (hora + ticks)
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginRight: -8, // Pulls time to the right into the padding
    marginBottom: -2, // Slight adjustment for bottom
    gap: 4,
    width: '100%',
  },

  messageTime: {
    fontSize: 11,
    fontWeight: '500',
  },

  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  theirMessageTime: {
    color: '#94A3B8',
  },

  // ✅ NUEVO: Wrapper para los ticks
  tickWrapper: {
    marginLeft: 4,
  },

  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },

  // ✅ NUEVO: Estilos para vídeo
  videoContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },

  videoPreview: {
    width: '100%',
    height: '100%',
  },

  videoPlayButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },

  videoPlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },

  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Input
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.05)',
      }
    }),
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 52,
  },

  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    textAlignVertical: 'center',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      }
    }),
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(99, 102, 241, 0.3)',
        cursor: 'pointer' as any,
      }
    }),
  },

  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
    opacity: 0.5,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.1)',
        cursor: 'not-allowed' as any,
      }
    }),
  },

  // ✅ NUEVO: Estilos para input deshabilitado (permisos)
  inputDisabledContainer: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },

  inputDisabledText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
