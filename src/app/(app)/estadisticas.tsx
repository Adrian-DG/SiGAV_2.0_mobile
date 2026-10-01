import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { StatTile } from '@/components/ui/stat-tile';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import { getEstadisticasEventos } from '@/features/estadisticas/api';
import { BarrasPorTipo } from '@/features/estadisticas/components/barras-por-tipo';
import { DesgloseEstadisticas } from '@/features/estadisticas/components/desglose';
import {
  asistenciasYAccidentes,
  describirAlcance,
  desglosePorNivel,
  tiposDeCategoria,
} from '@/features/estadisticas/resumen';
import type { EstadisticasEventos } from '@/features/estadisticas/types';
import { CategoriaEventoValue } from '@/features/events/types';
import { ApiError } from '@/lib/api-client';
import { diaOperativo } from '@/lib/fecha-operativa';

type Carga = { clave: string } & ({ estado: 'listo'; datos: EstadisticasEventos } | { estado: 'error'; mensaje: string });

const fechaLarga = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Estadísticas de eventos atendidos. Lo que se ve depende del nivel de la denominación de la
 * unidad conectada (lo decide la API): supervisor regional → sus regiones, encargado de tramo →
 * sus tramos, unidad → solo su ficha. En la app solo se consulta el día operativo de hoy.
 * Requiere conexión.
 */
export default function EstadisticasScreen() {
  const router = useRouter();
  const { session } = useSession();
  const token = session?.token;

  const [intento, setIntento] = useState(0);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  // Se recalcula en cada render: con la pantalla abierta pasada la medianoche, recargar trae el día nuevo
  const hoy = diaOperativo();
  const clave = `${hoy}|${intento}`;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getEstadisticasEventos(token, hoy, hoy, controller.signal)
      .then((datos) => setCarga({ clave, estado: 'listo', datos }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCarga({ clave, estado: 'error', mensaje: error instanceof ApiError ? error.message : 'No se pudieron cargar las estadísticas.' });
      })
      .finally(() => setRefrescando(false));
    return () => controller.abort();
  }, [token, hoy, clave]);

  // Al recargar se sigue mostrando lo anterior, atenuado, hasta que llega la respuesta
  const cargando = carga?.clave !== clave;
  const datos = carga?.estado === 'listo' ? carga.datos : null;

  function recargar() {
    setRefrescando(true);
    setIntento((i) => i + 1);
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Estadísticas" right={<IconButton glyph="✕" label="Cerrar" onPress={() => router.back()} />} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} />}>
        <Text style={styles.rango}>Hoy, {fechaLarga(hoy)}</Text>

        {!carga && cargando && <ActivityIndicator style={styles.loader} color={Palette.primary[500]} />}

        {carga?.estado === 'error' && !cargando && (
          <Card style={styles.card}>
            <EmptyState glyph="⚠" title="No disponible" description={carga.mensaje} />
            <Button label="Reintentar" variant="ghost" onPress={recargar} />
          </Card>
        )}

        {datos && (
          <View style={[styles.datos, cargando && styles.atenuado]}>
            <Contenido datos={datos} />
          </View>
        )}
        {datos && cargando && <ActivityIndicator style={styles.loaderFlotante} color={Palette.primary[500]} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Contenido({ datos }: { datos: EstadisticasEventos }) {
  const { asistencias, accidentes } = asistenciasYAccidentes(datos.resumen);
  const tiposAsistencia = tiposDeCategoria(datos.resumen, CategoriaEventoValue.Asistencia);
  const tiposAccidente = tiposDeCategoria(datos.resumen, CategoriaEventoValue.Accidente);

  return (
    <>
      <View style={styles.alcance}>
        {!!datos.alcance.denominacion && <Text style={styles.alcanceTitulo}>{datos.alcance.denominacion}</Text>}
        <Text style={styles.alcanceTexto}>{describirAlcance(datos.alcance)}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.stats}>
          <StatTile label="Eventos" value={datos.resumen.totalEventos} accentColor={Palette.neutral[900]} />
          <View style={styles.statDivider} />
          <StatTile label="Asistencias" value={asistencias} accentColor={Palette.primary[600]} />
          <View style={styles.statDivider} />
          <StatTile label="Accidentes" value={accidentes} accentColor={Palette.danger[600]} />
        </View>
        <Text style={styles.nota}>Un evento con varios tipos cuenta una vez en el total, y en cada categoría y tipo que tenga.</Text>
      </Card>

      {datos.resumen.totalEventos === 0 ? (
        <Card style={styles.card}>
          <EmptyState glyph="▢" title="Sin eventos" description="Aún no se han atendido eventos hoy." />
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={styles.seccion}>Por tipo de evento</Text>
            <BarrasPorTipo titulo="Asistencias" tipos={tiposAsistencia} color={Palette.primary[600]} />
            <BarrasPorTipo titulo="Accidentes" tipos={tiposAccidente} color={Palette.danger[600]} />
          </Card>
          <DesgloseEstadisticas desglose={desglosePorNivel(datos)} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Palette.neutral[50] },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  rango: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600], textAlign: 'center' },
  loader: { paddingVertical: 32 },
  loaderFlotante: { position: 'absolute', top: 120, alignSelf: 'center' },
  datos: { gap: 14 },
  atenuado: { opacity: 0.5 },
  card: { gap: 12 },
  alcance: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: Palette.primary[50] },
  alcanceTitulo: { fontSize: 14, fontWeight: '800', color: Palette.primary[700] },
  alcanceTexto: { fontSize: 13, color: Palette.primary[700] },
  stats: { flexDirection: 'row', alignItems: 'center' },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: Palette.neutral[100] },
  nota: { fontSize: 12, color: Palette.neutral[500], textAlign: 'center' },
  seccion: { fontSize: 15, fontWeight: '800', color: Palette.neutral[900] },
});
