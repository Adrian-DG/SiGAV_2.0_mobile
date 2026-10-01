import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Palette } from '@/constants/colors';
import { CategoriaEventoValue, type DenominacionActual, type ResumenEventos } from '@/features/events/types';

type UnitSummaryCardProps = {
  institucion: string;
  rango: string;
  nombre: string;
  ficha: string;
  /** null mientras carga o sin conexión. */
  denominacion: DenominacionActual | null;
  resumen: ResumenEventos | null;
  isLoadingResumen: boolean;
  /** Solo se ofrece a denominaciones de nivel Supervisor o Encargado. */
  onVerEstadisticas: () => void;
};

/**
 * Encabezado del turno:
 *   1. Rango, siglas de la institución
 *   2. Nombre completo
 *   3. Denominación
 *   4. Tramo
 * y el resumen del día (más "Ver estadísticas" si la denominación es de supervisión).
 */
export function UnitSummaryCard({
  institucion,
  rango,
  nombre,
  ficha,
  denominacion,
  resumen,
  isLoadingResumen,
  onVerEstadisticas,
}: UnitSummaryCardProps) {
  const asistencias = resumen?.porCategoria.find((c) => c.categoria === CategoriaEventoValue.Asistencia)?.total ?? 0;
  const accidentes = resumen?.porCategoria.find((c) => c.categoria === CategoriaEventoValue.Accidente)?.total ?? 0;
  const rangoInstitucion = [rango, institucion].filter(Boolean).join(', ');

  return (
    <Card style={styles.card}>
      <View style={styles.identity}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ficha}</Text>
        </View>
        <View style={styles.identityText}>
          {!!rangoInstitucion && (
            <Text style={styles.rank} numberOfLines={1}>
              {rangoInstitucion}
            </Text>
          )}
          <Text style={styles.name} numberOfLines={2}>
            {nombre || 'Agente'}
          </Text>
          <Text style={styles.denomination} numberOfLines={1}>
            {denominacion?.nombre ?? 'Denominación no disponible'}
          </Text>
          {!!denominacion?.tramo && (
            <Text style={styles.tramo} numberOfLines={1}>
              {denominacion.tramo}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {isLoadingResumen ? (
        <ActivityIndicator style={styles.loader} color={Palette.primary[500]} />
      ) : (
        <View style={styles.stats}>
          <StatTile label="Asistencias hoy" value={asistencias} accentColor={Palette.primary[600]} />
          <View style={styles.statDivider} />
          <StatTile label="Accidentes hoy" value={accidentes} accentColor={Palette.danger[600]} />
        </View>
      )}

      {denominacion?.esEncargado && (
        <>
          <View style={styles.divider} />
          <Button label="Ver estadísticas" variant="ghost" onPress={onVerEstadisticas} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    backgroundColor: Palette.primary[500],
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  badgeText: {
    color: Palette.white,
    fontWeight: '800',
    fontSize: 14,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  rank: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.neutral[600],
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.neutral[900],
  },
  denomination: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.neutral[700],
  },
  tramo: {
    fontSize: 13,
    color: Palette.neutral[500],
  },
  divider: {
    height: 1,
    backgroundColor: Palette.neutral[100],
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Palette.neutral[100],
  },
  loader: {
    paddingVertical: 10,
  },
});
