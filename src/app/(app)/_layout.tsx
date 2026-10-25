import { Stack } from 'expo-router';

import { ToastProvider } from '@/components/ui/toast';
import { CatalogosProvider } from '@/features/catalogos/catalogos-context';
import { NotificacionesProvider } from '@/features/notificaciones/notificaciones-context';

export default function AppLayout() {
  return (
    <CatalogosProvider>
      <NotificacionesProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </NotificacionesProvider>
    </CatalogosProvider>
  );
}
