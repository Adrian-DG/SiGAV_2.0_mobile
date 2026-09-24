const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5282/api';

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

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  token?: string | null;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_URL.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, token } = options;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.message ?? `La solicitud falló con estado ${response.status}.`;
    throw new ApiError(response.status, message, data?.errors ?? null);
  }

  return data as T;
}
