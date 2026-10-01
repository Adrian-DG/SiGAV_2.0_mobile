import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

/** Etiqueta de solo lectura (no seleccionable) — p. ej. tipos de evento en una tarjeta. Para selección, ver Chip. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: Palette.neutral[100],
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.neutral[700],
  },
});
