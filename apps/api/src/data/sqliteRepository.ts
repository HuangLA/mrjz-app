import { openDatabase, parseJson, resolveDatabasePath } from "../db/client.js";
import { normalizeOpenDotaMatchDetail } from "../opendota/normalizers/matchDetail.js";
import type { OpenDotaMatchDetail, OpenDotaMatchPlayer } from "../opendota/types.js";
import type {
  BracketNode,
  SeriesSummary,
  StageRound,
  StageSummary,
  StandingRow,
  TournamentDetail,
  TournamentListItem,
} from "../view-models/tournament.js";
import type {
  LeagueBrief,
  MatchDetailContext,
  RoundBrief,
  SeriesContext,
  StageBrief,
  TeamBrief,
  TeamSide,
  TournamentBrief,
} from "../view-models/matchDetail.js";

type DbRow = Record<string, unknown>;

export type RepositoryInfo = {
  dataSource: "sqlite";
  databasePath: string;
};

export type LeagueOption = LeagueBrief & {
  tournamentCount: number;
  latestTournamentId: string | null;
};

export type TournamentLifecycleStatus = "draft" | "upcoming" | "running" | "completed" | "archived";

export type RunningLeagueSyncTarget = {
  tournamentId: string;
  tournamentName: string;
  status: TournamentLifecycleStatus;
  startsAt: string | null;
  endsAt: string | null;
  league: LeagueBrief;
};

export type LeagueSyncTarget = RunningLeagueSyncTarget;

export type OpenDotaMatchCache = {
  matchId: number;
  leagueId: number | null;
  parseStatus: "requested" | "parsed" | "failed";
  requestedAt: string | null;
  parsedAt: string | null;
  lastError: string | null;
};

export type UpsertOpenDotaMatchInput = {
  matchId: number;
  leagueId?: number | null;
  rawJson: Record<string, unknown>;
  parseStatus: "requested" | "parsed" | "failed";
  requestedAt?: string | null;
  parsedAt?: string | null;
  lastError?: string | null;
};

export type OpenDotaMatchListItem = {
  matchId: number;
  leagueId: number | null;
  leagueName: string;
  tournamentId: string;
  tournamentName: string;
  parseStatus: "requested" | "parsed" | "failed";
  startTime: string | null;
  durationSeconds: number | null;
  durationText: string | null;
  gameMode: number | null;
  radiantWin: boolean | null;
  radiantScore: number | null;
  direScore: number | null;
  radiantTeamName: string;
  direTeamName: string;
  playerCount: number;
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
  linkedSeries: LinkedSeriesBrief | null;
  updatedAt: string;
};

export type LinkedSeriesBrief = {
  seriesId: string;
  stageId: string;
  roundId: string;
  gameIndex: number;
  status: string;
  radiantTeam: TeamBrief;
  direTeam: TeamBrief;
};

export type HeroPickSummary = {
  heroId: number;
  picks: number;
  wins: number;
};

export type TeamStatsSummary = {
  seriesPlayed: number;
  seriesWins: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  linkedMatches: number;
  winRate: number | null;
  topHeroes: HeroPickSummary[];
};

export type PlayerBrief = {
  id: string;
  accountId: number | null;
  displayName: string;
  avatarUrl: string | null;
  currentTeam: TeamBrief | null;
};

export type TournamentTeamListItem = TeamBrief & {
  tournamentId: string;
  seed: number | null;
  status: string;
  memberCount: number;
  members: PlayerBrief[];
  stats: TeamStatsSummary;
};

export type TournamentPlayerListItem = PlayerBrief & {
  teams: TeamBrief[];
};

export type SyncTaskView = {
  id: string;
  kind: string;
  status: string;
  leagueId: number | null;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  lastError: string | null;
  nextRunAt: string | null;
  updatedAt: string;
};

export type CreateTeamInput = {
  name: string;
  shortName?: string;
  color?: string;
  tournamentId?: string;
};

export type CreatePlayerInput = {
  displayName: string;
  accountId?: number | null;
  currentTeamId?: string | null;
  avatarUrl?: string | null;
};

export type AddTeamMemberInput = {
  teamId: string;
  playerId: string;
  role?: string;
};

export type CreateTournamentInput = {
  name: string;
  seasonName?: string;
  opendotaLeagueId: number;
  startsAt?: string;
  status?: TournamentLifecycleStatus;
};

export type CreateStageInput = {
  tournamentId: string;
  type: "group" | "swiss" | "knockout";
  name: string;
  advancementRule?: string;
  sortOrder?: number;
};

export type UpdateTournamentLifecycleInput = {
  status: TournamentLifecycleStatus;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type CreateRoundInput = {
  stageId: string;
  name: string;
  roundNumber?: number;
  status?: "draft" | "published" | "running" | "completed" | "locked";
  pairingStatus?: "draft" | "published" | "confirmed";
};

export type CreateSeriesInput = {
  stageId: string;
  roundId: string;
  boType: SeriesSummary["boType"];
  scheduledAt?: string;
  radiantTeamId: string;
  direTeamId: string;
};

export type UpdateGameResultInput = {
  matchId?: number | null;
  radiantScore?: number | null;
  direScore?: number | null;
  winnerTeamId?: string | null;
};

export type CreateSyncTaskInput = {
  kind: "discover_match" | "request_parse" | "refresh_match" | "schedule_link";
  leagueId?: number | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
};

export type LinkOpenDotaMatchInput = {
  stageId?: string;
  roundId?: string;
  roundName?: string;
  boType?: SeriesSummary["boType"];
  scheduledAt?: string;
  radiantTeamId: string;
  direTeamId: string;
};

export class SqliteTournamentRepository {
  readonly info: RepositoryInfo = {
    dataSource: "sqlite",
    databasePath: resolveDatabasePath(),
  };

  private readonly database = openDatabase();

  dispose(): void {
    this.database.close();
  }

  listTournaments(): TournamentListItem[] {
    return this.tournamentRows().map((row) => this.mapTournamentSummary(row));
  }

  createTournament(input: CreateTournamentInput): TournamentDetail {
    const name = requiredString(input.name, "name");
    const opendotaLeagueId = requiredPositiveInteger(input.opendotaLeagueId, "opendotaLeagueId");
    const status = input.status ?? "upcoming";
    const startsAt = input.startsAt ?? new Date().toISOString();
    const slug = this.uniqueSlug(name, opendotaLeagueId);
    const seasonName = input.seasonName?.trim() || name;
    const leagueId = uniqueId("league", `${slug}-${opendotaLeagueId}`);
    const seasonId = uniqueId("season", seasonName);
    const tournamentId = uniqueId("tournament", slug);
    const stageId = uniqueId("stage", `${slug}-records`);
    const stageStatus = status === "completed" ? "completed" : status === "running" ? "running" : "draft";

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare("INSERT INTO leagues (id, name, opendota_league_id) VALUES (?, ?, ?)")
        .run(leagueId, name, opendotaLeagueId);
      this.database
        .prepare("INSERT INTO seasons (id, name, starts_at, ends_at) VALUES (?, ?, ?, ?)")
        .run(seasonId, seasonName, startsAt, null);
      this.database
        .prepare(
          `
            INSERT INTO tournaments (
              id, season_id, league_id, current_stage_id, name, slug, status, visibility, starts_at, ends_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'public', ?, NULL)
          `,
        )
        .run(tournamentId, seasonId, leagueId, stageId, name, slug, status, startsAt);
      this.database
        .prepare(
          `
            INSERT INTO stages (id, tournament_id, type, name, status, sort_order, advancement_rule)
            VALUES (?, ?, 'group', '真实比赛记录', ?, 1, ?)
          `,
        )
        .run(stageId, tournamentId, stageStatus, "先承载 OpenDota 已同步比赛；后续可继续新增小组赛、瑞士轮或淘汰赛阶段。");

      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const created = this.getTournamentDetail(tournamentId);

    if (created === undefined) {
      throw new Error("Created tournament could not be loaded");
    }

    return created;
  }

  getTournamentDetail(id: string): TournamentDetail | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            t.*,
            l.id AS league_id,
            l.name AS league_name,
            l.opendota_league_id,
            se.id AS season_id,
            se.name AS season_name
          FROM tournaments t
          JOIN leagues l ON l.id = t.league_id
          JOIN seasons se ON se.id = t.season_id
          WHERE t.id = ? OR t.slug = ?
        `,
      )
      .get(id, id);

    if (row === undefined) {
      return undefined;
    }

    const summary = this.mapTournamentSummary(row);
    const stages = this.getStagesByTournamentId(summary.id);

    return {
      ...summary,
      visibility: text(row, "visibility") as TournamentDetail["visibility"],
      currentStageId: text(row, "current_stage_id"),
      stages,
      nextSeries: this.getNextSeries(summary.id),
      latestResult: this.getLatestResult(summary.id),
    };
  }

  getStageStandings(stageId: string): StandingRow[] | undefined {
    const rows = this.database
      .prepare(
        `
          SELECT
            st.*,
            tm.id AS team_id,
            tm.name AS team_name,
            tm.short_name AS team_short_name,
            tm.logo_url AS team_logo_url,
            tm.color AS team_color
          FROM standings st
          JOIN teams tm ON tm.id = st.team_id
          WHERE st.stage_id = ?
          ORDER BY st.rank ASC
        `,
      )
      .all(stageId);

    if (rows.length === 0) {
      return undefined;
    }

    return rows.map((row) => ({
      id: text(row, "id"),
      rank: numberValue(row, "rank"),
      team: teamFromPrefixedRow(row, "team"),
      groupName: nullableText(row, "group_name"),
      seriesPlayed: numberValue(row, "series_played"),
      seriesWins: numberValue(row, "series_wins"),
      seriesDraws: numberValue(row, "series_draws"),
      seriesLosses: numberValue(row, "series_losses"),
      gameWins: numberValue(row, "game_wins"),
      gameLosses: numberValue(row, "game_losses"),
      points: numberValue(row, "points"),
      opponentScore: numberValue(row, "opponent_score"),
      headToHeadScore: numberValue(row, "head_to_head_score"),
      manualRank: nullableNumber(row, "manual_rank"),
      status: text(row, "status") as StandingRow["status"],
    }));
  }

  getStageRounds(stageId: string): StageRound[] | undefined {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM rounds
          WHERE stage_id = ?
          ORDER BY round_number ASC
        `,
      )
      .all(stageId);

    if (rows.length === 0) {
      return undefined;
    }

    return rows.map((row) => ({
      ...roundFromRow(row),
      pairingStatus: text(row, "pairing_status") as StageRound["pairingStatus"],
      series: this.getSeriesByRoundId(text(row, "id")),
    }));
  }

  getStageBracket(stageId: string): BracketNode[] | undefined {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM bracket_nodes
          WHERE stage_id = ?
          ORDER BY round_number ASC, position ASC
        `,
      )
      .all(stageId);

    if (rows.length === 0) {
      return undefined;
    }

    return rows.map((row) => {
      const seriesId = nullableText(row, "series_id");

      return {
        id: text(row, "id"),
        stageId: text(row, "stage_id"),
        roundNumber: numberValue(row, "round_number"),
        roundName: text(row, "round_name"),
        position: numberValue(row, "position"),
        status: text(row, "status") as BracketNode["status"],
        series: seriesId === null ? null : this.getSeriesById(seriesId) ?? null,
        nextNodeId: nullableText(row, "next_node_id"),
        nextSlot: nullableText(row, "next_slot") as BracketNode["nextSlot"],
        winnerTeamId: nullableText(row, "winner_team_id"),
      };
    });
  }

  getMatchDetail(matchIdParam: string) {
    const matchId = Number(matchIdParam);

    if (!Number.isSafeInteger(matchId)) {
      return undefined;
    }

    const row = this.database.prepare("SELECT raw_json FROM opendota_matches WHERE match_id = ?").get(matchId);

    if (row === undefined) {
      return undefined;
    }

    const rawMatch = parseJson<OpenDotaMatchDetail | null>(row.raw_json, null);

    if (rawMatch === null) {
      return undefined;
    }

    return normalizeOpenDotaMatchDetail(rawMatch, this.getMatchContextByMatchId(matchId));
  }

  listLeagues(): LeagueOption[] {
    return this.database
      .prepare(
        `
          SELECT
            l.id,
            l.name,
            l.opendota_league_id,
            COUNT(t.id) AS tournament_count,
            (
              SELECT t2.id
              FROM tournaments t2
              WHERE t2.league_id = l.id
              ORDER BY t2.starts_at DESC, t2.id ASC
              LIMIT 1
            ) AS latest_tournament_id
          FROM leagues l
          LEFT JOIN tournaments t ON t.league_id = l.id
          GROUP BY l.id
          ORDER BY l.opendota_league_id ASC
        `,
      )
      .all()
      .map((row) => ({
        id: text(row, "id"),
        name: text(row, "name"),
        opendotaLeagueId: numberValue(row, "opendota_league_id"),
        tournamentCount: numberValue(row, "tournament_count"),
        latestTournamentId: nullableText(row, "latest_tournament_id"),
      }));
  }

  listSyncTasks(): SyncTaskView[] {
    return this.database
      .prepare(
        `
          SELECT *
          FROM sync_tasks
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 100
        `,
      )
      .all()
      .map((row) => ({
        id: text(row, "id"),
        kind: text(row, "kind"),
        status: text(row, "status"),
        leagueId: nullableNumber(row, "league_id"),
        targetType: nullableText(row, "target_type"),
        targetId: nullableText(row, "target_id"),
        payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
        attempts: numberValue(row, "attempts"),
        lastError: nullableText(row, "last_error"),
        nextRunAt: nullableText(row, "next_run_at"),
        updatedAt: text(row, "updated_at"),
      }));
  }

  listRunningLeagueSyncTargets(): RunningLeagueSyncTarget[] {
    return this.listLeagueSyncTargets(["running"]);
  }

  listLeagueSyncTargets(statuses?: TournamentLifecycleStatus[]): LeagueSyncTarget[] {
    const statusFilter =
      statuses === undefined || statuses.length === 0
        ? ""
        : `WHERE t.status IN (${statuses.map(() => "?").join(", ")})`;

    return this.database
      .prepare(
        `
          SELECT
            t.id AS tournament_id,
            t.name AS tournament_name,
            t.status,
            t.starts_at,
            t.ends_at,
            l.id AS league_id,
            l.name AS league_name,
            l.opendota_league_id
          FROM tournaments t
          JOIN leagues l ON l.id = t.league_id
          ${statusFilter}
          ORDER BY t.starts_at ASC, t.id ASC
        `,
      )
      .all(...(statuses ?? []))
      .map((row) => ({
        tournamentId: text(row, "tournament_id"),
        tournamentName: text(row, "tournament_name"),
        status: text(row, "status") as TournamentLifecycleStatus,
        startsAt: nullableText(row, "starts_at"),
        endsAt: nullableText(row, "ends_at"),
        league: {
          id: text(row, "league_id"),
          name: text(row, "league_name"),
          opendotaLeagueId: numberValue(row, "opendota_league_id"),
        },
      }));
  }

  listTournamentOpenDotaMatches(tournamentId: string, limit = 100): OpenDotaMatchListItem[] | undefined {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return undefined;
    }

    const rows = this.database
      .prepare(
        `
          SELECT match_id, league_id, raw_json, parse_status, updated_at
          FROM opendota_matches
          WHERE league_id = ?
          ORDER BY updated_at DESC
        `,
      )
      .all(target.league.opendotaLeagueId);

    return rows
      .map((row) => this.mapOpenDotaMatchListItem(row, target))
      .sort((left, right) => dateSortValue(right.startTime) - dateSortValue(left.startTime))
      .slice(0, Math.max(1, limit));
  }

  listTournamentTeams(tournamentId: string): TournamentTeamListItem[] | undefined {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return undefined;
    }

    return this.database
      .prepare(
        `
          SELECT
            tt.tournament_id,
            tt.seed,
            tt.status,
            tm.id AS team_team_id,
            tm.name AS team_team_name,
            tm.short_name AS team_team_short_name,
            tm.logo_url AS team_team_logo_url,
            tm.color AS team_team_color
          FROM tournament_teams tt
          JOIN teams tm ON tm.id = tt.team_id
          WHERE tt.tournament_id = ?
          ORDER BY tt.seed ASC, tm.name ASC
        `,
      )
      .all(target.tournamentId)
      .map((row) => {
        const team = teamFromPrefixedRow(row, "team");
        const members = this.getTeamMembers(team.id);

        return {
          ...team,
          tournamentId: text(row, "tournament_id"),
          seed: nullableNumber(row, "seed"),
          status: text(row, "status"),
          memberCount: members.length,
          members,
          stats: this.calculateTeamStats(target.tournamentId, team.id),
        };
      });
  }

  listTournamentPlayers(tournamentId: string): TournamentPlayerListItem[] | undefined {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return undefined;
    }

    return this.database
      .prepare(
        `
          SELECT DISTINCT p.*
          FROM players p
          LEFT JOIN team_members tm ON tm.player_id = p.id
          LEFT JOIN tournament_teams tt ON tt.team_id = tm.team_id OR tt.team_id = p.current_team_id
          WHERE tt.tournament_id = ?
          ORDER BY p.display_name ASC, p.id ASC
        `,
      )
      .all(target.tournamentId)
      .map((row) => {
        const player = this.playerFromRow(row);

        return {
          ...player,
          teams: this.getPlayerTeams(player.id),
        };
      });
  }

  getOpenDotaMatchCache(matchId: number): OpenDotaMatchCache | undefined {
    const row = this.database
      .prepare(
        `
          SELECT match_id, league_id, parse_status, requested_at, parsed_at, last_error
          FROM opendota_matches
          WHERE match_id = ?
        `,
      )
      .get(matchId);

    return row === undefined
      ? undefined
      : {
          matchId: numberValue(row, "match_id"),
          leagueId: nullableNumber(row, "league_id"),
          parseStatus: text(row, "parse_status") as OpenDotaMatchCache["parseStatus"],
          requestedAt: nullableText(row, "requested_at"),
          parsedAt: nullableText(row, "parsed_at"),
          lastError: nullableText(row, "last_error"),
        };
  }

  upsertOpenDotaMatch(input: UpsertOpenDotaMatchInput): OpenDotaMatchCache {
    const now = new Date().toISOString();

    this.database
      .prepare(
        `
          INSERT INTO opendota_matches (
            match_id, league_id, raw_json, parse_status, requested_at, parsed_at, last_error, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(match_id) DO UPDATE SET
            league_id = excluded.league_id,
            raw_json = excluded.raw_json,
            parse_status = excluded.parse_status,
            requested_at = COALESCE(excluded.requested_at, opendota_matches.requested_at),
            parsed_at = COALESCE(excluded.parsed_at, opendota_matches.parsed_at),
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        input.matchId,
        input.leagueId ?? null,
        JSON.stringify(input.rawJson),
        input.parseStatus,
        input.requestedAt ?? null,
        input.parsedAt ?? null,
        input.lastError ?? null,
        now,
      );

    const cached = this.getOpenDotaMatchCache(input.matchId);

    if (cached === undefined) {
      throw new Error("OpenDota match cache could not be loaded after upsert");
    }

    return cached;
  }

  updateTournamentLifecycle(tournamentId: string, input: UpdateTournamentLifecycleInput): TournamentDetail {
    const id = requiredString(tournamentId, "tournamentId");
    const row = this.database.prepare("SELECT starts_at, ends_at FROM tournaments WHERE id = ? OR slug = ?").get(id, id);

    if (row === undefined) {
      throw new Error("Tournament not found");
    }

    const startsAt = input.startsAt === undefined ? nullableText(row, "starts_at") : input.startsAt;
    const currentEndsAt = nullableText(row, "ends_at");
    const endsAt =
      input.endsAt !== undefined
        ? input.endsAt
        : input.status === "completed"
          ? currentEndsAt ?? new Date().toISOString()
          : input.status === "archived"
            ? currentEndsAt
            : null;

    this.database
      .prepare(
        `
          UPDATE tournaments
          SET
            status = ?,
            starts_at = ?,
            ends_at = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? OR slug = ?
        `,
      )
      .run(input.status, startsAt, endsAt, id, id);

    const updated = this.getTournamentDetail(id);

    if (updated === undefined) {
      throw new Error("Updated tournament could not be loaded");
    }

    return updated;
  }

  createTeam(input: CreateTeamInput): TeamBrief {
    const name = requiredString(input.name, "name");
    const shortName = normalizeShortName(input.shortName ?? name);
    const id = uniqueId("team", `${name}-${shortName}`);
    const color = input.color ?? "#64748b";

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare("INSERT INTO teams (id, name, short_name, logo_url, color) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, shortName, null, color);

      if (input.tournamentId !== undefined && input.tournamentId.length > 0) {
        this.database
          .prepare("INSERT OR IGNORE INTO tournament_teams (tournament_id, team_id, seed) VALUES (?, ?, ?)")
          .run(input.tournamentId, id, this.nextTournamentSeed(input.tournamentId));
      }

      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return {
      id,
      name,
      shortName,
      logoUrl: null,
      color,
    };
  }

  createPlayer(input: CreatePlayerInput): PlayerBrief {
    const displayName = requiredString(input.displayName, "displayName");
    const accountId =
      input.accountId === undefined || input.accountId === null
        ? null
        : requiredPositiveInteger(input.accountId, "accountId");
    const currentTeamId = input.currentTeamId?.trim() || null;
    const avatarUrl = input.avatarUrl?.trim() || null;
    const id = uniqueId("player", `${accountId ?? "manual"}-${displayName}`);

    if (currentTeamId !== null) {
      this.requireTeam(currentTeamId);
    }

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            INSERT INTO players (id, account_id, display_name, current_team_id, avatar_url)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(id, accountId, displayName, currentTeamId, avatarUrl);

      if (currentTeamId !== null) {
        this.database
          .prepare("INSERT OR IGNORE INTO team_members (team_id, player_id, role, joined_at) VALUES (?, ?, 'player', ?)")
          .run(currentTeamId, id, new Date().toISOString());
      }

      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const player = this.getPlayerById(id);

    if (player === undefined) {
      throw new Error("Created player could not be loaded");
    }

    return player;
  }

  addTeamMember(input: AddTeamMemberInput): TournamentTeamListItem | undefined {
    const teamId = requiredString(input.teamId, "teamId");
    const playerId = requiredString(input.playerId, "playerId");
    const role = input.role?.trim() || "player";
    const team = this.requireTeam(teamId);

    this.requirePlayer(playerId);

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare("INSERT OR IGNORE INTO team_members (team_id, player_id, role, joined_at) VALUES (?, ?, ?, ?)")
        .run(teamId, playerId, role, new Date().toISOString());
      this.database
        .prepare("UPDATE players SET current_team_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .run(teamId, playerId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const row = this.database
      .prepare(
        `
          SELECT tt.tournament_id
          FROM tournament_teams tt
          WHERE tt.team_id = ?
          ORDER BY tt.seed ASC
          LIMIT 1
        `,
      )
      .get(teamId);

    if (row === undefined) {
      return undefined;
    }

    return {
      ...team,
      tournamentId: text(row, "tournament_id"),
      seed: null,
      status: "active",
      memberCount: this.getTeamMembers(team.id).length,
      members: this.getTeamMembers(team.id),
      stats: this.calculateTeamStats(text(row, "tournament_id"), team.id),
    };
  }

  createStage(input: CreateStageInput): StageSummary {
    const tournamentId = requiredString(input.tournamentId, "tournamentId");
    const name = requiredString(input.name, "name");
    const id = uniqueId("stage", `${tournamentId}-${input.type}-${name}`);
    const sortOrder = input.sortOrder ?? this.nextStageSortOrder(tournamentId);
    const advancementRule = input.advancementRule ?? defaultAdvancementRule(input.type);

    this.database
      .prepare(
        `
          INSERT INTO stages (id, tournament_id, type, name, status, sort_order, advancement_rule)
          VALUES (?, ?, ?, ?, 'draft', ?, ?)
        `,
      )
      .run(id, tournamentId, input.type, name, sortOrder, advancementRule);

    return this.getStageSummaryById(id) ?? {
      id,
      tournamentId,
      type: input.type,
      name,
      status: "draft",
      sortOrder,
      advancementRule,
      activeRound: null,
    };
  }

  createRound(input: CreateRoundInput): StageRound {
    const stageId = requiredString(input.stageId, "stageId");
    const name = requiredString(input.name, "name");
    const roundNumber = input.roundNumber ?? this.nextRoundNumber(stageId);
    const status = input.status ?? "draft";
    const pairingStatus = input.pairingStatus ?? "draft";
    const id = uniqueId("round", `${stageId}-${roundNumber}-${name}`);

    this.database
      .prepare(
        `
          INSERT INTO rounds (id, stage_id, round_number, name, status, pairing_status)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(id, stageId, roundNumber, name, status, pairingStatus);

    return {
      id,
      stageId,
      roundNumber,
      name,
      status,
      pairingStatus,
      series: [],
    };
  }

  createSeries(input: CreateSeriesInput): SeriesSummary {
    const stageId = requiredString(input.stageId, "stageId");
    const roundId = requiredString(input.roundId, "roundId");
    const radiantTeamId = requiredString(input.radiantTeamId, "radiantTeamId");
    const direTeamId = requiredString(input.direTeamId, "direTeamId");
    const id = uniqueId("series", `${roundId}-${radiantTeamId}-${direTeamId}-${Date.now()}`);
    const scheduledAt = input.scheduledAt ?? new Date().toISOString();

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            INSERT INTO series (
              id, round_id, stage_id, bo_type, status, scheduled_at, radiant_team_id, dire_team_id
            )
            VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)
          `,
        )
        .run(id, roundId, stageId, input.boType, scheduledAt, radiantTeamId, direTeamId);

      const gameCount = gameCountForBo(input.boType);
      const gameInsert = this.database.prepare(`
        INSERT INTO series_games (id, series_id, game_index)
        VALUES (?, ?, ?)
      `);

      for (let gameIndex = 1; gameIndex <= gameCount; gameIndex += 1) {
        gameInsert.run(`${id}_g${gameIndex}`, id, gameIndex);
      }

      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const series = this.getSeriesById(id);

    if (series === undefined) {
      throw new Error("Created series could not be loaded");
    }

    return series;
  }

  updateSeriesGameResult(seriesId: string, gameIndex: number, input: UpdateGameResultInput): SeriesSummary {
    const series = this.getSeriesById(seriesId);

    if (series === undefined) {
      throw new Error("Series not found");
    }

    const radiantScore = input.radiantScore ?? null;
    const direScore = input.direScore ?? null;
    const winnerTeamId = input.winnerTeamId ?? inferWinnerTeamId(series, radiantScore, direScore);
    const matchId = input.matchId ?? null;

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            UPDATE series_games
            SET
              match_id = ?,
              radiant_score = ?,
              dire_score = ?,
              winner_team_id = ?,
              parse_status = CASE WHEN ? IS NULL THEN parse_status ELSE 'requested' END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE series_id = ? AND game_index = ?
          `,
        )
        .run(matchId, radiantScore, direScore, winnerTeamId, matchId, seriesId, gameIndex);

      this.recalculateSeriesScore(seriesId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const updated = this.getSeriesById(seriesId);

    if (updated === undefined) {
      throw new Error("Updated series could not be loaded");
    }

    return updated;
  }

  linkOpenDotaMatchToSeries(
    tournamentId: string,
    matchId: number,
    input: LinkOpenDotaMatchInput,
  ): SeriesSummary {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      throw new Error("Tournament not found");
    }

    const matchRow = this.database
      .prepare("SELECT raw_json FROM opendota_matches WHERE match_id = ? AND league_id = ?")
      .get(matchId, target.league.opendotaLeagueId);

    if (matchRow === undefined) {
      throw new Error("OpenDota match not found for this tournament");
    }

    const rawMatch = parseJson<OpenDotaMatchDetail | null>(matchRow.raw_json, null);

    if (rawMatch === null) {
      throw new Error("OpenDota match raw_json is invalid");
    }

    const radiantTeamId = requiredString(input.radiantTeamId, "radiantTeamId");
    const direTeamId = requiredString(input.direTeamId, "direTeamId");

    if (radiantTeamId === direTeamId) {
      throw new Error("radiantTeamId and direTeamId must be different");
    }

    this.ensureTournamentTeam(target.tournamentId, radiantTeamId);
    this.ensureTournamentTeam(target.tournamentId, direTeamId);

    const stageId = this.resolveStageForTournament(target.tournamentId, input.stageId);
    const roundId = this.resolveRoundForStage(stageId, input.roundId, input.roundName);
    const boType = input.boType ?? "BO1";
    const scheduledAt = input.scheduledAt ?? matchStartTime(rawMatch) ?? new Date().toISOString();
    const radiantScore = typeof rawMatch.radiant_score === "number" ? rawMatch.radiant_score : null;
    const direScore = typeof rawMatch.dire_score === "number" ? rawMatch.dire_score : null;
    const winnerTeamId =
      typeof rawMatch.radiant_win === "boolean" ? (rawMatch.radiant_win ? radiantTeamId : direTeamId) : null;
    const existing = this.database.prepare("SELECT series_id FROM series_games WHERE match_id = ?").get(matchId);
    const seriesId = existing === undefined ? uniqueId("series", `${roundId}-${matchId}`) : text(existing, "series_id");

    this.database.exec("BEGIN;");

    try {
      if (existing === undefined) {
        this.database
          .prepare(
            `
              INSERT INTO series (
                id, round_id, stage_id, bo_type, status, scheduled_at, radiant_team_id, dire_team_id
              )
              VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)
            `,
          )
          .run(seriesId, roundId, stageId, boType, scheduledAt, radiantTeamId, direTeamId);
        this.database
          .prepare(
            `
              INSERT INTO series_games (
                id, series_id, game_index, match_id, radiant_score, dire_score, winner_team_id, parse_status
              )
              VALUES (?, ?, 1, ?, ?, ?, ?, 'parsed')
            `,
          )
          .run(`${seriesId}_g1`, seriesId, matchId, radiantScore, direScore, winnerTeamId);
      } else {
        this.database
          .prepare(
            `
              UPDATE series
              SET
                round_id = ?,
                stage_id = ?,
                bo_type = ?,
                scheduled_at = ?,
                radiant_team_id = ?,
                dire_team_id = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE id = ?
            `,
          )
          .run(roundId, stageId, boType, scheduledAt, radiantTeamId, direTeamId, seriesId);
        this.database
          .prepare(
            `
              UPDATE series_games
              SET
                game_index = 1,
                radiant_score = ?,
                dire_score = ?,
                winner_team_id = ?,
                parse_status = 'parsed',
                conflict_status = 'none',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE series_id = ? AND match_id = ?
            `,
          )
          .run(radiantScore, direScore, winnerTeamId, seriesId, matchId);
      }

      this.upsertPlayersFromMatch(rawMatch, radiantTeamId, direTeamId);
      this.recalculateSeriesScore(seriesId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const series = this.getSeriesById(seriesId);

    if (series === undefined) {
      throw new Error("Linked series could not be loaded");
    }

    return series;
  }

  createSyncTask(input: CreateSyncTaskInput): SyncTaskView {
    const id = uniqueId("sync", `${input.kind}-${input.targetId ?? input.leagueId ?? Date.now()}`);

    this.database
      .prepare(
        `
          INSERT INTO sync_tasks (
            id, kind, status, league_id, target_type, target_id, payload_json, attempts
          )
          VALUES (?, ?, 'queued', ?, ?, ?, ?, 0)
        `,
      )
      .run(
        id,
        input.kind,
        input.leagueId ?? null,
        input.targetType ?? null,
        input.targetId ?? null,
        JSON.stringify(input.payload ?? {}),
      );

    return this.listSyncTasks().find((task) => task.id === id) ?? {
      id,
      kind: input.kind,
      status: "queued",
      leagueId: input.leagueId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      payload: input.payload ?? {},
      attempts: 0,
      lastError: null,
      nextRunAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private uniqueSlug(name: string, opendotaLeagueId: number): string {
    const base = slugify(name) || `league-${opendotaLeagueId}`;
    let slug = base;
    let suffix = 2;

    while (this.database.prepare("SELECT 1 FROM tournaments WHERE slug = ?").get(slug) !== undefined) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private requireTeam(teamId: string): TeamBrief {
    const row = this.database
      .prepare(
        `
          SELECT
            id AS team_team_id,
            name AS team_team_name,
            short_name AS team_team_short_name,
            logo_url AS team_team_logo_url,
            color AS team_team_color
          FROM teams
          WHERE id = ?
        `,
      )
      .get(teamId);

    if (row === undefined) {
      throw new Error("Team not found");
    }

    return teamFromPrefixedRow(row, "team");
  }

  private requirePlayer(playerId: string): PlayerBrief {
    const player = this.getPlayerById(playerId);

    if (player === undefined) {
      throw new Error("Player not found");
    }

    return player;
  }

  private ensureTournamentTeam(tournamentId: string, teamId: string): void {
    this.requireTeam(teamId);

    this.database
      .prepare("INSERT OR IGNORE INTO tournament_teams (tournament_id, team_id, seed) VALUES (?, ?, ?)")
      .run(tournamentId, teamId, this.nextTournamentSeed(tournamentId));
  }

  private getPlayerById(playerId: string): PlayerBrief | undefined {
    const row = this.database.prepare("SELECT * FROM players WHERE id = ?").get(playerId);

    return row === undefined ? undefined : this.playerFromRow(row);
  }

  private playerFromRow(row: DbRow): PlayerBrief {
    const currentTeamId = nullableText(row, "current_team_id");

    return {
      id: text(row, "id"),
      accountId: nullableNumber(row, "account_id"),
      displayName: text(row, "display_name"),
      avatarUrl: nullableText(row, "avatar_url"),
      currentTeam: currentTeamId === null ? null : this.requireTeam(currentTeamId),
    };
  }

  private getTeamMembers(teamId: string): PlayerBrief[] {
    return this.database
      .prepare(
        `
          SELECT p.*
          FROM team_members tm
          JOIN players p ON p.id = tm.player_id
          WHERE tm.team_id = ? AND tm.left_at IS NULL
          ORDER BY tm.role ASC, p.display_name ASC
        `,
      )
      .all(teamId)
      .map((row) => this.playerFromRow(row));
  }

  private getPlayerTeams(playerId: string): TeamBrief[] {
    return this.database
      .prepare(
        `
          SELECT
            tm2.id AS team_team_id,
            tm2.name AS team_team_name,
            tm2.short_name AS team_team_short_name,
            tm2.logo_url AS team_team_logo_url,
            tm2.color AS team_team_color
          FROM team_members member
          JOIN teams tm2 ON tm2.id = member.team_id
          WHERE member.player_id = ? AND member.left_at IS NULL
          ORDER BY tm2.name ASC
        `,
      )
      .all(playerId)
      .map((row) => teamFromPrefixedRow(row, "team"));
  }

  private resolveStageForTournament(tournamentId: string, preferredStageId: string | undefined): string {
    if (preferredStageId !== undefined && preferredStageId.trim().length > 0) {
      const row = this.database.prepare("SELECT id FROM stages WHERE id = ? AND tournament_id = ?").get(preferredStageId, tournamentId);

      if (row === undefined) {
        throw new Error("Stage does not belong to this tournament");
      }

      return preferredStageId;
    }

    const row = this.database
      .prepare(
        `
          SELECT COALESCE(current_stage_id, '') AS current_stage_id
          FROM tournaments
          WHERE id = ?
        `,
      )
      .get(tournamentId);
    const currentStageId = row === undefined ? "" : text(row, "current_stage_id");

    if (currentStageId.length > 0) {
      return currentStageId;
    }

    const firstStage = this.database
      .prepare("SELECT id FROM stages WHERE tournament_id = ? ORDER BY sort_order ASC LIMIT 1")
      .get(tournamentId);

    if (firstStage === undefined) {
      throw new Error("Tournament has no stage");
    }

    return text(firstStage, "id");
  }

  private resolveRoundForStage(stageId: string, preferredRoundId: string | undefined, roundName: string | undefined): string {
    if (preferredRoundId !== undefined && preferredRoundId.trim().length > 0) {
      const row = this.database.prepare("SELECT id FROM rounds WHERE id = ? AND stage_id = ?").get(preferredRoundId, stageId);

      if (row === undefined) {
        throw new Error("Round does not belong to this stage");
      }

      return preferredRoundId;
    }

    const existing = this.database
      .prepare("SELECT id FROM rounds WHERE stage_id = ? ORDER BY round_number ASC LIMIT 1")
      .get(stageId);

    if (existing !== undefined) {
      return text(existing, "id");
    }

    const name = roundName?.trim() || "OpenDota 比赛记录";
    const id = uniqueId("round", `${stageId}-opendota-records`);

    this.database
      .prepare(
        `
          INSERT INTO rounds (id, stage_id, round_number, name, status, pairing_status)
          VALUES (?, ?, 1, ?, 'published', 'confirmed')
        `,
      )
      .run(id, stageId, name);

    return id;
  }

  private upsertPlayersFromMatch(rawMatch: OpenDotaMatchDetail, radiantTeamId: string, direTeamId: string): void {
    const players = rawMatch.players ?? [];
    const now = new Date().toISOString();

    for (const player of players) {
      const accountId = typeof player.account_id === "number" && player.account_id > 0 ? player.account_id : null;

      if (accountId === null) {
        continue;
      }

      const teamId = sideFromPlayer(player) === "radiant" ? radiantTeamId : direTeamId;
      const displayName = player.personaname?.trim() || player.name?.trim() || player.player_name?.trim() || `玩家 ${accountId}`;
      const existing = this.database.prepare("SELECT id FROM players WHERE account_id = ?").get(accountId);
      const playerId = existing === undefined ? uniqueId("player", `${accountId}-${displayName}`) : text(existing, "id");

      if (existing === undefined) {
        this.database
          .prepare(
            `
              INSERT INTO players (id, account_id, display_name, current_team_id, avatar_url)
              VALUES (?, ?, ?, ?, NULL)
            `,
          )
          .run(playerId, accountId, displayName, teamId);
      } else {
        this.database
          .prepare(
            `
              UPDATE players
              SET
                display_name = CASE WHEN display_name = '' THEN ? ELSE display_name END,
                current_team_id = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE id = ?
            `,
          )
          .run(displayName, teamId, playerId);
      }

      this.database
        .prepare("INSERT OR IGNORE INTO team_members (team_id, player_id, role, joined_at) VALUES (?, ?, 'player', ?)")
        .run(teamId, playerId, now);
    }
  }

  private calculateTeamStats(tournamentId: string, teamId: string): TeamStatsSummary {
    const seriesRow = this.database
      .prepare(
        `
          SELECT
            SUM(CASE WHEN s.winner_team_id IS NOT NULL THEN 1 ELSE 0 END) AS series_played,
            SUM(CASE WHEN s.winner_team_id = ? THEN 1 ELSE 0 END) AS series_wins,
            SUM(CASE WHEN s.winner_team_id IS NOT NULL AND s.winner_team_id <> ? THEN 1 ELSE 0 END) AS series_losses
          FROM series s
          JOIN stages st ON st.id = s.stage_id
          WHERE st.tournament_id = ? AND (s.radiant_team_id = ? OR s.dire_team_id = ?)
        `,
      )
      .get(teamId, teamId, tournamentId, teamId, teamId);
    const games = this.database
      .prepare(
        `
          SELECT
            sg.match_id,
            sg.winner_team_id,
            s.radiant_team_id,
            s.dire_team_id,
            om.raw_json
          FROM series_games sg
          JOIN series s ON s.id = sg.series_id
          JOIN stages st ON st.id = s.stage_id
          LEFT JOIN opendota_matches om ON om.match_id = sg.match_id
          WHERE st.tournament_id = ? AND (s.radiant_team_id = ? OR s.dire_team_id = ?)
        `,
      )
      .all(tournamentId, teamId, teamId);
    const heroMap = new Map<number, HeroPickSummary>();
    let gameWins = 0;
    let gameLosses = 0;
    let linkedMatches = 0;

    for (const game of games) {
      const winnerTeamId = nullableText(game, "winner_team_id");
      const matchId = nullableNumber(game, "match_id");
      const isRadiantTeam = text(game, "radiant_team_id") === teamId;

      if (winnerTeamId === teamId) {
        gameWins += 1;
      } else if (winnerTeamId !== null) {
        gameLosses += 1;
      }

      if (matchId !== null) {
        linkedMatches += 1;
      }

      const raw = parseJson<OpenDotaMatchDetail | null>(nullableText(game, "raw_json"), null);
      const players = raw?.players ?? [];

      for (const player of players) {
        if ((sideFromPlayer(player) === "radiant") !== isRadiantTeam || typeof player.hero_id !== "number") {
          continue;
        }

        const current = heroMap.get(player.hero_id) ?? { heroId: player.hero_id, picks: 0, wins: 0 };
        current.picks += 1;

        if (winnerTeamId === teamId) {
          current.wins += 1;
        }

        heroMap.set(player.hero_id, current);
      }
    }

    const seriesPlayed = numberValue(seriesRow ?? {}, "series_played");
    const seriesWins = numberValue(seriesRow ?? {}, "series_wins");
    const seriesLosses = numberValue(seriesRow ?? {}, "series_losses");

    return {
      seriesPlayed,
      seriesWins,
      seriesLosses,
      gameWins,
      gameLosses,
      linkedMatches,
      winRate: seriesPlayed > 0 ? Math.round((seriesWins / seriesPlayed) * 1000) / 10 : null,
      topHeroes: [...heroMap.values()].sort((left, right) => right.picks - left.picks || right.wins - left.wins).slice(0, 5),
    };
  }

  private getLeagueSyncTargetByTournamentId(tournamentId: string): LeagueSyncTarget | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            t.id AS tournament_id,
            t.name AS tournament_name,
            t.status,
            t.starts_at,
            t.ends_at,
            l.id AS league_id,
            l.name AS league_name,
            l.opendota_league_id
          FROM tournaments t
          JOIN leagues l ON l.id = t.league_id
          WHERE t.id = ? OR t.slug = ?
        `,
      )
      .get(tournamentId, tournamentId);

    if (row === undefined) {
      return undefined;
    }

    return {
      tournamentId: text(row, "tournament_id"),
      tournamentName: text(row, "tournament_name"),
      status: text(row, "status") as TournamentLifecycleStatus,
      startsAt: nullableText(row, "starts_at"),
      endsAt: nullableText(row, "ends_at"),
      league: {
        id: text(row, "league_id"),
        name: text(row, "league_name"),
        opendotaLeagueId: numberValue(row, "opendota_league_id"),
      },
    };
  }

  private mapOpenDotaMatchListItem(row: DbRow, target: LeagueSyncTarget): OpenDotaMatchListItem {
    const raw = parseJson<OpenDotaMatchDetail | null>(text(row, "raw_json"), null);
    const players = raw?.players ?? [];
    const startTime = typeof raw?.start_time === "number" ? new Date(raw.start_time * 1000).toISOString() : null;
    const durationSeconds = typeof raw?.duration === "number" ? raw.duration : null;

    return {
      matchId: numberValue(row, "match_id"),
      leagueId: nullableNumber(row, "league_id"),
      leagueName: raw?.league?.name ?? target.league.name,
      tournamentId: target.tournamentId,
      tournamentName: target.tournamentName,
      parseStatus: text(row, "parse_status") as OpenDotaMatchListItem["parseStatus"],
      startTime,
      durationSeconds,
      durationText: durationSeconds === null ? null : formatDuration(durationSeconds),
      gameMode: typeof raw?.game_mode === "number" ? raw.game_mode : null,
      radiantWin: typeof raw?.radiant_win === "boolean" ? raw.radiant_win : null,
      radiantScore: typeof raw?.radiant_score === "number" ? raw.radiant_score : null,
      direScore: typeof raw?.dire_score === "number" ? raw.dire_score : null,
      radiantTeamName: stringOr(raw?.radiant_name, "天辉"),
      direTeamName: stringOr(raw?.dire_name, "夜魇"),
      playerCount: players.length,
      hasDraft: Array.isArray(raw?.picks_bans) && raw.picks_bans.length > 0,
      hasVision: players.some((player) => (player.obs_log?.length ?? 0) > 0 || (player.sen_log?.length ?? 0) > 0),
      hasChat: Array.isArray(raw?.chat) && raw.chat.length > 0,
      linkedSeries: this.getLinkedSeriesByMatchId(numberValue(row, "match_id")),
      updatedAt: text(row, "updated_at"),
    };
  }

  private getLinkedSeriesByMatchId(matchId: number): LinkedSeriesBrief | null {
    const row = this.database
      .prepare(
        `
          SELECT
            sg.game_index,
            s.id AS series_id,
            s.stage_id,
            s.round_id,
            s.status,
            rt.id AS radiant_team_id,
            rt.name AS radiant_team_name,
            rt.short_name AS radiant_team_short_name,
            rt.logo_url AS radiant_team_logo_url,
            rt.color AS radiant_team_color,
            dt.id AS dire_team_id,
            dt.name AS dire_team_name,
            dt.short_name AS dire_team_short_name,
            dt.logo_url AS dire_team_logo_url,
            dt.color AS dire_team_color
          FROM series_games sg
          JOIN series s ON s.id = sg.series_id
          JOIN teams rt ON rt.id = s.radiant_team_id
          JOIN teams dt ON dt.id = s.dire_team_id
          WHERE sg.match_id = ?
          LIMIT 1
        `,
      )
      .get(matchId);

    if (row === undefined) {
      return null;
    }

    return {
      seriesId: text(row, "series_id"),
      stageId: text(row, "stage_id"),
      roundId: text(row, "round_id"),
      gameIndex: numberValue(row, "game_index"),
      status: text(row, "status"),
      radiantTeam: teamFromPrefixedRow(row, "radiant"),
      direTeam: teamFromPrefixedRow(row, "dire"),
    };
  }

  private getMatchContextByMatchId(matchId: number): MatchDetailContext | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            sg.game_index,
            s.id AS series_id,
            s.bo_type,
            s.status AS series_status,
            s.scheduled_at,
            r.id AS round_id,
            r.stage_id AS round_stage_id,
            r.round_number,
            r.name AS round_name,
            r.status AS round_status,
            st.id AS stage_id,
            st.tournament_id,
            st.type AS stage_type,
            st.name AS stage_name,
            st.status AS stage_status,
            t.id AS tournament_id,
            t.name AS tournament_name,
            t.slug AS tournament_slug,
            t.status AS tournament_status,
            l.id AS league_id,
            l.name AS league_name,
            l.opendota_league_id,
            rt.id AS radiant_team_id,
            rt.name AS radiant_team_name,
            rt.short_name AS radiant_team_short_name,
            rt.logo_url AS radiant_team_logo_url,
            rt.color AS radiant_team_color,
            dt.id AS dire_team_id,
            dt.name AS dire_team_name,
            dt.short_name AS dire_team_short_name,
            dt.logo_url AS dire_team_logo_url,
            dt.color AS dire_team_color
          FROM series_games sg
          JOIN series s ON s.id = sg.series_id
          JOIN rounds r ON r.id = s.round_id
          JOIN stages st ON st.id = s.stage_id
          JOIN tournaments t ON t.id = st.tournament_id
          JOIN leagues l ON l.id = t.league_id
          JOIN teams rt ON rt.id = s.radiant_team_id
          JOIN teams dt ON dt.id = s.dire_team_id
          WHERE sg.match_id = ?
        `,
      )
      .get(matchId);

    if (row === undefined) {
      return undefined;
    }

    const league: LeagueBrief = {
      id: text(row, "league_id"),
      name: text(row, "league_name"),
      opendotaLeagueId: numberValue(row, "opendota_league_id"),
    };
    const tournament: TournamentBrief = {
      id: text(row, "tournament_id"),
      name: text(row, "tournament_name"),
      slug: text(row, "tournament_slug"),
      status: text(row, "tournament_status"),
    };
    const stage: StageBrief = {
      id: text(row, "stage_id"),
      tournamentId: text(row, "tournament_id"),
      type: text(row, "stage_type") as StageBrief["type"],
      name: text(row, "stage_name"),
      status: text(row, "stage_status"),
    };
    const round: RoundBrief = {
      id: text(row, "round_id"),
      stageId: text(row, "round_stage_id"),
      roundNumber: numberValue(row, "round_number"),
      name: text(row, "round_name"),
      status: text(row, "round_status"),
    };

    return {
      league,
      tournament,
      stage,
      round,
      series: {
        id: text(row, "series_id"),
        boType: text(row, "bo_type") as SeriesContext["boType"],
        status: text(row, "series_status"),
        scheduledAt: text(row, "scheduled_at"),
        gameIndex: numberValue(row, "game_index"),
      },
      teams: {
        radiant: teamFromPrefixedRow(row, "radiant"),
        dire: teamFromPrefixedRow(row, "dire"),
      } satisfies Record<TeamSide, TeamBrief>,
    };
  }

  private tournamentRows(): DbRow[] {
    return this.database
      .prepare(
        `
          SELECT
            t.*,
            l.id AS league_id,
            l.name AS league_name,
            l.opendota_league_id,
            se.id AS season_id,
            se.name AS season_name
          FROM tournaments t
          JOIN leagues l ON l.id = t.league_id
          JOIN seasons se ON se.id = t.season_id
          ORDER BY t.starts_at DESC, t.name ASC
        `,
      )
      .all();
  }

  private mapTournamentSummary(row: DbRow): TournamentListItem {
    const currentStage = this.getStageSummaryById(text(row, "current_stage_id"));

    if (currentStage === undefined) {
      throw new Error(`Tournament ${text(row, "id")} is missing current stage`);
    }

    return {
      id: text(row, "id"),
      name: text(row, "name"),
      slug: text(row, "slug"),
      status: text(row, "status"),
      season: {
        id: text(row, "season_id"),
        name: text(row, "season_name"),
      },
      league: {
        id: text(row, "league_id"),
        name: text(row, "league_name"),
        opendotaLeagueId: numberValue(row, "opendota_league_id"),
      },
      currentStage,
      startsAt: text(row, "starts_at"),
      endsAt: nullableText(row, "ends_at"),
      teamCount: this.countTournamentTeams(text(row, "id")),
    };
  }

  private getStagesByTournamentId(tournamentId: string): StageSummary[] {
    return this.database
      .prepare(
        `
          SELECT *
          FROM stages
          WHERE tournament_id = ?
          ORDER BY sort_order ASC
        `,
      )
      .all(tournamentId)
      .map((row) => this.mapStageSummary(row));
  }

  private getStageSummaryById(stageId: string): StageSummary | undefined {
    const row = this.database.prepare("SELECT * FROM stages WHERE id = ?").get(stageId);

    return row === undefined ? undefined : this.mapStageSummary(row);
  }

  private mapStageSummary(row: DbRow): StageSummary {
    const stageId = text(row, "id");

    return {
      id: stageId,
      tournamentId: text(row, "tournament_id"),
      type: text(row, "type") as StageSummary["type"],
      name: text(row, "name"),
      status: text(row, "status"),
      sortOrder: numberValue(row, "sort_order"),
      advancementRule: text(row, "advancement_rule"),
      activeRound: this.getActiveRound(stageId),
    };
  }

  private getActiveRound(stageId: string): RoundBrief | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM rounds
          WHERE stage_id = ? AND status <> 'draft'
          ORDER BY round_number DESC
          LIMIT 1
        `,
      )
      .get(stageId);

    return row === undefined ? null : roundFromRow(row);
  }

  private countTournamentTeams(tournamentId: string): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM tournament_teams WHERE tournament_id = ?")
      .get(tournamentId);

    return numberValue(row ?? {}, "count");
  }

  private nextTournamentSeed(tournamentId: string): number {
    const row = this.database
      .prepare("SELECT COALESCE(MAX(seed), 0) + 1 AS next_seed FROM tournament_teams WHERE tournament_id = ?")
      .get(tournamentId);

    return numberValue(row ?? {}, "next_seed");
  }

  private nextStageSortOrder(tournamentId: string): number {
    const row = this.database
      .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM stages WHERE tournament_id = ?")
      .get(tournamentId);

    return numberValue(row ?? {}, "next_sort_order");
  }

  private nextRoundNumber(stageId: string): number {
    const row = this.database
      .prepare("SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round_number FROM rounds WHERE stage_id = ?")
      .get(stageId);

    return numberValue(row ?? {}, "next_round_number");
  }

  private recalculateSeriesScore(seriesId: string): void {
    const row = this.database
      .prepare(
        `
          SELECT
            s.radiant_team_id,
            s.dire_team_id,
            SUM(CASE WHEN sg.winner_team_id = s.radiant_team_id THEN 1 ELSE 0 END) AS radiant_wins,
            SUM(CASE WHEN sg.winner_team_id = s.dire_team_id THEN 1 ELSE 0 END) AS dire_wins,
            SUM(CASE WHEN sg.winner_team_id IS NOT NULL THEN 1 ELSE 0 END) AS completed_games,
            COUNT(*) AS total_games
          FROM series s
          JOIN series_games sg ON sg.series_id = s.id
          WHERE s.id = ?
          GROUP BY s.id
        `,
      )
      .get(seriesId);

    if (row === undefined) {
      return;
    }

    const radiantWins = numberValue(row, "radiant_wins");
    const direWins = numberValue(row, "dire_wins");
    const completedGames = numberValue(row, "completed_games");
    const totalGames = numberValue(row, "total_games");
    const winnerTeamId =
      radiantWins > direWins ? text(row, "radiant_team_id") : direWins > radiantWins ? text(row, "dire_team_id") : null;
    const status = completedGames === 0 ? "scheduled" : completedGames < totalGames ? "result_pending" : "completed";

    this.database
      .prepare(
        `
          UPDATE series
          SET
            radiant_score = ?,
            dire_score = ?,
            winner_team_id = ?,
            status = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(radiantWins, direWins, winnerTeamId, status, seriesId);
  }

  private getNextSeries(tournamentId: string): SeriesSummary | null {
    const row = this.database
      .prepare(
        `
          SELECT s.id
          FROM series s
          JOIN stages st ON st.id = s.stage_id
          WHERE st.tournament_id = ? AND s.status IN ('draft', 'scheduled', 'live', 'result_pending', 'conflict')
          ORDER BY s.scheduled_at ASC, s.id ASC
          LIMIT 1
        `,
      )
      .get(tournamentId);
    const seriesId = row === undefined ? null : text(row, "id");

    return seriesId === null ? null : this.getSeriesById(seriesId) ?? null;
  }

  private getLatestResult(tournamentId: string): SeriesSummary | null {
    const row = this.database
      .prepare(
        `
          SELECT s.id
          FROM series s
          JOIN stages st ON st.id = s.stage_id
          WHERE st.tournament_id = ? AND s.status = 'completed'
          ORDER BY s.scheduled_at DESC, s.id ASC
          LIMIT 1
        `,
      )
      .get(tournamentId);
    const seriesId = row === undefined ? null : text(row, "id");

    return seriesId === null ? null : this.getSeriesById(seriesId) ?? null;
  }

  private getSeriesByRoundId(roundId: string): SeriesSummary[] {
    return this.database
      .prepare("SELECT id FROM series WHERE round_id = ? ORDER BY scheduled_at ASC, id ASC")
      .all(roundId)
      .map((row) => this.getSeriesById(text(row, "id")))
      .filter((series): series is SeriesSummary => series !== undefined);
  }

  private getSeriesById(seriesId: string): SeriesSummary | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            s.*,
            rt.id AS radiant_team_id,
            rt.name AS radiant_team_name,
            rt.short_name AS radiant_team_short_name,
            rt.logo_url AS radiant_team_logo_url,
            rt.color AS radiant_team_color,
            dt.id AS dire_team_id,
            dt.name AS dire_team_name,
            dt.short_name AS dire_team_short_name,
            dt.logo_url AS dire_team_logo_url,
            dt.color AS dire_team_color
          FROM series s
          JOIN teams rt ON rt.id = s.radiant_team_id
          JOIN teams dt ON dt.id = s.dire_team_id
          WHERE s.id = ?
        `,
      )
      .get(seriesId);

    if (row === undefined) {
      return undefined;
    }

    return {
      id: text(row, "id"),
      roundId: text(row, "round_id"),
      stageId: text(row, "stage_id"),
      boType: text(row, "bo_type") as SeriesSummary["boType"],
      status: text(row, "status"),
      scheduledAt: text(row, "scheduled_at"),
      radiantTeam: teamFromPrefixedRow(row, "radiant"),
      direTeam: teamFromPrefixedRow(row, "dire"),
      radiantScore: numberValue(row, "radiant_score"),
      direScore: numberValue(row, "dire_score"),
      winnerTeamId: nullableText(row, "winner_team_id"),
      games: this.getSeriesGames(seriesId),
    };
  }

  private getSeriesGames(seriesId: string): SeriesSummary["games"] {
    return this.database
      .prepare(
        `
          SELECT game_index, match_id, radiant_score, dire_score
          FROM series_games
          WHERE series_id = ?
          ORDER BY game_index ASC
        `,
      )
      .all(seriesId)
      .map((row) => ({
        gameIndex: numberValue(row, "game_index"),
        matchId: nullableNumber(row, "match_id"),
        radiantScore: nullableNumber(row, "radiant_score"),
        direScore: nullableNumber(row, "dire_score"),
      }));
  }
}

function roundFromRow(row: DbRow): RoundBrief {
  return {
    id: text(row, "id"),
    stageId: text(row, "stage_id"),
    roundNumber: numberValue(row, "round_number"),
    name: text(row, "name"),
    status: text(row, "status"),
  };
}

function teamFromPrefixedRow(row: DbRow, prefix: string): TeamBrief {
  return {
    id: text(row, `${prefix}_team_id`),
    name: text(row, `${prefix}_team_name`),
    shortName: text(row, `${prefix}_team_short_name`),
    logoUrl: nullableText(row, `${prefix}_team_logo_url`),
    color: nullableText(row, `${prefix}_team_color`) ?? "#64748b",
  };
}

function text(row: DbRow, key: string): string {
  const value = row[key];

  return typeof value === "string" ? value : "";
}

function nullableText(row: DbRow, key: string): string | null {
  const value = row[key];

  return typeof value === "string" ? value : null;
}

function numberValue(row: DbRow, key: string): number {
  const value = row[key];

  return typeof value === "number" ? value : 0;
}

function nullableNumber(row: DbRow, key: string): number | null {
  const value = row[key];

  return typeof value === "number" ? value : null;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function dateSortValue(value: string | null): number {
  return value === null ? 0 : Date.parse(value) || 0;
}

function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function requiredString(value: string | undefined, fieldName: string): string {
  const trimmed = value?.trim();

  if (trimmed === undefined || trimmed.length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return trimmed;
}

function requiredPositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return value;
}

function normalizeShortName(value: string): string {
  return value
    .trim()
    .slice(0, 8)
    .toUpperCase();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueId(prefix: string, seed: string): string {
  const normalized = seed
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return `${prefix}_${normalized || "item"}_${Date.now().toString(36)}`;
}

function matchStartTime(rawMatch: OpenDotaMatchDetail): string | null {
  return typeof rawMatch.start_time === "number" ? new Date(rawMatch.start_time * 1000).toISOString() : null;
}

function sideFromPlayer(player: OpenDotaMatchPlayer): TeamSide {
  return player.player_slot < 128 ? "radiant" : "dire";
}

function defaultAdvancementRule(type: CreateStageInput["type"]): string {
  const rules: Record<CreateStageInput["type"], string> = {
    group: "小组赛排名按积分、净胜局、胜场、直接交手排序",
    swiss: "瑞士轮按积分、对手分、净胜局排序",
    knockout: "淘汰赛按 bracket 胜者推进",
  };

  return rules[type];
}

function gameCountForBo(boType: SeriesSummary["boType"]): number {
  const match = /^BO(\d+)$/.exec(boType);
  const count = match?.[1] === undefined ? 1 : Number(match[1]);

  return Number.isSafeInteger(count) && count > 0 ? count : 1;
}

function inferWinnerTeamId(series: SeriesSummary, radiantScore: number | null, direScore: number | null): string | null {
  if (radiantScore === null || direScore === null || radiantScore === direScore) {
    return null;
  }

  return radiantScore > direScore ? series.radiantTeam.id : series.direTeam.id;
}
