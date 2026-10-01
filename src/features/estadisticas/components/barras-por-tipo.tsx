import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

import type { Resumen } from '../types';

type BarrasPorTipoProps = {
  titulo: string;
  tipos: Resumen['porTipo'];
  /** Color de la categoría (mismo que su total en el resumen). */
  color: string;
};

/**
 * Tipos de evento de una categoría, de mayor a menor. Una sola serie por gráfico (el título la
 * nombra, no hace falta leyenda); el número va en texto, no en el color de la barra.
 */
export function BarrasPorTipo({ titulo, tipos, color }: BarrasPorTipoProps) {
  if (tipos.length === 0) return null;
  const maximo = Math.max(...tipos.map((t) => t.total), 1);

  return (
    <View style={styles.grupo} accessibilityRole="list" accessibilityLabel={titulo}>
      <Text style={styles.titulo}>{titulo}</Text>
      {tipos.map((t) => (
        <View
          key={t.tipoEventoId}
          style={styles.fila}
          accessible
          accessibilityLabel={`${t.tipoEvento}: ${t.total} ${t.total === 1 ? 'evento' : 'eventos'}`}>
          <View style={styles.cabecera}>
            <Text style={styles.nombre} numberOfLines={1}>
              {t.tipoEvento}
            </Text>
            <Text style={styles.valor}>{t.total}</Text>
          </View>
          <View style={styles.pista}>
            <View style={[styles.barra, { width: `${(t.total / maximo) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 10 },
  titulo: { fontSize: 14, fontWeight: '800', color: Palette.neutral[900] },
  fila: { gap: 4 },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  nombre: { flex: 1, fontSize: 13, color: Palette.neutral[700] },
  valor: { fontSize: 13, fontWeight: '700', color: Palette.neutral[900] },
  // Barra delgada anclada a la izquierda, extremo redondeado
  pista: { height: 8, borderRadius: 4, backgroundColor: Palette.neutral[100], overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4, minWidth: 4 },
});
