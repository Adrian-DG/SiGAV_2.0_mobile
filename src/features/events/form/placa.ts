/**
 * Validación de placa según el catálogo de prefijos (cat_prefijos_placa). Misma regla que la API
 * (Application/Features/Catalogos/PrefijosPlaca.cs ReglaPlaca), sin React para poder probarla.
 *
 * - Formato: la placa debe cumplir el patrón de algún prefijo, salvo que el agente la marque como
 *   no estándar (extranjera, temporal, ilegible). Sin catálogo descargado no se valida.
 * - Tipo de vehículo: si no coincide con el prefijo solo se advierte (puede haber placas mal
 *   asignadas que el agente confirma); si aún no se eligió, se sugiere.
 */
import type { PrefijoPlacaItem } from '@/features/catalogos/api';

export type AnalisisPlaca =
  | { estado: 'vacia' }
  /** Sin catálogo de prefijos en el dispositivo: no hay contra qué validar. */
  | { estado: 'sin_catalogo' }
  | { estado: 'no_estandar' }
  | { estado: 'formato_invalido'; ejemplos: string[] }
  | {
      estado: 'valida';
      prefijo: PrefijoPlacaItem;
      /** Tipos que corresponden al prefijo (vacío = cualquiera). */
      tiposSugeridos: number[];
      /** null si aún no se eligió tipo; false = advertencia. */
      tipoCompatible: boolean | null;
    };

/** Misma normalización que formatPlaca / DatosVehiculo.NormalizarPlaca. */
const normalizar = (placa: string) => placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

function cumple(placa: string, patron: string): boolean {
  try {
    return new RegExp(patron).test(placa);
  } catch {
    return false; // patrón mal escrito en el catálogo: no valida nada (igual que la API)
  }
}

/** Prefijo cuyo formato cumple la placa; con prefijos que se solapan (O y OE) gana el más largo. */
export function identificarPrefijo(placa: string, prefijos: PrefijoPlacaItem[]): PrefijoPlacaItem | null {
  const normalizada = normalizar(placa);
  return (
    prefijos
      .filter((p) => normalizada.startsWith(p.prefijo))
      .sort((a, b) => b.prefijo.length - a.prefijo.length)
      .find((p) => cumple(normalizada, p.patron)) ?? null
  );
}

export function analizarPlaca(
  placa: string,
  placaNoEstandar: boolean,
  tipoVehiculoId: number | null,
  prefijos: PrefijoPlacaItem[],
  /** Ids que no se consideran incompatibles con ningún prefijo (p. ej. "Desconocido"). */
  tiposComodin: number[] = [],
): AnalisisPlaca {
  if (!normalizar(placa)) return { estado: 'vacia' };
  if (placaNoEstandar) return { estado: 'no_estandar' };
  if (prefijos.length === 0) return { estado: 'sin_catalogo' };

  const prefijo = identificarPrefijo(placa, prefijos);
  if (!prefijo) {
    // Ejemplos de los prefijos que empiezan igual, o los primeros del catálogo
    const parecidos = prefijos.filter((p) => normalizar(placa).startsWith(p.prefijo) || p.prefijo.startsWith(normalizar(placa)));
    return { estado: 'formato_invalido', ejemplos: (parecidos.length ? parecidos : prefijos).slice(0, 3).map((p) => p.ejemplo) };
  }

  const tiposSugeridos = prefijo.tipoVehiculoIds;
  const tipoCompatible =
    tipoVehiculoId == null
      ? null
      : tiposSugeridos.length === 0 || tiposSugeridos.includes(tipoVehiculoId) || tiposComodin.includes(tipoVehiculoId);
  return { estado: 'valida', prefijo, tiposSugeridos, tipoCompatible };
}

/**
 * Prefijo por las iniciales, sin exigir el formato completo: reconoce la placa mientras se escribe
 * (con "G1" ya se sabe que es un jeep). Con prefijos que se solapan (O y OE) gana el más largo.
 */
export function prefijoPorIniciales(placa: string, prefijos: PrefijoPlacaItem[]): PrefijoPlacaItem | null {
  const normalizada = normalizar(placa);
  if (!normalizada) return null;
  return prefijos.filter((p) => normalizada.startsWith(p.prefijo)).sort((a, b) => b.prefijo.length - a.prefijo.length)[0] ?? null;
}

/** Tipos de vehículo que corresponden a las iniciales de la placa (vacío = cualquiera o no reconocida). */
export const tiposPorPlaca = (placa: string, prefijos: PrefijoPlacaItem[]): number[] =>
  prefijoPorIniciales(placa, prefijos)?.tipoVehiculoIds ?? [];

/** El tipo que se elige solo: cuando las iniciales corresponden a un único tipo (A → Carro, K → Motor). */
export function tipoPorPlaca(placa: string, prefijos: PrefijoPlacaItem[]): number | null {
  const tipos = tiposPorPlaca(placa, prefijos);
  return tipos.length === 1 ? tipos[0] : null;
}

/**
 * Tipo de vehículo tras cambiar la placa. Si el agente no lo eligió a mano (vacío, o el que la placa
 * anterior puso solo), pasa a ser el que corresponde a las nuevas iniciales (o vacío si son varios).
 * Una placa no estándar no elige tipo.
 */
export function tipoTrasCambiarPlaca(
  anterior: { placa: string; placaNoEstandar: boolean; tipoVehiculoId: number | null },
  placa: string,
  placaNoEstandar: boolean,
  prefijos: PrefijoPlacaItem[],
): number | null {
  const autoAnterior = anterior.placaNoEstandar ? null : tipoPorPlaca(anterior.placa, prefijos);
  const elegidoAMano = anterior.tipoVehiculoId != null && anterior.tipoVehiculoId !== autoAnterior;
  if (elegidoAMano) return anterior.tipoVehiculoId;
  return placaNoEstandar ? null : tipoPorPlaca(placa, prefijos);
}

/** Solo el formato bloquea el guardado; el tipo incompatible es una advertencia. */
export const placaBloquea = (analisis: AnalisisPlaca) => analisis.estado === 'formato_invalido';
