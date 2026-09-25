import { ApiError, apiRequest } from '@/lib/api-client';

/** De dónde salió el dato: el último evento en que se registró, o el maestro histórico (legacy). */
export type OrigenDato = 'evento' | 'maestro';

/** Mirrors Application/Features/Historico/BuscarHistorico.cs CiudadanoConocidoViewModel. */
export type CiudadanoConocido = {
  identificacion: string;
  nombre: string | null;
  apellido: string | null;
  sexo: number;
  telefono: string | null;
  nacionalidadId: number | null;
  origen: OrigenDato;
  ultimoRegistro: string | null;
};

/** Mirrors VehiculoConocidoViewModel. */
export type VehiculoConocido = {
  placa: string;
  tipoVehiculoId: number | null;
  marcaId: number | null;
  modeloId: number | null;
  colorId: number | null;
  marcaTexto: string | null;
  modeloTexto: string | null;
  colorTexto: string | null;
  origen: OrigenDato;
  ultimoRegistro: string | null;
};

/** 404 = no se conoce: para el formulario no es un error, el agente llena los datos a mano. */
async function nullIfNotFound<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** GET /api/ciudadanos/{identificacion} — cédula o pasaporte, con o sin guiones. */
export function buscarCiudadano(token: string, identificacion: string) {
  return nullIfNotFound(
    apiRequest<CiudadanoConocido>(`/ciudadanos/${encodeURIComponent(identificacion)}`, { token }),
  );
}

/** GET /api/vehiculos/{placa} */
export function buscarVehiculo(token: string, placa: string) {
  return nullIfNotFound(apiRequest<VehiculoConocido>(`/vehiculos/${encodeURIComponent(placa)}`, { token }));
}
