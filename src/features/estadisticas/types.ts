/**
 * Mirrors Application/Features/Estadisticas/EstadisticasViewModels.cs (GET /api/estadisticas/eventos).
 * El alcance lo decide la API con la denominación vigente de la unidad de la sesión:
 * Regional → sus regiones y zonas, Tramo → sus tramos, Unidad → solo su ficha.
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
  zonas: Asignacion[];
  tramos: Asignacion[];
};

/** totalEventos y porCategoria cuentan eventos distintos; en porTipo un evento con varios tipos cuenta en cada uno. */
export type Resumen = {
  totalEventos: number;
  porCategoria: { categoria: CategoriaEvento; total: number }[];
  porTipo: { tipoEventoId: number; tipoEvento: string; categoria: CategoriaEvento; total: number }[];
  /** Opcional: una API anterior a los tiempos de respuesta no lo envía. */
  tiempos?: Tiempos;
};

/**
 * Tiempos de respuesta en minutos (null: sin eventos medibles). Llegada = reporte → llegada, solo
 * eventos despachados (no los que reporta el agente ya en el lugar); atención = llegada → completado.
 * Cumplimiento = llegadas dentro de la meta / (medidas + pendientes que ya superaron la meta).
 */
export type Tiempos = {
  llegadasMedidas: number;
  llegadaPromedioMinutos: number | null;
  llegadaMedianaMinutos: number | null;
  llegadaP90Minutos: number | null;
  atencionesMedidas: number;
  atencionPromedioMinutos: number | null;
  atencionMedianaMinutos: number | null;
  dentroDeMeta: number;
  fueraDeMeta: number;
  pendientesVencidos: number;
  cumplimientoPorcentaje: number | null;
};

/** Meta de llegada por categoría (minutos desde el reporte). */
export type MetasLlegada = { accidenteMinutos: number; asistenciaMinutos: number };

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

export type ZonaEstadistica = {
  zonaId: number;
  zona: string;
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
  zonas: ZonaEstadistica[];
  metas?: MetasLlegada;
};
