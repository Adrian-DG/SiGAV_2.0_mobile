import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Palette } from '@/constants/colors';

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  tint?: string;
  /** Sobre qué fondo está: cambia el resalte al presionar (en el encabezado azul o en una tarjeta clara). */
  surface?: 'dark' | 'light';
};

/** Botón de ícono de 48×48: el mínimo para tocarlo bien con guantes o en movimiento. */
export function IconButton({ icon, label, onPress, tint = Palette.white, surface = 'dark' }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && (surface === 'dark' ? styles.pressedDark : styles.pressedLight)]}>
      <Icon name={icon} color={tint} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  pressedLight: {
    backgroundColor: Palette.neutral[100],
  },
});
