import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/colors';
import { listarTiposCierre } from '@/features/catalogos/local/catalogos-local';
import { useCatalogo } from '@/hooks/use-catalogo';

type CompletarEventoSheetProps = {
  visible: boolean;
  /** Tipo de cierre ya elegido (para cambiarlo antes de enviar). */
  inicial?: number | null;
  onClose: () => void;
  /** Guarda el cierre en el dispositivo. Si lanza un error, se muestra y la hoja sigue abierta. */
  onConfirm: (tipoCierreId: number) => Promise<void>;
};

/**
 * Hoja para elegir el tipo de cierre. El cierre se guarda en el dispositivo: el evento queda
 * "por enviar" y el agente lo envía después. Las opciones salen del catálogo del dispositivo.
 */
export function CompletarEventoSheet({ visible, inicial = null, onClose, onConfirm }: CompletarEventoSheetProps) {
  const [tipoCierre, setTipoCierre] = useState<number | null>(inicial);
  // Solo mientras está abierta (cada tarjeta del listado tiene su hoja)
  const opciones = useCatalogo(visible ? 'tipos-cierre' : null, listarTiposCierre);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isSubmitting) return;
    setTipoCierre(inicial);
    setError(null);
    onClose();
  };

  async function confirmar() {
    if (!tipoCierre) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(tipoCierre);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cierre.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>Cerrar evento</Text>
            <Pressable accessibilityRole="button" onPress={close} hitSlop={12} disabled={isSubmitting}>
              <Text style={styles.close}>Cerrar</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Seleccione el tipo de cierre. Se guarda en el dispositivo y luego podrá enviar el evento.</Text>

          <View style={styles.options}>
            {opciones.cargando && <ActivityIndicator color={Palette.primary[500]} />}
            {!opciones.cargando && opciones.items.length === 0 && (
              <Text style={styles.error}>
                {opciones.error ?? 'Los tipos de cierre aún no se han descargado. Conéctese a internet e intente de nuevo.'}
              </Text>
            )}
            {opciones.items.map((opcion) => (
              <Pressable
                key={opcion.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: tipoCierre === opcion.id }}
                disabled={isSubmitting}
                style={[styles.option, tipoCierre === opcion.id && styles.optionSelected]}
                onPress={() => setTipoCierre(opcion.id)}>
                <Text style={[styles.optionText, tipoCierre === opcion.id && styles.optionTextSelected]}>{opcion.nombre}</Text>
              </Pressable>
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button label="Guardar cierre" onPress={confirmar} loading={isSubmitting} disabled={!tipoCierre} />
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
