/** Mirrors Application/Features/Operaciones/Agentes/AgenteViewModels.cs ConfirmAgenteViewModel. */
export type ConfirmAgenteResult = {
  created: boolean; // an agente record exists for this cédula
  isAuthorized: boolean; // active + authorized by front desk
};

/** Mirrors Application/Features/Authentication/LoginUser.cs AuthenticatedResponse. */
export type AuthenticatedResponse = {
  token: string;
  expiration: string;
};

/** Mirrors Application/Features/Authentication/GetSesionActual.cs SesionViewModel. */
export type SesionActual = {
  tipoSesion: string;
  nombre: string | null;
  userId: number | null;
  permisos: string[];
  agenteId: number | null;
  unidadId: number | null;
  ficha: string | null;
};
