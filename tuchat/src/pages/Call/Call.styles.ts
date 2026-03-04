import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a' 
  },
  
  mainVideo: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  
  webLocalVideo: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' as any 
  },
  
  nativeLocalVideo: { 
    flex: 1 
  },
  
  noVideoPlaceholder: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#1e293b'
  },
  
  placeholderText: { 
    fontSize: 64, 
    marginBottom: 10 
  },
  
  placeholderSubtext: { 
    color: '#64748b', 
    fontSize: 14 
  },
  
  // --- Participantes remotos ---
  participantsStrip: { 
    position: 'absolute', 
    top: 20, 
    left: 0, 
    right: 0, 
    height: 120,
    paddingHorizontal: 10
  },
  
  participantBox: { 
    width: 100, 
    height: 100, 
    backgroundColor: '#1e293b', 
    marginHorizontal: 5, 
    borderRadius: 12, 
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155'
  },
  
  participantVideo: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' as any 
  },
  
  // --- Overlay de estado ---
  statusOverlay: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 10
  },
  
  statusText: { 
    color: '#fff', 
    marginTop: 10, 
    fontSize: 16,
    fontWeight: '500'
  },
  
  // --- Barra de información ---
  infoBar: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  
  participantCount: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  
  // --- Controles ---
  controls: { 
    position: 'absolute', 
    bottom: 40, 
    width: '100%', 
    paddingHorizontal: 20
  },
  
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15
  },
  
  controlBtn: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  
  controlBtnDanger: { 
    backgroundColor: '#ef4444' 
  },
  
  controlBtnActive: { 
    backgroundColor: '#10b981' 
  },
  
  hangupBtn: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#ef4444', 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  
  btnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 12 
  }
});