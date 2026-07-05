import {
  createSyncTask,
  getOpenDotaMatchCache,
  listTournamentPlayerAccountIds,
  listLeagueSyncTargets,
  listRunningLeagueSyncTargets,
  updatePlayerSteamProfiles,
  upsertOpenDotaMatch,
} from "../data/repository.js";
import { OpenDotaClient } from "./client.js";
import { isIgnoredOpenDotaMatch, isIgnoredOpenDotaMatchId } from "./invalidMatches.js";
import { cacheSteamAvatar } from "./steamAvatarCache.js";
import { SteamDotaClient } from "./steamClient.js";
import type {
  OpenDotaLeagueMatch,
  OpenDotaMatchDetail,
  OpenDotaMatchPlayer,
  OpenDotaPlayerMatchSummary,
  SteamLeagueMatch,
} from "./types.js";
import type { LeagueSyncTarget } from "../data/sqliteRepository.js";

export const DEFAULT_OPENDOTA_SYNC_INTERVAL_MS = 10 * 60 * 1000;
export const DEFAULT_STEAM_PROFILE_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type OpenDotaLeagueSyncSummary = {
  checkedLeagues: number;
  discoveredMatches: number;
  fetchedMatches: number;
  skippedParsedMatches: number;
  skippedInvalidMatches: number;
  skippedMismatchedMatches: number;
  parseRequests: number;
  failedMatches: number;
  errors: string[];
};

export type OpenDotaLeagueSyncOptions = {
  client?: OpenDotaClient;
  steamClient?: SteamDotaClient;
  matchLimit?: number;
  now?: Date;
  targets?: LeagueSyncTarget[];
  includeSteamDiscovery?: boolean;
  includeKnownSeeds?: boolean;
  includePlayerDiscovery?: boolean;
};

export type SteamProfileSyncSummary = {
  checkedTournaments: number;
  requestedProfiles: number;
  updatedProfiles: number;
  cachedAvatars: number;
  errors: string[];
};

const KNOWN_MRJZ_IMPORT_SOURCES: Record<number, { matchIds: number[]; seedAccountIds: number[] }> = {
  17485: {
    matchIds: [
      8327792328, 8327821760, 8327905462, 8328982538, 8329062663, 8329149780, 8329198991, 8330235472,
      8330305420, 8330310704, 8330386933, 8330436024, 8330497506, 8331547023, 8331575362, 8331601852,
      8331688974, 8331770997, 8331857989, 8332867226, 8332962777, 8333016991, 8337154327, 8337157874,
      8337199944, 8337240888, 8337261033, 8339721762, 8339803075, 8339878490,
    ],
    seedAccountIds: [],
  },
  18365: {
    matchIds: [8648803512, 8648893129, 8648991740, 8649037382],
    seedAccountIds: [101968048, 123445913, 143573255, 144000083],
  },
  19483: {
    matchIds: [],
    seedAccountIds: [101968048, 143573255, 144000083],
  },
};

export async function runOpenDotaLeagueSync(options: OpenDotaLeagueSyncOptions = {}): Promise<OpenDotaLeagueSyncSummary> {
  return syncOpenDotaTargets({
    ...options,
    targets: options.targets ?? listRunningLeagueSyncTargets(),
    includeSteamDiscovery: options.includeSteamDiscovery ?? false,
    includeKnownSeeds: options.includeKnownSeeds ?? false,
    includePlayerDiscovery: options.includePlayerDiscovery ?? false,
  });
}

export async function runOpenDotaBackfillSync(
  options: OpenDotaLeagueSyncOptions = {},
): Promise<OpenDotaLeagueSyncSummary> {
  const targets = options.targets ?? listLeagueSyncTargets(["completed", "running", "upcoming"]);

  return syncOpenDotaTargets({
    ...options,
    targets,
    includeSteamDiscovery: options.includeSteamDiscovery ?? true,
    includeKnownSeeds: options.includeKnownSeeds ?? true,
    includePlayerDiscovery: options.includePlayerDiscovery ?? true,
    matchLimit: options.matchLimit ?? readPositiveInteger(process.env.OPENDOTA_BACKFILL_MATCH_LIMIT, 1000),
  });
}

async function syncOpenDotaTargets(options: OpenDotaLeagueSyncOptions): Promise<OpenDotaLeagueSyncSummary> {
  const client = options.client ?? new OpenDotaClient();
  const steamClient = options.steamClient ?? new SteamDotaClient();
  const matchLimit = options.matchLimit ?? readPositiveInteger(process.env.OPENDOTA_SYNC_MATCH_LIMIT, 50);
  const requestDelayMs = readNonNegativeInteger(
    process.env.OPENDOTA_REQUEST_DELAY_MS,
    options.includeSteamDiscovery === true ? 1200 : 0,
  );
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const summary: OpenDotaLeagueSyncSummary = {
    checkedLeagues: 0,
    discoveredMatches: 0,
    fetchedMatches: 0,
    skippedParsedMatches: 0,
    skippedInvalidMatches: 0,
    skippedMismatchedMatches: 0,
    parseRequests: 0,
    failedMatches: 0,
    errors: [],
  };

  for (const target of options.targets ?? []) {
    summary.checkedLeagues += 1;

    createSyncTask({
      kind: "discover_match",
      leagueId: target.league.opendotaLeagueId,
      targetType: "league",
      targetId: String(target.league.opendotaLeagueId),
      payload: {
        source: "opendota_worker",
        tournamentId: target.tournamentId,
        intervalMinutes: 10,
        backfill: options.includeSteamDiscovery === true || options.includeKnownSeeds === true,
      },
    });

    const matchIds = await discoverMatchIds(target, client, steamClient, options);
    summary.discoveredMatches += matchIds.length;

    let processedMatches = 0;

    for (const matchId of matchIds) {
      if (isIgnoredOpenDotaMatchId(matchId)) {
        summary.skippedInvalidMatches += 1;
        continue;
      }

      if (processedMatches >= matchLimit) {
        break;
      }

      processedMatches += 1;
      const cached = getOpenDotaMatchCache(matchId);

      if (cached?.parseStatus === "parsed") {
        summary.skippedParsedMatches += 1;
        continue;
      }

      try {
        const match = await client.getMatch(matchId);
        summary.fetchedMatches += 1;

        await sleep(requestDelayMs);

        const actualLeagueId = match.leagueid ?? match.league_id ?? target.league.opendotaLeagueId;

        if (actualLeagueId !== target.league.opendotaLeagueId) {
          summary.skippedMismatchedMatches += 1;
          continue;
        }

        if (isIgnoredOpenDotaMatch(match, matchId)) {
          summary.skippedInvalidMatches += 1;
          continue;
        }

        const parsed = isOpenDotaMatchParsed(match);
        let parseStatus: "requested" | "parsed" | "failed" = parsed ? "parsed" : "requested";
        let requestedAt: string | null = parsed ? null : nowIso;
        let lastError: string | null = null;

        if (!parsed) {
          try {
            await client.requestParse(matchId);
            await sleep(requestDelayMs);
            summary.parseRequests += 1;
            createSyncTask({
              kind: "request_parse",
              leagueId: target.league.opendotaLeagueId,
              targetType: "match",
              targetId: String(matchId),
              payload: {
                source: "opendota_worker",
                tournamentId: target.tournamentId,
              },
            });
          } catch (error) {
            parseStatus = "failed";
            requestedAt = null;
            lastError = errorMessage(error);
            summary.failedMatches += 1;
          }
        }

        upsertOpenDotaMatch({
          matchId,
          leagueId: match.leagueid ?? match.league_id ?? target.league.opendotaLeagueId,
          rawJson: match as unknown as Record<string, unknown>,
          parseStatus,
          requestedAt,
          parsedAt: parsed ? nowIso : null,
          lastError,
        });
      } catch (error) {
        summary.failedMatches += 1;
        summary.errors.push(errorMessage(error));
        upsertOpenDotaMatch({
          matchId,
          leagueId: target.league.opendotaLeagueId,
          rawJson: {
            match_id: matchId,
            league_id: target.league.opendotaLeagueId,
            sync_error: errorMessage(error),
          },
          parseStatus: "failed",
          lastError: errorMessage(error),
        });
      } finally {
        await sleep(requestDelayMs);
      }
    }

  }

  return summary;
}

export async function runSteamProfileSync(options: { steamClient?: SteamDotaClient; targets?: LeagueSyncTarget[] } = {}): Promise<SteamProfileSyncSummary> {
  const steamClient = options.steamClient ?? new SteamDotaClient();
  const targets = options.targets ?? listLeagueSyncTargets(["completed", "running", "upcoming"]);
  const summary: SteamProfileSyncSummary = {
    checkedTournaments: 0,
    requestedProfiles: 0,
    updatedProfiles: 0,
    cachedAvatars: 0,
    errors: [],
  };

  if (!steamClient.available) {
    summary.errors.push("STEAM_API_KEY is not configured");
    return summary;
  }

  for (const target of targets) {
    summary.checkedTournaments += 1;
    const result = await syncSteamProfilesForTournament(target, steamClient);

    summary.requestedProfiles += result.requestedProfiles;
    summary.updatedProfiles += result.updatedProfiles;
    summary.cachedAvatars += result.cachedAvatars;
    summary.errors.push(...result.errors);
  }

  return summary;
}

async function syncSteamProfilesForTournament(
  target: LeagueSyncTarget,
  steamClient: SteamDotaClient,
): Promise<Omit<SteamProfileSyncSummary, "checkedTournaments">> {
  const accountIds = listTournamentPlayerAccountIds(target.tournamentId);
  const summary = {
    requestedProfiles: accountIds.length,
    updatedProfiles: 0,
    cachedAvatars: 0,
    errors: [] as string[],
  };

  if (accountIds.length === 0) {
    return summary;
  }

  try {
    const summaries = await steamClient.getPlayerSummariesByAccountIds(accountIds);
    const profileInputs = summaries.map((summary) => ({
      accountId: summary.accountId,
      steamId64: summary.steamid,
      displayName: summary.personaname ?? null,
      avatarUrl: summary.avatarfull ?? summary.avatarmedium ?? summary.avatar ?? null,
    }));

    summary.updatedProfiles = updatePlayerSteamProfiles(profileInputs);

    for (const profile of profileInputs) {
      try {
        if (await cacheSteamAvatar(profile.accountId, profile.avatarUrl)) {
          summary.cachedAvatars += 1;
        }
      } catch (error) {
        summary.errors.push(`avatar ${profile.accountId}: ${errorMessage(error)}`);
      }
    }
  } catch (error) {
    createSyncTask({
      kind: "refresh_match",
      leagueId: target.league.opendotaLeagueId,
      targetType: "steam_profiles",
      targetId: target.tournamentId,
      payload: {
        source: "steam_profiles",
        error: errorMessage(error),
      },
    });
    summary.errors.push(errorMessage(error));
  }

  return summary;
}

export function startOpenDotaSyncScheduler(): () => void {
  if (process.env.MRJZ_DISABLE_OPENDOTA_WORKER === "1") {
    console.log("OpenDota sync worker disabled by MRJZ_DISABLE_OPENDOTA_WORKER=1");
    return () => undefined;
  }

  const intervalMs = readPositiveInteger(process.env.OPENDOTA_SYNC_INTERVAL_MS, DEFAULT_OPENDOTA_SYNC_INTERVAL_MS);

  if (process.env.OPENDOTA_SYNC_RUN_ON_START === "1") {
    void runOpenDotaLeagueSync().catch((error) => {
      console.error("OpenDota sync worker startup run failed", error);
    });
  }

  const timer = setInterval(() => {
    void runOpenDotaLeagueSync().catch((error) => {
      console.error("OpenDota sync worker run failed", error);
    });
  }, intervalMs);

  timer.unref?.();
  console.log(`OpenDota sync worker scheduled every ${Math.round(intervalMs / 60000)} minutes`);

  return () => clearInterval(timer);
}

export function startSteamProfileSyncScheduler(): () => void {
  if (process.env.MRJZ_DISABLE_STEAM_PROFILE_WORKER === "1") {
    console.log("Steam profile sync worker disabled by MRJZ_DISABLE_STEAM_PROFILE_WORKER=1");
    return () => undefined;
  }

  const steamClient = new SteamDotaClient();

  if (!steamClient.available) {
    console.log("Steam profile sync worker disabled because STEAM_API_KEY is not configured");
    return () => undefined;
  }

  const intervalMs = readPositiveInteger(process.env.STEAM_PROFILE_SYNC_INTERVAL_MS, DEFAULT_STEAM_PROFILE_SYNC_INTERVAL_MS);

  if (process.env.STEAM_PROFILE_SYNC_RUN_ON_START === "1") {
    void runSteamProfileSync({ steamClient }).catch((error) => {
      console.error("Steam profile sync worker startup run failed", error);
    });
  }

  const timer = setInterval(() => {
    void runSteamProfileSync({ steamClient }).catch((error) => {
      console.error("Steam profile sync worker run failed", error);
    });
  }, intervalMs);

  timer.unref?.();
  console.log(`Steam profile sync worker scheduled every ${Math.round(intervalMs / 60000)} minutes`);

  return () => clearInterval(timer);
}

async function discoverMatchIds(
  target: LeagueSyncTarget,
  client: OpenDotaClient,
  steamClient: SteamDotaClient,
  options: OpenDotaLeagueSyncOptions,
): Promise<number[]> {
  const ids = new Set<number>();
  const leagueId = target.league.opendotaLeagueId;

  try {
    for (const matchId of uniqueMatchIds(await client.getLeagueMatches(leagueId))) {
      ids.add(matchId);
    }
  } catch (error) {
    // OpenDota's league list can be empty for excluded amateur leagues; keep other discovery sources alive.
  }

  if (options.includeSteamDiscovery === true) {
    try {
      for (const matchId of uniqueSteamMatchIds(await steamClient.getLeagueMatches(leagueId))) {
        ids.add(matchId);
      }
    } catch (error) {
      // Steam discovery is best-effort because it depends on an API key.
    }
  }

  const knownSource = KNOWN_MRJZ_IMPORT_SOURCES[leagueId];

  if (options.includeKnownSeeds === true) {
    for (const matchId of knownSource?.matchIds ?? []) {
      ids.add(matchId);
    }
  }

  if (options.includePlayerDiscovery === true) {
    const playerLimit = readPositiveInteger(process.env.OPENDOTA_PLAYER_DISCOVERY_MATCH_LIMIT, 80);
    const candidateWindow = discoveryWindow(target);

    for (const accountId of knownSource?.seedAccountIds ?? []) {
      let playerMatches: OpenDotaPlayerMatchSummary[] = [];

      try {
        playerMatches = await client.getPlayerMatches(accountId, playerLimit);
      } catch (error) {
        continue;
      }

      for (const match of playerMatches) {
        if (isCandidatePlayerMatch(match, candidateWindow)) {
          const matchId = match.match_id;

          if (typeof matchId === "number" && Number.isSafeInteger(matchId)) {
            ids.add(matchId);
          }
        }
      }
    }
  }

  return [...ids].sort((left, right) => right - left);
}

function uniqueMatchIds(matches: OpenDotaLeagueMatch[]): number[] {
  const sorted = [...matches].sort((left, right) => (right.start_time ?? 0) - (left.start_time ?? 0));
  const ids = new Set<number>();

  for (const match of sorted) {
    const matchId = match.match_id;

    if (typeof matchId === "number" && Number.isSafeInteger(matchId)) {
      ids.add(matchId);
    }
  }

  return [...ids];
}

function uniqueSteamMatchIds(matches: SteamLeagueMatch[]): number[] {
  const sorted = [...matches].sort((left, right) => (right.start_time ?? 0) - (left.start_time ?? 0));
  const ids = new Set<number>();

  for (const match of sorted) {
    const matchId = match.match_id;

    if (typeof matchId === "number" && Number.isSafeInteger(matchId)) {
      ids.add(matchId);
    }
  }

  return [...ids];
}

function discoveryWindow(target: LeagueSyncTarget): { min: number; max: number } {
  const daySeconds = 24 * 60 * 60;
  const startsAt = target.startsAt === null ? 0 : Math.floor(Date.parse(target.startsAt) / 1000);
  const endsAt =
    target.endsAt === null ? Math.floor(Date.now() / 1000) + 7 * daySeconds : Math.floor(Date.parse(target.endsAt) / 1000);

  return {
    min: Number.isFinite(startsAt) ? startsAt - 14 * daySeconds : 0,
    max: Number.isFinite(endsAt) ? endsAt + 14 * daySeconds : Math.floor(Date.now() / 1000) + 7 * daySeconds,
  };
}

function isCandidatePlayerMatch(
  match: OpenDotaPlayerMatchSummary,
  window: { min: number; max: number },
): boolean {
  const startTime = match.start_time;

  return (
    typeof startTime === "number" &&
    startTime >= window.min &&
    startTime <= window.max &&
    match.match_id !== undefined &&
    Number.isSafeInteger(match.match_id) &&
    (match.lobby_type === 1 || match.game_mode === 4)
  );
}

function isOpenDotaMatchParsed(match: OpenDotaMatchDetail): boolean {
  const players = match.players ?? [];

  return (
    match.version !== undefined &&
    (Array.isArray(match.picks_bans) ||
      Array.isArray(match.chat) ||
      players.some((player) => hasParsedPlayerSignals(player)))
  );
}

function hasParsedPlayerSignals(player: OpenDotaMatchPlayer): boolean {
  return (
    Array.isArray(player.ability_upgrades_arr) ||
    Array.isArray(player.ability_upgrades) ||
    Array.isArray(player.gold_t) ||
    Array.isArray(player.xp_t) ||
    Array.isArray(player.obs_log) ||
    Array.isArray(player.sen_log)
  );
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
