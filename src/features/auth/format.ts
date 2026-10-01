/**
 * Input masking and format validation for the login form.
 * - Cédula: Dominican national ID, 000-0000000-0 (3 + 7 + 1 digits).
 * - Ficha: 1-2 letras + guión + 3-4 dígitos (ej. CA-203, CA-1759, TM-308).
 */

const CEDULA_REGEX = /^\d{3}-\d{7}-\d$/;

export const FICHA_MAX_LENGTH = 7; // "AA-0000"
const FICHA_REGEX = /^[A-Z]{1,2}-[0-9]{3,4}$/;

export function maskCedula(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  const parts = [digits.slice(0, 3), digits.slice(3, 10), digits.slice(10, 11)].filter(Boolean);
  return parts.join('-');
}

export function isCedulaComplete(value: string): boolean {
  return CEDULA_REGEX.test(value);
}

/** Strips the formatting dashes before sending to the API. */
export function unmaskCedula(value: string): string {
  return value.replace(/\D/g, '');
}

/** Arma el patrón AA-0000 a medida que se escribe: 1-2 letras, guión automático, 3-4 dígitos. */
export function maskFicha(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = clean.match(/^[A-Z]{1,2}/)?.[0] ?? '';
  const digits = clean.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 4);
  return digits ? `${letters}-${digits}` : letters;
}

export function isFichaComplete(value: string): boolean {
  return FICHA_REGEX.test(value);
}
