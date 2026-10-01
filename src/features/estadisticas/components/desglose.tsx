import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Palette } from '@/constants/colors';

import { detalleCategorias, type Desglose } from '../resumen';
import { REGION_MACRO_LABELS, type RegionEstadistica, type TramoEstadistica } from '../types';

/** Regiones → tramos → unidades (supervisor regional) o tramos → unidades (encargado de tramo). */
export function DesgloseEstadisticas({ desglose }: { desglose: Desglose }) {
  if (desglose.tipo === 'ninguno') return null;

  if (desglose.tipo === 'tramos')
    return (
      <Card style={styles.card}>
        <Text style={styles.titulo}>Por tramo</Text>
        {desglose.tramos.map((t) => (
          <FilaTramo key={t.tramoId} tramo={t} />
        ))}
      </Card>
    );

  return (
    <>
      {desglose.regiones.map((r) => (
        <TarjetaRegion key={r.regionAsistenciaId} region={r} />
      ))}
    </>
  );
}

function TarjetaRegion({ region }: { region: RegionEstadistica }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cabecera}>
        <View style={styles.flex}>
          <Text style={styles.titulo}>{region.region || 'Región sin nombre'}</Text>
          <Text style={styles.secundario}>
            Región {REGION_MACRO_LABELS[region.regionMacro] ?? ''} · {detalleCategorias(region.resumen)}
          </Text>
        </View>
        <Total valor={region.resumen.totalEventos} />
      </View>
      {region.tramos.map((t) => (
        <FilaTramo key={t.tramoId} tramo={t} />
      ))}
    </Card>
  );
}

/** Tramo con su total; al tocarlo muestra las unidades que atendieron eventos en él. */
function FilaTramo({ tramo }: { tramo: TramoEstadistica }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <View style={styles.tramo}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${tramo.tramo}: ${tramo.resumen.totalEventos} eventos. ${abierto ? 'Ocultar' : 'Ver'} unidades`}
        onPress={() => setAbierto((a) => !a)}
        style={styles.cabecera}>
        <View style={styles.flex}>
          <Text style={styles.nombre}>{tramo.tramo || 'Tramo sin nombre'}</Text>
          <Text style={styles.secundario}>{detalleCategorias(tramo.resumen)}</Text>
        </View>
        <Total valor={tramo.resumen.totalEventos} />
        <Text style={styles.chevron}>{abierto ? '▴' : '▾'}</Text>
      </Pressable>

      {abierto &&
        tramo.unidades.map((u) => (
          // Una ficha reasignada en el período aparece una vez por denominación
          <View key={`${u.unidadId}-${u.denominacionId}`} style={styles.unidad}>
            <View style={styles.ficha}>
              <Text style={styles.fichaTexto}>{u.ficha}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.nombreUnidad} numberOfLines={1}>
                {u.denominacion}
              </Text>
              <Text style={styles.secundario}>{detalleCategorias(u.resumen)}</Text>
            </View>
            <Text style={styles.totalUnidad}>{u.resumen.totalEventos}</Text>
          </View>
        ))}
    </View>
  );
}

function Total({ valor }: { valor: number }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalValor}>{valor}</Text>
      <Text style={styles.totalEtiqueta}>{valor === 1 ? 'evento' : 'eventos'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  flex: { flex: 1 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
  nombre: { fontSize: 14, fontWeight: '700', color: Palette.neutral[900] },
  secundario: { fontSize: 12, color: Palette.neutral[600] },
  chevron: { fontSize: 14, color: Palette.neutral[500], width: 14, textAlign: 'center' },
  tramo: {
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Palette.neutral[50],
    borderWidth: 1,
    borderColor: Palette.neutral[200],
  },
  unidad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: Palette.white },
  ficha: { backgroundColor: Palette.primary[50], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  fichaTexto: { fontSize: 12, fontWeight: '800', color: Palette.primary[700] },
  nombreUnidad: { fontSize: 13, fontWeight: '600', color: Palette.neutral[900] },
  totalUnidad: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
  total: { alignItems: 'flex-end' },
  totalValor: { fontSize: 18, fontWeight: '800', color: Palette.neutral[900] },
  totalEtiqueta: { fontSize: 11, color: Palette.neutral[500] },
});
