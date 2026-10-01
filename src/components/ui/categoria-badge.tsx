import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';
import { CategoriaEventoValue, type CategoriaEvento } from '@/features/events/types';

const CONFIG: Record<CategoriaEvento, { label: string; bg: string; fg: string }> = {
  [CategoriaEventoValue.Asistencia]: { label: 'Asistencia', bg: Palette.primary[100], fg: Palette.primary[700] },
  [CategoriaEventoValue.Accidente]: { label: 'Accidente', bg: Palette.danger[100], fg: Palette.danger[700] },
};

export function CategoriaBadge({ categoria }: { categoria: CategoriaEvento }) {
  const { label, bg, fg } = CONFIG[categoria];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
