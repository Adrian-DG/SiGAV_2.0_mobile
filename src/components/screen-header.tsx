import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

type ScreenHeaderProps = {
  title: string;
  right?: ReactNode;
};

export function ScreenHeader({ title, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Palette.primary[500],
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Palette.white,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
