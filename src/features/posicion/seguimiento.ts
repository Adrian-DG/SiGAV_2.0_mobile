import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { TOKEN_KEY } from '@/features/auth/session-store';
import { ApiError } from '@/lib/api-client';
import { secureStorage } from '@/lib/storage';

import { reportarPosicion } from './api';

/**
 * Seguimiento de la unidad mientras hay sesión: la app envía su posición al servidor cada ~30 s
 * para el mapa de unidades del front desk (GET /unidades/posiciones).
 *
 * - Con permiso de ubicación "Todo el tiempo": tarea de ubicación en segundo plano
 *   (expo-task-manager). En Android corre como servicio en primer plano, con su notificación fija,
 *   así sigue enviando con la pantalla bloqueada o con otra app abierta.
 * - Solo "Mientras se usa la app" (o en web): se envía mientras la app está abierta.
 *
 * Sin conexión simplemente no se envía: solo interesa la posición más reciente, no un historial.
 */

export const TAREA_UBICACION = 'sigav-ubicacion-unidad';

/** Cada cuánto se pide la ubicación. El servidor considera la unidad "sin señal" a los 2 min. */
const INTERVALO_MS = 30_000;
/** iOS puede entregar lecturas cada segundo en movimiento: se envía como mucho una cada 25 s. */
const ENVIO_MINIMO_MS = 25_000;
/** Lecturas con más incertidumbre (p. ej. solo por red celular) no se envían. */
const PRECISION_MAXIMA_M = 100;

export type ModoSeguimiento =
  /** Sin sesión. */
  | 'inactivo'
  /** Envía aunque la app esté en segundo plano o la pantalla bloqueada. */
  | 'segundo_plano'
  /** Solo envía con la app abierta (no hay permiso "Todo el tiempo"). */
  | 'primer_plano'
  /** El agente no dio permiso de ubicación. */
  | 'sin_permiso'
  /** El servidor rechazó los envíos (unidad no disponible, otro agente la opera). */
  | 'detenido';

export type EstadoSeguimiento = {
  modo: ModoSeguimiento;
  /** Motivo, para 'detenido'. */
  mensaje?: string;
  /** Hora (ms) del último envío aceptado. */
  ultimoEnvio?: number;
  /** Se puede pedir el permiso que falta desde la app; si no, hay que ir a los ajustes. */
  puedePedirPermiso?: boolean;
};

// ------------------------------------------------ Estado observable

let estado: EstadoSeguimiento = { modo: 'inactivo' };
const suscriptores = new Set<() => void>();

function actualizar(cambios: Partial<EstadoSeguimiento> & Pick<EstadoSeguimiento, 'modo'>) {
  estado = { ...cambios };
  suscriptores.forEach((s) => s());
}

function registrarEnvio(momento: number) {
  estado = { ...estado, ultimoEnvio: momento };
  suscriptores.forEach((s) => s());
}

export function useSeguimiento(): EstadoSeguimiento {
  return useSyncExternalStore(
    (suscriptor) => {
      suscriptores.add(suscriptor);
      return () => suscriptores.delete(suscriptor);
    },
    () => estado,
  );
}

// ------------------------------------------------ Envío

let tokenActual: string | null = null;
let ultimoEnvio = 0;
let enviando = false;
let vigilancia: Location.LocationSubscription | null = null;

async function procesar(lecturas: Location.LocationObject[]): Promise<void> {
  const lectura = lecturas.reduce<Location.LocationObject | null>((ultima, l) => (!ultima || l.timestamp > ultima.timestamp ? l : ultima), null);
  if (!lectura || enviando) return;
  if (lectura.coords.accuracy !== null && lectura.coords.accuracy > PRECISION_MAXIMA_M) return;
  if (Date.now() - ultimoEnvio < ENVIO_MINIMO_MS) return;

  // Si Android relanzó la tarea sin la app abierta, el token se lee del almacenamiento
  const token = tokenActual ?? (await secureStorage.getItem(TOKEN_KEY).catch(() => null));
  if (!token) return;

  const { latitude, longitude, accuracy, heading, speed } = lectura.coords;
  enviando = true;
  try {
    await reportarPosicion(token, {
      latitud: Number(latitude.toFixed(6)),
      longitud: Number(longitude.toFixed(6)),
      precisionMetros: accuracy ?? null,
      rumbo: heading !== null && heading >= 0 ? heading : null,
      velocidadKmh: speed !== null && speed >= 0 ? speed * 3.6 : null,
      fechaHoraGpsUtc: new Date(lectura.timestamp).toISOString(),
    });
    ultimoEnvio = Date.now();
    registrarEnvio(ultimoEnvio);
  } catch (error) {
    if (!(error instanceof ApiError)) return;
    // 401: la sesión se cerró (el manejador de api-client ya lleva al login).
    // 403 / 409: la unidad ya no puede operar o la opera otro agente. Sin red o 5xx: se reintenta
    // con la próxima lectura.
    if (error.status === 401) await detenerSeguimiento();
    else if (error.status === 403 || error.status === 409) await detenerSeguimiento(error.message);
  } finally {
    enviando = false;
  }
}

// Las tareas se definen al cargar el módulo (lo importa app/_layout.tsx), antes de que el sistema
// pueda entregar lecturas a una app relanzada en segundo plano.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREA_UBICACION, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    await procesar(data.locations);
  });
}

// ------------------------------------------------ Inicio y fin

const OPCIONES: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: INTERVALO_MS,
  // 0: también se reporta la unidad detenida (si no, a los 2 min saldría "sin señal")
  distanceInterval: 0,
  // iOS
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  // Android: notificación fija mientras se comparte la ubicación
  foregroundService: {
    notificationTitle: 'SiGAV Móvil',
    notificationBody: 'Compartiendo la ubicación de la unidad durante el turno.',
    notificationColor: '#05539B',
    killServiceOnDestroy: false,
  },
};

async function tareaIniciada(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION).catch(() => false);
}

async function iniciarVigilancia(): Promise<void> {
  if (vigilancia) return;
  vigilancia = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: INTERVALO_MS, distanceInterval: 0 },
    (lectura) => void procesar([lectura]),
  );
}

function detenerVigilancia(): void {
  vigilancia?.remove();
  vigilancia = null;
}

/**
 * Empieza a enviar la posición con el token de la sesión. Si ya estaba enviando, solo cambia el
 * token. Pide el permiso de ubicación "mientras se usa" si falta; el de "todo el tiempo" se pide
 * aparte con {@link pedirPermisoSegundoPlano}, después de explicar para qué es.
 */
export async function iniciarSeguimiento(token: string): Promise<void> {
  const tokenAnterior = tokenActual;
  tokenActual = token;
  if (tokenAnterior !== token) ultimoEnvio = 0;

  try {
    const primerPlano = await Location.requestForegroundPermissionsAsync();
    if (!primerPlano.granted) {
      detenerVigilancia();
      actualizar({ modo: 'sin_permiso', puedePedirPermiso: primerPlano.canAskAgain });
      return;
    }

    const segundoPlano =
      Platform.OS === 'web' ? null : await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (segundoPlano?.granted && (await TaskManager.isAvailableAsync())) {
      detenerVigilancia();
      if (!(await tareaIniciada())) await Location.startLocationUpdatesAsync(TAREA_UBICACION, OPCIONES);
      actualizar({ modo: 'segundo_plano', ultimoEnvio: ultimoEnvio || undefined });
      return;
    }

    await iniciarVigilancia();
    actualizar({
      modo: 'primer_plano',
      ultimoEnvio: ultimoEnvio || undefined,
      puedePedirPermiso: Platform.OS !== 'web' && (segundoPlano?.canAskAgain ?? false),
    });
  } catch {
    // Servicios de ubicación apagados u otro error del sistema
    actualizar({ modo: 'sin_permiso', puedePedirPermiso: false });
  }
}

/** Pide "Permitir todo el tiempo" y, si lo da, pasa a enviar en segundo plano. */
export async function pedirPermisoSegundoPlano(): Promise<boolean> {
  if (Platform.OS === 'web' || !tokenActual) return false;
  const primerPlano = await Location.requestForegroundPermissionsAsync();
  if (!primerPlano.granted) {
    actualizar({ modo: 'sin_permiso', puedePedirPermiso: primerPlano.canAskAgain });
    return false;
  }
  const segundoPlano = await Location.requestBackgroundPermissionsAsync();
  await iniciarSeguimiento(tokenActual);
  return segundoPlano.granted;
}

/** Deja de enviar (al cerrar sesión o si el servidor rechaza los envíos, con su motivo). */
export async function detenerSeguimiento(mensaje?: string): Promise<void> {
  tokenActual = null;
  ultimoEnvio = 0;
  detenerVigilancia();
  if (await tareaIniciada()) await Location.stopLocationUpdatesAsync(TAREA_UBICACION).catch(() => {});
  actualizar(mensaje ? { modo: 'detenido', mensaje } : { modo: 'inactivo' });
}
