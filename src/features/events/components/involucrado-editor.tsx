import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Palette } from '@/constants/colors';
import { listarNacionalidades } from '@/features/catalogos/local/catalogos-local';
import { buscarCiudadano } from '@/features/historico/api';
import { useCatalogo } from '@/hooks/use-catalogo';
import { ApiError } from '@/lib/api-client';

import {
  aplicarCiudadanoConocido,
  cambiarRol,
  formatIdentificacion,
  IDENTIFICACION_MAX_LENGTH,
  puedeBuscarIdentificacion,
  rolAdmiteVehiculo,
  rolRequiereVehiculo,
  validarInvolucrado,
  type ContextoEvento,
  type InvolucradoForm,
} from '../form/evento-form';
import { RolCiudadanoValue, SexoValue, type RolCiudadano, type Sexo } from '../types';
import { EstadoBusqueda, fechaCorta, type Busqueda } from './estado-busqueda';

const ROL_OPTIONS: { label: string; value: RolCiudadano }[] = [
  { label: 'Conductor', value: RolCiudadanoValue.Conductor },
  { label: 'Pasajero', value: RolCiudadanoValue.Pasajero },
  { label: 'Peatón', value: RolCiudadanoValue.Peaton },
  { label: 'Paciente', value: RolCiudadanoValue.Paciente },
  { label: 'Otro', value: RolCiudadanoValue.Otro },
];

const SEXO_OPTIONS: { label: string; value: Sexo }[] = [
  { label: 'No indicado', value: SexoValue.NoIndicado },
  { label: 'Masculino', value: SexoValue.Masculino },
  { label: 'Femenino', value: SexoValue.Femenino },
];

type InvolucradoEditorProps = {
  token: string;
  value: InvolucradoForm;
  /** Vehículos y personas del evento: a qué vehículo asociarla y contra qué validar. */
  contexto: ContextoEvento;
  /** Nombre de cada vehículo para elegirlo ("Vehículo 1 · A123456"). */
  etiquetaVehiculo: (vehiculoKey: string) => string;
  onChange: (value: InvolucradoForm) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function InvolucradoEditor({ token, value, contexto, etiquetaVehiculo, onChange, onSave, onCancel }: InvolucradoEditorProps) {
  const [busqueda, setBusqueda] = useState<Busqueda>({ estado: 'idle' });
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const nacionalidades = useCatalogo('nacionalidades', listarNacionalidades);

  const errores = intentoGuardar ? validarInvolucrado(value, contexto) : {};

  // SelectField trabaja con Ids numéricos: posición del vehículo en el evento (1, 2, ...)
  const opcionesVehiculo = contexto.vehiculos.map((v, i) => ({ id: i + 1, nombre: etiquetaVehiculo(v.key) }));
  const vehiculoSeleccionado = value.vehiculoKey ? contexto.vehiculos.findIndex((v) => v.key === value.vehiculoKey) + 1 || null : null;

  async function buscarPersona() {
    if (!puedeBuscarIdentificacion(value.identificacion)) return;
    setBusqueda({ estado: 'buscando' });
    try {
      const conocido = await buscarCiudadano(token, value.identificacion);
      if (conocido) {
        onChange(aplicarCiudadanoConocido(value, conocido));
        const fecha = fechaCorta(conocido.ultimoRegistro);
        setBusqueda({
          estado: 'encontrado',
          mensaje: fecha ? `Datos completados (último registro: ${fecha}). Verifíquelos.` : 'Datos completados. Verifíquelos.',
        });
      } else {
        setBusqueda({ estado: 'nuevo', mensaje: 'Cédula no registrada: complete los datos.' });
      }
    } catch (error) {
      setBusqueda({ estado: 'error', mensaje: error instanceof ApiError ? error.message : 'No se pudo buscar.' });
    }
  }

  function guardar() {
    setIntentoGuardar(true);
    if (Object.keys(validarInvolucrado(value, contexto)).length === 0) onSave();
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>Persona</Text>
      <SegmentedControl options={ROL_OPTIONS} value={value.rol} onChange={(rol) => onChange(cambiarRol(value, rol))} />

      {rolAdmiteVehiculo(value.rol) && (
        <SelectField
          label={rolRequiereVehiculo(value.rol) ? 'Vehículo en que iba' : 'Vehículo en que iba (opcional)'}
          placeholder={contexto.vehiculos.length ? 'Seleccionar' : 'Agregue primero el vehículo'}
          options={opcionesVehiculo}
          disabled={contexto.vehiculos.length === 0}
          value={vehiculoSeleccionado}
          onChange={(id) => onChange({ ...value, vehiculoKey: id ? (contexto.vehiculos[id - 1]?.key ?? null) : null })}
          otherLabel={rolRequiereVehiculo(value.rol) ? undefined : 'Sin vehículo'}
          onSelectOther={rolRequiereVehiculo(value.rol) ? undefined : () => onChange({ ...value, vehiculoKey: null })}
          errorText={errores.vehiculo}
        />
      )}

      <TextField
        label="Cédula o pasaporte"
        placeholder="000-0000000-0"
        value={value.identificacion}
        onChangeText={(text) => {
          const identificacion = formatIdentificacion(text);
          onChange({ ...value, identificacion, origen: null });
          setBusqueda({ estado: 'idle' });
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
            loading={busqueda.estado === 'buscando'}
            disabled={!puedeBuscarIdentificacion(value.identificacion)}
            onPress={buscarPersona}
          />
        }
      />
      <EstadoBusqueda busqueda={busqueda} />

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

const styles = StyleSheet.create({
  card: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600] },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
