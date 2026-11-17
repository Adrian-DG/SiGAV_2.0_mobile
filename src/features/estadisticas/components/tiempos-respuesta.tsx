import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Palette } from '@/constants/colors';

import { formatoMinutos, formatoPorcentaje, tonoCumplimiento, type TonoCumplimiento } from '../resumen';
import type { MetasLlegada, Tiempos } from '../types';

const COLOR_CUMPLIMIENTO: Record<TonoCumplimiento, string> = {
  bueno: Palette.success[600],
  regular: Palette.warning[700],
  malo: Palette.danger[600],
  sinDato: Palette.neutral[400],
};

/**
 * Tiempos de respuesta del alcance: llegada (mediana), llegadas dentro de la meta y eventos
 * pendientes que ya superaron la meta; debajo, el detalle y la duración de la atención.
 */
export function TiemposRespuesta({ tiempos, metas }: { tiempos: Tiempos; metas?: MetasLlegada }) {
  const evaluadas = tiempos.dentroDeMeta + tiempos.fueraDeMeta + tiempos.pendientesVencidos;
  const vencidos = tiempos.pendientesVencidos;

  return (
    <Card style={styles.card}>
      <Text style={styles.titulo}>Tiempos de respuesta</Text>

      <View style={styles.stats}>
        <StatTile label="Llegada (mediana)" value={formatoMinutos(tiempos.llegadaMedianaMinutos)} accentColor={Palette.neutral[900]} />
        <View style={styles.divisor} />
        <StatTile
          label="En meta"
          value={formatoPorcentaje(tiempos.cumplimientoPorcentaje)}
          accentColor={COLOR_CUMPLIMIENTO[tonoCumplimiento(tiempos.cumplimientoPorcentaje)]}
        />
        <View style={styles.divisor} />
        <StatTile label="Pendientes vencidos" value={vencidos} accentColor={vencidos > 0 ? Palette.danger[600] : Palette.neutral[900]} />
      </View>

      <View style={styles.detalle}>
        {tiempos.llegadasMedidas > 0 && (
          <Linea
            etiqueta="Llegada"
            valor={`promedio ${formatoMinutos(tiempos.llegadaPromedioMinutos)} · 9 de 10 en ${formatoMinutos(tiempos.llegadaP90Minutos)}`}
          />
        )}
        {evaluadas > 0 && <Linea etiqueta="En meta" valor={`${tiempos.dentroDeMeta} de ${evaluadas} eventos despachados`} />}
        {tiempos.atencionesMedidas > 0 && (
          <Linea
            etiqueta="Atención"
            valor={`${formatoMinutos(tiempos.atencionMedianaMinutos)} de llegada a cierre (mediana)`}
          />
        )}
      </View>

      {vencidos > 0 && (
        <Text style={styles.alerta}>
          {vencidos === 1 ? 'Hay 1 evento' : `Hay ${vencidos} eventos`} sin llegada de la unidad que ya superaron la meta.
        </Text>
      )}
      {!!metas && (
        <Text style={styles.nota}>
          Meta de llegada: accidentes {metas.accidenteMinutos} min · asistencias {metas.asistenciaMinutos} min. No cuentan los
          eventos que reporta el agente ya en el lugar.
        </Text>
      )}
    </Card>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Text style={styles.linea}>
      <Text style={styles.lineaEtiqueta}>{etiqueta}: </Text>
      {valor}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  titulo: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
  stats: { flexDirection: 'row', alignItems: 'center' },
  divisor: { width: 1, alignSelf: 'stretch', backgroundColor: Palette.neutral[100] },
  detalle: { gap: 4 },
  linea: { fontSize: 13, color: Palette.neutral[700] },
  lineaEtiqueta: { fontWeight: '700', color: Palette.neutral[900] },
  alerta: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.danger[700],
    backgroundColor: Palette.danger[50],
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nota: { fontSize: 12, color: Palette.neutral[500] },
});
