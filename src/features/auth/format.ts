/**
 * Input masking and format validation for the login form.
 * - Cédula: Dominican national ID, 000-0000000-0 (3 + 7 + 1 digits).
 * - Ficha: two letters + 3-4 digits, e.g. CA-1759.
 */

const CEDULA_REGEX = /^\d{3}-\d{7}-\d$/;
const FICHA_REGEX = /^[A-Z]{2}-\d{3,4}$/;

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

export function maskFicha(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let letters = '';
  let digits = '';

  for (const char of clean) {
    if (letters.length < 2 && /[A-Z]/.test(char)) {
      letters += char;
    } else if (digits.length < 4 && /[0-9]/.test(char)) {
      digits += char;
    }
  }

  return digits ? `${letters}-${digits}` : letters;
}

export function isFichaComplete(value: string): boolean {
  return FICHA_REGEX.test(value);
}
