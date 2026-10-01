import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useCatalogos } from '@/features/catalogos/catalogos-context';

type EstadoCatalogo<T> = {
  items: T[];
  cargando: boolean;
  error: string | null;
};

/**
 * Lee un catálogo guardado en el dispositivo (features/catalogos/local/catalogos-local.ts). Si
 * `clave` es null no se lee nada (p. ej. modelos sin marca elegida). `loader` debe corresponder a
 * `clave`. Se vuelve a leer cuando la sincronización trae una versión nueva de los catálogos.
 */
export function useCatalogo<T>(clave: string | null, loader: (db: SQLiteDatabase) => Promise<T[]>): EstadoCatalogo<T> {
  const db = useSQLiteContext();
  const { revision, disponibles, sincronizando } = useCatalogos();
  const id = clave ? `${revision}|${clave}` : null;

  const [estado, setEstado] = useState<EstadoCatalogo<T> & { id: string | null }>({ id: null, items: [], cargando: false, error: null });

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    loader(db)
      .then((items) => {
        if (!cancelado) setEstado({ id, items, cargando: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelado)
          setEstado({ id, items: [], cargando: false, error: error instanceof Error ? error.message : 'No se pudo leer el catálogo.' });
      });
    return () => {
      cancelado = true;
    };
    // loader cambia en cada render; id (catálogo, filtro y versión) es lo que identifica qué leer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id]);

  if (!id) return { items: [], cargando: false, error: null };

  // Aún no se leyó este catálogo/filtro, o la primera descarga sigue en curso
  const leyendo = estado.id !== id;
  const descargando = disponibles !== true && sincronizando;
  if (leyendo) return { items: [], cargando: true, error: null };
  return { items: estado.items, cargando: descargando && estado.items.length === 0, error: estado.error };
}
