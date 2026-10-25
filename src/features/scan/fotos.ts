import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Fotos de evidencia (cédula, placa) guardadas en el dispositivo hasta enviar el evento. La cámara
 * deja la foto en caché, que el sistema puede borrar: se copia a documentos, que persiste.
 */
const carpeta = () => new Directory(Paths.document, 'evidencias');

/** Foto pendiente de enviar: dónde está y la clave de idempotencia con que se sube a la API. */
export type FotoEvidencia = { uri: string; requestId: string };

/**
 * Lado mayor y calidad con que se guarda la evidencia: la cámara entrega unos 2300 px (300-450 KB),
 * que tardan varios segundos en subir y en verse en la web. A 1600 px la cédula y la placa siguen
 * siendo legibles y el archivo pesa menos de la mitad.
 */
const LADO_MAXIMO = 1600;
const CALIDAD = 0.7;

/**
 * Copia de la foto reducida a LADO_MAXIMO (sin agrandar las más pequeñas), en la caché. Si no se
 * puede procesar, null: se guarda la original antes que perder la evidencia.
 */
async function reducir(uri: string): Promise<string | null> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    const contexto = ImageManipulator.manipulate(original);
    if (Math.max(original.width, original.height) > LADO_MAXIMO)
      contexto.resize(
        original.width >= original.height ? { width: LADO_MAXIMO, height: null } : { width: null, height: LADO_MAXIMO },
      );
    const reducida = await (await contexto.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD });
    return reducida.uri;
  } catch (e) {
    console.warn('[fotos] no se pudo reducir la foto', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Guarda la foto recién tomada en la carpeta de evidencias, reducida para subirla y verla rápido. */
export async function guardarFoto(uriTemporal: string): Promise<FotoEvidencia> {
  const destino = carpeta();
  destino.create({ intermediates: true, idempotent: true });
  const archivo = new File(destino, `${Crypto.randomUUID()}.jpg`);

  const reducida = await reducir(uriTemporal);
  new File(reducida ?? uriTemporal).copy(archivo);
  if (reducida) borrarFoto(reducida);
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
