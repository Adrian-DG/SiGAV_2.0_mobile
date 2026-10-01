import { StyleSheet, Text } from 'react-native';

import { Palette } from '@/constants/colors';

/** Resultado de buscar una cédula o una placa en el histórico para autocompletar. */
export type Busqueda = { estado: 'idle' | 'buscando' | 'encontrado' | 'nuevo' | 'error'; mensaje?: string };

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-DO', { dateStyle: 'medium' }) : null;

export function EstadoBusqueda({ busqueda }: { busqueda: Busqueda }) {
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
  busqueda: { fontSize: 13, fontWeight: '600', marginTop: -4 },
});
