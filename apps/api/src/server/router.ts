import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, type RouteResult } from "./responses.js";

export type RouteContext = {
  request: IncomingMessage;
  url: URL;
  params: Record<string, string>;
};

export type RouteHandler = (context: RouteContext) => RouteResult | Promise<RouteResult>;

type Route = {
  method: string;
  pattern: string;
  segments: string[];
  handler: RouteHandler;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

export class Router {
  private readonly routes: Route[] = [];

  get(pattern: string, handler: RouteHandler): void {
    this.addRoute("GET", pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): void {
    this.addRoute("POST", pattern, handler);
  }

  patch(pattern: string, handler: RouteHandler): void {
    this.addRoute("PATCH", pattern, handler);
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
      response.writeHead(204, JSON_HEADERS);
      response.end();
      return;
    }

    const url = parseRequestUrl(request);
    const route = this.match(request.method ?? "GET", url.pathname);

    if (route === null) {
      send(response, fail(404, "NOT_FOUND", "Route not found"));
      return;
    }

    try {
      const result = await route.route.handler({
        request,
        url,
        params: route.params,
      });
      send(response, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error";
      send(response, fail(500, "INTERNAL_SERVER_ERROR", message));
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

function send(response: ServerResponse, result: RouteResult): void {
  response.writeHead(result.status, JSON_HEADERS);
  response.end(JSON.stringify(result.body, null, 2));
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
