import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput, Alert,
  ActivityIndicator, ScrollView, Modal, Platform, RefreshControl, Switch
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { adminStyles as S } from './admin_styles';
import { router } from 'expo-router';
import WizardClase from './WizardClase';

const API = "https://tuchat-pl9.onrender.com";

// ─── ICONS (SVG path-based) ─────────────────────────────────
const I = ({ d, size = 20, color = '#64748B' }: { d: string; size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>
);
const IC = {
  home: (c?: string) => <I d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" color={c||'#64748B'} />,
  building: (c?: string) => <I d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" color={c||'#64748B'} />,
  users: (c?: string) => <I d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" color={c||'#64748B'} />,
  calendar: (c?: string) => <I d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" color={c||'#64748B'} />,
  layers: (c?: string) => <I d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" color={c||'#64748B'} />,
  book: (c?: string) => <I d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" color={c||'#64748B'} />,
  grid: (c?: string) => <I d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" color={c||'#64748B'} />,
  school: (c?: string) => <I d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20m0 0V4a1 1 0 00-1-1H6.5A2.5 2.5 0 004 5.5V19" color={c||'#64748B'} />,
  clip: (c?: string) => <I d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" color={c||'#64748B'} />,
  link: (c?: string) => <I d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" color={c||'#64748B'} />,
  shield: (c?: string) => <I d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" color={c||'#64748B'} />,
  chat: (c?: string) => <I d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" color={c||'#64748B'} />,
  log: (c?: string) => <I d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" color={c||'#64748B'} />,
  plus: (c?: string) => <I d="M12 4v16m8-8H4" color={c||'#FFF'} size={18} />,
  edit: (c?: string) => <I d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" color={c||'#64748B'} size={16} />,
  trash: (c?: string) => <I d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" color={c||'#EF4444'} size={16} />,
  check: (c?: string) => <I d="M5 13l4 4L19 7" color={c||'#FFF'} size={16} />,
  x: (c?: string) => <I d="M6 18L18 6M6 6l12 12" color={c||'#94A3B8'} />,
  search: (c?: string) => <I d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" color={c||'#94A3B8'} size={18} />,
  logout: (c?: string) => <I d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" color={c||'#DC2626'} size={18} />,
  arrow_l: (c?: string) => <I d="M19 12H5m7-7l-7 7 7 7" color={c||'#64748B'} />,
  ban: (c?: string) => <I d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" color={c||'#EF4444'} size={16} />,
  ok: (c?: string) => <I d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" color={c||'#16A34A'} size={16} />,
  key: (c?: string) => <I d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" color={c||'#64748B'} size={16} />,
};

type BC = 'blue'|'green'|'red'|'purple'|'amber';
const Badge = ({children,color='blue'}:{children:React.ReactNode;color?:BC}) => {
  const m:Record<BC,{bg:string;fg:string}> = {blue:{bg:'#EFF6FF',fg:'#2563EB'},green:{bg:'#F0FDF4',fg:'#16A34A'},red:{bg:'#FEF2F2',fg:'#DC2626'},purple:{bg:'#FAF5FF',fg:'#7C3AED'},amber:{bg:'#FFFBEB',fg:'#D97706'}};
  const c=m[color]; return <View style={{backgroundColor:c.bg,paddingHorizontal:8,paddingVertical:3,borderRadius:6}}><Text style={{color:c.fg,fontSize:11,fontWeight:'700'}}>{children}</Text></View>;
};

const FF = ({label,value,onChangeText,placeholder,cap}:{label:string;value:string;onChangeText:(t:string)=>void;placeholder?:string;cap?:'none'|'characters'|'words'}) => (
  <View style={{marginBottom:14}}><Text style={S.fieldLabel}>{label}</Text><TextInput style={S.formInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#CBD5E1" autoCapitalize={cap||'none'}/></View>
);

// ─── SEARCHABLE DROPDOWN (Admin, no create) ──────────────
function SDrop({label,items,selectedId,onSelect,displayKey,idKey}:{label:string;items:any[];selectedId:string;onSelect:(id:string)=>void;displayKey:string|((i:any)=>string);idKey:string}){
  const [open,setOpen]=useState(false);const [q,setQ]=useState('');
  const gd=(i:any)=>typeof displayKey==='function'?displayKey(i):i[displayKey];
  const filtered=items.filter(i=>!q||gd(i).toLowerCase().includes(q.toLowerCase()));
  const sel=items.find(i=>i[idKey]===selectedId);
  return(
    <View style={{marginBottom:14}}>
      <Text style={S.fieldLabel}>{label}</Text>
      <TouchableOpacity onPress={()=>{setOpen(!open);setQ('')}} style={{flexDirection:'row',alignItems:'center',backgroundColor:'#F8FAFC',borderRadius:10,borderWidth:1.5,borderColor:open?'#2563EB':'#E2E8F0',paddingHorizontal:14,paddingVertical:12}}>
        <Text style={{flex:1,fontSize:14,color:sel?'#0F172A':'#94A3B8',fontWeight:sel?'600':'400'}}>{sel?gd(sel):'Seleccionar...'}</Text>
        <I d={open?"M5 15l7-7 7 7":"M19 9l-7 7-7-7"} color={open?'#2563EB':'#94A3B8'} size={16}/>
      </TouchableOpacity>
      {open&&(
        <View style={{borderWidth:1.5,borderColor:'#E2E8F0',borderRadius:12,marginTop:4,backgroundColor:'#FFF',overflow:'hidden',shadowColor:'#000',shadowOffset:{width:0,height:4},shadowOpacity:0.08,shadowRadius:12,elevation:4}}>
          <View style={{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#F1F5F9',paddingHorizontal:10,backgroundColor:'#FAFBFC'}}>
            {IC.search()}<TextInput style={{flex:1,paddingVertical:10,paddingHorizontal:6,fontSize:13,color:'#0F172A'}} placeholder="Buscar..." placeholderTextColor="#CBD5E1" value={q} onChangeText={setQ} autoFocus/>
          </View>
          <ScrollView nestedScrollEnabled style={{maxHeight:160}}>
            {filtered.map(item=>(
              <TouchableOpacity key={item[idKey]} onPress={()=>{onSelect(item[idKey]);setOpen(false)}}
                style={{paddingVertical:10,paddingHorizontal:14,backgroundColor:item[idKey]===selectedId?'#EFF6FF':'#FFF',borderBottomWidth:1,borderBottomColor:'#F8FAFC'}}>
                <Text style={{fontSize:13,fontWeight:item[idKey]===selectedId?'700':'500',color:item[idKey]===selectedId?'#2563EB':'#334155'}}>{gd(item)}</Text>
              </TouchableOpacity>
            ))}
            {filtered.length===0&&<Text style={{padding:14,color:'#94A3B8',fontSize:12,textAlign:'center'}}>Sin resultados</Text>}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── FILTER CHIP BAR ─────────────────────────────────────
function FilterBar({filters,active,onSelect}:{filters:{key:string;label:string}[];active:string;onSelect:(k:string)=>void}){
  return(
    <View style={{flexDirection:'row',flexGrow:0,flexShrink:0,paddingHorizontal:16,paddingVertical:8,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#F1F5F9',gap:6}}>
      {filters.map(f=>(
        <TouchableOpacity key={f.key} onPress={()=>onSelect(f.key)} style={[S.chipBtn,active===f.key&&S.chipBtnActive]}>
          <Text style={[S.chipText,active===f.key&&S.chipTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────
const getToken = async () => Platform.OS==='web'?localStorage.getItem('token'):await SecureStore.getItemAsync('token');
const api = async (path:string,opts:{method?:string;data?:any}={}) => {
  const t=await getToken(); const r=await axios({url:`${API}${path}`,method:opts.method||'GET',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},data:opts.data});return r.data;
};
const doLogout = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    } else {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('usuario');
    }
    router.replace('/login' as any);
  } catch (e) {
    console.error('Error al cerrar sesión:', e);
  }
};

// ─── MODAL DE CONFIRMACIÓN / ALERTA ─────────────────────────
type DialogState = {
  visible: boolean; title: string; msg: string;
  confirmLabel: string; confirmColor: string; onConfirm: (() => void) | null;
};
const _dialogListeners: ((s: DialogState) => void)[] = [];
const showDialog = (s: DialogState) => _dialogListeners.forEach(l => l(s));

function AppDialog() {
  const [state, setState] = React.useState<DialogState>({
    visible: false, title: '', msg: '', confirmLabel: 'Aceptar', confirmColor: '#2563EB', onConfirm: null
  });
  React.useEffect(() => {
    const handler = (s: DialogState) => setState(s);
    _dialogListeners.push(handler);
    return () => { const i = _dialogListeners.indexOf(handler); if (i > -1) _dialogListeners.splice(i, 1); };
  }, []);
  const close = () => setState(p => ({ ...p, visible: false }));
  const confirm = () => { close(); state.onConfirm?.(); };
  if (!state.visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:24 }}>
        <View style={{ backgroundColor:'#FFF', borderRadius:16, width:'100%', maxWidth:380, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.2, shadowRadius:20, elevation:10 }}>
          <View style={{ padding:24, paddingBottom:16 }}>
            <Text style={{ fontSize:17, fontWeight:'700', color:'#0F172A', marginBottom: state.msg ? 8 : 0 }}>{state.title}</Text>
            {!!state.msg && <Text style={{ fontSize:14, color:'#475569', lineHeight:20 }}>{state.msg}</Text>}
          </View>
          <View style={{ flexDirection:'row', borderTopWidth:1, borderTopColor:'#F1F5F9' }}>
            {state.onConfirm && (
              <TouchableOpacity onPress={close} style={{ flex:1, paddingVertical:14, alignItems:'center', borderRightWidth:1, borderRightColor:'#F1F5F9' }}>
                <Text style={{ fontSize:15, color:'#64748B', fontWeight:'500' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={confirm} style={{ flex:1, paddingVertical:14, alignItems:'center' }}>
              <Text style={{ fontSize:15, color:state.confirmColor, fontWeight:'700' }}>{state.confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const xAlert = (title: string, msg?: string) => {
  if (Platform.OS !== 'web') { Alert.alert(title, msg); return; }
  showDialog({ visible:true, title, msg:msg||'', confirmLabel:'Aceptar', confirmColor:'#2563EB', onConfirm:null });
};
const xConfirm = (title: string, msg: string, onConfirm: () => void, confirmLabel = 'Eliminar') => {
  if (Platform.OS !== 'web') {
    Alert.alert(title, msg, [{ text:'Cancelar', style:'cancel' }, { text:confirmLabel, style:'destructive', onPress:onConfirm }]);
    return;
  }
  showDialog({ visible:true, title, msg, confirmLabel, confirmColor:'#DC2626', onConfirm });
};

// ─── MAIN ────────────────────────────────────────────────────
export default function AdminScreen() {
  const [tab,setTab] = useState('dashboard');
  const [wizardOpen,setWizardOpen] = useState(false);
  const [wizardEditId,setWizardEditId] = useState<string|undefined>(undefined);

  if (wizardOpen) return <WizardClase onClose={()=>{setWizardOpen(false);setWizardEditId(undefined);setTab('clases')}} editClaseId={wizardEditId}/>;

  const tabs = [
    {id:'dashboard',label:'Inicio',icon:IC.home},
    {id:'centros',label:'Centros',icon:IC.building},
    {id:'personas',label:'Personas',icon:IC.users},
    {id:'cursos',label:'Cursos Esc.',icon:IC.calendar},
    {id:'planes',label:'Planes',icon:IC.layers},
    {id:'asignaturas',label:'Asignaturas',icon:IC.book},
    {id:'ofertas',label:'Ofertas',icon:IC.grid},
    {id:'clases',label:'Clases',icon:IC.school},
    {id:'matriculas',label:'Matrículas',icon:IC.clip},
    {id:'asignaciones',label:'Asign. Prof.',icon:IC.link},
    {id:'usuarios',label:'Usuarios App',icon:IC.shield},
    {id:'salas',label:'Salas Chat',icon:IC.chat},
    {id:'auditoria',label:'Auditoría',icon:IC.log},
  ];

  return (
    <View style={S.container}>
      <View style={S.header}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>{IC.shield('#2563EB')}<View><Text style={S.headerTitle}>Panel de Administración</Text><Text style={S.headerSub}>TuChat — Gestión completa</Text></View></View>
        <TouchableOpacity onPress={()=>xConfirm('Cerrar sesión','¿Seguro que quieres salir del panel de administración?',doLogout,'Salir')} style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#FEF2F2',paddingHorizontal:12,paddingVertical:7,borderRadius:8}}>{IC.logout()}<Text style={{color:'#DC2626',fontSize:12,fontWeight:'600'}}>Salir</Text></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabBar} contentContainerStyle={S.tabBarContent}>
        {tabs.map(t=><TouchableOpacity key={t.id} style={[S.tabItem,tab===t.id&&S.tabItemActive]} onPress={()=>setTab(t.id)}>{t.icon(tab===t.id?'#2563EB':'#94A3B8')}<Text style={[S.tabLabel,tab===t.id&&S.tabLabelActive]}>{t.label}</Text></TouchableOpacity>)}
      </ScrollView>

      {/* Wizard quick access */}
      <TouchableOpacity onPress={()=>{setWizardEditId(undefined);setWizardOpen(true)}} style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginTop:10,backgroundColor:'#EFF6FF',paddingVertical:12,paddingHorizontal:16,borderRadius:12,borderWidth:1,borderColor:'#BFDBFE'}}>
        <I d="M13 10V3L4 14h7v7l9-11h-7z" color="#2563EB" size={20}/><View style={{flex:1}}><Text style={{fontWeight:'700',color:'#2563EB',fontSize:14}}>Asistente — Crear Clase Completa</Text><Text style={{fontSize:11,color:'#64748B'}}>Crea clase, asigna profesores y matricula alumnos en un solo paso</Text></View>{IC.arrow_l('#2563EB')}
      </TouchableOpacity>
      {tab==='dashboard'&&<DashboardTab/>}
      {tab==='centros'&&<CentrosTab/>}
      {tab==='personas'&&<PersonasTab/>}
      {tab==='cursos'&&<CursosTab/>}
      {tab==='planes'&&<PlanesTab/>}
      {tab==='asignaturas'&&<AsignaturasTab/>}
      {tab==='ofertas'&&<OfertasTab/>}
      {tab==='clases'&&<ClasesTab onOpenWizard={(id?:string)=>{setWizardEditId(id);setWizardOpen(true)}}/>}
      {tab==='matriculas'&&<MatriculasTab/>}
      {tab==='asignaciones'&&<AsignacionesTab/>}
      {tab==='usuarios'&&<UsuariosAppTab/>}
      {tab==='salas'&&<SalasTab/>}
      {tab==='auditoria'&&<AuditoriaTab/>}
      <AppDialog />
    </View>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function DashboardTab(){
  const [d,setD]=useState<any>(null);const [l,sL]=useState(true);const [r,sR]=useState(false);
  const load=async()=>{try{const x=await api('/admin/dashboard');if(x.ok)setD(x)}catch(e){}finally{sL(false);sR(false)}};
  useEffect(()=>{load()},[]);
  if(l)return<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>;
  if(!d)return<Text style={S.errorText}>Error al cargar</Text>;
  const s=d.stats;
  const items=[
    {t:'Usuarios Act.',v:s.usuarios_activos,c:'#2563EB'},{t:'Alumnos',v:s.alumnos_activos,c:'#059669'},
    {t:'Profesores',v:s.profesores_activos,c:'#7C3AED'},{t:'Centros',v:s.centros,c:'#0891B2'},
    {t:'Clases Act.',v:s.clases_activas,c:'#CA8A04'},{t:'Asignaturas',v:s.total_asignaturas,c:'#EA580C'},
    {t:'Planes',v:s.planes_estudio,c:'#4F46E5'},{t:'Ofertas',v:s.ofertas,c:'#DB2777'},
    {t:'Matrículas',v:s.total_matriculas,c:'#65A30D'},{t:'Asign. Prof.',v:s.asignaciones_profesor,c:'#0D9488'},
    {t:'Salas Chat',v:s.total_salas_chat,c:'#6366F1'},{t:'Cursos Esc.',v:s.cursos_escolares,c:'#D97706'},
  ];
  return(
    <ScrollView style={{flex:1}} contentContainerStyle={{padding:16}} refreshControl={<RefreshControl refreshing={r} onRefresh={()=>{sR(true);load()}}/>}>
      <View style={S.statsGrid}>{items.map((i,k)=><View key={k} style={[S.statCard,{borderLeftColor:i.c}]}><Text style={[S.statValue,{color:i.c}]}>{i.v??0}</Text><Text style={S.statLabel}>{i.t}</Text></View>)}</View>
      {d.ultimosUsuarios?.length>0&&<View style={S.card}><Text style={S.cardTitle}>Últimos registros</Text>{d.ultimosUsuarios.slice(0,5).map((u:any,i:number)=><View key={i} style={S.cardRow}><View style={{flex:1}}><Text style={S.cardRowTitle}>{u.nombre} {u.apellidos}</Text><Text style={S.cardRowSub}>{new Date(u.created_at).toLocaleDateString()}</Text></View><Badge color={u.tipo_externo==='PROFESOR'?'purple':'blue'}>{u.tipo_externo}</Badge></View>)}</View>}
      {d.ultimasAcciones?.length>0&&<View style={S.card}><Text style={S.cardTitle}>Últimas acciones admin</Text>{d.ultimasAcciones.slice(0,5).map((a:any,i:number)=><View key={i} style={S.cardRow}><View style={{flex:1}}><Text style={S.cardRowTitle}>{a.accion} — {a.entidad}</Text><Text style={S.cardRowSub}>{a.admin_nombre} · {new Date(a.created_at).toLocaleString()}</Text></View></View>)}</View>}
    </ScrollView>
  );
}

// ─── GENERIC CRUD TAB (reused) ──────────────────────────────
function GenericCrud<T extends Record<string,any>>({
  endpoint, title, iconFn, fields, keyField, nameField, extraBadge, searchPlaceholder, colorAvatar
}:{
  endpoint:string; title:string; iconFn:(c?:string)=>React.ReactNode; fields:{key:string;label:string;required?:boolean;cap?:'characters'|'words'|'none'}[];
  keyField:string; nameField:string; extraBadge?:(item:T)=>React.ReactNode; searchPlaceholder:string; colorAvatar:string;
}){
  const [data,setData]=useState<T[]>([]);const [l,sL]=useState(true);const [b,sB]=useState('');const [show,sShow]=useState(false);const [edit,sEdit]=useState<T|null>(null);
  const emptyForm=()=>Object.fromEntries(fields.map(f=>[f.key,'']));
  const [form,sForm]=useState<Record<string,string>>(emptyForm());
  const [selIds,setSelIds]=useState<Set<string>>(new Set());const [multiMode,setMultiMode]=useState(false);
  const lastTap=React.useRef<{id:string;time:number}>({id:'',time:0});

  const load=async(s:string='')=>{sL(true);try{const d=await api(`/admin/${endpoint}${s?`?buscar=${encodeURIComponent(s)}`:''}`);const key=Object.keys(d).find(k=>Array.isArray(d[k]));if(key)setData(d[key])}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);
  useEffect(()=>{const t=setTimeout(()=>load(b),500);return()=>clearTimeout(t)},[b]);

  const openCreate=()=>{sEdit(null);sForm(emptyForm());sShow(true)};
  const openEdit=(item:T)=>{sEdit(item);const f:Record<string,string>={};fields.forEach(ff=>{f[ff.key]=String(item[ff.key]||'')});sForm(f);sShow(true)};
  const save=async()=>{
    const missing=fields.filter(f=>f.required&&!form[f.key]);if(missing.length)return xAlert('Error',`Faltan: ${missing.map(m=>m.label).join(', ')}`);
    try{if(edit){await api(`/admin/${endpoint}/${(edit as any)[keyField]}`,{method:'PUT',data:form})}else{await api(`/admin/${endpoint}`,{method:'POST',data:form})}sShow(false);load()}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}
  };
  const del=(item:T)=>{
    xConfirm('Confirmar eliminación',`¿Estás seguro de que quieres eliminar "${(item as any)[nameField]}"?\n\nEsta acción no se puede deshacer.`,async()=>{try{await api(`/admin/${endpoint}/${(item as any)[keyField]}`,{method:'DELETE'});load()}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}});
  };
  const delMulti=()=>{
    if(selIds.size===0)return;
    xConfirm('Eliminación múltiple',`¿Eliminar ${selIds.size} registro(s) seleccionado(s)?\n\nEsta acción no se puede deshacer.`,async()=>{
      for(const id of selIds){try{await api(`/admin/${endpoint}/${id}`,{method:'DELETE'})}catch(e){}}
      setSelIds(new Set());setMultiMode(false);load();
    });
  };
  const toggleSel=(id:string)=>{setSelIds(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n})};
  const handleTap=(item:T)=>{
    if(multiMode){toggleSel((item as any)[keyField]);return}
    const now=Date.now();const id=String((item as any)[keyField]);
    if(lastTap.current.id===id&&now-lastTap.current.time<400){openEdit(item);lastTap.current={id:'',time:0}}
    else{lastTap.current={id,time:now}}
  };

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}>
        <View style={{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'#F1F5F9',borderRadius:10,paddingHorizontal:12}}>{IC.search()}<TextInput style={[S.searchInput,{flex:1}]} placeholder={searchPlaceholder} placeholderTextColor="#94A3B8" value={b} onChangeText={sB}/></View>
        {multiMode?(
          <View style={{flexDirection:'row',gap:6}}>
            <TouchableOpacity onPress={delMulti} style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FEF2F2',paddingHorizontal:12,paddingVertical:10,borderRadius:10,gap:4}}>{IC.trash()}<Text style={{color:'#DC2626',fontSize:12,fontWeight:'600'}}>{selIds.size}</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{setMultiMode(false);setSelIds(new Set())}} style={{backgroundColor:'#F1F5F9',paddingHorizontal:12,paddingVertical:10,borderRadius:10}}><Text style={{color:'#64748B',fontSize:12,fontWeight:'600'}}>Cancelar</Text></TouchableOpacity>
          </View>
        ):(
          <View style={{flexDirection:'row',gap:6}}>
            <TouchableOpacity onPress={()=>{setMultiMode(true);setSelIds(new Set())}} style={{backgroundColor:'#F1F5F9',paddingHorizontal:10,paddingVertical:10,borderRadius:10}}>{IC.check('#64748B')}</TouchableOpacity>
            <TouchableOpacity style={S.addBtn} onPress={openCreate}>{IC.plus()}<Text style={S.addBtnText}>Nuevo</Text></TouchableOpacity>
          </View>
        )}
      </View>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data} keyExtractor={(i:T)=>String((i as any)[keyField])} contentContainerStyle={{padding:16,paddingBottom:40}}
          ListHeaderComponent={!multiMode?<Text style={{fontSize:11,color:'#94A3B8',marginBottom:8,textAlign:'center'}}>Doble toque para editar</Text>:null}
          renderItem={({item})=>{
            const id=String((item as any)[keyField]);const isSel=selIds.has(id);
            return(
            <TouchableOpacity onPress={()=>handleTap(item)} activeOpacity={0.7}>
            <View style={[S.listCard,isSel&&{borderColor:'#2563EB',backgroundColor:'#EFF6FF'}]}>
              {multiMode&&<TouchableOpacity onPress={()=>toggleSel(id)} style={{width:24,height:24,borderRadius:6,borderWidth:2,borderColor:isSel?'#2563EB':'#CBD5E1',backgroundColor:isSel?'#2563EB':'#FFF',justifyContent:'center',alignItems:'center'}}>{isSel&&<I d="M5 13l4 4L19 7" color="#FFF" size={12}/>}</TouchableOpacity>}
              <View style={[S.listAvatar,{backgroundColor:colorAvatar}]}>{iconFn('#FFF')}</View>
              <View style={{flex:1}}><Text style={S.listName}>{(item as any)[nameField]}</Text>{extraBadge&&extraBadge(item)}</View>
              {!multiMode&&<View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
                <TouchableOpacity onPress={()=>openEdit(item)} hitSlop={8}>{IC.edit()}</TouchableOpacity>
                <TouchableOpacity onPress={()=>del(item)} hitSlop={8}>{IC.trash()}</TouchableOpacity>
              </View>}
            </View>
            </TouchableOpacity>
          )}}
          ListEmptyComponent={<Text style={S.emptyText}>Sin datos</Text>}
        />
      )}
      <Modal visible={show} animationType="slide" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShow(false)} style={S.modalOverlay}>
          <TouchableOpacity activeOpacity={1} onPress={()=>{}} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>{edit?`Editar ${title}`:`Nuevo ${title}`}</Text><TouchableOpacity onPress={()=>sShow(false)}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {fields.map(f=><FF key={f.key} label={`${f.label}${f.required?' *':''}`} value={form[f.key]} onChangeText={v=>sForm({...form,[f.key]:v})} placeholder={f.label} cap={f.cap}/>)}
            <TouchableOpacity style={S.saveBtn} onPress={save}>{IC.check()}<Text style={S.saveBtnText}>{edit?'Guardar':'Crear'}</Text></TouchableOpacity>
          </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── CENTROS ─────────────────────────────────────────────────
function CentrosTab(){
  return <GenericCrud endpoint="centros" title="Centro" iconFn={IC.building} keyField="id_centro" nameField="nombre"
    searchPlaceholder="Buscar centro..." colorAvatar="#0891B2"
    fields={[{key:'codigo_centro',label:'Código Centro',required:true,cap:'characters'},{key:'nombre',label:'Nombre',required:true,cap:'words'},{key:'isla',label:'Isla',cap:'words'},{key:'municipio',label:'Municipio',cap:'words'}]}
    extraBadge={(i:any)=><Text style={S.listSub}>{i.codigo_centro}{i.isla?` · ${i.isla}`:''}{i.total_usuarios!=null?` · ${i.total_usuarios} usuarios`:''}</Text>}
  />;
}

// ─── CURSOS ESCOLARES ────────────────────────────────────────
function CursosTab(){
  return <GenericCrud endpoint="cursos-escolares" title="Curso Escolar" iconFn={IC.calendar} keyField="id_curso_escolar" nameField="nombre"
    searchPlaceholder="Buscar curso..." colorAvatar="#D97706"
    fields={[{key:'nombre',label:'Nombre (ej: 2025-2026)',required:true},{key:'fecha_inicio',label:'Fecha Inicio (YYYY-MM-DD)'},{key:'fecha_fin',label:'Fecha Fin (YYYY-MM-DD)'}]}
    extraBadge={(i:any)=><Text style={S.listSub}>{i.fecha_inicio?`${i.fecha_inicio} → ${i.fecha_fin||'?'}`:''}{i.activo===false?' · Inactivo':''}</Text>}
  />;
}

// ─── PLANES DE ESTUDIO ───────────────────────────────────────
function PlanesTab(){
  return <GenericCrud endpoint="planes" title="Plan de Estudio" iconFn={IC.layers} keyField="id_plan" nameField="nombre"
    searchPlaceholder="Buscar plan..." colorAvatar="#4F46E5"
    fields={[{key:'nombre',label:'Nombre',required:true,cap:'words'},{key:'version',label:'Versión',required:true},{key:'descripcion',label:'Descripción'}]}
    extraBadge={(i:any)=><Text style={S.listSub}>v{i.version}{i.total_ofertas!=null?` · ${i.total_ofertas} ofertas`:''}{i.total_clases!=null?` · ${i.total_clases} clases`:''}</Text>}
  />;
}

// ─── ASIGNATURAS ─────────────────────────────────────────────
function AsignaturasTab(){
  return <GenericCrud endpoint="asignaturas" title="Asignatura" iconFn={IC.book} keyField="id_asignatura" nameField="nombre"
    searchPlaceholder="Buscar asignatura..." colorAvatar="#CA8A04"
    fields={[{key:'codigo',label:'Código',required:true,cap:'characters'},{key:'nombre',label:'Nombre',required:true,cap:'words'},{key:'descripcion',label:'Descripción'},{key:'horas',label:'Horas'}]}
    extraBadge={(i:any)=><Text style={S.listSub}>{i.codigo}{i.total_ofertas!=null?` · ${i.total_ofertas} ofertas`:''}{i.horas?` · ${i.horas}h`:''}</Text>}
  />;
}

// ─── OFERTAS ─────────────────────────────────────────────────
function OfertasTab(){
  const [ofertas,setOfertas]=useState<any[]>([]);const [planes,setPlanes]=useState<any[]>([]);const [asigs,setAsigs]=useState<any[]>([]);
  const [l,sL]=useState(true);const [show,sShow]=useState(false);
  const [form,sForm]=useState({id_plan:'',id_asignatura:'',curso:'1',obligatoria:true});

  const load=async()=>{sL(true);try{const [o,p,a]=await Promise.all([api('/admin/ofertas'),api('/admin/planes'),api('/admin/asignaturas?limit=200')]);if(o.ok)setOfertas(o.ofertas);if(p.ok)setPlanes(p.planes);if(a.ok)setAsigs(a.asignaturas)}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);

  const save=async()=>{
    if(!form.id_plan||!form.id_asignatura)return xAlert('Error','Plan y Asignatura obligatorios');
    try{await api('/admin/ofertas',{method:'POST',data:form});sShow(false);load()}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}
  };
  const del=(o:any)=>{xConfirm('Eliminar',`¿Eliminar oferta de ${o.nombre_asignatura}?`,async()=>{await api(`/admin/ofertas/${o.id_oferta}`,{method:'DELETE'});load()})};

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}><View style={{flex:1}}/><TouchableOpacity style={S.addBtn} onPress={()=>{sForm({id_plan:planes[0]?.id_plan||'',id_asignatura:asigs[0]?.id_asignatura||'',curso:'1',obligatoria:true});sShow(true)}}>{IC.plus()}<Text style={S.addBtnText}>Nueva</Text></TouchableOpacity></View>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={ofertas} keyExtractor={(o:any)=>o.id_oferta} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:o})=>(
            <View style={S.listCard}>
              <View style={[S.listAvatar,{backgroundColor:'#DB2777'}]}>{IC.grid('#FFF')}</View>
              <View style={{flex:1}}><Text style={S.listName}>{o.nombre_asignatura}</Text><Text style={S.listSub}>{o.nombre_plan} · Curso {o.curso}º · {o.obligatoria?'Obligatoria':'Optativa'}</Text></View>
              <TouchableOpacity onPress={()=>del(o)} hitSlop={8}>{IC.trash()}</TouchableOpacity>
            </View>
          )}
        />
      )}
      <Modal visible={show} animationType="slide" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShow(false)} style={S.modalOverlay}><TouchableOpacity activeOpacity={1} onPress={()=>{}} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>Nueva Oferta</Text><TouchableOpacity onPress={()=>sShow(false)}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SDrop label="Plan de estudio *" items={planes} selectedId={form.id_plan} onSelect={v=>sForm({...form,id_plan:v})} displayKey={(p:any)=>`${p.nombre} v${p.version}`} idKey="id_plan"/>
            <SDrop label="Asignatura *" items={asigs} selectedId={form.id_asignatura} onSelect={v=>sForm({...form,id_asignatura:v})} displayKey={(a:any)=>`${a.nombre} (${a.codigo})`} idKey="id_asignatura"/>
            <FF label="Curso (1-4) *" value={form.curso} onChangeText={v=>sForm({...form,curso:v})} placeholder="1"/>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14}}><Text style={S.fieldLabel}>Obligatoria</Text><Switch value={form.obligatoria} onValueChange={v=>sForm({...form,obligatoria:v})}/></View>
            <TouchableOpacity style={S.saveBtn} onPress={save}>{IC.check()}<Text style={S.saveBtnText}>Crear Oferta</Text></TouchableOpacity>
          </ScrollView>
        </TouchableOpacity></TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── CLASES ──────────────────────────────────────────────────
function ClasesTab({onOpenWizard}:{onOpenWizard:(id?:string)=>void}){
  const [clases,setClases]=useState<any[]>([]);const [l,sL]=useState(true);const [b,sB]=useState('');
  const [show,sShow]=useState(false);const [editItem,sEdit]=useState<any>(null);
  const [planes,setPlanes]=useState<any[]>([]);const [centros,setCentros]=useState<any[]>([]);const [cursos,setCursos]=useState<any[]>([]);
  const [form,sForm]=useState({nombre:'',curso:'',grupo:'',id_plan:'',id_centro:'',id_curso_escolar:''});
  const [filter,setFilter]=useState('all');
  const lastTap=React.useRef<{id:string;time:number}>({id:'',time:0});

  const load=async(s:string='')=>{sL(true);try{const d=await api(`/admin/clases?limit=100${s?`&buscar=${encodeURIComponent(s)}`:''}`);if(d.ok)setClases(d.clases)}catch(e){}finally{sL(false)}};
  const loadSelects=async()=>{try{const[p,c,ce]=await Promise.all([api('/admin/planes'),api('/admin/cursos-escolares'),api('/admin/centros')]);if(p.ok)setPlanes(p.planes);if(c.ok)setCursos(c.cursos);if(ce.ok)setCentros(ce.centros)}catch(e){}};
  useEffect(()=>{load();loadSelects()},[]);
  useEffect(()=>{const t=setTimeout(()=>load(b),500);return()=>clearTimeout(t)},[b]);
  const filtered=clases.filter(c=>{if(filter==='active')return c.activa;if(filter==='inactive')return !c.activa;return true});

  const openCreate=()=>{sEdit(null);sForm({nombre:'',curso:'',grupo:'',id_plan:planes[0]?.id_plan||'',id_centro:centros[0]?.id_centro||'',id_curso_escolar:cursos[0]?.id_curso_escolar||''});sShow(true)};
  const openEdit=(c:any)=>{sEdit(c);sForm({nombre:c.nombre||c.nombre_clase||'',curso:String(c.curso),grupo:c.grupo,id_plan:c.id_plan||'',id_centro:c.id_centro||'',id_curso_escolar:c.id_curso_escolar||''});sShow(true)};
  const save=async()=>{if(!form.nombre||!form.curso||!form.grupo)return xAlert('Error','Nombre, Curso y Grupo obligatorios');try{if(editItem)await api(`/admin/clases/${editItem.id_clase}`,{method:'PUT',data:form});else await api('/admin/clases',{method:'POST',data:form});sShow(false);load()}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}};
  const del=(c:any)=>{xConfirm('Confirmar eliminación',`¿Eliminar "${c.nombre||c.nombre_clase}" y todos sus datos?\n\nEsta acción no se puede deshacer.`,async()=>{await api(`/admin/clases/${c.id_clase}`,{method:'DELETE'});load()});};
  const handleTap=(c:any)=>{const now=Date.now();if(lastTap.current.id===c.id_clase&&now-lastTap.current.time<400){openEdit(c);lastTap.current={id:'',time:0}}else lastTap.current={id:c.id_clase,time:now}};

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}><View style={{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'#F1F5F9',borderRadius:10,paddingHorizontal:12}}>{IC.search()}<TextInput style={[S.searchInput,{flex:1}]} placeholder="Buscar clase..." placeholderTextColor="#94A3B8" value={b} onChangeText={sB}/></View><TouchableOpacity style={S.addBtn} onPress={openCreate}>{IC.plus()}<Text style={S.addBtnText}>Nueva</Text></TouchableOpacity></View>
      <FilterBar filters={[{key:'all',label:'Todas'},{key:'active',label:'Activas'},{key:'inactive',label:'Inactivas'}]} active={filter} onSelect={setFilter}/>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={filtered} keyExtractor={(c:any)=>c.id_clase} contentContainerStyle={{padding:16,paddingBottom:40}}
          ListHeaderComponent={<Text style={{fontSize:11,color:'#94A3B8',marginBottom:8,textAlign:'center'}}>Doble toque para editar</Text>}
          renderItem={({item:c})=>(
            <TouchableOpacity onPress={()=>handleTap(c)} activeOpacity={0.7}>
            <View style={S.listCard}>
              <View style={[S.listAvatar,{backgroundColor:c.activa?'#0891B2':'#94A3B8'}]}>{IC.school('#FFF')}</View>
              <View style={{flex:1}}><Text style={S.listName}>{c.nombre||c.nombre_clase}</Text><Text style={S.listSub}>{c.nombre_plan} · {c.curso}º{c.grupo}{c.nombre_centro?` · ${c.nombre_centro}`:''}</Text></View>
              <View style={{alignItems:'flex-end',gap:4}}><View style={{flexDirection:'row',gap:4}}><Badge color="blue">{c.total_alumnos} alu.</Badge><Badge color="purple">{c.total_profesores} prof.</Badge></View><Badge color={c.activa?'green':'red'}>{c.activa?'Activa':'Inactiva'}</Badge></View>
              <View style={{marginLeft:6,gap:6}}><TouchableOpacity onPress={()=>onOpenWizard(c.id_clase)} hitSlop={8}><I d="M13 10V3L4 14h7v7l9-11h-7z" color="#2563EB" size={16}/></TouchableOpacity><TouchableOpacity onPress={()=>openEdit(c)} hitSlop={8}>{IC.edit()}</TouchableOpacity><TouchableOpacity onPress={()=>del(c)} hitSlop={8}>{IC.trash()}</TouchableOpacity></View>
            </View>
            </TouchableOpacity>
          )}
        />
      )}
      <Modal visible={show} animationType="slide" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShow(false)} style={S.modalOverlay}><TouchableOpacity activeOpacity={1} onPress={()=>{}} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>{editItem?'Editar Clase':'Nueva Clase'}</Text><TouchableOpacity onPress={()=>sShow(false)}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <FF label="Nombre *" value={form.nombre} onChangeText={v=>sForm({...form,nombre:v})} placeholder="1º DAW A" cap="words"/>
            <FF label="Curso (1-4) *" value={form.curso} onChangeText={v=>sForm({...form,curso:v})} placeholder="1"/>
            <FF label="Grupo *" value={form.grupo} onChangeText={v=>sForm({...form,grupo:v})} placeholder="A" cap="characters"/>
            <SDrop label="Plan *" items={planes} selectedId={form.id_plan} onSelect={v=>sForm({...form,id_plan:v})} displayKey={(p:any)=>`${p.nombre} v${p.version}`} idKey="id_plan"/>
            <SDrop label="Centro *" items={centros} selectedId={form.id_centro} onSelect={v=>sForm({...form,id_centro:v})} displayKey="nombre" idKey="id_centro"/>
            <SDrop label="Curso escolar *" items={cursos} selectedId={form.id_curso_escolar} onSelect={v=>sForm({...form,id_curso_escolar:v})} displayKey="nombre" idKey="id_curso_escolar"/>
            <TouchableOpacity style={S.saveBtn} onPress={save}>{IC.check()}<Text style={S.saveBtnText}>{editItem?'Guardar':'Crear'}</Text></TouchableOpacity>
          </ScrollView>
        </TouchableOpacity></TouchableOpacity>
      </Modal>
    </View>
  );
}



// ─── MATRÍCULAS ──────────────────────────────────────────────
function MatriculasTab(){
  const [data,setData]=useState<any[]>([]);const [l,sL]=useState(true);const [b,sB]=useState('');
  const [show,sShow]=useState(false);const [alumnos,setAlumnos]=useState<any[]>([]);const [clases,setClases]=useState<any[]>([]);
  const [sel,sSel]=useState({alumno:'',clase:''});

  const load=async(s:string='')=>{sL(true);try{const d=await api(`/admin/matriculas?limit=50${s?`&buscar=${encodeURIComponent(s)}`:''}`);if(d.ok)setData(d.matriculas)}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);
  useEffect(()=>{const t=setTimeout(()=>load(b),500);return()=>clearTimeout(t)},[b]);

  const openCreate=async()=>{sSel({alumno:'',clase:''});try{const[p,c]=await Promise.all([api('/admin/personas?limit=200'),api('/admin/clases?limit=200')]);if(p.ok)setAlumnos(p.personas.filter((x:any)=>x.tipo==='ALUMNO'));if(c.ok)setClases(c.clases)}catch(e){}sShow(true)};
  const save=async()=>{if(!sel.alumno||!sel.clase)return xAlert('Error','Selecciona alumno y clase');try{await api('/admin/matriculas',{method:'POST',data:{id_alumno_externo:sel.alumno,id_clase:sel.clase}});sShow(false);load()}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}};
  const del=(m:any)=>{xConfirm('Eliminar',`¿Eliminar matrícula de ${m.nombre}?`,async()=>{await api(`/admin/matriculas/${m.id_matricula}`,{method:'DELETE'});load()})};

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}><View style={{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'#F1F5F9',borderRadius:10,paddingHorizontal:12}}>{IC.search()}<TextInput style={[S.searchInput,{flex:1}]} placeholder="Buscar alumno..." placeholderTextColor="#94A3B8" value={b} onChangeText={sB}/></View><TouchableOpacity style={S.addBtn} onPress={openCreate}>{IC.plus()}<Text style={S.addBtnText}>Nueva</Text></TouchableOpacity></View>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data} keyExtractor={(m:any)=>m.id_matricula} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:m})=>(<View style={S.listCard}><View style={[S.listAvatar,{backgroundColor:'#65A30D'}]}>{IC.clip('#FFF')}</View><View style={{flex:1}}><Text style={S.listName}>{m.nombre} {m.apellidos}</Text><Text style={S.listSub}>{m.nombre_clase} · {m.curso}º{m.grupo}</Text></View><TouchableOpacity onPress={()=>del(m)} hitSlop={8}>{IC.trash()}</TouchableOpacity></View>)}
        />
      )}
      <Modal visible={show} animationType="slide" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShow(false)} style={S.modalOverlay}><TouchableOpacity activeOpacity={1} onPress={()=>{}} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>Nueva Matrícula</Text><TouchableOpacity onPress={()=>sShow(false)}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <SDrop label="Alumno *" items={alumnos} selectedId={sel.alumno} onSelect={v=>sSel({...sel,alumno:v})} displayKey={(u:any)=>`${u.nombre} ${u.apellidos} — ${u.dni}`} idKey="id_usuario_externo"/>
            <Text style={S.fieldLabel}>Clase *</Text>
            <TouchableOpacity style={S.saveBtn} onPress={save}>{IC.check()}<Text style={S.saveBtnText}>Crear Matrícula</Text></TouchableOpacity>
          </ScrollView>
        </TouchableOpacity></TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── ASIGNACIONES PROFESOR ───────────────────────────────────
function AsignacionesTab(){
  const [data,setData]=useState<any[]>([]);const [l,sL]=useState(true);
  const [show,sShow]=useState(false);const [profs,setProfs]=useState<any[]>([]);const [clases,setClases]=useState<any[]>([]);const [ofertas,setOfertas]=useState<any[]>([]);
  const [sel,sSel]=useState({prof:'',clase:'',oferta:''});

  const load=async()=>{sL(true);try{const d=await api('/admin/asignaciones');if(d.ok)setData(d.asignaciones)}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);

  const openCreate=async()=>{sSel({prof:'',clase:'',oferta:''});try{const[p,c,o]=await Promise.all([api('/admin/personas?limit=200'),api('/admin/clases?limit=200'),api('/admin/ofertas')]);if(p.ok)setProfs(p.personas.filter((x:any)=>x.tipo==='PROFESOR'));if(c.ok)setClases(c.clases);if(o.ok)setOfertas(o.ofertas)}catch(e){}sShow(true)};
  const save=async()=>{if(!sel.prof||!sel.clase||!sel.oferta)return xAlert('Error','Selecciona profesor, clase y oferta');try{await api('/admin/asignaciones',{method:'POST',data:{id_profesor_externo:sel.prof,id_clase:sel.clase,id_oferta:sel.oferta}});sShow(false);load()}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}};
  const del=(a:any)=>{xConfirm('Eliminar',`¿Eliminar asignación de ${a.nombre_profesor}?`,async()=>{await api(`/admin/asignaciones/${a.id_asignacion}`,{method:'DELETE'});load()})};

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}><View style={{flex:1}}/><TouchableOpacity style={S.addBtn} onPress={openCreate}>{IC.plus()}<Text style={S.addBtnText}>Nueva</Text></TouchableOpacity></View>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data} keyExtractor={(a:any)=>a.id_asignacion} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:a})=>(<View style={S.listCard}><View style={[S.listAvatar,{backgroundColor:'#0D9488'}]}>{IC.link('#FFF')}</View><View style={{flex:1}}><Text style={S.listName}>{a.nombre_profesor} {a.apellidos_profesor}</Text><Text style={S.listSub}>{a.nombre_clase} · {a.curso}º{a.grupo} — {a.nombre_asignatura}</Text></View><TouchableOpacity onPress={()=>del(a)} hitSlop={8}>{IC.trash()}</TouchableOpacity></View>)}
        />
      )}
      <Modal visible={show} animationType="slide" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShow(false)} style={S.modalOverlay}><TouchableOpacity activeOpacity={1} onPress={()=>{}} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>Nueva Asignación</Text><TouchableOpacity onPress={()=>sShow(false)}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <SDrop label="Profesor *" items={profs} selectedId={sel.prof} onSelect={v=>sSel({...sel,prof:v})} displayKey={(p:any)=>`${p.nombre} ${p.apellidos}`} idKey="id_usuario_externo"/>
            <SDrop label="Clase *" items={clases} selectedId={sel.clase} onSelect={v=>sSel({...sel,clase:v})} displayKey={(c:any)=>`${c.nombre||c.nombre_clase} — ${c.curso}º${c.grupo}`} idKey="id_clase"/>
            <SDrop label="Oferta (Asignatura) *" items={ofertas} selectedId={sel.oferta} onSelect={v=>sSel({...sel,oferta:v})} displayKey={(o:any)=>`${o.nombre_asignatura} — ${o.nombre_plan} ${o.curso}º`} idKey="id_oferta"/>
            <TouchableOpacity style={S.saveBtn} onPress={save}>{IC.check()}<Text style={S.saveBtnText}>Crear Asignación</Text></TouchableOpacity>
          </ScrollView>
        </TouchableOpacity></TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── PERSONAS (gobDb) ────────────────────────────────────────
function PersonasTab(){
  const [data,setData]=useState<any[]>([]);const [l,sL]=useState(true);const [b,sB]=useState('');const [filterTipo,setFilterTipo]=useState('all');
  const [show,sShow]=useState(false);const [centros,setCentros]=useState<any[]>([]);
  const [form,sForm]=useState({dni:'',cial:'',nombre:'',apellidos:'',email:'',telefono:'',tipo:'ALUMNO',id_centro:'',password:''});
  const [editP,sEditP]=useState<any>(null);
  const [showPw,sShowPw]=useState(false);const [pwTarget,sPwTarget]=useState('');const [newPw,sNewPw]=useState('');

  const load=async(s:string='')=>{sL(true);try{const d=await api(`/admin/personas?limit=50${s?`&buscar=${encodeURIComponent(s)}`:''}`);if(d.ok)setData(d.personas)}catch(e){}finally{sL(false)}};
  const loadCentros=async()=>{try{const c=await api('/admin/centros');if(c.ok)setCentros(c.centros)}catch(e){}};
  useEffect(()=>{load();loadCentros()},[]);
  useEffect(()=>{const t=setTimeout(()=>load(b),500);return()=>clearTimeout(t)},[b]);

  const openCreate=()=>{sEditP(null);sForm({dni:'',cial:'',nombre:'',apellidos:'',email:'',telefono:'',tipo:'ALUMNO',id_centro:centros[0]?.id_centro||'',password:''});sShow(true)};
  const openEdit=(p:any)=>{sEditP(p);sForm({dni:p.dni,cial:p.cial||'',nombre:p.nombre,apellidos:p.apellidos,email:p.email||'',telefono:p.telefono||'',tipo:p.tipo||'ALUMNO',id_centro:p.id_centro||centros[0]?.id_centro||'',password:''});sShow(true)};

  const save=async()=>{
    if(!form.nombre||!form.apellidos||!form.dni)return xAlert('Error','DNI, Nombre y Apellidos obligatorios');
    try{
      if(editP){await api(`/admin/personas/${editP.id_persona}`,{method:'PUT',data:{nombre:form.nombre,apellidos:form.apellidos,dni:form.dni,cial:form.cial,email:form.email,telefono:form.telefono}})}
      else{if(!form.cial||!form.password)return xAlert('Error','CIAL y Password obligatorios para alta nueva');await api('/admin/personas',{method:'POST',data:form})}
      sShow(false);load()
    }catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}
  };

  const resetPw=async()=>{if(!newPw)return xAlert('Error','Escribe la nueva contraseña');try{await api('/admin/reset-password',{method:'POST',data:{id_usuario_externo:pwTarget,nueva_password:newPw}});sShowPw(false);xAlert('OK','Contraseña actualizada')}catch(e:any){xAlert('Error',e.response?.data?.msg||'Error')}};

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}><View style={{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'#F1F5F9',borderRadius:10,paddingHorizontal:12}}>{IC.search()}<TextInput style={[S.searchInput,{flex:1}]} placeholder="Buscar DNI, nombre..." placeholderTextColor="#94A3B8" value={b} onChangeText={sB}/></View><TouchableOpacity style={S.addBtn} onPress={openCreate}>{IC.plus()}<Text style={S.addBtnText}>Alta</Text></TouchableOpacity></View>
      <FilterBar filters={[{key:'all',label:'Todos'},{key:'ALUMNO',label:'Alumnos'},{key:'PROFESOR',label:'Profesores'}]} active={filterTipo} onSelect={setFilterTipo}/>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data.filter((p:any)=>filterTipo==='all'||p.tipo===filterTipo)} keyExtractor={(p:any)=>p.id_persona} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:p})=>(
            <TouchableOpacity onPress={()=>openEdit(p)} activeOpacity={0.7}>
            <View style={S.listCard}>
              <View style={[S.listAvatar,{backgroundColor:p.tipo==='PROFESOR'?'#7C3AED':'#2563EB'}]}><Text style={S.listAvatarText}>{p.nombre?.[0]}{p.apellidos?.[0]}</Text></View>
              <View style={{flex:1}}><Text style={S.listName}>{p.nombre} {p.apellidos}</Text><Text style={S.listSub}>{p.dni} · {p.cial}{p.nombre_centro?` · ${p.nombre_centro}`:''}</Text></View>
              <Badge color={p.tipo==='PROFESOR'?'purple':'blue'}>{p.tipo||'—'}</Badge>
              <View style={{marginLeft:6,gap:6}}>
                <TouchableOpacity onPress={()=>openEdit(p)} hitSlop={8}>{IC.edit()}</TouchableOpacity>
                {p.id_usuario_externo&&<TouchableOpacity onPress={()=>{sPwTarget(p.id_usuario_externo);sNewPw('');sShowPw(true)}} hitSlop={8}>{IC.key()}</TouchableOpacity>}
              </View>
            </View>
            </TouchableOpacity>
          )}
        />
      )}
      <Modal visible={show} animationType="slide" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShow(false)} style={S.modalOverlay}><TouchableOpacity activeOpacity={1} onPress={()=>{}} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>{editP?'Editar Persona':'Alta Completa'}</Text><TouchableOpacity onPress={()=>sShow(false)}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FF label="DNI *" value={form.dni} onChangeText={v=>sForm({...form,dni:v})} placeholder="12345678A" cap="characters"/>
            <FF label="CIAL *" value={form.cial} onChangeText={v=>sForm({...form,cial:v})} placeholder="CIAL"/>
            <FF label="Nombre *" value={form.nombre} onChangeText={v=>sForm({...form,nombre:v})} placeholder="Nombre" cap="words"/>
            <FF label="Apellidos *" value={form.apellidos} onChangeText={v=>sForm({...form,apellidos:v})} placeholder="Apellidos" cap="words"/>
            <FF label="Email" value={form.email} onChangeText={v=>sForm({...form,email:v})} placeholder="email@ejemplo.com"/>
            <FF label="Teléfono" value={form.telefono} onChangeText={v=>sForm({...form,telefono:v})} placeholder="600000000"/>
            {!editP&&<>
              <View style={{marginBottom:14}}><Text style={S.fieldLabel}>Tipo *</Text><View style={{flexDirection:'row',gap:8}}>{['ALUMNO','PROFESOR'].map(t=><TouchableOpacity key={t} onPress={()=>sForm({...form,tipo:t})} style={[S.chipBtn,form.tipo===t&&S.chipBtnActive]}><Text style={[S.chipText,form.tipo===t&&S.chipTextActive]}>{t}</Text></TouchableOpacity>)}</View></View>
              <SDrop label="Centro *" items={centros} selectedId={form.id_centro} onSelect={v=>sForm({...form,id_centro:v})} displayKey="nombre" idKey="id_centro"/>
              <FF label="Contraseña *" value={form.password} onChangeText={v=>sForm({...form,password:v})} placeholder="Contraseña inicial"/>
            </>}
            <TouchableOpacity style={S.saveBtn} onPress={save}>{IC.check()}<Text style={S.saveBtnText}>{editP?'Guardar':'Crear'}</Text></TouchableOpacity>
          </ScrollView>
        </TouchableOpacity></TouchableOpacity>
      </Modal>
      <Modal visible={showPw} animationType="fade" transparent>
        <TouchableOpacity activeOpacity={1} onPress={()=>sShowPw(false)} style={S.modalOverlay}><TouchableOpacity activeOpacity={1} onPress={()=>{}} style={[S.modalBox,{maxHeight:'40%'}]}>
          <View style={S.modalHead}><Text style={S.modalTitle}>Reset Contraseña</Text><TouchableOpacity onPress={()=>sShowPw(false)}>{IC.x()}</TouchableOpacity></View>
          <FF label="Nueva contraseña" value={newPw} onChangeText={sNewPw} placeholder="Nueva contraseña"/>
          <TouchableOpacity style={S.saveBtn} onPress={resetPw}>{IC.key('#FFF')}<Text style={S.saveBtnText}>Cambiar Contraseña</Text></TouchableOpacity>
        </TouchableOpacity></TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── USUARIOS APP ────────────────────────────────────────────
function UsuariosAppTab(){
  const [data,setData]=useState<any[]>([]);const [l,sL]=useState(true);const [b,sB]=useState('');
  const load=async(s:string='')=>{sL(true);try{const d=await api(`/admin/usuarios-app?limit=50${s?`&buscar=${encodeURIComponent(s)}`:''}`);if(d.ok)setData(d.usuarios)}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);
  useEffect(()=>{const t=setTimeout(()=>load(b),500);return()=>clearTimeout(t)},[b]);

  const toggle=async(u:any)=>{await api(`/admin/usuarios-app/${u.id_usuario_app}/toggle-activo`,{method:'PUT',data:{activo:!u.activo}});load()};

  return(
    <View style={{flex:1}}>
      <View style={S.searchBar}><View style={{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'#F1F5F9',borderRadius:10,paddingHorizontal:12}}>{IC.search()}<TextInput style={[S.searchInput,{flex:1}]} placeholder="Buscar usuario app..." placeholderTextColor="#94A3B8" value={b} onChangeText={sB}/></View></View>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data} keyExtractor={(u:any)=>u.id_usuario_app} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:u})=>(
            <View style={S.listCard}>
              <View style={[S.listAvatar,{backgroundColor:u.id_rol===7?'#DC2626':u.tipo_externo==='PROFESOR'?'#7C3AED':'#2563EB'}]}><Text style={S.listAvatarText}>{u.nombre?.[0]}{u.apellidos?.[0]}</Text></View>
              <View style={{flex:1}}><Text style={S.listName}>{u.nombre} {u.apellidos}</Text><Text style={S.listSub}>{u.dni} · {u.codigo_centro||'—'}</Text></View>
              <View style={{alignItems:'flex-end',gap:4}}><Badge color={u.id_rol===7?'red':u.tipo_externo==='PROFESOR'?'purple':'blue'}>{u.id_rol===7?'ADMIN':u.tipo_externo}</Badge><Badge color={u.activo?'green':'red'}>{u.activo?'Activo':'Inactivo'}</Badge></View>
              <TouchableOpacity onPress={()=>toggle(u)} style={{marginLeft:8}} hitSlop={8}>{u.activo?IC.ban():IC.ok()}</TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── SALAS CHAT ──────────────────────────────────────────────
function SalasTab(){
  const [data,setData]=useState<any[]>([]);const [l,sL]=useState(true);
  const load=async()=>{sL(true);try{const d=await api('/admin/salas');if(d.ok)setData(d.salas)}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);
  return(
    <View style={{flex:1}}>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data} keyExtractor={(s:any)=>s.id_sala} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:s})=>(<View style={S.listCard}><View style={[S.listAvatar,{backgroundColor:'#6366F1'}]}>{IC.chat('#FFF')}</View><View style={{flex:1}}><Text style={S.listName}>{s.nombre_asignatura}</Text><Text style={S.listSub}>{s.nombre_clase} · {s.curso}º{s.grupo}</Text></View><Badge color={s.configuracion?.soloProfesores?'amber':'green'}>{s.configuracion?.soloProfesores?'Solo Prof.':'Abierta'}</Badge></View>)}
        />
      )}
    </View>
  );
}

// ─── AUDITORÍA ───────────────────────────────────────────────
function AuditoriaTab(){
  const [data,setData]=useState<any[]>([]);const [l,sL]=useState(true);
  const load=async()=>{sL(true);try{const d=await api('/admin/audit-log');if(d.ok)setData(d.logs)}catch(e){}finally{sL(false)}};
  useEffect(()=>{load()},[]);
  return(
    <View style={{flex:1}}>
      {l?<View style={S.center}><ActivityIndicator size="large" color="#2563EB"/></View>:(
        <FlatList data={data} keyExtractor={(a:any)=>a.id_log} contentContainerStyle={{padding:16,paddingBottom:40}}
          renderItem={({item:a})=>(<View style={S.listCard}><View style={[S.listAvatar,{backgroundColor:'#475569'}]}>{IC.log('#FFF')}</View><View style={{flex:1}}><Text style={S.listName}>{a.accion} — {a.entidad}</Text><Text style={S.listSub}>{a.admin_nombre} · {new Date(a.created_at).toLocaleString()}</Text></View></View>)}
        />
      )}
    </View>
  );
}