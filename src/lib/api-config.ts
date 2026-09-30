import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * A qué API se conecta la app. Se elige al arrancar Metro (o en el perfil de EAS) con
 * EXPO_PUBLIC_API_ENV; ver `npm run start:local | start:tunnel | start:prod` y `.env.example`.
 *  - local:      la API corriendo en esta máquina (puerto HTTP de Presentation).
 *  - dev_tunnel: la API expuesta con un Dev Tunnel de Visual Studio (dispositivos fuera de la red).
 *  - production: la API publicada.
 */
export type ApiEnvironment = 'local' | 'dev_tunnel' | 'production';

export const API_ENVIRONMENTS: readonly ApiEnvironment[] = ['local', 'dev_tunnel', 'production'];

export type ApiConfig = {
  environment: ApiEnvironment;
  /** Siempre termina en /api, sin barra final. */
  baseUrl: string;
  /** Cabeceras extra para todas las peticiones (p. ej. acceso a un túnel privado). */
  headers: Record<string, string>;
};

/** Puerto HTTP de Presentation (launchSettings.json, perfil "http"). */
const LOCAL_API_PORT = 5282;

// Expo solo incrusta en el bundle las variables leídas así, con punto y de forma estática
// (nada de process.env[nombre] ni desestructuración).
const ENV = process.env.EXPO_PUBLIC_API_ENV;
const URL_LOCAL = process.env.EXPO_PUBLIC_API_URL_LOCAL;
const URL_DEV_TUNNEL = process.env.EXPO_PUBLIC_API_URL_DEV_TUNNEL;
const URL_PRODUCTION = process.env.EXPO_PUBLIC_API_URL_PRODUCTION;
const DEV_TUNNEL_TOKEN = process.env.EXPO_PUBLIC_DEV_TUNNEL_TOKEN;

function resolveEnvironment(): ApiEnvironment {
  if (ENV && (API_ENVIRONMENTS as readonly string[]).includes(ENV)) return ENV as ApiEnvironment;
  if (ENV) {
    throw new Error(`EXPO_PUBLIC_API_ENV="${ENV}" no es válido. Use: ${API_ENVIRONMENTS.join(', ')}.`);
  }
  // Sin elegir: en desarrollo la API local; un build de release nunca debe apuntar a una máquina
  return __DEV__ ? 'local' : 'production';
}

/**
 * Acepta la URL con o sin /api (así se puede pegar tal cual la del túnel:
 * https://abc123-7148.use2.devtunnels.ms/).
 */
function normalizeBaseUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, '');
  return /\/api$/i.test(url) ? url : `${url}/api`;
}

/**
 * Máquina donde corre la API en desarrollo:
 *  - web: el mismo navegador (localhost).
 *  - emulador o teléfono: la IP de la PC que sirve el bundle de Metro (hostUri = "192.168.1.20:8081"),
 *    que el dispositivo ya alcanza. `localhost` en un teléfono sería el propio teléfono.
 */
function localHost(): string {
  if (Platform.OS === 'web') return 'localhost';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
}

function resolveConfig(): ApiConfig {
  const environment = resolveEnvironment();

  switch (environment) {
    case 'local':
      return {
        environment,
        baseUrl: normalizeBaseUrl(URL_LOCAL || `http://${localHost()}:${LOCAL_API_PORT}`),
        headers: {},
      };
    case 'dev_tunnel':
      if (!URL_DEV_TUNNEL) {
        throw new Error(
          'Falta EXPO_PUBLIC_API_URL_DEV_TUNNEL en .env.local (URL del Dev Tunnel, ventana "Dev Tunnels" de Visual Studio).',
        );
      }
      return {
        environment,
        baseUrl: normalizeBaseUrl(URL_DEV_TUNNEL),
        // Túnel Privado/Organización: token de "Copy Tunnel Access Token". Uno Público no lo necesita.
        headers: DEV_TUNNEL_TOKEN ? { 'X-Tunnel-Authorization': `tunnel ${DEV_TUNNEL_TOKEN}` } : {},
      };
    case 'production':
      if (!URL_PRODUCTION) throw new Error('Falta EXPO_PUBLIC_API_URL_PRODUCTION (URL de la API publicada).');
      if (!/^https:\/\//i.test(URL_PRODUCTION)) {
        throw new Error('EXPO_PUBLIC_API_URL_PRODUCTION debe usar https://.');
      }
      return { environment, baseUrl: normalizeBaseUrl(URL_PRODUCTION), headers: {} };
  }
}

/** Resuelta una vez al cargar la app: cambiar de ambiente requiere recargarla. */
export const apiConfig: ApiConfig = resolveConfig();

export const API_ENVIRONMENT_LABELS: Record<ApiEnvironment, string> = {
  local: 'Local',
  dev_tunnel: 'Dev Tunnel',
  production: 'Producción',
};
