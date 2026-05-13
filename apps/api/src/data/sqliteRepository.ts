import { openDatabase, parseJson, resolveDatabasePath } from "../db/client.js";
import { normalizeOpenDotaMatchDetail } from "../opendota/normalizers/matchDetail.js";
import type { OpenDotaMatchDetail } from "../opendota/types.js";
import type {
  BracketNode,
  SeriesSummary,
  StageRound,
  StageSummary,
  StandingRow,
  TournamentDetail,
  TournamentListItem,
} from "./mock/tournaments.js";
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

export class SqliteTournamentRepository {
  readonly info: RepositoryInfo = {
    dataSource: "sqlite",
    databasePath: resolveDatabasePath(),
  };

  private readonly database = openDatabase({ readOnly: true });

  dispose(): void {
    this.database.close();
  }

  listTournaments(): TournamentListItem[] {
    return this.tournamentRows().map((row) => this.mapTournamentSummary(row));
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
