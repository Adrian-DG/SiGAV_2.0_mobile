import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Palette } from '@/constants/colors';
import { obtenerNombresVehiculo, type NombresVehiculo } from '@/features/catalogos/local/catalogos-local';
import { useCatalogos } from '@/features/catalogos/catalogos-context';

import type { InvolucradoForm, VehiculoForm } from '../form/evento-form';
import { RolCiudadanoValue, type RolCiudadano } from '../types';

export const ROL_LABEL: Record<number, string> = {
  [RolCiudadanoValue.Conductor]: 'Conductor',
  [RolCiudadanoValue.Pasajero]: 'Pasajero',
  [RolCiudadanoValue.Peaton]: 'Peatón',
  [RolCiudadanoValue.Paciente]: 'Paciente',
  [RolCiudadanoValue.Otro]: 'Otro',
};

export const nombrePersona = (inv: InvolucradoForm) =>
  `${inv.nombre} ${inv.apellido}`.trim() || inv.identificacion || 'Persona no identificada';

/** Marca, modelo y color con los nombres del catálogo del dispositivo (o el texto libre). */
function useDescripcionVehiculo(v: VehiculoForm): string {
  const db = useSQLiteContext();
  const { revision } = useCatalogos();
  const [nombres, setNombres] = useState<NombresVehiculo | null>(null);
  const { tipoVehiculoId, marcaId, modeloId, colorId } = v;

  useEffect(() => {
    let cancelado = false;
    obtenerNombresVehiculo(db, { tipoVehiculoId, marcaId, modeloId, colorId })
      .then((n) => {
        if (!cancelado) setNombres(n);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [db, revision, tipoVehiculoId, marcaId, modeloId, colorId]);

  const marca = v.marcaId ? nombres?.marca : v.marcaTexto.trim();
  const modelo = v.modeloId ? nombres?.modelo : v.modeloTexto.trim();
  const color = v.colorId ? nombres?.color : v.colorTexto.trim();
  const marcaModelo = [marca, modelo].filter(Boolean).join(' ');
  return [marcaModelo || nombres?.tipo, color].filter(Boolean).join(' · ') || 'Sin datos del vehículo';
}

type VehiculoTarjetaProps = {
  indice: number;
  vehiculo: VehiculoForm;
  ocupantes: InvolucradoForm[];
  error?: string;
  erroresPersona: (key: string) => string | undefined;
  puedeAgregarConductor: boolean;
  onEditar: () => void;
  onQuitar: () => void;
  onAgregarPersona: (rol: RolCiudadano) => void;
  onEditarPersona: (inv: InvolucradoForm) => void;
  onQuitarPersona: (key: string) => void;
};

/** Un vehículo del evento con las personas que iban en él. */
export function VehiculoTarjeta({
  indice,
  vehiculo,
  ocupantes,
  error,
  erroresPersona,
  puedeAgregarConductor,
  onEditar,
  onQuitar,
  onAgregarPersona,
  onEditarPersona,
  onQuitarPersona,
}: VehiculoTarjetaProps) {
  const descripcion = useDescripcionVehiculo(vehiculo);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <Pressable style={styles.flex} accessibilityRole="button" accessibilityLabel={`Editar vehículo ${indice}`} onPress={onEditar}>
          <Text style={styles.titulo}>
            Vehículo {indice} · {vehiculo.placa || 'sin placa'}
            {vehiculo.placaNoEstandar ? ' (no estándar)' : ''}
          </Text>
          <Text style={styles.muted}>{descripcion}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </Pressable>
        <IconButton
          glyph="🗑"
          label={`Quitar vehículo ${indice}`}
          tint={Palette.neutral[600]}
          onPress={() => (ocupantes.length > 0 ? setConfirmarQuitar(true) : onQuitar())}
        />
      </View>

      {confirmarQuitar && (
        <View style={styles.confirmar}>
          <Text style={styles.confirmarTexto}>
            Se quitará el vehículo y {ocupantes.length === 1 ? 'la persona que iba en él' : `las ${ocupantes.length} personas que iban en él`}.
            Para conservar a alguien, edítelo antes y cámbielo de vehículo.
          </Text>
          <View style={styles.fila}>
            <View style={styles.flex}>
              <Button label="Cancelar" variant="ghost" onPress={() => setConfirmarQuitar(false)} />
            </View>
            <View style={styles.flex}>
              <Button label="Quitar" variant="secondary" onPress={onQuitar} />
            </View>
          </View>
        </View>
      )}

      {ocupantes.map((inv) => (
        <View key={inv.key} style={styles.ocupante}>
          <Pressable
            style={styles.flex}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${ROL_LABEL[inv.rol]?.toLowerCase()} ${nombrePersona(inv)}`}
            onPress={() => onEditarPersona(inv)}>
            <Text style={styles.ocupanteTexto}>
              {ROL_LABEL[inv.rol]}: {nombrePersona(inv)}
            </Text>
            {!!erroresPersona(inv.key) && <Text style={styles.error}>{erroresPersona(inv.key)}</Text>}
          </Pressable>
          <IconButton glyph="✕" label={`Quitar a ${nombrePersona(inv)}`} tint={Palette.neutral[600]} onPress={() => onQuitarPersona(inv.key)} />
        </View>
      ))}

      <View style={styles.fila}>
        {puedeAgregarConductor && (
          <View style={styles.flex}>
            <Button label="+ Conductor" variant="ghost" onPress={() => onAgregarPersona(RolCiudadanoValue.Conductor)} />
          </View>
        )}
        <View style={styles.flex}>
          <Button label="+ Pasajero" variant="ghost" onPress={() => onAgregarPersona(RolCiudadanoValue.Pasajero)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tarjeta: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Palette.neutral[50],
    borderWidth: 1,
    borderColor: Palette.neutral[200],
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 14, fontWeight: '800', color: Palette.neutral[900] },
  muted: { fontSize: 13, color: Palette.neutral[600] },
  error: { fontSize: 13, color: Palette.danger[600], fontWeight: '600' },
  ocupante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Palette.white,
  },
  ocupanteTexto: { fontSize: 14, fontWeight: '600', color: Palette.neutral[900] },
  fila: { flexDirection: 'row', gap: 8 },
  confirmar: { gap: 8, padding: 10, borderRadius: 10, backgroundColor: Palette.warning[50] },
  confirmarTexto: { fontSize: 13, fontWeight: '600', color: Palette.warning[900] },
});
