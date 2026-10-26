import * as Crypto from 'expo-crypto';

import { provinciaDeMunicipio } from '@/features/catalogos/local/catalogos-local';

import { getEventoDetalle } from '../api';
import { formatIdentificacion, type EventoForm, type InvolucradoForm, type VehiculoForm } from '../form/evento-form';
import {
  importarEventoAsignado,
  localIdDeAsignado,
  type LocalDb,
  type SesionEvento,
  type TipoEventoInfo,
} from '../local/eventos-local';
import { SexoValue, type EventoDetalle } from '../types';

const ROL_PRINCIPAL = 1;

/**
 * Pone en el dispositivo un evento que asignó el call center para que el agente lo edite (agregar
 * vehículos y personas, corregir el lugar...) y lo cierre y envíe como los que registra él. Si ya
 * estaba, devuelve el mismo: lo editado no se pisa con lo del servidor. Requiere conexión la
 * primera vez. Devuelve el localId para abrir el formulario.
 */
export async function abrirAsignadoEnDispositivo(
  db: LocalDb,
  token: string,
  sesion: SesionEvento,
  eventoId: number,
  ahora: Date = new Date(),
): Promise<number> {
  const existente = await localIdDeAsignado(db, sesion, eventoId);
  if (existente) return existente;

  const detalle = await getEventoDetalle(token, eventoId);
  const provinciaId = await provinciaDeMunicipio(db, detalle.municipioId);
  const form = aFormulario(detalle, provinciaId, sesion, ahora);
  const tipos: TipoEventoInfo[] = detalle.tipos.map((t) => ({ id: t.id, nombre: t.nombre, categoria: t.categoria }));

  return importarEventoAsignado(db, sesion, detalle.id, detalle.fechaHoraReporte, form, tipos, ahora);
}

function aFormulario(d: EventoDetalle, provinciaId: number | null, sesion: SesionEvento, ahora: Date): EventoForm {
  const vehiculos = d.vehiculos.map(aVehiculo);
  const involucrados = d.ciudadanos.map(aInvolucrado);
  // "Otros tipos del lugar": los que no tiene ningún vehículo ni persona (así los guarda el formulario)
  const deAlguien = new Set([...vehiculos, ...involucrados].flatMap((x) => x.tipoEventoIds));
  const agentePrincipal = d.unidades.find((u) => u.rol === ROL_PRINCIPAL)?.agenteId;

  return {
    // Clave nueva: identifica este envío (PUT) para que un reintento no se aplique dos veces
    requestId: Crypto.randomUUID(),
    // Si el agente aún no marcó "Llegué", la llegada es cuando empieza a completarlo
    fechaHoraLlegada: d.fechaHoraLlegada ?? ahora.toISOString(),
    ubicacion: { latitud: d.latitud, longitud: d.longitud, precisionMetros: null },
    provinciaId,
    municipioId: d.municipioId,
    tipoEventoIds: d.tipos.map((t) => t.id).filter((id) => !deAlguien.has(id)),
    direccion: d.direccion ?? '',
    comentario: d.comentario ?? '',
    agenteAtiendeId: agentePrincipal && agentePrincipal !== sesion.agenteId ? agentePrincipal : null,
    vehiculos,
    involucrados,
  };
}

/** Marca, modelo y color llegan como nombres: quedan como texto (el agente puede elegirlos del catálogo). */
function aVehiculo(v: EventoDetalle['vehiculos'][number]): VehiculoForm {
  return {
    key: `servidor-${v.id}`,
    placa: v.placa ?? '',
    placaNoEstandar: false,
    tipoVehiculoId: null,
    marcaId: null,
    marcaTexto: v.marca ?? '',
    modeloId: null,
    modeloTexto: v.modelo ?? '',
    colorId: null,
    colorTexto: v.color ?? '',
    origen: null,
    tipoEventoIds: v.tipoEventoIds,
    fotoPlaca: null,
  };
}

function aInvolucrado(c: EventoDetalle['ciudadanos'][number]): InvolucradoForm {
  return {
    key: `servidor-${c.id}`,
    rol: c.rol,
    identificacion: c.identificacion ? formatIdentificacion(c.identificacion) : '',
    nombre: c.nombre ?? '',
    apellido: c.apellido ?? '',
    sexo: c.sexo ?? SexoValue.NoIndicado,
    edad: c.edad != null ? String(c.edad) : '',
    telefono: c.telefono ?? '',
    nacionalidadId: null,
    origen: null,
    vehiculoKey: c.vehiculoId ? `servidor-${c.vehiculoId}` : null,
    tipoEventoIds: c.tipoEventoIds,
    fotoIdentificacion: null,
  };
}
