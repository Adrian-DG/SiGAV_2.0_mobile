/**
 * Modelo y reglas del formulario de evento de campo (sin React, para poder probarlo aislado).
 *
 * Flujo: el agente encuentra el evento durante su patrullaje. Coordenadas y hora de llegada se
 * toman solas al abrir el formulario; unidad, agente, tramo y canal ("en campo") los pone la API a
 * partir de la sesión. El agente indica municipio, tipos de evento, los vehículos involucrados y
 * las personas (cada una asociada al vehículo en que iba, o sin vehículo si es un peatón),
 * autocompletando por cédula y por placa cuando ya se conocen.
 */
import type { PrefijoPlacaItem } from '@/features/catalogos/api';
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
import { analizarPlaca, placaBloquea } from './placa';

export const IDENTIFICACION_MAX_LENGTH = 20; // cédula o pasaporte (DatosPersona.IdentificacionMaxLength)
export const PLACA_MAX_LENGTH = 10; // DatosVehiculo.PlacaMaxLength
export const MAX_VEHICULOS = 30; // Evento.MaxVehiculos
export const MAX_PERSONAS = 30; // Evento.MaxCiudadanos

export type Ubicacion = { latitud: number; longitud: number; precisionMetros: number | null };

export type VehiculoForm = {
  /** Identifica el vehículo en el formulario y en el envío (clave del request). */
  key: string;
  placa: string;
  /** Placa extranjera, temporal o ilegible: no se valida el formato. */
  placaNoEstandar: boolean;
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
  /** `key` del vehículo del evento en que iba; null = sin vehículo. */
  vehiculoKey: string | null;
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
  vehiculos: VehiculoForm[];
  involucrados: InvolucradoForm[];
};

export type FormErrors = Partial<Record<string, string>>;

/** Vehículos y personas ya agregados al evento: contra ellos se valida lo que se está editando. */
export type ContextoEvento = Pick<EventoForm, 'vehiculos' | 'involucrados'>;

// ------------------------------------------------------------------ Roles

/** Conductor y pasajero van siempre en un vehículo (EventoCiudadanoInfo.RequiereVehiculo). */
export const rolRequiereVehiculo = (rol: RolCiudadano) =>
  rol === RolCiudadanoValue.Conductor || rol === RolCiudadanoValue.Pasajero;

/** Un peatón nunca va en un vehículo; paciente u otro pueden ir o no. */
export const rolAdmiteVehiculo = (rol: RolCiudadano) => rol !== RolCiudadanoValue.Peaton;

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
    vehiculos: [],
    involucrados: [],
  };
}

export function nuevoVehiculo(key: string): VehiculoForm {
  return {
    key,
    placa: '',
    placaNoEstandar: false,
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

/** Persona nueva; con vehículo si se agrega desde la tarjeta de ese vehículo (conductor, pasajero). */
export function nuevoInvolucrado(
  key: string,
  rol: RolCiudadano = RolCiudadanoValue.Peaton,
  vehiculoKey: string | null = null,
): InvolucradoForm {
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
    vehiculoKey: rolAdmiteVehiculo(rol) ? vehiculoKey : null,
  };
}

/** Cambia el rol; un peatón pierde el vehículo asociado. */
export function cambiarRol(inv: InvolucradoForm, rol: RolCiudadano): InvolucradoForm {
  return { ...inv, rol, vehiculoKey: rolAdmiteVehiculo(rol) ? inv.vehiculoKey : null };
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

// ------------------------------------------------------------------ Vehículos y personas

const reemplazarOAgregar = <T extends { key: string }>(lista: T[], item: T) =>
  lista.some((x) => x.key === item.key) ? lista.map((x) => (x.key === item.key ? item : x)) : [...lista, item];

export const guardarVehiculo = (form: EventoForm, vehiculo: VehiculoForm): EventoForm => ({
  ...form,
  vehiculos: reemplazarOAgregar(form.vehiculos, vehiculo),
});

/** Quita el vehículo y las personas que iban en él (conductor y pasajeros no existen sin vehículo). */
export const quitarVehiculo = (form: EventoForm, vehiculoKey: string): EventoForm => ({
  ...form,
  vehiculos: form.vehiculos.filter((v) => v.key !== vehiculoKey),
  involucrados: form.involucrados.filter((i) => i.vehiculoKey !== vehiculoKey),
});

export const guardarInvolucrado = (form: EventoForm, inv: InvolucradoForm): EventoForm => ({
  ...form,
  involucrados: reemplazarOAgregar(form.involucrados, inv),
});

export const quitarInvolucrado = (form: EventoForm, key: string): EventoForm => ({
  ...form,
  involucrados: form.involucrados.filter((i) => i.key !== key),
});

/** Personas que iban en el vehículo, el conductor primero. */
export const ocupantesDe = (form: ContextoEvento, vehiculoKey: string) =>
  form.involucrados
    .filter((i) => i.vehiculoKey === vehiculoKey)
    .sort((a, b) => Number(b.rol === RolCiudadanoValue.Conductor) - Number(a.rol === RolCiudadanoValue.Conductor));

export const personasSinVehiculo = (form: ContextoEvento) => form.involucrados.filter((i) => !i.vehiculoKey);

export const tieneConductor = (form: ContextoEvento, vehiculoKey: string, excepto?: string) =>
  form.involucrados.some((i) => i.vehiculoKey === vehiculoKey && i.rol === RolCiudadanoValue.Conductor && i.key !== excepto);

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

export function vehiculoTieneDatos(v: VehiculoForm): boolean {
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

/**
 * Errores del vehículo que se edita. `contexto` son los vehículos del evento (para no repetir la
 * placa) y `prefijos` el catálogo de prefijos de placa (vacío = no se valida el formato).
 */
export function validarVehiculo(v: VehiculoForm, contexto: ContextoEvento, prefijos: PrefijoPlacaItem[] = []): FormErrors {
  const errors: FormErrors = {};
  const placa = formatPlaca(v.placa);

  if (!vehiculoTieneDatos(v)) errors.vehiculo = 'Registre al menos un dato del vehículo (placa, tipo, marca, modelo o color).';

  const analisis = analizarPlaca(placa, v.placaNoEstandar, v.tipoVehiculoId, prefijos);
  if (placaBloquea(analisis) && analisis.estado === 'formato_invalido')
    errors.placa = `Formato de placa no válido (ej. ${analisis.ejemplos.join(', ')}). Si es extranjera, temporal o ilegible, márquela como no estándar.`;
  else if (placa && contexto.vehiculos.some((otro) => otro.key !== v.key && formatPlaca(otro.placa) === placa))
    errors.placa = 'Ya hay un vehículo con esta placa en el evento.';

  return errors;
}

/** Errores de la persona que se edita, contra los vehículos y personas del evento. */
export function validarInvolucrado(inv: InvolucradoForm, contexto: ContextoEvento): FormErrors {
  const errors: FormErrors = {};
  const identificacion = soloAlfanumericos(inv.identificacion);

  if (identificacion && /^\d+$/.test(identificacion) && identificacion.length !== 11)
    errors.identificacion = 'La cédula debe tener 11 dígitos (o use un pasaporte).';
  else if (identificacion && contexto.involucrados.some((o) => o.key !== inv.key && soloAlfanumericos(o.identificacion) === identificacion))
    errors.identificacion = 'Esta persona ya está registrada en el evento.';

  if (inv.vehiculoKey) {
    if (!contexto.vehiculos.some((v) => v.key === inv.vehiculoKey)) errors.vehiculo = 'El vehículo elegido ya no está en el evento.';
    else if (!rolAdmiteVehiculo(inv.rol)) errors.vehiculo = 'Un peatón no puede estar asociado a un vehículo.';
    else if (inv.rol === RolCiudadanoValue.Conductor && tieneConductor(contexto, inv.vehiculoKey, inv.key))
      errors.vehiculo = 'Ese vehículo ya tiene un conductor.';
  } else if (rolRequiereVehiculo(inv.rol)) {
    errors.vehiculo =
      contexto.vehiculos.length === 0
        ? 'Agregue primero el vehículo: conductor y pasajero deben estar asociados a uno.'
        : 'Indique en qué vehículo iba.';
  }

  return errors;
}

/** Errores por campo. Una lista vacía = se puede guardar. */
export function validarEvento(form: EventoForm, prefijos: PrefijoPlacaItem[] = []): FormErrors {
  const errors: FormErrors = {};

  if (!form.ubicacion) errors.ubicacion = 'Aún no se ha obtenido la ubicación del evento.';
  if (!form.municipioId) errors.municipio = 'Seleccione el municipio.';
  if (form.tipoEventoIds.length === 0) errors.tipos = 'Seleccione al menos un tipo de evento.';
  if (form.vehiculos.length > MAX_VEHICULOS) errors.vehiculos = `No se pueden registrar más de ${MAX_VEHICULOS} vehículos.`;
  if (form.involucrados.length > MAX_PERSONAS) errors.personas = `No se pueden registrar más de ${MAX_PERSONAS} personas.`;

  form.vehiculos.forEach((v) => {
    if (Object.keys(validarVehiculo(v, form, prefijos)).length > 0) errors[`vehiculo.${v.key}`] = 'Revise los datos de este vehículo.';
  });
  form.involucrados.forEach((inv) => {
    if (Object.keys(validarInvolucrado(inv, form)).length > 0) errors[`involucrado.${inv.key}`] = 'Revise los datos de esta persona.';
  });

  return errors;
}

// ------------------------------------------------------------------ Request

function toVehiculoRequest(v: VehiculoForm): VehiculoEventoRequest {
  return {
    clave: v.key,
    placa: textoONull(formatPlaca(v.placa)),
    placaNoEstandar: v.placaNoEstandar && !!formatPlaca(v.placa),
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
    vehiculoClave: rolAdmiteVehiculo(inv.rol) ? inv.vehiculoKey : null,
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
    vehiculos: form.vehiculos.map(toVehiculoRequest),
    ciudadanos: form.involucrados.map(toCiudadanoRequest),
  };
}
