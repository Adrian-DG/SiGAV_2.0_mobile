import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Palette } from '@/constants/colors';
import type { TipoEventoItem } from '@/features/catalogos/api';
import { listarNacionalidades } from '@/features/catalogos/local/catalogos-local';
import { buscarCiudadano } from '@/features/historico/api';
import { FotoEvidenciaFila } from '@/features/scan/foto-evidencia';
import { leerCedula, type DatosCedula } from '@/features/scan/lectura';
import { ScannerSheet, type Lectura } from '@/features/scan/scanner-sheet';
import { useCatalogo } from '@/hooks/use-catalogo';
import { ApiError } from '@/lib/api-client';

import {
  aplicarCiudadanoConocido,
  cambiarRol,
  formatEdad,
  formatIdentificacion,
  IDENTIFICACION_MAX_LENGTH,
  puedeBuscarIdentificacion,
  rolAdmiteVehiculo,
  requiereTiposPropios,
  rolRequiereVehiculo,
  validarInvolucrado,
  type ContextoEvento,
  type InvolucradoForm,
} from '../form/evento-form';
import { RolCiudadanoValue, SexoValue, type RolCiudadano, type Sexo } from '../types';
import { EstadoBusqueda, fechaCorta, type Busqueda } from './estado-busqueda';
import { TiposEventoSelector } from './tipos-evento-selector';

/** Roles que el agente puede asignar en campo. */
const ROL_OPTIONS: { label: string; value: RolCiudadano }[] = [
  { label: 'Conductor', value: RolCiudadanoValue.Conductor },
  { label: 'Pasajero', value: RolCiudadanoValue.Pasajero },
  { label: 'Peatón', value: RolCiudadanoValue.Peaton },
];

/** Roles que ya no se ofrecen, pero que puede tener una persona guardada antes (se muestran para poder cambiarlos). */
const ROL_ANTERIOR: Partial<Record<RolCiudadano, string>> = {
  [RolCiudadanoValue.Paciente]: 'Paciente',
  [RolCiudadanoValue.Otro]: 'Otro',
};

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
  tipos: TipoEventoItem[];
  onChange: (value: InvolucradoForm) => void;
  /** Tras intentar guardar: los errores se muestran y se actualizan al corregir. */
  mostrarErrores: boolean;
};

/** Datos de la persona y lo que pasó con ella. Guardar y cancelar están en la barra del formulario. */
export function InvolucradoEditor({
  token,
  value,
  contexto,
  etiquetaVehiculo,
  tipos,
  onChange,
  mostrarErrores,
}: InvolucradoEditorProps) {
  const [busqueda, setBusqueda] = useState<Busqueda>({ estado: 'idle' });
  const [escaneando, setEscaneando] = useState(false);
  // La tecla "siguiente" del teclado pasa de un campo al otro sin cerrarlo
  const apellidoRef = useRef<TextInput>(null);
  const edadRef = useRef<TextInput>(null);
  const telefonoRef = useRef<TextInput>(null);

  const nacionalidades = useCatalogo('nacionalidades', listarNacionalidades);

  const errores = mostrarErrores ? validarInvolucrado(value, contexto) : {};
  const rolAnterior = ROL_ANTERIOR[value.rol];
  const opcionesRol = rolAnterior ? [...ROL_OPTIONS, { label: rolAnterior, value: value.rol }] : ROL_OPTIONS;

  // SelectField trabaja con Ids numéricos: posición del vehículo en el evento (1, 2, ...)
  const opcionesVehiculo = contexto.vehiculos.map((v, i) => ({ id: i + 1, nombre: etiquetaVehiculo(v.key) }));
  const vehiculoSeleccionado = value.vehiculoKey ? contexto.vehiculos.findIndex((v) => v.key === value.vehiculoKey) + 1 || null : null;
  const vehiculo = contexto.vehiculos.find((v) => v.key === value.vehiculoKey);

  /** `actual`: la persona recién cambiada (p. ej. con los datos leídos de la cédula), aún no en `value`. */
  async function buscarPersona(actual: InvolucradoForm = value) {
    if (!puedeBuscarIdentificacion(actual.identificacion)) return;
    setBusqueda({ estado: 'buscando' });
    try {
      const conocido = await buscarCiudadano(token, actual.identificacion);
      if (conocido) {
        onChange(aplicarCiudadanoConocido(actual, conocido));
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

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.fieldLabel}>¿Quién es?</Text>
        <SegmentedControl options={opcionesRol} value={value.rol} onChange={(rol) => onChange(cambiarRol(value, rol))} />

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

        {/* Escanear es lo más rápido: lee la cédula, guarda la foto como evidencia y busca a la persona */}
        {!value.fotoIdentificacion && (
          <Button label="Escanear cédula" icon="camara" variant="outline" onPress={() => setEscaneando(true)} />
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
          onBlur={() => buscarPersona()}
          onSubmitEditing={() => buscarPersona()}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={IDENTIFICACION_MAX_LENGTH + 2}
          returnKeyType="search"
          errorText={errores.identificacion}
          // Al salir del campo se buscan solos los datos conocidos de la persona
          rightAdornment={busqueda.estado === 'buscando' ? <ActivityIndicator color={Palette.primary[500]} /> : undefined}
        />
        <EstadoBusqueda busqueda={busqueda} />

        <FotoEvidenciaFila
          etiqueta="Foto de la cédula"
          foto={value.fotoIdentificacion}
          onTomar={() => setEscaneando(true)}
          onQuitar={() => onChange({ ...value, fotoIdentificacion: null })}
        />

        <ScannerSheet<DatosCedula>
          visible={escaneando}
          titulo="cédula"
          leer={lecturaCedula}
          onClose={() => setEscaneando(false)}
          onResult={({ foto, datos, linea }) => {
            const persona = { ...conDatosDeCedula(value, datos, linea), fotoIdentificacion: foto };
            onChange(persona);
            setBusqueda({ estado: 'idle' });
            // Con la cédula leída se buscan enseguida los datos conocidos (teléfono, nacionalidad...)
            if (persona.identificacion !== value.identificacion) void buscarPersona(persona);
          }}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Nombre"
              value={value.nombre}
              onChangeText={(nombre) => onChange({ ...value, nombre })}
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => apellidoRef.current?.focus()}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              ref={apellidoRef}
              label="Apellido"
              value={value.apellido}
              onChangeText={(apellido) => onChange({ ...value, apellido })}
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => edadRef.current?.focus()}
            />
          </View>
        </View>
        <Text style={styles.fieldLabel}>Sexo</Text>
        <SegmentedControl options={SEXO_OPTIONS} value={value.sexo} onChange={(sexo) => onChange({ ...value, sexo })} />
        <View style={styles.row}>
          <View style={styles.edad}>
            <TextField
              ref={edadRef}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => telefonoRef.current?.focus()}
              label="Edad"
              placeholder="Años"
              keyboardType="number-pad"
              maxLength={3}
              value={value.edad}
              onChangeText={(edad) => onChange({ ...value, edad: formatEdad(edad) })}
              errorText={errores.edad}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              ref={telefonoRef}
              label="Teléfono"
              placeholder="809-000-0000"
              keyboardType="phone-pad"
              value={value.telefono}
              onChangeText={(telefono) => onChange({ ...value, telefono })}
            />
          </View>
        </View>
        <SelectField
          label="Nacionalidad"
          options={nacionalidades.items}
          loading={nacionalidades.cargando}
          value={value.nacionalidadId}
          onChange={(nacionalidadId) => onChange({ ...value, nacionalidadId })}
        />

      </Card>

      <Card style={[styles.card, !!errores.tipos && styles.cardError]}>
        <TiposEventoSelector
          tipos={tipos}
          label={requiereTiposPropios(value) ? '¿Qué pasó con esta persona?' : '¿Qué pasó con esta persona? (opcional)'}
          ayuda={requiereTiposPropios(value) ? undefined : 'Si no marca nada, comparte lo atendido al vehículo en que iba.'}
          value={value.tipoEventoIds}
          onChange={(tipoEventoIds) => onChange({ ...value, tipoEventoIds })}
          atajos={vehiculo ? [{ label: `Igual que ${etiquetaVehiculo(vehiculo.key).toLowerCase()}`, ids: vehiculo.tipoEventoIds }] : []}
          errorText={errores.tipos}
        />
      </Card>
    </>
  );
}

const SEXO_TEXTO: Record<number, string> = { [SexoValue.Masculino]: 'Masculino', [SexoValue.Femenino]: 'Femenino' };

function lecturaCedula(lineas: string[]): Lectura<DatosCedula> {
  const d = leerCedula(lineas);
  const campos = [
    { etiqueta: 'Cédula', valor: d.identificacion },
    { etiqueta: 'Nombre', valor: d.nombre },
    { etiqueta: 'Apellido', valor: d.apellido },
    { etiqueta: 'Sexo', valor: d.sexo ? SEXO_TEXTO[d.sexo] : undefined },
    { etiqueta: 'Edad', valor: d.edad !== undefined ? `${d.edad} años` : undefined },
  ].filter((c): c is { etiqueta: string; valor: string } => !!c.valor);
  return { datos: d, campos };
}

/**
 * Aplica lo leído de la cédula: la identificación siempre (la eligió el agente); el resto solo
 * en los campos vacíos, para no pisar lo que ya escribió.
 */
function conDatosDeCedula(inv: InvolucradoForm, datos: DatosCedula | null, linea: string | null): InvolucradoForm {
  const identificacion = datos?.identificacion ?? (linea ? formatIdentificacion(linea) : null);
  if (!datos) return identificacion ? { ...inv, identificacion, origen: null } : inv;
  return {
    ...inv,
    identificacion: identificacion ?? inv.identificacion,
    origen: identificacion ? null : inv.origen,
    nombre: inv.nombre.trim() || datos.nombre || '',
    apellido: inv.apellido.trim() || datos.apellido || '',
    sexo: inv.sexo !== SexoValue.NoIndicado ? inv.sexo : (datos.sexo ?? SexoValue.NoIndicado),
    edad: inv.edad.trim() || (datos.edad !== undefined ? String(datos.edad) : ''),
  };
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  cardError: { borderColor: Palette.danger[500], borderWidth: 2 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: Palette.neutral[700], marginBottom: -6 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  edad: { width: 96 },
});
