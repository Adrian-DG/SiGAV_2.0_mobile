import { ApiError, NETWORK_ERROR_STATUS } from '@/lib/api-client';

import { registrarEvento } from '../api';
import type { RegistrarEventoResult } from '../types';
import {
  marcarEnviado,
  obtenerEventoLocal,
  registrarErrorEnvio,
  toRequestDeEnvio,
  type LocalDb,
  type SesionEvento,
} from './eventos-local';

/**
 * Envía a la API un evento cerrado en el dispositivo. Es seguro reintentarlo: el requestId hace
 * que la API devuelva el mismo evento si ya lo había recibido (p. ej. se cortó la señal antes de
 * llegar la respuesta). Si falla, el motivo queda guardado en el evento para mostrarlo en el listado.
 */
export async function enviarEventoLocal(
  db: LocalDb,
  token: string,
  sesion: SesionEvento,
  localId: number,
): Promise<RegistrarEventoResult> {
  const evento = await obtenerEventoLocal(db, localId, sesion);
  if (!evento) throw new Error('El evento no existe en este dispositivo.');
  if (evento.estatus === 'enviado') return { id: evento.serverId!, esDuplicado: true };

  const request = toRequestDeEnvio(evento);

  try {
    const resultado = await registrarEvento(token, request);
    await marcarEnviado(db, localId, resultado.id);
    return resultado;
  } catch (error) {
    await registrarErrorEnvio(db, localId, describirError(error));
    throw error;
  }
}

/** Mensaje para el agente: sin red se reintenta luego; un rechazo de la API dice qué corregir. */
export function describirError(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'No se pudo enviar el evento.';
  if (error.status === NETWORK_ERROR_STATUS) return `${error.message} El evento sigue guardado en el dispositivo.`;
  return [error.message, ...Object.values(error.errors ?? {}).flat()].join('\n');
}
