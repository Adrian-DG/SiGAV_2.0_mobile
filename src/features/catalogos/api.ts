import { apiRequest } from '@/lib/api-client';

import type { CategoriaEvento } from '@/features/events/types';

/** Mirrors Application/Features/Catalogos/GetCatalogos.cs CatalogoItemViewModel. */
export type CatalogoItem = {
  id: number;
  nombre: string;
};

/** Mirrors TipoEventoItemViewModel. */
export type TipoEventoItem = CatalogoItem & {
  categoria: CategoriaEvento;
};

export const getTiposEvento = (token: string) => apiRequest<TipoEventoItem[]>('/catalogos/tipos-evento', { token });
export const getProvincias = (token: string) => apiRequest<CatalogoItem[]>('/catalogos/provincias', { token });
export const getMunicipios = (token: string, provinciaId: number) =>
  apiRequest<CatalogoItem[]>(`/catalogos/provincias/${provinciaId}/municipios`, { token });
export const getTiposVehiculo = (token: string) => apiRequest<CatalogoItem[]>('/catalogos/tipos-vehiculo', { token });
export const getMarcas = (token: string) => apiRequest<CatalogoItem[]>('/catalogos/marcas', { token });
export const getModelos = (token: string, marcaId: number, tipoVehiculoId?: number | null) =>
  apiRequest<CatalogoItem[]>(`/catalogos/marcas/${marcaId}/modelos`, {
    token,
    query: { tipoVehiculoId: tipoVehiculoId ?? undefined },
  });
export const getColores = (token: string) => apiRequest<CatalogoItem[]>('/catalogos/colores', { token });
export const getNacionalidades = (token: string) => apiRequest<CatalogoItem[]>('/catalogos/nacionalidades', { token });
