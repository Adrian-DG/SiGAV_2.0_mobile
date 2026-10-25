import * as Crypto from 'expo-crypto';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import type { TipoEventoItem } from '@/features/catalogos/api';
import { useCatalogos } from '@/features/catalogos/catalogos-context';
import {
  listarMunicipios,
  listarPrefijosPlaca,
  listarProvincias,
  listarTiposEvento,
} from '@/features/catalogos/local/catalogos-local';
import { InvolucradoEditor } from '@/features/events/components/involucrado-editor';
import { nombresTipos, TiposEventoSelector } from '@/features/events/components/tipos-evento-selector';
import { VehiculoEditor } from '@/features/events/components/vehiculo-editor';
import { nombrePersona, ROL_LABEL, TiposAtendidos, VehiculoTarjeta } from '@/features/events/components/vehiculo-tarjeta';
import {
  guardarInvolucrado as conInvolucrado,
  guardarVehiculo as conVehiculo,
  MAX_PERSONAS,
  MAX_VEHICULOS,
  nuevoInvolucrado,
  nuevoVehiculo,
  ocupantesDe,
  personasSinVehiculo,
  quitarInvolucrado,
  quitarVehiculo,
  tieneConductor,
  tiposDelEvento,
  validarEvento,
  validarInvolucrado,
  validarVehiculo,
  type EventoForm,
  type InvolucradoForm,
  type VehiculoForm,
} from '@/features/events/form/evento-form';
import type { TipoEventoInfo } from '@/features/events/local/eventos-local';
import { RolCiudadanoValue, type RolCiudadano } from '@/features/events/types';
import { useCatalogo } from '@/hooks/use-catalogo';
import { useUbicacionActual } from '@/hooks/use-ubicacion-actual';
import { agentesDeLaUnidad, describirAgente } from '@/lib/jwt';
import { secureStorage } from '@/lib/storage';

const ULTIMO_MUNICIPIO_KEY = 'sigav_movil_ultimo_municipio';

/**
 * Lo que se está agregando o editando: ocupa toda la pantalla en lugar del formulario.
 * `original` es como estaba al abrirlo, para preguntar antes de descartar cambios.
 */
type Editor =
  | { tipo: 'vehiculo'; nuevo: boolean; original: VehiculoForm; draft: VehiculoForm }
  | { tipo: 'persona'; nuevo: boolean; original: InvolucradoForm; draft: InvolucradoForm }
  | null;

/** Un problema que impide guardar; los de un vehículo o persona abren su editor para corregirlo. */
type Problema = { key: string; texto: string; corregir?: () => void };

type EventoFormularioProps = {
  titulo: string;
  inicial: EventoForm;
  /** Al registrar se toma la ubicación del GPS; al editar se conserva la guardada. */
  capturarUbicacion: boolean;
  textoGuardar: string;
  /** Aviso breve tras guardar, ya de vuelta en el inicio. */
  mensajeGuardado: string;
  /** Mensaje informativo arriba del formulario (p. ej. el evento ya tiene tipo de cierre). */
  aviso?: string | null;
  /** Guarda en el dispositivo. Si lanza un error, se muestra y el formulario sigue abierto. */
  onGuardar: (form: EventoForm, tipos: TipoEventoInfo[]) => Promise<void>;
};

const iguales = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Formulario de evento de campo, para registrar uno nuevo o editar uno guardado en el dispositivo. */
export function EventoFormulario({
  titulo,
  inicial,
  capturarUbicacion,
  textoGuardar,
  mensajeGuardado,
  aviso,
  onGuardar,
}: EventoFormularioProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useSession();
  const token = session!.token;
  // Registrar toma el GPS; editar trabaja sobre un evento ya guardado
  const esNuevo = capturarUbicacion;

  const [form, setForm] = useState<EventoForm>(inicial);
  // Contra qué se comparan los cambios para preguntar antes de salir (incluye el municipio precargado)
  const [base, setBase] = useState<EventoForm>(inicial);
  const gps = useUbicacionActual(capturarUbicacion);
  const [editor, setEditor] = useState<Editor>(null);
  const [editorIntento, setEditorIntento] = useState(false);
  // Tras el primer intento de guardar, los errores se muestran y se actualizan al corregir
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [otrosAbierto, setOtrosAbierto] = useState(inicial.tipoEventoIds.length > 0);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const scrollAntesDelEditor = useRef(0);

  const catalogos = useCatalogos();
  const tipos = useCatalogo('tipos-evento', listarTiposEvento);
  const provincias = useCatalogo('provincias', listarProvincias);
  const provinciaId = form.provinciaId;
  const municipios = useCatalogo(provinciaId ? `municipios:${provinciaId}` : null, (db) => listarMunicipios(db, provinciaId!));
  const prefijos = useCatalogo('prefijos-placa', listarPrefijosPlaca);

  // Un evento nuevo: la unidad suele operar en la misma zona, se preselecciona el último municipio
  useEffect(() => {
    if (inicial.municipioId) return;
    secureStorage
      .getItem(ULTIMO_MUNICIPIO_KEY)
      .then((raw) => {
        if (!raw) return;
        const ultimo = JSON.parse(raw) as { provinciaId: number; municipioId: number };
        const precargar = (f: EventoForm) =>
          f.municipioId ? f : { ...f, provinciaId: ultimo.provinciaId, municipioId: ultimo.municipioId };
        setForm(precargar);
        setBase(precargar);
      })
      .catch(() => {});
  }, [inicial.municipioId]);

  // Con componente se elige cuál de los dos atiende. Si el evento quedó asignado a un agente que ya
  // no opera la unidad (se inició sesión con otro componente), pasa al agente de la sesión.
  const agentesUnidad = agentesDeLaUnidad(session!.agente);
  const agenteAtiendeId = agentesUnidad.some((a) => a.agenteId === form.agenteAtiendeId)
    ? form.agenteAtiendeId!
    : session!.agente.agenteId;

  const ubicacion = capturarUbicacion ? gps.ubicacion : form.ubicacion;
  const formCompleto: EventoForm = {
    ...form,
    ubicacion,
    agenteAtiendeId: agenteAtiendeId === session!.agente.agenteId ? null : agenteAtiendeId,
  };
  const errors = intento ? validarEvento(formCompleto, prefijos.items) : {};

  // ------------------------------------------------------------------ Salir sin perder datos

  const hayCambios = editor !== null || !iguales(form, base);

  // Cubre la ✕, el botón "atrás" de Android y el gesto de volver de iOS. Con el editor abierto,
  // "atrás" cierra el editor (no el evento).
  usePreventRemove(hayCambios && !guardado, ({ data }) => {
    if (editor) {
      cerrarEditor();
      return;
    }
    const registrados = [
      form.vehiculos.length ? plural(form.vehiculos.length, 'vehículo', 'vehículos') : null,
      form.involucrados.length ? plural(form.involucrados.length, 'persona', 'personas') : null,
    ].filter(Boolean);
    Alert.alert(
      esNuevo ? '¿Descartar el evento?' : '¿Descartar los cambios?',
      esNuevo
        ? `Se perderá lo registrado${registrados.length ? ` (${registrados.join(' y ')})` : ''}.`
        : 'Se perderán los cambios que no ha guardado.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  // Guardado: ya se puede salir (usePreventRemove necesita un render con `guardado` antes de volver)
  useEffect(() => {
    if (!guardado) return;
    toast.mostrar({ mensaje: mensajeGuardado, icono: 'exito' });
    router.back();
  }, [guardado, mensajeGuardado, router, toast]);

  // ------------------------------------------------------------------ Guardar el evento

  const problemas: Problema[] = [
    errors.ubicacion && { key: 'ubicacion', texto: errors.ubicacion },
    errors.municipio && { key: 'municipio', texto: errors.municipio },
    errors.tipos && { key: 'tipos', texto: errors.tipos },
    errors.vehiculos && { key: 'vehiculos', texto: errors.vehiculos },
    errors.personas && { key: 'personas', texto: errors.personas },
    ...form.vehiculos.map((v, i) => {
      const error = errors[`vehiculo.${v.key}`];
      return error && { key: v.key, texto: `Vehículo ${i + 1}: ${error}`, corregir: () => abrirVehiculo(v, true) };
    }),
    ...form.involucrados.map((inv) => {
      const error = errors[`involucrado.${inv.key}`];
      return (
        error && {
          key: inv.key,
          texto: `${ROL_LABEL[inv.rol] ?? 'Persona'} ${nombrePersona(inv)}: ${error}`,
          corregir: () => abrirPersona(inv, true),
        }
      );
    }),
  ].filter((p): p is Problema => !!p);

  async function guardar() {
    setIntento(true);
    setErrorGuardar(null);
    if (Object.keys(validarEvento(formCompleto, prefijos.items)).length > 0) {
      // El resumen de lo que falta está arriba del todo
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setGuardando(true);
    try {
      const ids = tiposDelEvento(formCompleto);
      const tiposInfo: TipoEventoInfo[] = tipos.items
        .filter((t: TipoEventoItem) => ids.includes(t.id))
        .map((t: TipoEventoItem) => ({ id: t.id, nombre: t.nombre, categoria: t.categoria }));
      await onGuardar(formCompleto, tiposInfo);
      await secureStorage
        .setItem(ULTIMO_MUNICIPIO_KEY, JSON.stringify({ provinciaId: form.provinciaId, municipioId: form.municipioId }))
        .catch(() => {});
      setGuardado(true);
    } catch (error) {
      setErrorGuardar(error instanceof Error ? error.message : 'No se pudo guardar el evento.');
    } finally {
      setGuardando(false);
    }
  }

  // ------------------------------------------------------------------ Editor de vehículo o persona

  // Al abrir el editor se ve desde arriba; al cerrarlo, el formulario vuelve a donde estaba
  const editorKey = editor?.draft.key ?? null;
  useEffect(() => {
    const y = editorKey ? 0 : scrollAntesDelEditor.current;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
  }, [editorKey]);

  function abrir(nuevoEditor: NonNullable<Editor>, mostrarErrores = false) {
    if (!editor) scrollAntesDelEditor.current = scrollY.current;
    setEditorIntento(mostrarErrores);
    setEditor(nuevoEditor);
  }

  const abrirVehiculo = (v: VehiculoForm, mostrarErrores = false) =>
    abrir({ tipo: 'vehiculo', nuevo: false, original: v, draft: v }, mostrarErrores);

  const abrirPersona = (inv: InvolucradoForm, mostrarErrores = false) =>
    abrir({ tipo: 'persona', nuevo: false, original: inv, draft: inv }, mostrarErrores);

  function agregarVehiculo() {
    const v = nuevoVehiculo(Crypto.randomUUID());
    abrir({ tipo: 'vehiculo', nuevo: true, original: v, draft: v });
  }

  function agregarPersona(rol: RolCiudadano, vehiculoKey: string | null = null) {
    const inv = nuevoInvolucrado(Crypto.randomUUID(), rol, vehiculoKey);
    abrir({ tipo: 'persona', nuevo: true, original: inv, draft: inv });
  }

  /** Cerrar sin guardar: si se cambió algo, se pregunta antes de descartarlo. */
  function cerrarEditor() {
    if (!editor) return;
    if (iguales(editor.draft, editor.original)) {
      setEditor(null);
      return;
    }
    const esVehiculo = editor.tipo === 'vehiculo';
    Alert.alert(
      editor.nuevo ? (esVehiculo ? '¿Descartar este vehículo?' : '¿Descartar esta persona?') : '¿Descartar los cambios?',
      editor.nuevo ? 'No se agregará al evento.' : `Se perderán los cambios ${esVehiculo ? 'del vehículo' : 'de la persona'}.`,
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => setEditor(null) },
      ],
    );
  }

  /** `otro`: abre enseguida uno nuevo del mismo tipo (N vehículos o N personas seguidas). */
  function guardarEditor(otro: boolean) {
    if (!editor) return;
    const errores =
      editor.tipo === 'vehiculo' ? validarVehiculo(editor.draft, form, prefijos.items) : validarInvolucrado(editor.draft, form);
    if (Object.keys(errores).length > 0) {
      setEditorIntento(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setEditorIntento(false);
    if (editor.tipo === 'vehiculo') {
      const vehiculo = editor.draft;
      const indice = editor.nuevo ? form.vehiculos.length + 1 : form.vehiculos.findIndex((v) => v.key === vehiculo.key) + 1;
      setForm((f) => conVehiculo(f, vehiculo));
      const hayCupo = form.vehiculos.length + (editor.nuevo ? 1 : 0) < MAX_VEHICULOS;
      if (otro && hayCupo) {
        const siguiente = nuevoVehiculo(Crypto.randomUUID());
        setEditor({ tipo: 'vehiculo', nuevo: true, original: siguiente, draft: siguiente });
        // La pantalla se ve igual: el aviso confirma que el anterior quedó guardado
        toast.mostrar({ mensaje: `Vehículo ${indice} guardado`, icono: 'exito' });
      } else {
        setEditor(null);
      }
    } else {
      const persona = editor.draft;
      setForm((f) => conInvolucrado(f, persona));
      const hayCupo = form.involucrados.length + (editor.nuevo ? 1 : 0) < MAX_PERSONAS;
      // Otra persona en el mismo vehículo: pasajero (el conductor ya está o era esta)
      const rol =
        persona.vehiculoKey && persona.rol === RolCiudadanoValue.Conductor ? RolCiudadanoValue.Pasajero : persona.rol;
      if (otro && hayCupo) {
        const siguiente = nuevoInvolucrado(Crypto.randomUUID(), rol, persona.vehiculoKey);
        setEditor({ tipo: 'persona', nuevo: true, original: siguiente, draft: siguiente });
        toast.mostrar({ mensaje: `Guardado: ${nombrePersona(persona)}`, icono: 'exito' });
      } else {
        setEditor(null);
      }
    }
  }

  // ------------------------------------------------------------------ Quitar, con "Deshacer"

  function quitarVehiculoConDeshacer(v: VehiculoForm, indice: number) {
    const ocupantes = ocupantesDe(form, v.key);
    setForm((f) => quitarVehiculo(f, v.key));
    toast.mostrar({
      mensaje: `Vehículo ${indice} quitado`,
      accion: {
        label: 'Deshacer',
        onPress: () =>
          setForm((f) => ({
            ...f,
            vehiculos: [...f.vehiculos.slice(0, indice - 1), v, ...f.vehiculos.slice(indice - 1)],
            involucrados: [...f.involucrados, ...ocupantes],
          })),
      },
    });
  }

  function quitarPersonaConDeshacer(inv: InvolucradoForm) {
    const posicion = form.involucrados.findIndex((i) => i.key === inv.key);
    setForm((f) => quitarInvolucrado(f, inv.key));
    toast.mostrar({
      mensaje: `Quitado: ${nombrePersona(inv)}`,
      accion: {
        label: 'Deshacer',
        onPress: () =>
          setForm((f) => ({ ...f, involucrados: [...f.involucrados.slice(0, posicion), inv, ...f.involucrados.slice(posicion)] })),
      },
    });
  }

  // ------------------------------------------------------------------ Vista

  const etiquetaVehiculo = (vehiculoKey: string) => {
    const indice = form.vehiculos.findIndex((v) => v.key === vehiculoKey);
    const v = form.vehiculos[indice];
    // El vehículo que se está editando aún no está guardado en el formulario
    return v ? `Vehículo ${indice + 1} · ${v.placa || 'sin placa'}` : 'Vehículo';
  };

  const sueltos = personasSinVehiculo(form);
  const totalTipos = tiposDelEvento(form).length;

  /** Copiar los tipos de los otros vehículos al que se edita (el más reciente primero). */
  const atajosVehiculo = (key: string) =>
    form.vehiculos
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.key !== key && v.tipoEventoIds.length > 0)
      .reverse()
      .slice(0, 2)
      .map(({ v, i }) => ({ label: `Igual que vehículo ${i + 1}`, ids: v.tipoEventoIds }));

  const tituloEditor = !editor
    ? titulo
    : editor.tipo === 'vehiculo'
      ? editor.nuevo
        ? `Agregar vehículo ${form.vehiculos.length + 1}`
        : etiquetaVehiculo(editor.draft.key)
      : editor.nuevo
        ? 'Agregar persona'
        : nombrePersona(editor.original);

  const hayCupoEditor =
    editor?.tipo === 'vehiculo' ? form.vehiculos.length + 1 < MAX_VEHICULOS : form.involucrados.length + 1 < MAX_PERSONAS;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader
        title={tituloEditor}
        left={editor ? <IconButton icon="atras" label="Volver al evento" onPress={cerrarEditor} /> : undefined}
        right={editor ? undefined : <IconButton icon="cerrar" label="Cerrar" onPress={() => router.back()} />}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={(e) => {
            if (!editor) scrollY.current = e.nativeEvent.contentOffset.y;
          }}>
          {editor?.tipo === 'vehiculo' && (
            <VehiculoEditor
              key={editor.draft.key}
              token={token}
              value={editor.draft}
              contexto={form}
              tipos={tipos.items}
              atajosTipos={atajosVehiculo(editor.draft.key)}
              onChange={(draft) => setEditor((e) => (e?.tipo === 'vehiculo' ? { ...e, draft } : e))}
              mostrarErrores={editorIntento}
            />
          )}
          {editor?.tipo === 'persona' && (
            <InvolucradoEditor
              key={editor.draft.key}
              token={token}
              value={editor.draft}
              contexto={form}
              etiquetaVehiculo={etiquetaVehiculo}
              tipos={tipos.items}
              onChange={(draft) => setEditor((e) => (e?.tipo === 'persona' ? { ...e, draft } : e))}
              mostrarErrores={editorIntento}
            />
          )}

          {!editor && (
            <>
              {problemas.length > 0 && <ResumenProblemas problemas={problemas} />}
              {!!aviso && <Text style={styles.aviso}>{aviso}</Text>}
              {catalogos.disponibles === false && (
                <Card style={styles.card}>
                  <Text style={styles.aviso}>
                    {catalogos.sincronizando
                      ? 'Descargando los catálogos (provincias, tipos de evento, vehículos…). Solo hace falta conexión esta vez.'
                      : `Los catálogos aún no se han descargado en este dispositivo. Conéctese a internet para descargarlos.${
                          catalogos.error ? ` (${catalogos.error})` : ''
                        }`}
                  </Text>
                  {!catalogos.sincronizando && <Button label="Descargar catálogos" variant="ghost" onPress={catalogos.sincronizar} />}
                </Card>
              )}

              {/* 1. Lo que se toma solo: ubicación, unidad, hora de llegada */}
              <Card style={styles.card}>
                <EstadoGps
                  capturar={capturarUbicacion}
                  estado={gps.estado}
                  ubicacion={ubicacion}
                  onReintentar={gps.reintentar}
                />
                <Text style={styles.contexto}>
                  Unidad {session!.agente.ficha} · Llegada{' '}
                  {new Date(form.fechaHoraLlegada).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}
                </Text>
                {agentesUnidad.length > 1 ? (
                  <View style={styles.agentes}>
                    <Text style={styles.fieldLabel}>¿Quién atiende?</Text>
                    <View style={styles.chips}>
                      {agentesUnidad.map((agente) => (
                        <Chip
                          key={agente.agenteId}
                          label={[agente.rango, agente.nombre].filter(Boolean).join(' ')}
                          selected={agente.agenteId === agenteAtiendeId}
                          onPress={() =>
                            setForm((f) => ({
                              ...f,
                              agenteAtiendeId: agente.agenteId === session!.agente.agenteId ? null : agente.agenteId,
                            }))
                          }
                        />
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.contexto}>Atiende: {describirAgente(session!.agente)}</Text>
                )}
              </Card>

              {/* 2. Lugar */}
              <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Lugar</Text>
                <SelectField
                  label="Provincia"
                  options={provincias.items}
                  loading={provincias.cargando}
                  value={form.provinciaId}
                  onChange={(id) => setForm((f) => ({ ...f, provinciaId: id, municipioId: null }))}
                />
                <SelectField
                  label="Municipio"
                  placeholder={form.provinciaId ? 'Seleccionar' : 'Elija primero la provincia'}
                  options={municipios.items}
                  loading={municipios.cargando}
                  disabled={!form.provinciaId}
                  value={form.municipioId}
                  onChange={(id) => setForm((f) => ({ ...f, municipioId: id }))}
                  errorText={errors.municipio}
                />
                <TextField
                  label="Referencia del lugar (opcional)"
                  placeholder="Ej. Km 12, frente a la bomba"
                  value={form.direccion}
                  onChangeText={(direccion) => setForm((f) => ({ ...f, direccion }))}
                />
              </Card>

              {/* 3. Atendidos: cada vehículo y cada persona con lo que pasó */}
              {tipos.cargando && <Text style={styles.muted}>Cargando tipos de evento…</Text>}
              {!!tipos.error && <Text style={styles.error}>{tipos.error}</Text>}

              <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Vehículos</Text>
                {form.vehiculos.length === 0 && (
                  <Text style={styles.muted}>
                    Agregue cada vehículo con lo que pasó (neumático, calentamiento, choque…) y luego su conductor y pasajeros.
                  </Text>
                )}
                {form.vehiculos.map((v, i) => (
                  <VehiculoTarjeta
                    key={v.key}
                    indice={i + 1}
                    vehiculo={v}
                    ocupantes={ocupantesDe(form, v.key)}
                    tipos={tipos.items}
                    error={errors[`vehiculo.${v.key}`]}
                    erroresPersona={(key) => errors[`involucrado.${key}`]}
                    puedeAgregarConductor={!tieneConductor(form, v.key)}
                    onEditar={() => abrirVehiculo(v, !!errors[`vehiculo.${v.key}`])}
                    onQuitar={() => quitarVehiculoConDeshacer(v, i + 1)}
                    onAgregarPersona={(rol) => agregarPersona(rol, v.key)}
                    onEditarPersona={(inv) => abrirPersona(inv, !!errors[`involucrado.${inv.key}`])}
                    onQuitarPersona={(key) => {
                      const inv = form.involucrados.find((x) => x.key === key);
                      if (inv) quitarPersonaConDeshacer(inv);
                    }}
                  />
                ))}
                {form.vehiculos.length < MAX_VEHICULOS && (
                  <Button label="Agregar vehículo" icon="agregar" variant="secondary" onPress={agregarVehiculo} />
                )}
              </Card>

              <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Peatones y otras personas</Text>
                {sueltos.length === 0 && <Text style={styles.muted}>Personas atendidas que no iban en un vehículo.</Text>}
                {sueltos.map((inv) => (
                  <View
                    key={inv.key}
                    style={[styles.involucrado, !!errors[`involucrado.${inv.key}`] && styles.involucradoError]}>
                    <Pressable
                      style={styles.flexFila}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${nombrePersona(inv)}`}
                      onPress={() => abrirPersona(inv, !!errors[`involucrado.${inv.key}`])}>
                      <Text style={styles.involucradoTitulo}>
                        {ROL_LABEL[inv.rol]}: {nombrePersona(inv)}
                      </Text>
                      <TiposAtendidos nombres={nombresTipos(tipos.items, inv.tipoEventoIds)} vacio="Falta lo que pasó" />
                      {!!errors[`involucrado.${inv.key}`] && <Text style={styles.error}>{errors[`involucrado.${inv.key}`]}</Text>}
                    </Pressable>
                    <IconButton
                      icon="quitar"
                      label={`Quitar a ${nombrePersona(inv)}`}
                      tint={Palette.danger[600]}
                      surface="light"
                      onPress={() => quitarPersonaConDeshacer(inv)}
                    />
                  </View>
                ))}
                {form.involucrados.length < MAX_PERSONAS && (
                  <Button
                    label="Agregar peatón"
                    icon="agregar"
                    variant="secondary"
                    onPress={() => agregarPersona(RolCiudadanoValue.Peaton)}
                  />
                )}
              </Card>

              {/* Lo que no es de un vehículo ni de una persona: plegado para no distraer */}
              {otrosAbierto || form.tipoEventoIds.length > 0 ? (
                <Card style={styles.card}>
                  <TiposEventoSelector
                    tipos={tipos.items}
                    label="¿Algo más atendido en la vía?"
                    ayuda="Solo lo que no corresponde a un vehículo ni a una persona: obstáculo, derrame, animal en la vía…"
                    value={form.tipoEventoIds}
                    onChange={(tipoEventoIds) => setForm((f) => ({ ...f, tipoEventoIds }))}
                  />
                </Card>
              ) : (
                <Button
                  label="Algo más en la vía (obstáculo, derrame…)"
                  icon="agregar"
                  variant="ghost"
                  onPress={() => setOtrosAbierto(true)}
                />
              )}

              <Card style={styles.card}>
                <TextField
                  label="Comentario (opcional)"
                  value={form.comentario}
                  onChangeText={(comentario) => setForm((f) => ({ ...f, comentario }))}
                  multiline
                  style={styles.comentario}
                />
              </Card>

              <Text style={[styles.muted, styles.centrado]}>
                Se guarda en este dispositivo como «En curso». Al terminar, ciérrelo y envíelo desde el inicio.
              </Text>
            </>
          )}
        </ScrollView>

        {/* Barra de acciones: siempre a la vista, una sola acción principal */}
        <View style={[styles.barra, { paddingBottom: insets.bottom + 12 }]}>
          {editor ? (
            <View style={styles.fila}>
              {editor.nuevo && hayCupoEditor && (
                <View style={styles.flex1}>
                  <Button
                    label={editor.tipo === 'vehiculo' ? 'Guardar y otro' : 'Guardar y otra'}
                    variant="outline"
                    onPress={() => guardarEditor(true)}
                  />
                </View>
              )}
              <View style={styles.flex1}>
                <Button
                  label={editor.tipo === 'vehiculo' ? 'Guardar vehículo' : 'Guardar persona'}
                  icon="check"
                  onPress={() => guardarEditor(false)}
                />
              </View>
            </View>
          ) : (
            <>
              {!!errorGuardar && (
                <Text style={[styles.error, styles.centrado]} accessibilityRole="alert">
                  {errorGuardar}
                </Text>
              )}
              <Text style={styles.resumenBarra}>
                {plural(form.vehiculos.length, 'vehículo', 'vehículos')} · {plural(form.involucrados.length, 'persona', 'personas')} ·{' '}
                {plural(totalTipos, 'tipo de evento', 'tipos de evento')}
              </Text>
              <Button label={textoGuardar} icon="check" onPress={guardar} loading={guardando} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Lo que falta para guardar, arriba del formulario. Tocar uno de un vehículo o persona lo abre. */
function ResumenProblemas({ problemas }: { problemas: Problema[] }) {
  return (
    <View style={styles.problemas} accessibilityRole="alert">
      <View style={styles.problemasTitulo}>
        <Icon name="error" color={Palette.danger[600]} size={22} />
        <Text style={styles.problemasTituloTexto}>
          {problemas.length === 1 ? 'Falta 1 dato para guardar' : `Faltan ${problemas.length} datos para guardar`}
        </Text>
      </View>
      {problemas.map((p) =>
        p.corregir ? (
          <Pressable
            key={p.key}
            accessibilityRole="button"
            accessibilityHint="Abre el registro para corregirlo"
            onPress={p.corregir}
            style={({ pressed }) => [styles.problema, pressed && styles.pressed]}>
            <Text style={[styles.problemaTexto, styles.flexFila]}>• {p.texto}</Text>
            <Text style={styles.corregir}>Corregir</Text>
          </Pressable>
        ) : (
          <View key={p.key} style={styles.problema}>
            <Text style={styles.problemaTexto}>• {p.texto}</Text>
          </View>
        ),
      )}
    </View>
  );
}

type EstadoGpsProps = {
  capturar: boolean;
  estado: ReturnType<typeof useUbicacionActual>['estado'];
  ubicacion: EventoForm['ubicacion'];
  onReintentar: () => void;
};

/** Estado de la ubicación en una línea de color: verde lista, ámbar buscando, rojo sin ubicación. */
function EstadoGps({ capturar, estado, ubicacion, onReintentar }: EstadoGpsProps) {
  const vista: { tono: 'ok' | 'espera' | 'error'; icono: IconName; texto: string } = !capturar
    ? ubicacion
      ? { tono: 'ok', icono: 'ubicacion', texto: 'Ubicación registrada' }
      : { tono: 'error', icono: 'ubicacionNo', texto: 'Sin ubicación registrada' }
    : estado === 'lista' && ubicacion
      ? {
          tono: 'ok',
          icono: 'ubicacion',
          texto: `Ubicación lista${ubicacion.precisionMetros ? ` (±${Math.round(ubicacion.precisionMetros)} m)` : ''}`,
        }
      : estado === 'buscando'
        ? { tono: 'espera', icono: 'ubicacionBuscando', texto: 'Buscando ubicación…' }
        : estado === 'denegada'
          ? { tono: 'error', icono: 'ubicacionNo', texto: 'Sin permiso de ubicación' }
          : { tono: 'error', icono: 'ubicacionNo', texto: 'No se pudo obtener la ubicación' };
  const tono = TONOS[vista.tono];

  return (
    <View style={[styles.gps, { backgroundColor: tono.fondo }]} accessibilityLiveRegion="polite">
      <Icon name={vista.icono} color={tono.texto} size={22} />
      <Text style={[styles.gpsTexto, { color: tono.texto }]}>{vista.texto}</Text>
      {capturar && vista.tono === 'error' && <Button label="Reintentar" variant="ghost" onPress={onReintentar} />}
    </View>
  );
}

const TONOS = {
  ok: { fondo: Palette.success[50], texto: Palette.success[700] },
  espera: { fondo: Palette.warning[50], texto: Palette.warning[900] },
  error: { fondo: Palette.danger[50], texto: Palette.danger[700] },
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Palette.neutral[50] },
  flex1: { flex: 1 },
  flexFila: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Palette.neutral[900] },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: Palette.neutral[700] },
  muted: { fontSize: 14, color: Palette.neutral[600] },
  error: { fontSize: 14, color: Palette.danger[600], fontWeight: '700' },
  centrado: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  aviso: {
    // warning[900] sobre warning[50]: contraste AA (mismo par que el aviso del login)
    color: Palette.warning[900],
    backgroundColor: Palette.warning[50],
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingLeft: 12,
    borderRadius: 12,
  },
  gpsTexto: { flex: 1, fontSize: 16, fontWeight: '700' },
  contexto: { fontSize: 14, color: Palette.neutral[700] },
  agentes: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  involucrado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingRight: 4,
    borderRadius: 12,
    backgroundColor: Palette.neutral[50],
    borderWidth: 1,
    borderColor: Palette.neutral[200],
  },
  involucradoError: { borderColor: Palette.danger[500], borderWidth: 2 },
  involucradoTitulo: { fontSize: 16, fontWeight: '700', color: Palette.neutral[900] },
  comentario: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  problemas: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Palette.danger[50],
    borderWidth: 2,
    borderColor: Palette.danger[200],
  },
  problemasTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  problemasTituloTexto: { fontSize: 17, fontWeight: '800', color: Palette.danger[700] },
  problema: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  problemaTexto: { fontSize: 15, fontWeight: '600', color: Palette.danger[800] },
  corregir: { fontSize: 15, fontWeight: '800', color: Palette.primary[600], paddingVertical: 8, paddingLeft: 8 },
  barra: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Palette.white,
    borderTopWidth: 1,
    borderTopColor: Palette.neutral[200],
  },
  fila: { flexDirection: 'row', gap: 10 },
  resumenBarra: { fontSize: 14, fontWeight: '600', color: Palette.neutral[700], textAlign: 'center' },
});
