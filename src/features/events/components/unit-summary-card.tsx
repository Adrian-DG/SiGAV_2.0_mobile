import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Palette } from '@/constants/colors';
import { CategoriaEventoValue, type ResumenEventos } from '@/features/events/types';

type UnitSummaryCardProps = {
  nombre: string;
  ficha: string;
  denominacion: string | null;
  resumen: ResumenEventos | null;
  isLoadingResumen: boolean;
};

export function UnitSummaryCard({ nombre, ficha, denominacion, resumen, isLoadingResumen }: UnitSummaryCardProps) {
  const asistencias = resumen?.porCategoria.find((c) => c.categoria === CategoriaEventoValue.Asistencia)?.total ?? 0;
  const accidentes = resumen?.porCategoria.find((c) => c.categoria === CategoriaEventoValue.Accidente)?.total ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.identity}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ficha}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={styles.denomination} numberOfLines={1}>
            {denominacion ?? 'Denominación no disponible'}
          </Text>
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
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.neutral[900],
  },
  denomination: {
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
