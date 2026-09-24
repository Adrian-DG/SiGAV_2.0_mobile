import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { SplashScreenController } from '@/components/splash-screen-controller';
import { AuthProvider, useSession } from '@/contexts/auth-context';
import { migrateDbIfNeeded } from '@/lib/db/migrate';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="sigav.db" onInit={migrateDbIfNeeded}>
      <AuthProvider>
        <SplashScreenController />
        <RootNavigator />
      </AuthProvider>
    </SQLiteProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session } = useSession();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
