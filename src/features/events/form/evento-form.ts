/**
 * Modelo y reglas del formulario de evento de campo (sin React, para poder probarlo aislado).
 *
 * Flujo: el agente encuentra el evento durante su patrullaje. Coordenadas y hora de llegada se
 * toman solas al abrir el formulario; unidad, agente, tramo y canal ("en campo") los pone la API a
 * partir de la sesión. El agente indica municipio, tipos de evento y las personas/vehículos
 * involucrados, autocompletando por cédula y por placa cuando ya se conocen.
 */
import type { CiudadanoConocido, OrigenDato, VehiculoConocido } from '@/features/historico/api';

import {
  RolCiudadanoValue,
  SexoValue,
  type CiudadanoEventoRequest,
  type RegistrarEventoRequest,
  type RolCiudadano,
  type Sexo,
  type VehiculoEventoRequest,
} from '../types';

export const IDENTIFICACION_MAX_LENGTH = 20; // cédula o pasaporte (DatosPersona.IdentificacionMaxLength)
export const PLACA_MAX_LENGTH = 10; // DatosVehiculo.PlacaMaxLength

export type Ubicacion = { latitud: number; longitud: number; precisionMetros: number | null };

export type VehiculoForm = {
  placa: string;
  tipoVehiculoId: number | null;
  marcaId: number | null;
  /** Solo si la marca no está en el catálogo. */
  marcaTexto: string;
  modeloId: number | null;
  modeloTexto: string;
  colorId: number | null;
  colorTexto: string;
  origen: OrigenDato | null;
};

export type InvolucradoForm = {
  key: string;
  rol: RolCiudadano;
  identificacion: string;
  nombre: string;
  apellido: string;
  sexo: Sexo;
  telefono: string;
  nacionalidadId: number | null;
  origen: OrigenDato | null;
  conVehiculo: boolean;
  vehiculo: VehiculoForm;
};

export type EventoForm = {
  requestId: string;
  /** ISO UTC: momento en que el agente abrió el formulario (llegó al lugar). */
  fechaHoraLlegada: string;
  ubicacion: Ubicacion | null;
  provinciaId: number | null;
  municipioId: number | null;
  tipoEventoIds: number[];
  direccion: string;
  comentario: string;
  involucrados: InvolucradoForm[];
};

export type FormErrors = Partial<Record<string, string>>;

// ------------------------------------------------------------------ Creación

export function nuevoEventoForm(requestId: string, ahora: Date = new Date()): EventoForm {
  return {
    requestId,
    fechaHoraLlegada: ahora.toISOString(),
    ubicacion: null,
    provinciaId: null,
    municipioId: null,
    tipoEventoIds: [],
    direccion: '',
    comentario: '',
    involucrados: [],
  };
}

export function vehiculoVacio(): VehiculoForm {
  return {
    placa: '',
    tipoVehiculoId: null,
    marcaId: null,
    marcaTexto: '',
    modeloId: null,
    modeloTexto: '',
    colorId: null,
    colorTexto: '',
    origen: null,
  };
}

export function nuevoInvolucrado(key: string, rol: RolCiudadano = RolCiudadanoValue.Conductor): InvolucradoForm {
  return {
    key,
    rol,
    identificacion: '',
    nombre: '',
    apellido: '',
    sexo: SexoValue.NoIndicado,
    telefono: '',
    nacionalidadId: null,
    origen: null,
    // Un conductor casi siempre viene con vehículo; un peatón o paciente, no
    conVehiculo: rol === RolCiudadanoValue.Conductor || rol === RolCiudadanoValue.Pasajero,
    vehiculo: vehiculoVacio(),
  };
}

export function toggleTipoEvento(form: EventoForm, tipoEventoId: number): EventoForm {
  const seleccionado = form.tipoEventoIds.includes(tipoEventoId);
  return {
    ...form,
    tipoEventoIds: seleccionado
      ? form.tipoEventoIds.filter((id) => id !== tipoEventoId)
      : [...form.tipoEventoIds, tipoEventoId],
  };
}

// ------------------------------------------------------------------ Normalización

const soloAlfanumericos = (valor: string) => valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Cédula dominicana (11 dígitos) con guiones 000-0000000-0; un pasaporte queda en mayúsculas. */
export function formatIdentificacion(raw: string): string {
  const limpio = soloAlfanumericos(raw).slice(0, IDENTIFICACION_MAX_LENGTH);
  if (/^\d+$/.test(limpio) && limpio.length <= 11) {
    const partes = [limpio.slice(0, 3), limpio.slice(3, 10), limpio.slice(10, 11)].filter(Boolean);
    return partes.join('-');
  }
  return limpio;
}

export function formatPlaca(raw: string): string {
  return soloAlfanumericos(raw).slice(0, PLACA_MAX_LENGTH);
}

/** Lo mínimo para intentar el autocompletado: una cédula completa o un pasaporte de 6+ caracteres. */
export function puedeBuscarIdentificacion(valor: string): boolean {
  const limpio = soloAlfanumericos(valor);
  return /^\d{11}$/.test(limpio) || (/[A-Z]/.test(limpio) && limpio.length >= 6);
}

export function puedeBuscarPlaca(valor: string): boolean {
  return soloAlfanumericos(valor).length >= 5;
}

const textoONull = (valor: string) => (valor.trim() ? valor.trim() : null);

// ------------------------------------------------------------------ Autocompletado

/** Completa la persona con los datos conocidos, sin pisar lo que el agente ya escribió distinto. */
export function aplicarCiudadanoConocido(inv: InvolucradoForm, conocido: CiudadanoConocido): InvolucradoForm {
  return {
    ...inv,
    identificacion: formatIdentificacion(conocido.identificacion),
    nombre: inv.nombre.trim() || conocido.nombre || '',
    apellido: inv.apellido.trim() || conocido.apellido || '',
    sexo: inv.sexo !== SexoValue.NoIndicado ? inv.sexo : ((conocido.sexo as Sexo) ?? SexoValue.NoIndicado),
    telefono: inv.telefono.trim() || conocido.telefono || '',
    nacionalidadId: inv.nacionalidadId ?? conocido.nacionalidadId,
    origen: conocido.origen,
  };
}

export function aplicarVehiculoConocido(vehiculo: VehiculoForm, conocido: VehiculoConocido): VehiculoForm {
  return {
    ...vehiculo,
    placa: formatPlaca(conocido.placa),
    tipoVehiculoId: vehiculo.tipoVehiculoId ?? conocido.tipoVehiculoId,
    marcaId: vehiculo.marcaId ?? conocido.marcaId,
    marcaTexto: vehiculo.marcaTexto.trim() || conocido.marcaTexto || '',
    modeloId: vehiculo.modeloId ?? conocido.modeloId,
    modeloTexto: vehiculo.modeloTexto.trim() || conocido.modeloTexto || '',
    colorId: vehiculo.colorId ?? conocido.colorId,
    colorTexto: vehiculo.colorTexto.trim() || conocido.colorTexto || '',
    origen: conocido.origen,
  };
}

// ------------------------------------------------------------------ Validación

function vehiculoTieneDatos(v: VehiculoForm): boolean {
  return !!(
    v.placa.trim() ||
    v.tipoVehiculoId ||
    v.marcaId ||
    v.modeloId ||
    v.colorId ||
    v.marcaTexto.trim() ||
    v.modeloTexto.trim() ||
    v.colorTexto.trim()
  );
}

export function validarInvolucrado(inv: InvolucradoForm): FormErrors {
  const errors: FormErrors = {};
  const identificacion = soloAlfanumericos(inv.identificacion);

  if (identificacion && /^\d+$/.test(identificacion) && identificacion.length !== 11)
    errors.identificacion = 'La cédula debe tener 11 dígitos (o use un pasaporte).';
  if (inv.conVehiculo && !vehiculoTieneDatos(inv.vehiculo))
    errors.vehiculo = 'Registre al menos un dato del vehículo (placa, tipo, marca, modelo o color).';

  return errors;
}

/** Errores por campo. Una lista vacía = se puede enviar. */
export function validarEvento(form: EventoForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.ubicacion) errors.ubicacion = 'Aún no se ha obtenido la ubicación del evento.';
  if (!form.municipioId) errors.municipio = 'Seleccione el municipio.';
  if (form.tipoEventoIds.length === 0) errors.tipos = 'Seleccione al menos un tipo de evento.';

  form.involucrados.forEach((inv, i) => {
    if (Object.keys(validarInvolucrado(inv)).length > 0)
      errors[`involucrado.${i}`] = 'Revise los datos de esta persona.';
  });

  return errors;
}

// ------------------------------------------------------------------ Request

function toVehiculoRequest(v: VehiculoForm): VehiculoEventoRequest {
  return {
    placa: textoONull(formatPlaca(v.placa)),
    tipoVehiculoId: v.tipoVehiculoId,
    marcaId: v.marcaId,
    modeloId: v.modeloId,
    colorId: v.colorId,
    // El texto libre solo cuando no se eligió del catálogo (igual regla que la API)
    marcaTexto: v.marcaId ? null : textoONull(v.marcaTexto),
    modeloTexto: v.modeloId ? null : textoONull(v.modeloTexto),
    colorTexto: v.colorId ? null : textoONull(v.colorTexto),
  };
}

function toCiudadanoRequest(inv: InvolucradoForm): CiudadanoEventoRequest {
  return {
    rol: inv.rol,
    identificacion: textoONull(soloAlfanumericos(inv.identificacion)),
    nombre: textoONull(inv.nombre),
    apellido: textoONull(inv.apellido),
    sexo: inv.sexo,
    telefono: textoONull(inv.telefono),
    nacionalidadId: inv.nacionalidadId,
    vehiculo: inv.conVehiculo ? toVehiculoRequest(inv.vehiculo) : null,
  };
}

/**
 * Evento de campo: se reporta y se atiende en el mismo momento (el agente ya está en el lugar),
 * así que reporte = llegada y la API lo registra "en curso".
 */
export function toRegistrarEventoRequest(form: EventoForm): RegistrarEventoRequest {
  if (!form.ubicacion || !form.municipioId) throw new Error('Formulario incompleto: valide antes de convertir.');

  return {
    requestId: form.requestId,
    latitud: form.ubicacion.latitud,
    longitud: form.ubicacion.longitud,
    municipioId: form.municipioId,
    tipoEventoIds: form.tipoEventoIds,
    fechaHoraReporteUtc: form.fechaHoraLlegada,
    fechaHoraLlegadaUtc: form.fechaHoraLlegada,
    direccion: textoONull(form.direccion),
    comentario: textoONull(form.comentario),
    ciudadanos: form.involucrados.map(toCiudadanoRequest),
  };
}
