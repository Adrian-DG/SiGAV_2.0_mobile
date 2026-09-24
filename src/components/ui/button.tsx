import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Palette } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({ label, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;

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
        <ActivityIndicator color={variant === 'ghost' ? Palette.primary[500] : Palette.white} />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

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
    backgroundColor: Palette.accent[500],
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: Palette.white },
  secondary: { color: Palette.white },
  ghost: { color: Palette.primary[500] },
});
