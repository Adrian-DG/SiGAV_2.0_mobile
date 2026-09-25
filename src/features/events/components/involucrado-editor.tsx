import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Palette } from '@/constants/colors';
import { getColores, getMarcas, getModelos, getNacionalidades, getTiposVehiculo } from '@/features/catalogos/api';
import { buscarCiudadano, buscarVehiculo } from '@/features/historico/api';
import { useCatalogo } from '@/hooks/use-catalogo';
import { ApiError } from '@/lib/api-client';

import {
  aplicarCiudadanoConocido,
  aplicarVehiculoConocido,
  formatIdentificacion,
  formatPlaca,
  IDENTIFICACION_MAX_LENGTH,
  PLACA_MAX_LENGTH,
  puedeBuscarIdentificacion,
  puedeBuscarPlaca,
  validarInvolucrado,
  type InvolucradoForm,
  type VehiculoForm,
} from '../form/evento-form';
import { RolCiudadanoValue, SexoValue, type RolCiudadano, type Sexo } from '../types';

const ROL_OPTIONS: { label: string; value: RolCiudadano }[] = [
  { label: 'Conductor', value: RolCiudadanoValue.Conductor },
  { label: 'Pasajero', value: RolCiudadanoValue.Pasajero },
  { label: 'Peatón', value: RolCiudadanoValue.Peaton },
  { label: 'Otro', value: RolCiudadanoValue.Otro },
];

const SEXO_OPTIONS: { label: string; value: Sexo }[] = [
  { label: 'No indicado', value: SexoValue.NoIndicado },
  { label: 'Masculino', value: SexoValue.Masculino },
  { label: 'Femenino', value: SexoValue.Femenino },
];

type Busqueda = { estado: 'idle' | 'buscando' | 'encontrado' | 'nuevo' | 'error'; mensaje?: string };

type InvolucradoEditorProps = {
  token: string;
  value: InvolucradoForm;
  onChange: (value: InvolucradoForm) => void;
  onSave: () => void;
  onCancel: () => void;
};

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-DO', { dateStyle: 'medium' }) : null;

export function InvolucradoEditor({ token, value, onChange, onSave, onCancel }: InvolucradoEditorProps) {
  const [busquedaPersona, setBusquedaPersona] = useState<Busqueda>({ estado: 'idle' });
  const [busquedaVehiculo, setBusquedaVehiculo] = useState<Busqueda>({ estado: 'idle' });
  // El agente eligió "no está en la lista": se muestra el campo de texto libre
  const [marcaManual, setMarcaManual] = useState(!!value.vehiculo.marcaTexto);
  const [modeloManual, setModeloManual] = useState(!!value.vehiculo.modeloTexto);
  const [colorManual, setColorManual] = useState(!!value.vehiculo.colorTexto);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const nacionalidades = useCatalogo('nacionalidades', () => getNacionalidades(token));
  const tiposVehiculo = useCatalogo('tipos-vehiculo', () => getTiposVehiculo(token));
  const marcas = useCatalogo('marcas', () => getMarcas(token));
  const marcaId = value.vehiculo.marcaId;
  const modelos = useCatalogo(marcaId ? `modelos:${marcaId}` : null, () => getModelos(token, marcaId!));
  const colores = useCatalogo('colores', () => getColores(token));

  const errores = intentoGuardar ? validarInvolucrado(value) : {};
  const setVehiculo = (vehiculo: Partial<VehiculoForm>) => onChange({ ...value, vehiculo: { ...value.vehiculo, ...vehiculo } });

  async function buscarPersona() {
    if (!puedeBuscarIdentificacion(value.identificacion)) return;
    setBusquedaPersona({ estado: 'buscando' });
    try {
      const conocido = await buscarCiudadano(token, value.identificacion);
      if (conocido) {
        onChange(aplicarCiudadanoConocido(value, conocido));
        const fecha = fechaCorta(conocido.ultimoRegistro);
        setBusquedaPersona({
          estado: 'encontrado',
          mensaje: fecha ? `Datos completados (último registro: ${fecha}). Verifíquelos.` : 'Datos completados. Verifíquelos.',
        });
      } else {
        setBusquedaPersona({ estado: 'nuevo', mensaje: 'Cédula no registrada: complete los datos.' });
      }
    } catch (error) {
      setBusquedaPersona({ estado: 'error', mensaje: error instanceof ApiError ? error.message : 'No se pudo buscar.' });
    }
  }

  async function buscarPlaca() {
    if (!puedeBuscarPlaca(value.vehiculo.placa)) return;
    setBusquedaVehiculo({ estado: 'buscando' });
    try {
      const conocido = await buscarVehiculo(token, value.vehiculo.placa);
      if (conocido) {
        const vehiculo = aplicarVehiculoConocido(value.vehiculo, conocido);
        onChange({ ...value, vehiculo });
        setMarcaManual(!vehiculo.marcaId && !!vehiculo.marcaTexto);
        setModeloManual(!vehiculo.modeloId && !!vehiculo.modeloTexto);
        setColorManual(!vehiculo.colorId && !!vehiculo.colorTexto);
        const fecha = fechaCorta(conocido.ultimoRegistro);
        setBusquedaVehiculo({
          estado: 'encontrado',
          mensaje: fecha ? `Datos completados (último registro: ${fecha}). Verifíquelos.` : 'Datos completados. Verifíquelos.',
        });
      } else {
        setBusquedaVehiculo({ estado: 'nuevo', mensaje: 'Placa no registrada: complete los datos.' });
      }
    } catch (error) {
      setBusquedaVehiculo({ estado: 'error', mensaje: error instanceof ApiError ? error.message : 'No se pudo buscar.' });
    }
  }

  function guardar() {
    setIntentoGuardar(true);
    if (Object.keys(validarInvolucrado(value)).length === 0) onSave();
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>Ciudadano</Text>
      <SegmentedControl
        options={ROL_OPTIONS}
        value={value.rol}
        onChange={(rol) => onChange({ ...value, rol })}
      />

      <TextField
        label="Cédula o pasaporte"
        placeholder="000-0000000-0"
        value={value.identificacion}
        onChangeText={(text) => {
          const identificacion = formatIdentificacion(text);
          onChange({ ...value, identificacion, origen: null });
          setBusquedaPersona({ estado: 'idle' });
        }}
        onBlur={buscarPersona}
        onSubmitEditing={buscarPersona}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={IDENTIFICACION_MAX_LENGTH + 2}
        errorText={errores.identificacion}
        rightAdornment={
          <Button
            label="Buscar"
            variant="ghost"
            loading={busquedaPersona.estado === 'buscando'}
            disabled={!puedeBuscarIdentificacion(value.identificacion)}
            onPress={buscarPersona}
          />
        }
      />
      <EstadoBusqueda busqueda={busquedaPersona} />

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Nombre" value={value.nombre} onChangeText={(nombre) => onChange({ ...value, nombre })} />
        </View>
        <View style={styles.flex}>
          <TextField label="Apellido" value={value.apellido} onChangeText={(apellido) => onChange({ ...value, apellido })} />
        </View>
      </View>
      <Text style={styles.fieldLabel}>Sexo</Text>
      <SegmentedControl options={SEXO_OPTIONS} value={value.sexo} onChange={(sexo) => onChange({ ...value, sexo })} />
      <TextField
        label="Teléfono"
        placeholder="809-000-0000"
        keyboardType="phone-pad"
        value={value.telefono}
        onChangeText={(telefono) => onChange({ ...value, telefono })}
      />
      <SelectField
        label="Nacionalidad"
        options={nacionalidades.items}
        loading={nacionalidades.cargando}
        value={value.nacionalidadId}
        onChange={(nacionalidadId) => onChange({ ...value, nacionalidadId })}
      />

      <View style={styles.switchRow}>
        <Text style={styles.sectionTitle}>Vehículo</Text>
        <Switch
          accessibilityLabel="Tiene vehículo"
          value={value.conVehiculo}
          onValueChange={(conVehiculo) => onChange({ ...value, conVehiculo })}
        />
      </View>

      {value.conVehiculo && (
        <>
          <TextField
            label="Placa"
            placeholder="A123456"
            value={value.vehiculo.placa}
            onChangeText={(text) => {
              setVehiculo({ placa: formatPlaca(text), origen: null });
              setBusquedaVehiculo({ estado: 'idle' });
            }}
            onBlur={buscarPlaca}
            onSubmitEditing={buscarPlaca}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={PLACA_MAX_LENGTH}
            rightAdornment={
              <Button
                label="Buscar"
                variant="ghost"
                loading={busquedaVehiculo.estado === 'buscando'}
                disabled={!puedeBuscarPlaca(value.vehiculo.placa)}
                onPress={buscarPlaca}
              />
            }
          />
          <EstadoBusqueda busqueda={busquedaVehiculo} />

          <SelectField
            label="Tipo de vehículo"
            options={tiposVehiculo.items}
            loading={tiposVehiculo.cargando}
            value={value.vehiculo.tipoVehiculoId}
            onChange={(tipoVehiculoId) => setVehiculo({ tipoVehiculoId })}
          />

          {marcaManual ? (
            <TextField
              label="Marca (no está en la lista)"
              value={value.vehiculo.marcaTexto}
              onChangeText={(marcaTexto) => setVehiculo({ marcaTexto })}
              rightAdornment={
                <Button label="Lista" variant="ghost" onPress={() => { setMarcaManual(false); setVehiculo({ marcaTexto: '' }); }} />
              }
            />
          ) : (
            <SelectField
              label="Marca"
              options={marcas.items}
              loading={marcas.cargando}
              value={value.vehiculo.marcaId}
              onChange={(id) => setVehiculo({ marcaId: id, modeloId: null })}
              otherLabel="No está en la lista: escribir la marca"
              onSelectOther={() => {
                setMarcaManual(true);
                setModeloManual(true);
                setVehiculo({ marcaId: null, modeloId: null });
              }}
            />
          )}

          {modeloManual || marcaManual ? (
            <TextField
              label="Modelo"
              value={value.vehiculo.modeloTexto}
              onChangeText={(modeloTexto) => setVehiculo({ modeloTexto })}
            />
          ) : (
            <SelectField
              label="Modelo"
              placeholder={marcaId ? 'Seleccionar' : 'Elija primero la marca'}
              options={modelos.items}
              loading={modelos.cargando}
              disabled={!marcaId}
              value={value.vehiculo.modeloId}
              onChange={(modeloId) => setVehiculo({ modeloId })}
              otherLabel="No está en la lista: escribir el modelo"
              onSelectOther={() => {
                setModeloManual(true);
                setVehiculo({ modeloId: null });
              }}
            />
          )}

          {colorManual ? (
            <TextField
              label="Color (no está en la lista)"
              value={value.vehiculo.colorTexto}
              onChangeText={(colorTexto) => setVehiculo({ colorTexto })}
              rightAdornment={
                <Button label="Lista" variant="ghost" onPress={() => { setColorManual(false); setVehiculo({ colorTexto: '' }); }} />
              }
            />
          ) : (
            <SelectField
              label="Color"
              options={colores.items}
              loading={colores.cargando}
              value={value.vehiculo.colorId}
              onChange={(colorId) => setVehiculo({ colorId })}
              otherLabel="No está en la lista: escribir el color"
              onSelectOther={() => {
                setColorManual(true);
                setVehiculo({ colorId: null });
              }}
            />
          )}
          {!!errores.vehiculo && <Text style={styles.error}>{errores.vehiculo}</Text>}
        </>
      )}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label="Guardar persona" onPress={guardar} />
        </View>
      </View>
    </Card>
  );
}

function EstadoBusqueda({ busqueda }: { busqueda: Busqueda }) {
  if (!busqueda.mensaje) return null;
  const color =
    busqueda.estado === 'encontrado'
      ? Palette.success[700]
      : busqueda.estado === 'error'
        ? Palette.danger[600]
        : Palette.neutral[700];
  return <Text style={[styles.busqueda, { color }]}>{busqueda.mensaje}</Text>;
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600] },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  busqueda: { fontSize: 13, fontWeight: '600', marginTop: -4 },
  error: { fontSize: 13, color: Palette.danger[600], fontWeight: '600' },
});
