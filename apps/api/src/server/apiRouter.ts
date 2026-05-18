import {
  advanceBracketNode,
  addStageGroupTeam,
  createKnockoutBracket,
  createRound,
  createSeries,
  createStage,
  createStageGroup,
  createSyncTask,
  createTeam,
  createPlayer,
  createTournament,
  clearTournamentMatchRecords,
  confirmSwissRound,
  deleteSeries,
  deleteStageGroup,
  getMatchDetail,
  getOfficialScheduleManagement,
  getOfficialSchedulePublicStatus,
  getStageBracket,
  listStageGroups,
  getStageRounds,
  getStageStandings,
  generateGroupRoundRobin,
  generateSwissPairings,
  getTournamentPlayerDetail,
  getTournamentTeamDetail,
  getTournamentDetail,
  linkOpenDotaMatchToSeries,
  listLeagueSyncTargets,
  listTournamentOpenDotaMatches,
  listTournamentPlayers,
  listTournamentTeams,
  listLeagues,
  listSyncTasks,
  listTournaments,
  lockOfficialScheduleRoster,
  randomizeStageGroups,
  addTeamMember,
  backfillCachedTournamentEntities,
  removeTeamMember,
  removeStageGroupTeam,
  retractSwissRound,
  setBracketNodeSlot,
  updateTeam,
  updateTournamentLifecycle,
  updateSeries,
  updateSeriesGameResult,
  updateSeriesResult,
  updateStageGroup,
  updateStageManualRanks,
  publishOfficialSchedule,
  unlockOfficialScheduleRoster,
  updateOfficialScheduleConfig,
  withdrawOfficialSchedule,
} from "../data/repository.js";
import { resolvePlayerProfileBySteamId } from "../opendota/playerProfiles.js";
import { runOpenDotaBackfillSync } from "../opendota/syncWorker.js";
import { readSteamAvatarCache } from "../opendota/steamAvatarCache.js";
import { readJsonBody } from "./body.js";
import { binary, json, ok, fail } from "./responses.js";
import { Router } from "./router.js";

export type HealthStatus = {
  ok: true;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  prototype: {
    runtime: "node:http";
    dataSource: "sqlite";
    databasePath: string;
    externalDependencies: false;
  };
  routes: string[];
};

export function createApiRouter(getHealthStatus: () => HealthStatus): Router {
  const router = new Router();

  router.get("/health", () => json(200, getHealthStatus()));
  router.get("/api/health", () => json(200, getHealthStatus()));

  router.get("/api/assets/steam-avatars/:filename", async ({ params }) => {
    const accountId = Number((params.filename ?? "").replace(/\.jpg$/i, ""));
    const avatar = await readSteamAvatarCache(accountId);

    if (avatar === null) {
      return fail(404, "STEAM_AVATAR_NOT_FOUND", "Steam avatar cache not found");
    }

    return binary(200, avatar.bytes, {
      "content-type": avatar.contentType,
      "cache-control": "public, max-age=3600",
    });
  });

  router.get("/api/tournaments", () => ok(listTournaments()));

  router.post("/api/tournaments", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createTournament(bodyToCreateTournamentInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/leagues", () => ok(listLeagues()));

  router.get("/api/sync-tasks", () => ok(listSyncTasks()));

  router.get("/api/tournaments/:id", ({ params }) => {
    const tournament = getTournamentDetail(params.id ?? "");

    if (tournament === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(tournament);
  });

  router.get("/api/tournaments/:id/matches", ({ params, url }) => {
    const limit = positiveIntegerQuery(url, "limit", 100);
    const matches = listTournamentOpenDotaMatches(params.id ?? "", limit);

    if (matches === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(matches);
  });

  router.delete("/api/tournaments/:id/match-records", ({ params }) => {
    try {
      return ok(clearTournamentMatchRecords(params.id ?? ""));
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/tournaments/:id/teams", ({ params }) => {
    const teams = listTournamentTeams(params.id ?? "");

    if (teams === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(teams);
  });

  router.get("/api/tournaments/:id/players", ({ params }) => {
    const players = listTournamentPlayers(params.id ?? "");

    if (players === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(players);
  });

  router.get("/api/tournaments/:id/players/:playerId", ({ params }) => {
    const player = getTournamentPlayerDetail(params.id ?? "", params.playerId ?? "");

    if (player === undefined) {
      return fail(404, "PLAYER_NOT_FOUND", "Player not found for this tournament");
    }

    return ok(player);
  });

  router.post("/api/tournaments/:id/entities/backfill", ({ params }) => {
    return ok(backfillCachedTournamentEntities(params.id ?? ""));
  });

  router.get("/api/tournaments/:id/teams/:teamId", ({ params }) => {
    const team = getTournamentTeamDetail(params.id ?? "", params.teamId ?? "");

    if (team === undefined) {
      return fail(404, "TEAM_NOT_FOUND", "Team not found for this tournament");
    }

    return ok(team);
  });

  router.get("/api/tournaments/:id/official-schedule", ({ params }) => {
    const schedule = getOfficialSchedulePublicStatus(params.id ?? "");

    if (schedule === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(schedule);
  });

  router.get("/api/tournaments/:id/schedule-management", ({ params }) => {
    const management = getOfficialScheduleManagement(params.id ?? "");

    if (management === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(management);
  });

  router.patch("/api/tournaments/:id/schedule-management", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateOfficialScheduleConfig(params.id ?? "", bodyToOfficialScheduleConfigInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/schedule-management/lock-roster", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(lockOfficialScheduleRoster(params.id ?? "", bodyToLockOfficialScheduleRosterInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/schedule-management/unlock-roster", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      return ok(unlockOfficialScheduleRoster(params.id ?? "", optionalStringField(body, "actor") ?? "admin"));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/schedule-management/publish", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      return ok(publishOfficialSchedule(params.id ?? "", optionalStringField(body, "actor") ?? "admin"));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/schedule-management/withdraw", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      return ok(withdrawOfficialSchedule(params.id ?? "", optionalStringField(body, "actor") ?? "admin"));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/knockout-bracket", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createKnockoutBracket(params.id ?? "", bodyToCreateKnockoutBracketInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/opendota-matches/:matchId/link-series", async ({ request, params }) => {
    try {
      const matchId = Number(params.matchId);

      if (!Number.isSafeInteger(matchId) || matchId <= 0) {
        return fail(400, "VALIDATION_ERROR", "matchId must be a positive integer");
      }

      const body = await readJsonBody(request);

      return ok(linkOpenDotaMatchToSeries(params.id ?? "", matchId, bodyToLinkOpenDotaMatchInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/sync-opendota", async ({ params, url }) => {
    const tournamentId = params.id ?? "";
    const targets = listLeagueSyncTargets().filter(
      (target) => target.tournamentId === tournamentId || target.league.id === tournamentId,
    );

    if (targets.length === 0) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(
      await runOpenDotaBackfillSync({
        targets,
        matchLimit: positiveIntegerQuery(url, "limit", 1000),
      }),
    );
  });

  router.patch("/api/tournaments/:id/lifecycle", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateTournamentLifecycle(params.id ?? "", bodyToUpdateTournamentLifecycleInput(body)));
    } catch (error) {
      return validationError(error);
    }
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

  router.get("/api/stages/:stageId/groups", ({ params }) => {
    const groups = listStageGroups(params.stageId ?? "");

    if (groups === undefined) {
      return fail(404, "STAGE_NOT_FOUND", "Stage groups not found");
    }

    return ok(groups);
  });

  router.post("/api/stages/:stageId/groups/randomize", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(randomizeStageGroups(params.stageId ?? "", bodyToRandomizeStageGroupsInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/stages/:stageId/group-round-robin", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(generateGroupRoundRobin(params.stageId ?? "", bodyToGenerateGroupRoundRobinInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/stages/:stageId/manual-ranks", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateStageManualRanks(params.stageId ?? "", bodyToUpdateStageManualRanksInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/stages/:stageId/swiss-pairings", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(generateSwissPairings(params.stageId ?? "", bodyToGenerateSwissPairingsInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/rounds/:roundId/confirm-swiss", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      const actor = optionalStringField(body, "actor");
      return ok(confirmSwissRound(params.roundId ?? "", actor === undefined ? {} : { actor }));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/rounds/:roundId/retract-swiss", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      const actor = optionalStringField(body, "actor");
      return ok(retractSwissRound(params.roundId ?? "", actor === undefined ? {} : { actor }));
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/matches/:matchId", ({ params }) => {
    const match = getMatchDetail(params.matchId ?? "");

    if (match === undefined) {
      return fail(404, "MATCH_NOT_FOUND", "Match not found");
    }

    return ok(match);
  });

  router.post("/api/teams", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createTeam(bodyToCreateTeamInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/teams/:teamId", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateTeam(params.teamId ?? "", bodyToUpdateTeamInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/players", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createPlayer(bodyToCreatePlayerInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/teams/:teamId/members", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      const input = await resolveTeamMemberProfile(bodyToAddTeamMemberInput(params.teamId ?? "", body));
      return ok(addTeamMember(input), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/teams/:teamId/members/:playerId", ({ params }) => {
    try {
      return ok(removeTeamMember({ teamId: params.teamId ?? "", playerId: params.playerId ?? "" }));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/stages", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createStage(bodyToCreateStageInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/stages/:stageId/groups", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createStageGroup(bodyToCreateStageGroupInput(params.stageId ?? "", body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/stage-groups/:groupId", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateStageGroup(params.groupId ?? "", bodyToUpdateStageGroupInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/stage-groups/:groupId", ({ params }) => {
    try {
      return ok(deleteStageGroup(params.groupId ?? ""));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/stage-groups/:groupId/teams", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(addStageGroupTeam(bodyToAddStageGroupTeamInput(params.groupId ?? "", body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/stage-groups/:groupId/teams/:teamId", ({ params }) => {
    try {
      return ok(removeStageGroupTeam(params.groupId ?? "", params.teamId ?? ""));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/rounds", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createRound(bodyToCreateRoundInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/series", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createSeries(bodyToCreateSeriesInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/series/:seriesId", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateSeries(params.seriesId ?? "", bodyToUpdateSeriesInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/series/:seriesId/result", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateSeriesResult(params.seriesId ?? "", bodyToUpdateSeriesResultInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/series/:seriesId", ({ params }) => {
    try {
      return ok(deleteSeries(params.seriesId ?? ""));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/series/:seriesId/games/:gameIndex/result", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      const gameIndex = Number(params.gameIndex);

      if (!Number.isSafeInteger(gameIndex) || gameIndex <= 0) {
        return fail(400, "VALIDATION_ERROR", "gameIndex must be a positive integer");
      }

      return ok(updateSeriesGameResult(params.seriesId ?? "", gameIndex, bodyToUpdateGameResultInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/bracket-nodes/:nodeId/winner", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(advanceBracketNode(params.nodeId ?? "", bodyToAdvanceBracketNodeInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/bracket-nodes/:nodeId/slot", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(setBracketNodeSlot(params.nodeId ?? "", bodyToSetBracketNodeSlotInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/sync-tasks", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createSyncTask(bodyToCreateSyncTaskInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  return router;
}

function bodyToCreateTeamInput(body: Record<string, unknown>) {
  return withoutUndefined({
    name: stringField(body, "name"),
    shortName: optionalStringField(body, "shortName"),
    logoUrl: optionalStringOrNullField(body, "logoUrl"),
    color: optionalStringField(body, "color"),
    opendotaTeamId: optionalNumberOrNullField(body, "opendotaTeamId"),
    tournamentId: optionalStringField(body, "tournamentId"),
  }) as Parameters<typeof createTeam>[0];
}

function bodyToCreateKnockoutBracketInput(body: Record<string, unknown>) {
  const bracketType = optionalStringField(body, "bracketType") ?? "single_elimination";

  if (!["single_elimination", "double_elimination"].includes(bracketType)) {
    throw new Error("bracketType must be single_elimination or double_elimination");
  }

  const boType = optionalStringField(body, "boType") ?? "BO3";

  if (!["BO1", "BO2", "BO3", "BO5"].includes(boType)) {
    throw new Error("boType must be BO1, BO2, BO3, or BO5");
  }

  return withoutUndefined({
    name: optionalStringField(body, "name"),
    bracketType: bracketType as "single_elimination" | "double_elimination",
    bracketSize: optionalNumberField(body, "bracketSize"),
    winnerTeamCount: optionalNumberField(body, "winnerTeamCount"),
    loserTeamCount: optionalNumberField(body, "loserTeamCount"),
    boType: boType as "BO1" | "BO2" | "BO3" | "BO5",
    scheduledAt: optionalStringField(body, "scheduledAt"),
    teamIds: stringArrayField(body, "teamIds"),
  }) as Parameters<typeof createKnockoutBracket>[1];
}

function bodyToOfficialScheduleConfigInput(body: Record<string, unknown>) {
  const preliminaryType = optionalStringOrNullField(body, "preliminaryType");
  const knockoutType = optionalStringOrNullField(body, "knockoutType");

  if (preliminaryType !== undefined && preliminaryType !== null && !["group", "swiss"].includes(preliminaryType)) {
    throw new Error("preliminaryType must be group or swiss");
  }

  if (
    knockoutType !== undefined &&
    knockoutType !== null &&
    !["single_elimination", "double_elimination"].includes(knockoutType)
  ) {
    throw new Error("knockoutType must be single_elimination or double_elimination");
  }

  return withoutUndefined({
    preliminaryType: preliminaryType as "group" | "swiss" | null | undefined,
    knockoutType: knockoutType as "single_elimination" | "double_elimination" | null | undefined,
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof updateOfficialScheduleConfig>[1];
}

function bodyToLockOfficialScheduleRosterInput(body: Record<string, unknown>) {
  return withoutUndefined({
    teamIds: stringArrayField(body, "teamIds"),
    seededTeamIds: optionalStringArrayField(body, "seededTeamIds"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof lockOfficialScheduleRoster>[1];
}

function bodyToAdvanceBracketNodeInput(body: Record<string, unknown>) {
  return {
    winnerTeamId: stringField(body, "winnerTeamId"),
  } satisfies Parameters<typeof advanceBracketNode>[1];
}

function bodyToSetBracketNodeSlotInput(body: Record<string, unknown>) {
  const slot = stringField(body, "slot");

  if (slot !== "radiant" && slot !== "dire") {
    throw new Error("slot must be radiant or dire");
  }

  return withoutUndefined({
    slot,
    teamId: optionalStringOrNullField(body, "teamId"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof setBracketNodeSlot>[1];
}

function bodyToCreateStageGroupInput(stageId: string, body: Record<string, unknown>) {
  return withoutUndefined({
    stageId,
    name: stringField(body, "name"),
    sortOrder: optionalNumberField(body, "sortOrder"),
  }) as Parameters<typeof createStageGroup>[0];
}

function bodyToRandomizeStageGroupsInput(body: Record<string, unknown>) {
  return withoutUndefined({
    groupCount: optionalNumberField(body, "groupCount"),
    groupSize: optionalNumberField(body, "groupSize"),
    seededTeamIds: optionalStringArrayField(body, "seededTeamIds"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof randomizeStageGroups>[1];
}

function bodyToGenerateGroupRoundRobinInput(body: Record<string, unknown>) {
  const boType = optionalStringField(body, "boType");

  if (boType !== undefined && !["BO1", "BO2", "BO3", "BO5"].includes(boType)) {
    throw new Error("boType must be BO1, BO2, BO3, or BO5");
  }

  return withoutUndefined({
    boType: boType as Parameters<typeof generateGroupRoundRobin>[1]["boType"],
    replaceExisting: optionalBooleanField(body, "replaceExisting"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof generateGroupRoundRobin>[1];
}

function bodyToUpdateStageManualRanksInput(body: Record<string, unknown>) {
  const ranks = body.ranks;

  if (!Array.isArray(ranks)) {
    throw new Error("ranks must be an array");
  }

  return {
    ranks: ranks.map((rank) => {
      if (rank === null || typeof rank !== "object" || Array.isArray(rank)) {
        throw new Error("rank item must be an object");
      }

      return {
        teamId: stringField(rank as Record<string, unknown>, "teamId"),
        manualRank: optionalNumberOrNullField(rank as Record<string, unknown>, "manualRank") ?? null,
      };
    }),
    actor: optionalStringField(body, "actor"),
  } as Parameters<typeof updateStageManualRanks>[1];
}

function bodyToGenerateSwissPairingsInput(body: Record<string, unknown>) {
  const boType = optionalStringField(body, "boType");

  if (boType !== undefined && !["BO1", "BO2", "BO3", "BO5"].includes(boType)) {
    throw new Error("boType must be BO1, BO2, BO3, or BO5");
  }

  return withoutUndefined({
    roundNumber: optionalNumberField(body, "roundNumber"),
    boType: boType as Parameters<typeof generateSwissPairings>[1]["boType"],
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof generateSwissPairings>[1];
}

function bodyToUpdateStageGroupInput(body: Record<string, unknown>) {
  return withoutUndefined({
    name: optionalStringField(body, "name"),
    sortOrder: optionalNumberField(body, "sortOrder"),
  }) as Parameters<typeof updateStageGroup>[1];
}

function bodyToAddStageGroupTeamInput(groupId: string, body: Record<string, unknown>) {
  return withoutUndefined({
    groupId,
    teamId: stringField(body, "teamId"),
    seed: optionalNumberOrNullField(body, "seed"),
  }) as Parameters<typeof addStageGroupTeam>[0];
}

async function resolveTeamMemberProfile(input: Parameters<typeof addTeamMember>[0]): Promise<Parameters<typeof addTeamMember>[0]> {
  if (input.playerId !== undefined) {
    return input;
  }

  const rawSteamId = input.steamId ?? (input.accountId === undefined || input.accountId === null ? undefined : String(input.accountId));

  if (rawSteamId === undefined) {
    return input;
  }

  const profile = await resolvePlayerProfileBySteamId(rawSteamId);

  return withoutUndefined({
    ...input,
    accountId: profile.accountId,
    steamId64: profile.steamId64,
    displayName: input.displayName ?? profile.displayName,
    avatarUrl: input.avatarUrl ?? profile.avatarUrl,
  });
}

function bodyToUpdateTeamInput(body: Record<string, unknown>) {
  return withoutUndefined({
    name: optionalStringField(body, "name"),
    shortName: optionalStringField(body, "shortName"),
    logoUrl: optionalStringOrNullField(body, "logoUrl"),
    color: optionalStringOrNullField(body, "color"),
    opendotaTeamId: optionalNumberOrNullField(body, "opendotaTeamId"),
  }) as Parameters<typeof updateTeam>[1];
}

function bodyToCreateTournamentInput(body: Record<string, unknown>) {
  const status = optionalStringField(body, "status");

  if (status !== undefined && !["draft", "upcoming", "running", "completed", "archived"].includes(status)) {
    throw new Error("status must be draft, upcoming, running, completed, or archived");
  }

  return withoutUndefined({
    name: stringField(body, "name"),
    seasonName: optionalStringField(body, "seasonName"),
    opendotaLeagueId: numberField(body, "opendotaLeagueId"),
    startsAt: optionalStringField(body, "startsAt"),
    status,
  }) as Parameters<typeof createTournament>[0];
}

function bodyToCreatePlayerInput(body: Record<string, unknown>) {
  return withoutUndefined({
    displayName: stringField(body, "displayName"),
    accountId: optionalNumberOrNullField(body, "accountId"),
    steamId64: optionalStringOrNullField(body, "steamId64"),
    currentTeamId: optionalStringOrNullField(body, "currentTeamId"),
    avatarUrl: optionalStringOrNullField(body, "avatarUrl"),
  }) as Parameters<typeof createPlayer>[0];
}

function bodyToAddTeamMemberInput(teamId: string, body: Record<string, unknown>) {
  return withoutUndefined({
    teamId,
    playerId: optionalStringField(body, "playerId"),
    steamId: optionalStringField(body, "steamId"),
    accountId: optionalNumberOrNullField(body, "accountId"),
    displayName: optionalStringOrNullField(body, "displayName"),
    avatarUrl: optionalStringOrNullField(body, "avatarUrl"),
    role: optionalStringField(body, "role"),
  }) as Parameters<typeof addTeamMember>[0];
}

function bodyToLinkOpenDotaMatchInput(body: Record<string, unknown>) {
  const boType = optionalStringField(body, "boType");

  if (boType !== undefined && !["BO1", "BO2", "BO3", "BO5"].includes(boType)) {
    throw new Error("boType must be BO1, BO2, BO3, or BO5");
  }

  return withoutUndefined({
    stageId: optionalStringField(body, "stageId"),
    roundId: optionalStringField(body, "roundId"),
    roundName: optionalStringField(body, "roundName"),
    boType,
    scheduledAt: optionalStringField(body, "scheduledAt"),
    radiantTeamId: stringField(body, "radiantTeamId"),
    direTeamId: stringField(body, "direTeamId"),
  }) as Parameters<typeof linkOpenDotaMatchToSeries>[2];
}

function bodyToCreateStageInput(body: Record<string, unknown>) {
  const type = stringField(body, "type");

  if (!["group", "swiss", "knockout"].includes(type)) {
    throw new Error("type must be group, swiss, or knockout");
  }

  return withoutUndefined({
    tournamentId: stringField(body, "tournamentId"),
    type: type as "group" | "swiss" | "knockout",
    name: stringField(body, "name"),
    advancementRule: optionalStringField(body, "advancementRule"),
    sortOrder: optionalNumberField(body, "sortOrder"),
    config: optionalObjectField(body, "config"),
  }) as Parameters<typeof createStage>[0];
}

function bodyToUpdateTournamentLifecycleInput(body: Record<string, unknown>) {
  const status = stringField(body, "status");

  if (!["draft", "upcoming", "running", "completed", "archived"].includes(status)) {
    throw new Error("status must be draft, upcoming, running, completed, or archived");
  }

  return withoutUndefined({
    status: status as Parameters<typeof updateTournamentLifecycle>[1]["status"],
    startsAt: optionalStringOrNullField(body, "startsAt"),
    endsAt: optionalStringOrNullField(body, "endsAt"),
  }) as Parameters<typeof updateTournamentLifecycle>[1];
}

function bodyToCreateRoundInput(body: Record<string, unknown>) {
  const status = optionalStringField(body, "status");
  const pairingStatus = optionalStringField(body, "pairingStatus");

  if (status !== undefined && !["draft", "published", "running", "completed", "locked"].includes(status)) {
    throw new Error("status must be draft, published, running, completed, or locked");
  }

  if (pairingStatus !== undefined && !["draft", "published", "confirmed"].includes(pairingStatus)) {
    throw new Error("pairingStatus must be draft, published, or confirmed");
  }

  return withoutUndefined({
    stageId: stringField(body, "stageId"),
    name: stringField(body, "name"),
    roundNumber: optionalNumberField(body, "roundNumber"),
    status: status as Parameters<typeof createRound>[0]["status"],
    pairingStatus: pairingStatus as Parameters<typeof createRound>[0]["pairingStatus"],
  }) as Parameters<typeof createRound>[0];
}

function bodyToCreateSeriesInput(body: Record<string, unknown>) {
  const boType = stringField(body, "boType");
  const status = optionalStringField(body, "status");
  const seriesKind = optionalStringField(body, "seriesKind");

  if (!["BO1", "BO2", "BO3", "BO5"].includes(boType)) {
    throw new Error("boType must be BO1, BO2, BO3, or BO5");
  }

  if (seriesKind !== undefined && !["regular", "tiebreaker"].includes(seriesKind)) {
    throw new Error("seriesKind must be regular or tiebreaker");
  }

  if (
    status !== undefined &&
    !["draft", "scheduled", "live", "result_pending", "completed", "conflict", "postponed"].includes(status)
  ) {
    throw new Error("status must be a valid series status");
  }

  return withoutUndefined({
    stageId: stringField(body, "stageId"),
    roundId: stringField(body, "roundId"),
    groupId: optionalStringOrNullField(body, "groupId"),
    seriesKind: seriesKind as Parameters<typeof createSeries>[0]["seriesKind"],
    boType: boType as "BO1" | "BO2" | "BO3" | "BO5",
    status: status as Parameters<typeof createSeries>[0]["status"],
    scheduledAt: optionalStringField(body, "scheduledAt"),
    radiantTeamId: stringField(body, "radiantTeamId"),
    direTeamId: stringField(body, "direTeamId"),
  }) as Parameters<typeof createSeries>[0];
}

function bodyToUpdateSeriesInput(body: Record<string, unknown>) {
  const boType = optionalStringField(body, "boType");
  const status = optionalStringField(body, "status");
  const seriesKind = optionalStringField(body, "seriesKind");

  if (boType !== undefined && !["BO1", "BO2", "BO3", "BO5"].includes(boType)) {
    throw new Error("boType must be BO1, BO2, BO3, or BO5");
  }

  if (seriesKind !== undefined && !["regular", "tiebreaker"].includes(seriesKind)) {
    throw new Error("seriesKind must be regular or tiebreaker");
  }

  if (
    status !== undefined &&
    !["draft", "scheduled", "live", "result_pending", "completed", "conflict", "postponed"].includes(status)
  ) {
    throw new Error("status must be a valid series status");
  }

  return withoutUndefined({
    roundId: optionalStringField(body, "roundId"),
    groupId: optionalStringOrNullField(body, "groupId"),
    seriesKind: seriesKind as Parameters<typeof updateSeries>[1]["seriesKind"],
    boType: boType as Parameters<typeof updateSeries>[1]["boType"],
    status: status as Parameters<typeof updateSeries>[1]["status"],
    scheduledAt: optionalStringOrNullField(body, "scheduledAt"),
    radiantTeamId: optionalStringField(body, "radiantTeamId"),
    direTeamId: optionalStringField(body, "direTeamId"),
  }) as Parameters<typeof updateSeries>[1];
}

function bodyToUpdateSeriesResultInput(body: Record<string, unknown>) {
  return {
    radiantScore: nonNegativeIntegerField(body, "radiantScore"),
    direScore: nonNegativeIntegerField(body, "direScore"),
  } satisfies Parameters<typeof updateSeriesResult>[1];
}

function bodyToUpdateGameResultInput(body: Record<string, unknown>) {
  return withoutUndefined({
    matchId: optionalNumberOrNullField(body, "matchId"),
    radiantScore: optionalNumberOrNullField(body, "radiantScore"),
    direScore: optionalNumberOrNullField(body, "direScore"),
    winnerTeamId: optionalStringOrNullField(body, "winnerTeamId"),
  }) as Parameters<typeof updateSeriesGameResult>[2];
}

function bodyToCreateSyncTaskInput(body: Record<string, unknown>) {
  const kind = stringField(body, "kind");

  if (!["discover_match", "request_parse", "refresh_match", "schedule_link"].includes(kind)) {
    throw new Error("kind must be discover_match, request_parse, refresh_match, or schedule_link");
  }

  const payload = body.payload;

  return withoutUndefined({
    kind: kind as "discover_match" | "request_parse" | "refresh_match" | "schedule_link",
    leagueId: optionalNumberOrNullField(body, "leagueId"),
    targetType: optionalStringOrNullField(body, "targetType"),
    targetId: optionalStringOrNullField(body, "targetId"),
    payload:
      payload !== undefined && payload !== null && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
  }) as Parameters<typeof createSyncTask>[0];
}

function stringField(body: Record<string, unknown>, fieldName: string): string {
  const value = body[fieldName];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function optionalStringField(body: Record<string, unknown>, fieldName: string): string | undefined {
  const value = body[fieldName];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArrayField(body: Record<string, unknown>, fieldName: string): string[] {
  const value = body[fieldName];

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.flatMap((item) => (typeof item === "string" && item.trim().length > 0 ? [item.trim()] : []));
}

function optionalStringArrayField(body: Record<string, unknown>, fieldName: string): string[] | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  return stringArrayField(body, fieldName);
}

function optionalStringOrNullField(body: Record<string, unknown>, fieldName: string): string | null | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  const value = body[fieldName];

  if (value === null) {
    return null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumberField(body: Record<string, unknown>, fieldName: string): number | undefined {
  const value = body[fieldName];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalNumberOrNullField(body: Record<string, unknown>, fieldName: string): number | null | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  const value = body[fieldName];

  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBooleanField(body: Record<string, unknown>, fieldName: string): boolean | undefined {
  const value = body[fieldName];

  return typeof value === "boolean" ? value : undefined;
}

function optionalObjectField(body: Record<string, unknown>, fieldName: string): Record<string, unknown> | undefined {
  const value = body[fieldName];

  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function numberField(body: Record<string, unknown>, fieldName: string): number {
  const value = body[fieldName];

  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return value;
}

function nonNegativeIntegerField(body: Record<string, unknown>, fieldName: string): number {
  const value = numberField(body, fieldName);

  if (value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return value;
}

function validationError(error: unknown) {
  return fail(400, "VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid request body");
}

function positiveIntegerQuery(url: URL, fieldName: string, fallback: number): number {
  const value = Number(url.searchParams.get(fieldName));

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
