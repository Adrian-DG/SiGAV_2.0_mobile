import { File } from 'expo-file-system';

import { apiRequest } from '@/lib/api-client';
import { diaOperativo } from '@/lib/fecha-operativa';

import type {
  TipoEvidencia,
  DenominacionActual,
  EstadisticasEventosResponse,
  EstadoEvento,
  EventoDetalle,
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
 * PUT /api/eventos/{id} — envía un evento asignado por el call center, completado en el dispositivo
 * (mismo cuerpo que el registro): la API reemplaza sus datos, vehículos y personas y lo completa.
 * Idempotente por requestId: un reenvío responde el mismo evento con esDuplicado = true.
 */
export function actualizarEvento(token: string, eventoId: number, request: RegistrarEventoRequest) {
  return apiRequest<RegistrarEventoResult>(`/eventos/${eventoId}`, { method: 'PUT', token, body: request });
}

/** GET /api/eventos/{id} — detalle completo (para traer al dispositivo un evento asignado y completarlo). */
export function getEventoDetalle(token: string, eventoId: number) {
  return apiRequest<EventoDetalle>(`/eventos/${eventoId}`, { token });
}

/**
 * POST /api/eventos/{id}/evidencias (multipart) — sube una foto del evento, asociada a una persona o
 * a un vehículo (sus Ids en la API). Idempotente por requestId: un reintento no la duplica.
 */
export function subirEvidencia(
  token: string,
  eventoId: number,
  evidencia: {
    tipo: TipoEvidencia;
    uri: string;
    requestId: string;
    ciudadanoId?: number | null;
    vehiculoId?: number | null;
  },
) {
  const form = new FormData();
  // El fetch global es el de Expo (expo/fetch), que NO admite el { uri, name, type } de React Native
  // ("Unsupported FormDataPart"): el archivo va como File de expo-file-system, que sí admite. La API
  // detecta el formato por el contenido, no por el nombre.
  form.append('archivo', new File(evidencia.uri) as unknown as Blob);
  form.append('tipo', String(evidencia.tipo));
  form.append('requestId', evidencia.requestId);
  if (evidencia.ciudadanoId) form.append('ciudadanoId', String(evidencia.ciudadanoId));
  if (evidencia.vehiculoId) form.append('vehiculoId', String(evidencia.vehiculoId));
  // Una foto pesa más que un JSON: con mala señal necesita más tiempo
  return apiRequest<{ id: number; esDuplicado: boolean }>(`/eventos/${eventoId}/evidencias`, {
    method: 'POST',
    token,
    body: form,
    timeoutMs: 60_000,
  });
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
