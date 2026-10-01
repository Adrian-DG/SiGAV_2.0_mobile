/**
 * Lectura local del JWT, sin verificar la firma (eso lo hace la API). Sirve para saber si el
 * token ya venció y quién es el agente sin necesidad de conexión.
 */

/** Claims del token móvil (Application/Contracts/Authentication/SesionClaims.cs, JwtBearerHelper.GenerateMovilToken). */
type JwtPayload = {
  exp?: number; // segundos desde epoch (UTC)
  sub?: string; // AgenteId
  sesion?: string; // "movil" | "web"
  name?: string; // cédula del agente
  nombre?: string; // "Apellido Nombre"
  rango?: string;
  institucion?: string; // siglas (ARD, ERD, PN...)
  unidadId?: string;
  ficha?: string;
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

/** Agente y unidad de la sesión, tal como vienen en el token móvil. */
export type SesionMovil = {
  agenteId: number;
  /** Cédula, sin guiones. */
  identificacion: string;
  /** "Apellido Nombre". */
  nombre: string;
  rango: string;
  /** Siglas de la institución (ARD, ERD, PN...). */
  institucion: string;
  unidadId: number;
  ficha: string;
};

const entero = (valor: string | undefined) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Sesión del token móvil, o null si el token no es de la app (p. ej. uno web) o le faltan el
 * agente o la unidad: sin ellos la app no puede registrar ni filtrar eventos.
 */
export function leerSesionMovil(token: string): SesionMovil | null {
  const p = readPayload(token);
  if (!p || p.sesion !== 'movil') return null;

  const agenteId = entero(p.sub);
  const unidadId = entero(p.unidadId);
  if (!agenteId || !unidadId || !p.ficha) return null;

  return {
    agenteId,
    identificacion: p.name ?? '',
    nombre: p.nombre?.trim() ?? '',
    rango: p.rango?.trim() ?? '',
    institucion: p.institucion?.trim() ?? '',
    unidadId,
    ficha: p.ficha,
  };
}
