import { openDatabase, parseJson, resolveDatabasePath } from "../db/client.js";
import { normalizeOpenDotaMatchDetail } from "../opendota/normalizers/matchDetail.js";
import { accountIdToSteamId64, steamId64ToAccountId } from "../opendota/steamClient.js";
import type { OpenDotaMatchDetail, OpenDotaMatchPlayer } from "../opendota/types.js";
import type {
  BracketNode,
  OfficialScheduleLogEntry,
  OfficialScheduleManagement,
  SeriesSummary,
  StageGroup,
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

type ParsedOpenDotaMatchRow = {
  matchId: number;
  raw: OpenDotaMatchDetail;
};

type StandingAccumulator = {
  team: TeamBrief;
  groupName: string | null;
  seriesPlayed: number;
  seriesWins: number;
  seriesDraws: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  points: number;
};

type MatchEntitySyncResult = {
  tournamentId: string;
  playerIds: Set<string>;
  teamIds: Set<string>;
};

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
  heroLineups: Record<TeamSide, OpenDotaMatchListHero[]>;
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
  linkedSeries: LinkedSeriesBrief | null;
  updatedAt: string;
};

export type OpenDotaMatchListHero = {
  playerSlot: number;
  heroId: number;
  playerName: string;
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

export type PlayerStatsSummary = {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgKills: number | null;
  avgDeaths: number | null;
  avgAssists: number | null;
  kda: number | null;
  avgGpm: number | null;
  avgXpm: number | null;
  avgNetWorth: number | null;
  avgHeroDamage: number | null;
  avgTowerDamage: number | null;
  avgDamageTaken: number | null;
  topHeroes: HeroPickSummary[];
};

export type ProfileMatchSummary = {
  matchId: number;
  startTime: string | null;
  durationText: string | null;
  radiantTeamName: string;
  direTeamName: string;
  radiantScore: number | null;
  direScore: number | null;
  radiantWin: boolean | null;
  side: TeamSide | null;
  heroId: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  result: "win" | "loss" | "unknown";
};

export type PlayerBrief = {
  id: string;
  accountId: number | null;
  steamId64: string | null;
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
  stats: PlayerStatsSummary;
};

export type TournamentPlayerDetail = TournamentPlayerListItem & {
  tournamentId: string;
  matches: ProfileMatchSummary[];
};

export type TournamentTeamDetail = TournamentTeamListItem & {
  matches: ProfileMatchSummary[];
};

export type EntityBackfillSummary = {
  tournaments: number;
  matches: number;
  players: number;
  teams: number;
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
  logoUrl?: string | null;
  color?: string;
  opendotaTeamId?: number | null;
  tournamentId?: string;
};

export type UpdateTeamInput = {
  name?: string;
  shortName?: string;
  logoUrl?: string | null;
  color?: string | null;
  opendotaTeamId?: number | null;
};

export type CreatePlayerInput = {
  displayName: string;
  accountId?: number | null;
  steamId64?: string | null;
  currentTeamId?: string | null;
  avatarUrl?: string | null;
};

export type AddTeamMemberInput = {
  teamId: string;
  playerId?: string;
  steamId?: string;
  accountId?: number | null;
  steamId64?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string;
};

export type RemoveTeamMemberInput = {
  teamId: string;
  playerId: string;
};

export type SteamPlayerProfileInput = {
  accountId: number;
  steamId64?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
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
  config?: Record<string, unknown>;
};

export type CreateStageGroupInput = {
  stageId: string;
  name: string;
  sortOrder?: number;
};

export type RandomizeStageGroupsInput = {
  groupCount?: number;
  groupSize?: number;
  seededTeamIds?: string[];
  actor?: string;
};

export type GenerateGroupRoundRobinInput = {
  boType?: SeriesSummary["boType"];
  replaceExisting?: boolean;
  actor?: string;
};

export type UpdateStageManualRanksInput = {
  ranks: Array<{
    teamId: string;
    manualRank: number | null;
  }>;
  actor?: string;
};

export type GenerateSwissPairingsInput = {
  roundNumber?: number;
  boType?: SeriesSummary["boType"];
  actor?: string;
};

export type ConfirmSwissRoundInput = {
  actor?: string;
};

export type UpdateStageGroupInput = {
  name?: string;
  sortOrder?: number;
};

export type AddStageGroupTeamInput = {
  groupId: string;
  teamId: string;
  seed?: number | null;
};

export type BracketType = "single_elimination" | "double_elimination";
export type BracketSlot = "radiant" | "dire";

export type CreateKnockoutBracketInput = {
  name?: string;
  bracketType?: BracketType;
  bracketSize?: number;
  winnerTeamCount?: number;
  loserTeamCount?: number;
  boType?: SeriesSummary["boType"];
  scheduledAt?: string;
  teamIds: string[];
};

export type AdvanceBracketNodeInput = {
  winnerTeamId: string;
};

export type SetBracketNodeSlotInput = {
  slot: BracketSlot;
  teamId?: string | null;
  actor?: string;
};

export type KnockoutBracketResult = {
  stage: StageSummary;
  rounds: StageRound[];
  bracket: BracketNode[];
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
  groupId?: string | null;
  seriesKind?: SeriesSummary["seriesKind"];
  boType: SeriesSummary["boType"];
  status?: SeriesSummary["status"];
  scheduledAt?: string;
  radiantTeamId: string;
  direTeamId: string;
};

export type UpdateSeriesInput = {
  roundId?: string;
  groupId?: string | null;
  seriesKind?: SeriesSummary["seriesKind"];
  boType?: SeriesSummary["boType"];
  status?: SeriesSummary["status"];
  scheduledAt?: string | null;
  radiantTeamId?: string;
  direTeamId?: string;
};

export type UpdateSeriesResultInput = {
  radiantScore: number;
  direScore: number;
};

export type ClearTournamentMatchRecordsResult = {
  tournamentId: string;
  deletedSeries: number;
  deletedOpenDotaMatches: number;
};

export type UpdateOfficialScheduleConfigInput = {
  preliminaryType?: "group" | "swiss" | null;
  knockoutType?: "single_elimination" | "double_elimination" | null;
  actor?: string;
};

export type LockOfficialScheduleRosterInput = {
  teamIds: string[];
  seededTeamIds?: string[];
  actor?: string;
};

export type OfficialSchedulePublicStatus = {
  tournamentId: string;
  status: OfficialScheduleManagement["status"];
  isPublished: boolean;
  rosterLocked: boolean;
  publishedAt: string | null;
  withdrawnAt: string | null;
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
  private readonly matchRowsCache = new Map<number, ParsedOpenDotaMatchRow[]>();

  constructor() {
    this.ensureRuntimeSchema();
  }

  dispose(): void {
    this.database.close();
  }

  private ensureRuntimeSchema(): void {
    this.ensureColumn("teams", "opendota_team_id", "INTEGER");
    this.ensureColumn("teams", "source", "TEXT NOT NULL DEFAULT 'manual'");
    this.ensureColumn("players", "steam_id64", "TEXT");
    this.ensureColumn("bracket_nodes", "bracket_group", "TEXT NOT NULL DEFAULT 'single'");
    this.ensureColumn("bracket_nodes", "radiant_team_id", "TEXT");
    this.ensureColumn("bracket_nodes", "dire_team_id", "TEXT");
    this.ensureColumn("bracket_nodes", "loser_next_node_id", "TEXT");
    this.ensureColumn("bracket_nodes", "loser_next_slot", "TEXT");
    this.ensureColumn("series", "group_id", "TEXT");
    this.ensureColumn("series", "series_kind", "TEXT NOT NULL DEFAULT 'regular'");
    this.database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_opendota_team_id ON teams(opendota_team_id);");
    this.database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_players_steam_id64 ON players(steam_id64);");
    this.database.exec("CREATE INDEX IF NOT EXISTS idx_series_group ON series(group_id);");
    this.ensureEntityTables();
  }

  private ensureColumn(tableName: string, columnName: string, definition: string): void {
    const columns = this.database.prepare(`PRAGMA table_info(${tableName})`).all();

    if (!columns.some((column) => text(column, "name") === columnName)) {
      this.database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
    }
  }

  private ensureEntityTables(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS stage_groups (
        id TEXT PRIMARY KEY,
        stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (stage_id, name)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS stage_group_teams (
        group_id TEXT NOT NULL REFERENCES stage_groups(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        seed INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (group_id, team_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tournament_players (
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        current_team_id TEXT REFERENCES teams(id),
        source TEXT NOT NULL DEFAULT 'opendota' CHECK (source IN ('manual', 'opendota')),
        first_seen_match_id INTEGER,
        last_seen_match_id INTEGER,
        last_seen_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (tournament_id, player_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tournament_player_stats (
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        summary_json TEXT NOT NULL DEFAULT '{}',
        matches_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (tournament_id, player_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tournament_team_stats (
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        summary_json TEXT NOT NULL DEFAULT '{}',
        matches_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (tournament_id, team_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tournament_schedule_settings (
        tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
        roster_locked INTEGER NOT NULL DEFAULT 0 CHECK (roster_locked IN (0, 1)),
        preliminary_type TEXT CHECK (preliminary_type IN ('group', 'swiss') OR preliminary_type IS NULL),
        knockout_type TEXT CHECK (knockout_type IN ('single_elimination', 'double_elimination') OR knockout_type IS NULL),
        locked_at TEXT,
        published_at TEXT,
        withdrawn_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tournament_schedule_teams (
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        seed INTEGER,
        is_seeded INTEGER NOT NULL DEFAULT 0 CHECK (is_seeded IN (0, 1)),
        locked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (tournament_id, team_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS schedule_operation_logs (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        actor TEXT NOT NULL DEFAULT 'admin',
        action TEXT NOT NULL,
        detail_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS stage_manual_ranks (
        stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        manual_rank INTEGER,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (stage_id, team_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS swiss_byes (
        stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
        round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (stage_id, round_id, team_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_tournament_players_team ON tournament_players(tournament_id, current_team_id);
      CREATE INDEX IF NOT EXISTS idx_stage_groups_stage ON stage_groups(stage_id);
      CREATE INDEX IF NOT EXISTS idx_stage_group_teams_team ON stage_group_teams(team_id);
      CREATE INDEX IF NOT EXISTS idx_tournament_schedule_teams_team ON tournament_schedule_teams(team_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_operation_logs_tournament ON schedule_operation_logs(tournament_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_stage_manual_ranks_stage ON stage_manual_ranks(stage_id);
      CREATE INDEX IF NOT EXISTS idx_swiss_byes_stage ON swiss_byes(stage_id);
    `);
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

  getOfficialScheduleManagement(tournamentIdParam: string): OfficialScheduleManagement | undefined {
    const tournament = this.getTournamentDetail(requiredString(tournamentIdParam, "tournamentId"));

    if (tournament === undefined) {
      return undefined;
    }

    const settings = this.getOfficialScheduleSettingsRow(tournament.id);
    const teams = this.listOfficialScheduleTeams(tournament.id);
    const logs = this.listOfficialScheduleLogs(tournament.id, 30);

    if (settings === undefined) {
      return {
        tournamentId: tournament.id,
        status: "unconfigured",
        rosterLocked: false,
        preliminaryType: null,
        knockoutType: null,
        lockedAt: null,
        publishedAt: null,
        withdrawnAt: null,
        updatedAt: null,
        teams,
        logs,
      };
    }

    return {
      tournamentId: tournament.id,
      status: text(settings, "status") as OfficialScheduleManagement["status"],
      rosterLocked: numberValue(settings, "roster_locked") === 1,
      preliminaryType: nullableText(settings, "preliminary_type") as OfficialScheduleManagement["preliminaryType"],
      knockoutType: nullableText(settings, "knockout_type") as OfficialScheduleManagement["knockoutType"],
      lockedAt: nullableText(settings, "locked_at"),
      publishedAt: nullableText(settings, "published_at"),
      withdrawnAt: nullableText(settings, "withdrawn_at"),
      updatedAt: nullableText(settings, "updated_at"),
      teams,
      logs,
    };
  }

  getOfficialSchedulePublicStatus(tournamentIdParam: string): OfficialSchedulePublicStatus | undefined {
    const management = this.getOfficialScheduleManagement(tournamentIdParam);

    if (management === undefined) {
      return undefined;
    }

    return {
      tournamentId: management.tournamentId,
      status: management.status,
      isPublished: management.status === "published",
      rosterLocked: management.rosterLocked,
      publishedAt: management.publishedAt,
      withdrawnAt: management.withdrawnAt,
    };
  }

  updateOfficialScheduleConfig(
    tournamentIdParam: string,
    input: UpdateOfficialScheduleConfigInput,
  ): OfficialScheduleManagement {
    const tournament = this.getTournamentDetail(requiredString(tournamentIdParam, "tournamentId"));

    if (tournament === undefined) {
      throw new Error("Tournament not found");
    }

    if (
      input.preliminaryType !== undefined &&
      input.preliminaryType !== null &&
      input.preliminaryType !== "group" &&
      input.preliminaryType !== "swiss"
    ) {
      throw new Error("preliminaryType must be group or swiss");
    }

    if (
      input.knockoutType !== undefined &&
      input.knockoutType !== null &&
      input.knockoutType !== "single_elimination" &&
      input.knockoutType !== "double_elimination"
    ) {
      throw new Error("knockoutType must be single_elimination or double_elimination");
    }

    this.database.exec("BEGIN;");

    try {
      this.ensureOfficialScheduleSettings(tournament.id);

      if (input.preliminaryType !== undefined || input.knockoutType !== undefined) {
        this.database
          .prepare(
            `
              UPDATE tournament_schedule_settings
              SET
                preliminary_type = COALESCE(?, preliminary_type),
                knockout_type = COALESCE(?, knockout_type),
                status = CASE WHEN status = 'unconfigured' THEN 'draft' ELSE status END,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE tournament_id = ?
            `,
          )
          .run(input.preliminaryType ?? null, input.knockoutType ?? null, tournament.id);
      }

      this.insertScheduleLog(tournament.id, input.actor ?? "admin", "schedule_config_updated", {
        preliminaryType: input.preliminaryType ?? null,
        knockoutType: input.knockoutType ?? null,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.requireOfficialScheduleManagement(tournament.id);
  }

  lockOfficialScheduleRoster(
    tournamentIdParam: string,
    input: LockOfficialScheduleRosterInput,
  ): OfficialScheduleManagement {
    const tournament = this.getTournamentDetail(requiredString(tournamentIdParam, "tournamentId"));

    if (tournament === undefined) {
      throw new Error("Tournament not found");
    }

    const teamIds = uniqueStrings(input.teamIds);
    const seededTeamIds = new Set(uniqueStrings(input.seededTeamIds ?? []));

    if (teamIds.length < 2) {
      throw new Error("At least 2 teams are required before locking the roster");
    }

    for (const teamId of teamIds) {
      this.ensureTournamentTeam(tournament.id, teamId);
    }

    this.database.exec("BEGIN;");

    try {
      this.ensureOfficialScheduleSettings(tournament.id);
      this.database.prepare("DELETE FROM tournament_schedule_teams WHERE tournament_id = ?").run(tournament.id);

      const insertTeam = this.database.prepare(
        `
          INSERT INTO tournament_schedule_teams (tournament_id, team_id, seed, is_seeded, locked_at)
          VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        `,
      );

      teamIds.forEach((teamId, index) => {
        insertTeam.run(tournament.id, teamId, index + 1, seededTeamIds.has(teamId) ? 1 : 0);
      });

      this.database
        .prepare(
          `
            UPDATE tournament_schedule_settings
            SET
              status = 'draft',
              roster_locked = 1,
              locked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
              published_at = NULL,
              withdrawn_at = NULL,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE tournament_id = ?
          `,
        )
        .run(tournament.id);
      this.insertScheduleLog(tournament.id, input.actor ?? "admin", "roster_locked", {
        teamIds,
        seededTeamIds: [...seededTeamIds],
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.requireOfficialScheduleManagement(tournament.id);
  }

  unlockOfficialScheduleRoster(tournamentIdParam: string, actor = "admin"): OfficialScheduleManagement {
    const tournament = this.getTournamentDetail(requiredString(tournamentIdParam, "tournamentId"));

    if (tournament === undefined) {
      throw new Error("Tournament not found");
    }

    const deletedOfficialStages = this.officialScheduleStageIds(tournament.id).length;

    this.database.exec("BEGIN;");

    try {
      this.ensureOfficialScheduleSettings(tournament.id);
      this.clearOfficialScheduleDraftStages(tournament.id);
      this.database.prepare("DELETE FROM tournament_schedule_teams WHERE tournament_id = ?").run(tournament.id);
      this.database
        .prepare(
          `
            UPDATE tournament_schedule_settings
            SET
              status = 'draft',
              roster_locked = 0,
              locked_at = NULL,
              published_at = NULL,
              withdrawn_at = NULL,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE tournament_id = ?
          `,
        )
        .run(tournament.id);
      this.insertScheduleLog(tournament.id, actor, "roster_unlocked", { deletedOfficialStages });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.requireOfficialScheduleManagement(tournament.id);
  }

  publishOfficialSchedule(tournamentIdParam: string, actor = "admin"): OfficialScheduleManagement {
    const management = this.getOfficialScheduleManagement(tournamentIdParam);

    if (management === undefined) {
      throw new Error("Tournament not found");
    }

    if (!management.rosterLocked) {
      throw new Error("Roster must be locked before publishing the official schedule");
    }

    this.database.exec("BEGIN;");

    try {
      this.ensureOfficialScheduleSettings(management.tournamentId);
      this.database
        .prepare(
          `
            UPDATE tournament_schedule_settings
            SET
              status = 'published',
              published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
              withdrawn_at = NULL,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE tournament_id = ?
          `,
        )
        .run(management.tournamentId);
      this.insertScheduleLog(management.tournamentId, actor, "schedule_published", {
        teamCount: management.teams.length,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.requireOfficialScheduleManagement(management.tournamentId);
  }

  withdrawOfficialSchedule(tournamentIdParam: string, actor = "admin"): OfficialScheduleManagement {
    const management = this.getOfficialScheduleManagement(tournamentIdParam);

    if (management === undefined) {
      throw new Error("Tournament not found");
    }

    this.database.exec("BEGIN;");

    try {
      this.ensureOfficialScheduleSettings(management.tournamentId);
      this.database
        .prepare(
          `
            UPDATE tournament_schedule_settings
            SET
              status = 'withdrawn',
              withdrawn_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE tournament_id = ?
          `,
        )
        .run(management.tournamentId);
      this.insertScheduleLog(management.tournamentId, actor, "schedule_withdrawn", {});
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.requireOfficialScheduleManagement(management.tournamentId);
  }

  private requireOfficialScheduleManagement(tournamentId: string): OfficialScheduleManagement {
    const management = this.getOfficialScheduleManagement(tournamentId);

    if (management === undefined) {
      throw new Error("Tournament not found");
    }

    return management;
  }

  private getOfficialScheduleSettingsRow(tournamentId: string): DbRow | undefined {
    return this.database.prepare("SELECT * FROM tournament_schedule_settings WHERE tournament_id = ?").get(tournamentId);
  }

  private ensureOfficialScheduleSettings(tournamentId: string): void {
    this.database
      .prepare("INSERT OR IGNORE INTO tournament_schedule_settings (tournament_id, status) VALUES (?, 'draft')")
      .run(tournamentId);
  }

  private listOfficialScheduleTeams(tournamentId: string): OfficialScheduleManagement["teams"] {
    return this.database
      .prepare(
        `
          SELECT
            tst.*,
            tm.id AS team_team_id,
            tm.name AS team_team_name,
            tm.short_name AS team_team_short_name,
            tm.logo_url AS team_team_logo_url,
            tm.color AS team_team_color
          FROM tournament_schedule_teams tst
          JOIN teams tm ON tm.id = tst.team_id
          WHERE tst.tournament_id = ?
          ORDER BY tst.seed IS NULL ASC, tst.seed ASC, tm.name ASC
        `,
      )
      .all(tournamentId)
      .map((row) => ({
        team: teamFromPrefixedRow(row, "team"),
        seed: nullableNumber(row, "seed"),
        isSeeded: numberValue(row, "is_seeded") === 1,
      }));
  }

  private listOfficialScheduleLogs(tournamentId: string, limit: number): OfficialScheduleLogEntry[] {
    return this.database
      .prepare(
        `
          SELECT *
          FROM schedule_operation_logs
          WHERE tournament_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `,
      )
      .all(tournamentId, limit)
      .map((row) => ({
        id: text(row, "id"),
        tournamentId: text(row, "tournament_id"),
        actor: text(row, "actor"),
        action: text(row, "action"),
        detail: parseJson<Record<string, unknown>>(text(row, "detail_json"), {}),
        createdAt: text(row, "created_at"),
      }));
  }

  private insertScheduleLog(
    tournamentId: string,
    actor: string,
    action: string,
    detail: Record<string, unknown>,
  ): void {
    this.database
      .prepare(
        `
          INSERT INTO schedule_operation_logs (id, tournament_id, actor, action, detail_json)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(uniqueId("schedule_log", `${tournamentId}-${action}-${Date.now()}`), tournamentId, actor, action, JSON.stringify(detail));
  }

  private officialScheduleStageIds(tournamentId: string): string[] {
    return this.database
      .prepare("SELECT id, config_json FROM stages WHERE tournament_id = ?")
      .all(tournamentId)
      .filter((row) => this.isOfficialScheduleStageRow(row))
      .map((row) => text(row, "id"));
  }

  private isOfficialScheduleStageRow(row: DbRow): boolean {
    const config = parseJson<Record<string, unknown>>(text(row, "config_json"), {});

    return config.officialSchedule === true || config.scheduleManagement === true;
  }

  private clearOfficialScheduleDraftStages(tournamentId: string): void {
    const stageIds = this.officialScheduleStageIds(tournamentId);

    if (stageIds.length === 0) {
      return;
    }

    const currentStage = this.database
      .prepare("SELECT current_stage_id FROM tournaments WHERE id = ?")
      .get(tournamentId);
    const shouldMoveCurrentStage = stageIds.includes(nullableText(currentStage ?? {}, "current_stage_id") ?? "");
    const placeholders = stageIds.map(() => "?").join(", ");

    this.database.prepare(`DELETE FROM stages WHERE id IN (${placeholders})`).run(...stageIds);

    if (shouldMoveCurrentStage) {
      const nextStage = this.database
        .prepare("SELECT id FROM stages WHERE tournament_id = ? ORDER BY sort_order ASC LIMIT 1")
        .get(tournamentId);

      this.database
        .prepare(
          `
            UPDATE tournaments
            SET current_stage_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(nullableText(nextStage ?? {}, "id"), tournamentId);
    }
  }

  getStageStandings(stageId: string): StandingRow[] | undefined {
    const rows = this.database
      .prepare(
        `
          SELECT
            st.*,
            tm.id AS team_team_id,
            tm.name AS team_team_name,
            tm.short_name AS team_team_short_name,
            tm.logo_url AS team_team_logo_url,
            tm.color AS team_team_color
          FROM standings st
          JOIN teams tm ON tm.id = st.team_id
          WHERE st.stage_id = ?
          ORDER BY st.rank ASC
        `,
      )
      .all(stageId);

    if (rows.length === 0) {
      return this.getStageSummaryById(stageId) === undefined ? undefined : [];
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
      return this.getStageSummaryById(stageId) === undefined ? undefined : [];
    }

    return rows.map((row) => ({
      ...roundFromRow(row),
      pairingStatus: text(row, "pairing_status") as StageRound["pairingStatus"],
      byes: this.getSwissByesByRoundId(text(row, "id")),
      series: this.getSeriesByRoundId(text(row, "id")),
    }));
  }

  private getSwissByesByRoundId(roundId: string): TeamBrief[] {
    return this.database
      .prepare(
        `
          SELECT
            tm.id AS team_team_id,
            tm.name AS team_team_name,
            tm.short_name AS team_team_short_name,
            tm.logo_url AS team_team_logo_url,
            tm.color AS team_team_color
          FROM swiss_byes sb
          JOIN teams tm ON tm.id = sb.team_id
          WHERE sb.round_id = ?
          ORDER BY tm.name ASC
        `,
      )
      .all(roundId)
      .map((row) => teamFromPrefixedRow(row, "team"));
  }

  getStageBracket(stageId: string): BracketNode[] | undefined {
    const rows = this.database
      .prepare(
        `
          SELECT
            bn.*,
            bn.radiant_team_id AS bracket_radiant_team_id,
            bn.dire_team_id AS bracket_dire_team_id,
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
          FROM bracket_nodes bn
          LEFT JOIN teams rt ON rt.id = bn.radiant_team_id
          LEFT JOIN teams dt ON dt.id = bn.dire_team_id
          WHERE bn.stage_id = ?
          ORDER BY bn.round_number ASC, bn.position ASC
        `,
      )
      .all(stageId);

    if (rows.length === 0) {
      return this.getStageSummaryById(stageId) === undefined ? undefined : [];
    }

    return rows.map((row) => {
      const seriesId = nullableText(row, "series_id");

      return {
        id: text(row, "id"),
        stageId: text(row, "stage_id"),
        bracketGroup: text(row, "bracket_group") as BracketNode["bracketGroup"],
        roundNumber: numberValue(row, "round_number"),
        roundName: text(row, "round_name"),
        position: numberValue(row, "position"),
        status: text(row, "status") as BracketNode["status"],
        radiantTeam: nullableText(row, "bracket_radiant_team_id") === null ? null : teamFromPrefixedRow(row, "radiant"),
        direTeam: nullableText(row, "bracket_dire_team_id") === null ? null : teamFromPrefixedRow(row, "dire"),
        series: seriesId === null ? null : this.getSeriesById(seriesId) ?? null,
        nextNodeId: nullableText(row, "next_node_id"),
        nextSlot: nullableText(row, "next_slot") as BracketNode["nextSlot"],
        loserNextNodeId: nullableText(row, "loser_next_node_id"),
        loserNextSlot: nullableText(row, "loser_next_slot") as BracketNode["loserNextSlot"],
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
          stats: this.getTeamStatsSnapshot(target.tournamentId, team.id),
        };
      });
  }

  listTournamentPlayers(tournamentId: string): TournamentPlayerListItem[] | undefined {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return undefined;
    }

    const players = new Map<string, PlayerBrief>();

    this.database
      .prepare(
        `
          SELECT DISTINCT p.*
          FROM players p
          LEFT JOIN tournament_players tp ON tp.player_id = p.id AND tp.tournament_id = ?
          LEFT JOIN team_members tm ON tm.player_id = p.id
          LEFT JOIN tournament_teams tt ON tt.team_id = tm.team_id OR tt.team_id = p.current_team_id
          WHERE tp.tournament_id = ? OR tt.tournament_id = ?
          ORDER BY p.display_name ASC, p.id ASC
        `,
      )
      .all(target.tournamentId, target.tournamentId, target.tournamentId)
      .forEach((row) => {
        const player = this.playerFromRow(row);
        players.set(player.id, player);
      });

    return [...players.values()]
      .map((player) => ({
        ...player,
        teams: this.getPlayerTeams(player.id),
        stats: this.getPlayerStatsSnapshot(target.tournamentId, player.id),
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id));
  }

  getTournamentPlayerDetail(tournamentId: string, playerId: string): TournamentPlayerDetail | undefined {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return undefined;
    }

    const player = this.getPlayerById(playerId);

    if (player === undefined) {
      return undefined;
    }

    return {
      ...player,
      tournamentId: target.tournamentId,
      teams: this.getPlayerTeams(player.id),
      stats: this.getPlayerStatsSnapshot(target.tournamentId, player.id),
      matches: this.getPlayerMatchSnapshot(target.tournamentId, player.id),
    };
  }

  getTournamentTeamDetail(tournamentId: string, teamId: string): TournamentTeamDetail | undefined {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return undefined;
    }

    let team: TeamBrief;

    try {
      team = this.requireTeam(teamId);
    } catch {
      return undefined;
    }
    const tournamentTeamRow = this.database
      .prepare("SELECT seed, status FROM tournament_teams WHERE tournament_id = ? AND team_id = ?")
      .get(target.tournamentId, team.id);

    if (tournamentTeamRow === undefined) {
      return undefined;
    }

    const members = this.getTeamMembers(team.id);

    return {
      ...team,
      tournamentId: target.tournamentId,
      seed: nullableNumber(tournamentTeamRow, "seed"),
      status: text(tournamentTeamRow, "status"),
      memberCount: members.length,
      members,
      stats: this.getTeamStatsSnapshot(target.tournamentId, team.id),
      matches: this.getTeamMatchSnapshot(target.tournamentId, team.id),
    };
  }

  backfillCachedTournamentEntities(tournamentId?: string): EntityBackfillSummary {
    const targets =
      tournamentId === undefined
        ? this.listLeagueSyncTargets(["completed", "running", "upcoming"])
        : this.listLeagueSyncTargets(["completed", "running", "upcoming"]).filter(
            (target) =>
              target.tournamentId === tournamentId ||
              target.league.id === tournamentId ||
              String(target.league.opendotaLeagueId) === tournamentId,
          );
    const playerIds = new Set<string>();
    const teamIds = new Set<string>();
    let matches = 0;

    for (const target of targets) {
      for (const match of this.matchRowsForLeague(target.league.opendotaLeagueId)) {
        const result = this.ensureEntitiesFromOpenDotaMatch(match.raw, target.league.opendotaLeagueId);

        if (result === null) {
          continue;
        }

        matches += 1;
        result.playerIds.forEach((playerId) => playerIds.add(`${result.tournamentId}:${playerId}`));
        result.teamIds.forEach((teamId) => teamIds.add(`${result.tournamentId}:${teamId}`));
      }

      this.ensureTournamentPlayersFromRosters(target.tournamentId);
      this.refreshEntityStatsForTournament(target.tournamentId);
    }

    return {
      tournaments: targets.length,
      matches,
      players: playerIds.size,
      teams: teamIds.size,
    };
  }

  listTournamentPlayerAccountIds(tournamentId: string): number[] {
    return this.database
      .prepare(
        `
          SELECT DISTINCT p.account_id
          FROM tournament_players tp
          JOIN players p ON p.id = tp.player_id
          WHERE tp.tournament_id = ? AND p.account_id IS NOT NULL
          ORDER BY p.account_id ASC
        `,
      )
      .all(tournamentId)
      .map((row) => nullableNumber(row, "account_id"))
      .filter((accountId): accountId is number => accountId !== null);
  }

  updatePlayerSteamProfiles(profiles: SteamPlayerProfileInput[]): number {
    let updated = 0;

    for (const profile of profiles) {
      if (!Number.isSafeInteger(profile.accountId) || profile.accountId <= 0) {
        continue;
      }

      const displayName = profile.displayName?.trim() || null;
      const avatarUrl = profile.avatarUrl?.trim() || null;
      const steamId64 = profile.steamId64?.trim() || accountIdToSteamId64(profile.accountId);

      const result = this.database
        .prepare(
          `
            UPDATE players
            SET
              display_name = COALESCE(?, display_name),
              steam_id64 = COALESCE(?, steam_id64),
              avatar_url = COALESCE(?, avatar_url),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE account_id = ?
          `,
        )
        .run(displayName, steamId64, avatarUrl, profile.accountId);

      updated += Number(result.changes);
    }

    return updated;
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
    const rawMatch = input.rawJson as unknown as OpenDotaMatchDetail;

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

    const resolvedLeagueId = input.leagueId ?? rawMatch.leagueid ?? rawMatch.league_id ?? null;

    if (resolvedLeagueId !== null) {
      this.matchRowsCache.delete(resolvedLeagueId);
    }

    const syncResult = this.ensureEntitiesFromOpenDotaMatch(rawMatch, resolvedLeagueId);

    if (syncResult !== null) {
      this.refreshEntityStatsForTournament(syncResult.tournamentId, syncResult.playerIds, syncResult.teamIds);
    }

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
    const logoUrl = input.logoUrl?.trim() || null;
    const opendotaTeamId =
      input.opendotaTeamId === undefined || input.opendotaTeamId === null
        ? null
        : requiredPositiveInteger(input.opendotaTeamId, "opendotaTeamId");
    const existingId =
      opendotaTeamId === null
        ? input.tournamentId === undefined
          ? this.getTeamIdByName(name)
          : this.getTournamentTeamIdByName(input.tournamentId, name)
        : this.getTeamIdByOpenDotaTeamId(opendotaTeamId) ??
          (input.tournamentId === undefined ? this.getTeamIdByName(name) : this.getTournamentTeamIdByName(input.tournamentId, name));
    const color = input.color ?? "#64748b";

    if (existingId !== null) {
      this.updateTeam(existingId, {
        name,
        shortName,
        ...(logoUrl === null ? {} : { logoUrl }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(opendotaTeamId === null ? {} : { opendotaTeamId }),
      });

      if (opendotaTeamId !== null) {
        this.fillOpenDotaTeamIdIfMissing(existingId, opendotaTeamId);
      }

      if (input.tournamentId !== undefined && input.tournamentId.length > 0) {
        this.ensureTournamentTeam(input.tournamentId, existingId);
      }

      return this.requireTeam(existingId);
    }

    const id = uniqueId("team", `${name}-${shortName}`);

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare("INSERT INTO teams (id, opendota_team_id, name, short_name, logo_url, color, source) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, opendotaTeamId, name, shortName, logoUrl, color, "manual");

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
      logoUrl,
      color,
    };
  }

  updateTeam(teamId: string, input: UpdateTeamInput): TeamBrief {
    const id = requiredString(teamId, "teamId");
    this.requireTeam(id);

    const updates = {
      name: input.name?.trim() || undefined,
      shortName: input.shortName === undefined ? undefined : normalizeShortName(input.shortName || input.name || ""),
      logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl?.trim() || null,
      color: input.color === undefined ? undefined : input.color?.trim() || null,
      opendotaTeamId:
        input.opendotaTeamId === undefined || input.opendotaTeamId === null
          ? input.opendotaTeamId
          : requiredPositiveInteger(input.opendotaTeamId, "opendotaTeamId"),
    };

    this.database
      .prepare(
        `
          UPDATE teams
          SET
            name = COALESCE(?, name),
            short_name = COALESCE(?, short_name),
            logo_url = CASE WHEN ? THEN ? ELSE logo_url END,
            color = CASE WHEN ? THEN ? ELSE color END,
            opendota_team_id = CASE WHEN ? THEN ? ELSE opendota_team_id END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(
        updates.name ?? null,
        updates.shortName ?? null,
        updates.logoUrl !== undefined ? 1 : 0,
        updates.logoUrl ?? null,
        updates.color !== undefined ? 1 : 0,
        updates.color ?? null,
        updates.opendotaTeamId !== undefined ? 1 : 0,
        updates.opendotaTeamId ?? null,
        id,
      );

    return this.requireTeam(id);
  }

  createPlayer(input: CreatePlayerInput): PlayerBrief {
    const displayName = requiredString(input.displayName, "displayName");
    let accountId =
      input.accountId === undefined || input.accountId === null
        ? null
        : requiredPositiveInteger(input.accountId, "accountId");
    const steamIdentity =
      accountId === null && input.steamId64 !== undefined && input.steamId64 !== null && input.steamId64.trim().length > 0
        ? accountIdentityFromTeamMemberInput({ teamId: "manual", steamId64: input.steamId64 })
        : null;
    accountId = accountId ?? steamIdentity?.accountId ?? null;
    const steamId64 = steamIdentity?.steamId64 ?? normalizeSteamId64(input.steamId64, accountId);
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
            INSERT INTO players (id, account_id, steam_id64, display_name, current_team_id, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .run(id, accountId, steamId64, displayName, currentTeamId, avatarUrl);

      if (currentTeamId !== null) {
        this.database
          .prepare("INSERT OR IGNORE INTO team_members (team_id, player_id, role, joined_at) VALUES (?, ?, 'player', ?)")
          .run(currentTeamId, id, new Date().toISOString());
        this.ensureTournamentPlayersForTeamMembership(currentTeamId, id, "manual");
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
    const role = input.role?.trim() || "player";
    this.requireTeam(teamId);
    const requestedPlayerId = input.playerId?.trim();

    this.database.exec("BEGIN;");

    try {
      const playerId = requestedPlayerId ? this.requirePlayer(requestedPlayerId).id : this.upsertManualPlayerForTeamMember(teamId, input);
      this.database
        .prepare(
          `
            INSERT INTO team_members (team_id, player_id, role, joined_at, left_at)
            VALUES (?, ?, ?, ?, NULL)
            ON CONFLICT(team_id, player_id) DO UPDATE SET
              role = excluded.role,
              left_at = NULL
          `,
        )
        .run(teamId, playerId, role, new Date().toISOString());
      this.database
        .prepare(
          `
            UPDATE players
            SET
              current_team_id = ?,
              display_name = COALESCE(?, display_name),
              avatar_url = COALESCE(?, avatar_url),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(teamId, input.displayName?.trim() || null, input.avatarUrl?.trim() || null, playerId);
      this.ensureTournamentPlayersForTeamMembership(teamId, playerId, "manual");
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getTeamListItemForFirstTournament(teamId);
  }

  removeTeamMember(input: RemoveTeamMemberInput): TournamentTeamListItem | undefined {
    const teamId = requiredString(input.teamId, "teamId");
    const playerId = requiredString(input.playerId, "playerId");

    this.requireTeam(teamId);
    this.requirePlayer(playerId);

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            UPDATE team_members
            SET left_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE team_id = ? AND player_id = ? AND left_at IS NULL
          `,
        )
        .run(teamId, playerId);
      this.database
        .prepare(
          `
            UPDATE players
            SET current_team_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ? AND current_team_id = ?
          `,
        )
        .run(playerId, teamId);
      this.database
        .prepare(
          `
            UPDATE tournament_players
            SET current_team_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE player_id = ? AND current_team_id = ?
          `,
        )
        .run(playerId, teamId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getTeamListItemForFirstTournament(teamId);
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
          INSERT INTO stages (id, tournament_id, type, name, status, sort_order, advancement_rule, config_json)
          VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
        `,
      )
      .run(id, tournamentId, input.type, name, sortOrder, advancementRule, JSON.stringify(input.config ?? {}));

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

  listStageGroups(stageIdParam: string): StageGroup[] | undefined {
    const stageId = requiredString(stageIdParam, "stageId");

    if (this.getStageSummaryById(stageId) === undefined) {
      return undefined;
    }

    return this.database
      .prepare("SELECT * FROM stage_groups WHERE stage_id = ? ORDER BY sort_order ASC, name ASC")
      .all(stageId)
      .map((row) => this.stageGroupFromRow(row));
  }

  createStageGroup(input: CreateStageGroupInput): StageGroup {
    const stageId = requiredString(input.stageId, "stageId");
    const name = requiredString(input.name, "name");

    if (this.getStageSummaryById(stageId) === undefined) {
      throw new Error("Stage not found");
    }

    const sortOrder = input.sortOrder ?? this.nextStageGroupSortOrder(stageId);
    const id = uniqueId("group", `${stageId}-${sortOrder}-${name}`);

    this.database
      .prepare("INSERT INTO stage_groups (id, stage_id, name, sort_order) VALUES (?, ?, ?, ?)")
      .run(id, stageId, name, sortOrder);
    this.recalculateStageStandings(stageId);

    const group = this.getStageGroupById(id);

    if (group === undefined) {
      throw new Error("Created group could not be loaded");
    }

    return group;
  }

  updateStageGroup(groupIdParam: string, input: UpdateStageGroupInput): StageGroup {
    const groupId = requiredString(groupIdParam, "groupId");

    if (this.getStageGroupById(groupId) === undefined) {
      throw new Error("Group not found");
    }

    this.database
      .prepare(
        `
          UPDATE stage_groups
          SET
            name = COALESCE(?, name),
            sort_order = COALESCE(?, sort_order),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(input.name?.trim() || null, input.sortOrder ?? null, groupId);
    this.recalculateStageStandings(this.getStageGroupById(groupId)?.stageId ?? "");

    const group = this.getStageGroupById(groupId);

    if (group === undefined) {
      throw new Error("Updated group could not be loaded");
    }

    return group;
  }

  deleteStageGroup(groupIdParam: string): { deleted: true; groupId: string } {
    const groupId = requiredString(groupIdParam, "groupId");
    const group = this.getStageGroupById(groupId);

    if (group === undefined) {
      throw new Error("Group not found");
    }

    this.database.exec("BEGIN;");

    try {
      this.database.prepare("UPDATE series SET group_id = NULL WHERE group_id = ?").run(groupId);
      this.database.prepare("DELETE FROM stage_groups WHERE id = ?").run(groupId);
      this.recalculateStageStandings(group.stageId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return { deleted: true, groupId };
  }

  addStageGroupTeam(input: AddStageGroupTeamInput): StageGroup {
    const groupId = requiredString(input.groupId, "groupId");
    const teamId = requiredString(input.teamId, "teamId");
    const groupRow = this.database.prepare("SELECT stage_id FROM stage_groups WHERE id = ?").get(groupId);

    if (groupRow === undefined) {
      throw new Error("Group not found");
    }

    const stage = this.getStageSummaryById(text(groupRow, "stage_id"));

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    this.requireTeam(teamId);
    this.ensureTournamentTeam(stage.tournamentId, teamId);

    this.database
      .prepare(
        `
          DELETE FROM stage_group_teams
          WHERE team_id = ?
            AND group_id IN (SELECT id FROM stage_groups WHERE stage_id = ? AND id <> ?)
        `,
      )
      .run(teamId, stage.id, groupId);
    this.database
      .prepare(
        `
          INSERT INTO stage_group_teams (group_id, team_id, seed)
          VALUES (?, ?, ?)
          ON CONFLICT(group_id, team_id) DO UPDATE SET seed = excluded.seed
        `,
      )
      .run(groupId, teamId, input.seed ?? null);
    this.recalculateStageStandings(stage.id);

    const group = this.getStageGroupById(groupId);

    if (group === undefined) {
      throw new Error("Updated group could not be loaded");
    }

    return group;
  }

  randomizeStageGroups(stageIdParam: string, input: RandomizeStageGroupsInput): StageGroup[] {
    const stageId = requiredString(stageIdParam, "stageId");
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    if (stage.type !== "group") {
      throw new Error("Random grouping is only available for group stages");
    }

    const roster = this.listOfficialScheduleTeams(stage.tournamentId);
    const teamIds = roster.length > 0 ? roster.map((item) => item.team.id) : this.listTournamentTeamIds(stage.tournamentId);

    if (teamIds.length < 2) {
      throw new Error("At least 2 teams are required to randomize groups");
    }

    const requestedGroupCount =
      input.groupCount !== undefined
        ? requiredPositiveInteger(input.groupCount, "groupCount")
        : input.groupSize !== undefined
          ? Math.ceil(teamIds.length / requiredPositiveInteger(input.groupSize, "groupSize"))
          : 2;
    const groupCount = clampInteger(requestedGroupCount, 1, teamIds.length);
    const seededTeamIds = new Set(uniqueStrings(input.seededTeamIds ?? roster.filter((item) => item.isSeeded).map((item) => item.team.id)));
    const seededTeams = shuffle(teamIds.filter((teamId) => seededTeamIds.has(teamId)));
    const otherTeams = shuffle(teamIds.filter((teamId) => !seededTeamIds.has(teamId)));
    const groups = Array.from({ length: groupCount }, (_, index) => ({
      id: uniqueId("group", `${stageId}-${index + 1}`),
      name: `${String.fromCharCode(65 + index)} 组`,
      teamIds: [] as string[],
    }));

    seededTeams.forEach((teamId, index) => {
      groups[index % groupCount]?.teamIds.push(teamId);
    });

    for (const teamId of otherTeams) {
      const target = [...groups].sort((left, right) => left.teamIds.length - right.teamIds.length)[0];
      target?.teamIds.push(teamId);
    }

    this.database.exec("BEGIN;");

    try {
      this.database.prepare("DELETE FROM stage_groups WHERE stage_id = ?").run(stageId);
      const groupInsert = this.database.prepare("INSERT INTO stage_groups (id, stage_id, name, sort_order) VALUES (?, ?, ?, ?)");
      const teamInsert = this.database.prepare(
        "INSERT INTO stage_group_teams (group_id, team_id, seed) VALUES (?, ?, ?)",
      );

      groups.forEach((group, groupIndex) => {
        groupInsert.run(group.id, stageId, group.name, groupIndex + 1);
        group.teamIds.forEach((teamId, teamIndex) => {
          teamInsert.run(group.id, teamId, teamIndex + 1);
        });
      });
      this.recalculateStageStandings(stageId);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "group_stage_randomized", {
        stageId,
        groupCount,
        teamCount: teamIds.length,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.listStageGroups(stageId) ?? [];
  }

  generateGroupRoundRobin(stageIdParam: string, input: GenerateGroupRoundRobinInput): StageRound[] {
    const stageId = requiredString(stageIdParam, "stageId");
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    if (stage.type !== "group") {
      throw new Error("Round robin generation is only available for group stages");
    }

    const groups = this.listStageGroups(stageId) ?? [];

    if (groups.length === 0 || groups.every((group) => group.teams.length < 2)) {
      throw new Error("Create groups with at least 2 teams before generating round robin series");
    }

    const boType = input.boType ?? "BO2";

    this.database.exec("BEGIN;");

    try {
      if (input.replaceExisting !== false) {
        this.database.prepare("DELETE FROM series WHERE stage_id = ? AND series_kind = 'regular'").run(stageId);
      }

      const roundId = this.ensureStageRound(stageId, "小组循环赛", 1);
      let createdSeries = 0;

      for (const group of groups) {
        const teams = group.teams;

        for (let leftIndex = 0; leftIndex < teams.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < teams.length; rightIndex += 1) {
            const left = teams[leftIndex];
            const right = teams[rightIndex];

            if (left === undefined || right === undefined) {
              continue;
            }

            this.insertSeries({
              stageId,
              roundId,
              groupId: group.id,
              seriesKind: "regular",
              boType,
              status: "draft",
              scheduledAt: "",
              radiantTeamId: left.id,
              direTeamId: right.id,
            });
            createdSeries += 1;
          }
        }
      }

      this.recalculateStageStandings(stageId);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "group_round_robin_generated", {
        stageId,
        boType,
        createdSeries,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getStageRounds(stageId) ?? [];
  }

  updateStageManualRanks(stageIdParam: string, input: UpdateStageManualRanksInput): StandingRow[] {
    const stageId = requiredString(stageIdParam, "stageId");
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    this.database.exec("BEGIN;");

    try {
      const upsert = this.database.prepare(
        `
          INSERT INTO stage_manual_ranks (stage_id, team_id, manual_rank)
          VALUES (?, ?, ?)
          ON CONFLICT(stage_id, team_id) DO UPDATE SET
            manual_rank = excluded.manual_rank,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `,
      );

      for (const rank of input.ranks) {
        const teamId = requiredString(rank.teamId, "teamId");
        this.ensureTournamentTeam(stage.tournamentId, teamId);
        upsert.run(stageId, teamId, rank.manualRank === null ? null : requiredPositiveInteger(rank.manualRank, "manualRank"));
      }

      this.recalculateStageStandings(stageId);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "manual_ranks_updated", {
        stageId,
        count: input.ranks.length,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getStageStandings(stageId) ?? [];
  }

  generateSwissPairings(stageIdParam: string, input: GenerateSwissPairingsInput): StageRound {
    const stageId = requiredString(stageIdParam, "stageId");
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    if (stage.type !== "swiss") {
      throw new Error("Swiss pairings can only be generated for swiss stages");
    }

    const teamIds = this.officialOrTournamentTeamIds(stage.tournamentId);

    if (teamIds.length < 2) {
      throw new Error("At least 2 teams are required to generate swiss pairings");
    }

    const roundNumber = input.roundNumber ?? this.nextSwissRoundNumber(stageId);
    const boType = input.boType ?? "BO2";

    this.database.exec("BEGIN;");

    try {
      this.clearSwissRoundAndLater(stageId, roundNumber);
      this.recalculateStageStandings(stageId);

      const roundId = this.ensureStageRound(stageId, `瑞士轮第 ${roundNumber} 轮`, roundNumber);
      const pairings = this.buildSwissPairings(stageId, teamIds);
      let createdSeries = 0;

      for (const pairing of pairings.pairs) {
        this.insertSeries({
          stageId,
          roundId,
          seriesKind: "regular",
          boType,
          status: "draft",
          scheduledAt: "",
          radiantTeamId: pairing[0],
          direTeamId: pairing[1],
        });
        createdSeries += 1;
      }

      if (pairings.byeTeamId !== null) {
        this.database
          .prepare("INSERT INTO swiss_byes (stage_id, round_id, team_id) VALUES (?, ?, ?)")
          .run(stageId, roundId, pairings.byeTeamId);
      }

      this.recalculateStageStandings(stageId);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "swiss_pairings_generated", {
        stageId,
        roundNumber,
        createdSeries,
        byeTeamId: pairings.byeTeamId,
        repeatedPairRisk: pairings.repeatedPairRisk,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const round = this.getStageRounds(stageId)?.find((item) => item.roundNumber === roundNumber);

    if (round === undefined) {
      throw new Error("Generated swiss round could not be loaded");
    }

    return round;
  }

  confirmSwissRound(roundIdParam: string, input: ConfirmSwissRoundInput): StageRound {
    const roundId = requiredString(roundIdParam, "roundId");
    const row = this.database.prepare("SELECT * FROM rounds WHERE id = ?").get(roundId);

    if (row === undefined) {
      throw new Error("Round not found");
    }

    const stage = this.getStageSummaryById(text(row, "stage_id"));

    if (stage === undefined || stage.type !== "swiss") {
      throw new Error("Round does not belong to a swiss stage");
    }

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            UPDATE rounds
            SET pairing_status = 'confirmed', status = 'published', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(roundId);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "swiss_round_confirmed", {
        stageId: stage.id,
        roundId,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getStageRounds(stage.id)?.find((round) => round.id === roundId) ?? {
      ...roundFromRow(row),
      pairingStatus: "confirmed",
      byes: this.getSwissByesByRoundId(roundId),
      series: [],
    };
  }

  retractSwissRound(roundIdParam: string, input: ConfirmSwissRoundInput): StageRound[] {
    const roundId = requiredString(roundIdParam, "roundId");
    const row = this.database.prepare("SELECT * FROM rounds WHERE id = ?").get(roundId);

    if (row === undefined) {
      throw new Error("Round not found");
    }

    const stage = this.getStageSummaryById(text(row, "stage_id"));

    if (stage === undefined || stage.type !== "swiss") {
      throw new Error("Round does not belong to a swiss stage");
    }

    const roundNumber = numberValue(row, "round_number");

    this.database.exec("BEGIN;");

    try {
      this.clearSwissRoundAndLater(stage.id, roundNumber);
      this.recalculateStageStandings(stage.id);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "swiss_round_retracted", {
        stageId: stage.id,
        roundId,
        roundNumber,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getStageRounds(stage.id) ?? [];
  }

  removeStageGroupTeam(groupIdParam: string, teamIdParam: string): StageGroup {
    const groupId = requiredString(groupIdParam, "groupId");
    const teamId = requiredString(teamIdParam, "teamId");

    if (this.getStageGroupById(groupId) === undefined) {
      throw new Error("Group not found");
    }

    this.database.prepare("DELETE FROM stage_group_teams WHERE group_id = ? AND team_id = ?").run(groupId, teamId);
    this.recalculateStageStandings(this.getStageGroupById(groupId)?.stageId ?? "");

    const group = this.getStageGroupById(groupId);

    if (group === undefined) {
      throw new Error("Updated group could not be loaded");
    }

    return group;
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
      byes: [],
      series: [],
    };
  }

  createSeries(input: CreateSeriesInput): SeriesSummary {
    const stageId = requiredString(input.stageId, "stageId");
    const roundId = requiredString(input.roundId, "roundId");
    const radiantTeamId = requiredString(input.radiantTeamId, "radiantTeamId");
    const direTeamId = requiredString(input.direTeamId, "direTeamId");
    const groupId = this.resolveSeriesGroupId(stageId, input.groupId);
    const seriesKind = normalizeSeriesKind(input.seriesKind);
    const status = input.status ?? "scheduled";
    const scheduledAt = input.scheduledAt ?? new Date().toISOString();
    let id = "";

    this.database.exec("BEGIN;");

    try {
      id = this.insertSeries({
        stageId,
        roundId,
        groupId,
        seriesKind,
        boType: input.boType,
        status,
        scheduledAt,
        radiantTeamId,
        direTeamId,
      });
      this.recalculateStageStandings(stageId);
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

  updateSeries(seriesIdParam: string, input: UpdateSeriesInput): SeriesSummary {
    const seriesId = requiredString(seriesIdParam, "seriesId");
    const existing = this.getSeriesById(seriesId);

    if (existing === undefined) {
      throw new Error("Series not found");
    }

    const stageId = existing.stageId;
    const roundId = input.roundId === undefined ? existing.roundId : this.resolveSeriesRoundId(stageId, input.roundId);
    const groupId = input.groupId === undefined ? existing.groupId : this.resolveSeriesGroupId(stageId, input.groupId);
    const seriesKind = input.seriesKind === undefined ? existing.seriesKind : normalizeSeriesKind(input.seriesKind);
    const radiantTeamId = input.radiantTeamId === undefined ? existing.radiantTeam.id : requiredString(input.radiantTeamId, "radiantTeamId");
    const direTeamId = input.direTeamId === undefined ? existing.direTeam.id : requiredString(input.direTeamId, "direTeamId");

    if (radiantTeamId === direTeamId) {
      throw new Error("radiantTeamId and direTeamId must be different");
    }

    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    this.ensureTournamentTeam(stage.tournamentId, radiantTeamId);
    this.ensureTournamentTeam(stage.tournamentId, direTeamId);

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            UPDATE series
            SET
              round_id = ?,
              group_id = ?,
              series_kind = ?,
              bo_type = ?,
              status = ?,
              scheduled_at = ?,
              radiant_team_id = ?,
              dire_team_id = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(
          roundId,
          groupId,
          seriesKind,
          input.boType ?? existing.boType,
          input.status ?? existing.status,
          input.scheduledAt === undefined ? existing.scheduledAt : input.scheduledAt ?? existing.scheduledAt,
          radiantTeamId,
          direTeamId,
          seriesId,
        );
      this.recalculateStageStandings(stageId);
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

  updateSeriesResult(seriesIdParam: string, input: UpdateSeriesResultInput): SeriesSummary {
    const seriesId = requiredString(seriesIdParam, "seriesId");
    const series = this.getSeriesById(seriesId);

    if (series === undefined) {
      throw new Error("Series not found");
    }

    const radiantScore = requiredNonNegativeInteger(input.radiantScore, "radiantScore");
    const direScore = requiredNonNegativeInteger(input.direScore, "direScore");
    const winnerTeamId =
      radiantScore > direScore ? series.radiantTeam.id : direScore > radiantScore ? series.direTeam.id : null;

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            UPDATE series
            SET
              radiant_score = ?,
              dire_score = ?,
              winner_team_id = ?,
              status = 'completed',
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(radiantScore, direScore, winnerTeamId, seriesId);
      this.database
        .prepare(
          `
            UPDATE series_games
            SET
              radiant_score = CASE WHEN game_index = 1 THEN ? ELSE radiant_score END,
              dire_score = CASE WHEN game_index = 1 THEN ? ELSE dire_score END,
              winner_team_id = CASE WHEN game_index = 1 THEN ? ELSE winner_team_id END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE series_id = ?
          `,
        )
        .run(radiantScore, direScore, winnerTeamId, seriesId);
      this.recalculateStageStandings(series.stageId);
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

  deleteSeries(seriesIdParam: string): { deleted: true; seriesId: string } {
    const seriesId = requiredString(seriesIdParam, "seriesId");
    const series = this.getSeriesById(seriesId);

    if (series === undefined) {
      throw new Error("Series not found");
    }

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            UPDATE bracket_nodes
            SET
              series_id = NULL,
              status = CASE WHEN winner_team_id IS NULL THEN 'pending' ELSE status END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE series_id = ?
          `,
        )
        .run(seriesId);
      this.database.prepare("DELETE FROM series WHERE id = ?").run(seriesId);
      this.recalculateStageStandings(series.stageId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return { deleted: true, seriesId };
  }

  clearTournamentMatchRecords(tournamentIdParam: string): ClearTournamentMatchRecordsResult {
    const tournamentId = requiredString(tournamentIdParam, "tournamentId");
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      throw new Error("Tournament not found");
    }

    const seriesCountRow = this.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM series s
          JOIN stages st ON st.id = s.stage_id
          WHERE st.tournament_id = ?
        `,
      )
      .get(target.tournamentId);
    const matchCountRow = this.database
      .prepare("SELECT COUNT(*) AS count FROM opendota_matches WHERE league_id = ?")
      .get(target.league.opendotaLeagueId);
    const deletedSeries = numberValue(seriesCountRow ?? {}, "count");
    const deletedOpenDotaMatches = numberValue(matchCountRow ?? {}, "count");

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare("DELETE FROM bracket_nodes WHERE stage_id IN (SELECT id FROM stages WHERE tournament_id = ?)")
        .run(target.tournamentId);
      this.database
        .prepare("DELETE FROM standings WHERE stage_id IN (SELECT id FROM stages WHERE tournament_id = ?)")
        .run(target.tournamentId);
      this.database.prepare("DELETE FROM rounds WHERE stage_id IN (SELECT id FROM stages WHERE tournament_id = ?)").run(target.tournamentId);
      this.database.prepare("DELETE FROM opendota_matches WHERE league_id = ?").run(target.league.opendotaLeagueId);
      this.database.prepare("DELETE FROM tournament_player_stats WHERE tournament_id = ?").run(target.tournamentId);
      this.database.prepare("DELETE FROM tournament_team_stats WHERE tournament_id = ?").run(target.tournamentId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return {
      tournamentId: target.tournamentId,
      deletedSeries,
      deletedOpenDotaMatches,
    };
  }

  createKnockoutBracket(tournamentIdParam: string, input: CreateKnockoutBracketInput): KnockoutBracketResult {
    const tournament = this.getTournamentDetail(requiredString(tournamentIdParam, "tournamentId"));

    if (tournament === undefined) {
      throw new Error("Tournament not found");
    }

    const teamIds = uniqueStrings(input.teamIds);

    if (teamIds.length < 2) {
      throw new Error("At least 2 teams are required for a knockout bracket");
    }

    const bracketType = input.bracketType ?? "single_elimination";
    const bracketSize = normalizeBracketSize(input.bracketSize, teamIds.length);
    const boType = input.boType ?? "BO3";
    const scheduledAt = input.scheduledAt ?? new Date().toISOString();
    const name =
      input.name?.trim() || (bracketType === "double_elimination" ? "双败淘汰赛" : "单败淘汰赛");
    const winnerTeamCount =
      bracketType === "double_elimination"
        ? clampInteger(input.winnerTeamCount ?? Math.min(teamIds.length, bracketSize), 2, bracketSize)
        : teamIds.length;
    const loserTeamCount =
      bracketType === "double_elimination"
        ? clampInteger(input.loserTeamCount ?? Math.max(0, teamIds.length - winnerTeamCount), 0, Math.floor(bracketSize / 2))
        : 0;
    const winnerTeamIds = bracketType === "double_elimination" ? teamIds.slice(0, winnerTeamCount) : teamIds;
    const loserTeamIds =
      bracketType === "double_elimination" ? teamIds.slice(winnerTeamCount, winnerTeamCount + loserTeamCount) : [];

    if (teamIds.length > bracketSize) {
      throw new Error(`teamIds cannot contain more than ${bracketSize} teams for this bracket`);
    }

    if (bracketType === "double_elimination" && winnerTeamIds.length + loserTeamIds.length !== teamIds.length) {
      throw new Error("winnerTeamCount and loserTeamCount must cover all selected teams");
    }

    for (const teamId of teamIds) {
      this.ensureTournamentTeam(tournament.id, teamId);
    }

    const stageId = uniqueId("stage", `${tournament.id}-${bracketType}-${name}`);
    const sortOrder = this.nextStageSortOrder(tournament.id);
    const stageRule =
      bracketType === "double_elimination"
        ? `双败淘汰 · 胜者组 ${winnerTeamIds.length} 队 / 败者组 ${loserTeamIds.length} 队 · 总决赛 · ${boType}`
        : `单败淘汰 · ${bracketSize} 队 · 胜者自动推进 · ${boType}`;
    const roundSpecs =
      bracketType === "double_elimination"
        ? doubleEliminationRoundSpecs(bracketSize)
        : singleEliminationRoundSpecs(bracketSize);
    const nodeDrafts =
      bracketType === "double_elimination"
        ? doubleEliminationNodeDrafts(bracketSize, winnerTeamIds, loserTeamIds)
        : singleEliminationNodeDrafts(bracketSize, teamIds);

    this.database.exec("BEGIN;");

    try {
      this.database
        .prepare(
          `
            INSERT INTO stages (id, tournament_id, type, name, status, sort_order, advancement_rule, config_json)
            VALUES (?, ?, 'knockout', ?, 'draft', ?, ?, ?)
          `,
        )
        .run(
          stageId,
          tournament.id,
          name,
          sortOrder,
          stageRule,
          JSON.stringify({
            officialSchedule: true,
            bracketType,
            bracketSize,
            winnerTeamCount: winnerTeamIds.length,
            loserTeamCount: loserTeamIds.length,
            boType,
            teamIds,
            winnerTeamIds,
            loserTeamIds,
          }),
        );

      const roundIds = new Map<string, string>();

      for (const round of roundSpecs) {
        const roundId = uniqueId("round", `${round.roundNumber}-${round.name}-${stageId}`);
        roundIds.set(round.key, roundId);
        this.database
          .prepare(
            `
              INSERT INTO rounds (id, stage_id, round_number, name, status, pairing_status)
              VALUES (?, ?, ?, ?, 'draft', 'draft')
            `,
          )
          .run(roundId, stageId, round.roundNumber, round.name);
      }

      const nodeIds = new Map<string, string>();

      for (const draft of nodeDrafts) {
        nodeIds.set(draft.key, uniqueId("bracket", `${draft.key}-${stageId}`));
      }

      const insertNode = this.database.prepare(`
        INSERT INTO bracket_nodes (
          id, stage_id, bracket_group, round_number, round_name, position, status,
          radiant_team_id, dire_team_id, series_id, next_node_id, next_slot,
          loser_next_node_id, loser_next_slot, winner_team_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL)
      `);

      for (const draft of nodeDrafts) {
        const id = nodeIds.get(draft.key);

        if (id === undefined) {
          throw new Error("Bracket node id was not prepared");
        }

        insertNode.run(
          id,
          stageId,
          draft.bracketGroup,
          draft.roundNumber,
          draft.roundName,
          draft.position,
          draft.radiantTeamId !== null && draft.direTeamId !== null ? "scheduled" : "pending",
          draft.radiantTeamId,
          draft.direTeamId,
          draft.nextNodeKey === null ? null : nodeIds.get(draft.nextNodeKey) ?? null,
          draft.nextSlot,
          draft.loserNextNodeKey === null ? null : nodeIds.get(draft.loserNextNodeKey) ?? null,
          draft.loserNextSlot,
        );
      }

      this.createReadyBracketSeries(stageId, boType, scheduledAt, roundIds);
      this.autoAdvanceBracketByes(stageId, boType, scheduledAt, roundIds);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Created bracket stage could not be loaded");
    }

    return {
      stage,
      rounds: this.getStageRounds(stageId) ?? [],
      bracket: this.getStageBracket(stageId) ?? [],
    };
  }

  advanceBracketNode(nodeIdParam: string, input: AdvanceBracketNodeInput): BracketNode[] {
    const nodeId = requiredString(nodeIdParam, "nodeId");
    const winnerTeamId = requiredString(input.winnerTeamId, "winnerTeamId");
    const row = this.getBracketNodeRow(nodeId);

    if (row === undefined) {
      throw new Error("Bracket node not found");
    }

    const stageId = text(row, "stage_id");
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    const config = parseJson<{ boType?: SeriesSummary["boType"] }>(this.stageConfigJson(stageId), {});
    const boType = config.boType ?? "BO3";
    const scheduledAt = new Date().toISOString();
    const roundIds = this.roundIdsByBracketNodeRound(stageId);

    this.database.exec("BEGIN;");

    try {
      this.completeBracketNode(nodeId, winnerTeamId, boType, scheduledAt, roundIds, true);
      this.autoAdvanceBracketByes(stageId, boType, scheduledAt, roundIds);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getStageBracket(stageId) ?? [];
  }

  setBracketNodeSlot(nodeIdParam: string, input: SetBracketNodeSlotInput): BracketNode[] {
    const nodeId = requiredString(nodeIdParam, "nodeId");
    const slot = input.slot === "radiant" || input.slot === "dire" ? input.slot : null;

    if (slot === null) {
      throw new Error("slot must be radiant or dire");
    }

    const row = this.getBracketNodeRow(nodeId);

    if (row === undefined) {
      throw new Error("Bracket node not found");
    }

    const stageId = text(row, "stage_id");
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    const completedSeriesCount = numberValue(
      this.database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM bracket_nodes
            WHERE stage_id = ?
              AND winner_team_id IS NOT NULL
              AND series_id IS NOT NULL
          `,
        )
        .get(stageId) ?? {},
      "count",
    );

    if (completedSeriesCount > 0) {
      throw new Error("Bracket slots cannot be edited after a played match has a winner");
    }

    const teamId = input.teamId === null || input.teamId === undefined || input.teamId.trim().length === 0 ? null : input.teamId.trim();
    const targetColumn = slot === "radiant" ? "radiant_team_id" : "dire_team_id";
    const previousTeamId = nullableText(row, targetColumn);
    const config = parseJson<{ boType?: SeriesSummary["boType"] }>(this.stageConfigJson(stageId), {});
    const boType = config.boType ?? "BO3";
    const scheduledAt = new Date().toISOString();
    const roundIds = this.roundIdsByBracketNodeRound(stageId);

    if (teamId !== null) {
      this.ensureTournamentTeam(stage.tournamentId, teamId);
    }

    this.database.exec("BEGIN;");

    try {
      const staleSeriesIds = this.database
        .prepare(
          `
            SELECT series_id
            FROM bracket_nodes
            WHERE stage_id = ?
              AND series_id IS NOT NULL
              AND winner_team_id IS NULL
          `,
        )
        .all(stageId)
        .map((seriesRow) => text(seriesRow, "series_id"));

      this.database
        .prepare(
          `
            UPDATE bracket_nodes
            SET
              series_id = CASE WHEN winner_team_id IS NULL THEN NULL ELSE series_id END,
              winner_team_id = CASE WHEN series_id IS NULL THEN NULL ELSE winner_team_id END,
              status = CASE
                WHEN series_id IS NULL THEN 'pending'
                WHEN winner_team_id IS NULL THEN 'pending'
                ELSE status
              END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE stage_id = ?
          `,
        )
        .run(stageId);

      if (staleSeriesIds.length > 0) {
        const placeholders = staleSeriesIds.map(() => "?").join(", ");
        this.database.prepare(`DELETE FROM series WHERE id IN (${placeholders})`).run(...staleSeriesIds);
      }

      for (const duplicateTeamId of uniqueStrings([previousTeamId, teamId].filter((value): value is string => value !== null))) {
        this.database
          .prepare(
            `
              UPDATE bracket_nodes
              SET
                radiant_team_id = CASE WHEN radiant_team_id = ? THEN NULL ELSE radiant_team_id END,
                dire_team_id = CASE WHEN dire_team_id = ? THEN NULL ELSE dire_team_id END,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE stage_id = ?
            `,
          )
          .run(duplicateTeamId, duplicateTeamId, stageId);
      }

      this.database
        .prepare(
          `
            UPDATE bracket_nodes
            SET
              ${targetColumn} = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(teamId, nodeId);

      this.createReadyBracketSeries(stageId, boType, scheduledAt, roundIds);
      this.autoAdvanceBracketByes(stageId, boType, scheduledAt, roundIds);
      this.insertScheduleLog(stage.tournamentId, input.actor ?? "admin", "bracket_slot_updated", {
        stageId,
        nodeId,
        slot,
        teamId,
      });
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.getStageBracket(stageId) ?? [];
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
      this.recalculateStageStandings(series.stageId);
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
                id, round_id, stage_id, group_id, bo_type, status, scheduled_at, radiant_team_id, dire_team_id
              )
              VALUES (?, ?, ?, NULL, ?, 'scheduled', ?, ?, ?)
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
      this.recalculateStageStandings(stageId);
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

  private insertSeries(input: {
    stageId: string;
    roundId: string;
    groupId?: string | null;
    seriesKind?: SeriesSummary["seriesKind"];
    boType: SeriesSummary["boType"];
    status: SeriesSummary["status"];
    scheduledAt: string;
    radiantTeamId: string;
    direTeamId: string;
  }): string {
    const roundRow = this.database.prepare("SELECT id FROM rounds WHERE id = ? AND stage_id = ?").get(input.roundId, input.stageId);

    if (roundRow === undefined) {
      throw new Error("Round does not belong to this stage");
    }

    const stage = this.getStageSummaryById(input.stageId);

    if (stage === undefined) {
      throw new Error("Stage not found");
    }

    if (input.radiantTeamId === input.direTeamId) {
      throw new Error("radiantTeamId and direTeamId must be different");
    }

    this.ensureTournamentTeam(stage.tournamentId, input.radiantTeamId);
    this.ensureTournamentTeam(stage.tournamentId, input.direTeamId);

    const id = uniqueId(
      "series",
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${input.radiantTeamId}-${input.direTeamId}-${input.roundId}`,
    );

    this.database
      .prepare(
        `
          INSERT INTO series (
            id, round_id, stage_id, group_id, series_kind, bo_type, status, scheduled_at, radiant_team_id, dire_team_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.roundId,
        input.stageId,
        input.groupId ?? null,
        normalizeSeriesKind(input.seriesKind),
        input.boType,
        input.status,
        input.scheduledAt,
        input.radiantTeamId,
        input.direTeamId,
      );

    const gameCount = gameCountForBo(input.boType);
    const gameInsert = this.database.prepare(`
      INSERT INTO series_games (id, series_id, game_index)
      VALUES (?, ?, ?)
    `);

    for (let gameIndex = 1; gameIndex <= gameCount; gameIndex += 1) {
      gameInsert.run(`${id}_g${gameIndex}`, id, gameIndex);
    }

    return id;
  }

  private createReadyBracketSeries(
    stageId: string,
    boType: SeriesSummary["boType"],
    scheduledAt: string,
    roundIds?: Map<string, string>,
  ): void {
    const rows = this.database
      .prepare(
        `
          SELECT id, bracket_group, round_number, round_name, radiant_team_id, dire_team_id, series_id
          FROM bracket_nodes
          WHERE stage_id = ?
            AND winner_team_id IS NULL
            AND series_id IS NULL
            AND radiant_team_id IS NOT NULL
            AND dire_team_id IS NOT NULL
        `,
      )
      .all(stageId);

    for (const row of rows) {
      const roundId =
        roundIds?.get(bracketRoundKey(text(row, "bracket_group") as BracketNode["bracketGroup"], numberValue(row, "round_number"))) ??
        this.roundIdForBracketNode(stageId, numberValue(row, "round_number"));

      if (roundId === null) {
        throw new Error("Round not found for bracket node");
      }

      const seriesId = this.insertSeries({
        stageId,
        roundId,
        boType,
        status: "draft",
        scheduledAt,
        radiantTeamId: text(row, "radiant_team_id"),
        direTeamId: text(row, "dire_team_id"),
      });

      this.database
        .prepare(
          `
            UPDATE bracket_nodes
            SET
              series_id = ?,
              status = 'scheduled',
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(seriesId, text(row, "id"));
    }
  }

  private autoAdvanceBracketByes(
    stageId: string,
    boType: SeriesSummary["boType"],
    scheduledAt: string,
    roundIds?: Map<string, string>,
  ): void {
    const rows = this.database
      .prepare(
        `
          WITH opening_rounds AS (
            SELECT bracket_group, MIN(round_number) AS opening_round_number
            FROM bracket_nodes
            WHERE stage_id = ?
            GROUP BY bracket_group
          )
          SELECT bn.id, bn.radiant_team_id, bn.dire_team_id
          FROM bracket_nodes bn
          JOIN opening_rounds op
            ON op.bracket_group = bn.bracket_group
           AND op.opening_round_number = bn.round_number
          WHERE bn.stage_id = ?
            AND bn.winner_team_id IS NULL
            AND bn.series_id IS NULL
            AND (
              (bn.radiant_team_id IS NOT NULL AND bn.dire_team_id IS NULL)
              OR (bn.radiant_team_id IS NULL AND bn.dire_team_id IS NOT NULL)
            )
          ORDER BY bn.round_number ASC, bn.position ASC
        `,
      )
      .all(stageId, stageId);

    for (const row of rows) {
      const winnerTeamId = nullableText(row, "radiant_team_id") ?? nullableText(row, "dire_team_id");

      if (winnerTeamId !== null) {
        this.completeBracketNode(text(row, "id"), winnerTeamId, boType, scheduledAt, roundIds, false);
      }
    }
  }

  private completeBracketNode(
    nodeId: string,
    winnerTeamId: string,
    boType: SeriesSummary["boType"],
    scheduledAt: string,
    roundIds: Map<string, string> | undefined,
    updateSeries: boolean,
  ): void {
    const row = this.getBracketNodeRow(nodeId);

    if (row === undefined) {
      throw new Error("Bracket node not found");
    }

    const radiantTeamId = nullableText(row, "radiant_team_id");
    const direTeamId = nullableText(row, "dire_team_id");

    if (winnerTeamId !== radiantTeamId && winnerTeamId !== direTeamId) {
      throw new Error("winnerTeamId must be one of the bracket node teams");
    }

    if (nullableText(row, "winner_team_id") !== null) {
      throw new Error("Bracket node already has a winner");
    }

    const loserTeamId = winnerTeamId === radiantTeamId ? direTeamId : radiantTeamId;
    const seriesId = nullableText(row, "series_id");

    if (updateSeries && seriesId !== null) {
      this.markSeriesWinner(seriesId, winnerTeamId);
    }

    this.database
      .prepare(
        `
          UPDATE bracket_nodes
          SET
            winner_team_id = ?,
            status = 'completed',
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(winnerTeamId, nodeId);

    const stageId = text(row, "stage_id");
    const nextNodeId = nullableText(row, "next_node_id");
    const nextSlot = nullableText(row, "next_slot") as BracketSlot | null;

    if (nextNodeId !== null && nextSlot !== null) {
      this.assignTeamToBracketNode(nextNodeId, nextSlot, winnerTeamId, boType, scheduledAt, roundIds);
    }

    const loserNextNodeId = nullableText(row, "loser_next_node_id");
    const loserNextSlot = nullableText(row, "loser_next_slot") as BracketSlot | null;

    if (loserTeamId !== null && loserNextNodeId !== null && loserNextSlot !== null) {
      this.assignTeamToBracketNode(loserNextNodeId, loserNextSlot, loserTeamId, boType, scheduledAt, roundIds);
    }

    this.createReadyBracketSeries(stageId, boType, scheduledAt, roundIds);
  }

  private assignTeamToBracketNode(
    nodeId: string,
    slot: BracketSlot,
    teamId: string,
    boType: SeriesSummary["boType"],
    scheduledAt: string,
    roundIds: Map<string, string> | undefined,
  ): void {
    const column = slot === "radiant" ? "radiant_team_id" : "dire_team_id";
    const row = this.getBracketNodeRow(nodeId);

    if (row === undefined) {
      throw new Error("Next bracket node not found");
    }

    const currentTeamId = nullableText(row, column);

    if (currentTeamId !== null && currentTeamId !== teamId) {
      throw new Error("Bracket slot already contains another team");
    }

    if (currentTeamId === teamId) {
      return;
    }

    this.database
      .prepare(
        `
          UPDATE bracket_nodes
          SET
            ${column} = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(teamId, nodeId);

    this.createReadyBracketSeries(text(row, "stage_id"), boType, scheduledAt, roundIds);
  }

  private markSeriesWinner(seriesId: string, winnerTeamId: string): void {
    const series = this.getSeriesById(seriesId);

    if (series === undefined) {
      throw new Error("Series not found");
    }

    if (winnerTeamId !== series.radiantTeam.id && winnerTeamId !== series.direTeam.id) {
      throw new Error("winnerTeamId must be one of the series teams");
    }

    const requiredWins = Math.floor(gameCountForBo(series.boType) / 2) + 1;
    const radiantScore = winnerTeamId === series.radiantTeam.id ? requiredWins : 0;
    const direScore = winnerTeamId === series.direTeam.id ? requiredWins : 0;

    this.database
      .prepare(
        `
          UPDATE series
          SET
            radiant_score = ?,
            dire_score = ?,
            winner_team_id = ?,
            status = 'completed',
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(radiantScore, direScore, winnerTeamId, seriesId);
    this.database
      .prepare(
        `
          UPDATE series_games
          SET
            winner_team_id = CASE WHEN game_index <= ? THEN ? ELSE winner_team_id END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE series_id = ?
        `,
      )
      .run(requiredWins, winnerTeamId, seriesId);
  }

  private getBracketNodeRow(nodeId: string): DbRow | undefined {
    return this.database.prepare("SELECT * FROM bracket_nodes WHERE id = ?").get(nodeId);
  }

  private stageConfigJson(stageId: string): string {
    const row = this.database.prepare("SELECT config_json FROM stages WHERE id = ?").get(stageId);

    return row === undefined ? "{}" : text(row, "config_json");
  }

  private roundIdsByBracketNodeRound(stageId: string): Map<string, string> {
    const rows = this.database
      .prepare(
        `
          SELECT DISTINCT bn.bracket_group, bn.round_number, r.id AS round_id
          FROM bracket_nodes bn
          JOIN rounds r ON r.stage_id = bn.stage_id AND r.round_number = bn.round_number
          WHERE bn.stage_id = ?
        `,
      )
      .all(stageId);
    const roundIds = new Map<string, string>();

    for (const row of rows) {
      roundIds.set(bracketRoundKey(text(row, "bracket_group") as BracketNode["bracketGroup"], numberValue(row, "round_number")), text(row, "round_id"));
    }

    return roundIds;
  }

  private roundIdForBracketNode(stageId: string, roundNumber: number): string | null {
    const row = this.database.prepare("SELECT id FROM rounds WHERE stage_id = ? AND round_number = ?").get(stageId, roundNumber);

    return row === undefined ? null : text(row, "id");
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
      steamId64: nullableText(row, "steam_id64") ?? steamId64FromAccountId(nullableNumber(row, "account_id")),
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

  private ensureEntitiesFromOpenDotaMatch(rawMatch: OpenDotaMatchDetail, leagueId: number | null): MatchEntitySyncResult | null {
    if (!Number.isSafeInteger(rawMatch.match_id) || !Array.isArray(rawMatch.players) || leagueId === null) {
      return null;
    }

    const target = this.getLeagueSyncTargetByOpenDotaLeagueId(leagueId);

    if (target === undefined) {
      return null;
    }

    const sideTeams: Record<TeamSide, string | null> = {
      radiant: this.ensureTeamFromMatchSide(target.tournamentId, rawMatch, "radiant"),
      dire: this.ensureTeamFromMatchSide(target.tournamentId, rawMatch, "dire"),
    };
    const playerIds = new Set<string>();
    const teamIds = new Set<string>();

    for (const teamId of Object.values(sideTeams)) {
      if (teamId !== null) {
        this.ensureTournamentTeam(target.tournamentId, teamId);
        teamIds.add(teamId);
      }
    }

    for (const player of rawMatch.players) {
      const teamId = sideTeams[sideFromPlayer(player)];
      const playerId = this.upsertObservedPlayer(player, teamId);

      if (playerId !== null) {
        playerIds.add(playerId);
        this.ensureTournamentPlayer(target.tournamentId, playerId, teamId, "opendota", rawMatch);
      }
    }

    return {
      tournamentId: target.tournamentId,
      playerIds,
      teamIds,
    };
  }

  private ensureEntitiesForTournament(target: LeagueSyncTarget): void {
    for (const match of this.matchRowsForLeague(target.league.opendotaLeagueId)) {
      this.ensureEntitiesFromOpenDotaMatch(match.raw, target.league.opendotaLeagueId);
    }
  }

  private ensureTeamFromMatchSide(tournamentId: string, rawMatch: OpenDotaMatchDetail, side: TeamSide): string | null {
    const opendotaTeamId = side === "radiant" ? rawMatch.radiant_team_id : rawMatch.dire_team_id;
    const rawName = side === "radiant" ? rawMatch.radiant_name : rawMatch.dire_name;
    const name = usableTeamName(rawName);

    if (typeof opendotaTeamId === "number" && Number.isSafeInteger(opendotaTeamId) && opendotaTeamId > 0) {
      const existingByExternalId = this.getTeamIdByOpenDotaTeamId(opendotaTeamId);

      if (existingByExternalId !== null) {
        return existingByExternalId;
      }

      const existingByName = name === null ? null : this.getTournamentTeamIdByName(tournamentId, name);
      const teamId = existingByName ?? `team_opendota_${opendotaTeamId}`;

      this.database
        .prepare(
          `
            INSERT INTO teams (id, opendota_team_id, name, short_name, logo_url, color, source)
            VALUES (?, ?, ?, ?, NULL, ?, 'opendota')
            ON CONFLICT(id) DO UPDATE SET
              opendota_team_id = COALESCE(teams.opendota_team_id, excluded.opendota_team_id),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          `,
        )
        .run(teamId, opendotaTeamId, name ?? `OpenDota 队伍 ${opendotaTeamId}`, normalizeShortName(name ?? String(opendotaTeamId)), side === "radiant" ? "#4ade80" : "#f87171");

      this.ensureTournamentTeam(tournamentId, teamId);
      return teamId;
    }

    if (name === null) {
      return null;
    }

    const existingByName = this.getTournamentTeamIdByName(tournamentId, name);

    if (existingByName !== null) {
      this.ensureTournamentTeam(tournamentId, existingByName);
      return existingByName;
    }

    const teamId = `team_auto_${slugify(name) || side}`;

    this.database
      .prepare(
        `
          INSERT OR IGNORE INTO teams (id, opendota_team_id, name, short_name, logo_url, color, source)
          VALUES (?, NULL, ?, ?, NULL, ?, 'opendota')
        `,
      )
      .run(teamId, name, normalizeShortName(name), side === "radiant" ? "#4ade80" : "#f87171");

    this.ensureTournamentTeam(tournamentId, teamId);
    return teamId;
  }

  private upsertObservedPlayer(player: OpenDotaMatchPlayer, teamId: string | null): string | null {
    const accountId = typeof player.account_id === "number" && player.account_id > 0 ? player.account_id : null;

    if (accountId === null) {
      return null;
    }

    const displayName = player.personaname?.trim() || player.name?.trim() || player.player_name?.trim() || `玩家 ${accountId}`;
    const avatarUrl = playerAvatarUrl(player);
    const existing = this.database.prepare("SELECT id, current_team_id FROM players WHERE account_id = ?").get(accountId);
    const playerId = existing === undefined ? `player_account_${accountId}` : text(existing, "id");

    if (existing === undefined) {
      this.database
        .prepare(
          `
            INSERT INTO players (id, account_id, display_name, current_team_id, avatar_url)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(playerId, accountId, displayName, teamId, avatarUrl);
    } else {
      this.database
        .prepare(
          `
            UPDATE players
            SET
              display_name = CASE
                WHEN display_name = '' OR display_name = ? THEN ?
                ELSE display_name
              END,
              current_team_id = COALESCE(current_team_id, ?),
              avatar_url = COALESCE(avatar_url, ?),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(`玩家 ${accountId}`, displayName, teamId, avatarUrl, playerId);
    }

    if (teamId !== null) {
      this.database
        .prepare("INSERT OR IGNORE INTO team_members (team_id, player_id, role, joined_at) VALUES (?, ?, 'player', ?)")
        .run(teamId, playerId, new Date().toISOString());
    }

    return playerId;
  }

  private ensureTournamentPlayer(
    tournamentId: string,
    playerId: string,
    teamId: string | null,
    source: "manual" | "opendota",
    rawMatch?: OpenDotaMatchDetail,
  ): void {
    const matchId = Number.isSafeInteger(rawMatch?.match_id) ? rawMatch?.match_id ?? null : null;
    const seenAt = rawMatch === undefined ? new Date().toISOString() : matchStartTime(rawMatch);

    this.database
      .prepare(
        `
          INSERT INTO tournament_players (
            tournament_id, player_id, current_team_id, source, first_seen_match_id, last_seen_match_id, last_seen_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(tournament_id, player_id) DO UPDATE SET
            current_team_id = COALESCE(excluded.current_team_id, tournament_players.current_team_id),
            source = CASE
              WHEN tournament_players.source = 'manual' THEN tournament_players.source
              ELSE excluded.source
            END,
            first_seen_match_id = COALESCE(tournament_players.first_seen_match_id, excluded.first_seen_match_id),
            last_seen_match_id = COALESCE(excluded.last_seen_match_id, tournament_players.last_seen_match_id),
            last_seen_at = COALESCE(excluded.last_seen_at, tournament_players.last_seen_at),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `,
      )
      .run(tournamentId, playerId, teamId, source, matchId, matchId, seenAt);
  }

  private ensureTournamentPlayersForTeamMembership(teamId: string, playerId: string, source: "manual" | "opendota"): void {
    const rows = this.database.prepare("SELECT tournament_id FROM tournament_teams WHERE team_id = ?").all(teamId);

    for (const row of rows) {
      this.ensureTournamentPlayer(text(row, "tournament_id"), playerId, teamId, source);
    }
  }

  private ensureTournamentPlayersFromRosters(tournamentId: string): void {
    this.database
      .prepare(
        `
          SELECT DISTINCT tt.tournament_id, tm.player_id, tm.team_id
          FROM tournament_teams tt
          JOIN team_members tm ON tm.team_id = tt.team_id AND tm.left_at IS NULL
          WHERE tt.tournament_id = ?
        `,
      )
      .all(tournamentId)
      .forEach((row) => {
        this.ensureTournamentPlayer(text(row, "tournament_id"), text(row, "player_id"), text(row, "team_id"), "manual");
      });
  }

  private refreshEntityStatsForTournament(
    tournamentId: string,
    playerIds?: Iterable<string>,
    teamIds?: Iterable<string>,
  ): void {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);

    if (target === undefined) {
      return;
    }

    const targetPlayerIds = playerIds === undefined ? this.tournamentPlayerIds(tournamentId) : [...new Set(playerIds)];
    const targetTeamIds = teamIds === undefined ? this.tournamentTeamIds(tournamentId) : [...new Set(teamIds)];

    for (const playerId of targetPlayerIds) {
      const stats = this.calculatePlayerStats(target, playerId);
      const matches = this.getPlayerMatchSummaries(target, playerId);

      this.database
        .prepare(
          `
            INSERT INTO tournament_player_stats (tournament_id, player_id, summary_json, matches_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tournament_id, player_id) DO UPDATE SET
              summary_json = excluded.summary_json,
              matches_json = excluded.matches_json,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          `,
        )
        .run(tournamentId, playerId, JSON.stringify(stats), JSON.stringify(matches));
    }

    for (const teamId of targetTeamIds) {
      const stats = this.calculateTeamStats(tournamentId, teamId);
      const matches = this.getTeamMatchSummaries(target, teamId);

      this.database
        .prepare(
          `
            INSERT INTO tournament_team_stats (tournament_id, team_id, summary_json, matches_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tournament_id, team_id) DO UPDATE SET
              summary_json = excluded.summary_json,
              matches_json = excluded.matches_json,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          `,
        )
        .run(tournamentId, teamId, JSON.stringify(stats), JSON.stringify(matches));
    }
  }

  private tournamentPlayerIds(tournamentId: string): string[] {
    return this.database
      .prepare(
        `
          SELECT player_id
          FROM tournament_players
          WHERE tournament_id = ?
          UNION
          SELECT tm.player_id
          FROM tournament_teams tt
          JOIN team_members tm ON tm.team_id = tt.team_id AND tm.left_at IS NULL
          WHERE tt.tournament_id = ?
        `,
      )
      .all(tournamentId, tournamentId)
      .map((row) => text(row, "player_id"));
  }

  private tournamentTeamIds(tournamentId: string): string[] {
    return this.database
      .prepare("SELECT team_id FROM tournament_teams WHERE tournament_id = ?")
      .all(tournamentId)
      .map((row) => text(row, "team_id"));
  }

  private getPlayerStatsSnapshot(tournamentId: string, playerId: string): PlayerStatsSummary {
    const row = this.database
      .prepare("SELECT summary_json FROM tournament_player_stats WHERE tournament_id = ? AND player_id = ?")
      .get(tournamentId, playerId);

    return row === undefined ? emptyPlayerStats() : parseJson<PlayerStatsSummary>(text(row, "summary_json"), emptyPlayerStats());
  }

  private getPlayerMatchSnapshot(tournamentId: string, playerId: string): ProfileMatchSummary[] {
    const row = this.database
      .prepare("SELECT matches_json FROM tournament_player_stats WHERE tournament_id = ? AND player_id = ?")
      .get(tournamentId, playerId);

    return row === undefined ? [] : parseJson<ProfileMatchSummary[]>(text(row, "matches_json"), []);
  }

  private getTeamStatsSnapshot(tournamentId: string, teamId: string): TeamStatsSummary {
    const row = this.database
      .prepare("SELECT summary_json FROM tournament_team_stats WHERE tournament_id = ? AND team_id = ?")
      .get(tournamentId, teamId);

    return row === undefined ? emptyTeamStats() : parseJson<TeamStatsSummary>(text(row, "summary_json"), emptyTeamStats());
  }

  private getTeamMatchSnapshot(tournamentId: string, teamId: string): ProfileMatchSummary[] {
    const row = this.database
      .prepare("SELECT matches_json FROM tournament_team_stats WHERE tournament_id = ? AND team_id = ?")
      .get(tournamentId, teamId);

    return row === undefined ? [] : parseJson<ProfileMatchSummary[]>(text(row, "matches_json"), []);
  }

  private getTeamIdByOpenDotaTeamId(opendotaTeamId: number): string | null {
    const row = this.database.prepare("SELECT id FROM teams WHERE opendota_team_id = ?").get(opendotaTeamId);

    return row === undefined ? null : text(row, "id");
  }

  private getTeamIdByName(name: string): string | null {
    const row = this.database
      .prepare("SELECT id FROM teams WHERE lower(trim(name)) = lower(trim(?)) OR lower(trim(short_name)) = lower(trim(?)) ORDER BY source ASC LIMIT 1")
      .get(name, name);

    return row === undefined ? null : text(row, "id");
  }

  private getTournamentTeamIdByName(tournamentId: string, name: string): string | null {
    const row = this.database
      .prepare(
        `
          SELECT tm.id
          FROM tournament_teams tt
          JOIN teams tm ON tm.id = tt.team_id
          WHERE tt.tournament_id = ?
            AND (lower(trim(tm.name)) = lower(trim(?)) OR lower(trim(tm.short_name)) = lower(trim(?)))
          ORDER BY tm.source ASC, tt.seed ASC
          LIMIT 1
        `,
      )
      .get(tournamentId, name, name);

    return row === undefined ? null : text(row, "id");
  }

  private fillOpenDotaTeamIdIfMissing(teamId: string, opendotaTeamId: number): void {
    this.database
      .prepare(
        `
          UPDATE teams
          SET
            opendota_team_id = COALESCE(opendota_team_id, ?),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `,
      )
      .run(opendotaTeamId, teamId);
  }

  private getPlayerByAccountId(accountId: number): PlayerBrief | undefined {
    const row = this.database.prepare("SELECT * FROM players WHERE account_id = ?").get(accountId);

    return row === undefined ? undefined : this.playerFromRow(row);
  }

  private getPlayerByAccountIdentity(accountId: number, steamId64: string | null): PlayerBrief | undefined {
    const row =
      steamId64 === null
        ? this.database.prepare("SELECT * FROM players WHERE account_id = ?").get(accountId)
        : this.database.prepare("SELECT * FROM players WHERE account_id = ? OR steam_id64 = ? LIMIT 1").get(accountId, steamId64);

    return row === undefined ? undefined : this.playerFromRow(row);
  }

  private upsertManualPlayerForTeamMember(teamId: string, input: AddTeamMemberInput): string {
    const identity = accountIdentityFromTeamMemberInput(input);
    const existing = this.getPlayerByAccountIdentity(identity.accountId, identity.steamId64);
    const displayName = input.displayName?.trim() || `玩家 ${identity.accountId}`;
    const avatarUrl = input.avatarUrl?.trim() || null;

    if (existing !== undefined) {
      this.database
        .prepare(
          `
            UPDATE players
            SET
              account_id = COALESCE(account_id, ?),
              steam_id64 = COALESCE(steam_id64, ?),
              display_name = CASE WHEN ? IS NOT NULL THEN ? ELSE display_name END,
              avatar_url = CASE WHEN ? IS NOT NULL THEN ? ELSE avatar_url END,
              current_team_id = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `,
        )
        .run(
          identity.accountId,
          identity.steamId64,
          input.displayName?.trim() ? 1 : null,
          displayName,
          avatarUrl === null ? null : 1,
          avatarUrl,
          teamId,
          existing.id,
        );
      return existing.id;
    }

    const playerId = uniqueId("player", `${identity.accountId}-${displayName}`);

    this.database
      .prepare(
        `
          INSERT INTO players (id, account_id, steam_id64, display_name, current_team_id, avatar_url)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(playerId, identity.accountId, identity.steamId64, displayName, teamId, avatarUrl);

    return playerId;
  }

  private getTeamListItemForFirstTournament(teamId: string): TournamentTeamListItem | undefined {
    const team = this.requireTeam(teamId);
    const row = this.database
      .prepare(
        `
          SELECT tt.tournament_id, tt.seed, tt.status
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

    const tournamentId = text(row, "tournament_id");

    return {
      ...team,
      tournamentId,
      seed: nullableNumber(row, "seed"),
      status: text(row, "status"),
      memberCount: this.getTeamMembers(team.id).length,
      members: this.getTeamMembers(team.id),
      stats: this.getTeamStatsSnapshot(tournamentId, team.id),
    };
  }

  private getLeagueSyncTargetByOpenDotaLeagueId(opendotaLeagueId: number): LeagueSyncTarget | undefined {
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
          WHERE l.opendota_league_id = ?
          ORDER BY t.starts_at DESC, t.id ASC
          LIMIT 1
        `,
      )
      .get(opendotaLeagueId);

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

  private matchRowsForLeague(leagueId: number): ParsedOpenDotaMatchRow[] {
    const cachedRows = this.matchRowsCache.get(leagueId);

    if (cachedRows !== undefined) {
      return cachedRows;
    }

    const rows = this.database
      .prepare(
        `
          SELECT match_id, raw_json
          FROM opendota_matches
          WHERE league_id = ?
        `,
      )
      .all(leagueId)
      .map((row) => ({
        matchId: numberValue(row, "match_id"),
        raw: parseJson<OpenDotaMatchDetail | null>(text(row, "raw_json"), null),
      }))
      .filter((row): row is ParsedOpenDotaMatchRow => row.raw !== null)
      .sort((left, right) => (right.raw.start_time ?? 0) - (left.raw.start_time ?? 0));

    this.matchRowsCache.set(leagueId, rows);

    return rows;
  }

  private observedPlayerAccountIds(leagueId: number): number[] {
    const accountIds = new Set<number>();

    for (const match of this.matchRowsForLeague(leagueId)) {
      for (const player of match.raw.players ?? []) {
        if (typeof player.account_id === "number" && player.account_id > 0) {
          accountIds.add(player.account_id);
        }
      }
    }

    return [...accountIds];
  }

  private calculatePlayerStats(target: LeagueSyncTarget, playerId: string): PlayerStatsSummary {
    const matches = this.getPlayerRawMatches(target, playerId);
    const heroMap = new Map<number, HeroPickSummary>();
    let wins = 0;
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let gpm = 0;
    let xpm = 0;
    let netWorth = 0;
    let heroDamage = 0;
    let towerDamage = 0;
    let damageTaken = 0;

    for (const match of matches) {
      const didWin = playerWon(match.raw, sideFromPlayer(match.player));

      if (didWin === true) {
        wins += 1;
      }

      kills += match.player.kills ?? 0;
      deaths += match.player.deaths ?? 0;
      assists += match.player.assists ?? 0;
      gpm += match.player.gold_per_min ?? 0;
      xpm += match.player.xp_per_min ?? 0;
      netWorth += match.player.net_worth ?? 0;
      heroDamage += match.player.hero_damage ?? 0;
      towerDamage += match.player.tower_damage ?? 0;
      damageTaken += damageTakenTotal(match.player.damage_taken);

      if (typeof match.player.hero_id === "number") {
        const current = heroMap.get(match.player.hero_id) ?? { heroId: match.player.hero_id, picks: 0, wins: 0 };
        current.picks += 1;

        if (didWin === true) {
          current.wins += 1;
        }

        heroMap.set(match.player.hero_id, current);
      }
    }

    const totalMatches = matches.length;
    const losses = totalMatches - wins;

    return {
      totalMatches,
      wins,
      losses,
      winRate: totalMatches > 0 ? round1((wins / totalMatches) * 100) : null,
      avgKills: average(kills, totalMatches),
      avgDeaths: average(deaths, totalMatches),
      avgAssists: average(assists, totalMatches),
      kda: totalMatches > 0 ? round2((kills + assists) / Math.max(1, deaths)) : null,
      avgGpm: average(gpm, totalMatches),
      avgXpm: average(xpm, totalMatches),
      avgNetWorth: average(netWorth, totalMatches),
      avgHeroDamage: average(heroDamage, totalMatches),
      avgTowerDamage: average(towerDamage, totalMatches),
      avgDamageTaken: average(damageTaken, totalMatches),
      topHeroes: [...heroMap.values()].sort((left, right) => right.picks - left.picks || right.wins - left.wins).slice(0, 5),
    };
  }

  private getPlayerRawMatches(
    target: LeagueSyncTarget,
    playerId: string,
  ): Array<ParsedOpenDotaMatchRow & { player: OpenDotaMatchPlayer }> {
    const player = this.getPlayerById(playerId);
    const accountId = player?.accountId;

    if (accountId === null || accountId === undefined) {
      return [];
    }

    return this.matchRowsForLeague(target.league.opendotaLeagueId).flatMap((match) => {
      const playerRow = (match.raw.players ?? []).find((candidate) => candidate.account_id === accountId);

      return playerRow === undefined ? [] : [{ ...match, player: playerRow }];
    });
  }

  private getPlayerMatchSummaries(target: LeagueSyncTarget, playerId: string): ProfileMatchSummary[] {
    return this.getPlayerRawMatches(target, playerId)
      .map((match) => this.profileMatchSummary(match.raw, sideFromPlayer(match.player), match.player))
      .slice(0, 40);
  }

  private getTeamMatchSummaries(target: LeagueSyncTarget, teamId: string): ProfileMatchSummary[] {
    return this.matchRowsForLeague(target.league.opendotaLeagueId)
      .flatMap((match) => {
        const side = this.sideForTeamInMatch(match.raw, teamId, target.tournamentId);

        return side === null ? [] : [this.profileMatchSummary(match.raw, side, null)];
      })
      .slice(0, 40);
  }

  private sideForTeamInMatch(rawMatch: OpenDotaMatchDetail, teamId: string, tournamentId: string): TeamSide | null {
    const radiantTeamId = this.resolveObservedTeamId(rawMatch, "radiant", tournamentId);

    if (radiantTeamId === teamId) {
      return "radiant";
    }

    const direTeamId = this.resolveObservedTeamId(rawMatch, "dire", tournamentId);

    return direTeamId === teamId ? "dire" : null;
  }

  private resolveObservedTeamId(rawMatch: OpenDotaMatchDetail, side: TeamSide, tournamentId: string): string | null {
    const opendotaTeamId = side === "radiant" ? rawMatch.radiant_team_id : rawMatch.dire_team_id;

    if (typeof opendotaTeamId === "number" && opendotaTeamId > 0) {
      const teamId = this.getTeamIdByOpenDotaTeamId(opendotaTeamId);

      if (teamId !== null) {
        return teamId;
      }
    }

    const name = usableTeamName(side === "radiant" ? rawMatch.radiant_name : rawMatch.dire_name);

    return name === null ? null : this.getTournamentTeamIdByName(tournamentId, name);
  }

  private profileMatchSummary(
    rawMatch: OpenDotaMatchDetail,
    side: TeamSide | null,
    player: OpenDotaMatchPlayer | null,
  ): ProfileMatchSummary {
    const radiantWin = typeof rawMatch.radiant_win === "boolean" ? rawMatch.radiant_win : null;
    const didWin = side === null ? null : playerWon(rawMatch, side);

    return {
      matchId: rawMatch.match_id,
      startTime: matchStartTime(rawMatch),
      durationText: typeof rawMatch.duration === "number" ? formatDuration(rawMatch.duration) : null,
      radiantTeamName: stringOr(rawMatch.radiant_name, "天辉"),
      direTeamName: stringOr(rawMatch.dire_name, "夜魇"),
      radiantScore: typeof rawMatch.radiant_score === "number" ? rawMatch.radiant_score : null,
      direScore: typeof rawMatch.dire_score === "number" ? rawMatch.dire_score : null,
      radiantWin,
      side,
      heroId: typeof player?.hero_id === "number" ? player.hero_id : null,
      kills: typeof player?.kills === "number" ? player.kills : null,
      deaths: typeof player?.deaths === "number" ? player.deaths : null,
      assists: typeof player?.assists === "number" ? player.assists : null,
      result: didWin === null ? "unknown" : didWin ? "win" : "loss",
    };
  }

  private calculateTeamStats(tournamentId: string, teamId: string): TeamStatsSummary {
    const target = this.getLeagueSyncTargetByTournamentId(tournamentId);
    const heroMap = new Map<number, HeroPickSummary>();
    let gameWins = 0;
    let gameLosses = 0;
    let linkedMatches = 0;

    if (target === undefined) {
      return {
        seriesPlayed: 0,
        seriesWins: 0,
        seriesLosses: 0,
        gameWins: 0,
        gameLosses: 0,
        linkedMatches: 0,
        winRate: null,
        topHeroes: [],
      };
    }

    for (const match of this.matchRowsForLeague(target.league.opendotaLeagueId)) {
      const side = this.sideForTeamInMatch(match.raw, teamId, tournamentId);

      if (side === null) {
        continue;
      }

      const didWin = playerWon(match.raw, side);

      if (didWin === true) {
        gameWins += 1;
      } else if (didWin === false) {
        gameLosses += 1;
      }

      linkedMatches += 1;

      for (const player of match.raw.players ?? []) {
        if (sideFromPlayer(player) !== side || typeof player.hero_id !== "number") {
          continue;
        }

        const current = heroMap.get(player.hero_id) ?? { heroId: player.hero_id, picks: 0, wins: 0 };
        current.picks += 1;

        if (didWin === true) {
          current.wins += 1;
        }

        heroMap.set(player.hero_id, current);
      }
    }

    const seriesPlayed = linkedMatches;
    const seriesWins = gameWins;
    const seriesLosses = gameLosses;

    return {
      seriesPlayed,
      seriesWins,
      seriesLosses,
      gameWins,
      gameLosses,
      linkedMatches,
      winRate: seriesPlayed > 0 ? round1((seriesWins / seriesPlayed) * 100) : null,
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
      heroLineups: summarizeHeroLineups(players),
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

  private nextStageGroupSortOrder(stageId: string): number {
    const row = this.database
      .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM stage_groups WHERE stage_id = ?")
      .get(stageId);

    return numberValue(row ?? {}, "next_sort_order");
  }

  private getStageGroupById(groupId: string): StageGroup | undefined {
    const row = this.database.prepare("SELECT * FROM stage_groups WHERE id = ?").get(groupId);

    return row === undefined ? undefined : this.stageGroupFromRow(row);
  }

  private stageGroupFromRow(row: DbRow): StageGroup {
    const groupId = text(row, "id");

    return {
      id: groupId,
      stageId: text(row, "stage_id"),
      name: text(row, "name"),
      sortOrder: numberValue(row, "sort_order"),
      teams: this.getStageGroupTeams(groupId),
    };
  }

  private getStageGroupTeams(groupId: string): TeamBrief[] {
    return this.database
      .prepare(
        `
          SELECT
            t.id AS team_team_id,
            t.name AS team_team_name,
            t.short_name AS team_team_short_name,
            t.logo_url AS team_team_logo_url,
            t.color AS team_team_color
          FROM stage_group_teams sgt
          JOIN teams t ON t.id = sgt.team_id
          WHERE sgt.group_id = ?
          ORDER BY sgt.seed IS NULL ASC, sgt.seed ASC, t.name ASC
        `,
      )
      .all(groupId)
      .map((teamRow) => teamFromPrefixedRow(teamRow, "team"));
  }

  private listTournamentTeamIds(tournamentId: string): string[] {
    return this.database
      .prepare("SELECT team_id FROM tournament_teams WHERE tournament_id = ? AND status = 'active' ORDER BY seed IS NULL ASC, seed ASC, team_id ASC")
      .all(tournamentId)
      .map((row) => text(row, "team_id"));
  }

  private officialOrTournamentTeamIds(tournamentId: string): string[] {
    const roster = this.listOfficialScheduleTeams(tournamentId).map((item) => item.team.id);

    return roster.length > 0 ? roster : this.listTournamentTeamIds(tournamentId);
  }

  private nextSwissRoundNumber(stageId: string): number {
    const row = this.database
      .prepare(
        `
          SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round_number
          FROM rounds
          WHERE stage_id = ?
        `,
      )
      .get(stageId);

    return numberValue(row ?? {}, "next_round_number");
  }

  private clearSwissRoundAndLater(stageId: string, roundNumber: number): void {
    const rows = this.database
      .prepare("SELECT id FROM rounds WHERE stage_id = ? AND round_number >= ?")
      .all(stageId, roundNumber);
    const roundIds = rows.map((row) => text(row, "id"));

    if (roundIds.length === 0) {
      return;
    }

    const placeholders = roundIds.map(() => "?").join(", ");

    this.database.prepare(`DELETE FROM swiss_byes WHERE round_id IN (${placeholders})`).run(...roundIds);
    this.database.prepare(`DELETE FROM series WHERE round_id IN (${placeholders})`).run(...roundIds);
    this.database.prepare(`DELETE FROM rounds WHERE id IN (${placeholders})`).run(...roundIds);
  }

  private buildSwissPairings(
    stageId: string,
    teamIds: string[],
  ): { pairs: Array<[string, string]>; byeTeamId: string | null; repeatedPairRisk: boolean } {
    const standings = new Map((this.getStageStandings(stageId) ?? []).map((standing) => [standing.team.id, standing]));
    const byeTeamIds = new Set(
      this.database.prepare("SELECT team_id FROM swiss_byes WHERE stage_id = ?").all(stageId).map((row) => text(row, "team_id")),
    );
    const playedPairs = new Set<string>();

    for (const row of this.database
      .prepare("SELECT radiant_team_id, dire_team_id FROM series WHERE stage_id = ?")
      .all(stageId)) {
      playedPairs.add(pairKey(text(row, "radiant_team_id"), text(row, "dire_team_id")));
    }

    const sorted = [...teamIds].sort((left, right) => {
      const leftStanding = standings.get(left);
      const rightStanding = standings.get(right);
      const leftWins = leftStanding?.seriesWins ?? 0;
      const rightWins = rightStanding?.seriesWins ?? 0;

      if (leftWins !== rightWins) {
        return rightWins - leftWins;
      }

      const leftDraws = leftStanding?.seriesDraws ?? 0;
      const rightDraws = rightStanding?.seriesDraws ?? 0;

      if (leftDraws !== rightDraws) {
        return rightDraws - leftDraws;
      }

      const leftLosses = leftStanding?.seriesLosses ?? 0;
      const rightLosses = rightStanding?.seriesLosses ?? 0;

      if (leftLosses !== rightLosses) {
        return leftLosses - rightLosses;
      }

      return left.localeCompare(right);
    });
    let byeTeamId: string | null = null;

    if (sorted.length % 2 === 1) {
      const byeCandidate =
        [...sorted].reverse().find((teamId) => !byeTeamIds.has(teamId)) ?? sorted[sorted.length - 1] ?? null;

      if (byeCandidate !== null) {
        byeTeamId = byeCandidate;
        sorted.splice(sorted.indexOf(byeCandidate), 1);
      }
    }

    const pairs: Array<[string, string]> = [];
    let repeatedPairRisk = false;

    while (sorted.length >= 2) {
      const left = sorted.shift();

      if (left === undefined) {
        break;
      }

      let opponentIndex = sorted.findIndex((right) => !playedPairs.has(pairKey(left, right)));

      if (opponentIndex === -1) {
        opponentIndex = 0;
        repeatedPairRisk = true;
      }

      const right = sorted.splice(opponentIndex, 1)[0];

      if (right !== undefined) {
        pairs.push([left, right]);
      }
    }

    return { pairs, byeTeamId, repeatedPairRisk };
  }

  private ensureStageRound(stageId: string, name: string, roundNumber: number): string {
    const existing = this.database
      .prepare("SELECT id FROM rounds WHERE stage_id = ? AND round_number = ?")
      .get(stageId, roundNumber);

    if (existing !== undefined) {
      return text(existing, "id");
    }

    const id = uniqueId("round", `${stageId}-${roundNumber}-${name}`);

    this.database
      .prepare(
        `
          INSERT INTO rounds (id, stage_id, round_number, name, status, pairing_status)
          VALUES (?, ?, ?, ?, 'draft', 'draft')
        `,
      )
      .run(id, stageId, roundNumber, name);

    return id;
  }

  private resolveSeriesRoundId(stageId: string, roundIdParam: string): string {
    const roundId = requiredString(roundIdParam, "roundId");
    const row = this.database.prepare("SELECT id FROM rounds WHERE id = ? AND stage_id = ?").get(roundId, stageId);

    if (row === undefined) {
      throw new Error("Round does not belong to this stage");
    }

    return roundId;
  }

  private resolveSeriesGroupId(stageId: string, groupIdParam: string | null | undefined): string | null {
    if (groupIdParam === null || groupIdParam === undefined || groupIdParam.trim().length === 0) {
      return null;
    }

    const groupId = groupIdParam.trim();
    const row = this.database.prepare("SELECT stage_id FROM stage_groups WHERE id = ?").get(groupId);

    if (row === undefined) {
      throw new Error("Group not found");
    }

    if (text(row, "stage_id") !== stageId) {
      throw new Error("Group does not belong to this stage");
    }

    return groupId;
  }

  private recalculateStageStandings(stageId: string): void {
    const stage = this.getStageSummaryById(stageId);

    if (stage === undefined) {
      return;
    }

    if (stage.type === "knockout") {
      this.database.prepare("DELETE FROM standings WHERE stage_id = ?").run(stageId);
      return;
    }

    const accumulators = new Map<string, StandingAccumulator>();
    const ensureStanding = (team: TeamBrief, groupName: string | null): StandingAccumulator => {
      const existing = accumulators.get(team.id);

      if (existing !== undefined) {
        if (existing.groupName === null && groupName !== null) {
          existing.groupName = groupName;
        }

        return existing;
      }

      const next: StandingAccumulator = {
        team,
        groupName,
        seriesPlayed: 0,
        seriesWins: 0,
        seriesDraws: 0,
        seriesLosses: 0,
        gameWins: 0,
        gameLosses: 0,
        points: 0,
      };
      accumulators.set(team.id, next);
      return next;
    };

    for (const group of this.listStageGroups(stageId) ?? []) {
      for (const team of group.teams) {
        ensureStanding(team, group.name);
      }
    }

    if (stage.type === "swiss") {
      for (const teamId of this.officialOrTournamentTeamIds(stage.tournamentId)) {
        const team = this.requireTeam(teamId);
        ensureStanding(team, null);
      }
    }

    const rows = this.database
      .prepare(
        `
          SELECT
            s.group_id,
            s.series_kind,
            s.radiant_score,
            s.dire_score,
            sg.name AS group_name,
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
          LEFT JOIN stage_groups sg ON sg.id = s.group_id
          WHERE s.stage_id = ? AND s.status = 'completed' AND s.series_kind = 'regular'
        `,
      )
      .all(stageId);

    for (const row of rows) {
      const groupName = nullableText(row, "group_name");
      const radiantScore = numberValue(row, "radiant_score");
      const direScore = numberValue(row, "dire_score");
      const radiant = ensureStanding(teamFromPrefixedRow(row, "radiant"), groupName);
      const dire = ensureStanding(teamFromPrefixedRow(row, "dire"), groupName);

      radiant.seriesPlayed += 1;
      dire.seriesPlayed += 1;
      radiant.gameWins += radiantScore;
      radiant.gameLosses += direScore;
      dire.gameWins += direScore;
      dire.gameLosses += radiantScore;

      if (radiantScore > direScore) {
        radiant.seriesWins += 1;
        radiant.points += stage.type === "swiss" ? 0 : 3;
        dire.seriesLosses += 1;
      } else if (direScore > radiantScore) {
        dire.seriesWins += 1;
        dire.points += stage.type === "swiss" ? 0 : 3;
        radiant.seriesLosses += 1;
      } else {
        radiant.seriesDraws += 1;
        radiant.points += stage.type === "swiss" ? 0 : 1;
        dire.seriesDraws += 1;
        dire.points += stage.type === "swiss" ? 0 : 1;
      }
    }

    if (stage.type === "swiss") {
      const byeRows = this.database
        .prepare(
          `
            SELECT
              tm.id AS team_team_id,
              tm.name AS team_team_name,
              tm.short_name AS team_team_short_name,
              tm.logo_url AS team_team_logo_url,
              tm.color AS team_team_color
            FROM swiss_byes sb
            JOIN teams tm ON tm.id = sb.team_id
            WHERE sb.stage_id = ?
          `,
        )
        .all(stageId);

      for (const row of byeRows) {
        const standing = ensureStanding(teamFromPrefixedRow(row, "team"), null);
        standing.seriesPlayed += 1;
        standing.seriesWins += 1;
        standing.gameWins += 2;
      }
    }

    const groups = new Map<string, StandingAccumulator[]>();

    for (const standing of accumulators.values()) {
      const groupKey = standing.groupName ?? "__all__";
      const entries = groups.get(groupKey) ?? [];
      entries.push(standing);
      groups.set(groupKey, entries);
    }

    const manualRanks = new Map(
      this.database
        .prepare("SELECT team_id, manual_rank FROM stage_manual_ranks WHERE stage_id = ?")
        .all(stageId)
        .map((row) => [text(row, "team_id"), nullableNumber(row, "manual_rank")] as const),
    );

    this.database.prepare("DELETE FROM standings WHERE stage_id = ?").run(stageId);

    const insertStanding = this.database.prepare(`
      INSERT INTO standings (
        id, stage_id, team_id, rank, group_name, series_played, series_wins, series_draws,
        series_losses, game_wins, game_losses, points, opponent_score, head_to_head_score,
        manual_rank, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);

    for (const entries of groups.values()) {
      entries.sort((left, right) => {
        const leftManualRank = manualRanks.get(left.team.id);
        const rightManualRank = manualRanks.get(right.team.id);

        if (leftManualRank !== null && leftManualRank !== undefined && rightManualRank !== null && rightManualRank !== undefined) {
          return leftManualRank - rightManualRank;
        }

        if (leftManualRank !== null && leftManualRank !== undefined) {
          return -1;
        }

        if (rightManualRank !== null && rightManualRank !== undefined) {
          return 1;
        }

        if (stage.type === "swiss") {
          const winDiff = right.seriesWins - left.seriesWins;

          if (winDiff !== 0) {
            return winDiff;
          }

          const drawDiff = right.seriesDraws - left.seriesDraws;

          if (drawDiff !== 0) {
            return drawDiff;
          }

          const lossDiff = left.seriesLosses - right.seriesLosses;

          if (lossDiff !== 0) {
            return lossDiff;
          }
        }

        const pointDiff = right.points - left.points;

        if (pointDiff !== 0) {
          return pointDiff;
        }

        const gameDiff = right.gameWins - right.gameLosses - (left.gameWins - left.gameLosses);

        if (gameDiff !== 0) {
          return gameDiff;
        }

        const winDiff = right.seriesWins - left.seriesWins;

        if (winDiff !== 0) {
          return winDiff;
        }

        return left.team.name.localeCompare(right.team.name);
      });

      entries.forEach((standing, index) => {
        const rank = index + 1;
        const status: StandingRow["status"] = entries.length > 2 && rank <= 2 ? "advance" : "safe";
        insertStanding.run(
          uniqueId("standing", `${standing.team.id}-${stageId}`),
          stageId,
          standing.team.id,
          rank,
          standing.groupName,
          standing.seriesPlayed,
          standing.seriesWins,
          standing.seriesDraws,
          standing.seriesLosses,
          standing.gameWins,
          standing.gameLosses,
          standing.points,
          manualRanks.get(standing.team.id) ?? null,
          status,
        );
      });
    }
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
            dt.color AS dire_team_color,
            sg.name AS group_name
          FROM series s
          JOIN teams rt ON rt.id = s.radiant_team_id
          JOIN teams dt ON dt.id = s.dire_team_id
          LEFT JOIN stage_groups sg ON sg.id = s.group_id
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
      groupId: nullableText(row, "group_id"),
      groupName: nullableText(row, "group_name"),
      seriesKind: normalizeSeriesKind(text(row, "series_kind") as SeriesSummary["seriesKind"]),
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

type BracketRoundSpec = {
  key: string;
  bracketGroup: BracketNode["bracketGroup"];
  roundNumber: number;
  name: string;
};

type BracketNodeDraft = {
  key: string;
  bracketGroup: BracketNode["bracketGroup"];
  roundNumber: number;
  roundName: string;
  position: number;
  radiantTeamId: string | null;
  direTeamId: string | null;
  nextNodeKey: string | null;
  nextSlot: BracketSlot | null;
  loserNextNodeKey: string | null;
  loserNextSlot: BracketSlot | null;
};

function singleEliminationRoundSpecs(bracketSize: number): BracketRoundSpec[] {
  const roundCount = Math.log2(bracketSize);

  return Array.from({ length: roundCount }, (_, index) => {
    const roundNumber = index + 1;

    return {
      key: bracketRoundKey("single", roundNumber),
      bracketGroup: "single",
      roundNumber,
      name: roundNumber === roundCount ? "决赛" : roundNumber === roundCount - 1 ? "半决赛" : `淘汰赛第 ${roundNumber} 轮`,
    };
  });
}

function doubleEliminationRoundSpecs(bracketSize: number): BracketRoundSpec[] {
  const winnerRoundCount = Math.log2(bracketSize);
  const loserRoundCount = Math.max(1, (winnerRoundCount - 1) * 2);
  const rounds: BracketRoundSpec[] = [];
  let roundNumber = 1;

  for (let index = 1; index <= winnerRoundCount; index += 1) {
    rounds.push({
      key: bracketRoundKey("winner", index),
      bracketGroup: "winner",
      roundNumber,
      name: index === winnerRoundCount ? "胜者组决赛" : `胜者组第 ${index} 轮`,
    });
    roundNumber += 1;
  }

  for (let index = 1; index <= loserRoundCount; index += 1) {
    rounds.push({
      key: bracketRoundKey("loser", index),
      bracketGroup: "loser",
      roundNumber,
      name: index === loserRoundCount ? "败者组决赛" : `败者组第 ${index} 轮`,
    });
    roundNumber += 1;
  }

  rounds.push({
    key: bracketRoundKey("grand_final", 1),
    bracketGroup: "grand_final",
    roundNumber,
    name: "总决赛",
  });

  return rounds;
}

function singleEliminationNodeDrafts(bracketSize: number, teamIds: string[]): BracketNodeDraft[] {
  const seedSlots = seedSlotOrder(bracketSize).map((seed) => teamIds[seed - 1] ?? null);
  const roundCount = Math.log2(bracketSize);
  const specs = singleEliminationRoundSpecs(bracketSize);
  const drafts: BracketNodeDraft[] = [];

  for (let roundIndex = 1; roundIndex <= roundCount; roundIndex += 1) {
    const nodeCount = bracketSize / 2 ** roundIndex;
    const spec = specs[roundIndex - 1];

    if (spec === undefined) {
      continue;
    }

    for (let position = 1; position <= nodeCount; position += 1) {
      const slotIndex = (position - 1) * 2;
      drafts.push({
        key: bracketNodeKey("single", roundIndex, position),
        bracketGroup: "single",
        roundNumber: spec.roundNumber,
        roundName: spec.name,
        position,
        radiantTeamId: roundIndex === 1 ? seedSlots[slotIndex] ?? null : null,
        direTeamId: roundIndex === 1 ? seedSlots[slotIndex + 1] ?? null : null,
        nextNodeKey: roundIndex === roundCount ? null : bracketNodeKey("single", roundIndex + 1, Math.ceil(position / 2)),
        nextSlot: roundIndex === roundCount ? null : position % 2 === 1 ? "radiant" : "dire",
        loserNextNodeKey: null,
        loserNextSlot: null,
      });
    }
  }

  return drafts;
}

function doubleEliminationNodeDrafts(bracketSize: number, winnerTeamIds: string[], loserTeamIds: string[] = []): BracketNodeDraft[] {
  const seedSlots = seedSlotOrder(bracketSize).map((seed) => winnerTeamIds[seed - 1] ?? null);
  const loserOpeningSlots = Array.from({ length: Math.floor(bracketSize / 2) }, (_, index) => loserTeamIds[index] ?? null);
  const winnerRoundCount = Math.log2(bracketSize);
  const loserRoundCount = Math.max(1, (winnerRoundCount - 1) * 2);
  const specs = new Map(doubleEliminationRoundSpecs(bracketSize).map((round) => [round.key, round]));
  const drafts: BracketNodeDraft[] = [];

  for (let roundIndex = 1; roundIndex <= winnerRoundCount; roundIndex += 1) {
    const nodeCount = bracketSize / 2 ** roundIndex;
    const spec = specs.get(bracketRoundKey("winner", roundIndex));

    if (spec === undefined) {
      continue;
    }

    for (let position = 1; position <= nodeCount; position += 1) {
      const slotIndex = (position - 1) * 2;
      const isWinnerFinal = roundIndex === winnerRoundCount;
      const loserRoundIndex = roundIndex === 1 ? 1 : Math.min(loserRoundCount, (roundIndex - 1) * 2);

      drafts.push({
        key: bracketNodeKey("winner", roundIndex, position),
        bracketGroup: "winner",
        roundNumber: spec.roundNumber,
        roundName: spec.name,
        position,
        radiantTeamId: roundIndex === 1 ? seedSlots[slotIndex] ?? null : null,
        direTeamId: roundIndex === 1 ? seedSlots[slotIndex + 1] ?? null : null,
        nextNodeKey: isWinnerFinal
          ? bracketNodeKey("grand_final", 1, 1)
          : bracketNodeKey("winner", roundIndex + 1, Math.ceil(position / 2)),
        nextSlot: isWinnerFinal ? "radiant" : position % 2 === 1 ? "radiant" : "dire",
        loserNextNodeKey:
          roundIndex === 1
            ? bracketNodeKey("loser", 1, Math.ceil(position / 2))
            : bracketNodeKey("loser", loserRoundIndex, position),
        loserNextSlot: roundIndex === 1 ? (position % 2 === 1 ? "radiant" : "dire") : "dire",
      });
    }
  }

  for (let roundIndex = 1; roundIndex <= loserRoundCount; roundIndex += 1) {
    const spec = specs.get(bracketRoundKey("loser", roundIndex));
    const nodeCount = bracketSize / 2 ** (Math.floor((roundIndex + 1) / 2) + 1);

    if (spec === undefined) {
      continue;
    }

    for (let position = 1; position <= nodeCount; position += 1) {
      const isLoserFinal = roundIndex === loserRoundCount;
      drafts.push({
        key: bracketNodeKey("loser", roundIndex, position),
        bracketGroup: "loser",
        roundNumber: spec.roundNumber,
        roundName: spec.name,
        position,
        radiantTeamId: roundIndex === 1 ? loserOpeningSlots[(position - 1) * 2] ?? null : null,
        direTeamId: roundIndex === 1 ? loserOpeningSlots[(position - 1) * 2 + 1] ?? null : null,
        nextNodeKey: isLoserFinal
          ? bracketNodeKey("grand_final", 1, 1)
          : bracketNodeKey(
              "loser",
              roundIndex + 1,
              roundIndex % 2 === 1 ? position : Math.ceil(position / 2),
            ),
        nextSlot: isLoserFinal ? "dire" : roundIndex % 2 === 1 ? "radiant" : position % 2 === 1 ? "radiant" : "dire",
        loserNextNodeKey: null,
        loserNextSlot: null,
      });
    }
  }

  const grandFinal = specs.get(bracketRoundKey("grand_final", 1));

  if (grandFinal !== undefined) {
    drafts.push({
      key: bracketNodeKey("grand_final", 1, 1),
      bracketGroup: "grand_final",
      roundNumber: grandFinal.roundNumber,
      roundName: grandFinal.name,
      position: 1,
      radiantTeamId: null,
      direTeamId: null,
      nextNodeKey: null,
      nextSlot: null,
      loserNextNodeKey: null,
      loserNextSlot: null,
    });
  }

  return drafts;
}

function bracketRoundKey(group: BracketNode["bracketGroup"], roundNumber: number): string {
  return `${group}:${roundNumber}`;
}

function bracketNodeKey(group: BracketNode["bracketGroup"], roundNumber: number, position: number): string {
  return `${group}:${roundNumber}:${position}`;
}

function seedSlotOrder(size: number): number[] {
  if (size === 4) {
    return [1, 4, 2, 3];
  }

  if (size === 8) {
    return [1, 8, 4, 5, 2, 7, 3, 6];
  }

  return [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
}

function normalizeBracketSize(value: number | undefined, teamCount: number): number {
  const requestedSize = value === undefined ? nextPowerOfTwo(teamCount) : value <= 4 ? 4 : value <= 8 ? 8 : 16;
  const requiredSize = nextPowerOfTwo(Math.max(2, teamCount));

  return Math.max(4, Math.min(16, Math.max(requestedSize, requiredSize)));
}

function nextPowerOfTwo(value: number): number {
  let size = 1;

  while (size < value) {
    size *= 2;
  }

  return size;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function normalizeSeriesKind(value: SeriesSummary["seriesKind"] | undefined): SeriesSummary["seriesKind"] {
  return value === "tiebreaker" ? "tiebreaker" : "regular";
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffle<T>(values: T[]): T[] {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const value = next[index];
    next[index] = next[swapIndex] as T;
    next[swapIndex] = value as T;
  }

  return next;
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("::");
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

function requiredNonNegativeInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return value;
}

function accountIdentityFromTeamMemberInput(input: AddTeamMemberInput): { accountId: number; steamId64: string } {
  if (input.accountId !== undefined && input.accountId !== null) {
    const accountId = requiredPositiveInteger(input.accountId, "accountId");
    return {
      accountId,
      steamId64: normalizeSteamId64(input.steamId64 ?? input.steamId, accountId) ?? accountIdToSteamId64(accountId),
    };
  }

  const rawSteamId = input.steamId64 ?? input.steamId;

  if (rawSteamId === undefined || rawSteamId === null || rawSteamId.trim().length === 0) {
    throw new Error("steamId is required when playerId is not provided");
  }

  const normalized = normalizeSteamIdentity(rawSteamId);

  if (normalized.length >= 16) {
    const accountId = steamId64ToAccountId(normalized);

    if (accountId === null) {
      throw new Error("steamId must be a valid SteamID64 or Dota account_id");
    }

    return {
      accountId,
      steamId64: accountIdToSteamId64(accountId),
    };
  }

  const accountId = Number(normalized);

  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error("steamId must be a valid SteamID64 or Dota account_id");
  }

  return {
    accountId,
    steamId64: accountIdToSteamId64(accountId),
  };
}

function normalizeSteamId64(rawSteamId: string | null | undefined, accountId: number | null): string | null {
  if (rawSteamId === undefined || rawSteamId === null || rawSteamId.trim().length === 0) {
    return accountId === null ? null : accountIdToSteamId64(accountId);
  }

  const normalized = normalizeSteamIdentity(rawSteamId);

  if (normalized.length >= 16) {
    const resolvedAccountId = steamId64ToAccountId(normalized);

    if (resolvedAccountId === null || (accountId !== null && resolvedAccountId !== accountId)) {
      throw new Error("steamId must match accountId");
    }

    return accountIdToSteamId64(resolvedAccountId);
  }

  const resolvedAccountId = Number(normalized);

  if (!Number.isSafeInteger(resolvedAccountId) || resolvedAccountId <= 0 || (accountId !== null && resolvedAccountId !== accountId)) {
    throw new Error("steamId must match accountId");
  }

  return accountIdToSteamId64(resolvedAccountId);
}

function steamId64FromAccountId(accountId: number | null): string | null {
  return accountId === null ? null : accountIdToSteamId64(accountId);
}

function normalizeSteamIdentity(rawSteamId: string): string {
  const steam3Match = rawSteamId.trim().match(/^\[U:1:(\d+)]$/i);
  return steam3Match?.[1] ?? rawSteamId.replace(/\D/g, "");
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

function summarizeHeroLineups(players: OpenDotaMatchPlayer[]): Record<TeamSide, OpenDotaMatchListHero[]> {
  const lineups: Record<TeamSide, OpenDotaMatchListHero[]> = {
    radiant: [],
    dire: [],
  };

  for (const player of [...players].sort((left, right) => left.player_slot - right.player_slot)) {
    if (typeof player.hero_id !== "number" || player.hero_id <= 0) {
      continue;
    }

    const side = sideFromPlayer(player);
    if (lineups[side].length >= 5) {
      continue;
    }

    lineups[side].push({
      playerSlot: player.player_slot,
      heroId: player.hero_id,
      playerName: player.personaname?.trim() || player.player_name?.trim() || player.name?.trim() || `玩家 ${player.player_slot}`,
    });
  }

  return lineups;
}

function playerWon(rawMatch: OpenDotaMatchDetail, side: TeamSide): boolean | null {
  if (typeof rawMatch.radiant_win !== "boolean") {
    return null;
  }

  return side === "radiant" ? rawMatch.radiant_win : !rawMatch.radiant_win;
}

function usableTeamName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  const normalized = name.toLowerCase();

  if (name.length === 0 || ["radiant", "dire", "天辉", "夜魇", "unknown", "unknown team"].includes(normalized)) {
    return null;
  }

  return name;
}

function playerAvatarUrl(player: OpenDotaMatchPlayer): string | null {
  const dynamicPlayer = player as OpenDotaMatchPlayer & {
    avatar?: string;
    avatarmedium?: string;
    avatarfull?: string;
  };

  return dynamicPlayer.avatarfull?.trim() || dynamicPlayer.avatarmedium?.trim() || dynamicPlayer.avatar?.trim() || null;
}

function emptyPlayerStats(): PlayerStatsSummary {
  return {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    avgKills: null,
    avgDeaths: null,
    avgAssists: null,
    kda: null,
    avgGpm: null,
    avgXpm: null,
    avgNetWorth: null,
    avgHeroDamage: null,
    avgTowerDamage: null,
    avgDamageTaken: null,
    topHeroes: [],
  };
}

function emptyTeamStats(): TeamStatsSummary {
  return {
    seriesPlayed: 0,
    seriesWins: 0,
    seriesLosses: 0,
    gameWins: 0,
    gameLosses: 0,
    linkedMatches: 0,
    winRate: null,
    topHeroes: [],
  };
}

function damageTakenTotal(value: OpenDotaMatchPlayer["damage_taken"]): number {
  if (typeof value === "number") {
    return value;
  }

  if (value === undefined) {
    return 0;
  }

  return Object.values(value).reduce((sum, current) => sum + current, 0);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(total: number, count: number): number | null {
  return count > 0 ? round1(total / count) : null;
}

function defaultAdvancementRule(type: CreateStageInput["type"]): string {
  const rules: Record<CreateStageInput["type"], string> = {
    group: "小组赛排名按积分、净胜局、胜场、直接交手排序",
    swiss: "瑞士轮按胜平负排序，后端生成下一轮配对草稿",
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
