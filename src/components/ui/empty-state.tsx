import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

type EmptyStateProps = {
  glyph: string;
  title: string;
  description?: string;
};

export function EmptyState({ glyph, title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.glyph}>{glyph}</Text>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  glyph: {
    fontSize: 32,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.neutral[700],
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: Palette.neutral[500],
    textAlign: 'center',
    lineHeight: 18,
  },
});
