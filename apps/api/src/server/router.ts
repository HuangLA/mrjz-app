import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, type RouteResult } from "./responses.js";

export type RouteContext = {
  request: IncomingMessage;
  url: URL;
  params: Record<string, string>;
};

export type RouteHandler = (context: RouteContext) => RouteResult | Promise<RouteResult>;

export type RouteGuardContext = RouteContext & {
  method: string;
  pattern: string;
};

export type RouteGuard = (context: RouteGuardContext) => RouteResult | null | Promise<RouteResult | null>;

type Route = {
  method: string;
  pattern: string;
  segments: string[];
  handler: RouteHandler;
};

const BASE_HEADERS: Record<string, string> = {
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, x-mrjz-user-id",
  "access-control-max-age": "600",
  "x-content-type-options": "nosniff",
};

const allowedOrigins = parseAllowedOrigins();

export class Router {
  private readonly routes: Route[] = [];

  constructor(private readonly guard?: RouteGuard) {}

  get(pattern: string, handler: RouteHandler): void {
    this.addRoute("GET", pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): void {
    this.addRoute("POST", pattern, handler);
  }

  patch(pattern: string, handler: RouteHandler): void {
    this.addRoute("PATCH", pattern, handler);
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.addRoute("DELETE", pattern, handler);
  }

  private addRoute(method: string, pattern: string, handler: RouteHandler): void {
    this.routes.push({
      method,
      pattern: normalizePath(pattern),
      segments: splitPath(pattern),
      handler,
    });
  }

  patterns(): string[] {
    return this.routes.map((route) => `${route.method} ${route.pattern}`);
  }

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === "OPTIONS") {
      response.writeHead(204, headersForRequest(request));
      response.end();
      return;
    }

    const url = parseRequestUrl(request);
    const route = this.match(request.method ?? "GET", url.pathname);

    if (route === null) {
      send(request, response, fail(404, "NOT_FOUND", "Route not found"));
      return;
    }

    try {
      const guarded = await this.guard?.({
        request,
        url,
        params: route.params,
        method: route.route.method,
        pattern: route.route.pattern,
      });

      if (guarded !== undefined && guarded !== null) {
        send(request, response, guarded);
        return;
      }

      const result = await route.route.handler({
        request,
        url,
        params: route.params,
      });
      send(request, response, result);
    } catch (error) {
      console.error("Unhandled API error", error);
      const message =
        process.env.NODE_ENV === "production"
          ? "Unexpected server error"
          : error instanceof Error
            ? error.message
            : "Unexpected server error";
      send(request, response, fail(500, "INTERNAL_SERVER_ERROR", message));
    }
  }

  private match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    const normalizedPath = normalizePath(pathname);
    const pathSegments = splitPath(normalizedPath);

    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== pathSegments.length) {
        continue;
      }

      const params: Record<string, string> = {};
      let matched = true;

      for (let index = 0; index < route.segments.length; index += 1) {
        const routeSegment = route.segments[index];
        const pathSegment = pathSegments[index];

        if (routeSegment === undefined || pathSegment === undefined) {
          matched = false;
          break;
        }

        if (routeSegment.startsWith(":")) {
          params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
          continue;
        }

        if (routeSegment !== pathSegment) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return {
          route,
          params,
        };
      }
    }

    return null;
  }
}

function send(request: IncomingMessage, response: ServerResponse, result: RouteResult): void {
  if (result.raw === true) {
    response.writeHead(result.status, {
      ...headersForRequest(request),
      ...result.headers,
    });
    response.end(result.body);
    return;
  }

  response.writeHead(result.status, {
    ...headersForRequest(request),
    "content-type": "application/json; charset=utf-8",
    ...result.headers,
  });
  response.end(JSON.stringify(result.body, null, 2));
}

function headersForRequest(request: IncomingMessage): Record<string, string> {
  const headers = { ...BASE_HEADERS };
  const origin = headerValue(request.headers.origin);
  const allowedOrigin = resolveAllowedOrigin(origin);

  if (allowedOrigin !== undefined) {
    headers["access-control-allow-origin"] = allowedOrigin;
    headers.vary = "Origin";
  }

  return headers;
}

function resolveAllowedOrigin(origin: string | undefined): string | undefined {
  if (allowedOrigins.allowAll) {
    return "*";
  }

  if (origin !== undefined && allowedOrigins.exact.has(origin)) {
    return origin;
  }

  return undefined;
}

function parseAllowedOrigins(): { allowAll: boolean; exact: Set<string> } {
  const configuredOrigins = (process.env.MRJZ_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowDevelopmentWildcard = configuredOrigins.length === 0 && process.env.NODE_ENV !== "production";
  const allowConfiguredWildcard = configuredOrigins.includes("*") && process.env.NODE_ENV !== "production";

  return {
    allowAll: allowDevelopmentWildcard || allowConfiguredWildcard,
    exact: new Set(configuredOrigins.filter((origin) => origin !== "*")),
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;

  return typeof first === "string" && first.trim().length > 0 ? first.trim() : undefined;
}

function parseRequestUrl(request: IncomingMessage): URL {
  const host = request.headers.host ?? "localhost";
  return new URL(request.url ?? "/", `http://${host}`);
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

function splitPath(pathname: string): string[] {
  return normalizePath(pathname).split("/").filter(Boolean);
}
