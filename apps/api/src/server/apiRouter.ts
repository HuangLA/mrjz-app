import {
  getMatchDetail,
  getStageBracket,
  getStageRounds,
  getStageStandings,
  getTournamentDetail,
  listTournaments,
} from "../data/repository.js";
import { json, ok, fail } from "./responses.js";
import { Router } from "./router.js";

export type HealthStatus = {
  ok: true;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  prototype: {
    runtime: "node:http";
    dataSource: "mock";
    externalDependencies: false;
  };
  routes: string[];
};

export function createApiRouter(getHealthStatus: () => HealthStatus): Router {
  const router = new Router();

  router.get("/health", () => json(200, getHealthStatus()));
  router.get("/api/health", () => json(200, getHealthStatus()));

  router.get("/api/tournaments", () => ok(listTournaments()));

  router.get("/api/tournaments/:id", ({ params }) => {
    const tournament = getTournamentDetail(params.id ?? "");

    if (tournament === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(tournament);
  });

  router.get("/api/stages/:stageId/standings", ({ params }) => {
    const standings = getStageStandings(params.stageId ?? "");

    if (standings === undefined) {
      return fail(404, "STAGE_NOT_FOUND", "Stage standings not found");
    }

    return ok(standings);
  });

  router.get("/api/stages/:stageId/rounds", ({ params }) => {
    const rounds = getStageRounds(params.stageId ?? "");

    if (rounds === undefined) {
      return fail(404, "STAGE_NOT_FOUND", "Stage rounds not found");
    }

    return ok(rounds);
  });

  router.get("/api/stages/:stageId/bracket", ({ params }) => {
    const bracket = getStageBracket(params.stageId ?? "");

    if (bracket === undefined) {
      return fail(404, "STAGE_NOT_FOUND", "Stage bracket not found");
    }

    return ok(bracket);
  });

  router.get("/api/matches/:matchId", ({ params }) => {
    const match = getMatchDetail(params.matchId ?? "");

    if (match === undefined) {
      return fail(404, "MATCH_NOT_FOUND", "Match not found");
    }

    return ok(match);
  });

  return router;
}
