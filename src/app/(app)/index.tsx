import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { IconButton } from '@/components/ui/icon-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import { getDenominacionActual } from '@/features/events/api';
import { EventCard } from '@/features/events/components/event-card';
import { UnitSummaryCard } from '@/features/events/components/unit-summary-card';
import { getEventosLocal, getResumenHoyLocal } from '@/features/events/local-repository';
import { EstadoEventoValue, type EstadoEvento, type EventoListItem, type ResumenEventos } from '@/features/events/types';
import { useNetworkStatus } from '@/hooks/use-network-status';

const ESTADO_OPTIONS = [
  { label: 'Pendiente', value: EstadoEventoValue.Pendiente },
  { label: 'En curso', value: EstadoEventoValue.EnCurso },
  { label: 'Completado', value: EstadoEventoValue.Completado },
];

type EventsState =
  | { status: 'loading' }
  | { status: 'ready'; items: EventoListItem[] }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { session, signOut } = useSession();
  const isConnected = useNetworkStatus();

  const [estado, setEstado] = useState<EstadoEvento>(EstadoEventoValue.Pendiente);
  const [resumen, setResumen] = useState<ResumenEventos | null>(null);
  const [isLoadingResumen, setIsLoadingResumen] = useState(true);
  const [denominacion, setDenominacion] = useState<string | null>(null);
  const [eventsState, setEventsState] = useState<EventsState>({ status: 'loading' });
  // Bumping this re-triggers every load effect below; it's how pull-to-refresh and the
  // "Reintentar" button re-fetch without exposing the fetchers themselves outside the effects.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const token = session?.token;
  const unidadId = session?.agente.unidadId;
  const agenteNombre = session?.agente.nombre;
  const agenteFicha = session?.agente.ficha;

  // Eventos y resumen viven en SQLite local (con datos de muestra) hasta que la API tenga
  // GET /api/eventos y /api/estadisticas/eventos deje de ser lo único disponible del agregado
  // Evento. Cambiar a remoto más adelante es acotado a estos dos efectos.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setIsLoadingResumen(true);
      try {
        const response = await getResumenHoyLocal(db);
        if (!cancelled) setResumen(response);
      } catch {
        if (!cancelled) setResumen(null);
      } finally {
        if (!cancelled) setIsLoadingResumen(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [db, refreshNonce]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setEventsState({ status: 'loading' });
      try {
        const items = await getEventosLocal(db, estado);
        if (!cancelled) setEventsState({ status: 'ready', items });
      } catch {
        if (!cancelled) setEventsState({ status: 'error', message: 'No se pudo leer la base de datos local.' });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [db, estado, refreshNonce]);

  useEffect(() => {
    if (!token || !unidadId) return;

    let cancelled = false;
    async function run() {
      try {
        const response = await getDenominacionActual(token!, unidadId!);
        if (!cancelled) setDenominacion(response.nombre);
      } catch {
        if (!cancelled) setDenominacion(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, unidadId, refreshNonce]);

  const refetchAll = () => setRefreshNonce((n) => n + 1);
  const isRefreshing = isLoadingResumen || eventsState.status === 'loading';

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader
        title="Inicio"
        right={
          <>
            <View
              style={[styles.connectionDot, { backgroundColor: isConnected ? Palette.success[400] : Palette.danger[400] }]}
              accessibilityLabel={isConnected ? 'Conectado' : 'Sin conexión'}
            />
            <IconButton glyph="⟳" label="Actualizar" onPress={refetchAll} />
            <IconButton glyph="⏻" label="Cerrar sesión" onPress={() => signOut()} />
          </>
        }
      />

      <FlatList
        data={eventsState.status === 'ready' ? eventsState.items : []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetchAll} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <UnitSummaryCard
              nombre={agenteNombre ?? 'Agente'}
              ficha={agenteFicha ?? '—'}
              denominacion={denominacion}
              resumen={resumen}
              isLoadingResumen={isLoadingResumen}
            />
            <SegmentedControl options={ESTADO_OPTIONS} value={estado} onChange={setEstado} />
          </View>
        }
        renderItem={({ item }) => <EventCard item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          eventsState.status === 'loading' ? (
            <ActivityIndicator style={styles.loader} color={Palette.primary[500]} />
          ) : eventsState.status === 'error' ? (
            <View style={styles.errorState}>
              <EmptyState glyph="⚠" title="No se pudo cargar" description={eventsState.message} />
              <Button label="Reintentar" variant="ghost" onPress={refetchAll} />
            </View>
          ) : (
            <EmptyState glyph="▢" title="No hay eventos" description="No se encontraron eventos para el filtro seleccionado." />
          )
        }
      />

      <Fab glyph="+" label="Registrar evento" onPress={() => router.push('/events/new')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Palette.neutral[50],
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderColor: Palette.neutral[300],
    borderWidth: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  listHeader: {
    gap: 14,
    marginBottom: 16,
  },
  separator: {
    height: 10,
  },
  loader: {
    paddingVertical: 32,
  },
  errorState: {
    alignItems: 'center',
    gap: 8,
  },
});
