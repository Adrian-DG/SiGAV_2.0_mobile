import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert, AppState } from 'react-native';

import { useSession } from '@/contexts/auth-context';
import { apiConfig } from '@/lib/api-config';

import { mostrarAlerta, prepararAlertas } from './alertas';

/** Mirrors Application/Contracts/Notificaciones/INotificadorUnidades.cs NotificacionUnidad. */
export type NotificacionUnidad = {
  tipo: 'general' | 'evento-asignado' | 'evento-anulado';
  titulo: string;
  mensaje: string;
  fechaUtc: string;
  eventoId: number | null;
  agenteId: number | null;
};

export type EstadoConexion = 'conectado' | 'conectando' | 'desconectado';

type NotificacionesContextValue = {
  estado: EstadoConexion;
  /**
   * Cambia con cada aviso de eventos (asignado o anulado) y al reconectarse (pudo perderse alguno):
   * quien muestre los eventos asignados los vuelve a pedir.
   */
  versionEventos: number;
};

const NotificacionesContext = createContext<NotificacionesContextValue>({ estado: 'desconectado', versionEventos: 0 });

export const useNotificaciones = () => use(NotificacionesContext);

/** El hub vive fuera de /api (Presentation/Hubs/NotificacionesHub.cs). */
const URL_HUB = `${apiConfig.baseUrl.replace(/\/api$/i, '')}/hubs/notificaciones`;

/**
 * Conexión SignalR con el centro de operaciones mientras haya sesión y la app esté abierta. Cada
 * aviso se muestra en la barra del teléfono (o en un diálogo si no hay permiso). Con la app en
 * segundo plano el sistema corta la conexión: al volver se reconecta y los eventos asignados se
 * vuelven a consultar, así que no se pierde ninguno aunque el aviso no haya llegado.
 */
export function NotificacionesProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const token = session?.token;
  const [estado, setEstado] = useState<EstadoConexion>('desconectado');
  const [versionEventos, setVersionEventos] = useState(0);

  useEffect(() => {
    if (!token) return;
    void prepararAlertas();

    const hub = new HubConnectionBuilder()
      .withUrl(URL_HUB, { accessTokenFactory: () => token, headers: apiConfig.headers })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.None)
      .build();
    let activa = true;

    hub.on('notificacion', (n: NotificacionUnidad) => {
      if (n.tipo !== 'general') setVersionEventos((v) => v + 1);
      void mostrarAlerta(n.titulo, n.mensaje, { tipo: n.tipo, eventoId: n.eventoId }).then((mostrada) => {
        if (!mostrada) Alert.alert(n.titulo, n.mensaje);
      });
    });
    hub.onreconnecting(() => activa && setEstado('conectando'));
    hub.onreconnected(() => {
      if (!activa) return;
      setEstado('conectado');
      setVersionEventos((v) => v + 1);
    });
    hub.onclose(() => activa && setEstado('desconectado'));

    const conectar = async () => {
      if (!activa || hub.state !== HubConnectionState.Disconnected) return;
      setEstado('conectando');
      try {
        await hub.start();
        if (!activa) return;
        setEstado('conectado');
        setVersionEventos((v) => v + 1);
      } catch {
        // Sin señal o API caída: se reintenta al volver a la app o en el próximo intento
        if (activa) setEstado('desconectado');
      }
    };
    void conectar();

    // Reintento periódico mientras esté desconectada, y al volver a primer plano
    const reintento = setInterval(() => void conectar(), 60_000);
    const suscripcion = AppState.addEventListener('change', (s) => s === 'active' && void conectar());

    return () => {
      activa = false;
      clearInterval(reintento);
      suscripcion.remove();
      void hub.stop();
      setEstado('desconectado');
    };
  }, [token]);

  const value = useMemo(() => ({ estado, versionEventos }), [estado, versionEventos]);
  return <NotificacionesContext value={value}>{children}</NotificacionesContext>;
}
