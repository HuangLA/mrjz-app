import type {
  LeagueBrief,
  MatchDetailContext,
  RoundBrief,
  SeriesContext,
  StageBrief,
  TeamBrief,
  TeamSide,
  TournamentBrief,
} from "../../view-models/matchDetail.js";

export type TournamentListItem = TournamentBrief & {
  season: {
    id: string;
    name: string;
  };
  league: LeagueBrief;
  currentStage: StageBrief;
  startsAt: string;
  endsAt: string | null;
  teamCount: number;
};

export type TournamentDetail = TournamentListItem & {
  visibility: "public" | "private";
  currentStageId: string;
  stages: StageSummary[];
  nextSeries: SeriesSummary | null;
  latestResult: SeriesSummary | null;
};

export type StageSummary = StageBrief & {
  sortOrder: number;
  advancementRule: string;
  activeRound: RoundBrief | null;
};

export type StandingRow = {
  id: string;
  rank: number;
  team: TeamBrief;
  groupName: string | null;
  seriesPlayed: number;
  seriesWins: number;
  seriesDraws: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  points: number;
  opponentScore: number;
  headToHeadScore: number;
  manualRank: number | null;
  status: "advance" | "safe" | "eliminated";
};

export type SeriesSummary = {
  id: string;
  roundId: string;
  stageId: string;
  boType: SeriesContext["boType"];
  status: string;
  scheduledAt: string;
  radiantTeam: TeamBrief;
  direTeam: TeamBrief;
  radiantScore: number;
  direScore: number;
  winnerTeamId: string | null;
  games: Array<{
    gameIndex: number;
    matchId: number | null;
    radiantScore: number | null;
    direScore: number | null;
  }>;
};

export type StageRound = RoundBrief & {
  pairingStatus: "draft" | "published" | "confirmed";
  series: SeriesSummary[];
};

export type BracketNode = {
  id: string;
  stageId: string;
  roundNumber: number;
  roundName: string;
  position: number;
  status: "pending" | "scheduled" | "completed";
  series: SeriesSummary | null;
  nextNodeId: string | null;
  nextSlot: "radiant" | "dire" | null;
  winnerTeamId: string | null;
};

const league: LeagueBrief = {
  id: "league_mrjz",
  name: "MRJZ 每日节奏联赛",
  opendotaLeagueId: 188888,
};

const season = {
  id: "season_2026_summer",
  name: "2026 夏季赛",
};

export const teams = {
  meteor: {
    id: "team_meteor",
    name: "流星锤研究会",
    shortName: "MET",
    logoUrl: null,
    color: "#22c55e",
  },
  glyph: {
    id: "team_glyph",
    name: "高地雕文",
    shortName: "GLY",
    logoUrl: null,
    color: "#ef4444",
  },
  smoke: {
    id: "team_smoke",
    name: "诡计之雾",
    shortName: "SMK",
    logoUrl: null,
    color: "#60a5fa",
  },
  aegis: {
    id: "team_aegis",
    name: "不朽盾快递",
    shortName: "AEG",
    logoUrl: null,
    color: "#f59e0b",
  },
} satisfies Record<string, TeamBrief>;

const tournamentBrief: TournamentBrief = {
  id: "tournament_mrjz_s8",
  name: "每日节奏 S8 社区赛",
  slug: "mrjz-s8",
  status: "running",
};

const stages: StageSummary[] = [
  {
    id: "stage_s8_swiss",
    tournamentId: tournamentBrief.id,
    type: "swiss",
    name: "瑞士轮",
    status: "running",
    sortOrder: 1,
    advancementRule: "5 轮瑞士轮，前 4 晋级淘汰赛",
    activeRound: {
      id: "round_s8_swiss_3",
      stageId: "stage_s8_swiss",
      roundNumber: 3,
      name: "瑞士轮 第 3 轮",
      status: "published",
    },
  },
  {
    id: "stage_s8_knockout",
    tournamentId: tournamentBrief.id,
    type: "knockout",
    name: "淘汰赛",
    status: "draft",
    sortOrder: 2,
    advancementRule: "4 队单败淘汰，决赛 BO3",
    activeRound: null,
  },
];

const seriesById = {
  series_swiss_r2_meteor_glyph: {
    id: "series_swiss_r2_meteor_glyph",
    roundId: "round_s8_swiss_2",
    stageId: "stage_s8_swiss",
    boType: "BO1",
    status: "completed",
    scheduledAt: "2026-05-10T12:00:00.000Z",
    radiantTeam: teams.meteor,
    direTeam: teams.glyph,
    radiantScore: 1,
    direScore: 0,
    winnerTeamId: teams.meteor.id,
    games: [
      {
        gameIndex: 1,
        matchId: 9000000001,
        radiantScore: 42,
        direScore: 35,
      },
    ],
  },
  series_swiss_r3_smoke_aegis: {
    id: "series_swiss_r3_smoke_aegis",
    roundId: "round_s8_swiss_3",
    stageId: "stage_s8_swiss",
    boType: "BO1",
    status: "scheduled",
    scheduledAt: "2026-05-14T12:00:00.000Z",
    radiantTeam: teams.smoke,
    direTeam: teams.aegis,
    radiantScore: 0,
    direScore: 0,
    winnerTeamId: null,
    games: [
      {
        gameIndex: 1,
        matchId: null,
        radiantScore: null,
        direScore: null,
      },
    ],
  },
  series_swiss_r3_meteor_aegis: {
    id: "series_swiss_r3_meteor_aegis",
    roundId: "round_s8_swiss_3",
    stageId: "stage_s8_swiss",
    boType: "BO1",
    status: "result_pending",
    scheduledAt: "2026-05-13T12:00:00.000Z",
    radiantTeam: teams.meteor,
    direTeam: teams.aegis,
    radiantScore: 0,
    direScore: 0,
    winnerTeamId: null,
    games: [
      {
        gameIndex: 1,
        matchId: 9000000002,
        radiantScore: 21,
        direScore: 18,
      },
    ],
  },
  series_knockout_sf1: {
    id: "series_knockout_sf1",
    roundId: "round_s8_knockout_sf",
    stageId: "stage_s8_knockout",
    boType: "BO3",
    status: "draft",
    scheduledAt: "2026-05-20T12:00:00.000Z",
    radiantTeam: teams.meteor,
    direTeam: teams.smoke,
    radiantScore: 0,
    direScore: 0,
    winnerTeamId: null,
    games: [],
  },
} satisfies Record<string, SeriesSummary>;

const roundsByStageId: Record<string, StageRound[]> = {
  stage_s8_swiss: [
    {
      id: "round_s8_swiss_2",
      stageId: "stage_s8_swiss",
      roundNumber: 2,
      name: "瑞士轮 第 2 轮",
      status: "completed",
      pairingStatus: "confirmed",
      series: [seriesById.series_swiss_r2_meteor_glyph],
    },
    {
      id: "round_s8_swiss_3",
      stageId: "stage_s8_swiss",
      roundNumber: 3,
      name: "瑞士轮 第 3 轮",
      status: "published",
      pairingStatus: "published",
      series: [seriesById.series_swiss_r3_meteor_aegis, seriesById.series_swiss_r3_smoke_aegis],
    },
  ],
  stage_s8_knockout: [
    {
      id: "round_s8_knockout_sf",
      stageId: "stage_s8_knockout",
      roundNumber: 1,
      name: "半决赛",
      status: "draft",
      pairingStatus: "draft",
      series: [seriesById.series_knockout_sf1],
    },
  ],
};

const standingsByStageId: Record<string, StandingRow[]> = {
  stage_s8_swiss: [
    standing("standing_meteor", 1, teams.meteor, 3, 3, 0, 0, 3, 0, 9, 5.5, "advance"),
    standing("standing_smoke", 2, teams.smoke, 3, 2, 0, 1, 2, 1, 6, 4, "advance"),
    standing("standing_aegis", 3, teams.aegis, 3, 1, 0, 2, 1, 2, 3, 4.5, "safe"),
    standing("standing_glyph", 4, teams.glyph, 3, 0, 0, 3, 0, 3, 0, 6, "eliminated"),
  ],
};

const bracketsByStageId: Record<string, BracketNode[]> = {
  stage_s8_knockout: [
    {
      id: "bracket_sf_1",
      stageId: "stage_s8_knockout",
      roundNumber: 1,
      roundName: "半决赛",
      position: 1,
      status: "scheduled",
      series: seriesById.series_knockout_sf1,
      nextNodeId: "bracket_final",
      nextSlot: "radiant",
      winnerTeamId: null,
    },
    {
      id: "bracket_final",
      stageId: "stage_s8_knockout",
      roundNumber: 2,
      roundName: "决赛",
      position: 1,
      status: "pending",
      series: null,
      nextNodeId: null,
      nextSlot: null,
      winnerTeamId: null,
    },
  ],
};

const tournament: TournamentDetail = {
  ...tournamentBrief,
  season,
  league,
  currentStage: stages[0]!,
  startsAt: "2026-05-01T12:00:00.000Z",
  endsAt: null,
  teamCount: Object.keys(teams).length,
  visibility: "public",
  currentStageId: "stage_s8_swiss",
  stages,
  nextSeries: seriesById.series_swiss_r3_smoke_aegis,
  latestResult: seriesById.series_swiss_r2_meteor_glyph,
};

export const tournaments = [tournament];

export function listTournamentSummaries(): TournamentListItem[] {
  return tournaments.map(({ stages: _stages, nextSeries: _nextSeries, latestResult: _latestResult, ...summary }) => summary);
}

export function getTournamentById(id: string): TournamentDetail | undefined {
  return tournaments.find((item) => item.id === id || item.slug === id);
}

export function getStandingsByStageId(stageId: string): StandingRow[] | undefined {
  return standingsByStageId[stageId];
}

export function getRoundsByStageId(stageId: string): StageRound[] | undefined {
  return roundsByStageId[stageId];
}

export function getBracketByStageId(stageId: string): BracketNode[] | undefined {
  return bracketsByStageId[stageId];
}

export function getMatchContextByMatchId(matchId: number): MatchDetailContext | undefined {
  for (const round of Object.values(roundsByStageId).flat()) {
    for (const series of round.series) {
      const game = series.games.find((item) => item.matchId === matchId);

      if (game === undefined) {
        continue;
      }

      const stage = stages.find((item) => item.id === series.stageId);

      if (stage === undefined) {
        continue;
      }

      const sideTeams: Record<TeamSide, TeamBrief> = {
        radiant: series.radiantTeam,
        dire: series.direTeam,
      };

      return {
        league,
        tournament: tournamentBrief,
        stage,
        round,
        series: {
          id: series.id,
          boType: series.boType,
          status: series.status,
          scheduledAt: series.scheduledAt,
          gameIndex: game.gameIndex,
        },
        teams: sideTeams,
      };
    }
  }

  return undefined;
}

function standing(
  id: string,
  rank: number,
  team: TeamBrief,
  seriesPlayed: number,
  seriesWins: number,
  seriesDraws: number,
  seriesLosses: number,
  gameWins: number,
  gameLosses: number,
  points: number,
  opponentScore: number,
  status: StandingRow["status"],
): StandingRow {
  return {
    id,
    rank,
    team,
    groupName: null,
    seriesPlayed,
    seriesWins,
    seriesDraws,
    seriesLosses,
    gameWins,
    gameLosses,
    points,
    opponentScore,
    headToHeadScore: 0,
    manualRank: null,
    status,
  };
}
