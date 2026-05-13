export type TournamentStageType = "group" | "swiss" | "knockout";

export type TournamentStatus = "draft" | "published" | "running" | "completed" | "archived";

export type StageStatus = "draft" | "published" | "running" | "locked" | "completed";

export type SeriesStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "result_pending"
  | "completed"
  | "conflict"
  | "postponed"
  | "cancelled";

export type TournamentSummary = {
  id: string;
  seasonId: string;
  leagueId: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  currentStageId?: string;
};

export type TournamentStageSummary = {
  id: string;
  tournamentId: string;
  type: TournamentStageType;
  name: string;
  sortOrder: number;
  status: StageStatus;
};

export type StandingRow = {
  stageId: string;
  groupId?: string;
  teamId: string;
  rank: number;
  points: number;
  seriesWins: number;
  seriesDraws: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
};
