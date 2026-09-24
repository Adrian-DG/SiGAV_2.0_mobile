/**
 * Mirrors Domain/Enums/EstadoEventoEnum.cs and CategoriaEventoEnum.cs. The API has no
 * JsonStringEnumConverter configured, so these travel over the wire as their raw int values.
 */
export const EstadoEventoValue = {
  Pendiente: 1,
  EnCurso: 2,
  Completado: 3,
} as const;
export type EstadoEvento = (typeof EstadoEventoValue)[keyof typeof EstadoEventoValue];

export const CategoriaEventoValue = {
  Asistencia: 1,
  Accidente: 2,
} as const;
export type CategoriaEvento = (typeof CategoriaEventoValue)[keyof typeof CategoriaEventoValue];

/**
 * Item de listado de eventos (Asistencia en SiGAV 1.0). El endpoint que lo sirve
 * (GET /api/eventos) todavía no existe en la API — ver features/events/api.ts.
 * Forma esperada según el agregado Domain/Entities/Operaciones/Evento.cs.
 */
export type EventoListItem = {
  id: number;
  estado: EstadoEvento;
  tipos: string[];
  ciudadanoPrincipal: string | null;
  vehiculoDescripcion: string | null;
  direccion: string | null;
  fechaHoraReporte: string;
  unidadFicha: string;
};

/** Mirrors Application/Features/Estadisticas/EstadisticasViewModels.cs (subset used by the home screen). */
export type CategoriaTotal = {
  categoria: CategoriaEvento;
  total: number;
};

export type ResumenEventos = {
  totalEventos: number;
  porCategoria: CategoriaTotal[];
};

export type EstadisticasEventosResponse = {
  desde: string;
  hasta: string;
  resumen: ResumenEventos;
};

/** Mirrors Domain/ViewModels/NamedViewModel.cs. */
export type NamedViewModel = {
  id: number;
  nombre: string;
};
