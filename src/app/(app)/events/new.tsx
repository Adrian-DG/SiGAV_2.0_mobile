import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import { getMunicipios, getProvincias, getTiposEvento, type TipoEventoItem } from '@/features/catalogos/api';
import { registrarEvento } from '@/features/events/api';
import { InvolucradoEditor } from '@/features/events/components/involucrado-editor';
import {
  nuevoEventoForm,
  nuevoInvolucrado,
  toggleTipoEvento,
  toRegistrarEventoRequest,
  validarEvento,
  type EventoForm,
  type FormErrors,
  type InvolucradoForm,
} from '@/features/events/form/evento-form';
import { CategoriaEventoValue, RolCiudadanoValue, type RegistrarEventoResult } from '@/features/events/types';
import { useCatalogo } from '@/hooks/use-catalogo';
import { useUbicacionActual } from '@/hooks/use-ubicacion-actual';
import { ApiError } from '@/lib/api-client';
import { secureStorage } from '@/lib/storage';

const ULTIMO_MUNICIPIO_KEY = 'sigav_movil_ultimo_municipio';

const ROL_LABEL: Record<number, string> = {
  [RolCiudadanoValue.Conductor]: 'Conductor',
  [RolCiudadanoValue.Pasajero]: 'Pasajero',
  [RolCiudadanoValue.Peaton]: 'Peatón',
  [RolCiudadanoValue.Paciente]: 'Paciente',
  [RolCiudadanoValue.Otro]: 'Otro',
};

type Editor = { index: number | null; draft: InvolucradoForm } | null;

export default function NewEventScreen() {
  const router = useRouter();
  const { session } = useSession();
  const token = session!.token;

  // requestId y hora de llegada se fijan al abrir el formulario: reintentos del mismo envío usan
  // la misma clave (la API no duplica) y la llegada es cuando el agente encontró el evento.
  const [form, setForm] = useState<EventoForm>(() => nuevoEventoForm(Crypto.randomUUID()));
  const { ubicacion, estado: estadoUbicacion, reintentar: reintentarUbicacion } = useUbicacionActual();
  const [editor, setEditor] = useState<Editor>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState<RegistrarEventoResult | null>(null);

  const tipos = useCatalogo('tipos-evento', () => getTiposEvento(token));
  const provincias = useCatalogo('provincias', () => getProvincias(token));
  const provinciaId = form.provinciaId;
  const municipios = useCatalogo(provinciaId ? `municipios:${provinciaId}` : null, () => getMunicipios(token, provinciaId!));

  // La unidad suele operar en la misma zona: se preselecciona el último municipio usado
  useEffect(() => {
    secureStorage
      .getItem(ULTIMO_MUNICIPIO_KEY)
      .then((raw) => {
        if (!raw) return;
        const ultimo = JSON.parse(raw) as { provinciaId: number; municipioId: number };
        setForm((f) => (f.municipioId ? f : { ...f, provinciaId: ultimo.provinciaId, municipioId: ultimo.municipioId }));
      })
      .catch(() => {});
  }, []);

  const formCompleto: EventoForm = { ...form, ubicacion };

  async function enviar() {
    const errores = validarEvento(formCompleto);
    setErrors(errores);
    setErrorEnvio(null);
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);
    try {
      const resultado = await registrarEvento(token, toRegistrarEventoRequest(formCompleto));
      await secureStorage
        .setItem(ULTIMO_MUNICIPIO_KEY, JSON.stringify({ provinciaId: form.provinciaId, municipioId: form.municipioId }))
        .catch(() => {});
      setRegistrado(resultado);
    } catch (error) {
      setErrorEnvio(
        error instanceof ApiError
          ? [error.message, ...Object.values(error.errors ?? {}).flat()].join('\n')
          : 'No se pudo registrar el evento.',
      );
    } finally {
      setEnviando(false);
    }
  }

  function guardarInvolucrado() {
    if (!editor) return;
    setForm((f) => {
      const involucrados = [...f.involucrados];
      if (editor.index === null) involucrados.push(editor.draft);
      else involucrados[editor.index] = editor.draft;
      return { ...f, involucrados };
    });
    setEditor(null);
  }

  if (registrado) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScreenHeader title="Evento registrado" />
        <View style={styles.success}>
          <EmptyState
            glyph="✓"
            title={`Evento No. ${registrado.id}`}
            description={
              registrado.esDuplicado
                ? 'Este evento ya estaba registrado; no se creó un duplicado.'
                : 'Quedó registrado en curso. Complételo desde el inicio cuando termine la asistencia.'
            }
          />
          <Button label="Volver al inicio" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const tiposPorCategoria = (categoria: number) => tipos.items.filter((t: TipoEventoItem) => t.categoria === categoria);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader
        title="Registrar evento"
        right={<IconButton glyph="✕" label="Cerrar" onPress={() => router.back()} />}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* 1. Datos que no dependen del agente */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Evento en campo</Text>
            <Dato label="Unidad" value={`${session!.agente.ficha ?? '—'} · ${session!.agente.nombre ?? ''}`} />
            <Dato label="Llegada" value={new Date(form.fechaHoraLlegada).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })} />
            <Dato
              label="Ubicación"
              value={
                estadoUbicacion === 'lista' && ubicacion
                  ? `${ubicacion.latitud.toFixed(5)}, ${ubicacion.longitud.toFixed(5)}${ubicacion.precisionMetros ? ` (±${Math.round(ubicacion.precisionMetros)} m)` : ''}`
                  : estadoUbicacion === 'buscando'
                    ? 'Obteniendo…'
                    : estadoUbicacion === 'denegada'
                      ? 'Permiso de ubicación denegado'
                      : 'No se pudo obtener'
              }
            />
            {(estadoUbicacion === 'denegada' || estadoUbicacion === 'error') && (
              <Button label="Reintentar ubicación" variant="ghost" onPress={reintentarUbicacion} />
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
            ].map(({ categoria, titulo }) =>
              tiposPorCategoria(categoria).length === 0 ? null : (
                <View key={categoria} style={styles.chipGroup}>
                  <Text style={styles.fieldLabel}>{titulo}</Text>
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

          {/* 4. Personas y vehículos */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Personas y vehículos</Text>
            {form.involucrados.length === 0 && !editor && (
              <Text style={styles.muted}>Agregue a cada persona involucrada y, si aplica, su vehículo.</Text>
            )}
            {form.involucrados.map((inv, index) =>
              editor?.index === index ? null : (
                <View key={inv.key} style={styles.involucrado}>
                  <Pressable
                    style={styles.flex}
                    accessibilityRole="button"
                    accessibilityLabel="Editar persona"
                    onPress={() => setEditor({ index, draft: inv })}>
                    <Text style={styles.involucradoTitulo}>
                      {ROL_LABEL[inv.rol]}: {`${inv.nombre} ${inv.apellido}`.trim() || inv.identificacion || 'Persona no identificada'}
                    </Text>
                    {inv.conVehiculo && (
                      <Text style={styles.muted}>
                        Vehículo {inv.vehiculo.placa || 'sin placa'}
                      </Text>
                    )}
                    {!!errors[`involucrado.${index}`] && <Text style={styles.error}>{errors[`involucrado.${index}`]}</Text>}
                  </Pressable>
                  <IconButton
                    glyph="🗑"
                    label="Quitar persona"
                    onPress={() => setForm((f) => ({ ...f, involucrados: f.involucrados.filter((_, i) => i !== index) }))}
                  />
                </View>
              ),
            )}
            {editor ? (
              <InvolucradoEditor
                token={token}
                value={editor.draft}
                onChange={(draft) => setEditor((e) => (e ? { ...e, draft } : e))}
                onSave={guardarInvolucrado}
                onCancel={() => setEditor(null)}
              />
            ) : (
              <Button
                label="+ Agregar persona"
                variant="secondary"
                onPress={() => setEditor({ index: null, draft: nuevoInvolucrado(Crypto.randomUUID()) })}
              />
            )}
          </Card>

          <Card style={styles.card}>
            <TextField
              label="Comentario (opcional)"
              value={form.comentario}
              onChangeText={(comentario) => setForm((f) => ({ ...f, comentario }))}
              multiline
              style={styles.comentario}
            />
          </Card>

          {!!errorEnvio && <Text style={[styles.error, styles.errorEnvio]}>{errorEnvio}</Text>}
          <Button
            label="Registrar evento"
            onPress={enviar}
            loading={enviando}
            disabled={!!editor}
          />
          {!!editor && <Text style={styles.muted}>Guarde o cancele la persona en edición para registrar.</Text>}
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
  errorEnvio: { textAlign: 'center' },
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
  success: { flex: 1, justifyContent: 'center', padding: 20, gap: 16 },
});
