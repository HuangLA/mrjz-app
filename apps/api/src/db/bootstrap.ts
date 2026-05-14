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
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
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
