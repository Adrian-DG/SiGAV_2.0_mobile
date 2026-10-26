#!/usr/bin/env node
/**
 * Arranca Metro apuntando la app a una API: local, dev_tunnel o production.
 *
 *   npm run start:local | start:tunnel | start:prod      solo Metro (abrir la app a mano)
 *   npm run android:local | android:tunnel                Metro y abre la app en el teléfono (USB)
 *   npm run android:tunnel -- --build                     además compila e instala la app antes
 *   npm run start:tunnel -- --android                     el resto de argumentos va a `expo start`
 *
 * Define EXPO_PUBLIC_API_ENV en el proceso (tiene prioridad sobre los .env) y verifica que la
 * URL del ambiente esté configurada antes de levantar Metro. Las URLs van en .env.local.
 *
 * Expo incrusta EXPO_PUBLIC_* en el bundle al transformarlo y Metro guarda esa transformación
 * en caché: al cambiar de ambiente respecto del último arranque se limpia la caché (--clear),
 * o la app seguiría apuntando a la API anterior.
 *
 * No usar `npx expo start` ni `npx expo run:android` directamente: no definen el ambiente y en
 * desarrollo la app cae en "local".
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const AMBIENTES = {
  local: { variable: 'EXPO_PUBLIC_API_URL_LOCAL', requerida: false },
  dev_tunnel: { variable: 'EXPO_PUBLIC_API_URL_DEV_TUNNEL', requerida: true },
  production: { variable: 'EXPO_PUBLIC_API_URL_PRODUCTION', requerida: true },
};

/** Último ambiente con que arrancó Metro (para saber cuándo limpiar su caché). */
const ULTIMO_AMBIENTE = path.join(RAIZ, 'node_modules', '.cache', 'sigav-api-env');

const [ambiente, ...resto] = process.argv.slice(2);
const config = AMBIENTES[ambiente];
if (!config) {
  console.error(`Uso: node scripts/start.js <${Object.keys(AMBIENTES).join('|')}> [--build] [argumentos de expo start]`);
  process.exit(1);
}

// --build: compilar e instalar la app nativa antes de arrancar Metro (expo run:android)
const compilar = resto.includes('--build');
const expoArgs = resto.filter((a) => a !== '--build');

/** Lectura mínima de .env/.env.local, solo para validar y mostrar la URL (Expo los carga por su cuenta). */
function leerEnv(archivo) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return {};
  return Object.fromEntries(
    fs.readFileSync(ruta, 'utf8')
      .split(/\r?\n/)
      .map((linea) => linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, clave, valor]) => [clave, valor.replace(/^["']|["']$/g, '')]),
  );
}

function leerUltimoAmbiente() {
  try {
    return fs.readFileSync(ULTIMO_AMBIENTE, 'utf8').trim();
  } catch {
    return null;
  }
}

function guardarAmbiente() {
  try {
    fs.mkdirSync(path.dirname(ULTIMO_AMBIENTE), { recursive: true });
    fs.writeFileSync(ULTIMO_AMBIENTE, ambiente);
  } catch {
    // Sin poder recordarlo, el próximo arranque limpiará la caché por las dudas
  }
}

const env = { ...leerEnv('.env'), ...leerEnv('.env.local'), ...process.env };
const url = env[config.variable];

if (config.requerida && !url) {
  console.error(`\n✖ Falta ${config.variable} para el ambiente "${ambiente}".`);
  console.error('  Agréguela en .env.local (vea el README).\n');
  process.exit(1);
}

console.log(`\n▶ API: ${ambiente} → ${url || '(automática: esta PC, puerto 5282)'}\n`);

const cambioDeAmbiente = leerUltimoAmbiente() !== ambiente;
if (cambioDeAmbiente && !expoArgs.includes('--clear') && !expoArgs.includes('-c')) {
  console.log('  Ambiente distinto al del último arranque: se limpia la caché de Metro.\n');
  expoArgs.push('--clear');
}

// El CLI de Expo del proyecto, ejecutado con este mismo Node: sin shell ni npx (igual en Windows)
const expoCli = require.resolve('expo/bin/cli', { paths: [RAIZ] });
const entorno = { ...process.env, EXPO_PUBLIC_API_ENV: ambiente };

function expo(args) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [expoCli, ...args], { stdio: 'inherit', env: entorno, cwd: RAIZ });
    hijo.on('exit', (code) => resolve(code ?? 0));
  });
}

(async () => {
  if (compilar) {
    // Solo compila e instala: Metro se arranca después, con el ambiente y la caché resueltos aquí
    const code = await expo(['run:android', '--no-bundler']);
    if (code !== 0) process.exit(code);
  }
  guardarAmbiente();
  process.exit(await expo(['start', ...expoArgs]));
})();
