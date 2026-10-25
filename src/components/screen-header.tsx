import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

type ScreenHeaderProps = {
  title: string;
  /** Acción a la izquierda del título (p. ej. volver). */
  left?: ReactNode;
  right?: ReactNode;
};

export function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, !!left && styles.headerConLeft]}>
      {left}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 64,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Palette.primary[500],
  },
  headerConLeft: {
    paddingLeft: 6,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: Palette.white,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: -12,
  },
});
