import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import type { ApiEnvironment } from '@/lib/api-config';

export const MENSAJE_SIN_INTERNET = 'No hay conexión a internet. Verifique sus datos móviles o Wi-Fi e intente de nuevo.';
export const MENSAJE_SIN_RED = 'El dispositivo no está conectado a ninguna red. Active los datos móviles o el Wi-Fi e intente de nuevo.';

export type EstadoConexion = { conectado: true } | { conectado: false; mensaje: string };

/** Si NetInfo no responde a tiempo no se bloquea la petición: decide el propio fetch. */
const CONSULTA_TIMEOUT_MS = 2_000;

/**
 * Decide con el estado de NetInfo si vale la pena intentar la petición. Solo un "no" explícito
 * bloquea: `isInternetReachable` es null mientras el sistema aún no lo sabe (p. ej. justo al abrir
 * la app), y en ese caso se intenta.
 *
 * Con la API local (una PC en la misma red) no se exige internet: basta estar conectado a la red,
 * porque una Wi-Fi de pruebas sin salida a internet sí llega a la API.
 */
export function evaluarConexion(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
  environment: ApiEnvironment,
): EstadoConexion {
  if (state.isConnected === false) return { conectado: false, mensaje: MENSAJE_SIN_RED };
  if (environment !== 'local' && state.isInternetReachable === false) return { conectado: false, mensaje: MENSAJE_SIN_INTERNET };
  return { conectado: true };
}

/** Estado actual de la conexión del dispositivo, para validarlo antes de llamar a la API. */
export async function verificarConexion(environment: ApiEnvironment): Promise<EstadoConexion> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const state = await Promise.race([
      NetInfo.fetch(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CONSULTA_TIMEOUT_MS);
      }),
    ]);
    return state ? evaluarConexion(state, environment) : { conectado: true };
  } catch {
    return { conectado: true };
  } finally {
    clearTimeout(timer);
  }
}
