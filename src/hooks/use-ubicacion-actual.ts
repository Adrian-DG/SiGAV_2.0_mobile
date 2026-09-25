import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

import type { Ubicacion } from '@/features/events/form/evento-form';

export type EstadoUbicacion = 'buscando' | 'lista' | 'denegada' | 'error';

/** Una última posición conocida de hace más tiempo no describe dónde está el agente ahora. */
const MAX_EDAD_ULTIMA_POSICION_MS = 2 * 60 * 1000;

const toUbicacion = (location: Location.LocationObject): Ubicacion => ({
  latitud: location.coords.latitude,
  longitud: location.coords.longitude,
  precisionMetros: location.coords.accuracy ?? null,
});

/**
 * Coordenadas del evento, tomadas en segundo plano al abrir el formulario (no dependen del agente).
 * Primero usa la última posición conocida si es reciente (instantánea) y luego la afina con una
 * lectura actual.
 */
export function useUbicacionActual() {
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [estado, setEstado] = useState<EstadoUbicacion>('buscando');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function obtener() {
      try {
        const permiso = await Location.requestForegroundPermissionsAsync();
        if (cancelado) return;
        if (permiso.status !== Location.PermissionStatus.GRANTED) {
          setEstado('denegada');
          return;
        }

        const ultima = await Location.getLastKnownPositionAsync({ maxAge: MAX_EDAD_ULTIMA_POSICION_MS });
        if (cancelado) return;
        if (ultima) {
          setUbicacion(toUbicacion(ultima));
          setEstado('lista');
        }

        const actual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelado) return;
        setUbicacion(toUbicacion(actual));
        setEstado('lista');
      } catch {
        // Sin GPS o sin señal: si ya había una posición reciente se conserva
        if (!cancelado) setEstado((previo) => (previo === 'lista' ? previo : 'error'));
      }
    }

    obtener();
    return () => {
      cancelado = true;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setEstado('buscando');
    setIntento((n) => n + 1);
  }, []);

  return { ubicacion, estado, reintentar };
}
