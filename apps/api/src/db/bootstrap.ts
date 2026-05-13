import { unlinkSync } from "node:fs";
import type { StatementSync } from "node:sqlite";
import { openDatabase, databaseFileExists, readMigration, resolveDatabasePath } from "./client.js";
import { openDotaMatches } from "../data/mock/opendotaMatches.js";
import {
  getBracketByStageId,
  getRoundsByStageId,
  getStandingsByStageId,
  teams,
  tournaments,
  type BracketNode,
  type SeriesSummary,
} from "../data/mock/tournaments.js";
import type { OpenDotaMatchDetail, OpenDotaMatchPlayer } from "../opendota/types.js";

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
    seedDevelopmentData();
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

function seedDevelopmentData(): void {
  if (rowCount("tournaments") > 0) {
    return;
  }

  database.exec("BEGIN;");

  try {
    seedCoreTournamentData();
    seedOpenDotaMatches();
    seedPlayersAndTeamMembers();
    seedInteractionData();
    seedSyncTasks();
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

function seedCoreTournamentData(): void {
  const leagueInsert = database.prepare(`
    INSERT INTO leagues (id, name, opendota_league_id)
    VALUES (?, ?, ?)
  `);
  const seasonInsert = database.prepare(`
    INSERT INTO seasons (id, name)
    VALUES (?, ?)
  `);
  const tournamentInsert = database.prepare(`
    INSERT INTO tournaments (
      id, season_id, league_id, current_stage_id, name, slug, status, visibility, starts_at, ends_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const teamInsert = database.prepare(`
    INSERT INTO teams (id, name, short_name, logo_url, color)
    VALUES (?, ?, ?, ?, ?)
  `);
  const tournamentTeamInsert = database.prepare(`
    INSERT INTO tournament_teams (tournament_id, team_id, seed)
    VALUES (?, ?, ?)
  `);
  const stageInsert = database.prepare(`
    INSERT INTO stages (id, tournament_id, type, name, status, sort_order, advancement_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const roundInsert = database.prepare(`
    INSERT INTO rounds (id, stage_id, round_number, name, status, pairing_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const seriesInsert = database.prepare(`
    INSERT INTO series (
      id, round_id, stage_id, bo_type, status, scheduled_at, radiant_team_id, dire_team_id,
      radiant_score, dire_score, winner_team_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const gameInsert = database.prepare(`
    INSERT INTO series_games (
      id, series_id, game_index, match_id, radiant_score, dire_score, parse_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const standingInsert = database.prepare(`
    INSERT INTO standings (
      id, stage_id, team_id, rank, group_name, series_played, series_wins, series_draws,
      series_losses, game_wins, game_losses, points, opponent_score, head_to_head_score,
      manual_rank, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const bracketInsert = database.prepare(`
    INSERT INTO bracket_nodes (
      id, stage_id, round_number, round_name, position, status, series_id, next_node_id,
      next_slot, winner_team_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tournament of tournaments) {
    leagueInsert.run(tournament.league.id, tournament.league.name, tournament.league.opendotaLeagueId);
    seasonInsert.run(tournament.season.id, tournament.season.name);
    tournamentInsert.run(
      tournament.id,
      tournament.season.id,
      tournament.league.id,
      tournament.currentStageId,
      tournament.name,
      tournament.slug,
      tournament.status,
      tournament.visibility,
      tournament.startsAt,
      tournament.endsAt,
    );

    Object.values(teams).forEach((team, index) => {
      teamInsert.run(team.id, team.name, team.shortName, team.logoUrl, team.color);
      tournamentTeamInsert.run(tournament.id, team.id, index + 1);
    });

    for (const stage of tournament.stages) {
      stageInsert.run(
        stage.id,
        stage.tournamentId,
        stage.type,
        stage.name,
        stage.status,
        stage.sortOrder,
        stage.advancementRule,
      );

      for (const round of getRoundsByStageId(stage.id) ?? []) {
        roundInsert.run(round.id, round.stageId, round.roundNumber, round.name, round.status, round.pairingStatus);

        for (const series of round.series) {
          insertSeries(seriesInsert, gameInsert, series);
        }
      }

      for (const standing of getStandingsByStageId(stage.id) ?? []) {
        standingInsert.run(
          standing.id,
          stage.id,
          standing.team.id,
          standing.rank,
          standing.groupName,
          standing.seriesPlayed,
          standing.seriesWins,
          standing.seriesDraws,
          standing.seriesLosses,
          standing.gameWins,
          standing.gameLosses,
          standing.points,
          standing.opponentScore,
          standing.headToHeadScore,
          standing.manualRank,
          standing.status,
        );
      }

      for (const node of getBracketByStageId(stage.id) ?? []) {
        insertBracketNode(bracketInsert, node);
      }
    }
  }
}

function insertSeries(
  seriesInsert: StatementSync,
  gameInsert: StatementSync,
  series: SeriesSummary,
): void {
  seriesInsert.run(
    series.id,
    series.roundId,
    series.stageId,
    series.boType,
    series.status,
    series.scheduledAt,
    series.radiantTeam.id,
    series.direTeam.id,
    series.radiantScore,
    series.direScore,
    series.winnerTeamId,
  );

  for (const game of series.games) {
    gameInsert.run(
      `${series.id}_g${game.gameIndex}`,
      series.id,
      game.gameIndex,
      game.matchId,
      game.radiantScore,
      game.direScore,
      game.matchId === null ? "missing" : "parsed",
    );
  }
}

function insertBracketNode(insert: StatementSync, node: BracketNode): void {
  insert.run(
    node.id,
    node.stageId,
    node.roundNumber,
    node.roundName,
    node.position,
    node.status,
    node.series?.id ?? null,
    node.nextNodeId,
    node.nextSlot,
    node.winnerTeamId,
  );
}

function seedOpenDotaMatches(): void {
  const insert = database.prepare(`
    INSERT INTO opendota_matches (match_id, league_id, raw_json, parse_status, requested_at, parsed_at)
    VALUES (?, ?, ?, 'parsed', ?, ?)
  `);
  const now = new Date().toISOString();

  for (const match of Object.values(openDotaMatches)) {
    insert.run(match.match_id, match.leagueid ?? match.league_id ?? null, JSON.stringify(match), now, now);
  }
}

function seedPlayersAndTeamMembers(): void {
  const playerInsert = database.prepare(`
    INSERT OR IGNORE INTO players (id, account_id, display_name, current_team_id)
    VALUES (?, ?, ?, ?)
  `);
  const memberInsert = database.prepare(`
    INSERT OR IGNORE INTO team_members (team_id, player_id, role)
    VALUES (?, ?, 'player')
  `);

  for (const match of Object.values(openDotaMatches)) {
    const sideTeams = findSeriesTeamsByMatchId(match.match_id);

    for (const player of match.players) {
      const accountId = player.account_id;

      if (typeof accountId !== "number") {
        continue;
      }

      const teamId = player.player_slot < 128 ? sideTeams?.radiantTeamId : sideTeams?.direTeamId;
      const playerId = `player_${accountId}`;
      playerInsert.run(playerId, accountId, playerName(player), teamId ?? null);

      if (teamId !== undefined) {
        memberInsert.run(teamId, playerId);
      }
    }
  }
}

function seedInteractionData(): void {
  const userInsert = database.prepare(`
    INSERT INTO app_users (id, open_id, nickname, role)
    VALUES (?, ?, ?, ?)
  `);
  const tagInsert = database.prepare(`
    INSERT INTO tags (id, target_type, target_id, label, created_by, status, hidden_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const likeInsert = database.prepare(`
    INSERT INTO tag_likes (tag_id, user_id)
    VALUES (?, ?)
  `);
  const reportInsert = database.prepare(`
    INSERT INTO tag_reports (id, tag_id, reporter_user_id, reason, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  userInsert.run("user_admin", "seed_admin", "赛事管理员", "admin");
  userInsert.run("user_viewer_1", "seed_viewer_1", "控盾观众", "viewer");
  userInsert.run("user_viewer_2", "seed_viewer_2", "夜魇观众", "viewer");

  tagInsert.run("tag_player_mid_1", "player", "player_101002", "稳定控盾", "user_viewer_1", "active", null);
  tagInsert.run("tag_team_meteor_1", "team", "team_meteor", "团战纪律好", "user_viewer_2", "active", null);
  tagInsert.run("tag_team_glyph_1", "team", "team_glyph", "暂停战术", "user_viewer_1", "active", null);

  likeInsert.run("tag_player_mid_1", "user_viewer_1");
  likeInsert.run("tag_player_mid_1", "user_viewer_2");
  likeInsert.run("tag_team_meteor_1", "user_viewer_2");
  reportInsert.run("report_tag_glyph_1", "tag_team_glyph_1", "user_viewer_2", "可能是嘲讽标签", "open");
}

function seedSyncTasks(): void {
  const insert = database.prepare(`
    INSERT INTO sync_tasks (
      id, kind, status, league_id, target_type, target_id, payload_json, attempts, last_error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    "sync_seed_discover_1",
    "discover_match",
    "succeeded",
    188888,
    "league",
    "188888",
    JSON.stringify({ intervalMinutes: 10 }),
    1,
    null,
  );
  insert.run(
    "sync_seed_parse_1",
    "request_parse",
    "needs_review",
    188888,
    "match",
    "9000000002",
    JSON.stringify({ reason: "result_pending" }),
    2,
    "OpenDota parse pending timeout",
  );
}

function findSeriesTeamsByMatchId(matchId: number): { radiantTeamId: string; direTeamId: string } | undefined {
  for (const tournament of tournaments) {
    for (const stage of tournament.stages) {
      for (const round of getRoundsByStageId(stage.id) ?? []) {
        for (const series of round.series) {
          if (series.games.some((game) => game.matchId === matchId)) {
            return {
              radiantTeamId: series.radiantTeam.id,
              direTeamId: series.direTeam.id,
            };
          }
        }
      }
    }
  }

  return undefined;
}

function playerName(player: OpenDotaMatchPlayer): string {
  return player.personaname ?? player.player_name ?? player.name ?? `Dota 玩家 ${player.account_id ?? "unknown"}`;
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
