import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { Palette } from '@/constants/colors';
import { API_ENVIRONMENT_LABELS, apiConfig } from '@/lib/api-config';

/**
 * A qué API está conectada la app (solo fuera de producción), para no probar contra el
 * servidor equivocado sin darse cuenta.
 */
export function ApiEnvironmentBadge({ style }: { style?: StyleProp<TextStyle> }) {
  if (apiConfig.environment === 'production') return null;

  return (
    <Text style={[styles.badge, style]} accessibilityLabel={`Conectado a la API ${API_ENVIRONMENT_LABELS[apiConfig.environment]}`}>
      {API_ENVIRONMENT_LABELS[apiConfig.environment]}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    // warning[900] sobre warning[50]: mismo par con contraste AA que el aviso del login
    color: Palette.warning[900],
    backgroundColor: Palette.warning[50],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
