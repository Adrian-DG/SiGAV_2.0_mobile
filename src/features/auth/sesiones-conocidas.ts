import type { SesionMovil } from '@/lib/jwt';
import { secureStorage } from '@/lib/storage';

const SESIONES_KEY = 'sigav_movil_sesiones_conocidas';
/** SecureStore admite valores pequeños: solo las últimas sesiones del teléfono. */
const MAX_SESIONES = 10;

/** Cómo mostrar una sesión anterior (agente y unidad) cuya información ya no está en el token actual. */
export type SesionConocida = { agenteId: number; unidadId: number; ficha: string; agente: string };

async function leer(): Promise<SesionConocida[]> {
  try {
    const raw = await secureStorage.getItem(SESIONES_KEY);
    const lista: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? (lista as SesionConocida[]) : [];
  } catch {
    return [];
  }
}

/** Recuerda la ficha y el agente de la sesión que inicia, para nombrarla si deja eventos sin enviar. */
export async function recordarSesion(sesion: SesionMovil): Promise<void> {
  const nueva: SesionConocida = {
    agenteId: sesion.agenteId,
    unidadId: sesion.unidadId,
    ficha: sesion.ficha,
    agente: sesion.nombre || sesion.identificacion,
  };
  const otras = (await leer()).filter((s) => !(s.agenteId === nueva.agenteId && s.unidadId === nueva.unidadId));
  await secureStorage.setItem(SESIONES_KEY, JSON.stringify([nueva, ...otras].slice(0, MAX_SESIONES))).catch(() => {});
}

/** La sesión recordada con ese agente y esa unidad, o null si no se conoce. */
export async function buscarSesion(agenteId: number, unidadId: number): Promise<SesionConocida | null> {
  return (await leer()).find((s) => s.agenteId === agenteId && s.unidadId === unidadId) ?? null;
}
