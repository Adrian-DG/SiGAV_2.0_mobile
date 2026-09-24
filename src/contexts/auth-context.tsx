import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getSesionActual, loginMovil } from '@/features/auth/api';
import type { SesionActual } from '@/features/auth/types';
import { secureStorage } from '@/lib/storage';

const TOKEN_KEY = 'sigav_movil_token';

type Session = {
  token: string;
  agente: SesionActual;
};

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
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

  useEffect(() => {
    async function restore() {
      try {
        const token = await secureStorage.getItem(TOKEN_KEY);
        if (!token) return;

        const agente = await getSesionActual(token);
        setSession({ token, agente });
      } catch {
        // Token vencido, inválido, o sin conexión: se descarta y se vuelve a pedir login.
        await secureStorage.deleteItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    }

    restore();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      async signIn(cedula: string, ficha: string) {
        const { token } = await loginMovil(cedula, ficha);
        const agente = await getSesionActual(token);
        await secureStorage.setItem(TOKEN_KEY, token);
        setSession({ token, agente });
      },
      async signOut() {
        await secureStorage.deleteItem(TOKEN_KEY);
        setSession(null);
      },
    }),
    [session, isLoading],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
