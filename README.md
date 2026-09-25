# SiGAV Móvil

App de campo de Asistencia Vial para las unidades (Expo SDK 57 · React Native · Expo Router). Consume la API de SiGAV 2.0 (`Backend/Presentation`).

## Configuración

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env.local` y ajustar `EXPO_PUBLIC_API_URL` (incluye `/api`):

   | Dónde corre la app | URL |
   |---|---|
   | Web / iOS simulator en la misma máquina | `http://localhost:5282/api` |
   | Emulador Android | `http://10.0.2.2:5282/api` |
   | Dispositivo físico | `http://<IP-de-la-PC-en-la-LAN>:5282/api` |

   Para un dispositivo físico la API debe escuchar en la red local (no solo en `localhost`), y para la versión web la API debe permitir CORS desde el origen de Expo.

3. Iniciar:

   ```bash
   npx expo start
   ```

## Comandos

```bash
npx expo start          # servidor de desarrollo
npm run lint            # expo lint
npm run typecheck       # tsc --noEmit
npx expo install <pkg>  # agregar dependencias (versiones compatibles con el SDK)
```

Ejecutar lint y typecheck antes de dar una tarea por terminada.

## Estructura

- `src/app/` — pantallas (rutas de Expo Router). `(app)/` requiere sesión; `login.tsx` no.
- `src/features/` — lógica por dominio (`auth`, `events`): llamadas a la API, tipos y componentes.
- `src/lib/` — cliente HTTP (`api-client.ts`), almacenamiento seguro, JWT, SQLite, fecha operativa.
- `src/components/` — componentes de UI reutilizables.

## Comportamiento importante

- **Sesión offline:** el token se guarda en SecureStore junto con la última sesión confirmada. Sin conexión, la app abre con esa sesión mientras el token esté vigente; solo se descarta si venció o la API lo rechaza (401/403).
- **Sesión expirada en uso:** un 401 en cualquier petición autenticada cierra la sesión y el login muestra el motivo.
- **Red:** las peticiones cortan a los 15 s; los fallos de red llegan como `ApiError` con `status = 0`.
- **"Hoy"** es el día operativo de República Dominicana (UTC-4), igual que en la API.
- **Datos de muestra:** la base local se siembra con eventos de ejemplo solo en desarrollo (`__DEV__`), mientras la API no tenga `GET /api/eventos`.
