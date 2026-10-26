import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

/**
 * Canal de Android de los avisos del centro de operaciones (eventos asignados y mensajes).
 * Android no deja cambiar el sonido de un canal ya creado: si cambia el tono o cómo suena, el
 * canal necesita un id nuevo (y quitar el anterior en CANALES_ANTERIORES).
 */
const CANAL = 'centro-operaciones-alerta';
const CANALES_ANTERIORES = ['centro-operaciones'];

/** Tono del aviso (assets/sounds, incluido en la app por el plugin de expo-notifications en app.json). */
const TONO = 'alerta_centro.wav';

const VIBRACION = [0, 500, 200, 500, 200, 500];

let preparado: Promise<boolean> | null = null;

// Sin handler, una notificación con la app abierta no se muestra
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Crea el canal (Android 13+ no pide el permiso hasta que exista uno) y pide el permiso una sola
 * vez por arranque. Devuelve si se pueden mostrar notificaciones.
 *
 * El tono se reproduce como alarma: suena aunque el teléfono esté en vibrar o en silencio (con el
 * volumen de alarma), para que el agente no pierda un evento asignado. Con "No molestar" activo
 * solo suena si el agente le dio a la app permiso para omitirlo (bypassDnd).
 */
export function prepararAlertas(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  preparado ??= (async () => {
    try {
      if (Platform.OS === 'android') {
        await Promise.all(CANALES_ANTERIORES.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => {})));
        await Notifications.setNotificationChannelAsync(CANAL, {
          name: 'Centro de operaciones',
          description: 'Eventos asignados a la unidad y mensajes del call center. Suena aunque el teléfono esté en vibrar.',
          importance: Notifications.AndroidImportance.MAX,
          sound: TONO,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.ALARM,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
          bypassDnd: true,
          enableVibrate: true,
          vibrationPattern: VIBRACION,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      const actual = await Notifications.getPermissionsAsync();
      if (actual.granted) return true;
      if (!actual.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  })();
  return preparado;
}

/**
 * Muestra el aviso en la barra del teléfono al momento, con el tono del centro de operaciones.
 * Devuelve false si no hay permiso (entonces al menos vibra).
 */
export async function mostrarAlerta(titulo: string, cuerpo: string, data: Record<string, unknown> = {}): Promise<boolean> {
  if (!(await prepararAlertas())) {
    Vibration.vibrate(VIBRACION);
    return false;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      // sound: iOS (en Android lo pone el canal)
      content: { title: titulo, body: cuerpo, data, sound: TONO },
      // Inmediata; en Android, en el canal del centro de operaciones
      trigger: Platform.OS === 'android' ? { channelId: CANAL } : null,
    });
    return true;
  } catch {
    Vibration.vibrate(VIBRACION);
    return false;
  }
}
