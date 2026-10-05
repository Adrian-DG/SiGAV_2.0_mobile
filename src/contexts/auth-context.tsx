import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getSesionActual, loginMovil } from '@/features/auth/api';
import { clearSession, persistSession, restoreSession, sesionDesdeToken, type Session } from '@/features/auth/session-store';
import { cerrarSesionMovil } from '@/features/posicion/api';
import { detenerSeguimiento, iniciarSeguimiento } from '@/features/posicion/seguimiento';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { secureStorage } from '@/lib/storage';

const SESION_EXPIRADA = 'Su sesión expiró. Inicie sesión nuevamente.';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  /** Motivo por el que se cerró la sesión sin que el agente lo pidiera (se muestra en el login). */
  notice: string | null;
  signIn: (cedula: string, ficha: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useSession must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    restoreSession({ storage: secureStorage, verificarToken: getSesionActual })
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));
  }, []);

  // La API rechazó el token a mitad del turno: se cierra la sesión (el guard de rutas lleva al login)
  useEffect(
    () =>
      setUnauthorizedHandler((mensaje) => {
        clearSession(secureStorage).catch(() => {});
        setNotice(mensaje || SESION_EXPIRADA);
        setSession(null);
      }),
    [],
  );

  // Mientras haya sesión la unidad envía su posición (mapa de unidades del front desk)
  const token = session?.token;
  useEffect(() => {
    if (token) void iniciarSeguimiento(token);
    else void detenerSeguimiento();
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      notice,
      async signIn(cedula: string, ficha: string) {
        const { token } = await loginMovil(cedula, ficha);
        // Agente y unidad vienen en el token: no hace falta otra petición para conocerlos
        const nueva = sesionDesdeToken(token);
        await persistSession(secureStorage, nueva);
        setNotice(null);
        setSession(nueva);
      },
      async signOut() {
        await detenerSeguimiento();
        // Avisa al servidor para que la unidad quede libre de inmediato. Sin conexión se sale
        // igual: la unidad pasa a desconectada sola a los 15 min sin enviar su posición.
        if (session) await cerrarSesionMovil(session.token).catch(() => {});
        await clearSession(secureStorage);
        setNotice(null);
        setSession(null);
      },
    }),
    [session, isLoading, notice],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
