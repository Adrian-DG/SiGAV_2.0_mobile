import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Palette } from '@/constants/colors';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Opción seleccionable (selección múltiple). 44 de alto como mínimo para tocarla en movimiento. */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
      {selected && <Icon name="check" color={Palette.white} size={18} />}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Palette.neutral[300],
    backgroundColor: Palette.white,
  },
  selected: {
    paddingLeft: 12,
    backgroundColor: Palette.primary[500],
    borderColor: Palette.primary[500],
  },
  pressed: { opacity: 0.8 },
  label: { fontSize: 15, fontWeight: '600', color: Palette.neutral[800] },
  labelSelected: { color: Palette.white },
});
