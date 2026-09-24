import { Pressable, StyleSheet, Text } from 'react-native';

import { Palette } from '@/constants/colors';

type FabProps = {
  glyph: string;
  label: string;
  onPress: () => void;
};

export function Fab({ glyph, label, onPress }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Palette.accent[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  glyph: {
    fontSize: 26,
    color: Palette.white,
    fontWeight: '700',
    lineHeight: 28,
  },
});
