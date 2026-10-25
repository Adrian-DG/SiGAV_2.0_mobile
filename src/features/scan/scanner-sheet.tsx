import { recognizeText } from '@dariyd/react-native-text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/colors';

import { guardarFoto, type FotoEvidencia } from './fotos';

type Linea = { id: string; texto: string };

/** Lo que se pudo leer de la foto: los datos para el formulario y cómo mostrárselos al agente. */
export type Lectura<T> = { datos: T; campos: { etiqueta: string; valor: string }[] };

/**
 * Lo que eligió el agente. La foto siempre se conserva (es la evidencia); `datos` si aceptó lo
 * leído, o `linea` si tocó una línea para usarla como valor del campo principal.
 */
export type ResultadoEscaneo<T> = { foto: FotoEvidencia; datos: T | null; linea: string | null };

type ScannerSheetProps<T> = {
  visible: boolean;
  /** Qué se fotografía, para el título y los mensajes ("cédula", "placa"). */
  titulo: string;
  /** Extrae los datos del texto reconocido (sin campos = no se encontró nada útil). */
  leer: (lineas: string[]) => Lectura<T>;
  onClose: () => void;
  onResult: (resultado: ResultadoEscaneo<T>) => void;
};

type Estado =
  | { tag: 'camara' }
  | { tag: 'procesando'; uri: string }
  | { tag: 'resultados'; uri: string; lineas: Linea[] }
  /** Sin texto reconocido: aún se puede guardar la foto como evidencia. */
  | { tag: 'sin-texto'; uri: string; mensaje: string };

/**
 * Hoja de cámara: toma la foto de la cédula o la placa, reconoce el texto en el dispositivo (OCR sin
 * costo ni conexión: Vision en iOS, ML Kit en Android — @dariyd/react-native-text-recognition) y
 * propone los datos leídos. La foto se guarda como evidencia del evento, se usen o no los datos.
 */
export function ScannerSheet<T>({ visible, titulo, leer, onClose, onResult }: ScannerSheetProps<T>) {
  const [permission, requestPermission] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ tag: 'camara' });
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  // Guardar reduce la foto (unos cientos de ms): un segundo toque no debe guardarla otra vez
  const guardandoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);

  function close() {
    setEstado({ tag: 'camara' });
    setError(null);
    onClose();
  }

  async function capturar() {
    setError(null);
    // 0.6: legible para el OCR y para revisar la evidencia, y muy por debajo del límite de 10 MB de la API
    const foto = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
    if (!foto?.uri) return;
    setEstado({ tag: 'procesando', uri: foto.uri });
    try {
      // Sin idiomas: en Android elige el reconocedor latino (el que sirve para cédulas y placas)
      const resultado = await recognizeText(foto.uri, { recognitionLevel: 'line' });
      // fullText como respaldo: algunas versiones devuelven el texto sin elementos por línea
      const textos = resultado.pages?.flatMap((p) => p.elements.map((el) => el.text)) ?? [];
      const lineas = (textos.length ? textos : (resultado.fullText ?? '').split('\n'))
        .map((texto, i) => ({ id: String(i), texto: texto.trim() }))
        .filter((l) => l.texto.length > 0);
      if (!resultado.success) throw new Error(resultado.errorMessage ?? 'El reconocimiento de texto no respondió.');
      setEstado(
        lineas.length > 0
          ? { tag: 'resultados', uri: foto.uri, lineas }
          : {
              tag: 'sin-texto',
              uri: foto.uri,
              mensaje: `No se reconoció texto en la foto de la ${titulo}. Acérquese, evite reflejos y que la imagen esté nítida.`,
            },
      );
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      console.warn('[ScannerSheet] reconocimiento de texto', detalle);
      setEstado({ tag: 'sin-texto', uri: foto.uri, mensaje: mensajeOcr(detalle) });
    }
  }

  /** Conserva la foto (copia persistente) y devuelve lo elegido. */
  async function terminar(uri: string, datos: T | null, linea: string | null) {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      onResult({ foto: await guardarFoto(uri), datos, linea });
      close();
    } catch {
      setError('No se pudo guardar la foto en el dispositivo. Intente de nuevo.');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  const lectura = estado.tag === 'resultados' ? leer(estado.lineas.map((l) => l.texto)) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.title}>Foto de la {titulo}</Text>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={12}>
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>

        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.ayuda}>Se necesita acceso a la cámara para fotografiar la {titulo}.</Text>
            <Button label="Permitir cámara" onPress={requestPermission} />
          </View>
        ) : estado.tag === 'camara' ? (
          <>
            <CameraView ref={cameraRef} style={styles.camera} />
            <View style={styles.footer}>
              <Text style={styles.ayuda}>Encuadre la {titulo} completa y mantenga el teléfono firme.</Text>
              <Button label="Tomar foto" onPress={capturar} />
            </View>
          </>
        ) : estado.tag === 'procesando' ? (
          <View style={styles.center}>
            <ActivityIndicator color={Palette.primary[500]} size="large" />
            <Text style={styles.ayuda}>Leyendo los datos…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.resultados}>
            <Image source={{ uri: estado.uri }} style={styles.foto} contentFit="contain" accessibilityLabel={`Foto de la ${titulo}`} />
            <Text style={styles.nota}>La foto se guardará como evidencia del evento.</Text>
            {!!error && <Text style={styles.error}>{error}</Text>}

            {estado.tag === 'sin-texto' && <Text style={styles.error}>{estado.mensaje} Puede guardar solo la foto o tomarla de nuevo.</Text>}

            {lectura && lectura.campos.length > 0 && (
              <View style={styles.datos}>
                <Text style={styles.datosTitulo}>Datos leídos — verifíquelos</Text>
                {lectura.campos.map((c) => (
                  <View key={c.etiqueta} style={styles.dato}>
                    <Text style={styles.datoEtiqueta}>{c.etiqueta}</Text>
                    <Text style={styles.datoValor}>{c.valor}</Text>
                  </View>
                ))}
                <Button label="Usar estos datos" loading={guardando} onPress={() => terminar(estado.uri, lectura.datos, null)} />
              </View>
            )}

            {estado.tag === 'resultados' && (
              <>
                <Text style={styles.ayuda}>
                  {lectura?.campos.length ? 'O toque' : 'No se identificaron los datos. Toque'} la línea que corresponde a la {titulo}:
                </Text>
                {estado.lineas.map((linea) => (
                  <Pressable
                    key={linea.id}
                    accessibilityRole="button"
                    disabled={guardando}
                    style={({ pressed }) => [styles.linea, pressed && styles.pressed]}
                    onPress={() => terminar(estado.uri, null, linea.texto)}>
                    <Text style={styles.lineaTexto}>{linea.texto}</Text>
                  </Pressable>
                ))}
              </>
            )}

            <Button label="Guardar solo la foto" variant="secondary" loading={guardando} onPress={() => terminar(estado.uri, null, null)} />
            <Button label="Tomar otra foto" variant="ghost" disabled={guardando} onPress={() => setEstado({ tag: 'camara' })} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/** Motivo de la falla en palabras del agente, con el detalle técnico para reportarlo. */
function mensajeOcr(detalle: string): string {
  if (/linked|Expo Go/i.test(detalle))
    return 'Esta versión de la app no incluye el lector de texto (se necesita el build de desarrollo, no Expo Go).';
  if (/download/i.test(detalle))
    return 'El lector de texto aún se está descargando en el teléfono (requiere Google Play services e internet). Intente en unos minutos.';
  return `No se pudo leer el texto de la foto (${detalle}).`;
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
  nota: { fontSize: 12, fontWeight: '600', color: Palette.neutral[600], textAlign: 'center' },
  error: { fontSize: 13, fontWeight: '600', color: Palette.danger[600], textAlign: 'center' },
  resultados: { padding: 16, gap: 10, paddingBottom: 32 },
  foto: { width: '100%', height: 200, borderRadius: 12, backgroundColor: Palette.neutral[100] },
  datos: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: Palette.primary[50] },
  datosTitulo: { fontSize: 14, fontWeight: '800', color: Palette.primary[700] },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  datoEtiqueta: { fontSize: 13, fontWeight: '600', color: Palette.neutral[600] },
  datoValor: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: Palette.neutral[900], textAlign: 'right' },
  linea: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.neutral[200],
    backgroundColor: Palette.neutral[50],
  },
  pressed: { opacity: 0.8 },
  lineaTexto: { fontSize: 16, fontWeight: '700', color: Palette.neutral[900] },
});
