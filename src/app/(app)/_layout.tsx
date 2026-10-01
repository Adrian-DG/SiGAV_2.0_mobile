import { Stack } from 'expo-router';

import { CatalogosProvider } from '@/features/catalogos/catalogos-context';

export default function AppLayout() {
  return (
    <CatalogosProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CatalogosProvider>
  );
}
