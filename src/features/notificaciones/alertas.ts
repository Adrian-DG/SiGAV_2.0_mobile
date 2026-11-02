import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

/**
 * Canal de Android de los avisos del centro de operaciones (eventos asignados y mensajes).
 * Android no deja cambiar el sonido de un canal ya creado: si cambia el tono o cómo suena, el
 * canal necesita un id nuevo (y quitar el anterior en CANALES_ANTERIORES).
 */
const CANAL = 'centro-operaciones-alerta-aguda';
const CANALES_ANTERIORES = ['centro-operaciones', 'centro-operaciones-alerta'];

/**
 * Tono del aviso (assets/sounds, incluido en la app por el plugin de expo-notifications en app.json):
 * pitido agudo que alterna 2,9 y 3,5 kHz en tres ráfagas (~3 s), para que se distinga en la calle.
 */
const TONO = 'alerta_aguda.wav';

/** Espera inicial y luego vibra/pausa, en ms: tres pulsos largos, a la par de las ráfagas del tono. */
const VIBRACION = [0, 700, 250, 700, 250, 700];

let reproductor: AudioPlayer | null = null;

/**
 * Reproduce el tono desde la app, sin pasar por la notificación: solo cuando esta no puede sonar
 * (sin permiso). Suena aunque el teléfono esté en silencio.
 */
async function sonarTono(): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    reproductor ??= createAudioPlayer(require('@/assets/sounds/alerta_aguda.wav'));
    await reproductor.seekTo(0);
    reproductor.play();
  } catch {
    // Sin audio queda la vibración
  }
}

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
 * Muestra el aviso en la barra del teléfono al momento, con el tono agudo y vibración.
 * Devuelve false si no hay permiso (entonces el tono lo reproduce la propia app).
 *
 * Los avisos llegan por SignalR, que solo está conectado con la app abierta: la vibración se pide
 * también aquí porque algunas capas de Android (p. ej. MIUI) no vibran con la notificación de la
 * app que está en primer plano.
 */
export async function mostrarAlerta(titulo: string, cuerpo: string, data: Record<string, unknown> = {}): Promise<boolean> {
  if (Platform.OS !== 'web') Vibration.vibrate(VIBRACION);
  if (!(await prepararAlertas())) {
    await sonarTono();
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
    await sonarTono();
    return false;
  }
}
