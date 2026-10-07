import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Fotos de evidencia (cédula, placa) guardadas en el dispositivo hasta enviar el evento. La cámara
 * deja la foto en caché, que el sistema puede borrar: se copia a documentos, que persiste.
 */
const carpeta = () => new Directory(Paths.document, 'evidencias');

/** Foto pendiente de enviar: dónde está y la clave de idempotencia con que se sube a la API. */
export type FotoEvidencia = { uri: string; requestId: string };

/** Copia la foto recién tomada a la carpeta de evidencias. */
export function guardarFoto(uriTemporal: string): FotoEvidencia {
  const destino = carpeta();
  destino.create({ intermediates: true, idempotent: true });
  const archivo = new File(destino, `${Crypto.randomUUID()}.jpg`);
  new File(uriTemporal).copy(archivo);
  return { uri: archivo.uri, requestId: Crypto.randomUUID() };
}

/** Borra la foto del dispositivo (ya enviada o descartada). Si ya no existe, no hace nada. */
export function borrarFoto(uri: string): void {
  try {
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
  } catch {
    // Una foto que no se pudo borrar solo ocupa espacio; no debe impedir enviar el evento
  }
}

export const fotoExiste = (uri: string) => {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
};
