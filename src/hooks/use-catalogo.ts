import { useEffect, useState } from 'react';

type EstadoCatalogo<T> = {
  items: T[];
  cargando: boolean;
  error: string | null;
};

// Los catálogos casi no cambian: se piden una vez por sesión de la app y se reutilizan entre
// formularios. La clave identifica el catálogo y su filtro (p. ej. "municipios:5").
const cache = new Map<string, unknown[]>();

/**
 * Carga un catálogo de la API. Si `clave` es null no se carga nada (p. ej. modelos sin marca
 * elegida). `loader` debe corresponder a `clave`.
 */
export function useCatalogo<T>(clave: string | null, loader: () => Promise<T[]>): EstadoCatalogo<T> {
  const [estado, setEstado] = useState<EstadoCatalogo<T> & { clave: string | null }>(() => ({
    clave,
    items: clave ? ((cache.get(clave) as T[] | undefined) ?? []) : [],
    cargando: !!clave && !cache.has(clave),
    error: null,
  }));

  useEffect(() => {
    if (!clave || cache.has(clave)) return;

    let cancelado = false;
    loader()
      .then((items) => {
        cache.set(clave, items);
        if (!cancelado) setEstado({ clave, items, cargando: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelado)
          setEstado({ clave, items: [], cargando: false, error: error instanceof Error ? error.message : 'No se pudo cargar.' });
      });

    return () => {
      cancelado = true;
    };
    // loader cambia en cada render; la clave es la que identifica qué cargar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  // Cambió la clave (otro filtro): se muestra lo que haya en caché o vacío mientras carga
  if (estado.clave !== clave) {
    const cached = clave ? (cache.get(clave) as T[] | undefined) : [];
    return { items: cached ?? [], cargando: !!clave && !cached, error: null };
  }

  return estado;
}
