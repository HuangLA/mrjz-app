import "../env.js";
import { unlinkSync } from "node:fs";
import { openDatabase, databaseFileExists, readMigration, resolveDatabasePath } from "./client.js";

type TournamentSeed = {
  leagueId: string;
  leagueName: string;
  opendotaLeagueId: number;
  seasonId: string;
  seasonName: string;
  tournamentId: string;
  tournamentName: string;
  slug: string;
  status: "completed" | "running";
  visibility: "public";
  startsAt: string;
  endsAt: string | null;
  stageId: string;
  stageName: string;
  stageStatus: "completed" | "running";
};

const realTournamentSeeds: TournamentSeed[] = [
  {
    leagueId: "league_mrjz_s1",
    leagueName: "每日节奏第一届",
    opendotaLeagueId: 17485,
    seasonId: "season_mrjz_s1",
    seasonName: "每日节奏第一届",
    tournamentId: "tournament_mrjz_s1",
    tournamentName: "每日节奏第一届社区赛",
    slug: "mrjz-s1",
    status: "completed",
    visibility: "public",
    startsAt: "2025-06-09T00:00:00.000Z",
    endsAt: "2025-06-18T23:59:59.000Z",
    stageId: "stage_mrjz_s1_records",
    stageName: "真实比赛记录",
    stageStatus: "completed",
  },
  {
    leagueId: "league_mrjz_s2",
    leagueName: "每日节奏第二届",
    opendotaLeagueId: 18365,
    seasonId: "season_mrjz_s2",
    seasonName: "每日节奏第二届",
    tournamentId: "tournament_mrjz_s2",
    tournamentName: "每日节奏第二届社区赛",
    slug: "mrjz-s2",
    status: "completed",
    visibility: "public",
    startsAt: "2026-01-14T00:00:00.000Z",
    endsAt: "2026-02-02T23:59:59.000Z",
    stageId: "stage_mrjz_s2_records",
    stageName: "真实比赛记录",
    stageStatus: "completed",
  },
  {
    leagueId: "league_mrjz_s3",
    leagueName: "每日节奏第三届",
    opendotaLeagueId: 19483,
    seasonId: "season_mrjz_s3",
    seasonName: "每日节奏第三届",
    tournamentId: "tournament_mrjz_s3",
    tournamentName: "每日节奏第三届社区赛",
    slug: "mrjz-s3",
    status: "running",
    visibility: "public",
    startsAt: "2026-03-27T00:00:00.000Z",
    endsAt: null,
    stageId: "stage_mrjz_s3_records",
    stageName: "真实比赛记录",
    stageStatus: "running",
  },
];

const args = new Set(process.argv.slice(2));

if (args.has("--reset") && databaseFileExists()) {
  unlinkSync(resolveDatabasePath());
}

const database = openDatabase({ create: true });

try {
  applyMigrations();

  if (args.has("--status")) {
    printStatus();
  } else {
    seedRealTournamentShells();
    printStatus();
  }
} finally {
  database.close();
}

function applyMigrations(): void {
  database.exec("BEGIN;");

  try {
    database.exec(readMigration("0001_initial"));
    applySchemaPatches();
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

function applySchemaPatches(): void {
  ensureColumn("teams", "opendota_team_id", "INTEGER");
  ensureColumn("teams", "source", "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn("players", "steam_id64", "TEXT");
  ensureColumn("bracket_nodes", "bracket_group", "TEXT NOT NULL DEFAULT 'single'");
  ensureColumn("bracket_nodes", "radiant_team_id", "TEXT");
  ensureColumn("bracket_nodes", "dire_team_id", "TEXT");
  ensureColumn("bracket_nodes", "loser_next_node_id", "TEXT");
  ensureColumn("bracket_nodes", "loser_next_slot", "TEXT");
  ensureColumn("series", "group_id", "TEXT");
  ensureColumn("series", "series_kind", "TEXT NOT NULL DEFAULT 'regular'");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_opendota_team_id ON teams(opendota_team_id);");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_players_steam_id64 ON players(steam_id64);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_series_group ON series(group_id);");
  ensureEntityTables();
}

function ensureColumn(tableName: string, columnName: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function ensureEntityTables(): void {
  database.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_tournament_players_team ON tournament_players(tournament_id, current_team_id);
    CREATE INDEX IF NOT EXISTS idx_stage_groups_stage ON stage_groups(stage_id);
    CREATE INDEX IF NOT EXISTS idx_stage_group_teams_team ON stage_group_teams(team_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_schedule_teams_team ON tournament_schedule_teams(team_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_operation_logs_tournament ON schedule_operation_logs(tournament_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stage_manual_ranks_stage ON stage_manual_ranks(stage_id);
  `);
}

function seedRealTournamentShells(): void {
  if (rowCount("tournaments") > 0) {
    return;
  }

  const leagueInsert = database.prepare(`
    INSERT INTO leagues (id, name, opendota_league_id)
    VALUES (?, ?, ?)
  `);
  const seasonInsert = database.prepare(`
    INSERT INTO seasons (id, name, starts_at, ends_at)
    VALUES (?, ?, ?, ?)
  `);
  const tournamentInsert = database.prepare(`
    INSERT INTO tournaments (
      id, season_id, league_id, current_stage_id, name, slug, status, visibility, starts_at, ends_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stageInsert = database.prepare(`
    INSERT INTO stages (id, tournament_id, type, name, status, sort_order, advancement_rule)
    VALUES (?, ?, 'group', ?, ?, 1, ?)
  `);

  database.exec("BEGIN;");

  try {
    for (const seed of realTournamentSeeds) {
      leagueInsert.run(seed.leagueId, seed.leagueName, seed.opendotaLeagueId);
      seasonInsert.run(seed.seasonId, seed.seasonName, seed.startsAt, seed.endsAt);
      tournamentInsert.run(
        seed.tournamentId,
        seed.seasonId,
        seed.leagueId,
        seed.stageId,
        seed.tournamentName,
        seed.slug,
        seed.status,
        seed.visibility,
        seed.startsAt,
        seed.endsAt,
      );
      stageInsert.run(
        seed.stageId,
        seed.tournamentId,
        seed.stageName,
        seed.stageStatus,
        "该阶段只表示已同步的真实 OpenDota 比赛记录；赛程、队伍、积分榜由管理员录入。",
      );
    }

    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

function rowCount(tableName: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
  const count = row?.count;

  return typeof count === "number" ? count : 0;
}

function printStatus(): void {
  const status = {
    databasePath: resolveDatabasePath(),
    migrations: rowCount("schema_migrations"),
    tournaments: rowCount("tournaments"),
    teams: rowCount("teams"),
    players: rowCount("players"),
    series: rowCount("series"),
    opendotaMatches: rowCount("opendota_matches"),
    tags: rowCount("tags"),
    syncTasks: rowCount("sync_tasks"),
  };

  console.log(JSON.stringify(status, null, 2));
}
