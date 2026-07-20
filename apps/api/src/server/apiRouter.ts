import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  advanceBracketNode,
  addStageGroupTeam,
  adjustPlayerTagLikes,
  bindAppUserDotaAccount,
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
  clearTournamentScheduleRecords,
  confirmSwissRound,
  createAcknowledgement,
  createAdminPlayerTag,
  createUserSession,
  deletePlayerTag,
  deleteAcknowledgement,
  deleteSeries,
  deleteStageGroup,
  getMatchDetail,
  getAppUserMe,
  getAppUserStats,
  getOfficialScheduleManagement,
  getOfficialSchedulePublicStatus,
  getPlayerAvatarUrlByAccountId,
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
  likePlayerTag,
  listAdminTagPlayers,
  listAdminTags,
  listAcknowledgements,
  listLeagueSyncTargets,
  listPlayerTags,
  listTournamentHeroLeaderboards,
  listTournamentOpenDotaMatches,
  listTournamentPlayers,
  listTournamentTeams,
  listLeagues,
  listSyncTasks,
  listTournaments,
  lockOfficialScheduleRoster,
  loginAdmin,
  randomizeStageGroups,
  addTeamMember,
  backfillCachedTournamentEntities,
  recordAdminAudit,
  removeTeamMember,
  removeStageGroupTeam,
  resolveAdminBySessionToken,
  resolveAppUserBySessionToken,
  retractBracketNode,
  retractSwissRound,
  revokeAdminSession,
  revokeUserSession,
  setBracketNodeSlot,
  submitPlayerTag,
  unlikePlayerTag,
  upsertAppUser,
  updateTeam,
  updateAcknowledgement,
  updateTournamentLifecycle,
  updatePlayerTagReview,
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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabasePath } from "../db/client.js";
import { resolvePlayerProfileBySteamId } from "../opendota/playerProfiles.js";
import { runOpenDotaBackfillSync } from "../opendota/syncWorker.js";
import { cacheSteamAvatar, readSteamAvatarCache } from "../opendota/steamAvatarCache.js";
import { readJsonBody } from "./body.js";
import { cached, invalidateReadCache } from "./readCache.js";
import { binary, json, ok, fail } from "./responses.js";
import { Router, type RouteGuardContext } from "./router.js";

const READ_CACHE_TTL = {
  overview: 20_000,
  tournamentList: 30_000,
  tournamentDetail: 30_000,
  matches: 20_000,
  teams: 60_000,
  players: 60_000,
  heroLeaderboards: 120_000,
  officialSchedule: 20_000,
  stage: 20_000,
  matchDetail: 120_000,
  profileDetail: 60_000,
  acknowledgements: 120_000,
} as const;

const apiRouterDirectory = path.dirname(fileURLToPath(import.meta.url));
const dotaAssetRoot = path.resolve(apiRouterDirectory, "../../../mobile-web/public/static/dota");
const svgAssetRoot = path.resolve(apiRouterDirectory, "../../../mobile-web/public/static/svg");
const sponsorAssetRoot = path.resolve(
  apiRouterDirectory,
  "../../../mobile-web/public/static/sponsors",
);
const acknowledgementAssetRoot = resolveAcknowledgementAssetRoot();
const teamLogoAssetRoot = resolveTeamLogoAssetRoot();
const allowedDotaAssetSections = new Set([
  "abilities",
  "constants",
  "heroes",
  "hero-icons",
  "items",
  "wards",
]);
const maxAcknowledgementImageBytes = 2 * 1024 * 1024;
const maxTeamLogoImageBytes = 2 * 1024 * 1024;
const assetContentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};
const acknowledgementImageExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const managedImageExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const transparentAvatarPlaceholder = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);
const adminLoginRateLimiter = createFixedWindowRateLimiter(
  readPositiveInteger(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX, 20),
  readPositiveInteger(process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
);
const wechatLoginRateLimiter = createFixedWindowRateLimiter(
  readPositiveInteger(process.env.WECHAT_LOGIN_RATE_LIMIT_MAX, 60),
  readPositiveInteger(process.env.WECHAT_LOGIN_RATE_LIMIT_WINDOW_MS, 60 * 1000),
);

function resolveAcknowledgementAssetRoot(): string {
  const configuredRoot = process.env.MRJZ_ACKNOWLEDGEMENT_ASSET_ROOT?.trim();

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(process.cwd(), configuredRoot);
  }

  return path.join(path.dirname(resolveDatabasePath()), "acknowledgements");
}

function resolveTeamLogoAssetRoot(): string {
  const configuredRoot = process.env.MRJZ_TEAM_LOGO_ASSET_ROOT?.trim();

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(process.cwd(), configuredRoot);
  }

  return path.join(path.dirname(resolveDatabasePath()), "team-logos");
}

export type HealthStatus = {
  ok: true;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
};

export function createApiRouter(getHealthStatus: () => HealthStatus): Router {
  const router = new Router(adminRouteGuard, invalidateReadCache);

  router.get("/health", () => json(200, getHealthStatus()));
  router.get("/api/health", () => json(200, getHealthStatus()));

  router.post("/api/auth/wechat-login", async ({ request }) => {
    const rateLimitKey = requestRateLimitKey(request, "wechat-login");
    const rateLimited = wechatLoginRateLimiter.check(rateLimitKey);

    if (rateLimited !== null) {
      return rateLimited;
    }

    try {
      const body = await readJsonBody(request);
      const login = await resolveWechatLogin(body);
      const user = upsertAppUser(
        login.unionId === undefined
          ? {
              openId: login.openId,
              nickname: login.nickname,
            }
          : {
              openId: login.openId,
              unionId: login.unionId,
              nickname: login.nickname,
            },
      );
      const session = createUserSession(user.id);

      return ok({
        token: session.token,
        expiresAt: session.expiresAt,
        user: session.user,
        authProvider: login.provider,
      });
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/auth/logout", ({ request }) => {
    const token = bearerTokenFromRequest(request);

    if (token === null) {
      return fail(401, "UNAUTHORIZED", "Login is required");
    }

    return ok(revokeUserSession(token));
  });

  router.get("/api/me", ({ request }) => {
    const user = appUserFromRequest(request);

    if (user === null) {
      return fail(401, "UNAUTHORIZED", "Login is required");
    }

    const me = getAppUserMe(user.id);

    if (me === undefined) {
      return fail(401, "UNAUTHORIZED", "App user not found");
    }

    return ok(me);
  });

  router.post("/api/me/player-binding", async ({ request }) => {
    const user = appUserFromRequest(request);

    if (user === null) {
      return fail(401, "UNAUTHORIZED", "Login is required");
    }

    try {
      const body = await readJsonBody(request);
      return ok(bindAppUserDotaAccount(user.id, bodyToBindDotaAccountInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/me/stats", ({ request }) => {
    const user = appUserFromRequest(request);

    if (user === null) {
      return fail(401, "UNAUTHORIZED", "Login is required");
    }

    const stats = getAppUserStats(user.id);

    if (stats === undefined) {
      return fail(401, "UNAUTHORIZED", "App user not found");
    }

    return ok(stats);
  });

  router.post("/api/admin/auth/login", async ({ request }) => {
    const rateLimitKey = requestRateLimitKey(request, "admin-login");
    const rateLimited = adminLoginRateLimiter.check(rateLimitKey);

    if (rateLimited !== null) {
      return rateLimited;
    }

    try {
      const body = await readJsonBody(request);
      const session = loginAdmin(bodyToAdminLoginInput(body));
      adminLoginRateLimiter.reset(rateLimitKey);
      return ok(session);
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/admin/auth/logout", ({ request }) => {
    const token = bearerTokenFromRequest(request);

    if (token === null) {
      return fail(401, "UNAUTHORIZED", "Admin login is required");
    }

    return ok(revokeAdminSession(token));
  });

  router.get("/api/admin/auth/me", ({ request }) => {
    const admin = adminUserFromRequest(request);

    if (admin === null) {
      return fail(401, "UNAUTHORIZED", "Admin login is required");
    }

    return ok(admin);
  });

  router.get("/api/admin/acknowledgements", () =>
    ok(listAcknowledgements({ includeHidden: true })),
  );

  router.post("/api/admin/acknowledgements", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createAcknowledgement(await bodyToCreateAcknowledgementInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/admin/acknowledgements/:id", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(
        updateAcknowledgement(params.id ?? "", await bodyToUpdateAcknowledgementInput(body)),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/admin/acknowledgements/:id", ({ params }) => {
    try {
      return ok(deleteAcknowledgement(params.id ?? ""));
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/assets/steam-avatars/:filename", async ({ params }) => {
    const accountId = Number((params.filename ?? "").replace(/\.jpg$/i, ""));
    let avatar = await readSteamAvatarCache(accountId);

    if (avatar === null) {
      const avatarUrl = getPlayerAvatarUrlByAccountId(accountId);

      if (isFetchableSteamAvatarSource(avatarUrl, accountId)) {
        await cacheSteamAvatar(accountId, avatarUrl).catch(() => false);
        avatar = await readSteamAvatarCache(accountId);
      }
    }

    if (avatar === null) {
      return binary(200, transparentAvatarPlaceholder, {
        "content-type": "image/gif",
        "cache-control": "public, max-age=300",
      });
    }

    return binary(200, avatar.bytes, {
      "content-type": avatar.contentType,
      "cache-control": "public, max-age=3600",
    });
  });

  router.get("/api/assets/dota/:section/:filename", async ({ params }) => serveDotaAsset(params));
  router.get("/api/assets/dota/:section/:subdir/:filename", async ({ params }) =>
    serveDotaAsset(params),
  );
  router.get("/api/assets/svg/:filename", async ({ params }) => serveSvgAsset(params));
  router.get("/api/assets/sponsors/:filename", async ({ params }) => serveSponsorAsset(params));
  router.get("/api/assets/acknowledgements/:filename", async ({ params }) =>
    serveAcknowledgementAsset(params),
  );
  router.get("/api/assets/team-logos/:filename", async ({ params }) =>
    serveTeamLogoAsset(params),
  );

  router.get("/api/acknowledgements", () =>
    ok(cached("acknowledgements", READ_CACHE_TTL.acknowledgements, () => listAcknowledgements())),
  );

  router.get("/api/tournaments", () => ok(cached("tournaments", READ_CACHE_TTL.tournamentList, () => listTournaments())));

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
    const tournament = cached(`tournament:${params.id ?? ""}`, READ_CACHE_TTL.tournamentDetail, () =>
      getTournamentDetail(params.id ?? ""),
    );

    if (tournament === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(tournament);
  });

  router.get("/api/tournaments/:id/overview", ({ params, url }) => {
    const tournamentId = params.id ?? "";
    const limit = positiveIntegerQuery(url, "limit", 80);
    const payload = cached(`overview:${tournamentId}:${limit}`, READ_CACHE_TTL.overview, () => {
      const tournament = getTournamentDetail(tournamentId);

      if (tournament === undefined) {
        return null;
      }

      const stageInputs =
        Array.isArray(tournament.stages) && tournament.stages.length > 0
          ? tournament.stages
          : [tournament.currentStage].filter(
              (stage): stage is NonNullable<typeof stage> => stage !== undefined && stage !== null,
            );
      const stages = stageInputs.map((stage) => ({
        stage,
        standings: getStageStandings(stage.id) ?? null,
        rounds: getStageRounds(stage.id) ?? null,
        bracket: getStageBracket(stage.id) ?? null,
      }));
      const recentRecords: Record<string, unknown> = {};

      for (const entry of listTournaments() ?? []) {
        if (entry.id === tournamentId) {
          continue;
        }

        recentRecords[entry.id] = listTournamentOpenDotaMatches(entry.id, 3) ?? [];
      }

      return {
        tournament,
        officialSchedule: getOfficialSchedulePublicStatus(tournamentId) ?? null,
        matches: listTournamentOpenDotaMatches(tournamentId, limit) ?? [],
        heroLeaderboards: listTournamentHeroLeaderboards(tournamentId) ?? null,
        players: listTournamentPlayers(tournamentId) ?? [],
        teams: listTournamentTeams(tournamentId) ?? [],
        stages,
        recentRecords,
      };
    });

    if (payload === null) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(payload);
  });

  router.get("/api/tournaments/:id/matches", ({ params, url }) => {
    const limit = positiveIntegerQuery(url, "limit", 100);
    const matches = cached(`matches:${params.id ?? ""}:${limit}`, READ_CACHE_TTL.matches, () =>
      listTournamentOpenDotaMatches(params.id ?? "", limit),
    );

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

  router.delete("/api/tournaments/:id/schedule-records", ({ params }) => {
    try {
      return ok(clearTournamentScheduleRecords(params.id ?? ""));
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/tournaments/:id/teams", ({ params }) => {
    const teams = cached(`teams:${params.id ?? ""}`, READ_CACHE_TTL.teams, () =>
      listTournamentTeams(params.id ?? ""),
    );

    if (teams === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(teams);
  });

  router.get("/api/tournaments/:id/players", ({ params }) => {
    const players = cached(`players:${params.id ?? ""}`, READ_CACHE_TTL.players, () =>
      listTournamentPlayers(params.id ?? ""),
    );

    if (players === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(players);
  });

  router.get("/api/tournaments/:id/hero-leaderboards", ({ params }) => {
    const leaderboards = cached(`hero-leaderboards:${params.id ?? ""}`, READ_CACHE_TTL.heroLeaderboards, () =>
      listTournamentHeroLeaderboards(params.id ?? ""),
    );

    if (leaderboards === undefined) {
      return fail(404, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }

    return ok(leaderboards);
  });

  router.get("/api/tournaments/:id/players/:playerId", ({ params }) => {
    const player = cached(
      `player-detail:${params.id ?? ""}:${params.playerId ?? ""}`,
      READ_CACHE_TTL.profileDetail,
      () => getTournamentPlayerDetail(params.id ?? "", params.playerId ?? ""),
    );

    if (player === undefined) {
      return fail(404, "PLAYER_NOT_FOUND", "Player not found for this tournament");
    }

    return ok(player);
  });

  router.get("/api/tournaments/:id/players/:playerId/tags", ({ params }) => {
    const tags = listPlayerTags(params.id ?? "", params.playerId ?? "");

    if (tags === undefined) {
      return fail(404, "PLAYER_NOT_FOUND", "Player not found for this tournament");
    }

    return ok(tags);
  });

  router.post(
    "/api/miniprogram/tournaments/:id/players/:playerId/tags",
    async ({ request, params }) => {
      const user = appUserFromRequest(request);

      if (user === null) {
        return fail(401, "UNAUTHORIZED", "Mini program tag submission requires an app user token");
      }

      try {
        const body = await readJsonBody(request);
        return ok(
          submitPlayerTag(
            params.id ?? "",
            params.playerId ?? "",
            bodyToSubmitPlayerTagInput(body, user.id),
          ),
          201,
        );
      } catch (error) {
        return validationError(error);
      }
    },
  );

  router.post("/api/miniprogram/tags/:tagId/like", ({ request, params }) => {
    const user = appUserFromRequest(request);

    if (user === null) {
      return fail(401, "UNAUTHORIZED", "Mini program tag likes require an app user token");
    }

    try {
      return ok(likePlayerTag(params.tagId ?? "", { userId: user.id }));
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/miniprogram/tags/:tagId/like", ({ request, params }) => {
    const user = appUserFromRequest(request);

    if (user === null) {
      return fail(401, "UNAUTHORIZED", "Mini program tag likes require an app user token");
    }

    try {
      return ok(unlikePlayerTag(params.tagId ?? "", { userId: user.id }));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/entities/backfill", ({ params }) => {
    return ok(backfillCachedTournamentEntities(params.id ?? ""));
  });

  router.get("/api/tournaments/:id/teams/:teamId", ({ params }) => {
    const team = cached(`team-detail:${params.id ?? ""}:${params.teamId ?? ""}`, READ_CACHE_TTL.profileDetail, () =>
      getTournamentTeamDetail(params.id ?? "", params.teamId ?? ""),
    );

    if (team === undefined) {
      return fail(404, "TEAM_NOT_FOUND", "Team not found for this tournament");
    }

    return ok(team);
  });

  router.get("/api/tournaments/:id/official-schedule", ({ params }) => {
    const schedule = cached(`official-schedule:${params.id ?? ""}`, READ_CACHE_TTL.officialSchedule, () =>
      getOfficialSchedulePublicStatus(params.id ?? ""),
    );

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

  router.get("/api/admin/tags", ({ url }) => {
    try {
      return ok(listAdminTags(queryToListAdminTagsInput(url)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/admin/tag-players", ({ url }) => {
    try {
      return ok(listAdminTagPlayers(queryToListAdminTagPlayersInput(url)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/admin/tournaments/:id/players/:playerId/tags", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(
        createAdminPlayerTag(
          params.id ?? "",
          params.playerId ?? "",
          bodyToAdminCreatePlayerTagInput(body),
        ),
        201,
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/admin/tags/:tagId", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updatePlayerTagReview(params.tagId ?? "", bodyToReviewPlayerTagInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/admin/tags/:tagId/likes/adjust", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(adjustPlayerTagLikes(params.tagId ?? "", bodyToAdjustPlayerTagLikesInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.delete("/api/admin/tags/:tagId", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(deletePlayerTag(params.tagId ?? "", bodyToDeletePlayerTagInput(body)));
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/tournaments/:id/schedule-management", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(
        updateOfficialScheduleConfig(params.id ?? "", bodyToOfficialScheduleConfigInput(body)),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.post(
    "/api/tournaments/:id/schedule-management/lock-roster",
    async ({ request, params }) => {
      try {
        const body = await readJsonBody(request);
        return ok(
          lockOfficialScheduleRoster(params.id ?? "", bodyToLockOfficialScheduleRosterInput(body)),
        );
      } catch (error) {
        return validationError(error);
      }
    },
  );

  router.post(
    "/api/tournaments/:id/schedule-management/unlock-roster",
    async ({ request, params }) => {
      try {
        const body = await readJsonBody(request).catch(() => ({}));
        return ok(
          unlockOfficialScheduleRoster(
            params.id ?? "",
            optionalStringField(body, "actor") ?? "admin",
          ),
        );
      } catch (error) {
        return validationError(error);
      }
    },
  );

  router.post("/api/tournaments/:id/schedule-management/publish", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      return ok(
        publishOfficialSchedule(params.id ?? "", optionalStringField(body, "actor") ?? "admin"),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/schedule-management/withdraw", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      return ok(
        withdrawOfficialSchedule(params.id ?? "", optionalStringField(body, "actor") ?? "admin"),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/tournaments/:id/knockout-bracket", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(
        createKnockoutBracket(params.id ?? "", bodyToCreateKnockoutBracketInput(body)),
        201,
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.post(
    "/api/tournaments/:id/opendota-matches/:matchId/link-series",
    async ({ request, params }) => {
      try {
        const matchId = Number(params.matchId);

        if (!Number.isSafeInteger(matchId) || matchId <= 0) {
          return fail(400, "VALIDATION_ERROR", "matchId must be a positive integer");
        }

        const body = await readJsonBody(request);

        return ok(
          linkOpenDotaMatchToSeries(params.id ?? "", matchId, bodyToLinkOpenDotaMatchInput(body)),
        );
      } catch (error) {
        return validationError(error);
      }
    },
  );

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
      return ok(
        updateTournamentLifecycle(params.id ?? "", bodyToUpdateTournamentLifecycleInput(body)),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.get("/api/stages/:stageId/standings", ({ params }) => {
    const standings = cached(`stage-standings:${params.stageId ?? ""}`, READ_CACHE_TTL.stage, () =>
      getStageStandings(params.stageId ?? ""),
    );

    if (standings === undefined) {
      return fail(404, "STAGE_NOT_FOUND", "Stage standings not found");
    }

    return ok(standings);
  });

  router.get("/api/stages/:stageId/rounds", ({ params }) => {
    const rounds = cached(`stage-rounds:${params.stageId ?? ""}`, READ_CACHE_TTL.stage, () =>
      getStageRounds(params.stageId ?? ""),
    );

    if (rounds === undefined) {
      return fail(404, "STAGE_NOT_FOUND", "Stage rounds not found");
    }

    return ok(rounds);
  });

  router.get("/api/stages/:stageId/bracket", ({ params }) => {
    const bracket = cached(`stage-bracket:${params.stageId ?? ""}`, READ_CACHE_TTL.stage, () =>
      getStageBracket(params.stageId ?? ""),
    );

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
      return ok(
        generateGroupRoundRobin(params.stageId ?? "", bodyToGenerateGroupRoundRobinInput(body)),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/stages/:stageId/manual-ranks", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(
        updateStageManualRanks(params.stageId ?? "", bodyToUpdateStageManualRanksInput(body)),
      );
    } catch (error) {
      return validationError(error);
    }
  });

  router.post("/api/stages/:stageId/swiss-pairings", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(
        generateSwissPairings(params.stageId ?? "", bodyToGenerateSwissPairingsInput(body)),
      );
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
    const match = cached(`match-detail:${params.matchId ?? ""}`, READ_CACHE_TTL.matchDetail, () =>
      getMatchDetail(params.matchId ?? ""),
    );

    if (match === undefined) {
      return fail(404, "MATCH_NOT_FOUND", "Match not found");
    }

    return ok(match);
  });

  router.post("/api/teams", async ({ request }) => {
    try {
      const body = await readJsonBody(request);
      return ok(createTeam(await bodyToCreateTeamInput(body)), 201);
    } catch (error) {
      return validationError(error);
    }
  });

  router.patch("/api/teams/:teamId", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request);
      return ok(updateTeam(params.teamId ?? "", await bodyToUpdateTeamInput(body)));
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
      const input = await resolveTeamMemberProfile(
        bodyToAddTeamMemberInput(params.teamId ?? "", body),
      );
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

      return ok(
        updateSeriesGameResult(params.seriesId ?? "", gameIndex, bodyToUpdateGameResultInput(body)),
      );
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

  router.delete("/api/bracket-nodes/:nodeId/winner", async ({ request, params }) => {
    try {
      const body = await readJsonBody(request).catch(() => ({}));
      return ok(retractBracketNode(params.nodeId ?? "", bodyToRetractBracketNodeInput(body)));
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

function isFetchableSteamAvatarSource(avatarUrl: string | null, accountId: number): avatarUrl is string {
  if (avatarUrl === null || !Number.isSafeInteger(accountId) || accountId <= 0) {
    return false;
  }

  try {
    const url = new URL(avatarUrl);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.pathname.toLowerCase().includes(`/api/assets/steam-avatars/${accountId}.jpg`)
    );
  } catch {
    return false;
  }
}

async function serveDotaAsset(params: Record<string, string>) {
  const section = params.section ?? "";
  const filename = params.filename ?? "";
  const subdir = params.subdir;

  if (
    !allowedDotaAssetSections.has(section) ||
    !isSafeAssetSegment(section) ||
    !isSafeAssetSegment(filename) ||
    (subdir !== undefined && !isSafeAssetSegment(subdir))
  ) {
    return fail(404, "DOTA_ASSET_NOT_FOUND", "Dota asset not found");
  }

  if (subdir !== undefined && !(section === "wards" && subdir === "minimap")) {
    return fail(404, "DOTA_ASSET_NOT_FOUND", "Dota asset not found");
  }

  const filePath =
    subdir === undefined
      ? path.join(dotaAssetRoot, section, filename)
      : path.join(dotaAssetRoot, section, subdir, filename);

  return serveStaticAsset(filePath, dotaAssetRoot, "DOTA_ASSET_NOT_FOUND", "Dota asset not found");
}

async function serveSvgAsset(params: Record<string, string>) {
  const filename = params.filename ?? "";

  if (!isSafeAssetSegment(filename)) {
    return fail(404, "SVG_ASSET_NOT_FOUND", "SVG asset not found");
  }

  return serveStaticAsset(
    path.join(svgAssetRoot, filename),
    svgAssetRoot,
    "SVG_ASSET_NOT_FOUND",
    "SVG asset not found",
  );
}

async function serveSponsorAsset(params: Record<string, string>) {
  const filename = params.filename ?? "";

  if (!isSafeAssetSegment(filename)) {
    return fail(404, "SPONSOR_ASSET_NOT_FOUND", "Sponsor asset not found");
  }

  return serveStaticAsset(
    path.join(sponsorAssetRoot, filename),
    sponsorAssetRoot,
    "SPONSOR_ASSET_NOT_FOUND",
    "Sponsor asset not found",
  );
}

async function serveAcknowledgementAsset(params: Record<string, string>) {
  const filename = params.filename ?? "";

  if (!isSafeAssetSegment(filename)) {
    return fail(404, "ACKNOWLEDGEMENT_ASSET_NOT_FOUND", "Acknowledgement asset not found");
  }

  return serveStaticAsset(
    path.join(acknowledgementAssetRoot, filename),
    acknowledgementAssetRoot,
    "ACKNOWLEDGEMENT_ASSET_NOT_FOUND",
    "Acknowledgement asset not found",
  );
}

async function serveTeamLogoAsset(params: Record<string, string>) {
  const filename = params.filename ?? "";

  if (!isSafeAssetSegment(filename)) {
    return fail(404, "TEAM_LOGO_ASSET_NOT_FOUND", "Team logo asset not found");
  }

  return serveStaticAsset(
    path.join(teamLogoAssetRoot, filename),
    teamLogoAssetRoot,
    "TEAM_LOGO_ASSET_NOT_FOUND",
    "Team logo asset not found",
  );
}

async function serveStaticAsset(filePath: string, root: string, code: string, message: string) {
  const normalizedPath = path.resolve(filePath);

  if (!isPathInsideRoot(root, normalizedPath)) {
    return fail(404, code, message);
  }

  const contentType = assetContentTypes[path.extname(normalizedPath).toLowerCase()];

  if (contentType === undefined) {
    return fail(404, code, message);
  }

  try {
    const bytes = await readFile(normalizedPath);
    return binary(200, bytes, {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
    });
  } catch {
    return fail(404, code, message);
  }
}

function isPathInsideRoot(root: string, filePath: string): boolean {
  const relativePath = path.relative(root, filePath);
  return (
    relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
  );
}

function isSafeAssetSegment(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..");
}

function adminRouteGuard(context: RouteGuardContext) {
  if (
    isPublicRoute(context) ||
    isAppUserRoute(context) ||
    context.pattern === "/api/admin/auth/login"
  ) {
    return null;
  }

  const admin = adminUserFromRequest(context.request);

  if (admin === null) {
    return fail(401, "UNAUTHORIZED", "Admin login is required");
  }

  if (context.method !== "GET" && context.pattern !== "/api/admin/auth/logout") {
    recordAdminAudit({
      actorAdminId: admin.id,
      action: `${context.method} ${context.pattern}`,
      resourceType: "api_route",
      resourceId: context.pattern,
      detail: {
        path: context.url.pathname,
      },
    });
  }

  return null;
}

function isPublicRoute(context: RouteGuardContext): boolean {
  if (context.pattern === "/health" || context.pattern === "/api/health") {
    return true;
  }

  if (context.method !== "GET") {
    return false;
  }

  return PUBLIC_GET_PATTERNS.has(context.pattern);
}

function isAppUserRoute(context: RouteGuardContext): boolean {
  return (
    context.pattern === "/api/auth/wechat-login" ||
    context.pattern === "/api/auth/logout" ||
    context.pattern === "/api/me" ||
    context.pattern === "/api/me/player-binding" ||
    context.pattern === "/api/me/stats" ||
    context.pattern.startsWith("/api/miniprogram/")
  );
}

const PUBLIC_GET_PATTERNS = new Set([
  "/api/acknowledgements",
  "/api/assets/acknowledgements/:filename",
  "/api/assets/dota/:section/:filename",
  "/api/assets/dota/:section/:subdir/:filename",
  "/api/assets/steam-avatars/:filename",
  "/api/assets/sponsors/:filename",
  "/api/assets/svg/:filename",
  "/api/assets/team-logos/:filename",
  "/api/leagues",
  "/api/tournaments",
  "/api/tournaments/:id",
  "/api/tournaments/:id/matches",
  "/api/tournaments/:id/overview",
  "/api/tournaments/:id/teams",
  "/api/tournaments/:id/teams/:teamId",
  "/api/tournaments/:id/players",
  "/api/tournaments/:id/hero-leaderboards",
  "/api/tournaments/:id/players/:playerId",
  "/api/tournaments/:id/players/:playerId/tags",
  "/api/tournaments/:id/official-schedule",
  "/api/stages/:stageId/standings",
  "/api/stages/:stageId/rounds",
  "/api/stages/:stageId/bracket",
  "/api/stages/:stageId/groups",
  "/api/matches/:matchId",
]);

async function bodyToCreateTeamInput(body: Record<string, unknown>) {
  return withoutUndefined({
    name: stringField(body, "name"),
    shortName: optionalStringField(body, "shortName"),
    logoUrl: await teamLogoUrlFromBody(body),
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
    scheduledAt: optionalScheduleTimeField(body, "scheduledAt"),
    teamIds: stringArrayField(body, "teamIds"),
  }) as Parameters<typeof createKnockoutBracket>[1];
}

function bodyToOfficialScheduleConfigInput(body: Record<string, unknown>) {
  const preliminaryType = optionalStringOrNullField(body, "preliminaryType");
  const knockoutType = optionalStringOrNullField(body, "knockoutType");

  if (
    preliminaryType !== undefined &&
    preliminaryType !== null &&
    !["group", "swiss"].includes(preliminaryType)
  ) {
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
  return withoutUndefined({
    winnerTeamId: stringField(body, "winnerTeamId"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof advanceBracketNode>[1];
}

function bodyToRetractBracketNodeInput(body: Record<string, unknown>) {
  return withoutUndefined({
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof retractBracketNode>[1];
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
        manualRank:
          optionalNumberOrNullField(rank as Record<string, unknown>, "manualRank") ?? null,
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

async function resolveTeamMemberProfile(
  input: Parameters<typeof addTeamMember>[0],
): Promise<Parameters<typeof addTeamMember>[0]> {
  if (input.playerId !== undefined) {
    return input;
  }

  const rawSteamId =
    input.steamId ??
    (input.accountId === undefined || input.accountId === null
      ? undefined
      : String(input.accountId));

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

async function bodyToUpdateTeamInput(body: Record<string, unknown>) {
  return withoutUndefined({
    name: optionalStringField(body, "name"),
    shortName: optionalStringField(body, "shortName"),
    logoUrl: await teamLogoUrlFromBody(body),
    color: optionalStringOrNullField(body, "color"),
    opendotaTeamId: optionalNumberOrNullField(body, "opendotaTeamId"),
  }) as Parameters<typeof updateTeam>[1];
}

function bodyToCreateTournamentInput(body: Record<string, unknown>) {
  const status = optionalStringField(body, "status");

  if (
    status !== undefined &&
    !["draft", "upcoming", "running", "completed", "archived"].includes(status)
  ) {
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

  if (
    status !== undefined &&
    !["draft", "published", "running", "completed", "locked"].includes(status)
  ) {
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
    ![
      "draft",
      "scheduled",
      "live",
      "result_pending",
      "completed",
      "conflict",
      "postponed",
    ].includes(status)
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
    scheduledAt: optionalScheduleTimeField(body, "scheduledAt"),
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
    ![
      "draft",
      "scheduled",
      "live",
      "result_pending",
      "completed",
      "conflict",
      "postponed",
    ].includes(status)
  ) {
    throw new Error("status must be a valid series status");
  }

  return withoutUndefined({
    roundId: optionalStringField(body, "roundId"),
    groupId: optionalStringOrNullField(body, "groupId"),
    seriesKind: seriesKind as Parameters<typeof updateSeries>[1]["seriesKind"],
    boType: boType as Parameters<typeof updateSeries>[1]["boType"],
    status: status as Parameters<typeof updateSeries>[1]["status"],
    scheduledAt: optionalScheduleTimeOrNullField(body, "scheduledAt"),
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
      payload !== undefined &&
      payload !== null &&
      typeof payload === "object" &&
      !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
  }) as Parameters<typeof createSyncTask>[0];
}

function bodyToSubmitPlayerTagInput(body: Record<string, unknown>, userId: string) {
  return {
    text: stringField(body, "text"),
    userId,
  } satisfies Parameters<typeof submitPlayerTag>[2];
}

function bodyToBindDotaAccountInput(body: Record<string, unknown>) {
  return withoutUndefined({
    accountId: optionalNumberOrNullField(body, "accountId"),
    steamId64: optionalStringOrNullField(body, "steamId64"),
    steamId: optionalStringField(body, "steamId"),
  }) as Parameters<typeof bindAppUserDotaAccount>[1];
}

function bodyToAdminLoginInput(body: Record<string, unknown>) {
  return {
    username: stringField(body, "username"),
    password: stringField(body, "password"),
  } satisfies Parameters<typeof loginAdmin>[0];
}

async function bodyToCreateAcknowledgementInput(body: Record<string, unknown>) {
  const imageUrl = await acknowledgementImageUrlFromBody(body);
  const status = optionalStringField(body, "status");

  if (status !== undefined && !["visible", "hidden"].includes(status)) {
    throw new Error("status must be visible or hidden");
  }

  return withoutUndefined({
    category: acknowledgementCategoryField(body, "category"),
    displayName: stringField(body, "displayName"),
    imageUrl,
    sortOrder: optionalNumberField(body, "sortOrder"),
    status,
  }) as Parameters<typeof createAcknowledgement>[0];
}

async function bodyToUpdateAcknowledgementInput(body: Record<string, unknown>) {
  const imageUrl = await acknowledgementImageUrlFromBody(body);
  const status = optionalStringField(body, "status");

  if (status !== undefined && !["visible", "hidden"].includes(status)) {
    throw new Error("status must be visible or hidden");
  }

  return withoutUndefined({
    category: optionalAcknowledgementCategoryField(body, "category"),
    displayName: optionalStringField(body, "displayName"),
    imageUrl,
    sortOrder: optionalNumberField(body, "sortOrder"),
    status,
  }) as Parameters<typeof updateAcknowledgement>[1];
}

async function acknowledgementImageUrlFromBody(
  body: Record<string, unknown>,
): Promise<string | null | undefined> {
  const imageDataUrl = optionalStringField(body, "imageDataUrl");

  if (imageDataUrl !== undefined) {
    return await storeAcknowledgementImage(imageDataUrl);
  }

  return optionalStringOrNullField(body, "imageUrl");
}

async function teamLogoUrlFromBody(
  body: Record<string, unknown>,
): Promise<string | null | undefined> {
  const logoImageDataUrl = optionalStringField(body, "logoImageDataUrl");

  if (logoImageDataUrl !== undefined) {
    return await storeTeamLogoImage(logoImageDataUrl);
  }

  return optionalStringOrNullField(body, "logoUrl");
}

function acknowledgementCategoryField(body: Record<string, unknown>, fieldName: string) {
  const category = stringField(body, fieldName);

  if (category !== "sponsor" && category !== "community") {
    throw new Error(`${fieldName} must be sponsor or community`);
  }

  return category;
}

function optionalAcknowledgementCategoryField(body: Record<string, unknown>, fieldName: string) {
  if (!(fieldName in body)) {
    return undefined;
  }

  return acknowledgementCategoryField(body, fieldName);
}

async function storeAcknowledgementImage(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());

  if (match === null) {
    throw new Error("imageDataUrl must be a png, jpg, or webp data URL");
  }

  const mimeType = match[1] ?? "";
  const extension = acknowledgementImageExtensions[mimeType];

  if (extension === undefined) {
    throw new Error("imageDataUrl must be a png, jpg, or webp data URL");
  }

  const bytes = Buffer.from((match[2] ?? "").replace(/\s/g, ""), "base64");

  if (bytes.byteLength === 0) {
    throw new Error("imageDataUrl is empty");
  }

  if (bytes.byteLength > maxAcknowledgementImageBytes) {
    throw new Error("imageDataUrl must be 2MB or smaller");
  }

  await mkdir(acknowledgementAssetRoot, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  await writeFile(path.join(acknowledgementAssetRoot, filename), bytes);

  return `/api/assets/acknowledgements/${filename}`;
}

async function storeTeamLogoImage(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());

  if (match === null) {
    throw new Error("logoImageDataUrl must be a png, jpg, or webp data URL");
  }

  const mimeType = match[1] ?? "";
  const extension = managedImageExtensions[mimeType];

  if (extension === undefined) {
    throw new Error("logoImageDataUrl must be a png, jpg, or webp data URL");
  }

  const bytes = Buffer.from((match[2] ?? "").replace(/\s/g, ""), "base64");

  if (bytes.byteLength === 0) {
    throw new Error("logoImageDataUrl is empty");
  }

  if (bytes.byteLength > maxTeamLogoImageBytes) {
    throw new Error("logoImageDataUrl must be 2MB or smaller");
  }

  await mkdir(teamLogoAssetRoot, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  await writeFile(path.join(teamLogoAssetRoot, filename), bytes);

  return `/api/assets/team-logos/${filename}`;
}

function queryToListAdminTagsInput(url: URL) {
  const status = url.searchParams.get("status")?.trim();

  if (
    status !== undefined &&
    status.length > 0 &&
    status !== "all" &&
    !["pending_review", "approved", "rejected", "hidden"].includes(status)
  ) {
    throw new Error("status must be pending_review, approved, rejected, hidden, or all");
  }

  return withoutUndefined({
    tournamentId: optionalQueryString(url, "tournamentId"),
    status: status && status.length > 0 ? status : undefined,
    query: optionalQueryString(url, "query"),
  }) as Parameters<typeof listAdminTags>[0];
}

function queryToListAdminTagPlayersInput(url: URL) {
  return withoutUndefined({
    tournamentId: optionalQueryString(url, "tournamentId"),
  }) as Parameters<typeof listAdminTagPlayers>[0];
}

function bodyToAdminCreatePlayerTagInput(body: Record<string, unknown>) {
  const status = optionalStringField(body, "status");

  if (
    status !== undefined &&
    !["pending_review", "approved", "rejected", "hidden"].includes(status)
  ) {
    throw new Error("status must be pending_review, approved, rejected, or hidden");
  }

  return withoutUndefined({
    text: stringField(body, "text"),
    status,
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof createAdminPlayerTag>[2];
}

function bodyToReviewPlayerTagInput(body: Record<string, unknown>) {
  const status = stringField(body, "status");

  if (!["pending_review", "approved", "rejected", "hidden"].includes(status)) {
    throw new Error("status must be pending_review, approved, rejected, or hidden");
  }

  return withoutUndefined({
    status,
    reviewReason: optionalStringOrNullField(body, "reviewReason"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof updatePlayerTagReview>[1];
}

function bodyToAdjustPlayerTagLikesInput(body: Record<string, unknown>) {
  return withoutUndefined({
    delta: numberField(body, "delta"),
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof adjustPlayerTagLikes>[1];
}

function bodyToDeletePlayerTagInput(body: Record<string, unknown>) {
  return withoutUndefined({
    actor: optionalStringField(body, "actor"),
  }) as Parameters<typeof deletePlayerTag>[1];
}

function appUserFromRequest(request: { headers: Record<string, string | string[] | undefined> }) {
  const token = bearerTokenFromRequest(request);

  return token === null ? null : (resolveAppUserBySessionToken(token) ?? null);
}

function adminUserFromRequest(request: { headers: Record<string, string | string[] | undefined> }) {
  const token = bearerTokenFromRequest(request);

  return token === null ? null : (resolveAdminBySessionToken(token) ?? null);
}

function bearerTokenFromRequest(request: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const authorization = request.headers.authorization;
  const headerValue = Array.isArray(authorization) ? authorization[0] : authorization;
  const match =
    typeof headerValue === "string" ? /^Bearer\s+(.+)$/i.exec(headerValue.trim()) : null;
  const token = match?.[1]?.trim();

  return token === undefined || token.length === 0 ? null : token;
}

type ResolvedWechatLogin = {
  openId: string;
  unionId?: string;
  nickname: string;
  provider: "wechat" | "development";
};

async function resolveWechatLogin(body: Record<string, unknown>): Promise<ResolvedWechatLogin> {
  const code = stringField(body, "code");
  const nickname = nicknameField(body);
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  const hasWechatCredentials =
    appId !== undefined && appId.length > 0 && appSecret !== undefined && appSecret.length > 0;

  if (hasWechatCredentials) {
    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: "authorization_code",
    });
    return await resolveWechatCode2Session(params, nickname);
  }

  if (!isDevelopmentWechatLoginAllowed()) {
    throw new Error("WECHAT_APP_ID and WECHAT_APP_SECRET are required for WeChat login");
  }

  const devUserId = resolveDevelopmentWechatUserId(body);

  return {
    openId: `dev:${devUserId}`,
    nickname,
    provider: "development",
  };
}

async function resolveWechatCode2Session(
  params: URLSearchParams,
  nickname: string,
): Promise<ResolvedWechatLogin> {
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`);
  const payload = (await response.json()) as {
    openid?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!response.ok || typeof payload.openid !== "string" || payload.openid.trim().length === 0) {
    const message = payload.errmsg ?? `HTTP ${response.status}`;

    throw new Error(`WeChat code2Session failed: ${message}`);
  }

  const result: ResolvedWechatLogin = {
    openId: `wechat:${payload.openid.trim()}`,
    nickname,
    provider: "wechat",
  };

  if (typeof payload.unionid === "string" && payload.unionid.trim().length > 0) {
    result.unionId = `wechat:${payload.unionid.trim()}`;
  }

  return result;
}

function isDevelopmentWechatLoginAllowed(): boolean {
  const configured = process.env.MRJZ_ALLOW_DEV_WECHAT_LOGIN?.trim().toLowerCase();

  return (
    process.env.NODE_ENV !== "production" && ["1", "true", "yes", "on"].includes(configured ?? "")
  );
}

function resolveDevelopmentWechatUserId(body: Record<string, unknown>): string {
  const devUserId =
    optionalStringField(body, "devUserId") ??
    process.env.MRJZ_DEV_WECHAT_USER_ID?.trim() ??
    "local";

  if (!/^[A-Za-z0-9._-]{1,64}$/.test(devUserId)) {
    throw new Error(
      "devUserId must be 1-64 characters and contain only letters, numbers, dot, underscore, or dash",
    );
  }

  return devUserId;
}

function stringField(body: Record<string, unknown>, fieldName: string): string {
  const value = body[fieldName];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function nicknameField(body: Record<string, unknown>): string {
  return Array.from(stringField(body, "nickname")).slice(0, 64).join("");
}

function optionalStringField(body: Record<string, unknown>, fieldName: string): string | undefined {
  const value = body[fieldName];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalScheduleTimeField(
  body: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  const value = body[fieldName];

  return typeof value === "string" ? value.trim() : undefined;
}

function stringArrayField(body: Record<string, unknown>, fieldName: string): string[] {
  const value = body[fieldName];

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.flatMap((item) =>
    typeof item === "string" && item.trim().length > 0 ? [item.trim()] : [],
  );
}

function optionalStringArrayField(
  body: Record<string, unknown>,
  fieldName: string,
): string[] | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  return stringArrayField(body, fieldName);
}

function optionalStringOrNullField(
  body: Record<string, unknown>,
  fieldName: string,
): string | null | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  const value = body[fieldName];

  if (value === null) {
    return null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalScheduleTimeOrNullField(
  body: Record<string, unknown>,
  fieldName: string,
): string | null | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  const value = body[fieldName];

  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() : undefined;
}

function optionalNumberField(body: Record<string, unknown>, fieldName: string): number | undefined {
  const value = body[fieldName];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalNumberOrNullField(
  body: Record<string, unknown>,
  fieldName: string,
): number | null | undefined {
  if (!(fieldName in body)) {
    return undefined;
  }

  const value = body[fieldName];

  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBooleanField(
  body: Record<string, unknown>,
  fieldName: string,
): boolean | undefined {
  const value = body[fieldName];

  return typeof value === "boolean" ? value : undefined;
}

function optionalObjectField(
  body: Record<string, unknown>,
  fieldName: string,
): Record<string, unknown> | undefined {
  const value = body[fieldName];

  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
  return fail(
    400,
    "VALIDATION_ERROR",
    error instanceof Error ? error.message : "Invalid request body",
  );
}

function tooManyRequests(retryAfterMs: number) {
  return {
    ...fail(429, "RATE_LIMITED", "Too many requests, try again later"),
    headers: {
      "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
    },
  };
}

function positiveIntegerQuery(url: URL, fieldName: string, fallback: number): number {
  const value = Number(url.searchParams.get(fieldName));

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value.trim().length === 0 ? NaN : Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createFixedWindowRateLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string) {
      const now = Date.now();
      const current = attempts.get(key);

      if (current === undefined || current.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return null;
      }

      if (current.count >= maxAttempts) {
        return tooManyRequests(current.resetAt - now);
      }

      current.count += 1;
      return null;
    },
    reset(key: string) {
      attempts.delete(key);
    },
  };
}

function requestRateLimitKey(
  request: {
    headers: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string | undefined };
  },
  scope: string,
): string {
  return `${scope}:${clientAddressFromRequest(request)}`;
}

function clientAddressFromRequest(request: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | undefined };
}): string {
  if (process.env.MRJZ_RATE_LIMIT_TRUST_PROXY === "1") {
    const forwardedFor = headerValue(request.headers["x-forwarded-for"]);
    const firstForwardedFor = forwardedFor?.split(",")[0]?.trim();

    if (firstForwardedFor !== undefined && firstForwardedFor.length > 0) {
      return firstForwardedFor;
    }
  }

  return request.socket?.remoteAddress ?? "unknown";
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;

  return typeof first === "string" && first.trim().length > 0 ? first.trim() : undefined;
}

function optionalQueryString(url: URL, fieldName: string): string | undefined {
  const value = url.searchParams.get(fieldName)?.trim();

  return value && value.length > 0 ? value : undefined;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
