import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Palette } from '@/constants/colors';
import type { TipoEventoItem } from '@/features/catalogos/api';
import {
  listarColores,
  listarMarcas,
  listarModelos,
  listarPrefijosPlaca,
  listarTiposVehiculo,
} from '@/features/catalogos/local/catalogos-local';
import { buscarVehiculo } from '@/features/historico/api';
import { FotoEvidenciaFila } from '@/features/scan/foto-evidencia';
import { leerPlaca } from '@/features/scan/lectura';
import { ScannerSheet } from '@/features/scan/scanner-sheet';
import { useCatalogo } from '@/hooks/use-catalogo';
import { ApiError } from '@/lib/api-client';

import {
  aplicarVehiculoConocido,
  formatPlaca,
  PLACA_MAX_LENGTH,
  puedeBuscarPlaca,
  validarVehiculo,
  type ContextoEvento,
  type VehiculoForm,
} from '../form/evento-form';
import { analizarPlaca, prefijoPorIniciales, tipoPorPlaca, tipoTrasCambiarPlaca, type AnalisisPlaca } from '../form/placa';
import { EstadoBusqueda, fechaCorta, type Busqueda } from './estado-busqueda';
import { TiposEventoSelector, type AtajoTipos } from './tipos-evento-selector';

type VehiculoEditorProps = {
  token: string;
  titulo: string;
  value: VehiculoForm;
  /** Vehículos y personas del evento (para no repetir la placa). */
  contexto: ContextoEvento;
  tipos: TipoEventoItem[];
  /** Copiar los tipos de otro vehículo del evento. */
  atajosTipos?: AtajoTipos[];
  onChange: (value: VehiculoForm) => void;
  /** `otro`: al guardar, abrir enseguida un vehículo nuevo. */
  onSave: (otro: boolean) => void;
  onCancel: () => void;
};

/** "Desconocido" no contradice ningún prefijo de placa. */
const esComodin = (nombre: string) => /desconocid/i.test(nombre);

export function VehiculoEditor({ token, titulo, value, contexto, tipos, atajosTipos, onChange, onSave, onCancel }: VehiculoEditorProps) {
  const [busqueda, setBusqueda] = useState<Busqueda>({ estado: 'idle' });
  // El agente eligió "no está en la lista": se muestra el campo de texto libre
  const [marcaManual, setMarcaManual] = useState(!!value.marcaTexto);
  const [modeloManual, setModeloManual] = useState(!!value.modeloTexto);
  const [colorManual, setColorManual] = useState(!!value.colorTexto);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [escaneando, setEscaneando] = useState(false);

  const prefijos = useCatalogo('prefijos-placa', listarPrefijosPlaca);
  const tiposVehiculo = useCatalogo('tipos-vehiculo', listarTiposVehiculo);
  const marcas = useCatalogo('marcas', listarMarcas);
  const marcaId = value.marcaId;
  const modelos = useCatalogo(marcaId ? `modelos:${marcaId}` : null, (db) => listarModelos(db, marcaId!));
  const colores = useCatalogo('colores', listarColores);

  const comodines = tiposVehiculo.items.filter((t) => esComodin(t.nombre)).map((t) => t.id);
  const analisis = analizarPlaca(value.placa, value.placaNoEstandar, value.tipoVehiculoId, prefijos.items, comodines);
  const errores = intentoGuardar ? validarVehiculo(value, contexto, prefijos.items) : {};
  const set = (cambios: Partial<VehiculoForm>) => onChange({ ...value, ...cambios });

  const nombreTipo = (id: number) => tiposVehiculo.items.find((t) => t.id === id)?.nombre ?? `#${id}`;

  /** El vehículo con otra placa y, si el agente no eligió el tipo a mano, el tipo según las iniciales (A → Carro). */
  function conPlaca(cambios: Pick<VehiculoForm, 'placa' | 'placaNoEstandar'>): VehiculoForm {
    const tipoVehiculoId = tipoTrasCambiarPlaca(value, cambios.placa, cambios.placaNoEstandar, prefijos.items);
    return { ...value, ...cambios, tipoVehiculoId, origen: cambios.placa !== value.placa ? null : value.origen };
  }
  const cambiarPlaca = (cambios: Pick<VehiculoForm, 'placa' | 'placaNoEstandar'>) => onChange(conPlaca(cambios));

  // Iniciales con varios tipos posibles (G → Jeep o Jeepeta): se ofrecen para elegir con un toque
  const prefijo = value.placaNoEstandar ? null : prefijoPorIniciales(value.placa, prefijos.items);
  const tiposDePlaca = (prefijo?.tipoVehiculoIds ?? []).filter((id) => tiposVehiculo.items.some((t) => t.id === id));

  /** `actual`: el vehículo recién cambiado (p. ej. con la placa leída de la foto), aún no en `value`. */
  async function buscarPlaca(actual: VehiculoForm = value) {
    if (!puedeBuscarPlaca(actual.placa)) return;
    setBusqueda({ estado: 'buscando' });
    try {
      const conocido = await buscarVehiculo(token, actual.placa);
      if (conocido) {
        // El histórico manda sobre el tipo que la placa eligió sola (no sobre uno elegido a mano)
        const tipoAutomatico = !actual.placaNoEstandar && actual.tipoVehiculoId === tipoPorPlaca(actual.placa, prefijos.items);
        const base = tipoAutomatico ? { ...actual, tipoVehiculoId: null } : actual;
        const completado = aplicarVehiculoConocido(base, conocido);
        const vehiculo = completado.tipoVehiculoId ? completado : { ...completado, tipoVehiculoId: actual.tipoVehiculoId };
        onChange(vehiculo);
        setMarcaManual(!vehiculo.marcaId && !!vehiculo.marcaTexto);
        setModeloManual(!vehiculo.modeloId && !!vehiculo.modeloTexto);
        setColorManual(!vehiculo.colorId && !!vehiculo.colorTexto);
        const fecha = fechaCorta(conocido.ultimoRegistro);
        setBusqueda({
          estado: 'encontrado',
          mensaje: fecha ? `Datos completados (último registro: ${fecha}). Verifíquelos.` : 'Datos completados. Verifíquelos.',
        });
      } else {
        setBusqueda({ estado: 'nuevo', mensaje: 'Placa no registrada: complete los datos.' });
      }
    } catch (error) {
      setBusqueda({ estado: 'error', mensaje: error instanceof ApiError ? error.message : 'No se pudo buscar.' });
    }
  }

  function guardar(otro: boolean) {
    setIntentoGuardar(true);
    if (Object.keys(validarVehiculo(value, contexto, prefijos.items)).length === 0) onSave(otro);
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>{titulo}</Text>

      <TextField
        label="Placa"
        placeholder="A123456"
        value={value.placa}
        onChangeText={(text) => {
          cambiarPlaca({ placa: formatPlaca(text), placaNoEstandar: value.placaNoEstandar });
          setBusqueda({ estado: 'idle' });
        }}
        onBlur={() => buscarPlaca()}
        onSubmitEditing={() => buscarPlaca()}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={PLACA_MAX_LENGTH}
        errorText={errores.placa}
        rightAdornment={
          <View style={styles.adornos}>
            <Button label="Escanear" variant="ghost" onPress={() => setEscaneando(true)} />
            <Button
              label="Buscar"
              variant="ghost"
              loading={busqueda.estado === 'buscando'}
              disabled={!puedeBuscarPlaca(value.placa)}
              onPress={() => buscarPlaca()}
            />
          </View>
        }
      />
      {!errores.placa && <MensajePlaca analisis={analisis} nombreTipo={nombreTipo} />}
      <EstadoBusqueda busqueda={busqueda} />

      <FotoEvidenciaFila
        etiqueta="Foto de la placa"
        foto={value.fotoPlaca}
        onTomar={() => setEscaneando(true)}
        onQuitar={() => set({ fotoPlaca: null })}
      />

      <ScannerSheet<string | null>
        visible={escaneando}
        titulo="placa"
        leer={(lineas) => {
          const placa = leerPlaca(lineas, prefijos.items) ?? null;
          return { datos: placa, campos: placa ? [{ etiqueta: 'Placa', valor: placa }] : [] };
        }}
        onClose={() => setEscaneando(false)}
        onResult={({ foto, datos, linea }) => {
          const placa = datos ?? (linea ? formatPlaca(linea) : null);
          const vehiculo = { ...(placa ? conPlaca({ placa, placaNoEstandar: value.placaNoEstandar }) : value), fotoPlaca: foto };
          onChange(vehiculo);
          setBusqueda({ estado: 'idle' });
          // Con la placa leída se buscan enseguida los datos conocidos del vehículo
          if (placa) void buscarPlaca(vehiculo);
        }}
      />

      {!!value.placa && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Placa extranjera, temporal o ilegible</Text>
          <Switch
            accessibilityLabel="Placa extranjera, temporal o ilegible"
            value={value.placaNoEstandar}
            onValueChange={(placaNoEstandar) => cambiarPlaca({ placa: value.placa, placaNoEstandar })}
          />
        </View>
      )}

      {tiposDePlaca.length > 1 && (
        <View style={styles.sugeridos}>
          <Text style={styles.switchLabel}>Según la placa {prefijo?.prefijo}:</Text>
          <View style={styles.chips}>
            {tiposDePlaca.map((id) => (
              <Chip key={id} label={nombreTipo(id)} selected={value.tipoVehiculoId === id} onPress={() => set({ tipoVehiculoId: id })} />
            ))}
          </View>
        </View>
      )}
      <SelectField
        label="Tipo de vehículo"
        options={tiposVehiculo.items}
        loading={tiposVehiculo.cargando}
        value={value.tipoVehiculoId}
        onChange={(tipoVehiculoId) => set({ tipoVehiculoId })}
      />

      {marcaManual ? (
        <TextField
          label="Marca (no está en la lista)"
          value={value.marcaTexto}
          onChangeText={(marcaTexto) => set({ marcaTexto })}
          rightAdornment={
            <Button
              label="Lista"
              variant="ghost"
              onPress={() => {
                setMarcaManual(false);
                set({ marcaTexto: '' });
              }}
            />
          }
        />
      ) : (
        <SelectField
          label="Marca"
          options={marcas.items}
          loading={marcas.cargando}
          value={value.marcaId}
          onChange={(id) => set({ marcaId: id, modeloId: null })}
          otherLabel="No está en la lista: escribir la marca"
          onSelectOther={() => {
            setMarcaManual(true);
            setModeloManual(true);
            set({ marcaId: null, modeloId: null });
          }}
        />
      )}

      {modeloManual || marcaManual ? (
        <TextField label="Modelo" value={value.modeloTexto} onChangeText={(modeloTexto) => set({ modeloTexto })} />
      ) : (
        <SelectField
          label="Modelo"
          placeholder={marcaId ? 'Seleccionar' : 'Elija primero la marca'}
          options={modelos.items}
          loading={modelos.cargando}
          disabled={!marcaId}
          value={value.modeloId}
          onChange={(modeloId) => set({ modeloId })}
          otherLabel="No está en la lista: escribir el modelo"
          onSelectOther={() => {
            setModeloManual(true);
            set({ modeloId: null });
          }}
        />
      )}

      {colorManual ? (
        <TextField
          label="Color (no está en la lista)"
          value={value.colorTexto}
          onChangeText={(colorTexto) => set({ colorTexto })}
          rightAdornment={
            <Button
              label="Lista"
              variant="ghost"
              onPress={() => {
                setColorManual(false);
                set({ colorTexto: '' });
              }}
            />
          }
        />
      ) : (
        <SelectField
          label="Color"
          options={colores.items}
          loading={colores.cargando}
          value={value.colorId}
          onChange={(colorId) => set({ colorId })}
          otherLabel="No está en la lista: escribir el color"
          onSelectOther={() => {
            setColorManual(true);
            set({ colorId: null });
          }}
        />
      )}
      {!!errores.vehiculo && <Text style={styles.error}>{errores.vehiculo}</Text>}

      <View style={styles.separador} />
      <TiposEventoSelector
        tipos={tipos}
        label="¿Qué se le atendió?"
        value={value.tipoEventoIds}
        onChange={(tipoEventoIds) => set({ tipoEventoIds })}
        atajos={atajosTipos}
        errorText={errores.tipos}
      />

      <Button label="Guardar vehículo" onPress={() => guardar(false)} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label="Guardar y agregar otro" variant="secondary" onPress={() => guardar(true)} />
        </View>
      </View>
    </Card>
  );
}

/** Qué se reconoció de la placa: prefijo, o advertencia si el tipo elegido no le corresponde. */
function MensajePlaca({ analisis, nombreTipo }: { analisis: AnalisisPlaca; nombreTipo: (id: number) => string }) {
  if (analisis.estado === 'valida') {
    if (analisis.tipoCompatible === false) {
      const esperados = analisis.tiposSugeridos.map(nombreTipo).join(', ');
      return (
        <Text style={[styles.mensaje, styles.advertencia]} accessibilityRole="alert">
          La placa {analisis.prefijo.prefijo} corresponde a {analisis.prefijo.nombre.toLowerCase()} ({esperados}). Verifique el tipo de
          vehículo; puede guardarlo si es correcto.
        </Text>
      );
    }
    return <Text style={[styles.mensaje, styles.ok]}>Placa {analisis.prefijo.prefijo}: {analisis.prefijo.nombre}</Text>;
  }
  if (analisis.estado === 'formato_invalido')
    return (
      <Text style={[styles.mensaje, styles.advertencia]}>
        Formato no reconocido (ej. {analisis.ejemplos.join(', ')}). Si es extranjera, temporal o ilegible, márquela abajo.
      </Text>
    );
  if (analisis.estado === 'no_estandar') return <Text style={styles.mensaje}>No se valida el formato de esta placa.</Text>;
  return null;
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
  adornos: { flexDirection: 'row' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  separador: { height: 1, backgroundColor: Palette.neutral[200] },
  sugeridos: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Palette.neutral[700] },
  mensaje: { fontSize: 13, fontWeight: '600', marginTop: -4, color: Palette.neutral[700] },
  ok: { color: Palette.success[700] },
  // warning[900]: contraste AA sobre fondo claro (mismo tono que los avisos del formulario)
  advertencia: { color: Palette.warning[900] },
  error: { fontSize: 13, color: Palette.danger[600], fontWeight: '600' },
});
