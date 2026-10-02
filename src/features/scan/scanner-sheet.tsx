import { recognizeText } from '@dariyd/react-native-text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/colors';

type Linea = { id: string; texto: string };

type ScannerSheetProps = {
  visible: boolean;
  /** Qué se está buscando, para el título y el mensaje de ayuda ("Cédula", "Placa"). */
  titulo: string;
  onClose: () => void;
  /** El agente eligió una de las líneas reconocidas. */
  onResult: (texto: string) => void;
};

type Estado = 'camara' | 'procesando' | { tag: 'resultados'; lineas: Linea[] } | { tag: 'error'; mensaje: string };

/**
 * Hoja de cámara para extraer texto (OCR on-device, sin costo: Vision en iOS, ML Kit en Android —
 * ver @dariyd/react-native-text-recognition). El agente ve las líneas reconocidas y toca la que
 * corresponde; el campo de destino sigue siendo editable después, el OCR solo precarga el valor.
 */
export function ScannerSheet({ visible, titulo, onClose, onResult }: ScannerSheetProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>('camara');
  const cameraRef = useRef<CameraView>(null);

  function close() {
    setEstado('camara');
    onClose();
  }

  async function capturar() {
    const foto = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (!foto?.uri) return;
    setEstado('procesando');
    try {
      const resultado = await recognizeText(foto.uri, { languages: ['es', 'en'], recognitionLevel: 'line' });
      const lineas = (resultado.pages?.[0]?.elements ?? [])
        .map((el, i) => ({ id: String(i), texto: el.text.trim() }))
        .filter((l) => l.texto.length > 0);
      if (!resultado.success || lineas.length === 0) {
        setEstado({ tag: 'error', mensaje: 'No se reconoció texto. Acerque la cámara e intente de nuevo.' });
        return;
      }
      setEstado({ tag: 'resultados', lineas });
    } catch {
      setEstado({ tag: 'error', mensaje: 'No se pudo procesar la imagen. Intente de nuevo.' });
    }
  }

  function elegir(texto: string) {
    onResult(texto);
    close();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.title}>Escanear {titulo}</Text>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={12}>
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>

        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.ayuda}>Se necesita acceso a la cámara para escanear.</Text>
            <Button label="Permitir cámara" onPress={requestPermission} />
          </View>
        ) : estado === 'camara' ? (
          <>
            <CameraView ref={cameraRef} style={styles.camera} />
            <View style={styles.footer}>
              <Text style={styles.ayuda}>Encuadre el texto y mantenga el teléfono firme.</Text>
              <Button label="Capturar" onPress={capturar} />
            </View>
          </>
        ) : estado === 'procesando' ? (
          <View style={styles.center}>
            <ActivityIndicator color={Palette.primary[500]} size="large" />
            <Text style={styles.ayuda}>Reconociendo texto…</Text>
          </View>
        ) : estado.tag === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.error}>{estado.mensaje}</Text>
            <Button label="Reintentar" onPress={() => setEstado('camara')} />
          </View>
        ) : (
          <View style={styles.resultados}>
            <Text style={styles.ayuda}>Toque la línea correcta:</Text>
            {estado.lineas.map((linea) => (
              <Pressable key={linea.id} style={styles.linea} onPress={() => elegir(linea.texto)}>
                <Text style={styles.lineaTexto}>{linea.texto}</Text>
              </Pressable>
            ))}
            <Button label="Volver a capturar" variant="ghost" onPress={() => setEstado('camara')} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Palette.white },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: Palette.neutral[900] },
  close: { fontSize: 15, fontWeight: '700', color: Palette.primary[600] },
  camera: { flex: 1 },
  footer: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  ayuda: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600], textAlign: 'center' },
  error: { fontSize: 13, fontWeight: '600', color: Palette.danger[600], textAlign: 'center' },
  resultados: { flex: 1, padding: 16, gap: 10 },
  linea: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.neutral[200],
    backgroundColor: Palette.neutral[50],
  },
  lineaTexto: { fontSize: 16, fontWeight: '700', color: Palette.neutral[900] },
});
