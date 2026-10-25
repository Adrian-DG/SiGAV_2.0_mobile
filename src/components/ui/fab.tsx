import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Palette } from '@/constants/colors';

type FabProps = {
  icon: IconName;
  /** Se muestra junto al ícono: un "+" solo no dice qué hace. */
  label: string;
  onPress: () => void;
};

export function Fab({ icon, label, onPress }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
      <Icon name={icon} color={Palette.white} size={26} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    minHeight: 58,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // naranja 700: texto blanco con contraste AA
    backgroundColor: Palette.accent[700],
    shadowColor: Palette.black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 17,
    color: Palette.white,
    fontWeight: '800',
  },
});
