import { ApiError } from '@/lib/api-client';
import { isTokenExpired, leerSesionMovil, type SesionMovil } from '@/lib/jwt';

export const TOKEN_KEY = 'sigav_movil_token';
/**
 * Versiones anteriores guardaban aquí una copia de GET /authentication/sesion. Ya no hace falta:
 * agente y unidad viajan en el token, que se puede leer sin conexión. Solo se borra.
 */
const SESION_LEGACY_KEY = 'sigav_movil_sesion';

export type Session = {
  token: string;
  /** Agente y unidad de la sesión, leídos del token (lib/jwt.ts). */
  agente: SesionMovil;
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

type RestoreDeps = {
  storage: Storage;
  /** Confirma con la API que el token sigue aceptado (p. ej. no fue revocado). */
  verificarToken: (token: string) => Promise<unknown>;
};

/** La API rechazó el token: no tiene sentido reintentar con él. */
export function isSessionRejected(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/** Sesión a partir del token recién emitido; error si no es un token móvil válido. */
export function sesionDesdeToken(token: string): Session {
  const agente = leerSesionMovil(token);
  if (!agente) throw new Error('El servidor devolvió una sesión sin agente o sin unidad. Intente de nuevo.');
  return { token, agente };
}

export async function persistSession(storage: Storage, session: Session): Promise<void> {
  await storage.setItem(TOKEN_KEY, session.token);
  await storage.deleteItem(SESION_LEGACY_KEY).catch(() => {});
}

export async function clearSession(storage: Storage): Promise<void> {
  await storage.deleteItem(TOKEN_KEY);
  await storage.deleteItem(SESION_LEGACY_KEY).catch(() => {});
}

/**
 * Restaura la sesión guardada al abrir la app.
 * - Token vencido (se sabe sin red leyendo el JWT), que no es de la app (sin agente o unidad) o
 *   rechazado por la API (401/403): se descarta.
 * - Sin conexión o API caída: el token sigue vigente y se usa tal cual, para que el agente pueda
 *   seguir trabajando; su turno no depende de la señal.
 */
export async function restoreSession({ storage, verificarToken }: RestoreDeps): Promise<Session | null> {
  const token = await storage.getItem(TOKEN_KEY);
  if (!token) return null;

  const agente = isTokenExpired(token) ? null : leerSesionMovil(token);
  if (!agente) {
    await clearSession(storage);
    return null;
  }

  try {
    await verificarToken(token);
  } catch (error) {
    if (isSessionRejected(error)) {
      await clearSession(storage);
      return null;
    }
  }

  await storage.deleteItem(SESION_LEGACY_KEY).catch(() => {});
  return { token, agente };
}
