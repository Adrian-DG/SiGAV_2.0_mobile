/**
 * Cálculos de la pantalla de estadísticas (sin React, para poder probarlos aislados).
 */
import { CategoriaEventoValue, JerarquiaValue, type CategoriaEvento } from '@/features/events/types';

import { REGION_MACRO_LABELS, type Alcance, type EstadisticasEventos, type Resumen, type Tiempos, type TramoEstadistica } from './types';

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
        ...alcance.zonas.map((z) => z.nombre),
      ];
      return partes.length ? `Regiones y zonas: ${partes.join(', ')}` : 'La denominación no tiene regiones ni zonas asignadas.';
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
  | { tipo: 'zonas'; zonas: EstadisticasEventos['zonas'] }
  | { tipo: 'tramos'; tramos: TramoEstadistica[] }
  | { tipo: 'ninguno' };

/**
 * Hasta dónde se desglosa según el nivel: un supervisor regional ve zonas → tramos → unidades;
 * un encargado de tramo, tramos → unidades (la zona no le aporta); una unidad, solo su resumen.
 */
export function desglosePorNivel(datos: EstadisticasEventos): Desglose {
  if (datos.alcance.jerarquia === JerarquiaValue.Unidad || datos.zonas.length === 0) return { tipo: 'ninguno' };
  if (datos.alcance.jerarquia === JerarquiaValue.Tramo) {
    const tramos = datos.zonas
      .flatMap((r) => r.tramos)
      .sort((a, b) => b.resumen.totalEventos - a.resumen.totalEventos || a.tramo.localeCompare(b.tramo));
    return { tipo: 'tramos', tramos };
  }
  return { tipo: 'zonas', zonas: datos.zonas };
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

/** "12 min", "1 h 05 min"; "—" sin dato. */
export function formatoMinutos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const total = Math.round(valor);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`;
}

export const formatoPorcentaje = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? '—' : `${Math.round(valor)}%`;

export type TonoCumplimiento = 'bueno' | 'regular' | 'malo' | 'sinDato';

/** Bueno desde 90 %, regular desde 75 %, malo debajo. */
export function tonoCumplimiento(valor: number | null | undefined): TonoCumplimiento {
  if (valor === null || valor === undefined) return 'sinDato';
  if (valor >= 90) return 'bueno';
  if (valor >= 75) return 'regular';
  return 'malo';
}

/** Hay algo que mostrar de tiempos (alguna llegada, atención o pendiente evaluado). */
export const hayTiempos = (t: Tiempos | undefined): t is Tiempos =>
  !!t && (t.llegadasMedidas > 0 || t.atencionesMedidas > 0 || t.pendientesVencidos > 0);

/** "Llegada 12 min · 80% en meta" para las filas del desglose; null si no hay llegadas evaluadas. */
export function detalleTiempos(resumen: Resumen): string | null {
  const t = resumen.tiempos;
  if (!t || t.cumplimientoPorcentaje === null) return null;
  const llegada = t.llegadaMedianaMinutos === null ? null : `Llegada ${formatoMinutos(t.llegadaMedianaMinutos)}`;
  return [llegada, `${formatoPorcentaje(t.cumplimientoPorcentaje)} en meta`].filter(Boolean).join(' · ');
}
