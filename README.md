# SiGAV Móvil

App de campo de Asistencia Vial para las unidades (Expo SDK 57 · React Native · Expo Router). Consume la API de SiGAV 2.0 (`Backend/Presentation`).

## Configuración

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` (ignorado por git) con la URL de cada ambiente — ver `src/lib/api-config.ts` para el detalle de cada variable:

   ```
   EXPO_PUBLIC_API_URL_LOCAL=http://<IP-de-la-PC-en-la-LAN>:5282/api
   EXPO_PUBLIC_API_URL_DEV_TUNNEL=https://<id>-7148.use2.devtunnels.ms
   EXPO_PUBLIC_API_URL_PRODUCTION=https://<api publicada>
   ```

   `EXPO_PUBLIC_API_URL_LOCAL` es opcional: sin valor se detecta sola (`localhost` en web, la IP que sirve Metro en emulador/dispositivo). Para un dispositivo físico la API debe escuchar en la red local (no solo en `localhost`), y para la versión web debe permitir CORS desde el origen de Expo.

3. Iniciar eligiendo la API (no usar `npx expo start` ni `npx expo run:android` directos: no definen el ambiente y la app cae en `local`):

   ```bash
   npm run android:tunnel            # Metro → Dev Tunnel y abre la app en el teléfono (USB)
   npm run android:tunnel -- --build # además compila e instala la app (cambios nativos)
   npm run android:local             # lo mismo contra la API de esta PC
   npm run start:tunnel              # solo Metro (start:local | start:prod)
   ```

   Al cambiar de ambiente respecto del último arranque, el script limpia la caché de Metro: Expo incrusta `EXPO_PUBLIC_*` en el bundle y sin limpiarla la app seguiría con la API anterior.

## Comandos

```bash
npm run start:tunnel    # servidor de desarrollo (o start:local / start:prod)
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
