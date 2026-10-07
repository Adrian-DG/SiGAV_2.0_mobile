import { borrarFoto, fotoExiste, type FotoEvidencia } from '@/features/scan/fotos';
import { ApiError, NETWORK_ERROR_STATUS } from '@/lib/api-client';

import { registrarEvento, subirEvidencia } from '../api';
import { TipoEvidenciaValue, type RegistrarEventoResult, type TipoEvidencia } from '../types';
import {
  marcarEnviado,
  obtenerEventoLocal,
  registrarErrorEnvio,
  toRequestDeEnvio,
  type EventoLocal,
  type LocalDb,
  type SesionEvento,
} from './eventos-local';

type FotoPorSubir = { foto: FotoEvidencia; tipo: TipoEvidencia; ciudadanoId?: number; vehiculoId?: number };

/**
 * Envía a la API un evento cerrado en el dispositivo y luego sus fotos (placa, cédula) como
 * evidencias. Es seguro reintentarlo: el requestId hace que la API devuelva el mismo evento si ya lo
 * había recibido (p. ej. se cortó la señal antes de llegar la respuesta) y cada foto tiene el suyo,
 * así que no se duplican. El evento queda "enviado" solo cuando subieron todas sus fotos; si algo
 * falla, el motivo queda guardado en el evento para mostrarlo en el listado.
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
    const fotos = fotosPorSubir(evento, resultado);
    await subirFotos(token, resultado.id, fotos);
    await marcarEnviado(db, localId, resultado.id);
    // Ya están en la API: se liberan del teléfono
    fotos.forEach((f) => borrarFoto(f.foto.uri));
    return resultado;
  } catch (error) {
    await registrarErrorEnvio(db, localId, describirError(error));
    throw error;
  }
}

/**
 * Fotos del evento con la persona o el vehículo al que pertenecen en la API (mismo orden que el
 * request). Con una API que no devuelve esos Ids, la foto se sube igual, asociada solo al evento.
 * Una foto que ya no está en el teléfono (borrada por el sistema) no se puede enviar y se omite.
 */
function fotosPorSubir(evento: EventoLocal, resultado: RegistrarEventoResult): FotoPorSubir[] {
  const fotos: FotoPorSubir[] = [];
  evento.form.vehiculos.forEach((v, i) => {
    if (v.fotoPlaca && fotoExiste(v.fotoPlaca.uri))
      fotos.push({ foto: v.fotoPlaca, tipo: TipoEvidenciaValue.FotoPlaca, vehiculoId: resultado.vehiculoIds?.[i] });
  });
  evento.form.involucrados.forEach((c, i) => {
    if (c.fotoIdentificacion && fotoExiste(c.fotoIdentificacion.uri))
      fotos.push({ foto: c.fotoIdentificacion, tipo: TipoEvidenciaValue.FotoCedula, ciudadanoId: resultado.ciudadanoIds?.[i] });
  });
  return fotos;
}

/** Una por una (con mala señal, varias a la vez compiten por el ancho de banda). */
async function subirFotos(token: string, eventoId: number, fotos: FotoPorSubir[]) {
  for (const [i, f] of fotos.entries()) {
    try {
      await subirEvidencia(token, eventoId, {
        tipo: f.tipo,
        uri: f.foto.uri,
        requestId: f.foto.requestId,
        ciudadanoId: f.ciudadanoId,
        vehiculoId: f.vehiculoId,
      });
    } catch (error) {
      const faltan = fotos.length - i;
      const detalle = error instanceof Error ? ` (${error.message})` : '';
      throw new Error(
        `El evento se registró, pero ${faltan === 1 ? 'falta 1 foto' : `faltan ${faltan} fotos`} por enviar${detalle}. Vuelva a enviarlo para completarlo.`,
        { cause: error },
      );
    }
  }
}

/** Mensaje para el agente: sin red se reintenta luego; un rechazo de la API dice qué corregir. */
export function describirError(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'No se pudo enviar el evento.';
  if (error.status === NETWORK_ERROR_STATUS) return `${error.message} El evento sigue guardado en el dispositivo.`;
  return [error.message, ...Object.values(error.errors ?? {}).flat()].join('\n');
}
