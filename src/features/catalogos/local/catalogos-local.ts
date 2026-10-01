/**
 * Catálogos guardados en el dispositivo (tablas cat_* de lib/db/migrate.ts).
 *
 * Se descargan completos de GET /api/catalogos/movil y reemplazan lo guardado; la API indica con
 * una versión (hash del contenido) si cambiaron, así que una sincronización sin cambios no
 * transfiere ni reescribe nada. Agregar un tipo de cierre, una marca o un municipio en el backend
 * llega a la app en la siguiente sincronización, sin publicar otra versión.
 *
 * Como eventos-local.ts, solo depende de la interfaz mínima de la base para poder probarlo aislado.
 */
import type { LocalDb } from '@/features/events/local/eventos-local';
import type { CategoriaEvento } from '@/features/events/types';

import type { CatalogoItem, CatalogosMovil, ModeloItem, MunicipioItem, TipoEventoItem } from '../api';

export type EstadoCatalogosLocal = {
  version: string;
  /** ISO UTC de la última vez que se confirmó con la API (haya cambiado o no). */
  sincronizadoEn: string;
};

type SqlParam = string | number | null;

type Tabla<T> = {
  nombre: string;
  columnas: string[];
  valores: (item: T) => SqlParam[];
};

const simple = (nombre: string): Tabla<CatalogoItem> => ({
  nombre,
  columnas: ['id', 'nombre'],
  valores: (x) => [x.id, x.nombre],
});

// Un catálogo de la API por tabla del dispositivo
const TABLAS: { [K in keyof CatalogosMovil]: Tabla<CatalogosMovil[K][number]> } = {
  provincias: simple('cat_provincias'),
  municipios: {
    nombre: 'cat_municipios',
    columnas: ['id', 'nombre', 'provincia_id'],
    valores: (x: MunicipioItem) => [x.id, x.nombre, x.provinciaId],
  },
  tiposEvento: {
    nombre: 'cat_tipos_evento',
    columnas: ['id', 'nombre', 'categoria'],
    valores: (x: TipoEventoItem) => [x.id, x.nombre, x.categoria],
  },
  tiposCierre: simple('cat_tipos_cierre'),
  nacionalidades: simple('cat_nacionalidades'),
  colores: simple('cat_colores'),
  tiposVehiculo: simple('cat_tipos_vehiculo'),
  marcas: simple('cat_marcas'),
  modelos: {
    nombre: 'cat_modelos',
    columnas: ['id', 'nombre', 'marca_id', 'tipo_vehiculo_id'],
    valores: (x: ModeloItem) => [x.id, x.nombre, x.marcaId, x.tipoVehiculoId],
  },
};

/** SQLite limita los parámetros por sentencia (999 en compilaciones antiguas). */
const MAX_PARAMETROS = 900;

const CLAVE_VERSION = 'version';
const CLAVE_SINCRONIZADO = 'sincronizado_en';

// ------------------------------------------------------------------ Escritura

/** Reemplaza todos los catálogos en una sola transacción: queda la versión nueva completa o la anterior. */
export async function guardarCatalogos(db: LocalDb, version: string, catalogos: CatalogosMovil, ahora: Date = new Date()) {
  await db.withTransactionAsync(async () => {
    for (const clave of Object.keys(TABLAS) as (keyof CatalogosMovil)[]) {
      const tabla = TABLAS[clave] as Tabla<unknown>;
      await db.runAsync(`DELETE FROM ${tabla.nombre}`);
      await insertarEnLotes(db, tabla, catalogos[clave] ?? []);
    }
    await guardarMeta(db, CLAVE_VERSION, version);
    await guardarMeta(db, CLAVE_SINCRONIZADO, ahora.toISOString());
  });
}

/** La API confirmó que la versión guardada sigue vigente. */
export async function marcarCatalogosVigentes(db: LocalDb, ahora: Date = new Date()) {
  await guardarMeta(db, CLAVE_SINCRONIZADO, ahora.toISOString());
}

async function insertarEnLotes<T>(db: LocalDb, tabla: Tabla<T>, items: T[]) {
  const porLote = Math.floor(MAX_PARAMETROS / tabla.columnas.length);
  const fila = `(${tabla.columnas.map(() => '?').join(', ')})`;

  for (let i = 0; i < items.length; i += porLote) {
    const lote = items.slice(i, i + porLote);
    await db.runAsync(
      `INSERT INTO ${tabla.nombre} (${tabla.columnas.join(', ')}) VALUES ${lote.map(() => fila).join(', ')}`,
      ...lote.flatMap(tabla.valores),
    );
  }
}

const guardarMeta = (db: LocalDb, clave: string, valor: string) =>
  db.runAsync(
    'INSERT INTO catalogos_meta (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
    clave,
    valor,
  );

// ------------------------------------------------------------------ Lectura

/** null si nunca se han descargado los catálogos en este dispositivo. */
export async function obtenerEstadoCatalogos(db: LocalDb): Promise<EstadoCatalogosLocal | null> {
  const filas = await db.getAllAsync<{ clave: string; valor: string }>('SELECT clave, valor FROM catalogos_meta');
  const meta = new Map(filas.map((f) => [f.clave, f.valor]));
  const version = meta.get(CLAVE_VERSION);
  return version ? { version, sincronizadoEn: meta.get(CLAVE_SINCRONIZADO) ?? '' } : null;
}

const ORDEN = 'ORDER BY nombre COLLATE NOCASE';

const listarSimple = (db: LocalDb, tabla: string) => db.getAllAsync<CatalogoItem>(`SELECT id, nombre FROM ${tabla} ${ORDEN}`);

export const listarProvincias = (db: LocalDb) => listarSimple(db, 'cat_provincias');

export const listarMunicipios = (db: LocalDb, provinciaId: number) =>
  db.getAllAsync<CatalogoItem>(`SELECT id, nombre FROM cat_municipios WHERE provincia_id = ? ${ORDEN}`, provinciaId);

export const listarTiposEvento = (db: LocalDb) =>
  db.getAllAsync<{ id: number; nombre: string; categoria: CategoriaEvento }>(
    'SELECT id, nombre, categoria FROM cat_tipos_evento ORDER BY categoria, nombre COLLATE NOCASE',
  );

/** En el orden del catálogo (por Id), como lo definió el backend, no alfabético. */
export const listarTiposCierre = (db: LocalDb) => db.getAllAsync<CatalogoItem>('SELECT id, nombre FROM cat_tipos_cierre ORDER BY id');

export const listarNacionalidades = (db: LocalDb) => listarSimple(db, 'cat_nacionalidades');
export const listarColores = (db: LocalDb) => listarSimple(db, 'cat_colores');
export const listarTiposVehiculo = (db: LocalDb) => listarSimple(db, 'cat_tipos_vehiculo');
export const listarMarcas = (db: LocalDb) => listarSimple(db, 'cat_marcas');

/** Modelos de la marca; si se indica el tipo de vehículo, solo los de ese tipo. */
export const listarModelos = (db: LocalDb, marcaId: number, tipoVehiculoId?: number | null) =>
  tipoVehiculoId
    ? db.getAllAsync<CatalogoItem>(
        `SELECT id, nombre FROM cat_modelos WHERE marca_id = ? AND tipo_vehiculo_id = ? ${ORDEN}`,
        marcaId,
        tipoVehiculoId,
      )
    : db.getAllAsync<CatalogoItem>(`SELECT id, nombre FROM cat_modelos WHERE marca_id = ? ${ORDEN}`, marcaId);
