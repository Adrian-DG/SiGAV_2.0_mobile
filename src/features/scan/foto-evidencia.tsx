import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/colors';

import type { FotoEvidencia } from './fotos';

type FotoEvidenciaFilaProps = {
  /** "Foto de la cédula", "Foto de la placa". */
  etiqueta: string;
  foto: FotoEvidencia | null;
  onTomar: () => void;
  onQuitar: () => void;
};

/** La foto de evidencia de una persona o vehículo (miniatura, tomar otra o quitarla). Sin foto, nada. */
export function FotoEvidenciaFila({ etiqueta, foto, onTomar, onQuitar }: FotoEvidenciaFilaProps) {
  if (!foto) return null;

  return (
    <View style={styles.fila}>
      <Image source={{ uri: foto.uri }} style={styles.miniatura} contentFit="cover" accessibilityLabel={etiqueta} />
      <View style={styles.texto}>
        <Text style={styles.etiqueta}>{etiqueta}</Text>
        <Text style={styles.nota}>Se enviará como evidencia del evento.</Text>
      </View>
      <View style={styles.acciones}>
        <Button label="Otra" variant="ghost" onPress={onTomar} />
        <Button label="Quitar" variant="ghost" onPress={onQuitar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.neutral[200],
    backgroundColor: Palette.neutral[50],
  },
  miniatura: { width: 64, height: 44, borderRadius: 8, backgroundColor: Palette.neutral[200] },
  texto: { flex: 1, gap: 2 },
  etiqueta: { fontSize: 14, fontWeight: '700', color: Palette.neutral[900] },
  nota: { fontSize: 12, color: Palette.neutral[600] },
  acciones: { flexDirection: 'row' },
});
