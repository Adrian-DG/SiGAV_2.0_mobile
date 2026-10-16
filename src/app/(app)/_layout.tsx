import { Stack } from 'expo-router';

import { CatalogosProvider } from '@/features/catalogos/catalogos-context';
import { NotificacionesProvider } from '@/features/notificaciones/notificaciones-context';

export default function AppLayout() {
  return (
    <CatalogosProvider>
      <NotificacionesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NotificacionesProvider>
    </CatalogosProvider>
  );
}
