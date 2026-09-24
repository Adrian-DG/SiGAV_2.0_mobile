import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Palette } from '@/constants/colors';

type TextFieldProps = TextInputProps & {
  label: string;
  errorText?: string | null;
  rightAdornment?: React.ReactNode;
};

export function TextField({ label, errorText, rightAdornment, style, ...rest }: TextFieldProps) {
  const hasError = !!errorText;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, hasError && styles.inputRowError]}>
        <TextInput
          placeholderTextColor={Palette.neutral[400]}
          style={[styles.input, style]}
          {...rest}
        />
        {rightAdornment}
      </View>
      {hasError && <Text style={styles.errorText}>{errorText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.neutral[600],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.neutral[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.neutral[200],
    paddingHorizontal: 14,
  },
  inputRowError: {
    borderColor: Palette.danger[500],
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 16,
    color: Palette.neutral[900],
  },
  errorText: {
    fontSize: 12,
    color: Palette.danger[600],
  },
});
