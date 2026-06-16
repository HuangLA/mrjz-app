import { validateProductionEnvironment } from "./env.js";
import { createServer } from "node:http";
import { startOpenDotaSyncScheduler, startSteamProfileSyncScheduler } from "./opendota/syncWorker.js";
import { createApiRouter, type HealthStatus } from "./server/apiRouter.js";

validateProductionEnvironment();

const serviceName = "mrjz-api";
const startedAt = Date.now();

export function getHealthStatus(now = new Date()): HealthStatus {
  return {
    ok: true,
    service: serviceName,
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round((now.getTime() - startedAt) / 1000),
  };
}

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
const router = createApiRouter(() => getHealthStatus());

const server = createServer((request, response) => {
  void router.handle(request, response);
});

server.listen(port, host, () => {
  console.log(`${serviceName} listening on ${host}:${port}`);
  startOpenDotaSyncScheduler();
  startSteamProfileSyncScheduler();
});
