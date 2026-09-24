import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Palette } from '@/constants/colors';

export default function NewEventScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader
        title="Registrar evento"
        right={<IconButton glyph="✕" label="Cerrar" onPress={() => router.back()} />}
      />

      <View style={styles.body}>
        <EmptyState
          glyph="◌"
          title="Formulario en construcción"
          description="El registro de eventos de asistencia vial (datos del ciudadano, vehículo, fotos y firmas) es la siguiente pieza a implementar."
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Palette.neutral[50],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
});
