/**
 * Mirrors Application/Features/Estadisticas/EstadisticasViewModels.cs (GET /api/estadisticas/eventos).
 * El alcance lo decide la API con la denominación vigente de la unidad de la sesión:
 * Regional → sus regiones, Tramo → sus tramos, Unidad → solo su ficha.
 */
import type { CategoriaEvento, Jerarquia } from '@/features/events/types';

/** Mirrors Domain/Enums/RegionMacroEnum.cs. */
export const RegionMacroValue = { Este: 1, Norte: 2, Sur: 3 } as const;
export type RegionMacro = (typeof RegionMacroValue)[keyof typeof RegionMacroValue];

export const REGION_MACRO_LABELS: Record<RegionMacro, string> = {
  [RegionMacroValue.Este]: 'Este',
  [RegionMacroValue.Norte]: 'Norte',
  [RegionMacroValue.Sur]: 'Sur',
};

export type Asignacion = { id: number; nombre: string };

/** jerarquia null = sin restricción (solo front desk). */
export type Alcance = {
  jerarquia: Jerarquia | null;
  denominacionId: number | null;
  denominacion: string | null;
  regionesMacro: RegionMacro[];
  regionesAsistencia: Asignacion[];
  tramos: Asignacion[];
};

/** totalEventos y porCategoria cuentan eventos distintos; en porTipo un evento con varios tipos cuenta en cada uno. */
export type Resumen = {
  totalEventos: number;
  porCategoria: { categoria: CategoriaEvento; total: number }[];
  porTipo: { tipoEventoId: number; tipoEvento: string; categoria: CategoriaEvento; total: number }[];
};

export type UnidadEstadistica = {
  unidadId: number;
  ficha: string;
  denominacionId: number;
  denominacion: string;
  resumen: Resumen;
};

export type TramoEstadistica = {
  tramoId: number;
  tramo: string;
  resumen: Resumen;
  unidades: UnidadEstadistica[];
};

export type RegionEstadistica = {
  regionAsistenciaId: number;
  region: string;
  regionMacro: RegionMacro;
  resumen: Resumen;
  tramos: TramoEstadistica[];
};

export type EstadisticasEventos = {
  alcance: Alcance;
  /** YYYY-MM-DD (día operativo). */
  desde: string;
  hasta: string;
  resumen: Resumen;
  regiones: RegionEstadistica[];
};
