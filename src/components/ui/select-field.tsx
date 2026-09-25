import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/colors';

export type SelectOption = { id: number; nombre: string };

type SelectFieldProps = {
  label: string;
  placeholder?: string;
  options: SelectOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  loading?: boolean;
  disabled?: boolean;
  errorText?: string | null;
  /** Texto de una opción extra al final para "no está en la lista" (p. ej. escribir la marca a mano). */
  otherLabel?: string;
  onSelectOther?: () => void;
};

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Selector de catálogo en un modal con búsqueda (sin acentos ni mayúsculas). */
export function SelectField({
  label,
  placeholder = 'Seleccionar',
  options,
  value,
  onChange,
  loading = false,
  disabled = false,
  errorText,
  otherLabel,
  onSelectOther,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const term = normalizar(search.trim());
    return term ? options.filter((o) => normalizar(o.nombre).includes(term)) : options;
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.nombre ?? placeholder}`}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={[styles.field, !!errorText && styles.fieldError, (disabled || loading) && styles.fieldDisabled]}>
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {loading ? 'Cargando…' : (selected?.nombre ?? placeholder)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={close} hitSlop={12}>
              <Text style={styles.close}>Cerrar</Text>
            </Pressable>
          </View>
          <TextInput
            placeholder="Buscar…"
            placeholderTextColor={Palette.neutral[400]}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            style={styles.search}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.id === value }}
                style={[styles.option, item.id === value && styles.optionSelected]}
                onPress={() => {
                  onChange(item.id);
                  close();
                }}>
                <Text style={styles.optionText}>{item.nombre}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Sin resultados.</Text>}
            ListFooterComponent={
              <>
                {value !== null && (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onChange(null);
                      close();
                    }}>
                    <Text style={styles.clearText}>Quitar selección</Text>
                  </Pressable>
                )}
                {otherLabel && onSelectOther && (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onSelectOther();
                      close();
                    }}>
                    <Text style={styles.otherText}>{otherLabel}</Text>
                  </Pressable>
                )}
              </>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
    backgroundColor: Palette.neutral[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.neutral[200],
  },
  fieldError: { borderColor: Palette.danger[500] },
  fieldDisabled: { opacity: 0.6 },
  value: { flex: 1, fontSize: 16, color: Palette.neutral[900] },
  placeholder: { color: Palette.neutral[400] },
  chevron: { fontSize: 16, color: Palette.neutral[500] },
  errorText: { fontSize: 12, color: Palette.danger[600] },
  modal: { flex: 1, backgroundColor: Palette.white },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Palette.neutral[900] },
  close: { fontSize: 15, fontWeight: '700', color: Palette.primary[600] },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    fontSize: 16,
    borderRadius: 12,
    backgroundColor: Palette.neutral[100],
    color: Palette.neutral[900],
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.neutral[200],
  },
  optionSelected: { backgroundColor: Palette.primary[50] },
  optionText: { fontSize: 16, color: Palette.neutral[900] },
  empty: { padding: 16, color: Palette.neutral[500] },
  clearText: { fontSize: 15, color: Palette.danger[600], fontWeight: '600' },
  otherText: { fontSize: 15, color: Palette.primary[600], fontWeight: '700' },
});
