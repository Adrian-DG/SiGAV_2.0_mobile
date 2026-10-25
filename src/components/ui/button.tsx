import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Palette } from '@/constants/colors';

/**
 * - primary: la acción principal de la pantalla (una sola a la vista).
 * - secondary: agregar o una acción alternativa importante (naranja institucional).
 * - outline: acción alternativa junto a la principal, sin competir con ella.
 * - ghost: acciones menores (cancelar, cambiar, reintentar).
 * - danger: quitar o borrar.
 */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: IconName;
};

export function Button({ label, variant = 'primary', loading = false, icon, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor = TEXT_COLOR[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        state.pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {!!icon && <Icon name={icon} color={textColor} size={20} />}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// Fondos con texto blanco de contraste AA (≥ 4.5:1): naranja 700 en vez de 500 (2.8:1 al sol no se lee)
const TEXT_COLOR: Record<Variant, string> = {
  primary: Palette.white,
  secondary: Palette.white,
  outline: Palette.primary[600],
  ghost: Palette.primary[600],
  danger: Palette.white,
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Palette.primary[500],
  },
  secondary: {
    backgroundColor: Palette.accent[700],
  },
  outline: {
    backgroundColor: Palette.white,
    borderWidth: 1.5,
    borderColor: Palette.primary[500],
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Palette.danger[600],
  },
});
