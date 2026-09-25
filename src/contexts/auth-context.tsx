import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getSesionActual, loginMovil } from '@/features/auth/api';
import { clearSession, persistSession, restoreSession, type Session } from '@/features/auth/session-store';
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
    restoreSession({ storage: secureStorage, fetchSesion: getSesionActual })
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));
  }, []);

  // La API rechazó el token a mitad del turno: se cierra la sesión (el guard de rutas lleva al login)
  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        clearSession(secureStorage).catch(() => {});
        setNotice(SESION_EXPIRADA);
        setSession(null);
      }),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      notice,
      async signIn(cedula: string, ficha: string) {
        const { token } = await loginMovil(cedula, ficha);
        const agente = await getSesionActual(token);
        const nueva = { token, agente };
        await persistSession(secureStorage, nueva);
        setNotice(null);
        setSession(nueva);
      },
      async signOut() {
        await clearSession(secureStorage);
        setNotice(null);
        setSession(null);
      },
    }),
    [session, isLoading, notice],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
