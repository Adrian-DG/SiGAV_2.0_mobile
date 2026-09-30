import { apiConfig } from '@/lib/api-config';

/** Matches the { message, errors } shape written by Presentation/Middleware/ApiExceptionHandler.cs. */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]> | null;

  constructor(status: number, message: string, errors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registra quién reacciona cuando la API rechaza con 401 una petición autenticada (token vencido
 * o revocado). Devuelve la función para anular el registro.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  token?: string | null;
  /** Por defecto DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Para cancelar desde fuera (p. ej. al desmontar la pantalla). */
  signal?: AbortSignal;
};

/** En carretera la señal es mala: sin límite, una petición puede quedar colgada minutos. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** status = 0: la petición no llegó a tener respuesta HTTP (sin conexión, timeout, cancelada). */
export const NETWORK_ERROR_STATUS = 0;

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${apiConfig.baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, token, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  let text: string;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...apiConfig.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    if (timedOut) {
      throw new ApiError(NETWORK_ERROR_STATUS, 'El servidor tardó demasiado en responder. Verifique su conexión e intente de nuevo.');
    }
    if (signal?.aborted) throw error;
    throw new ApiError(NETWORK_ERROR_STATUS, 'No hay conexión con el servidor. Verifique su señal e intente de nuevo.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const data = parseJson(text);

  if (!response.ok) {
    // Solo si la petición llevaba token: un 401 del login (credenciales inválidas) no es una sesión vencida
    if (response.status === 401 && token) unauthorizedHandler?.();

    const message =
      (typeof data?.message === 'string' && data.message) ||
      (response.status >= 500
        ? 'El servidor no está disponible en este momento. Intente de nuevo en unos minutos.'
        : `La solicitud falló con estado ${response.status}.`);
    throw new ApiError(response.status, message, data?.errors ?? null);
  }

  if (text && data === INVALID_JSON) {
    throw new ApiError(response.status, 'El servidor devolvió una respuesta inesperada.');
  }

  return (data ?? null) as T;
}

const INVALID_JSON = Symbol('invalid-json');

/**
 * Un proxy o balanceador puede responder HTML o texto plano (p. ej. un 502): no debe convertirse
 * en un SyntaxError que la app no sabe interpretar.
 */
function parseJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return INVALID_JSON;
  }
}
