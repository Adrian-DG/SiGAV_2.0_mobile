import { apiRequest } from '@/lib/api-client';
import { diaOperativo } from '@/lib/fecha-operativa';

import type {
  DenominacionActual,
  EstadisticasEventosResponse,
  EstadoEvento,
  EventoListItem,
  PagedResult,
  RegistrarEventoRequest,
  RegistrarEventoResult,
} from './types';

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

/** GET /api/unidades/{id}/denominacion-actual — denominación, tramo y nivel con que opera la unidad. */
export function getDenominacionActual(token: string, unidadId: number) {
  return apiRequest<DenominacionActual>(`/unidades/${unidadId}/denominacion-actual`, { token });
}

/**
 * GET /api/eventos — eventos en los que participa la unidad de la sesión (la API aplica el alcance),
 * más recientes primero.
 */
export function getEventosUnidad(token: string, estado: EstadoEvento, page = 1, size = 50) {
  return apiRequest<PagedResult<EventoListItem>>('/eventos', { token, query: { estado, page, size } });
}

/**
 * POST /api/eventos — idempotente por requestId: si la API ya lo tenía (reenvío) responde el mismo
 * evento con esDuplicado = true en lugar de crear otro.
 */
export function registrarEvento(token: string, request: RegistrarEventoRequest) {
  return apiRequest<RegistrarEventoResult>('/eventos', { method: 'POST', token, body: request });
}

/**
 * PATCH /api/eventos/{id}/completar — EnCurso/Pendiente → Completado. Solo la unidad principal
 * del evento puede completarlo (EventoAcceso.AsegurarPuedeOperar en la API).
 */
export function completarEvento(
  token: string,
  eventoId: number,
  request: { tipoCierreId: number; fechaHoraCompletadoUtc?: string },
) {
  return apiRequest<void>(`/eventos/${eventoId}/completar`, { method: 'PATCH', token, body: request });
}
