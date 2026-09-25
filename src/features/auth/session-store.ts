import { ApiError } from '@/lib/api-client';
import { isTokenExpired } from '@/lib/jwt';

import type { SesionActual } from './types';

export const TOKEN_KEY = 'sigav_movil_token';
// Copia de la última sesión confirmada por la API: permite abrir la app sin conexión.
export const SESION_KEY = 'sigav_movil_sesion';

export type Session = {
  token: string;
  agente: SesionActual;
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

type RestoreDeps = {
  storage: Storage;
  fetchSesion: (token: string) => Promise<SesionActual>;
};

/** La API rechazó el token: no tiene sentido reintentar con él. */
export function isSessionRejected(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export async function persistSession(storage: Storage, session: Session): Promise<void> {
  await storage.setItem(TOKEN_KEY, session.token);
  await storage.setItem(SESION_KEY, JSON.stringify(session.agente));
}

export async function clearSession(storage: Storage): Promise<void> {
  await storage.deleteItem(TOKEN_KEY);
  await storage.deleteItem(SESION_KEY);
}

async function readCachedSesion(storage: Storage): Promise<SesionActual | null> {
  try {
    const raw = await storage.getItem(SESION_KEY);
    return raw ? (JSON.parse(raw) as SesionActual) : null;
  } catch {
    return null;
  }
}

/**
 * Restaura la sesión guardada al abrir la app.
 * - Token vencido (se sabe sin red leyendo el JWT) o rechazado por la API (401/403): se descarta.
 * - Sin conexión o API caída: el token sigue vigente y se usa la última sesión conocida, para que
 *   el agente pueda seguir trabajando; su turno no depende de la señal.
 */
export async function restoreSession({ storage, fetchSesion }: RestoreDeps): Promise<Session | null> {
  const token = await storage.getItem(TOKEN_KEY);
  if (!token) return null;

  if (isTokenExpired(token)) {
    await clearSession(storage);
    return null;
  }

  try {
    const agente = await fetchSesion(token);
    await storage.setItem(SESION_KEY, JSON.stringify(agente));
    return { token, agente };
  } catch (error) {
    if (isSessionRejected(error)) {
      await clearSession(storage);
      return null;
    }

    const cached = await readCachedSesion(storage);
    return cached ? { token, agente: cached } : null;
  }
}
