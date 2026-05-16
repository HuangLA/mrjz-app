import type {
  LeagueBrief,
  RoundBrief,
  SeriesContext,
  StageBrief,
  TeamBrief,
  TournamentBrief,
} from "./matchDetail.js";

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
  bracketGroup: "single" | "winner" | "loser" | "grand_final";
  roundNumber: number;
  roundName: string;
  position: number;
  status: "pending" | "scheduled" | "completed";
  radiantTeam: TeamBrief | null;
  direTeam: TeamBrief | null;
  series: SeriesSummary | null;
  nextNodeId: string | null;
  nextSlot: "radiant" | "dire" | null;
  loserNextNodeId: string | null;
  loserNextSlot: "radiant" | "dire" | null;
  winnerTeamId: string | null;
};
