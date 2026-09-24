import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';
import { EstadoEventoValue, type EstadoEvento } from '@/features/events/types';

const CONFIG: Record<EstadoEvento, { label: string; bg: string; fg: string }> = {
  [EstadoEventoValue.Pendiente]: { label: 'Pendiente', bg: Palette.warning[100], fg: Palette.warning[800] },
  [EstadoEventoValue.EnCurso]: { label: 'En curso', bg: Palette.primary[100], fg: Palette.primary[700] },
  [EstadoEventoValue.Completado]: { label: 'Completado', bg: Palette.success[100], fg: Palette.success[700] },
};

export function StatusBadge({ estado }: { estado: EstadoEvento }) {
  const { label, bg, fg } = CONFIG[estado];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
