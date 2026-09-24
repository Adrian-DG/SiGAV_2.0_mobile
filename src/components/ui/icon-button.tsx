import { Pressable, StyleSheet, Text } from 'react-native';

import { Palette } from '@/constants/colors';

type IconButtonProps = {
  glyph: string;
  label: string;
  onPress: () => void;
  tint?: string;
};

export function IconButton({ glyph, label, onPress, tint = Palette.white }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={[styles.glyph, { color: tint }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  glyph: {
    fontSize: 18,
  },
});
