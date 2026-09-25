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
  /** Solo en la respuesta de la API (el listado local no la trae). */
  categorias?: CategoriaEvento[];
  ciudadanoPrincipal: string | null;
  vehiculoDescripcion: string | null;
  direccion: string | null;
  fechaHoraReporte: string;
  unidadFicha: string;
  unidadDenominacion?: string;
};

/** Mirrors Application/Common/Models/PagedResult.cs. */
export type PagedResult<T> = {
  items: T[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
};

/** Mirrors Domain/Enums/RolCiudadanoEnum.cs. */
export const RolCiudadanoValue = {
  Conductor: 1,
  Pasajero: 2,
  Peaton: 3,
  Paciente: 4,
  Otro: 5,
} as const;
export type RolCiudadano = (typeof RolCiudadanoValue)[keyof typeof RolCiudadanoValue];

/** Mirrors Domain/Enums/SexoEnum.cs. */
export const SexoValue = {
  NoIndicado: 0,
  Masculino: 1,
  Femenino: 2,
} as const;
export type Sexo = (typeof SexoValue)[keyof typeof SexoValue];

/** Mirrors VehiculoEventoRequest (Application/Features/Operaciones/Eventos/RegistrarEvento.cs). */
export type VehiculoEventoRequest = {
  placa: string | null;
  tipoVehiculoId: number | null;
  marcaId: number | null;
  modeloId: number | null;
  colorId: number | null;
  marcaTexto: string | null;
  modeloTexto: string | null;
  colorTexto: string | null;
};

/** Mirrors CiudadanoEventoRequest. */
export type CiudadanoEventoRequest = {
  rol: RolCiudadano;
  identificacion: string | null;
  nombre: string | null;
  apellido: string | null;
  sexo: Sexo;
  telefono: string | null;
  nacionalidadId: number | null;
  vehiculo: VehiculoEventoRequest | null;
};

/**
 * Mirrors RegistrarEventoCommand. Desde la app, unidad, agente y canal los toma la API de la sesión,
 * y el tramo es el de la denominación de la unidad.
 */
export type RegistrarEventoRequest = {
  requestId: string;
  latitud: number;
  longitud: number;
  municipioId: number;
  tipoEventoIds: number[];
  fechaHoraReporteUtc: string;
  fechaHoraLlegadaUtc: string;
  direccion: string | null;
  comentario: string | null;
  ciudadanos: CiudadanoEventoRequest[];
};

export type RegistrarEventoResult = {
  id: number;
  esDuplicado: boolean;
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
