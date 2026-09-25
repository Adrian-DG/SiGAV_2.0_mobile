/**
 * Input masking and format validation for the login form.
 * - Cédula: Dominican national ID, 000-0000000-0 (3 + 7 + 1 digits).
 * - Ficha: letras, dígitos y guiones, hasta 20 caracteres (Unidad.FichaMaxLength en la API).
 *   No se impone un patrón fijo (p. ej. CA-1759): las fichas reales no lo siguen todas y es la
 *   API quien confirma si existe.
 */

const CEDULA_REGEX = /^\d{3}-\d{7}-\d$/;

export const FICHA_MAX_LENGTH = 20;
const FICHA_REGEX = /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/;

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

/** Mayúsculas, sin espacios ni símbolos (salvo guiones simples), hasta FICHA_MAX_LENGTH. */
export function maskFicha(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
    .slice(0, FICHA_MAX_LENGTH);
}

export function isFichaComplete(value: string): boolean {
  return value.length <= FICHA_MAX_LENGTH && FICHA_REGEX.test(value);
}
