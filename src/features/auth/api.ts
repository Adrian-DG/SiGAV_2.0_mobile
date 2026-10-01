import { apiRequest } from '@/lib/api-client';

import type { AuthenticatedResponse, ConfirmAgenteResult, SesionActual } from './types';

/** GET /api/agentes/confirm — validación previa al login: ¿existe la cédula y está autorizada? */
export function confirmAgente(cedula: string) {
  return apiRequest<ConfirmAgenteResult>('/agentes/confirm', { query: { cedula } });
}

/**
 * GET /api/unidades/confirm — validación previa al login. true solo si la unidad existe, está activa
 * y disponible; false no distingue entre esos casos.
 */
export function confirmUnidad(ficha: string) {
  return apiRequest<boolean>('/unidades/confirm', { query: { ficha } });
}

/** POST /api/authentication/movil/login — agente + unidad, emite un token de audiencia móvil. */
export function loginMovil(cedula: string, ficha: string) {
  return apiRequest<AuthenticatedResponse>('/authentication/movil/login', {
    method: 'POST',
    body: { cedula, ficha },
  });
}

/**
 * GET /api/authentication/sesion — identidad de la sesión actual. La app ya la lee del token
 * (lib/jwt.ts); la usa para confirmar que la API sigue aceptándolo al restaurar la sesión.
 */
export function getSesionActual(token: string) {
  return apiRequest<SesionActual>('/authentication/sesion', { token });
}
