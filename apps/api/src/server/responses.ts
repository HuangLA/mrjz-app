export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type RouteResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
};

export function json(status: number, body: unknown): RouteResult {
  return {
    status,
    body,
  };
}

export function ok<T>(data: T, status = 200): RouteResult {
  return json(status, {
    success: true,
    data,
  } satisfies ApiSuccess<T>);
}

export function fail(status: number, code: string, message: string): RouteResult {
  return json(status, {
    success: false,
    error: {
      code,
      message,
    },
  } satisfies ApiFailure);
}

export function binary(status: number, body: Buffer, headers: Record<string, string>): RouteResult {
  return {
    status,
    body,
    headers,
    raw: true,
  };
}
