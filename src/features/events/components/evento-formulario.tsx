import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
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
import { VehiculoEditor } from '@/features/events/components/vehiculo-editor';
import { nombrePersona, ROL_LABEL, VehiculoTarjeta } from '@/features/events/components/vehiculo-tarjeta';
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
  toggleTipoEvento,
  validarEvento,
  type EventoForm,
  type FormErrors,
  type InvolucradoForm,
  type VehiculoForm,
} from '@/features/events/form/evento-form';
import type { TipoEventoInfo } from '@/features/events/local/eventos-local';
import { CategoriaEventoValue, RolCiudadanoValue, type RolCiudadano } from '@/features/events/types';
import { useCatalogo } from '@/hooks/use-catalogo';
import { useUbicacionActual } from '@/hooks/use-ubicacion-actual';
import { secureStorage } from '@/lib/storage';

const ULTIMO_MUNICIPIO_KEY = 'sigav_movil_ultimo_municipio';

/** Lo que se está agregando o editando: ocupa el lugar de las secciones de vehículos y personas. */
type Editor =
  | { tipo: 'vehiculo'; nuevo: boolean; draft: VehiculoForm }
  | { tipo: 'persona'; nuevo: boolean; draft: InvolucradoForm }
  | null;

type EventoFormularioProps = {
  titulo: string;
  inicial: EventoForm;
  /** Al registrar se toma la ubicación del GPS; al editar se conserva la guardada. */
  capturarUbicacion: boolean;
  textoGuardar: string;
  /** Mensaje informativo arriba del formulario (p. ej. el evento ya tiene tipo de cierre). */
  aviso?: string | null;
  /** Guarda en el dispositivo. Si lanza un error, se muestra y el formulario sigue abierto. */
  onGuardar: (form: EventoForm, tipos: TipoEventoInfo[]) => Promise<void>;
};

/** Formulario de evento de campo, para registrar uno nuevo o editar uno guardado en el dispositivo. */
export function EventoFormulario({ titulo, inicial, capturarUbicacion, textoGuardar, aviso, onGuardar }: EventoFormularioProps) {
  const router = useRouter();
  const { session } = useSession();
  const token = session!.token;

  const [form, setForm] = useState<EventoForm>(inicial);
  const gps = useUbicacionActual(capturarUbicacion);
  const [editor, setEditor] = useState<Editor>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

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
        setForm((f) => (f.municipioId ? f : { ...f, provinciaId: ultimo.provinciaId, municipioId: ultimo.municipioId }));
      })
      .catch(() => {});
  }, [inicial.municipioId]);

  const ubicacion = capturarUbicacion ? gps.ubicacion : form.ubicacion;
  const formCompleto: EventoForm = { ...form, ubicacion };

  async function guardar() {
    const errores = validarEvento(formCompleto, prefijos.items);
    setErrors(errores);
    setErrorGuardar(null);
    if (Object.keys(errores).length > 0) return;

    setGuardando(true);
    try {
      const tiposInfo: TipoEventoInfo[] = tipos.items
        .filter((t: TipoEventoItem) => formCompleto.tipoEventoIds.includes(t.id))
        .map((t: TipoEventoItem) => ({ id: t.id, nombre: t.nombre, categoria: t.categoria }));
      await onGuardar(formCompleto, tiposInfo);
      await secureStorage
        .setItem(ULTIMO_MUNICIPIO_KEY, JSON.stringify({ provinciaId: form.provinciaId, municipioId: form.municipioId }))
        .catch(() => {});
      router.back();
    } catch (error) {
      setErrorGuardar(error instanceof Error ? error.message : 'No se pudo guardar el evento.');
    } finally {
      setGuardando(false);
    }
  }

  function guardarEditor() {
    if (!editor) return;
    if (editor.tipo === 'vehiculo') {
      const vehiculo = editor.draft;
      setForm((f) => conVehiculo(f, vehiculo));
    } else {
      const persona = editor.draft;
      setForm((f) => conInvolucrado(f, persona));
    }
    setEditor(null);
  }

  const agregarPersona = (rol: RolCiudadano, vehiculoKey: string | null = null) =>
    setEditor({ tipo: 'persona', nuevo: true, draft: nuevoInvolucrado(Crypto.randomUUID(), rol, vehiculoKey) });

  const etiquetaVehiculo = (vehiculoKey: string) => {
    const indice = form.vehiculos.findIndex((v) => v.key === vehiculoKey);
    const v = form.vehiculos[indice];
    // El vehículo que se está editando aún no está guardado en el formulario
    return v ? `Vehículo ${indice + 1} · ${v.placa || 'sin placa'}` : 'Vehículo';
  };

  const sueltos = personasSinVehiculo(form);

  const tiposPorCategoria = (categoria: number) => tipos.items.filter((t: TipoEventoItem) => t.categoria === categoria);

  const textoUbicacion = !capturarUbicacion
    ? ubicacion
      ? `${ubicacion.latitud.toFixed(5)}, ${ubicacion.longitud.toFixed(5)} (registrada)`
      : 'No registrada'
    : gps.estado === 'lista' && ubicacion
      ? `${ubicacion.latitud.toFixed(5)}, ${ubicacion.longitud.toFixed(5)}${ubicacion.precisionMetros ? ` (±${Math.round(ubicacion.precisionMetros)} m)` : ''}`
      : gps.estado === 'buscando'
        ? 'Obteniendo…'
        : gps.estado === 'denegada'
          ? 'Permiso de ubicación denegado'
          : 'No se pudo obtener';

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title={titulo} right={<IconButton glyph="✕" label="Cerrar" onPress={() => router.back()} />} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

          {/* 1. Datos que no dependen del agente */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Evento en campo</Text>
            <Dato label="Unidad" value={session!.agente.ficha} />
            <Dato
              label="Agente"
              value={[session!.agente.rango, session!.agente.nombre, session!.agente.institucion].filter(Boolean).join(' · ')}
            />
            <Dato
              label="Llegada"
              value={new Date(form.fechaHoraLlegada).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}
            />
            <Dato label="Ubicación" value={textoUbicacion} />
            {capturarUbicacion && (gps.estado === 'denegada' || gps.estado === 'error') && (
              <Button label="Reintentar ubicación" variant="ghost" onPress={gps.reintentar} />
            )}
            {!!errors.ubicacion && <Text style={styles.error}>{errors.ubicacion}</Text>}
          </Card>

          {/* 2. Municipio */}
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

          {/* 3. Tipos de evento */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Tipo de evento</Text>
            {tipos.cargando && <Text style={styles.muted}>Cargando…</Text>}
            {!!tipos.error && <Text style={styles.error}>{tipos.error}</Text>}
            {[
              { categoria: CategoriaEventoValue.Asistencia, titulo: 'Asistencias' },
              { categoria: CategoriaEventoValue.Accidente, titulo: 'Accidentes' },
            ].map(({ categoria, titulo: tituloGrupo }) =>
              tiposPorCategoria(categoria).length === 0 ? null : (
                <View key={categoria} style={styles.chipGroup}>
                  <Text style={styles.fieldLabel}>{tituloGrupo}</Text>
                  <View style={styles.chips}>
                    {tiposPorCategoria(categoria).map((t) => (
                      <Chip
                        key={t.id}
                        label={t.nombre}
                        selected={form.tipoEventoIds.includes(t.id)}
                        onPress={() => setForm((f) => toggleTipoEvento(f, t.id))}
                      />
                    ))}
                  </View>
                </View>
              ),
            )}
            {!!errors.tipos && <Text style={styles.error}>{errors.tipos}</Text>}
          </Card>

          {/* 4. Vehículos con sus ocupantes, y personas sin vehículo */}
          {editor?.tipo === 'vehiculo' && (
            <VehiculoEditor
              token={token}
              titulo={editor.nuevo ? 'Nuevo vehículo' : etiquetaVehiculo(editor.draft.key)}
              value={editor.draft}
              contexto={form}
              onChange={(draft) => setEditor((e) => (e?.tipo === 'vehiculo' ? { ...e, draft } : e))}
              onSave={guardarEditor}
              onCancel={() => setEditor(null)}
            />
          )}
          {editor?.tipo === 'persona' && (
            <InvolucradoEditor
              token={token}
              value={editor.draft}
              contexto={form}
              etiquetaVehiculo={etiquetaVehiculo}
              onChange={(draft) => setEditor((e) => (e?.tipo === 'persona' ? { ...e, draft } : e))}
              onSave={guardarEditor}
              onCancel={() => setEditor(null)}
            />
          )}

          {!editor && (
            <>
              <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Vehículos</Text>
                {form.vehiculos.length === 0 && (
                  <Text style={styles.muted}>Agregue cada vehículo involucrado y luego su conductor y pasajeros.</Text>
                )}
                {form.vehiculos.map((v, i) => (
                  <VehiculoTarjeta
                    key={v.key}
                    indice={i + 1}
                    vehiculo={v}
                    ocupantes={ocupantesDe(form, v.key)}
                    error={errors[`vehiculo.${v.key}`]}
                    erroresPersona={(key) => errors[`involucrado.${key}`]}
                    puedeAgregarConductor={!tieneConductor(form, v.key)}
                    onEditar={() => setEditor({ tipo: 'vehiculo', nuevo: false, draft: v })}
                    onQuitar={() => setForm((f) => quitarVehiculo(f, v.key))}
                    onAgregarPersona={(rol) => agregarPersona(rol, v.key)}
                    onEditarPersona={(inv) => setEditor({ tipo: 'persona', nuevo: false, draft: inv })}
                    onQuitarPersona={(key) => setForm((f) => quitarInvolucrado(f, key))}
                  />
                ))}
                {!!errors.vehiculos && <Text style={styles.error}>{errors.vehiculos}</Text>}
                {form.vehiculos.length < MAX_VEHICULOS && (
                  <Button
                    label="+ Agregar vehículo"
                    variant="secondary"
                    onPress={() => setEditor({ tipo: 'vehiculo', nuevo: true, draft: nuevoVehiculo(Crypto.randomUUID()) })}
                  />
                )}
              </Card>

              <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Peatones</Text>
                {sueltos.length === 0 && (
                  <Text style={styles.muted}>Personas involucradas que no iban en un vehículo.</Text>
                )}
                {sueltos.map((inv) => (
                  <View key={inv.key} style={styles.involucrado}>
                    <Pressable
                      style={styles.flex}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${nombrePersona(inv)}`}
                      onPress={() => setEditor({ tipo: 'persona', nuevo: false, draft: inv })}>
                      <Text style={styles.involucradoTitulo}>
                        {ROL_LABEL[inv.rol]}: {nombrePersona(inv)}
                      </Text>
                      {!!errors[`involucrado.${inv.key}`] && <Text style={styles.error}>{errors[`involucrado.${inv.key}`]}</Text>}
                    </Pressable>
                    <IconButton
                      glyph="🗑"
                      label={`Quitar a ${nombrePersona(inv)}`}
                      tint={Palette.neutral[600]}
                      onPress={() => setForm((f) => quitarInvolucrado(f, inv.key))} />
                  </View>
                ))}
                {!!errors.personas && <Text style={styles.error}>{errors.personas}</Text>}
                {form.involucrados.length < MAX_PERSONAS && (
                  <Button label="+ Agregar persona" variant="secondary" onPress={() => agregarPersona(RolCiudadanoValue.Peaton)} />
                )}
              </Card>
            </>
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

          {!!errorGuardar && <Text style={[styles.error, styles.centrado]}>{errorGuardar}</Text>}
          <Button label={textoGuardar} onPress={guardar} loading={guardando} disabled={!!editor} />
          {!!editor && (
            <Text style={styles.muted}>Guarde o cancele {editor.tipo === 'vehiculo' ? 'el vehículo' : 'la persona'} en edición para continuar.</Text>
          )}
          <Text style={[styles.muted, styles.centrado]}>
            Se guarda en este dispositivo. Se envía cuando cierre el evento y lo envíe desde el inicio.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoLabel}>{label}</Text>
      <Text style={styles.datoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Palette.neutral[50] },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Palette.neutral[900] },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600] },
  muted: { fontSize: 13, color: Palette.neutral[600] },
  error: { fontSize: 13, color: Palette.danger[600], fontWeight: '600' },
  centrado: { textAlign: 'center' },
  aviso: {
    // warning[900] sobre warning[50]: contraste AA (mismo par que el aviso del login)
    color: Palette.warning[900],
    backgroundColor: Palette.warning[50],
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  datoLabel: { fontSize: 13, color: Palette.neutral[600], fontWeight: '600' },
  datoValue: { flexShrink: 1, fontSize: 13, color: Palette.neutral[900], textAlign: 'right' },
  chipGroup: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  involucrado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Palette.neutral[50],
    borderWidth: 1,
    borderColor: Palette.neutral[200],
  },
  involucradoTitulo: { fontSize: 14, fontWeight: '700', color: Palette.neutral[900] },
  comentario: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
});
