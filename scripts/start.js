#!/usr/bin/env node
/**
 * Arranca Metro apuntando la app a una API: local, dev_tunnel o production.
 *
 *   npm run start:local
 *   npm run start:tunnel
 *   npm run start:prod
 *   npm run start:tunnel -- --android      (el resto de argumentos va a `expo start`)
 *
 * Define EXPO_PUBLIC_API_ENV en el proceso (tiene prioridad sobre los .env) y verifica que la
 * URL del ambiente esté configurada antes de levantar Metro. Las URLs van en .env.local.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const AMBIENTES = {
  local: { variable: 'EXPO_PUBLIC_API_URL_LOCAL', requerida: false },
  dev_tunnel: { variable: 'EXPO_PUBLIC_API_URL_DEV_TUNNEL', requerida: true },
  production: { variable: 'EXPO_PUBLIC_API_URL_PRODUCTION', requerida: true },
};

const [ambiente, ...expoArgs] = process.argv.slice(2);
const config = AMBIENTES[ambiente];
if (!config) {
  console.error(`Uso: node scripts/start.js <${Object.keys(AMBIENTES).join('|')}> [argumentos de expo start]`);
  process.exit(1);
}

/** Lectura mínima de .env/.env.local, solo para validar y mostrar la URL (Expo los carga por su cuenta). */
function leerEnv(archivo) {
  const ruta = path.join(__dirname, '..', archivo);
  if (!fs.existsSync(ruta)) return {};
  return Object.fromEntries(
    fs.readFileSync(ruta, 'utf8')
      .split(/\r?\n/)
      .map((linea) => linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, clave, valor]) => [clave, valor.replace(/^["']|["']$/g, '')]),
  );
}

const env = { ...leerEnv('.env'), ...leerEnv('.env.local'), ...process.env };
const url = env[config.variable];

if (config.requerida && !url) {
  console.error(`\n✖ Falta ${config.variable} para el ambiente "${ambiente}".`);
  console.error('  Agréguela en .env.local (vea .env.example).\n');
  process.exit(1);
}

console.log(`\n▶ API: ${ambiente} → ${url || '(automática: esta PC, puerto 5282)'}\n`);

// El CLI de Expo del proyecto, ejecutado con este mismo Node: sin shell ni npx (igual en Windows)
const expoCli = require.resolve('expo/bin/cli', { paths: [path.join(__dirname, '..')] });
const hijo = spawn(process.execPath, [expoCli, 'start', ...expoArgs], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_API_ENV: ambiente },
});
hijo.on('exit', (code) => process.exit(code ?? 0));
