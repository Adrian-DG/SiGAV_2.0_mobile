/**
 * Lectura local del JWT, sin verificar la firma (eso lo hace la API). Sirve para saber si el
 * token ya venció sin necesidad de conexión.
 */

type JwtPayload = {
  exp?: number; // segundos desde epoch (UTC)
};

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(
    Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  );
}

function readPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    return payload ? (JSON.parse(decodeBase64Url(payload)) as JwtPayload) : null;
  } catch {
    return null;
  }
}

/**
 * true si el token venció o no se puede leer. Se aplica un margen para no usar un token que
 * vencería durante la petición.
 */
export function isTokenExpired(token: string, marginSeconds = 30): boolean {
  const exp = readPayload(token)?.exp;
  if (!exp) return true;
  return Date.now() / 1000 >= exp - marginSeconds;
}
