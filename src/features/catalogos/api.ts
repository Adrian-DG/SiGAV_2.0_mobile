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

/** Mirrors GetCatalogosMovil.cs MunicipioItemViewModel. */
export type MunicipioItem = CatalogoItem & { provinciaId: number };

/** Mirrors ModeloItemViewModel. */
export type ModeloItem = CatalogoItem & { marcaId: number; tipoVehiculoId: number };

/** Mirrors PrefijosPlaca.cs PrefijoPlacaItemViewModel. tipoVehiculoIds vacío = cualquier tipo. */
export type PrefijoPlacaItem = {
  id: number;
  prefijo: string;
  nombre: string;
  /** Expresión regular de la placa normalizada (compatible con .NET y JavaScript). */
  patron: string;
  ejemplo: string;
  tipoVehiculoIds: number[];
};

/** Mirrors CatalogosMovilViewModel: todos los catálogos activos que se guardan en el dispositivo. */
export type CatalogosMovil = {
  provincias: CatalogoItem[];
  municipios: MunicipioItem[];
  tiposEvento: TipoEventoItem[];
  tiposCierre: CatalogoItem[];
  nacionalidades: CatalogoItem[];
  colores: CatalogoItem[];
  tiposVehiculo: CatalogoItem[];
  marcas: CatalogoItem[];
  modelos: ModeloItem[];
  prefijosPlaca: PrefijoPlacaItem[];
};

/** Mirrors CatalogosMovilResult: `catalogos` es null si el dispositivo ya tiene esa versión. */
export type CatalogosMovilResult = {
  version: string;
  catalogos: CatalogosMovil | null;
};

/** El paquete completo puede tardar con mala señal: más margen que el resto de peticiones. */
const CATALOGOS_TIMEOUT_MS = 60_000;

export const getCatalogosMovil = (token: string, versionActual: string | null) =>
  apiRequest<CatalogosMovilResult>('/catalogos/movil', {
    token,
    query: { version: versionActual ?? undefined },
    timeoutMs: CATALOGOS_TIMEOUT_MS,
  });
