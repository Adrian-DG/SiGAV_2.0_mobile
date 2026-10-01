import { apiRequest } from '@/lib/api-client';

import type { EstadisticasEventos } from './types';

/**
 * GET /api/estadisticas/eventos — eventos atendidos en el rango (días operativos, YYYY-MM-DD,
 * máximo 366 días). La API limita el resultado al alcance de la denominación de la unidad.
 */
export function getEstadisticasEventos(token: string, desde: string, hasta: string, signal?: AbortSignal) {
  return apiRequest<EstadisticasEventos>('/estadisticas/eventos', { token, query: { desde, hasta }, signal });
}
