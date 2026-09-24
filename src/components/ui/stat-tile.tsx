import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

type StatTileProps = {
  label: string;
  value: number | string;
  accentColor?: string;
};

export function StatTile({ label, value, accentColor = Palette.primary[600] }: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.neutral[500],
  },
});
