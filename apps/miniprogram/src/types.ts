export type TeamSide = "radiant" | "dire";
export type StageType = "group" | "swiss" | "knockout";

export type ApiResult<T> = { success: true; data: T } | { success: false; error?: { message?: string; code?: string } };

export type AppUser = {
  id: string;
  openId: string | null;
  nickname: string;
  role: "viewer" | "player" | "admin";
};

export type AuthSession = {
  token: string;
  user: AppUser;
  authProvider: "wechat" | "development";
};

export type TeamBrief = {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string | null;
  color?: string;
};

export type StageSummary = {
  id: string;
  tournamentId: string;
  type: StageType;
  name: string;
  status: string;
  sortOrder?: number;
};

export type SeriesGameSummary = {
  gameIndex: number;
  matchId?: number | null;
};

export type SeriesSummary = {
  id: string;
  stageId?: string;
  roundId?: string;
  groupName?: string | null;
  roundName?: string | null;
  seriesKind?: string;
  boType?: string;
  scheduledAt?: string | null;
  status: string;
  radiantTeam: TeamBrief;
  direTeam: TeamBrief;
  radiantScore?: number | null;
  direScore?: number | null;
  games?: SeriesGameSummary[];
};

export type StageRound = {
  id: string;
  stageId: string;
  roundNumber: number;
  name: string;
  status: string;
  pairingStatus?: string;
  byes?: TeamBrief[];
  series: SeriesSummary[];
};

export type StandingRow = {
  teamId: string;
  team: TeamBrief;
  rank: number;
  points: number;
  seriesWins: number;
  seriesDraws: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  status?: string;
};

export type BracketNode = {
  id: string;
  bracketGroup: string;
  roundName: string;
  roundNumber: number;
  position: number;
  status: string;
  radiantTeam: TeamBrief | null;
  direTeam: TeamBrief | null;
  winnerTeam: TeamBrief | null;
};

export type TournamentOption = {
  id: string;
  name: string;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  league?: { name?: string; opendotaLeagueId?: number };
  season?: { name?: string };
  currentStage?: StageSummary | null;
  teamCount?: number;
  nextSeries?: SeriesSummary | null;
  latestResult?: SeriesSummary | null;
};

export type TournamentDetail = TournamentOption & {
  stages: StageSummary[];
};

export type OfficialScheduleStatus = {
  status: string;
  isPublished: boolean;
  rosterLocked: boolean;
  publishedAt: string | null;
  withdrawnAt: string | null;
};

export type HeroPickSummary = {
  heroId: number;
  picks: number;
  wins: number;
};

export type PlayerStatsSummary = {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kda: number | null;
  avgKills: number | null;
  avgDeaths: number | null;
  avgAssists: number | null;
  avgGpm: number | null;
  avgXpm: number | null;
  avgNetWorth: number | null;
  avgHeroDamage: number | null;
  avgTowerDamage: number | null;
  avgDamageTaken: number | null;
  topHeroes: HeroPickSummary[];
};

export type PlayerListItem = {
  id: string;
  accountId: number | null;
  steamId64?: string | null;
  displayName: string;
  avatarUrl: string | null;
  currentTeam: TeamBrief | null;
  teams: TeamBrief[];
  stats: PlayerStatsSummary;
};

export type TeamListItem = TeamBrief & {
  tournamentId: string;
  seed: number | null;
  status: string;
  memberCount: number;
  members: PlayerListItem[];
  stats: {
    seriesPlayed: number;
    seriesWins: number;
    seriesLosses: number;
    gameWins: number;
    gameLosses: number;
    linkedMatches: number;
    winRate: number | null;
    topHeroes: HeroPickSummary[];
  };
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

export type PlayerTournamentHistoryEntry = {
  tournamentId: string;
  tournamentName: string;
  startsAt: string | null;
  status: string;
  isCurrent: boolean;
  stats: PlayerStatsSummary;
  matches: ProfileMatchSummary[];
};

export type PlayerProfile = PlayerListItem & {
  tournamentId: string;
  matches: ProfileMatchSummary[];
  tournamentHistory: PlayerTournamentHistoryEntry[];
};

export type TeamProfile = TeamListItem & {
  matches: ProfileMatchSummary[];
};

export type PlayerTag = {
  id: string;
  tournamentId: string;
  targetType: "player";
  targetId: string;
  text: string;
  likeCount: number;
  sizeLevel: number;
  status: "pending_review" | "approved" | "rejected" | "hidden";
  createdAt: string;
};

export type MatchRecordHero = {
  playerSlot: number;
  heroId: number;
  playerName: string;
};

export type MatchRecord = {
  matchId: number;
  leagueName: string;
  tournamentId: string;
  tournamentName: string;
  parseStatus: string;
  startTime: string | null;
  durationText: string | null;
  radiantWin: boolean | null;
  radiantScore: number | null;
  direScore: number | null;
  radiantTeamName: string;
  direTeamName: string;
  playerCount: number;
  heroLineups?: Record<TeamSide, MatchRecordHero[]>;
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
};

export type MatchDetail = {
  match: {
    matchId: number;
    leagueName: string;
    tournamentName: string | null;
    stageName: string | null;
    roundName: string | null;
    winnerName: string;
    durationText: string;
    startTime: string | null;
  };
  score: {
    radiantScore: number;
    direScore: number;
    radiantTeamName: string;
    direTeamName: string;
    scoreText: string;
  };
  players: {
    radiant: MatchDetailPlayer[];
    dire: MatchDetailPlayer[];
    all: MatchDetailPlayer[];
  };
  mvp: {
    playerName: string;
    title: string;
    score: number;
  } | null;
  drafts: unknown[];
  vision: { wards: unknown[]; hasVisionData: boolean };
  chat: unknown[];
  dataAvailability: {
    hasAbilityBuilds: boolean;
    hasDraft: boolean;
    hasVision: boolean;
    hasChat: boolean;
    hasTrends: boolean;
  };
  parseStatus: string;
};

export type MatchDetailPlayer = {
  playerSlot: number;
  side: TeamSide;
  name: string;
  heroId: number;
  level: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kdaText: string;
  goldPerMin: number | null;
  xpPerMin: number | null;
  heroDamage: number | null;
  damageTaken: number | null;
};
