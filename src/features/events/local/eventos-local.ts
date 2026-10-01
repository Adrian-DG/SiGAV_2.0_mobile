/**
 * Eventos guardados en el dispositivo (SQLite, esquema en lib/db/migrate.ts).
 *
 * Ciclo de vida en la app:
 *   1. El agente registra el evento → se guarda aquí "en curso" (nada se envía todavía).
 *   2. Puede editarlo cuantas veces quiera; los cambios quedan solo en el dispositivo.
 *   3. Para cerrarlo elige el tipo de cierre → queda "por enviar" (aún editable).
 *   4. Lo envía → POST /api/eventos ya completado; queda "enviado" y de solo lectura.
 *
 * Solo depende de la interfaz mínima de la base (no de React ni de expo-sqlite), para poder
 * probarlo con cualquier SQLite.
 */
import {
  EstadoEventoValue,
  RolCiudadanoValue,
  SexoValue,
  type CategoriaEvento,
  type EstadoEvento,
  type RegistrarEventoRequest,
  type RolCiudadano,
  type Sexo,
} from '../types';
import { toRegistrarEventoRequest, vehiculoVacio, type EventoForm, type InvolucradoForm } from '../form/evento-form';

/** Subconjunto de SQLiteDatabase (expo-sqlite) que se usa aquí. */
export type LocalDb = {
  runAsync(sql: string, ...params: SqlParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlParam[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};
type SqlParam = string | number | null;

/** Dueño del evento: la sesión que lo registró y con la que debe enviarse. */
export type SesionEvento = { agenteId: number; unidadId: number };

/** Lo que el listado de la app agrupa en pestañas. */
export type EstatusLocal = 'en_curso' | 'por_enviar' | 'enviado';

export const ESTATUS_LOCAL_LABELS: Record<EstatusLocal, string> = {
  en_curso: 'En curso',
  por_enviar: 'Por enviar',
  enviado: 'Enviados',
};

/** Nombre y categoría de cada tipo elegido (para listar sin conexión). */
export type TipoEventoInfo = { id: number; nombre: string; categoria: CategoriaEvento };

export type EventoLocalListItem = {
  localId: number;
  serverId: number | null;
  estatus: EstatusLocal;
  estado: EstadoEvento;
  tipos: string[];
  categorias: CategoriaEvento[];
  ciudadanoPrincipal: string | null;
  vehiculoDescripcion: string | null;
  direccion: string | null;
  fechaHoraReporte: string;
  tipoCierreId: number | null;
  /** Nombre en el catálogo del dispositivo (null si el tipo ya no está en él). */
  tipoCierre: string | null;
  syncError: string | null;
};

export type EventoLocal = {
  localId: number;
  serverId: number | null;
  estatus: EstatusLocal;
  estado: EstadoEvento;
  tipoCierreId: number | null;
  tipoCierre: string | null;
  fechaHoraCompletado: string | null;
  syncError: string | null;
  form: EventoForm;
};

export class EventoNoEditableError extends Error {
  constructor() {
    super('El evento ya fue enviado y no puede modificarse.');
    this.name = 'EventoNoEditableError';
  }
}

// ------------------------------------------------------------------ Filas

type EventoRow = {
  id: number;
  request_id: string;
  server_id: number | null;
  estado: number;
  latitud: number;
  longitud: number;
  provincia_id: number | null;
  municipio_id: number;
  direccion: string | null;
  comentario: string | null;
  fecha_hora_reporte_utc: string;
  fecha_hora_llegada_utc: string | null;
  fecha_hora_completado_utc: string | null;
  tipo_cierre_id: number | null;
  /** cat_tipos_cierre.nombre (LEFT JOIN). */
  tipo_cierre: string | null;
  synced: number;
  sync_error: string | null;
};

type CiudadanoRow = {
  id: number;
  evento_id: number;
  rol: number;
  identificacion: string | null;
  nombre: string | null;
  apellido: string | null;
  sexo: number;
  telefono: string | null;
  nacionalidad_id: number | null;
  placa: string | null;
  tipo_vehiculo_id: number | null;
  marca_id: number | null;
  marca_texto: string | null;
  modelo_id: number | null;
  modelo_texto: string | null;
  color_id: number | null;
  color_texto: string | null;
};

/** Ciudadano con los nombres del vehículo según los catálogos del dispositivo (LEFT JOIN). */
type CiudadanoListadoRow = CiudadanoRow & {
  tipo_vehiculo: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
};

const SELECT_EVENTO = `SELECT e.*, tc.nombre AS tipo_cierre
  FROM eventos e LEFT JOIN cat_tipos_cierre tc ON tc.id = e.tipo_cierre_id`;

const estatusDe = (row: { synced: number; estado: number }): EstatusLocal =>
  row.synced ? 'enviado' : row.estado === EstadoEventoValue.Completado ? 'por_enviar' : 'en_curso';

const FILTRO_ESTATUS: Record<EstatusLocal, string> = {
  en_curso: `synced = 0 AND estado <> ${EstadoEventoValue.Completado}`,
  por_enviar: `synced = 0 AND estado = ${EstadoEventoValue.Completado}`,
  enviado: 'synced = 1',
};

const texto = (valor: string) => (valor.trim() ? valor.trim() : null);

// ------------------------------------------------------------------ Escritura

/**
 * Crea el evento (sin `localId`) o reemplaza sus datos. Lo enviado ya no se puede editar.
 * Tipos y personas se reescriben completos: son parte del evento, no tienen identidad propia.
 */
export async function guardarEventoLocal(
  db: LocalDb,
  form: EventoForm,
  sesion: SesionEvento,
  tipos: TipoEventoInfo[],
  ahora: Date = new Date(),
  localId?: number,
): Promise<number> {
  // Misma conversión que el envío: si no es convertible no debe guardarse
  const request = toRegistrarEventoRequest(form);
  const ahoraIso = ahora.toISOString();
  let id = localId ?? 0;

  await db.withTransactionAsync(async () => {
    if (localId === undefined) {
      const result = await db.runAsync(
        `INSERT INTO eventos (request_id, estado, latitud, longitud, provincia_id, municipio_id, direccion, comentario,
           fecha_hora_reporte_utc, fecha_hora_llegada_utc, agente_id, unidad_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        request.requestId,
        EstadoEventoValue.EnCurso,
        request.latitud,
        request.longitud,
        form.provinciaId,
        request.municipioId,
        request.direccion,
        request.comentario,
        request.fechaHoraReporteUtc,
        request.fechaHoraLlegadaUtc,
        sesion.agenteId,
        sesion.unidadId,
        ahoraIso,
        ahoraIso,
      );
      id = result.lastInsertRowId;
    } else {
      const result = await db.runAsync(
        `UPDATE eventos SET latitud = ?, longitud = ?, provincia_id = ?, municipio_id = ?, direccion = ?, comentario = ?,
           sync_error = NULL, updated_at = ?
         WHERE id = ? AND synced = 0`,
        request.latitud,
        request.longitud,
        form.provinciaId,
        request.municipioId,
        request.direccion,
        request.comentario,
        ahoraIso,
        localId,
      );
      if (result.changes === 0) throw new EventoNoEditableError();
      await db.runAsync('DELETE FROM evento_tipos WHERE evento_id = ?', localId);
      await db.runAsync('DELETE FROM evento_ciudadanos WHERE evento_id = ?', localId);
    }

    const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
    for (const tipoId of request.tipoEventoIds) {
      const info = tipoPorId.get(tipoId);
      await db.runAsync(
        'INSERT INTO evento_tipos (evento_id, tipo_evento_id, nombre, categoria) VALUES (?, ?, ?, ?)',
        id,
        tipoId,
        info?.nombre ?? null,
        info?.categoria ?? null,
      );
    }

    for (const c of request.ciudadanos) {
      const v = c.vehiculo;
      await db.runAsync(
        `INSERT INTO evento_ciudadanos (evento_id, rol, identificacion, nombre, apellido, sexo, telefono, nacionalidad_id,
           placa, tipo_vehiculo_id, marca_id, marca_texto, modelo_id, modelo_texto, color_id, color_texto)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        c.rol,
        c.identificacion,
        c.nombre,
        c.apellido,
        c.sexo,
        c.telefono,
        c.nacionalidadId,
        v?.placa ?? null,
        v?.tipoVehiculoId ?? null,
        v?.marcaId ?? null,
        v?.marcaTexto ?? null,
        v?.modeloId ?? null,
        v?.modeloTexto ?? null,
        v?.colorId ?? null,
        v?.colorTexto ?? null,
      );
    }
  });

  return id;
}

/**
 * Cierra el evento en el dispositivo (queda "por enviar"). Puede volver a llamarse para cambiar
 * el tipo de cierre mientras no se haya enviado; la hora de cierre es la del primer cierre.
 */
export async function cerrarEventoLocal(db: LocalDb, localId: number, tipoCierreId: number, ahora: Date = new Date()) {
  const result = await db.runAsync(
    `UPDATE eventos SET estado = ?, tipo_cierre_id = ?, fecha_hora_completado_utc = COALESCE(fecha_hora_completado_utc, ?),
       sync_error = NULL, updated_at = ?
     WHERE id = ? AND synced = 0`,
    EstadoEventoValue.Completado,
    tipoCierreId,
    ahora.toISOString(),
    ahora.toISOString(),
    localId,
  );
  if (result.changes === 0) throw new EventoNoEditableError();
}

export async function marcarEnviado(db: LocalDb, localId: number, serverId: number) {
  await db.runAsync('UPDATE eventos SET synced = 1, server_id = ?, sync_error = NULL WHERE id = ?', serverId, localId);
}

export async function registrarErrorEnvio(db: LocalDb, localId: number, mensaje: string) {
  await db.runAsync('UPDATE eventos SET sync_error = ? WHERE id = ? AND synced = 0', mensaje, localId);
}

// ------------------------------------------------------------------ Lectura

/** Eventos de la sesión con ese estatus; más recientes primero. */
export async function listarEventosLocales(db: LocalDb, sesion: SesionEvento, estatus: EstatusLocal): Promise<EventoLocalListItem[]> {
  const eventos = await db.getAllAsync<EventoRow>(
    `${SELECT_EVENTO} WHERE e.agente_id = ? AND e.unidad_id = ? AND ${FILTRO_ESTATUS[estatus]}
     ORDER BY e.fecha_hora_reporte_utc DESC, e.id DESC`,
    sesion.agenteId,
    sesion.unidadId,
  );
  if (eventos.length === 0) return [];

  const ids = eventos.map((e) => e.id);
  const marcadores = ids.map(() => '?').join(', ');
  const tipos = await db.getAllAsync<{ evento_id: number; nombre: string | null; categoria: number | null }>(
    `SELECT evento_id, nombre, categoria FROM evento_tipos WHERE evento_id IN (${marcadores})`,
    ...ids,
  );
  const ciudadanos = await db.getAllAsync<CiudadanoListadoRow>(
    `SELECT c.*, tv.nombre AS tipo_vehiculo, ma.nombre AS marca, mo.nombre AS modelo, co.nombre AS color
     FROM evento_ciudadanos c
       LEFT JOIN cat_tipos_vehiculo tv ON tv.id = c.tipo_vehiculo_id
       LEFT JOIN cat_marcas ma ON ma.id = c.marca_id
       LEFT JOIN cat_modelos mo ON mo.id = c.modelo_id
       LEFT JOIN cat_colores co ON co.id = c.color_id
     WHERE c.evento_id IN (${marcadores}) ORDER BY c.id`,
    ...ids,
  );

  return eventos.map((e) => {
    const propios = tipos.filter((t) => t.evento_id === e.id);
    const personas = ciudadanos.filter((c) => c.evento_id === e.id);
    const principal = personas[0];
    const conVehiculo = personas.find((c) => c.placa || c.tipo_vehiculo_id || c.marca_id || c.marca_texto);

    return {
      localId: e.id,
      serverId: e.server_id,
      estatus: estatusDe(e),
      estado: e.estado as EstadoEvento,
      tipos: propios.map((t) => t.nombre ?? 'Tipo de evento').sort(),
      categorias: [...new Set(propios.map((t) => t.categoria).filter((c): c is number => c != null))].sort() as CategoriaEvento[],
      ciudadanoPrincipal: principal ? nombrePersona(principal) : null,
      vehiculoDescripcion: conVehiculo ? describirVehiculo(conVehiculo) : null,
      direccion: e.direccion,
      fechaHoraReporte: e.fecha_hora_reporte_utc,
      tipoCierreId: e.tipo_cierre_id,
      tipoCierre: e.tipo_cierre,
      syncError: e.sync_error,
    };
  });
}

/** Cuántos eventos de la sesión hay en cada estatus (para las pestañas del listado). */
export async function contarEventosLocales(db: LocalDb, sesion: SesionEvento): Promise<Record<EstatusLocal, number>> {
  const filas = await db.getAllAsync<{ synced: number; estado: number; total: number }>(
    'SELECT synced, estado, COUNT(*) AS total FROM eventos WHERE agente_id = ? AND unidad_id = ? GROUP BY synced, estado',
    sesion.agenteId,
    sesion.unidadId,
  );
  const conteo: Record<EstatusLocal, number> = { en_curso: 0, por_enviar: 0, enviado: 0 };
  for (const fila of filas) conteo[estatusDe(fila)] += fila.total;
  return conteo;
}

/** Evento completo de la sesión, listo para el formulario de edición o para enviarse. */
export async function obtenerEventoLocal(db: LocalDb, localId: number, sesion: SesionEvento): Promise<EventoLocal | null> {
  const e = await db.getFirstAsync<EventoRow>(
    `${SELECT_EVENTO} WHERE e.id = ? AND e.agente_id = ? AND e.unidad_id = ?`,
    localId,
    sesion.agenteId,
    sesion.unidadId,
  );
  if (!e) return null;

  const tipos = await db.getAllAsync<{ tipo_evento_id: number }>(
    'SELECT tipo_evento_id FROM evento_tipos WHERE evento_id = ? ORDER BY rowid',
    localId,
  );
  const ciudadanos = await db.getAllAsync<CiudadanoRow>('SELECT * FROM evento_ciudadanos WHERE evento_id = ? ORDER BY id', localId);

  return {
    localId: e.id,
    serverId: e.server_id,
    estatus: estatusDe(e),
    estado: e.estado as EstadoEvento,
    tipoCierreId: e.tipo_cierre_id,
    tipoCierre: e.tipo_cierre,
    fechaHoraCompletado: e.fecha_hora_completado_utc,
    syncError: e.sync_error,
    form: {
      requestId: e.request_id,
      fechaHoraLlegada: e.fecha_hora_llegada_utc ?? e.fecha_hora_reporte_utc,
      ubicacion: { latitud: e.latitud, longitud: e.longitud, precisionMetros: null },
      provinciaId: e.provincia_id,
      municipioId: e.municipio_id,
      tipoEventoIds: tipos.map((t) => t.tipo_evento_id),
      direccion: e.direccion ?? '',
      comentario: e.comentario ?? '',
      involucrados: ciudadanos.map(aInvolucrado),
    },
  };
}

/** Lo que se envía a la API: el evento con su llegada y su cierre. */
export function toRequestDeEnvio(evento: EventoLocal): RegistrarEventoRequest {
  if (evento.estado !== EstadoEventoValue.Completado || evento.tipoCierreId == null || !evento.fechaHoraCompletado) {
    throw new Error('Seleccione el tipo de cierre antes de enviar el evento.');
  }
  return {
    ...toRegistrarEventoRequest(evento.form),
    fechaHoraCompletadoUtc: evento.fechaHoraCompletado,
    tipoCierreId: evento.tipoCierreId,
  };
}

// ------------------------------------------------------------------ Conversión

function aInvolucrado(c: CiudadanoRow): InvolucradoForm {
  const conVehiculo = !!(c.placa || c.tipo_vehiculo_id || c.marca_id || c.modelo_id || c.color_id || c.marca_texto || c.modelo_texto || c.color_texto);
  return {
    key: `local-${c.id}`,
    rol: (c.rol as RolCiudadano) ?? RolCiudadanoValue.Otro,
    identificacion: c.identificacion ?? '',
    nombre: c.nombre ?? '',
    apellido: c.apellido ?? '',
    sexo: (c.sexo as Sexo) ?? SexoValue.NoIndicado,
    telefono: c.telefono ?? '',
    nacionalidadId: c.nacionalidad_id,
    origen: null,
    conVehiculo,
    vehiculo: conVehiculo
      ? {
          placa: c.placa ?? '',
          tipoVehiculoId: c.tipo_vehiculo_id,
          marcaId: c.marca_id,
          marcaTexto: c.marca_texto ?? '',
          modeloId: c.modelo_id,
          modeloTexto: c.modelo_texto ?? '',
          colorId: c.color_id,
          colorTexto: c.color_texto ?? '',
          origen: null,
        }
      : vehiculoVacio(),
  };
}

function nombrePersona(c: CiudadanoRow): string {
  return texto(`${c.nombre ?? ''} ${c.apellido ?? ''}`) ?? c.identificacion ?? 'Persona no identificada';
}

/** Como CatalogoVehiculo.Describir en la API: nombre del catálogo o, si no estaba en él, el texto libre. */
function describirVehiculo(c: CiudadanoListadoRow): string {
  const marca = c.marca_id ? c.marca : c.marca_texto;
  const modelo = c.modelo_id ? c.modelo : c.modelo_texto;
  const color = c.color_id ? c.color : c.color_texto;
  const marcaModelo = texto(`${marca ?? ''} ${modelo ?? ''}`);
  return [marcaModelo ?? c.tipo_vehiculo, color, c.placa ?? 'Sin placa'].filter(Boolean).join(' · ');
}
