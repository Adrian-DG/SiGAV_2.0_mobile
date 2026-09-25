/**
 * "Un día" para la operación es un día en hora de República Dominicana (UTC-4, sin horario de
 * verano), igual que en la API (Application/Common/ZonaHorariaOperativa.cs). No depende de la
 * zona horaria configurada en el dispositivo.
 *
 * Se usa un desfase fijo en lugar de Intl con timeZone: RD no cambia de hora y así no se depende
 * del soporte de zonas horarias del motor JS en Android.
 */
const OFFSET_RD_MS = -4 * 60 * 60 * 1000;

/** Fecha operativa (YYYY-MM-DD) del instante indicado. */
export function diaOperativo(instante: Date = new Date()): string {
  return new Date(instante.getTime() + OFFSET_RD_MS).toISOString().slice(0, 10);
}

/**
 * Rango semiabierto [desde, hasta) en ISO UTC que cubre el día operativo indicado, para filtrar
 * fechas guardadas con toISOString().
 */
export function rangoDiaOperativoUtc(dia: string): { desdeUtc: string; hastaUtc: string } {
  const inicio = Date.parse(`${dia}T00:00:00.000Z`) - OFFSET_RD_MS;
  return {
    desdeUtc: new Date(inicio).toISOString(),
    hastaUtc: new Date(inicio + 24 * 60 * 60 * 1000).toISOString(),
  };
}
