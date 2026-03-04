import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator,
  ScrollView, Platform, Switch, Modal
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { adminStyles as S } from './admin_styles';

const API = "https://tuchat-pl9.onrender.com";

const I = ({ d, size = 20, color = '#64748B' }: { d: string; size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>
);
const IC = {
  arrow_l: (c?: string) => <I d="M19 12H5m7-7l-7 7 7 7" color={c || '#64748B'} />,
  arrow_r: (c?: string) => <I d="M5 12h14m-7 7l7-7-7-7" color={c || '#FFF'} />,
  check: (c?: string) => <I d="M5 13l4 4L19 7" color={c || '#FFF'} size={18} />,
  x: (c?: string) => <I d="M6 18L18 6M6 6l12 12" color={c || '#94A3B8'} />,
  search: (c?: string) => <I d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" color={c || '#94A3B8'} size={18} />,
  edit: (c?: string) => <I d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" color={c || '#64748B'} size={16} />,
  save: (c?: string) => <I d="M17 21v-8H7v8M7 3v5h8M5 3h11l5 5v11a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" color={c || '#FFF'} size={18} />,
};

const getToken = async () => Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
const api = async (path: string, opts: { method?: string; data?: any } = {}) => {
  const t = await getToken(); const r = await axios({ url: `${API}${path}`, method: opts.method || 'GET', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, data: opts.data }); return r.data;
};

// ─── SEARCHABLE DROPDOWN WITH CREATE ─────────────────────────
function SearchDrop({ label, items, selectedId, onSelect, displayKey, idKey, onCreate, createLabel }:
  { label: string; items: any[]; selectedId: string; onSelect: (id: string) => void; displayKey: string | ((i: any) => string); idKey: string; onCreate?: () => void; createLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const gd = (i: any) => typeof displayKey === 'function' ? displayKey(i) : i[displayKey];
  const filtered = items.filter(i => !q || gd(i).toLowerCase().includes(q.toLowerCase()));
  const sel = items.find(i => i[idKey] === selectedId);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={S.fieldLabel}>{label}</Text>
      <TouchableOpacity onPress={() => { setOpen(!open); setQ(''); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: open ? '#2563EB' : '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={{ flex: 1, fontSize: 14, color: sel ? '#0F172A' : '#94A3B8', fontWeight: sel ? '600' : '400' }}>{sel ? gd(sel) : 'Seleccionar...'}</Text>
        <I d="M19 9l-7 7-7-7" color={open ? '#2563EB' : '#94A3B8'} size={16} />
      </TouchableOpacity>
      {open && (
        <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, backgroundColor: '#FFF', maxHeight: 220, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 10 }}>
            {IC.search()}<TextInput style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, color: '#0F172A' }} placeholder="Buscar..." placeholderTextColor="#CBD5E1" value={q} onChangeText={setQ} autoFocus />
          </View>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 140 }}>
            {filtered.map(item => (
              <TouchableOpacity key={item[idKey]} onPress={() => { onSelect(item[idKey]); setOpen(false); }}
                style={{ padding: 10, backgroundColor: item[idKey] === selectedId ? '#EFF6FF' : '#FFF', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                <Text style={{ fontSize: 13, fontWeight: item[idKey] === selectedId ? '700' : '500', color: item[idKey] === selectedId ? '#2563EB' : '#334155' }}>{gd(item)}</Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && <Text style={{ padding: 12, color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>Sin resultados</Text>}
          </ScrollView>
          {onCreate && (
            <TouchableOpacity onPress={() => { setOpen(false); onCreate(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#F0FDF4' }}>
              <I d="M12 4v16m8-8H4" color="#16A34A" size={16} /><Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 13 }}>{createLabel || 'Crear nuevo'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── CREATE OFERTA MODAL (asignatura + vincular al plan) ─────
function CreateOfertaModal({ visible, onClose, idPlan, cursoClase, allAsignaturas, onSave }:
  { visible: boolean; onClose: () => void; idPlan: string; cursoClase: string; allAsignaturas: any[]; onSave: () => Promise<void> }) {
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [q, setQ] = useState('');
  const [selAsig, setSelAsig] = useState('');
  const [curso, setCurso] = useState(cursoClase || '1');
  const [obligatoria, setObligatoria] = useState(true);
  const [saving, setSaving] = useState(false);
  // New asignatura fields
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [horas, setHoras] = useState('');

  useEffect(() => { if (visible) { setMode('pick'); setQ(''); setSelAsig(''); setCurso(cursoClase || '1'); setObligatoria(true); setCodigo(''); setNombre(''); setDescripcion(''); setHoras(''); } }, [visible]);

  const filtered = allAsignaturas.filter(a => !q || a.nombre.toLowerCase().includes(q.toLowerCase()) || a.codigo.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    setSaving(true);
    try {
      let idAsignatura = selAsig;
      if (mode === 'new') {
        if (!codigo.trim() || !nombre.trim()) { Alert.alert('Error', 'Código y Nombre son obligatorios'); setSaving(false); return; }
        const res = await api('/admin/asignaturas', { method: 'POST', data: { codigo: codigo.trim().toUpperCase(), nombre: nombre.trim(), descripcion, horas: horas ? parseInt(horas) : null } });
        if (!res.ok) { Alert.alert('Error', res.msg); setSaving(false); return; }
        idAsignatura = res.asignatura?.id_asignatura;
        if (!idAsignatura) { Alert.alert('Error', 'No se pudo crear la asignatura'); setSaving(false); return; }
      }
      if (!idAsignatura) { Alert.alert('Error', 'Selecciona una asignatura'); setSaving(false); return; }
      await api('/admin/ofertas', { method: 'POST', data: { id_plan: idPlan, id_asignatura: idAsignatura, curso: parseInt(curso) || 1, obligatoria } });
      await onSave();
      onClose();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.msg || 'Error al crear'); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={S.modalOverlay}>
        <TouchableOpacity activeOpacity={1} onPress={() => { }} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>Añadir asignatura al plan</Text><TouchableOpacity onPress={onClose}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Toggle pick/new */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => setMode('pick')} style={[S.chipBtn, mode === 'pick' && S.chipBtnActive, { flex: 1, alignItems: 'center' }]}><Text style={[S.chipText, mode === 'pick' && S.chipTextActive]}>Existente</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('new')} style={[S.chipBtn, mode === 'new' && S.chipBtnActive, { flex: 1, alignItems: 'center' }]}><Text style={[S.chipText, mode === 'new' && S.chipTextActive]}>Crear nueva</Text></TouchableOpacity>
            </View>

            {mode === 'pick' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 }}>
                  {IC.search()}<TextInput style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, color: '#0F172A' }} placeholder="Buscar asignatura..." placeholderTextColor="#CBD5E1" value={q} onChangeText={setQ} />
                </View>
                <View style={{ maxHeight: 160, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 14 }}>
                  <ScrollView nestedScrollEnabled>
                    {filtered.map((a: any) => (
                      <TouchableOpacity key={a.id_asignatura} onPress={() => setSelAsig(a.id_asignatura)} style={{ padding: 10, backgroundColor: selAsig === a.id_asignatura ? '#EFF6FF' : '#FFF', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                        <Text style={{ fontSize: 13, fontWeight: selAsig === a.id_asignatura ? '700' : '500', color: selAsig === a.id_asignatura ? '#2563EB' : '#334155' }}>{a.nombre} ({a.codigo})</Text>
                      </TouchableOpacity>
                    ))}
                    {filtered.length === 0 && <Text style={{ padding: 12, color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>Sin resultados — prueba "Crear nueva"</Text>}
                  </ScrollView>
                </View>
              </>
            ) : (
              <>
                <View style={{ marginBottom: 10 }}><Text style={S.fieldLabel}>Código *</Text><TextInput style={S.formInput} value={codigo} onChangeText={v => setCodigo(v.toUpperCase())} placeholder="Ej: MAT01" placeholderTextColor="#CBD5E1" autoCapitalize="characters" /></View>
                <View style={{ marginBottom: 10 }}><Text style={S.fieldLabel}>Nombre *</Text><TextInput style={S.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Matemáticas I" placeholderTextColor="#CBD5E1" autoCapitalize="words" /></View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}><Text style={S.fieldLabel}>Horas</Text><TextInput style={S.formInput} value={horas} onChangeText={setHoras} placeholder="Ej: 120" keyboardType="numeric" placeholderTextColor="#CBD5E1" /></View>
                </View>
                <View style={{ marginBottom: 14 }}><Text style={S.fieldLabel}>Descripción</Text><TextInput style={S.formInput} value={descripcion} onChangeText={setDescripcion} placeholder="Opcional" placeholderTextColor="#CBD5E1" /></View>
              </>
            )}

            {/* Oferta config */}
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Text style={{ fontWeight: '600', color: '#334155', fontSize: 12, marginBottom: 8 }}>Configuración en el plan</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <View style={{ flex: 1 }}><Text style={S.fieldLabel}>Curso (1-4)</Text><TextInput style={S.formInput} value={curso} onChangeText={setCurso} placeholder="1" keyboardType="numeric" placeholderTextColor="#CBD5E1" /></View>
                <View style={{ flex: 1, justifyContent: 'center' }}><Text style={S.fieldLabel}>Obligatoria</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity onPress={() => setObligatoria(true)} style={[S.chipBtn, obligatoria && S.chipBtnActive]}><Text style={[S.chipText, obligatoria && S.chipTextActive]}>Sí</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setObligatoria(false)} style={[S.chipBtn, !obligatoria && S.chipBtnActive]}><Text style={[S.chipText, !obligatoria && S.chipTextActive]}>No</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity style={S.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <><I d="M5 13l4 4L19 7" color="#FFF" size={16} /><Text style={S.saveBtnText}>{mode === 'new' ? 'Crear asignatura y vincular' : 'Vincular al plan'}</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── QUICK CREATE MODAL ──────────────────────────────────────
function QuickCreate({ visible, onClose, title, fields, onSave }: {
  visible: boolean; onClose: () => void; title: string;
  fields: { key: string; label: string; required?: boolean; placeholder?: string; cap?: 'characters' | 'words' | 'none' }[];
  onSave: (d: Record<string, string>) => Promise<void>;
}) {
  const empty = () => Object.fromEntries(fields.map(f => [f.key, '']));
  const [form, sForm] = useState<Record<string, string>>(empty());
  const [sv, sSv] = useState(false);
  useEffect(() => { if (visible) sForm(empty()); }, [visible]);
  const save = async () => {
    const m = fields.filter(f => f.required && !form[f.key].trim());
    if (m.length) return Alert.alert('Error', `Faltan: ${m.map(x => x.label).join(', ')}`);
    sSv(true); try { await onSave(form); onClose(); } catch (e: any) { Alert.alert('Error', e.response?.data?.msg || 'Error'); } finally { sSv(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={S.modalOverlay}>
        <TouchableOpacity activeOpacity={1} onPress={() => { }} style={S.modalBox}>
          <View style={S.modalHead}><Text style={S.modalTitle}>{title}</Text><TouchableOpacity onPress={onClose}>{IC.x()}</TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {fields.map(f => <View key={f.key} style={{ marginBottom: 14 }}><Text style={S.fieldLabel}>{f.label}{f.required ? ' *' : ''}</Text><TextInput style={S.formInput} value={form[f.key]} onChangeText={v => sForm({ ...form, [f.key]: v })} placeholder={f.placeholder || f.label} placeholderTextColor="#CBD5E1" autoCapitalize={f.cap || 'none'} /></View>)}
            <TouchableOpacity style={S.saveBtn} onPress={save} disabled={sv}>
              {sv ? <ActivityIndicator color="#FFF" /> : <><I d="M5 13l4 4L19 7" color="#FFF" size={16} /><Text style={S.saveBtnText}>Crear</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── TYPES ───────────────────────────────────────────────────
interface Oferta { id_oferta: string; curso: number; obligatoria: boolean; id_asignatura: string; nombre: string; codigo: string; horas?: number; }
interface Profesor { id_usuario_externo: string; nombre: string; apellidos: string; dni: string; nombre_centro?: string; }
interface Alumno { id_usuario_externo: string; nombre: string; apellidos: string; dni: string; nombre_centro?: string; }
interface Asignacion { id_oferta: string; id_profesor_externo: string; }
interface MatriculaWiz { id_alumno_externo: string; nombre: string; apellidos: string; dni: string; ofertas_alumno: string[]; }

// ─── MAIN WIZARD ─────────────────────────────────────────────
export default function WizardClase({ onClose, editClaseId }: { onClose: () => void; editClaseId?: string }) {
  const [step, setStep] = useState(editClaseId ? -1 : 0); // -1 = loading edit
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data sources
  const [planes, setPlanes] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [cursosEsc, setCursosEsc] = useState<any[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [alumnosDisp, setAlumnosDisp] = useState<Alumno[]>([]);

  // Wizard state
  const [clase, setClase] = useState({ nombre: '', id_plan: '', id_centro: '', id_curso_escolar: '', curso: '1', grupo: '' });
  const [ofertasSel, setOfertasSel] = useState<string[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaWiz[]>([]);

  // Search
  const [buscarAlumno, setBuscarAlumno] = useState('');
  const [expandedAlumno, setExpandedAlumno] = useState<string | null>(null);

  // Quick create modals
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateCentro, setShowCreateCentro] = useState(false);
  const [showCreateCurso, setShowCreateCurso] = useState(false);
  const [showCreatePersona, setShowCreatePersona] = useState<'ALUMNO' | 'PROFESOR' | null>(null);
  const [showCreateOferta, setShowCreateOferta] = useState(false);
  const [allAsignaturas, setAllAsignaturas] = useState<any[]>([]);

  // ─── INITIAL LOAD ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [p, c, ce] = await Promise.all([api('/admin/planes'), api('/admin/centros'), api('/admin/cursos-escolares')]);
        if (p.ok) setPlanes(p.planes);
        if (c.ok) setCentros(c.centros);
        if (ce.ok) setCursosEsc(ce.cursos);
      } catch (e) { }

      if (editClaseId) {
        try {
          const d = await api(`/admin/wizard/clase/${editClaseId}`);
          if (d.ok) {
            setClase({ nombre: d.clase.nombre, id_plan: d.clase.id_plan, id_centro: d.clase.id_centro, id_curso_escolar: d.clase.id_curso_escolar, curso: String(d.clase.curso), grupo: d.clase.grupo });
            setOfertas(d.ofertas);
            const selIds = d.ofertas.map((o: Oferta) => o.id_oferta);
            setOfertasSel(selIds);
            setAsignaciones(d.asignaciones.map((a: any) => ({ id_oferta: a.id_oferta, id_profesor_externo: a.id_profesor_externo })));
            setMatriculas(d.matriculas.map((m: any) => ({
              id_alumno_externo: m.id_alumno_externo, nombre: m.nombre, apellidos: m.apellidos, dni: m.dni,
              ofertas_alumno: (m.asignaturas_matricula || []).map((a: any) => a.id_oferta).filter(Boolean),
              id_matricula: m.id_matricula,
            })));
            const profs = await api(`/admin/wizard/profesores?id_centro=${d.clase.id_centro}`);
            if (profs.ok) setProfesores(profs.profesores);
            const alums = await api(`/admin/wizard/alumnos?id_centro=${d.clase.id_centro}`);
            if (alums.ok) setAlumnosDisp(alums.alumnos);
            setStep(4); // Go to edit/review step
          }
        } catch (e) { }
      }
    })();
  }, []);

  // ─── STEP ACTIONS ──────────────────────────────────────────
  const loadOfertas = async (id_plan: string) => {
    try { const d = await api(`/admin/wizard/ofertas-plan/${id_plan}`); if (d.ok) setOfertas(d.ofertas); } catch (e) { }
  };

  const loadProfsYAlumnos = async () => {
    setLoading(true);
    try {
      const centro = clase.id_centro ? `?id_centro=${clase.id_centro}` : '';
      const [p, a] = await Promise.all([api(`/admin/wizard/profesores${centro}`), api(`/admin/wizard/alumnos${centro}`)]);
      if (p.ok) setProfesores(p.profesores);
      if (a.ok) setAlumnosDisp(a.alumnos);
    } catch (e) { } finally { setLoading(false); }
  };

  const reloadPlanes = async () => { try { const d = await api('/admin/planes'); if (d.ok) setPlanes(d.planes); } catch (e) { } };
  const reloadCentros = async () => { try { const d = await api('/admin/centros'); if (d.ok) setCentros(d.centros); } catch (e) { } };
  const reloadCursos = async () => { try { const d = await api('/admin/cursos-escolares'); if (d.ok) setCursosEsc(d.cursos); } catch (e) { } };
  const reloadProfs = async () => { try { const c = clase.id_centro ? `?id_centro=${clase.id_centro}` : ''; const d = await api(`/admin/wizard/profesores${c}`); if (d.ok) setProfesores(d.profesores); } catch (e) { } };
  const reloadAlumnos = async () => { try { const c = clase.id_centro ? `?id_centro=${clase.id_centro}` : ''; const d = await api(`/admin/wizard/alumnos${c}`); if (d.ok) setAlumnosDisp(d.alumnos); } catch (e) { } };
  const loadAllAsignaturas = async () => { try { const d = await api('/admin/asignaturas'); if (d.ok) setAllAsignaturas(d.asignaturas); } catch (e) { } };
  const reloadOfertas = async () => { if (clase.id_plan) await loadOfertas(clase.id_plan); };

  const toggleOferta = (id: string) => {
    setOfertasSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const setProfesor = (id_oferta: string, id_profesor_externo: string) => {
    setAsignaciones(prev => {
      const existing = prev.find(a => a.id_oferta === id_oferta);
      if (existing) return prev.map(a => a.id_oferta === id_oferta ? { ...a, id_profesor_externo } : a);
      return [...prev, { id_oferta, id_profesor_externo }];
    });
  };

  const addAlumno = (al: Alumno) => {
    if (matriculas.find(m => m.id_alumno_externo === al.id_usuario_externo)) return;
    setMatriculas(prev => [...prev, { id_alumno_externo: al.id_usuario_externo, nombre: al.nombre, apellidos: al.apellidos, dni: al.dni, ofertas_alumno: [...ofertasSel] }]);
  };

  const removeAlumno = (id: string) => setMatriculas(prev => prev.filter(m => m.id_alumno_externo !== id));

  const toggleAlumnoOferta = (alumnoId: string, ofertaId: string) => {
    setMatriculas(prev => prev.map(m => {
      if (m.id_alumno_externo !== alumnoId) return m;
      const has = m.ofertas_alumno.includes(ofertaId);
      return { ...m, ofertas_alumno: has ? m.ofertas_alumno.filter(x => x !== ofertaId) : [...m.ofertas_alumno, ofertaId] };
    }));
  };

  const addAllAlumnos = () => {
    const existingIds = new Set(matriculas.map(m => m.id_alumno_externo));
    const nuevos: MatriculaWiz[] = alumnosDisp.filter(a => !existingIds.has(a.id_usuario_externo)).map(a => ({
      id_alumno_externo: a.id_usuario_externo, nombre: a.nombre, apellidos: a.apellidos, dni: a.dni, ofertas_alumno: [...ofertasSel]
    }));
    setMatriculas(prev => [...prev, ...nuevos]);
  };

  // ─── SAVE ──────────────────────────────────────────────────
  const guardar = async () => {
    setSaving(true);
    try {
      const data = {
        clase, ofertas_seleccionadas: ofertasSel, asignaciones: asignaciones.filter(a => ofertasSel.includes(a.id_oferta)),
        matriculas: matriculas.map(m => ({ id_alumno_externo: m.id_alumno_externo, ofertas_alumno: m.ofertas_alumno }))
      };
      const d = await api('/admin/wizard/crear-clase-completa', { method: 'POST', data });
      if (d.ok) {
        Alert.alert('Clase creada', d.msg, [{ text: 'OK', onPress: onClose }]);
      } else {
        Alert.alert('Error', d.msg);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.msg || 'Error al guardar');
    } finally { setSaving(false); }
  };

  // ─── SAVE INDIVIDUAL ALUMNO (edit mode) ────────────────────
  const guardarAlumno = async (mat: any) => {
    if (!mat.id_matricula) return Alert.alert('Info', 'Solo disponible para matrículas ya creadas');
    try {
      const data = { ofertas: mat.ofertas_alumno.map((id: string) => ({ id_oferta: id, estado: 'CURSANDO' })) };
      const d = await api(`/admin/wizard/matricula/${mat.id_matricula}/asignaturas`, { method: 'PUT', data });
      if (d.ok) Alert.alert('OK', d.msg);
    } catch (e: any) { Alert.alert('Error', e.response?.data?.msg || 'Error'); }
  };

  // ─── STEPS ─────────────────────────────────────────────────
  const steps = ['Datos Clase', 'Asignaturas', 'Profesores', 'Alumnos', 'Resumen'];
  const canNext = () => {
    if (step === 0) return clase.nombre.trim() && clase.id_plan && clase.id_centro && clase.id_curso_escolar && clase.grupo.trim();
    if (step === 1) return ofertasSel.length > 0;
    return true;
  };

  const nextStep = () => {
    if (step === 0) { loadOfertas(clase.id_plan); }
    if (step === 1) { loadProfsYAlumnos(); }
    setStep(step + 1);
  };

  // ─── RENDER STEP INDICATOR ─────────────────────────────────
  const StepBar = () => (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 4 }}>
      {steps.map((s, i) => (
        <TouchableOpacity key={i} onPress={() => { if (i <= step) setStep(i) }} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === step ? '#2563EB' : i < step ? '#16A34A' : '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
            {i < step ? <I d="M5 13l4 4L19 7" color="#FFF" size={14} /> : <Text style={{ color: i === step ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>}
          </View>
          <Text style={{ fontSize: 9, fontWeight: '600', color: i === step ? '#2563EB' : '#94A3B8', marginTop: 3 }}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const NavButtons = () => (
    <View style={{ flexDirection: 'row', padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10 }}>
      {step > 0 && <TouchableOpacity onPress={() => setStep(step - 1)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', gap: 6 }}>
        {IC.arrow_l()}<Text style={{ fontWeight: '600', color: '#64748B' }}>Anterior</Text>
      </TouchableOpacity>}
      {step < 4 ? (
        <TouchableOpacity onPress={nextStep} disabled={!canNext()} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: canNext() ? '#2563EB' : '#CBD5E1', gap: 6 }}>
          <Text style={{ fontWeight: '600', color: '#FFF' }}>Siguiente</Text>{IC.arrow_r()}
        </TouchableOpacity>
      ) : !editClaseId ? (
        <TouchableOpacity onPress={guardar} disabled={saving} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#16A34A', gap: 6 }}>
          {saving ? <ActivityIndicator color="#FFF" /> : <>{IC.save()}<Text style={{ fontWeight: '600', color: '#FFF' }}>Crear Clase Completa</Text></>}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ─── STEP 0: DATOS DE LA CLASE ─────────────────────────────
  const Step0 = () => (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={S.fieldLabel}>Nombre de la clase *</Text>
      <TextInput style={S.formInput} value={clase.nombre} onChangeText={v => setClase(p => ({ ...p, nombre: v }))} placeholder="Ej: 1º DAW Mañana A" placeholderTextColor="#CBD5E1" autoCapitalize="words" />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1 }}><Text style={S.fieldLabel}>Curso (1-4) *</Text><TextInput style={S.formInput} value={clase.curso} onChangeText={v => setClase(p => ({ ...p, curso: v }))} placeholder="1" keyboardType="numeric" placeholderTextColor="#CBD5E1" /></View>
        <View style={{ flex: 1 }}><Text style={S.fieldLabel}>Grupo *</Text><TextInput style={S.formInput} value={clase.grupo} onChangeText={v => setClase(p => ({ ...p, grupo: v }))} placeholder="A o Mañana" placeholderTextColor="#CBD5E1" autoCapitalize="characters" /></View>
      </View>

      <View style={{ marginTop: 14 }}>
        <SearchDrop label="Plan de estudio *" items={planes} selectedId={clase.id_plan} onSelect={v => setClase(p => ({ ...p, id_plan: v }))} displayKey={(p: any) => `${p.nombre} — v${p.version}`} idKey="id_plan" onCreate={() => setShowCreatePlan(true)} createLabel="Crear plan de estudio" />
      </View>
      <SearchDrop label="Centro *" items={centros} selectedId={clase.id_centro} onSelect={v => setClase(p => ({ ...p, id_centro: v }))} displayKey="nombre" idKey="id_centro" onCreate={() => setShowCreateCentro(true)} createLabel="Crear centro" />
      <SearchDrop label="Curso escolar *" items={cursosEsc} selectedId={clase.id_curso_escolar} onSelect={v => setClase(p => ({ ...p, id_curso_escolar: v }))} displayKey="nombre" idKey="id_curso_escolar" onCreate={() => setShowCreateCurso(true)} createLabel="Crear curso escolar" />
    </ScrollView>
  );

  // ─── STEP 1: SELECCIONAR ASIGNATURAS ───────────────────────
  const Step1 = () => {
    const cursoNum = parseInt(clase.curso) || 0;
    const filtered = ofertas.filter(o => o.curso === cursoNum || o.curso === 0);
    const allIds = filtered.map(o => o.id_oferta);
    const allSelected = allIds.length > 0 && allIds.every(id => ofertasSel.includes(id));

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>Asignaturas del plan para {clase.curso}º</Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Marca las que se impartirán en esta clase</Text>

        {/* Create buttons */}
        <TouchableOpacity onPress={() => { loadAllAsignaturas(); setShowCreateOferta(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
          <I d="M12 4v16m8-8H4" color="#16A34A" size={16} /><Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 13 }}>Añadir asignatura al plan</Text>
        </TouchableOpacity>

        {filtered.length === 0 && ofertas.length === 0 && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>Este plan no tiene asignaturas aún.</Text>
            <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center' }}>Usa el botón de arriba para crear asignaturas y vincularlas al plan.</Text>
          </View>
        )}

        {filtered.length > 0 && (
          <TouchableOpacity onPress={() => { if (allSelected) setOfertasSel(prev => prev.filter(id => !allIds.includes(id))); else setOfertasSel(prev => [...new Set([...prev, ...allIds])]); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F1F5F9', borderRadius: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: allSelected ? '#2563EB' : '#CBD5E1', backgroundColor: allSelected ? '#2563EB' : '#FFF', justifyContent: 'center', alignItems: 'center' }}>
              {allSelected && <I d="M5 13l4 4L19 7" color="#FFF" size={12} />}
            </View>
            <Text style={{ fontWeight: '600', color: '#334155', fontSize: 13 }}>Seleccionar todas ({filtered.length})</Text>
          </TouchableOpacity>
        )}

        {filtered.map(o => {
          const sel = ofertasSel.includes(o.id_oferta);
          return (
            <TouchableOpacity key={o.id_oferta} onPress={() => toggleOferta(o.id_oferta)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: sel ? '#EFF6FF' : '#FFF', borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: sel ? '#BFDBFE' : '#F1F5F9' }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: sel ? '#2563EB' : '#CBD5E1', backgroundColor: sel ? '#2563EB' : '#FFF', justifyContent: 'center', alignItems: 'center' }}>
                {sel && <I d="M5 13l4 4L19 7" color="#FFF" size={12} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: '#0F172A', fontSize: 13 }}>{o.nombre}</Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>{o.codigo}{o.horas ? ` · ${o.horas}h` : ''} · {o.obligatoria ? 'Obligatoria' : 'Optativa'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {ofertas.filter(o => o.curso !== cursoNum && o.curso !== 0).length > 0 && <>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 18, marginBottom: 8, textTransform: 'uppercase' }}>Otros cursos</Text>
          {ofertas.filter(o => o.curso !== cursoNum).map(o => {
            const sel = ofertasSel.includes(o.id_oferta);
            return (
              <TouchableOpacity key={o.id_oferta} onPress={() => toggleOferta(o.id_oferta)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, opacity: 0.7, marginBottom: 4 }}>
                <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: sel ? '#2563EB' : '#CBD5E1', backgroundColor: sel ? '#2563EB' : '#FFF', justifyContent: 'center', alignItems: 'center' }}>
                  {sel && <I d="M5 13l4 4L19 7" color="#FFF" size={11} />}
                </View>
                <Text style={{ fontSize: 12, color: '#64748B' }}>{o.nombre} ({o.codigo}) — {o.curso}º</Text>
              </TouchableOpacity>
            );
          })}
        </>}
      </ScrollView>
    );
  };

  // ─── STEP 2: ASIGNAR PROFESORES ────────────────────────────
  const Step2 = () => {
    if (loading) return <View style={S.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
    const selOfertas = ofertas.filter(o => ofertasSel.includes(o.id_oferta));
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>Asignar profesor a cada asignatura</Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Puedes dejar vacío si aún no sabes quién la dará</Text>
        <TouchableOpacity onPress={() => setShowCreatePersona('PROFESOR')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F0FDF4', borderRadius: 10 }}>
          <I d="M12 4v16m8-8H4" color="#16A34A" size={16} /><Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 12 }}>Dar de alta profesor</Text>
        </TouchableOpacity>
        {selOfertas.map(o => {
          const current = asignaciones.find(a => a.id_oferta === o.id_oferta);
          return (
            <View key={o.id_oferta} style={{ marginBottom: 6 }}>
              <SearchDrop label={`${o.nombre} (${o.codigo})`} items={[{ id_usuario_externo: '', nombre: 'Sin asignar', apellidos: '', dni: '' }, ...profesores]} selectedId={current?.id_profesor_externo || ''} onSelect={v => setProfesor(o.id_oferta, v)} displayKey={(p: any) => p.id_usuario_externo ? `${p.nombre} ${p.apellidos} — ${p.dni}` : 'Sin asignar'} idKey="id_usuario_externo" />
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ─── STEP 3: MATRICULAR ALUMNOS ────────────────────────────
  const Step3 = () => {
    const filteredAlumnos = alumnosDisp.filter(a => {
      if (!buscarAlumno) return true;
      const q = buscarAlumno.toLowerCase();
      return a.nombre.toLowerCase().includes(q) || a.apellidos.toLowerCase().includes(q) || a.dni.toLowerCase().includes(q);
    });

    const selOfertas = ofertas.filter(o => ofertasSel.includes(o.id_oferta));

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>Matricular alumnos</Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>Toca un alumno para añadirlo. Luego puedes personalizar sus asignaturas.</Text>

        {/* Search + add all */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 10 }}>
            {IC.search()}<TextInput style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, color: '#0F172A' }} placeholder="Buscar alumno..." placeholderTextColor="#CBD5E1" value={buscarAlumno} onChangeText={setBuscarAlumno} />
          </View>
          <TouchableOpacity onPress={addAllAlumnos} style={{ backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 11 }}>+ Todos</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setShowCreatePersona('ALUMNO')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F0FDF4', borderRadius: 10 }}>
          <I d="M12 4v16m8-8H4" color="#16A34A" size={16} /><Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 12 }}>Dar de alta alumno</Text>
        </TouchableOpacity>

        {/* Available */}
        <View style={{ maxHeight: 160, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 16 }}>
          <ScrollView nestedScrollEnabled>
            {filteredAlumnos.map(a => {
              const added = matriculas.some(m => m.id_alumno_externo === a.id_usuario_externo);
              return (
                <TouchableOpacity key={a.id_usuario_externo} onPress={() => addAlumno(a)} disabled={added}
                  style={{ flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', opacity: added ? 0.4 : 1 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{a.nombre} {a.apellidos}</Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{a.dni}</Text>
                  </View>
                  {added && <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '700', alignSelf: 'center' }}>Añadido</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Matriculated */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Matriculados ({matriculas.length})</Text>
        {matriculas.map(m => {
          const expanded = expandedAlumno === m.id_alumno_externo;
          return (
            <View key={m.id_alumno_externo} style={{ backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: expanded ? '#BFDBFE' : '#F1F5F9' }}>
              <TouchableOpacity onPress={() => setExpandedAlumno(expanded ? null : m.id_alumno_externo)} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{m.nombre[0]}{m.apellidos[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: '#0F172A', fontSize: 13 }}>{m.nombre} {m.apellidos}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{m.dni} · {m.ofertas_alumno.length}/{ofertasSel.length} asig.</Text>
                </View>
                <TouchableOpacity onPress={() => removeAlumno(m.id_alumno_externo)} hitSlop={8}>
                  <I d="M6 18L18 6M6 6l12 12" color="#EF4444" size={16} />
                </TouchableOpacity>
              </TouchableOpacity>

              {expanded && (
                <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 8, marginBottom: 6 }}>Asignaturas (desmarca las convalidadas):</Text>
                  {selOfertas.map(o => {
                    const active = m.ofertas_alumno.includes(o.id_oferta);
                    return (
                      <TouchableOpacity key={o.id_oferta} onPress={() => toggleAlumnoOferta(m.id_alumno_externo, o.id_oferta)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: active ? '#16A34A' : '#CBD5E1', backgroundColor: active ? '#16A34A' : '#FFF', justifyContent: 'center', alignItems: 'center' }}>
                          {active && <I d="M5 13l4 4L19 7" color="#FFF" size={11} />}
                        </View>
                        <Text style={{ fontSize: 12, color: active ? '#0F172A' : '#94A3B8', fontWeight: active ? '600' : '400', textDecorationLine: active ? 'none' : 'line-through' }}>{o.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {editClaseId && (m as any).id_matricula && (
                    <TouchableOpacity onPress={() => guardarAlumno(m)} style={{ marginTop: 8, backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 12 }}>Guardar cambios de este alumno</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ─── STEP 4: RESUMEN ───────────────────────────────────────
  const Step4 = () => {
    const selOfertas = ofertas.filter(o => ofertasSel.includes(o.id_oferta));
    const asigConProf = asignaciones.filter(a => a.id_profesor_externo && ofertasSel.includes(a.id_oferta));
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>{editClaseId ? 'Editar Clase' : 'Resumen'}</Text>

        <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
          <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 14, marginBottom: 8 }}>{clase.nombre} — {clase.curso}º{clase.grupo}</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>Plan: {planes.find(p => p.id_plan === clase.id_plan)?.nombre || '—'}</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>Centro: {centros.find(c => c.id_centro === clase.id_centro)?.nombre || '—'}</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>Curso escolar: {cursosEsc.find(c => c.id_curso_escolar === clase.id_curso_escolar)?.nombre || '—'}</Text>
        </View>

        <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
          <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13, marginBottom: 8 }}>{selOfertas.length} Asignaturas</Text>
          {selOfertas.map(o => {
            const prof = asigConProf.find(a => a.id_oferta === o.id_oferta);
            const profName = prof ? profesores.find(p => p.id_usuario_externo === prof.id_profesor_externo) : null;
            return (
              <View key={o.id_oferta} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>{o.nombre}</Text>
                <Text style={{ fontSize: 11, color: profName ? '#7C3AED' : '#CBD5E1' }}>{profName ? `${profName.nombre} ${profName.apellidos}` : 'Sin profesor'}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' }}>
          <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13, marginBottom: 8 }}>{matriculas.length} Alumnos</Text>
          {matriculas.slice(0, 10).map(m => (
            <View key={m.id_alumno_externo} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#334155' }}>{m.nombre} {m.apellidos}</Text>
              <Text style={{ fontSize: 11, color: m.ofertas_alumno.length < ofertasSel.length ? '#D97706' : '#16A34A' }}>
                {m.ofertas_alumno.length}/{ofertasSel.length} asig.
              </Text>
            </View>
          ))}
          {matriculas.length > 10 && <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>...y {matriculas.length - 10} más</Text>}
        </View>
      </ScrollView>
    );
  };

  // ─── MAIN RENDER ───────────────────────────────────────────
  if (step === -1) return <View style={S.center}><ActivityIndicator size="large" color="#2563EB" /><Text style={{ marginTop: 10, color: '#94A3B8' }}>Cargando clase...</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <TouchableOpacity onPress={onClose} style={{ marginRight: 12 }}>{IC.arrow_l()}</TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1 }}>{editClaseId ? 'Editar Clase' : 'Asistente — Nueva Clase'}</Text>
      </View>
      {StepBar()}
      <View style={{ flex: 1 }}>
        {step === 0 && Step0()}
        {step === 1 && Step1()}
        {step === 2 && Step2()}
        {step === 3 && Step3()}
        {step === 4 && Step4()}
      </View>
      {NavButtons()}

      {/* Quick Create Modals */}
      <CreateOfertaModal visible={showCreateOferta} onClose={() => setShowCreateOferta(false)} idPlan={clase.id_plan} cursoClase={clase.curso} allAsignaturas={allAsignaturas} onSave={reloadOfertas} />
      <QuickCreate visible={showCreatePlan} onClose={() => setShowCreatePlan(false)} title="Nuevo Plan de Estudio"
        fields={[{ key: 'nombre', label: 'Nombre', required: true, cap: 'words', placeholder: 'Ej: DAW' }, { key: 'version', label: 'Versión', required: true, placeholder: 'Ej: 1.0' }, { key: 'descripcion', label: 'Descripción', placeholder: 'Opcional' }]}
        onSave={async (d) => { await api('/admin/planes', { method: 'POST', data: d }); await reloadPlanes(); }} />
      <QuickCreate visible={showCreateCentro} onClose={() => setShowCreateCentro(false)} title="Nuevo Centro"
        fields={[{ key: 'codigo_centro', label: 'Código Centro', required: true, cap: 'characters', placeholder: '38000001' }, { key: 'nombre', label: 'Nombre', required: true, cap: 'words', placeholder: 'IES Ejemplo' }, { key: 'isla', label: 'Isla', cap: 'words' }, { key: 'municipio', label: 'Municipio', cap: 'words' }]}
        onSave={async (d) => { await api('/admin/centros', { method: 'POST', data: d }); await reloadCentros(); }} />
      <QuickCreate visible={showCreateCurso} onClose={() => setShowCreateCurso(false)} title="Nuevo Curso Escolar"
        fields={[{ key: 'nombre', label: 'Nombre', required: true, placeholder: '2025-2026' }, { key: 'fecha_inicio', label: 'Fecha inicio (YYYY-MM-DD)', placeholder: '2025-09-01' }, { key: 'fecha_fin', label: 'Fecha fin (YYYY-MM-DD)', placeholder: '2026-06-30' }]}
        onSave={async (d) => { await api('/admin/cursos-escolares', { method: 'POST', data: d }); await reloadCursos(); }} />
      <QuickCreate visible={!!showCreatePersona} onClose={() => setShowCreatePersona(null)} title={`Alta ${showCreatePersona === 'PROFESOR' ? 'Profesor' : 'Alumno'}`}
        fields={[{ key: 'dni', label: 'DNI', required: true, cap: 'characters', placeholder: '12345678A' }, { key: 'cial', label: 'CIAL', required: true, placeholder: 'CIAL' }, { key: 'nombre', label: 'Nombre', required: true, cap: 'words' }, { key: 'apellidos', label: 'Apellidos', required: true, cap: 'words' }, { key: 'email', label: 'Email', placeholder: 'Opcional' }, { key: 'telefono', label: 'Teléfono', placeholder: 'Opcional' }, { key: 'password', label: 'Contraseña', required: true, placeholder: 'Contraseña inicial' }]}
        onSave={async (d) => { await api('/admin/personas', { method: 'POST', data: { ...d, tipo: showCreatePersona, id_centro: clase.id_centro || centros[0]?.id_centro } }); if (showCreatePersona === 'PROFESOR') await reloadProfs(); else await reloadAlumnos(); }} />
    </View>
  );
}