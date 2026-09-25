import { Pressable, StyleSheet, Text } from 'react-native';

import { Palette } from '@/constants/colors';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Opción seleccionable (selección múltiple). */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Palette.neutral[300],
    backgroundColor: Palette.white,
  },
  selected: {
    backgroundColor: Palette.primary[500],
    borderColor: Palette.primary[500],
  },
  pressed: { opacity: 0.8 },
  label: { fontSize: 14, fontWeight: '600', color: Palette.neutral[700] },
  labelSelected: { color: Palette.white },
});
