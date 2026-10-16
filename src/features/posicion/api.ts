import { apiRequest } from '@/lib/api-client';

/** Mirrors Application/Features/Operaciones/Posiciones/ReportarPosicion.cs. */
export type ReportarPosicionRequest = {
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
  /** Grados desde el norte (0-360), null si el GPS no lo da. */
  rumbo: number | null;
  velocidadKmh: number | null;
  fechaHoraGpsUtc: string;
  /**
   * Agentes de la sesión (el agente o su componente) con un evento en curso en el dispositivo, aún sin
   * enviar: el call center no les asigna otro. Sin indicar, el servidor conserva lo último informado.
   */
  agentesOcupados?: number[];
};

/**
 * POST /api/unidades/posicion — posición de la unidad de la sesión. 204 si se aceptó (o se ignoró
 * por llegar muy seguida); 403 la unidad ya no puede operar; 409 otro agente la opera; 401 la
 * sesión fue cerrada (logout o front desk la liberó).
 */
export function reportarPosicion(token: string, body: ReportarPosicionRequest) {
  return apiRequest<null>('/unidades/posicion', { method: 'POST', token, body, timeoutMs: 10_000 });
}

/**
 * POST /api/authentication/movil/logout — la unidad deja de mostrarse en línea y otro agente
 * puede iniciar sesión con ella de inmediato.
 */
export function cerrarSesionMovil(token: string) {
  return apiRequest<null>('/authentication/movil/logout', { method: 'POST', token, timeoutMs: 5_000 });
}
