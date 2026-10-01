import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

/**
 * Runs once per install (guarded by PRAGMA user_version), passed as SQLiteProvider's onInit.
 *
 * Esquema de la cola offline de eventos: el agente registra el evento en el lugar y, si no hay
 * conexión, queda aquí hasta poder enviarse a POST /api/eventos. Las tablas reflejan el agregado
 * Evento del backend (Domain/Entities/Operaciones/Evento.cs, EventoCiudadanoInfo) y el contrato
 * RegistrarEventoRequest (features/events/types.ts) que se envía al sincronizar:
 *
 * - eventos: cabecera del agregado. Unidad, agente, tramo y canal NO se guardan aquí — la API los
 *   toma de la sesión del agente al sincronizar (ver comentario de RegistrarEventoCommand).
 * - evento_tipos: espejo de la tabla puente evento_tipo_evento (EventoTipoEventoConfiguration).
 * - evento_ciudadanos: espejo de evento_ciudadano, con los value objects DatosPersona y
 *   DatosVehiculo aplanados en columnas de la misma tabla (igual que hace EF Core con OwnsOne
 *   en EventoCiudadanoConfiguration).
 *
 * No se modela evento_evidencias: el formulario de campo todavía no captura fotos ni firmas.
 *
 * Desde la v4 los catálogos (cat_*) también viven aquí: se descargan de GET /api/catalogos/movil
 * (features/catalogos/local/catalogos-local.ts) y el formulario se llena sin conexión.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  await db.execAsync('PRAGMA journal_mode = WAL');

  if (currentVersion < 2) {
    // v2 reemplaza la tabla plana de demo de la v1 (solo tuvo datos de muestra, nunca datos
    // reales) por el esquema normalizado de la cola offline.
    await db.execAsync('DROP TABLE IF EXISTS eventos');
    await db.execAsync(`
      CREATE TABLE eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        -- Clave de idempotencia (Evento.RequestId): evita duplicados si un envío se reintenta.
        request_id TEXT NOT NULL UNIQUE,
        -- Id que asigna la API una vez sincronizado; NULL mientras está pendiente.
        server_id INTEGER,
        -- EstadoEventoEnum: 1 Pendiente, 2 En curso, 3 Completado.
        estado INTEGER NOT NULL,
        latitud REAL NOT NULL,
        longitud REAL NOT NULL,
        municipio_id INTEGER NOT NULL,
        direccion TEXT,
        comentario TEXT,
        fecha_hora_reporte_utc TEXT NOT NULL,
        fecha_hora_llegada_utc TEXT,
        fecha_hora_completado_utc TEXT,
        -- Tipo de cierre (cat_tipos_cierre desde la v4); solo si el evento se envía ya completado.
        tipo_cierre INTEGER,
        -- Cola de sincronización: 0 pendiente de enviar, 1 ya confirmado por la API.
        synced INTEGER NOT NULL DEFAULT 0,
        sync_error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- Tipos de evento seleccionados (Evento.Tipos, many-to-many con tipos_evento).
      CREATE TABLE evento_tipos (
        evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
        tipo_evento_id INTEGER NOT NULL,
        PRIMARY KEY (evento_id, tipo_evento_id)
      );

      -- Personas involucradas (EventoCiudadanoInfo), con su vehículo aplanado en la misma fila
      -- (RolCiudadanoEnum en rol, SexoEnum en sexo; placa/tipo/marca/modelo/color solo si
      -- conVehiculo). *_texto se usa cuando el dato no está en el catálogo (DatosVehiculo).
      CREATE TABLE evento_ciudadanos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
        rol INTEGER NOT NULL,
        identificacion TEXT,
        nombre TEXT,
        apellido TEXT,
        sexo INTEGER NOT NULL DEFAULT 0,
        telefono TEXT,
        nacionalidad_id INTEGER,
        placa TEXT,
        tipo_vehiculo_id INTEGER,
        marca_id INTEGER,
        marca_texto TEXT,
        modelo_id INTEGER,
        modelo_texto TEXT,
        color_id INTEGER,
        color_texto TEXT
      );

      CREATE INDEX idx_evento_ciudadanos_evento_id ON evento_ciudadanos(evento_id);
      CREATE INDEX idx_eventos_synced ON eventos(synced);
    `);
  }

  if (currentVersion < 3) {
    // v3: el dispositivo es la fuente del listado y de la edición hasta que el agente envía.
    //  - agente_id / unidad_id: de quién es el evento (el teléfono puede compartirse entre turnos)
    //    y con qué sesión debe enviarse (la API toma unidad y agente del token).
    //  - provincia_id: el formulario la necesita para volver a editar el municipio.
    //  - updated_at: última edición local.
    //  - evento_tipos.nombre/categoria: foto del catálogo para mostrar el listado sin conexión.
    await db.execAsync(`
      ALTER TABLE eventos ADD COLUMN agente_id INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE eventos ADD COLUMN unidad_id INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE eventos ADD COLUMN provincia_id INTEGER;
      ALTER TABLE eventos ADD COLUMN updated_at TEXT;
      ALTER TABLE evento_tipos ADD COLUMN nombre TEXT;
      ALTER TABLE evento_tipos ADD COLUMN categoria INTEGER;

      CREATE INDEX idx_eventos_sesion ON eventos(agente_id, unidad_id, synced, estado);
    `);
  }

  if (currentVersion < 4) {
    // v4: catálogos en el dispositivo, copia de los activos en la API. Se reemplazan completos en
    // cada descarga (no se editan aquí), por eso no llevan IsActive ni auditoría.
    //  - tipo_cierre pasa a ser un Id del catálogo cat_tipos_cierre (antes el enum
    //    TipoCierreEventoEnum; el catálogo conserva los mismos Ids 1 a 7).
    await db.execAsync(`
      ALTER TABLE eventos RENAME COLUMN tipo_cierre TO tipo_cierre_id;

      CREATE TABLE cat_provincias (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
      CREATE TABLE cat_municipios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, provincia_id INTEGER NOT NULL);
      -- categoria: CategoriaEventoEnum (1 Asistencia, 2 Accidente).
      CREATE TABLE cat_tipos_evento (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, categoria INTEGER NOT NULL);
      CREATE TABLE cat_tipos_cierre (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
      CREATE TABLE cat_nacionalidades (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
      CREATE TABLE cat_colores (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
      CREATE TABLE cat_tipos_vehiculo (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
      CREATE TABLE cat_marcas (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
      CREATE TABLE cat_modelos (
        id INTEGER PRIMARY KEY,
        nombre TEXT NOT NULL,
        marca_id INTEGER NOT NULL,
        tipo_vehiculo_id INTEGER NOT NULL
      );

      CREATE INDEX idx_cat_municipios_provincia ON cat_municipios(provincia_id);
      CREATE INDEX idx_cat_modelos_marca ON cat_modelos(marca_id, tipo_vehiculo_id);

      -- Versión (hash que da la API) y fecha de la última descarga de los catálogos.
      CREATE TABLE catalogos_meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
