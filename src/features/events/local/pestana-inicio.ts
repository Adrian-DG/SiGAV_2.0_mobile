import type { EstatusLocal } from './eventos-local';

/**
 * Pestaña que el inicio debe mostrar al volver a enfocarse, p. ej. "En curso" tras registrar un
 * evento: así el agente ve el que acaba de guardar aunque hubiera dejado abierta otra pestaña.
 * Se consume una sola vez.
 */
let pedida: EstatusLocal | null = null;

export function pedirPestanaInicio(estatus: EstatusLocal) {
  pedida = estatus;
}

export function tomarPestanaInicio(): EstatusLocal | null {
  const valor = pedida;
  pedida = null;
  return valor;
}
