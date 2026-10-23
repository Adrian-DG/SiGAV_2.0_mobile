/**
 * Datos que se pueden leer del texto reconocido (OCR) en una foto de cédula o de placa. Sin React
 * para poder probarlo aislado. El OCR se equivoca: todo lo que sale de aquí es una sugerencia que
 * el agente revisa antes de aplicarla, y los campos siguen siendo editables.
 */
import type { PrefijoPlacaItem } from '@/features/catalogos/api';
import { SexoValue, type Sexo } from '@/features/events/types';

export type DatosCedula = {
  identificacion?: string;
  nombre?: string;
  apellido?: string;
  sexo?: Sexo;
  edad?: number;
};

const MESES: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
  JAN: 1, APR: 4, AUG: 8, DEC: 12,
};

/** Mayúsculas sin tildes, para comparar etiquetas ("Apellidos" = "APELLIDOS"). */
const plano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();

/** Nombre propio en formato título ("JUAN CARLOS" → "Juan Carlos"). */
const titulo = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

/** Solo letras y espacios, al menos 2 letras: descarta líneas con números o símbolos. */
const esNombre = (s: string) => /^[\p{L} '.-]{2,}$/u.test(s.trim()) && /\p{L}{2}/u.test(s);

/**
 * Cédula dominicana: 11 dígitos, con o sin guiones (000-0000000-0). El OCR confunde O/0, I/1, S/5
 * y B/8 en zonas numéricas, así que se corrigen antes de buscar.
 */
export function buscarCedula(lineas: string[]): string | undefined {
  for (const linea of lineas) {
    const corregida = linea.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
    const m = corregida.match(/(?<!\d)(\d{3})[\s-]?(\d{7})[\s-]?(\d)(?!\d)/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return undefined;
}

/** Valor de una etiqueta: el resto de la misma línea ("NOMBRES: JUAN") o la línea siguiente. */
function valorDe(lineas: string[], etiqueta: RegExp): string | undefined {
  for (let i = 0; i < lineas.length; i++) {
    const p = plano(lineas[i]);
    const m = p.match(etiqueta);
    if (!m) continue;
    const resto = lineas[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:.-]+/, '');
    if (resto && esNombre(resto)) return resto;
    const siguiente = lineas[i + 1];
    if (siguiente && esNombre(siguiente) && !/^(NOMBRE|APELLIDO|SEXO|FECHA|NACIONALIDAD|LUGAR)/.test(plano(siguiente)))
      return siguiente;
  }
  return undefined;
}

/** Fecha de nacimiento: dd/mm/aaaa, dd-mm-aaaa o "dd MES aaaa", preferiblemente junto a "NACIMIENTO". */
export function buscarFechaNacimiento(lineas: string[]): Date | undefined {
  const indice = lineas.findIndex((l) => /NACIMIENTO/.test(plano(l)));
  // Primero la línea de la etiqueta y la siguiente; si no, cualquier fecha del documento
  const candidatas = indice >= 0 ? [lineas[indice], lineas[indice + 1] ?? '', ...lineas] : lineas;
  for (const linea of candidatas) {
    const p = plano(linea);
    const numerica = p.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    const textual = p.match(/(\d{1,2})\s*([A-Z]{3})[A-Z]*\.?\s*(\d{4})/);
    const [dia, mes, anio] = numerica
      ? [Number(numerica[1]), Number(numerica[2]), Number(numerica[3])]
      : textual && MESES[textual[2]]
        ? [Number(textual[1]), MESES[textual[2]], Number(textual[3])]
        : [0, 0, 0];
    if (!anio) continue;
    const fecha = new Date(anio, mes - 1, dia);
    // Descarta fechas imposibles (31/02) o que no son de nacimiento (expiración en el futuro)
    if (fecha.getMonth() === mes - 1 && fecha.getDate() === dia && fecha < new Date() && anio > 1900) return fecha;
  }
  return undefined;
}

export function edadEn(nacimiento: Date, hoy: Date = new Date()): number {
  const cumplioEsteAnio =
    hoy.getMonth() > nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  return hoy.getFullYear() - nacimiento.getFullYear() - (cumplioEsteAnio ? 0 : 1);
}

function buscarSexo(lineas: string[]): Sexo | undefined {
  for (let i = 0; i < lineas.length; i++) {
    const p = plano(lineas[i]);
    if (!/SEXO/.test(p)) continue;
    const valor = `${p.replace(/.*SEXO/, '')} ${plano(lineas[i + 1] ?? '')}`.trim();
    if (/^[:\s]*(F|FEMENINO)\b/.test(valor)) return SexoValue.Femenino;
    if (/^[:\s]*(M|MASCULINO)\b/.test(valor)) return SexoValue.Masculino;
  }
  return undefined;
}

/** Lo que se pudo leer de una cédula. Cada dato es opcional: lo que no se encuentra no se sugiere. */
export function leerCedula(lineas: string[], hoy: Date = new Date()): DatosCedula {
  const nacimiento = buscarFechaNacimiento(lineas);
  const nombre = valorDe(lineas, /NOMBRES?\b/);
  const apellido = valorDe(lineas, /APELLIDOS?\b/);
  const edad = nacimiento ? edadEn(nacimiento, hoy) : undefined;
  return {
    identificacion: buscarCedula(lineas),
    nombre: nombre ? titulo(nombre) : undefined,
    apellido: apellido ? titulo(apellido) : undefined,
    sexo: buscarSexo(lineas),
    edad: edad !== undefined && edad >= 0 && edad <= 120 ? edad : undefined,
  };
}

/**
 * Placa en el texto reconocido: la primera línea que cumple el formato de algún prefijo del
 * catálogo (A123456, G123456...). Sin catálogo, una letra seguida de 5 o 6 dígitos.
 */
export function leerPlaca(lineas: string[], prefijos: PrefijoPlacaItem[]): string | undefined {
  const cumple = (placa: string) =>
    prefijos.length === 0
      ? /^[A-Z]{1,2}\d{5,6}$/.test(placa)
      : prefijos.some((p) => {
          try {
            return placa.startsWith(p.prefijo) && new RegExp(p.patron).test(placa);
          } catch {
            return false;
          }
        });

  for (const linea of lineas) {
    // Una línea puede traer más texto ("REPUBLICA DOMINICANA A123456"): se prueba cada palabra y la línea junta
    const partes = [...plano(linea).split(/\s+/), plano(linea)].map((s) => s.replace(/[^A-Z0-9]/g, ''));
    for (const parte of partes) {
      // En la zona numérica el OCR confunde O con 0 e I con 1
      const placa = parte.replace(/^([A-Z]{1,2})(.*)$/, (_, letras: string, resto: string) => letras + resto.replace(/O/g, '0').replace(/I/g, '1'));
      if (cumple(placa)) return placa;
    }
  }
  return undefined;
}
