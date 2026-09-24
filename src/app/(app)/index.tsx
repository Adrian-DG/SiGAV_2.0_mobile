import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';

export default function HomeScreen() {
  const { session, signOut } = useSession();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Sesión activa</Text>
        <Text style={styles.name}>{session?.agente.nombre ?? 'Agente'}</Text>
        <Text style={styles.detail}>Unidad · {session?.agente.ficha ?? '—'}</Text>
      </View>

      <Button label="Cerrar sesión" variant="ghost" onPress={() => signOut()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.white,
    padding: 20,
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: Palette.primary[50],
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.primary[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Palette.neutral[900],
  },
  detail: {
    fontSize: 14,
    color: Palette.neutral[600],
  },
});
