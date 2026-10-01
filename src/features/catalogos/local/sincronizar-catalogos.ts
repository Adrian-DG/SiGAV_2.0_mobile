import type { LocalDb } from '@/features/events/local/eventos-local';

import { getCatalogosMovil } from '../api';
import { guardarCatalogos, marcarCatalogosVigentes, obtenerEstadoCatalogos } from './catalogos-local';

export type ResultadoSincronizacion = { version: string; actualizados: boolean };

/**
 * Pide a la API los catálogos indicando la versión que ya hay en el dispositivo. Si cambiaron, los
 * reemplaza; si no, solo registra que siguen vigentes. Un error (p. ej. sin conexión) se propaga y
 * el dispositivo conserva lo que tenía.
 */
export async function sincronizarCatalogos(db: LocalDb, token: string, ahora: Date = new Date()): Promise<ResultadoSincronizacion> {
  const local = await obtenerEstadoCatalogos(db);
  const { version, catalogos } = await getCatalogosMovil(token, local?.version ?? null);

  if (catalogos) {
    await guardarCatalogos(db, version, catalogos, ahora);
    return { version, actualizados: true };
  }

  await marcarCatalogosVigentes(db, ahora);
  return { version, actualizados: false };
}
