import { createServer } from "node:http";
import { serviceNames } from "@mrjz/shared";

export type HealthStatus = {
  ok: true;
  service: string;
  timestamp: string;
};

export function getHealthStatus(now = new Date()): HealthStatus {
  return {
    ok: true,
    service: serviceNames.api,
    timestamp: now.toISOString(),
  };
}

const port = Number(process.env.API_PORT ?? 3001);

const server = createServer((request, response) => {
  if (request.url === "/health" || request.url === "/api/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(getHealthStatus()));
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ success: false, error: { code: "NOT_FOUND" } }));
});

server.listen(port, () => {
  console.log(`${serviceNames.api} listening on :${port}`);
});
