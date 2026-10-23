import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Palette } from '@/constants/colors';
import type { TipoEventoItem } from '@/features/catalogos/api';

import { toggleTipo } from '../form/evento-form';
import { CategoriaEventoValue } from '../types';

const GRUPOS = [
  { categoria: CategoriaEventoValue.Asistencia, titulo: 'Asistencias' },
  { categoria: CategoriaEventoValue.Accidente, titulo: 'Accidentes' },
];

/** Atajo para no marcar de nuevo los mismos tipos (p. ej. "Igual que el vehículo 1"). */
export type AtajoTipos = { label: string; ids: number[] };

type TiposEventoSelectorProps = {
  /** Catálogo de tipos del dispositivo (lo lee una vez el formulario). */
  tipos: TipoEventoItem[];
  value: number[];
  onChange: (ids: number[]) => void;
  label: string;
  ayuda?: string;
  errorText?: string;
  atajos?: AtajoTipos[];
};

/** Tipos de evento atendidos (selección múltiple), agrupados en asistencias y accidentes. */
export function TiposEventoSelector({ tipos, value, onChange, label, ayuda, errorText, atajos = [] }: TiposEventoSelectorProps) {
  const disponibles = atajos.filter((a) => a.ids.length > 0);

  return (
    <View style={styles.contenedor}>
      <Text style={styles.label}>{label}</Text>
      {!!ayuda && <Text style={styles.ayuda}>{ayuda}</Text>}
      {disponibles.length > 0 && (
        <View style={styles.atajos}>
          {disponibles.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityHint="Agrega esos tipos a la selección"
              onPress={() => onChange([...new Set([...value, ...a.ids])])}
              style={({ pressed }) => [styles.atajo, pressed && styles.pressed]}>
              <Text style={styles.atajoTexto}>⧉ {a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {tipos.length === 0 && <Text style={styles.ayuda}>Sin tipos de evento en el dispositivo.</Text>}
      {GRUPOS.map(({ categoria, titulo }) => {
        const grupo = tipos.filter((t) => t.categoria === categoria);
        if (grupo.length === 0) return null;
        return (
          <View key={categoria} style={styles.grupo}>
            <Text style={styles.grupoTitulo}>{titulo}</Text>
            <View style={styles.chips}>
              {grupo.map((t) => (
                <Chip key={t.id} label={t.nombre} selected={value.includes(t.id)} onPress={() => onChange(toggleTipo(value, t.id))} />
              ))}
            </View>
          </View>
        );
      })}
      {!!errorText && (
        <Text style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      )}
    </View>
  );
}

/** Nombres de los tipos, en el orden del catálogo (para resumir un vehículo o persona). */
export function nombresTipos(tipos: TipoEventoItem[], ids: number[]): string[] {
  return tipos.filter((t) => ids.includes(t.id)).map((t) => t.nombre);
}

const styles = StyleSheet.create({
  contenedor: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: Palette.neutral[900] },
  ayuda: { fontSize: 13, color: Palette.neutral[600] },
  grupo: { gap: 6 },
  grupoTitulo: { fontSize: 12, fontWeight: '700', color: Palette.neutral[600], textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  atajo: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.primary[300],
    backgroundColor: Palette.primary[50],
  },
  atajoTexto: { fontSize: 13, fontWeight: '700', color: Palette.primary[700] },
  pressed: { opacity: 0.8 },
  error: { fontSize: 13, color: Palette.danger[600], fontWeight: '600' },
});
