import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Canal de Android de los avisos del centro de operaciones (eventos asignados y mensajes). */
const CANAL = 'centro-operaciones';

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
 */
export function prepararAlertas(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  preparado ??= (async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CANAL, {
          name: 'Centro de operaciones',
          description: 'Eventos asignados a la unidad y mensajes del call center.',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400],
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

/** Muestra el aviso en la barra del teléfono al momento. Devuelve false si no hay permiso. */
export async function mostrarAlerta(titulo: string, cuerpo: string, data: Record<string, unknown> = {}): Promise<boolean> {
  if (!(await prepararAlertas())) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: cuerpo, data },
      // Inmediata; en Android, en el canal del centro de operaciones
      trigger: Platform.OS === 'android' ? { channelId: CANAL } : null,
    });
    return true;
  } catch {
    return false;
  }
}
