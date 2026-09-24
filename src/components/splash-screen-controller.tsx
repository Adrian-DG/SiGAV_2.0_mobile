import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { useSession } from '@/contexts/auth-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Keeps the native splash screen up until the persisted session has been restored (or failed to). */
export function SplashScreenController() {
  const { isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  return null;
}
