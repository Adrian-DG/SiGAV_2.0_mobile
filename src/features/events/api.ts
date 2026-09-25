import { apiRequest } from '@/lib/api-client';
import { diaOperativo } from '@/lib/fecha-operativa';

import type { EstadisticasEventosResponse, EstadoEvento, EventoListItem, NamedViewModel } from './types';

/**
 * GET /api/estadisticas/eventos — el alcance lo decide la sesión: en la app móvil, solo la
 * ficha de la unidad. Se usa aquí acotado a "hoy" para alimentar el resumen del home.
 */
export function getEstadisticasEventosHoy(token: string) {
  // Día operativo de RD (no el día UTC de toISOString, que después de las 8 p. m. es mañana)
  const hoy = diaOperativo();
  return apiRequest<EstadisticasEventosResponse>('/estadisticas/eventos', {
    token,
    query: { desde: hoy, hasta: hoy },
  });
}

/** GET /api/unidades/{id}/denominacion-actual */
export function getDenominacionActual(token: string, unidadId: number) {
  return apiRequest<NamedViewModel>(`/unidades/${unidadId}/denominacion-actual`, { token });
}

/**
 * GET /api/eventos — listado de eventos de la unidad, filtrado por estado.
 * Este endpoint todavía NO existe en la API (solo hay Estadisticas y TipoEventos sobre el
 * agregado Evento por ahora). Se deja implementado contra la forma esperada; mientras tanto el
 * home lee de SQLite local (features/events/local-repository.ts) y esta función no se usa.
 */
export function getEventosUnidad(token: string, estado: EstadoEvento) {
  return apiRequest<EventoListItem[]>('/eventos', { token, query: { estado } });
}
