/**
 * Cálculos de la pantalla de estadísticas (sin React, para poder probarlos aislados).
 */
import { CategoriaEventoValue, JerarquiaValue, type CategoriaEvento } from '@/features/events/types';

import { REGION_MACRO_LABELS, type Alcance, type EstadisticasEventos, type Resumen, type TramoEstadistica } from './types';

export const totalCategoria = (resumen: Resumen, categoria: CategoriaEvento) =>
  resumen.porCategoria.find((c) => c.categoria === categoria)?.total ?? 0;

export const asistenciasYAccidentes = (resumen: Resumen) => ({
  asistencias: totalCategoria(resumen, CategoriaEventoValue.Asistencia),
  accidentes: totalCategoria(resumen, CategoriaEventoValue.Accidente),
});

/** Tipos de una categoría, de mayor a menor (ya vienen ordenados de la API). */
export const tiposDeCategoria = (resumen: Resumen, categoria: CategoriaEvento) =>
  resumen.porTipo.filter((t) => t.categoria === categoria);

/** Qué cubren las estadísticas, en una frase para el encabezado. */
export function describirAlcance(alcance: Alcance): string {
  switch (alcance.jerarquia) {
    case JerarquiaValue.Regional: {
      const partes = [
        ...alcance.regionesMacro.map((m) => `Región ${REGION_MACRO_LABELS[m] ?? m}`),
        ...alcance.regionesAsistencia.map((r) => r.nombre),
      ];
      return partes.length ? `Regiones: ${partes.join(', ')}` : 'La denominación no tiene regiones asignadas.';
    }
    case JerarquiaValue.Tramo:
      return alcance.tramos.length
        ? `Tramos: ${alcance.tramos.map((t) => t.nombre).join(', ')}`
        : 'La denominación no tiene tramos asignados.';
    case JerarquiaValue.Unidad:
      return 'Solo los eventos de esta unidad.';
    default:
      return 'Todas las regiones.';
  }
}

export type Desglose =
  | { tipo: 'regiones'; regiones: EstadisticasEventos['regiones'] }
  | { tipo: 'tramos'; tramos: TramoEstadistica[] }
  | { tipo: 'ninguno' };

/**
 * Hasta dónde se desglosa según el nivel: un supervisor regional ve regiones → tramos → unidades;
 * un encargado de tramo, tramos → unidades (la región no le aporta); una unidad, solo su resumen.
 */
export function desglosePorNivel(datos: EstadisticasEventos): Desglose {
  if (datos.alcance.jerarquia === JerarquiaValue.Unidad || datos.regiones.length === 0) return { tipo: 'ninguno' };
  if (datos.alcance.jerarquia === JerarquiaValue.Tramo) {
    const tramos = datos.regiones
      .flatMap((r) => r.tramos)
      .sort((a, b) => b.resumen.totalEventos - a.resumen.totalEventos || a.tramo.localeCompare(b.tramo));
    return { tipo: 'tramos', tramos };
  }
  return { tipo: 'regiones', regiones: datos.regiones };
}

/** "3 asistencias · 1 accidente" (omite los ceros). */
export function detalleCategorias(resumen: Resumen): string {
  const { asistencias, accidentes } = asistenciasYAccidentes(resumen);
  const partes = [
    asistencias ? `${asistencias} ${asistencias === 1 ? 'asistencia' : 'asistencias'}` : null,
    accidentes ? `${accidentes} ${accidentes === 1 ? 'accidente' : 'accidentes'}` : null,
  ].filter(Boolean);
  return partes.join(' · ') || 'Sin tipo registrado';
}
