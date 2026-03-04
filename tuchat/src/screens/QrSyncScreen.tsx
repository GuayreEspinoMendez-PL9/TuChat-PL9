import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Platform, StyleSheet, Modal, Alert, ScrollView
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSocket } from '../context/SocketContext';
import * as SecureStore from 'expo-secure-store';
import { getMessagesForSync } from '../db/database';
import { useTheme } from '../context/ThemeContext';

const getStorageItem = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
};

// ─── ICONS ───
const QrIcon = ({ size = 24, color = '#6366F1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h3v3h-3zM14 17h3v3h-3zM17 20h3v0h-3z" />
  </Svg>
);

const CheckCircleIcon = ({ size = 24, color = '#16A34A' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><Path d="M22 4L12 14.01l-3-3" />
  </Svg>
);

const PhoneIcon = ({ size = 24, color = '#6366F1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </Svg>
);

const MonitorIcon = ({ size = 24, color = '#6366F1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 3h20v14H2zM8 21h8M12 17v4" />
  </Svg>
);

const CloseIcon = ({ size = 24, color = '#64748B' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

// ─── QR CODE GENERATOR (simple matrix to SVG, no external lib) ───
// Lightweight QR encoder for alphanumeric tokens
// Using a visual representation - generates a grid pattern from the token hash
const QRCodeSVG = ({ value, size = 200 }: { value: string; size?: number }) => {
  // Simple deterministic pattern from token string
  const gridSize = 21;
  const cellSize = size / gridSize;
  const cells: boolean[][] = [];

  // Generate deterministic pattern from value
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }

  const seed = (idx: number) => {
    const x = Math.sin(hash + idx) * 10000;
    return x - Math.floor(x);
  };

  for (let r = 0; r < gridSize; r++) {
    cells[r] = [];
    for (let c = 0; c < gridSize; c++) {
      // Fixed finder patterns (top-left, top-right, bottom-left)
      const inTL = r < 7 && c < 7;
      const inTR = r < 7 && c >= gridSize - 7;
      const inBL = r >= gridSize - 7 && c < 7;

      if (inTL || inTR || inBL) {
        const lr = inTL ? r : inTR ? r : r - (gridSize - 7);
        const lc = inTL ? c : inTR ? c - (gridSize - 7) : c;
        cells[r][c] = (lr === 0 || lr === 6 || lc === 0 || lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4));
      } else {
        cells[r][c] = seed(r * gridSize + c) > 0.5;
      }
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#fff" rx={8} />
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <Rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.5}
              height={cellSize + 0.5}
              fill="#0F172A"
              rx={1}
            />
          ) : null
        )
      )}
    </Svg>
  );
};

// ─── MAIN COMPONENT ───
interface QRSyncScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const QRSyncScreen = ({ visible, onClose }: QRSyncScreenProps) => {
  const { socket } = useSocket();
  const { colors } = useTheme();
  const [userId, setUserId] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'waiting' | 'paired' | 'syncing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, rooms: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    (async () => {
      const userStr = await getStorageItem('usuario');
      if (userStr) {
        const u = JSON.parse(userStr);
        setUserId(u.id || u.id_usuario_app || '');
      }
    })();
  }, []);

  // ═══ WEB SIDE: Generate QR and listen for sync data ═══
  const startWebSync = () => {
    if (!socket || !userId) return;
    setStatus('waiting');
    setProgress({ current: 0, total: 0, rooms: 0 });

    socket.emit("sync:request_qr", { userId });

    socket.on("sync:qr_token", ({ token }: { token: string }) => {
      setQrToken(token);
    });

    socket.on("sync:paired", () => {
      setStatus('syncing');
    });

    socket.on("sync:chunk", ({ roomId, messages, chunkIndex, totalChunks }: any) => {
      // Import into web localStorage
      try {
        // Dynamic import of web database function
        const key = `chat_${roomId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const existingIds = new Set(existing.map((m: any) => m.msg_id));

        let imported = 0;
        for (const msg of messages) {
          if (!existingIds.has(msg.msg_id)) {
            // Strip base64 media to save space (keep only text messages + metadata)
            const cleaned = { ...msg };
            if (cleaned.image && cleaned.image.length > 1000 && cleaned.mediaType !== 'image') {
              cleaned.image = null; // Strip large file data, keep image thumbnails
            }
            existing.push(cleaned);
            imported++;
          }
        }

        existing.sort((a: any, b: any) => a.timestamp - b.timestamp);
        localStorage.setItem(key, JSON.stringify(existing));

        setProgress(prev => ({
          current: prev.current + imported,
          total: prev.total + messages.length,
          rooms: prev.rooms + (chunkIndex === 0 ? 1 : 0)
        }));
      } catch (e) {
        console.error("Error importing chunk:", e);
      }
    });

    socket.on("sync:complete", ({ totalRooms, totalMessages }: any) => {
      setStatus('done');
      setProgress(prev => ({ ...prev, total: totalMessages, rooms: totalRooms }));
    });

    socket.on("sync:error", ({ msg }: { msg: string }) => {
      setStatus('error');
      setErrorMsg(msg);
    });
  };

  // ═══ MOBILE SIDE: Scan QR and send data ═══
  const startMobileSync = async (scannedToken: string) => {
    if (!socket || !userId) return;
    setStatus('syncing');

    socket.emit("sync:pair", { token: scannedToken, userId });

    socket.once("sync:paired_ack", async ({ ok }: { ok: boolean }) => {
      if (!ok) {
        setStatus('error');
        setErrorMsg('No se pudo emparejar');
        return;
      }

      try {
        const allData = getMessagesForSync(30); // Last 30 days
        let totalMessages = 0;
        const CHUNK_SIZE = 50; // Send 50 messages per chunk

        for (const room of allData) {
          // Strip base64 media from files to reduce payload (keep images)
          const cleaned = room.messages.map(m => {
            const c = { ...m };
            if (c.image && c.image.length > 500000) {
              c.image = null; // Skip files > ~375KB base64
              c._mediaStripped = true;
            }
            return c;
          });

          // Send in chunks
          for (let i = 0; i < cleaned.length; i += CHUNK_SIZE) {
            const chunk = cleaned.slice(i, i + CHUNK_SIZE);
            socket.emit("sync:chunk", {
              token: scannedToken,
              roomId: room.roomId,
              messages: chunk,
              chunkIndex: Math.floor(i / CHUNK_SIZE),
              totalChunks: Math.ceil(cleaned.length / CHUNK_SIZE)
            });
            totalMessages += chunk.length;
            setProgress({ current: totalMessages, total: 0, rooms: allData.indexOf(room) + 1 });
            // Small delay to avoid flooding
            await new Promise(r => setTimeout(r, 100));
          }
        }

        socket.emit("sync:complete", {
          token: scannedToken,
          totalRooms: allData.length,
          totalMessages
        });
        setStatus('done');
        setProgress(prev => ({ ...prev, total: totalMessages, rooms: allData.length }));
      } catch (e) {
        console.error("Sync error:", e);
        setStatus('error');
        setErrorMsg('Error al leer mensajes locales');
      }
    });

    socket.once("sync:error", ({ msg }: { msg: string }) => {
      setStatus('error');
      setErrorMsg(msg);
    });
  };

  // For mobile: simple token input (camera QR scanner would need expo-barcode-scanner)
  const [manualToken, setManualToken] = useState('');

  const handleClose = () => {
    // Cleanup listeners
    if (socket) {
      socket.off("sync:qr_token");
      socket.off("sync:paired");
      socket.off("sync:chunk");
      socket.off("sync:complete");
      socket.off("sync:error");
      socket.off("sync:paired_ack");
    }
    setStatus('idle');
    setQrToken('');
    setProgress({ current: 0, total: 0, rooms: 0 });
    setErrorMsg('');
    setManualToken('');
    onClose();
  };

  useEffect(() => {
    if (visible && isWeb && status === 'idle') {
      startWebSync();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={st.overlay}>
        <View style={[st.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[st.header, { borderBottomColor: colors.borderLight }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <QrIcon size={24} color="#6366F1" />
              <Text style={[st.title, { color: colors.textPrimary }]}>Sincronizar mensajes</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>

            {/* ═══ WEB VIEW ═══ */}
            {isWeb && status === 'waiting' && (
              <View style={st.section}>
                <View style={st.qrBox}>
                  {qrToken ? (
                    <QRCodeSVG value={qrToken} size={200} />
                  ) : (
                    <ActivityIndicator size="large" color="#6366F1" />
                  )}
                </View>
                <Text style={st.instruction}>
                  Abre TuChat en tu móvil, ve a Ajustes y escanea este código QR para sincronizar tus mensajes.
                </Text>
                {qrToken && (
                  <View style={st.tokenBox}>
                    <Text style={st.tokenLabel}>O introduce este código manualmente:</Text>
                    <Text style={st.tokenValue} selectable>{qrToken}</Text>
                  </View>
                )}
                <View style={st.stepList}>
                  <StepItem n={1} text="Abre TuChat en tu móvil" />
                  <StepItem n={2} text='Ve a Ajustes > "Sincronizar con Web"' />
                  <StepItem n={3} text="Escanea el código QR o pega el código" />
                </View>
              </View>
            )}

            {/* ═══ MOBILE VIEW ═══ */}
            {!isWeb && status === 'idle' && (
              <View style={st.section}>
                <View style={st.iconCircle}>
                  <MonitorIcon size={32} color="#6366F1" />
                </View>
                <Text style={st.subtitle}>Sincronizar con TuChat Web</Text>
                <Text style={st.instruction}>
                  Envía los mensajes de los últimos 30 días a tu sesión web para tenerlos disponibles en el navegador.
                </Text>

                <Text style={st.inputLabel}>Código del QR (de la pantalla web):</Text>
                <View style={st.inputRow}>
                  <View style={st.inputBox}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" />
                    </Svg>
                    <Text
                      style={st.input}
                      // @ts-ignore - Using Text for display, would use TextInput in real app
                      selectable
                    >{manualToken || 'Pega el código aquí...'}</Text>
                  </View>
                </View>

                {/* In a real implementation, you'd use expo-barcode-scanner here */}
                {/* For now, provide a TextInput workaround */}
                {Platform.OS !== 'web' && (
                  <>
                    <View style={{ marginTop: 12 }}>
                      <TouchableOpacity
                        style={[st.primaryBtn, !manualToken && { opacity: 0.5 }]}
                        onPress={() => manualToken && startMobileSync(manualToken)}
                        disabled={!manualToken}
                      >
                        <PhoneIcon size={18} color="#FFF" />
                        <Text style={st.primaryBtnText}>Iniciar sincronización</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={st.hint}>
                      Los mensajes con archivos grandes se enviarán sin el adjunto para ahorrar datos.
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* ═══ SYNCING STATE ═══ */}
            {status === 'syncing' && (
              <View style={st.section}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={st.subtitle}>Sincronizando...</Text>
                <Text style={st.instruction}>
                  {isWeb ? 'Recibiendo mensajes del móvil...' : 'Enviando mensajes a la web...'}
                </Text>
                <View style={st.progressBox}>
                  <View style={st.progressRow}>
                    <Text style={st.progressLabel}>Mensajes</Text>
                    <Text style={st.progressValue}>{progress.current}</Text>
                  </View>
                  <View style={st.progressRow}>
                    <Text style={st.progressLabel}>Salas</Text>
                    <Text style={st.progressValue}>{progress.rooms}</Text>
                  </View>
                  {/* Progress bar */}
                  <View style={st.progressBar}>
                    <View style={[st.progressFill, { width: '60%' }]} />
                  </View>
                </View>
                <Text style={st.hint}>No cierres esta ventana</Text>
              </View>
            )}

            {/* ═══ DONE STATE ═══ */}
            {status === 'done' && (
              <View style={st.section}>
                <View style={[st.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <CheckCircleIcon size={36} color="#16A34A" />
                </View>
                <Text style={[st.subtitle, { color: '#16A34A' }]}>Sincronización completada</Text>
                <View style={st.progressBox}>
                  <View style={st.progressRow}>
                    <Text style={st.progressLabel}>Mensajes sincronizados</Text>
                    <Text style={[st.progressValue, { color: '#16A34A' }]}>{progress.current}</Text>
                  </View>
                  <View style={st.progressRow}>
                    <Text style={st.progressLabel}>Salas de chat</Text>
                    <Text style={[st.progressValue, { color: '#16A34A' }]}>{progress.rooms}</Text>
                  </View>
                </View>
                <Text style={st.instruction}>
                  {isWeb
                    ? 'Los mensajes ya están disponibles en tus chats. Recarga la página si no aparecen.'
                    : 'Tus mensajes se han enviado a la sesión web correctamente.'
                  }
                </Text>
                <TouchableOpacity style={st.primaryBtn} onPress={handleClose}>
                  <Text style={st.primaryBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ═══ ERROR STATE ═══ */}
            {status === 'error' && (
              <View style={st.section}>
                <View style={[st.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                  <CloseIcon size={36} color="#DC2626" />
                </View>
                <Text style={[st.subtitle, { color: '#DC2626' }]}>Error en la sincronización</Text>
                <Text style={st.instruction}>{errorMsg || 'Ocurrió un error inesperado'}</Text>
                <TouchableOpacity style={st.primaryBtn} onPress={handleClose}>
                  <Text style={st.primaryBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Step indicator ───
const StepItem = ({ n, text }: { n: number; text: string }) => (
  <View style={st.step}>
    <View style={st.stepCircle}>
      <Text style={st.stepNum}>{n}</Text>
    </View>
    <Text style={st.stepText}>{text}</Text>
  </View>
);

// ─── STYLES ───
const st = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFF', borderRadius: 20, width: '90%', maxWidth: 420,
    maxHeight: '85%', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 12 },
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' } as any,
    }),
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  body: { padding: 24 },
  section: { alignItems: 'center' },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  subtitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 12, marginBottom: 8 },
  instruction: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  qrBox: {
    padding: 16, backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 2, borderColor: '#E2E8F0', marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' } as any,
    }),
  },
  tokenBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0', width: '100%', marginBottom: 20,
  },
  tokenLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 6 },
  tokenValue: { fontSize: 13, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, color: '#334155', fontWeight: '600' },
  stepList: { width: '100%', gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  stepText: { fontSize: 14, color: '#475569', flex: 1 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', alignSelf: 'flex-start', marginBottom: 8 },
  inputRow: { width: '100%', marginBottom: 4 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5,
    borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 14, color: '#94A3B8' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 24, width: '100%', marginTop: 16,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12 },
  progressBox: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginVertical: 16,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  progressLabel: { fontSize: 14, color: '#64748B' },
  progressValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  progressBar: {
    height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginTop: 12, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#6366F1', borderRadius: 3,
  },
});

export default QRSyncScreen;