import type { SQLiteDatabase } from 'expo-sqlite';

import { diaOperativo, rangoDiaOperativoUtc } from '@/lib/fecha-operativa';

import type { CategoriaEvento, EstadoEvento, EventoListItem, ResumenEventos } from './types';

type EventoRow = {
  id: number;
  estado: number;
  categoria: number;
  tipos: string;
  ciudadano_principal: string | null;
  vehiculo_descripcion: string | null;
  direccion: string | null;
  fecha_hora_reporte: string;
  unidad_ficha: string;
};

function toListItem(row: EventoRow): EventoListItem {
  return {
    id: row.id,
    estado: row.estado as EstadoEvento,
    tipos: JSON.parse(row.tipos) as string[],
    ciudadanoPrincipal: row.ciudadano_principal,
    vehiculoDescripcion: row.vehiculo_descripcion,
    direccion: row.direccion,
    fechaHoraReporte: row.fecha_hora_reporte,
    unidadFicha: row.unidad_ficha,
  };
}

/** Eventos locales filtrados por estado, más recientes primero. */
export async function getEventosLocal(db: SQLiteDatabase, estado: EstadoEvento): Promise<EventoListItem[]> {
  const rows = await db.getAllAsync<EventoRow>(
    'SELECT * FROM eventos WHERE estado = ? ORDER BY fecha_hora_reporte DESC',
    estado,
  );
  return rows.map(toListItem);
}

/**
 * Resumen de hoy (totales por categoría), equivalente local a GET /api/estadisticas/eventos.
 * "Hoy" es el día operativo de RD, no el día UTC (date('now') de SQLite es UTC y a partir de las
 * 8:00 p. m. ya correspondería al día siguiente).
 */
export async function getResumenHoyLocal(db: SQLiteDatabase, ahora: Date = new Date()): Promise<ResumenEventos> {
  const { desdeUtc, hastaUtc } = rangoDiaOperativoUtc(diaOperativo(ahora));
  const rows = await db.getAllAsync<{ categoria: number; total: number }>(
    `SELECT categoria, COUNT(*) as total FROM eventos
     WHERE fecha_hora_reporte >= ? AND fecha_hora_reporte < ?
     GROUP BY categoria`,
    desdeUtc,
    hastaUtc,
  );

  const porCategoria = rows.map((row) => ({
    categoria: row.categoria as CategoriaEvento,
    total: row.total,
  }));

  return {
    totalEventos: porCategoria.reduce((sum, c) => sum + c.total, 0),
    porCategoria,
  };
}
