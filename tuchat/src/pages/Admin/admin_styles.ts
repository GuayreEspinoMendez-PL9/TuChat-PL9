import { StyleSheet, Platform } from 'react-native';

export const adminStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 3 }, web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.04)' } as any }),
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '500', color: '#94A3B8', marginTop: 1 },

  tabBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', maxHeight: 50 },
  tabBarContent: { paddingHorizontal: 8, gap: 0, alignItems: 'center' },
  tabItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 5 },
  tabItemActive: { borderBottomColor: '#2563EB' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  tabLabelActive: { color: '#2563EB' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  statCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, width: '47%' as any, borderLeftWidth: 3,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 }, android: { elevation: 1 }, web: { boxShadow: '0px 1px 4px rgba(0,0,0,0.03)' } as any }),
  },
  statValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase' as any, letterSpacing: 0.4 },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  cardRowTitle: { fontSize: 13, fontWeight: '600', color: '#334155' },
  cardRowSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  searchInput: { paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  listCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 10,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3 }, android: { elevation: 1 }, web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.02)' } as any }),
  },
  listAvatar: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  listAvatarText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  listName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  listSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, fontWeight: '500', paddingVertical: 40 },
  errorText: { textAlign: 'center', color: '#DC2626', fontSize: 13, fontWeight: '500', paddingVertical: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '85%',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 16 }, android: { elevation: 16 } }),
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },

  // Form
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 5 },
  formInput: {
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0F172A', fontWeight: '500',
  },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 12, marginTop: 10, gap: 6 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // Pick list (scrollable selector)
  pickList: { maxHeight: 140, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10 },
  pickItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', backgroundColor: '#FFF' },
  pickItemSel: { backgroundColor: '#EFF6FF' },
  pickText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  pickTextSel: { fontWeight: '700', color: '#2563EB' },
});