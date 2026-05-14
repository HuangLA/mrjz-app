import { createServer } from "node:http";
import { getRepositoryInfo } from "./data/repository.js";
import { startOpenDotaSyncScheduler } from "./opendota/syncWorker.js";
import { createApiRouter, type HealthStatus } from "./server/apiRouter.js";

const serviceName = "mrjz-api";
const startedAt = Date.now();

export function getHealthStatus(now = new Date()): HealthStatus {
  const repositoryInfo = getRepositoryInfo();

  return {
    ok: true,
    service: serviceName,
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round((now.getTime() - startedAt) / 1000),
    prototype: {
      runtime: "node:http",
      dataSource: repositoryInfo.dataSource,
      databasePath: repositoryInfo.databasePath,
      externalDependencies: false,
    },
    routes: router.patterns(),
  };
}

const port = Number(process.env.API_PORT ?? 3001);
const router = createApiRouter(() => getHealthStatus());

const server = createServer((request, response) => {
  void router.handle(request, response);
});

server.listen(port, () => {
  console.log(`${serviceName} listening on :${port}`);
  startOpenDotaSyncScheduler();
});
