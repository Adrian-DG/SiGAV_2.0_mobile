import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { IconButton } from '@/components/ui/icon-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import { getDenominacionActual, getEstadisticasEventosHoy } from '@/features/events/api';
import { EventCard } from '@/features/events/components/event-card';
import { UnitSummaryCard } from '@/features/events/components/unit-summary-card';
import { describirError, enviarEventoLocal } from '@/features/events/local/enviar-evento';
import {
  cerrarEventoLocal,
  contarEventosLocales,
  ESTATUS_LOCAL_LABELS,
  listarEventosLocales,
  type EstatusLocal,
  type EventoLocalListItem,
} from '@/features/events/local/eventos-local';
import { useSesionEvento } from '@/features/events/local/use-sesion-evento';
import type { DenominacionActual, ResumenEventos } from '@/features/events/types';
import { useNetworkStatus } from '@/hooks/use-network-status';

const ESTATUS: EstatusLocal[] = ['en_curso', 'por_enviar', 'enviado'];

const SIN_EVENTOS: Record<EstatusLocal, string> = {
  en_curso: 'No hay eventos en curso. Registre uno con el botón +.',
  por_enviar: 'No hay eventos cerrados pendientes de enviar.',
  enviado: 'Aún no ha enviado eventos desde este dispositivo.',
};

type EventsState =
  | { status: 'loading' }
  | { status: 'ready'; items: EventoLocalListItem[] }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const isConnected = useNetworkStatus();
  const db = useSQLiteContext();
  const sesion = useSesionEvento();

  const [estatus, setEstatus] = useState<EstatusLocal>('en_curso');
  const [conteo, setConteo] = useState<Record<EstatusLocal, number> | null>(null);
  const [resumen, setResumen] = useState<ResumenEventos | null>(null);
  const [isLoadingResumen, setIsLoadingResumen] = useState(true);
  const [denominacion, setDenominacion] = useState<DenominacionActual | null>(null);
  const [eventsState, setEventsState] = useState<EventsState>({ status: 'loading' });
  // Bumping this re-triggers every load effect below; it's how pull-to-refresh and the
  // "Reintentar" button re-fetch without exposing the fetchers themselves outside the effects.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const token = session?.token;
  const unidadId = session?.agente.unidadId;

  const agenteId = sesion?.agenteId;

  // Resumen y denominación vienen de la API (sin conexión simplemente no se muestran).
  // Los eventos, del dispositivo: se registran, editan y cierran aquí hasta que el agente los envía.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      setIsLoadingResumen(true);
      try {
        const response = await getEstadisticasEventosHoy(token!);
        if (!cancelled) setResumen(response.resumen);
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
  }, [token, refreshNonce]);

  useEffect(() => {
    if (!agenteId || !unidadId) return;
    const duenio = { agenteId, unidadId };
    let cancelled = false;
    async function run() {
      setEventsState({ status: 'loading' });
      try {
        const [items, totales] = await Promise.all([listarEventosLocales(db, duenio, estatus), contarEventosLocales(db, duenio)]);
        if (!cancelled) {
          setEventsState({ status: 'ready', items });
          setConteo(totales);
        }
      } catch {
        if (!cancelled) setEventsState({ status: 'error', message: 'No se pudieron leer los eventos del dispositivo.' });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [db, agenteId, unidadId, estatus, refreshNonce]);

  useEffect(() => {
    if (!token || !unidadId) return;

    let cancelled = false;
    async function run() {
      try {
        const response = await getDenominacionActual(token!, unidadId!);
        if (!cancelled) setDenominacion(response);
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

  async function cerrar(item: EventoLocalListItem, tipoCierreId: number) {
    await cerrarEventoLocal(db, item.localId, tipoCierreId);
    refetchAll();
  }

  async function enviar(item: EventoLocalListItem) {
    if (!token || !sesion) return;
    try {
      const resultado = await enviarEventoLocal(db, token, sesion, item.localId);
      Alert.alert(
        'Evento enviado',
        resultado.esDuplicado ? `El evento No. ${resultado.id} ya estaba registrado.` : `Quedó registrado como evento No. ${resultado.id}.`,
      );
    } catch (error) {
      Alert.alert('No se pudo enviar', describirError(error));
      throw error;
    } finally {
      refetchAll();
    }
  }

  // Al volver del formulario (u otra pantalla) se recarga: el evento recién guardado debe aparecer
  const primerEnfoque = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // El primer enfoque es la carga inicial (ya la hacen los efectos de arriba)
      if (primerEnfoque.current) {
        primerEnfoque.current = false;
        return;
      }
      setRefreshNonce((n) => n + 1);
    }, []),
  );
  const isRefreshing = isLoadingResumen || eventsState.status === 'loading';
  // Sin agente o unidad no hay de quién listar eventos (no debería pasar en una sesión móvil)
  const listado: EventsState = sesion
    ? eventsState
    : { status: 'error', message: 'La sesión no tiene agente o unidad: vuelva a iniciar sesión.' };

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
        data={listado.status === 'ready' ? listado.items : []}
        keyExtractor={(item) => String(item.localId)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetchAll} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {!!session && (
              <UnitSummaryCard
                institucion={session.agente.institucion}
                rango={session.agente.rango}
                nombre={session.agente.nombre}
                ficha={session.agente.ficha}
                denominacion={denominacion}
                resumen={resumen}
                isLoadingResumen={isLoadingResumen}
                onVerEstadisticas={() => router.push('/estadisticas')}
              />
            )}
            <SegmentedControl
              options={ESTATUS.map((e) => ({
                label: conteo?.[e] ? `${ESTATUS_LOCAL_LABELS[e]} (${conteo[e]})` : ESTATUS_LOCAL_LABELS[e],
                value: e,
              }))}
              value={estatus}
              onChange={setEstatus}
            />
          </View>
        }
        renderItem={({ item }) => (
          <EventCard
            item={item}
            onEditar={() => router.push({ pathname: '/events/[id]', params: { id: String(item.localId) } })}
            onCerrar={(tipoCierreId) => cerrar(item, tipoCierreId)}
            onEnviar={() => enviar(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          listado.status === 'loading' ? (
            <ActivityIndicator style={styles.loader} color={Palette.primary[500]} />
          ) : listado.status === 'error' ? (
            <View style={styles.errorState}>
              <EmptyState glyph="⚠" title="No se pudo cargar" description={listado.message} />
              <Button label="Reintentar" variant="ghost" onPress={refetchAll} />
            </View>
          ) : (
            <EmptyState glyph="▢" title="No hay eventos" description={SIN_EVENTOS[estatus]} />
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
