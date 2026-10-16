import { apiRequest } from '@/lib/api-client';

import type { CategoriaEvento, EstadoEvento } from '../types';

/** Mirrors Application/Features/Operaciones/Eventos/GetEventosAsignados.cs EventoAsignadoViewModel. */
export type EventoAsignado = {
  id: number;
  estado: EstadoEvento;
  canalReporte: number;
  tipos: string[];
  categorias: CategoriaEvento[];
  latitud: number;
  longitud: number;
  direccion: string | null;
  municipio: string;
  tramo: string | null;
  comentario: string | null;
  fechaHoraReporte: string;
  fechaHoraLlegada: string | null;
  /** 1 Principal, 2 Apoyo, 3 Apoyo solicitado. */
  rol: number;
  /** Agente de la unidad que lo atiende (el de la sesión o su componente). */
  agenteId: number;
};

/**
 * GET /api/eventos/asignados — eventos pendientes o en curso de la unidad de la sesión (los crea el
 * call center). A diferencia de los que registra el agente, viven en el servidor: no se guardan en
 * el dispositivo y requieren conexión.
 */
export function getEventosAsignados(token: string) {
  return apiRequest<EventoAsignado[]>('/eventos/asignados', { token });
}

/** PATCH /api/eventos/{id}/iniciar — la unidad llegó al lugar (Pendiente → En curso). */
export function iniciarEvento(token: string, eventoId: number) {
  return apiRequest<void>(`/eventos/${eventoId}/iniciar`, {
    method: 'PATCH',
    token,
    body: { fechaHoraLlegadaUtc: new Date().toISOString() },
  });
}

/** PATCH /api/eventos/{id}/agente — cuál de los dos agentes de la unidad lo atiende. */
export function cambiarAgenteEvento(token: string, eventoId: number, agenteId: number) {
  return apiRequest<void>(`/eventos/${eventoId}/agente`, { method: 'PATCH', token, body: { agenteId } });
}
