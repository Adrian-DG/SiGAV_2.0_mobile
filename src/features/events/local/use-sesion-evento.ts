import { useSession } from '@/contexts/auth-context';

import type { SesionEvento } from './eventos-local';

/**
 * Agente y unidad de la sesión: dueños de los eventos guardados en el dispositivo.
 * null si la sesión no es de la app móvil (sin agente o sin unidad).
 */
export function useSesionEvento(): SesionEvento | null {
  const { session } = useSession();
  const agenteId = session?.agente.agenteId;
  const unidadId = session?.agente.unidadId;
  return agenteId && unidadId ? { agenteId, unidadId } : null;
}
