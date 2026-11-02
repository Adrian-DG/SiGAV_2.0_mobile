#!/usr/bin/env node
/**
 * Arranca Metro apuntando la app a una API: local, dev_tunnel o production.
 *
 *   npm run start:local | start:tunnel | start:prod      solo Metro (abrir la app a mano)
 *   npm run android:local | android:tunnel                Metro y abre la app nativa en el teléfono (USB);
 *                                                         si no está instalada, la compila e instala antes
 *   npm run android:tunnel -- --build                     fuerza compilar e instalar (cambios nativos)
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
const { spawn, spawnSync } = require('node:child_process');
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
let compilar = resto.includes('--build');
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

/** Paquete Android de la app (app.json → expo.android.package). */
function paqueteAndroid() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'app.json'), 'utf8')).expo.android.package;
  } catch {
    return null;
  }
}

function adb(args) {
  return spawnSync('adb', args, { encoding: 'utf8' });
}

/**
 * ¿Está instalada la app nativa en el teléfono conectado? true/false, o null si no se puede saber
 * (sin adb, sin teléfono o varios conectados): en ese caso no se decide nada por el usuario.
 */
function appInstalada(paquete) {
  const r = adb(['shell', 'pm', 'list', 'packages', paquete]);
  if (r.error || r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).some((linea) => linea.trim() === `package:${paquete}`);
}

/** Puerto de Metro: el de --port/-p si se pasó, si no el de Expo por defecto. */
function puertoMetro() {
  const i = expoArgs.findIndex((a) => a === '--port' || a === '-p');
  return (i >= 0 && Number(expoArgs[i + 1])) || 8081;
}

/** Espera a que Metro responda (máx. ~2 min); false si no arrancó. */
async function esperarMetro(puerto) {
  for (let intento = 0; intento < 120; intento++) {
    try {
      const res = await fetch(`http://localhost:${puerto}/status`);
      if ((await res.text()).includes('packager-status:running')) return true;
    } catch {
      // Todavía no escucha
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

/**
 * Abre la app nativa de SiGAV en el teléfono (USB) contra este Metro. No se usa `expo start
 * --android`: sin el paquete expo-dev-client, Expo CLI abre siempre Expo Go, que no trae los
 * módulos nativos de la app (OCR de ML Kit, ubicación en segundo plano…) y falla al cargar.
 * El build debug busca el bundle en localhost:8081 del teléfono; `adb reverse` lo lleva a esta PC.
 */
async function abrirEnAndroid(paquete, puerto) {
  if (!(await esperarMetro(puerto))) {
    console.error('\n✖ Metro no respondió: no se pudo abrir la app en el teléfono.\n');
    return;
  }
  const reverse = adb(['reverse', 'tcp:8081', `tcp:${puerto}`]);
  if (reverse.error || reverse.status !== 0) {
    console.error('\n✖ No se pudo preparar el teléfono (adb reverse). ¿Está conectado por USB con depuración activa?\n');
    return;
  }
  // -S: cierra la instancia anterior para que cargue el bundle nuevo
  adb(['shell', 'am', 'start', '-S', '-n', `${paquete}/.MainActivity`]);
  console.log(`\n▶ App abierta en el teléfono (${paquete}).\n`);
}

const abrirAndroid = expoArgs.includes('--android');
const startArgs = expoArgs.filter((a) => a !== '--android');
const paquete = abrirAndroid ? paqueteAndroid() : null;

if (abrirAndroid && !paquete) {
  console.error('✖ No se encontró expo.android.package en app.json.');
  process.exit(1);
}

// Sin la app nativa instalada no hay nada que abrir: se compila e instala primero
if (abrirAndroid && !compilar) {
  const instalada = appInstalada(paquete);
  if (instalada === null) {
    console.error('✖ No se encontró un teléfono por adb. Conéctelo por USB con depuración activa (adb devices).');
    process.exit(1);
  }
  if (!instalada) {
    console.log(`  La app (${paquete}) no está instalada en el teléfono: se compila e instala primero.\n`);
    compilar = true;
  }
}

(async () => {
  if (compilar) {
    // Solo compila e instala: Metro se arranca después, con el ambiente y la caché resueltos aquí
    const code = await expo(['run:android', '--no-bundler']);
    if (code !== 0) process.exit(code);
  }
  guardarAmbiente();
  const metro = expo(['start', ...startArgs]);
  if (abrirAndroid) void abrirEnAndroid(paquete, puertoMetro());
  process.exit(await metro);
})();
