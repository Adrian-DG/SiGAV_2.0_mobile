import { apiRequest } from '@/lib/api-client';

import type { EstadisticasEventosResponse, EstadoEvento, EventoListItem, NamedViewModel } from './types';

/**
 * GET /api/estadisticas/eventos — el alcance lo decide la sesión: en la app móvil, solo la
 * ficha de la unidad. Se usa aquí acotado a "hoy" para alimentar el resumen del home.
 */
export function getEstadisticasEventosHoy(token: string) {
  const hoy = new Date().toISOString().slice(0, 10);
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
 * agregado Evento por ahora). Se deja implementado contra la forma esperada para que conectar
 * el home sea un cambio de una sola línea cuando el backend lo agregue; hasta entonces el
 * home screen distingue el 404 y muestra un estado "próximamente" en vez de un error de red.
 */
export function getEventosUnidad(token: string, estado: EstadoEvento) {
  return apiRequest<EventoListItem[]>('/eventos', { token, query: { estado } });
}
