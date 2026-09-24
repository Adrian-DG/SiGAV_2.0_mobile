import type { SQLiteDatabase } from 'expo-sqlite';

import { SEED_EVENTOS } from './seed-data';

const DATABASE_VERSION = 1;

/**
 * Runs once per install (guarded by PRAGMA user_version), passed as SQLiteProvider's onInit.
 * Creates the local schema and, on a fresh database, seeds sample eventos so the app has
 * something to show while GET /api/eventos doesn't exist yet on the API.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estado INTEGER NOT NULL,
        categoria INTEGER NOT NULL,
        tipos TEXT NOT NULL,
        ciudadano_principal TEXT,
        vehiculo_descripcion TEXT,
        direccion TEXT,
        fecha_hora_reporte TEXT NOT NULL,
        unidad_ficha TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 1
      );
    `);

    await db.withTransactionAsync(async () => {
      for (const evento of SEED_EVENTOS) {
        await db.runAsync(
          `INSERT INTO eventos
            (estado, categoria, tipos, ciudadano_principal, vehiculo_descripcion, direccion, fecha_hora_reporte, unidad_ficha)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          evento.estado,
          evento.categoria,
          JSON.stringify(evento.tipos),
          evento.ciudadanoPrincipal,
          evento.vehiculoDescripcion,
          evento.direccion,
          evento.fechaHoraReporte,
          evento.unidadFicha,
        );
      }
    });

    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
