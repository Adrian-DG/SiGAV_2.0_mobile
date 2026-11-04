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
  /** Segundo agente de la unidad ("Rango · Nombre · Institución"), si opera con componente. */
  componente?: string | null;
  /** null mientras carga o sin conexión. */
  denominacion: DenominacionActual | null;
  resumen: ResumenEventos | null;
  isLoadingResumen: boolean;
  /** Eventos del dispositivo aún sin enviar (en curso o por enviar): no cuentan en el resumen de la API. */
  pendientesLocales: number;
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
  componente,
  denominacion,
  resumen,
  isLoadingResumen,
  pendientesLocales,
  onVerEstadisticas,
}: UnitSummaryCardProps) {
  // Sin resumen (sin conexión o error) no se muestra 0: no se sabe cuántos hay
  const total = (categoria: number) =>
    resumen ? (resumen.porCategoria.find((c) => c.categoria === categoria)?.total ?? 0) : '—';
  const asistencias = total(CategoriaEventoValue.Asistencia);
  const accidentes = total(CategoriaEventoValue.Accidente);
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
          {!!componente && (
            <Text style={styles.tramo} numberOfLines={2}>
              Componente: {componente}
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
      {!isLoadingResumen && (!resumen || pendientesLocales > 0) && (
        <Text style={styles.notaResumen}>
          {[
            !resumen ? 'Sin conexión: el resumen del centro no está disponible.' : 'Cuenta lo recibido por el centro.',
            pendientesLocales > 0
              ? `${pendientesLocales === 1 ? 'Falta 1 evento' : `Faltan ${pendientesLocales} eventos`} de este teléfono por enviar.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </Text>
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
  notaResumen: {
    fontSize: 12,
    lineHeight: 17,
    color: Palette.neutral[600],
    textAlign: 'center',
  },
});
