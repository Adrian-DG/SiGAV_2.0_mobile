import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { IconButton } from '@/components/ui/icon-button';
import { useToast } from '@/components/ui/toast';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import { AvisoVencimiento } from '@/features/auth/aviso-vencimiento';
import { completarEvento, getDenominacionActual, getEstadisticasEventosHoy } from '@/features/events/api';
import { agentesDeLaUnidad, describirAgente } from '@/lib/jwt';
import { EventCard } from '@/features/events/components/event-card';
import { PendientesOtrasSesiones } from '@/features/events/components/pendientes-otras-sesiones';
import { UnitSummaryCard } from '@/features/events/components/unit-summary-card';
import { describirError, enviarEventoLocal } from '@/features/events/local/enviar-evento';
import {
  asignadosEnDispositivo,
  cerrarEventoLocal,
  contarEventosLocales,
  descartarEventoLocal,
  ESTATUS_LOCAL_LABELS,
  listarEventosLocales,
  purgarEnviadosAntiguos,
  retirarAsignadosNoVigentes,
  type EstatusLocal,
  type EventoLocalListItem,
} from '@/features/events/local/eventos-local';
import { tomarPestanaInicio } from '@/features/events/local/pestana-inicio';
import { Icon } from '@/components/ui/icon';
import { useSesionEvento } from '@/features/events/local/use-sesion-evento';
import { EstadoEventoValue, type DenominacionActual, type ResumenEventos } from '@/features/events/types';
import { ApiError, NETWORK_ERROR_STATUS } from '@/lib/api-client';
import { cambiarAgenteEvento, confirmarLlegadaApoyo, getEventosAsignados, iniciarEvento, type EventoAsignado } from '@/features/events/asignados/api';
import { abrirAsignadoEnDispositivo } from '@/features/events/asignados/importar';
import { EventoAsignadoCard } from '@/features/events/asignados/evento-asignado-card';
import { useNotificaciones } from '@/features/notificaciones/notificaciones-context';
import { EstadoUbicacion } from '@/features/posicion/components/estado-ubicacion';
import { reportarOcupacion } from '@/features/posicion/seguimiento';
import { borrarFoto } from '@/features/scan/fotos';
import { useNetworkStatus } from '@/hooks/use-network-status';

const ESTATUS: EstatusLocal[] = ['en_curso', 'por_enviar', 'enviado'];

const SIN_EVENTOS: Record<EstatusLocal, string> = {
  en_curso: 'No hay eventos en curso. Registre uno con el botón «Nuevo evento».',
  por_enviar: 'No hay eventos cerrados pendientes de enviar.',
  enviado: 'No hay eventos enviados en los últimos 7 días desde este dispositivo.',
};

const esErrorDeRed = (error: unknown) => error instanceof ApiError && error.status === NETWORK_ERROR_STATUS;

const eventos = (n: number) => (n === 1 ? '1 evento' : `${n} eventos`);

type ResultadoLote = { total: number; enviados: number; fallidos: string[] };

type EventsState =
  | { status: 'loading' }
  | { status: 'ready'; items: EventoLocalListItem[] }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const toast = useToast();
  const isConnected = useNetworkStatus();
  const db = useSQLiteContext();
  const sesion = useSesionEvento();

  const [estatus, setEstatus] = useState<EstatusLocal>('en_curso');
  const [conteo, setConteo] = useState<Record<EstatusLocal, number> | null>(null);
  const [resumen, setResumen] = useState<ResumenEventos | null>(null);
  const [isLoadingResumen, setIsLoadingResumen] = useState(true);
  const [denominacion, setDenominacion] = useState<DenominacionActual | null>(null);
  const [eventsState, setEventsState] = useState<EventsState>({ status: 'loading' });
  // Asignados que el agente ya trajo al dispositivo para editarlos: se listan con los propios
  const [enDispositivo, setEnDispositivo] = useState<number[]>([]);
  // Bumping this re-triggers every load effect below; it's how pull-to-refresh and the
  // "Reintentar" button re-fetch without exposing the fetchers themselves outside the effects.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [enviandoTodos, setEnviandoTodos] = useState(false);

  const token = session?.token;
  const unidadId = session?.agente.unidadId;

  const agenteId = sesion?.agenteId;

  // Con componente, cada tarjeta indica cuál de los dos agentes atiende el evento
  const agentesUnidad = session?.agente.componente ? agentesDeLaUnidad(session.agente) : null;
  const agenteQueAtiende = (id: number | null) => {
    if (!agentesUnidad) return null;
    const agente = agentesUnidad.find((a) => a.agenteId === (id ?? agenteId));
    return agente ? describirAgente(agente) : null;
  };

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
        const [items, totales, importados] = await Promise.all([
          listarEventosLocales(db, duenio, estatus),
          contarEventosLocales(db, duenio),
          asignadosEnDispositivo(db, duenio),
        ]);
        if (!cancelled) {
          setEventsState({ status: 'ready', items });
          setConteo(totales);
          setEnDispositivo(importados);
        }
        // Se recarga tras registrar, cerrar o enviar un evento: el call center debe saber de inmediato
        // qué agentes quedaron ocupados (o libres) por eventos que solo están en el dispositivo
        reportarOcupacion();
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

  // Eventos asignados por el call center: viven en el servidor. Se piden de nuevo con cada aviso del
  // hub (asignado o anulado) y al reconectarse, por si se perdió alguno con la app cerrada.
  const { estado: estadoAvisos, versionEventos } = useNotificaciones();
  const [asignados, setAsignados] = useState<EventoAsignado[] | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getEventosAsignados(token)
      .then(async (items) => {
        if (cancelled) return;
        setAsignados(items);
        if (!agenteId || !unidadId) return;
        // Los que ya se trajeron al teléfono y el centro anuló, completó o reasignó: ya no se pueden enviar
        const retirados = await retirarAsignadosNoVigentes(db, { agenteId, unidadId }, items.map((i) => i.id));
        if (retirados.serverIds.length === 0) return;
        retirados.fotos.forEach(borrarFoto);
        const numeros = retirados.serverIds.map((id) => `No. ${id}`).join(', ');
        Alert.alert(
          retirados.serverIds.length === 1 ? 'Evento retirado' : 'Eventos retirados',
          `El centro de operaciones anuló, completó o reasignó ${retirados.serverIds.length === 1 ? 'el evento' : 'los eventos'} ${numeros}. ` +
            'Se quitaron de este teléfono: ya no debe atenderlos.',
        );
        if (!cancelled) setRefreshNonce((n) => n + 1);
      })
      .catch(() => {
        // Sin conexión se conservan los últimos que se vieron
      });
    return () => {
      cancelled = true;
    };
  }, [db, token, agenteId, unidadId, refreshNonce, versionEventos]);

  const refetchAll = () => setRefreshNonce((n) => n + 1);

  // Una vez por apertura: los enviados de hace más de 7 días se borran del teléfono
  useEffect(() => {
    purgarEnviadosAntiguos(db, new Date())
      .then((fotos) => fotos.forEach(borrarFoto))
      .catch(() => {
        // Se intentará en la próxima apertura
      });
  }, [db]);

  // ------------------------------------------------------------------ Envío de los por enviar

  // Un solo lote a la vez (botón "Enviar todos", al recuperar señal o antes de cerrar sesión)
  const enviandoLote = useRef(false);

  /**
   * Envía uno por uno los eventos cerrados (con mala señal, varios a la vez compiten por el ancho
   * de banda). Si falla por falta de red, no se insiste con los demás. Devuelve null si ya hay un
   * lote en curso.
   */
  async function enviarPorEnviar(): Promise<ResultadoLote | null> {
    if (!token || !sesion || enviandoLote.current) return null;
    enviandoLote.current = true;
    setEnviandoTodos(true);
    try {
      const porEnviar = await listarEventosLocales(db, sesion, 'por_enviar');
      const fallidos: string[] = [];
      let enviados = 0;
      for (const [i, item] of porEnviar.entries()) {
        try {
          await enviarEventoLocal(db, token, sesion, item.localId);
          enviados++;
        } catch (error) {
          fallidos.push(`• ${item.tipos.join(', ') || 'Evento'}: ${describirError(error)}`);
          if (esErrorDeRed(error)) {
            const resto = porEnviar.length - i - 1;
            if (resto > 0) fallidos.push(`• ${resto === 1 ? 'Otro evento' : `Otros ${resto} eventos`}: sin intentar, no hay conexión.`);
            break;
          }
        }
      }
      return { total: porEnviar.length, enviados, fallidos };
    } finally {
      enviandoLote.current = false;
      setEnviandoTodos(false);
      refetchAll();
    }
  }

  async function enviarTodos() {
    const n = conteo?.por_enviar ?? 0;
    toast.mostrar({ mensaje: `Enviando ${eventos(n)}…`, duracion: 60_000 });
    const resultado = await enviarPorEnviar();
    if (!resultado) return;
    if (resultado.fallidos.length === 0) {
      toast.mostrar({ mensaje: `${resultado.enviados === 1 ? 'Se envió 1 evento' : `Se enviaron ${resultado.enviados} eventos`} al centro`, icono: 'exito' });
      return;
    }
    toast.mostrar({ mensaje: `Faltan eventos por enviar`, icono: 'error' });
    Alert.alert(
      resultado.enviados > 0 ? `Se enviaron ${resultado.enviados} de ${resultado.total}` : 'No se pudo enviar',
      `Los que faltan siguen guardados en el teléfono.\n\n${resultado.fallidos.join('\n')}`,
    );
  }

  // Al recuperar la señal se envían solos los que estaban cerrados (sin preguntar: ya se cerraron)
  const conexionAnterior = useRef(isConnected);
  const porEnviarAhora = conteo?.por_enviar ?? 0;
  useEffect(() => {
    const recuperada = !conexionAnterior.current && isConnected;
    conexionAnterior.current = isConnected;
    if (!recuperada || porEnviarAhora === 0) return;
    void enviarPorEnviar().then((resultado) => {
      if (!resultado || resultado.total === 0) return;
      toast.mostrar(
        resultado.fallidos.length === 0
          ? { mensaje: `Señal recuperada: ${resultado.enviados === 1 ? 'se envió 1 evento' : `se enviaron ${resultado.enviados} eventos`}`, icono: 'exito' }
          : {
              mensaje: `Señal recuperada, pero ${
                resultado.total - resultado.enviados === 1
                  ? '1 evento no se pudo enviar'
                  : `${resultado.total - resultado.enviados} eventos no se pudieron enviar`
              }`,
              icono: 'error',
            },
      );
    });
    // enviarPorEnviar cambia en cada render; solo importa el cambio de conexión
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  /** Acción sobre un evento asignado: si falla se avisa; siempre se refresca la lista. */
  async function operarAsignado(accion: () => Promise<unknown>, titulo: string) {
    try {
      await accion();
    } catch (error) {
      Alert.alert(titulo, describirError(error));
      throw error;
    } finally {
      refetchAll();
    }
  }

  // ------------------------------------------------------------------ Cerrar sesión

  // Mientras se envían los pendientes antes de salir, un segundo toque no repite el proceso
  const cerrandoSesion = useRef(false);

  /**
   * Cerrar sesión: primero se confirma. Los eventos solo viven en este teléfono hasta enviarlos, así
   * que no se sale con eventos sin enviar: los en curso deben cerrarse antes y los por enviar se
   * envían aquí mismo (si alguno no se puede enviar, la sesión sigue abierta).
   */
  function pedirCierreSesion() {
    if (cerrandoSesion.current) return;
    Alert.alert('¿Cerrar sesión?', 'Dejará de compartir la ubicación de la unidad con el centro de operaciones.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void validarYCerrarSesion() },
    ]);
  }

  async function validarYCerrarSesion() {
    if (!sesion) {
      await signOut();
      return;
    }
    const pendientes = await contarEventosLocales(db, sesion);

    if (pendientes.en_curso > 0) {
      setEstatus('en_curso');
      Alert.alert(
        'Tiene eventos en curso',
        `${pendientes.en_curso === 1 ? 'Hay 1 evento en curso' : `Hay ${pendientes.en_curso} eventos en curso`} sin cerrar. ` +
          'Ciérrelos y envíelos antes de cerrar sesión: si sale ahora no se enviarán al centro.',
      );
      return;
    }

    if (pendientes.por_enviar === 0) {
      await signOut();
      return;
    }

    setEstatus('por_enviar');
    Alert.alert(
      'Tiene eventos sin enviar',
      `${pendientes.por_enviar === 1 ? 'Hay 1 evento cerrado' : `Hay ${pendientes.por_enviar} eventos cerrados`} sin enviar al centro. ` +
        'Se enviarán ahora y luego se cerrará la sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar y cerrar sesión', onPress: () => void enviarPendientesYCerrarSesion() },
      ],
    );
  }

  async function enviarPendientesYCerrarSesion() {
    if (!token || !sesion || cerrandoSesion.current) return;
    cerrandoSesion.current = true;
    try {
      toast.mostrar({ mensaje: `Enviando ${eventos(conteo?.por_enviar ?? 0)}…`, duracion: 60_000 });
      const resultado = await enviarPorEnviar();
      if (!resultado) {
        toast.mostrar({ mensaje: 'Ya se están enviando los eventos. Espere y vuelva a cerrar sesión.' });
        return;
      }
      const { fallidos } = resultado;

      if (fallidos.length > 0) {
        toast.mostrar({ mensaje: 'No se cerró la sesión: hay eventos sin enviar', icono: 'error' });
        Alert.alert(
          'No se pudo cerrar la sesión',
          `${
            resultado.total - resultado.enviados === 1
              ? '1 evento no se pudo enviar'
              : `${resultado.total - resultado.enviados} eventos no se pudieron enviar`
          }. ` +
            `Siguen guardados en el teléfono; reintente cuando tenga señal.\n\n${fallidos.join('\n')}`,
        );
        return;
      }

      toast.mostrar({ mensaje: 'Eventos enviados', icono: 'exito' });
      await signOut();
    } finally {
      cerrandoSesion.current = false;
    }
  }

  /**
   * Trae el asignado al dispositivo (la primera vez, con conexión) y abre su formulario. Si aún
   * estaba pendiente, completarlo es llegar al lugar: se registra la llegada en el servidor antes,
   * para que el centro lo vea en curso y la hora de llegada sea la real.
   */
  async function editarAsignado(evento: EventoAsignado) {
    if (!token || !sesion) return;
    try {
      if (evento.estado === EstadoEventoValue.Pendiente) {
        await iniciarEvento(token, evento.id).catch((error) => {
          // Sin red tampoco se puede traer: que lo diga el paso siguiente. Otro rechazo (p. ej. ya
          // estaba en curso) no impide completarlo; al enviarlo, la API aplica la llegada si falta.
          if (error instanceof ApiError && error.status === NETWORK_ERROR_STATUS) throw error;
        });
      }
      const localId = await abrirAsignadoEnDispositivo(db, token, sesion, evento.id);
      router.push({ pathname: '/events/[id]', params: { id: String(localId) } });
    } catch (error) {
      Alert.alert('No se pudo abrir el evento', describirError(error));
      throw error;
    }
  }

  /** Borra del teléfono un evento propio sin enviar (registrado por error o duplicado). */
  function descartar(item: EventoLocalListItem) {
    if (!sesion) return;
    Alert.alert(
      '¿Descartar el evento?',
      'Se borrará de este teléfono con sus vehículos, personas y fotos. No se enviará al centro y no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () =>
            void descartarEventoLocal(db, item.localId, sesion)
              .then((fotos) => {
                fotos.forEach(borrarFoto);
                toast.mostrar({ mensaje: 'Evento descartado', icono: 'exito' });
              })
              .catch((error) => Alert.alert('No se pudo descartar', describirError(error)))
              .finally(refetchAll),
        },
      ],
    );
  }

  async function cerrar(item: EventoLocalListItem, tipoCierreId: number) {
    const yaCerrado = item.estatus === 'por_enviar';
    await cerrarEventoLocal(db, item.localId, tipoCierreId);
    if (!yaCerrado) toast.mostrar({ mensaje: 'Evento cerrado: está en «Por enviar»', icono: 'exito', accion: { label: 'Ver', onPress: () => setEstatus('por_enviar') } });
    refetchAll();
  }

  async function enviar(item: EventoLocalListItem) {
    if (!token || !sesion) return;
    try {
      const resultado = await enviarEventoLocal(db, token, sesion, item.localId);
      toast.mostrar({
        mensaje: resultado.esDuplicado ? `El evento No. ${resultado.id} ya estaba en el centro` : `Enviado como evento No. ${resultado.id}`,
        icono: 'exito',
      });
    } catch (error) {
      // Sin red basta un aviso breve con "Reintentar" (el motivo queda en la tarjeta); un rechazo
      // de la API se muestra completo porque dice qué corregir
      if (esErrorDeRed(error))
        toast.mostrar({ mensaje: 'Sin conexión: el evento sigue en el teléfono', icono: 'error', accion: { label: 'Reintentar', onPress: () => void enviar(item).catch(() => {}) } });
      else Alert.alert('No se pudo enviar', describirError(error));
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
      const pestana = tomarPestanaInicio();
      if (pestana) setEstatus(pestana);
      if (primerEnfoque.current) {
        primerEnfoque.current = false;
        return;
      }
      setRefreshNonce((n) => n + 1);
    }, []),
  );
  const isRefreshing = isLoadingResumen || eventsState.status === 'loading';
  // Los que ya están en el dispositivo se editan, cierran y envían desde la lista de eventos
  const pendientesDeEditar = asignados?.filter((a) => !enDispositivo.includes(a.id)) ?? [];
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
            <IconButton icon="recargar" label="Actualizar" onPress={refetchAll} />
            <IconButton icon="salir" label="Cerrar sesión" onPress={pedirCierreSesion} />
          </>
        }
      />

      {!isConnected && (
        <View style={styles.sinConexion} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icon name="sinSenal" color={Palette.white} size={20} />
          <Text style={styles.sinConexionTexto}>
            Sin conexión. Puede registrar y cerrar eventos; se envían solos al volver la señal.
          </Text>
        </View>
      )}

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
                componente={session.agente.componente ? describirAgente(session.agente.componente) : null}
                denominacion={denominacion}
                resumen={resumen}
                isLoadingResumen={isLoadingResumen}
                // Los asignados ya cuentan en el resumen (los creó el centro): solo faltan los propios
                pendientesLocales={conteo ? Math.max(0, conteo.en_curso + conteo.por_enviar - enDispositivo.length) : 0}
                onVerEstadisticas={() => router.push('/estadisticas')}
              />
            )}
            {!!token && <AvisoVencimiento token={token} />}
            {!!token && <EstadoUbicacion token={token} />}
            {!!sesion && <PendientesOtrasSesiones db={db} sesion={sesion} version={refreshNonce} />}
            {!!token && pendientesDeEditar.length > 0 && (
              <View style={styles.asignados}>
                <Text style={styles.asignadosTitulo}>
                  Asignados por el centro ({pendientesDeEditar.length}){estadoAvisos !== 'conectado' ? ' · avisos sin conexión' : ''}
                </Text>
                {pendientesDeEditar.map((evento) => (
                  <EventoAsignadoCard
                    key={evento.id}
                    evento={evento}
                    agentes={agentesUnidad}
                    onIniciar={() => operarAsignado(() => iniciarEvento(token, evento.id), 'No se pudo registrar la llegada')}
                    onCompletar={(tipoCierreId) =>
                      operarAsignado(() => completarEvento(token, evento.id, { tipoCierreId }), 'No se pudo cerrar el evento')
                    }
                    onCambiarAgente={(id) => operarAsignado(() => cambiarAgenteEvento(token, evento.id, id), 'No se pudo cambiar el agente')}
                    onEditar={() => editarAsignado(evento)}
                    onConfirmarLlegadaApoyo={() =>
                      operarAsignado(() => confirmarLlegadaApoyo(token, evento.id), 'No se pudo registrar la llegada')
                    }
                  />
                ))}
              </View>
            )}
            <SegmentedControl
              options={ESTATUS.map((e) => ({
                label: conteo?.[e] ? `${ESTATUS_LOCAL_LABELS[e]} (${conteo[e]})` : ESTATUS_LOCAL_LABELS[e],
                value: e,
              }))}
              value={estatus}
              onChange={setEstatus}
            />
            {estatus === 'por_enviar' && (conteo?.por_enviar ?? 0) >= 2 && (
              <Button
                label={`Enviar todos (${conteo!.por_enviar})`}
                icon="enviar"
                onPress={() => void enviarTodos()}
                loading={enviandoTodos}
                disabled={!isConnected}
              />
            )}
            {estatus === 'enviado' && (
              <Text style={styles.nota}>Se muestran los enviados de los últimos 7 días; los anteriores ya están en el centro.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <EventCard
            item={item}
            agenteAtiende={agenteQueAtiende(item.agenteAtiendeId)}
            onEditar={() => router.push({ pathname: '/events/[id]', params: { id: String(item.localId) } })}
            onCerrar={(tipoCierreId) => cerrar(item, tipoCierreId)}
            onEnviar={() => enviar(item)}
            onDescartar={item.serverId == null ? () => descartar(item) : undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          listado.status === 'loading' ? (
            <ActivityIndicator style={styles.loader} color={Palette.primary[500]} />
          ) : listado.status === 'error' ? (
            <View style={styles.errorState}>
              <EmptyState icon="alerta" title="No se pudo cargar" description={listado.message} />
              <Button label="Reintentar" variant="ghost" onPress={refetchAll} />
            </View>
          ) : (
            <EmptyState icon="vacio" title="No hay eventos" description={SIN_EVENTOS[estatus]} />
          )
        }
      />

      <Fab icon="agregar" label="Nuevo evento" onPress={() => router.push('/events/new')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Palette.neutral[50],
  },
  sinConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Palette.neutral[800],
  },
  sinConexionTexto: {
    flex: 1,
    color: Palette.white,
    fontSize: 13,
    fontWeight: '600',
  },
  nota: {
    fontSize: 12,
    color: Palette.neutral[500],
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
  asignados: {
    gap: 10,
  },
  asignadosTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.warning[900],
    textTransform: 'uppercase',
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
