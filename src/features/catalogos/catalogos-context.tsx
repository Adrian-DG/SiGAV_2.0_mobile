import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api-client';

import { obtenerEstadoCatalogos } from './local/catalogos-local';
import { sincronizarCatalogos } from './local/sincronizar-catalogos';

type CatalogosContextValue = {
  /** Cambia cada vez que se reemplazan los catálogos guardados: las listas deben volver a leerse. */
  revision: number;
  /** Hay catálogos en el dispositivo. null mientras se consulta al abrir la app. */
  disponibles: boolean | null;
  sincronizando: boolean;
  /** Motivo de la última sincronización fallida (se siguen usando los guardados, si hay). */
  error: string | null;
  /** ISO UTC de la última confirmación con la API. */
  sincronizadoEn: string | null;
  sincronizar: () => Promise<void>;
};

const CatalogosContext = createContext<CatalogosContextValue | null>(null);

/** En un turno largo la app puede quedar abierta horas: al volver a primer plano se confirma la versión. */
const VIGENCIA_MS = 6 * 60 * 60 * 1000;

export function useCatalogos(): CatalogosContextValue {
  const value = useContext(CatalogosContext);
  if (!value) throw new Error('useCatalogos debe usarse dentro de <CatalogosProvider>.');
  return value;
}

/**
 * Mantiene los catálogos del dispositivo al día: sincroniza al iniciar la sesión y, si falló (sin
 * señal o el servidor no respondió), otra vez cuando vuelve la conexión o la app vuelve a primer
 * plano. Mientras tanto la app usa los que ya tiene guardados.
 */
export function CatalogosProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { session } = useSession();
  const token = session?.token ?? null;

  const [revision, setRevision] = useState(0);
  const [disponibles, setDisponibles] = useState<boolean | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sincronizadoEn, setSincronizadoEn] = useState<string | null>(null);

  const enCurso = useRef<Promise<void> | null>(null);
  const pendiente = useRef(true);
  const ultimaConfirmacion = useRef(0);

  const sincronizar = useCallback(async () => {
    if (!token) return;
    // Una sola sincronización a la vez (p. ej. al abrir la app y volver la señal al mismo tiempo)
    if (enCurso.current) return enCurso.current;

    const tarea = (async () => {
      setSincronizando(true);
      try {
        const resultado = await sincronizarCatalogos(db, token);
        const estado = await obtenerEstadoCatalogos(db);
        pendiente.current = false;
        ultimaConfirmacion.current = Date.now();
        setError(null);
        setDisponibles(true);
        setSincronizadoEn(estado?.sincronizadoEn ?? null);
        if (resultado.actualizados) setRevision((r) => r + 1);
      } catch (err) {
        pendiente.current = true;
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'No se pudieron descargar los catálogos.');
      } finally {
        setSincronizando(false);
        enCurso.current = null;
      }
    })();
    enCurso.current = tarea;
    return tarea;
  }, [db, token]);

  // Al iniciar: lo guardado se puede usar de inmediato; luego se confirma con la API
  useEffect(() => {
    let cancelado = false;
    obtenerEstadoCatalogos(db)
      .then((estado) => {
        if (cancelado) return;
        setDisponibles(!!estado);
        setSincronizadoEn(estado?.sincronizadoEn ?? null);
      })
      .catch(() => {
        if (!cancelado) setDisponibles(false);
      })
      .finally(() => {
        if (!cancelado) void sincronizar();
      });
    return () => {
      cancelado = true;
    };
  }, [db, sincronizar]);

  // Volvió la señal y la última sincronización no se pudo hacer: se reintenta
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        if (state.isConnected && pendiente.current && !enCurso.current) void sincronizar();
      }),
    [sincronizar],
  );

  // De vuelta en primer plano: reintenta lo que falló o confirma una versión ya vieja
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      const vencida = Date.now() - ultimaConfirmacion.current > VIGENCIA_MS;
      if (estado === 'active' && (pendiente.current || vencida) && !enCurso.current) void sincronizar();
    });
    return () => suscripcion.remove();
  }, [sincronizar]);

  return (
    <CatalogosContext.Provider value={{ revision, disponibles, sincronizando, error, sincronizadoEn, sincronizar }}>
      {children}
    </CatalogosContext.Provider>
  );
}
