import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/colors';
import { completarEvento } from '@/features/events/api';
import { TIPO_CIERRE_LABELS, TipoCierreValue, type TipoCierre } from '@/features/events/types';
import { useSession } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api-client';

const OPCIONES = Object.values(TipoCierreValue) as TipoCierre[];

type CompletarEventoSheetProps = {
  visible: boolean;
  eventoId: number;
  onClose: () => void;
  /** Se llama tras completar el evento en la API, para que el listado se recargue. */
  onCompleted: () => void;
};

/** Modal para elegir el tipo de cierre y enviar PATCH /api/eventos/{id}/completar. */
export function CompletarEventoSheet({ visible, eventoId, onClose, onCompleted }: CompletarEventoSheetProps) {
  const { session } = useSession();
  const [tipoCierre, setTipoCierre] = useState<TipoCierre | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isSubmitting) return;
    setTipoCierre(null);
    setError(null);
    onClose();
  };

  async function confirmar() {
    if (!tipoCierre || !session?.token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await completarEvento(session.token, eventoId, { tipoCierre });
      setTipoCierre(null);
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar el evento.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>Completar evento</Text>
            <Pressable accessibilityRole="button" onPress={close} hitSlop={12} disabled={isSubmitting}>
              <Text style={styles.close}>Cerrar</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Seleccione el tipo de cierre:</Text>

          <View style={styles.options}>
            {OPCIONES.map((opcion) => (
              <Pressable
                key={opcion}
                accessibilityRole="radio"
                accessibilityState={{ checked: tipoCierre === opcion }}
                disabled={isSubmitting}
                style={[styles.option, tipoCierre === opcion && styles.optionSelected]}
                onPress={() => setTipoCierre(opcion)}>
                <Text style={[styles.optionText, tipoCierre === opcion && styles.optionTextSelected]}>
                  {TIPO_CIERRE_LABELS[opcion]}
                </Text>
              </Pressable>
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button label="Completar" onPress={confirmar} loading={isSubmitting} disabled={!tipoCierre} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.neutral[900],
  },
  close: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.primary[600],
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.neutral[600],
  },
  options: {
    gap: 8,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.neutral[200],
  },
  optionSelected: {
    backgroundColor: Palette.primary[50],
    borderColor: Palette.primary[400],
  },
  optionText: {
    fontSize: 15,
    color: Palette.neutral[800],
  },
  optionTextSelected: {
    color: Palette.primary[700],
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.danger[600],
  },
});
