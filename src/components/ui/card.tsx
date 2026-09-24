import { StyleSheet, View, type ViewProps } from 'react-native';

import { Palette } from '@/constants/colors';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.neutral[100],
  },
});
