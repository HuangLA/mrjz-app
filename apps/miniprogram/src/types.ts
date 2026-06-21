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
  expiresAt: string;
  user: AppUser;
  authProvider: "wechat";
};

export type DotaAccountBinding = {
  id: string;
  userId: string;
  playerId: string;
  accountId: number;
  steamId64: string;
  bindingStatus: "active" | "revoked";
  verificationStatus: "unverified" | "pending_review" | "verified" | "rejected";
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppUserMe = AppUser & {
  bindings: DotaAccountBinding[];
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
  config?: Record<string, unknown>;
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
  groupName?: string | null;
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
  nextNodeId?: string | null;
  nextSlot?: "radiant" | "dire" | null;
  loserNextNodeId?: string | null;
  loserNextSlot?: "radiant" | "dire" | null;
  winnerTeamId?: string | null;
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
  matchCount?: number;
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

export type HeroLeaderboardCandidate = {
  rank: number;
  player: PlayerListItem;
  teams: TeamBrief[];
  matches: number;
  average: number;
  total: number;
};

export type HeroLeaderboardItem = {
  key: string;
  title: string;
  description: string;
  metricLabel: string;
  unit: string;
  precision: number;
  minMatches: number;
  winner: HeroLeaderboardCandidate | null;
  candidates: HeroLeaderboardCandidate[];
};

export type HeroLeaderboardsView = {
  tournamentId: string;
  tournamentName: string;
  basis: "per_match";
  minMatches: number;
  leaderboards: HeroLeaderboardItem[];
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
  playerCount?: number;
  heroLineups?: Record<TeamSide, MatchRecordHero[]>;
  hasDraft?: boolean;
  hasVision?: boolean;
  hasChat?: boolean;
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

export type AppUserStats = {
  user: AppUser;
  binding: DotaAccountBinding | null;
  player: PlayerListItem | null;
  stats: PlayerStatsSummary;
  matches: ProfileMatchSummary[];
  tournamentHistory: PlayerTournamentHistoryEntry[];
  emptyReason: "not_bound" | "no_matches" | null;
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

export type AghanimState = "owned" | "queued" | "none";

export type IconRef = {
  label: string;
  imageUrl: string;
  kind?: "ability" | "talent" | "attribute" | "empty";
  key?: string;
  level?: number;
};

export type TalentTreeNode = {
  tier: 1 | 2 | 3 | 4;
  side: "left" | "right";
  picked: boolean;
  label: string;
  level?: number;
};

export type MatchRecordHero = {
  playerSlot: number;
  heroId: number;
  hero: string;
  icon: string;
  portrait: string;
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

export type DraftStep = {
  order: number;
  side: TeamSide;
  type: "Ban" | "Pick";
  hero: string;
  portrait: string;
  actor: string;
};

export type WardEvent = {
  time: string;
  timeSeconds: number;
  side: TeamSide;
  type: "观察守卫" | "岗哨守卫" | "反眼";
  lane: string;
  note: string;
  x: number | null;
  y: number | null;
  removedAt: number | null;
};

export type ChatLine = {
  time: string;
  side: TeamSide;
  player: string;
  hero: string;
  text: string;
};

export type TrendPoint = {
  minute: number;
  value: number;
};

export type PlayerTrend = {
  playerSlot: number;
  playerName: string;
  side: TeamSide;
  heroId: number;
  values: number[];
};

export type TrendCharts = {
  hasTrends: boolean;
  goldAdvantage: TrendPoint[];
  xpAdvantage: TrendPoint[];
  playerGold: PlayerTrend[];
  playerXp: PlayerTrend[];
};

export type ComparisonMetric = {
  key: string;
  label: string;
  radiantValue: number;
  direValue: number;
  radiantShare: number;
};

export type MatchAward = {
  code: string;
  title: string;
  description: string;
  playerSlot: number;
  playerName: string;
  side: TeamSide;
  heroId: number;
  hero: string;
  portrait: string;
  valueText: string;
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
    gameMode: number | null;
    startTime: string | null;
    endedAt: string | null;
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
  drafts: DraftStep[];
  vision: { wards: WardEvent[]; hasVisionData: boolean };
  charts: TrendCharts;
  comparisons: ComparisonMetric[];
  awards: MatchAward[];
  chat: ChatLine[];
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
  accountId: number | null;
  playerSlot: number;
  side: TeamSide;
  name: string;
  heroId: number;
  hero: string;
  portrait: string;
  lane: string;
  level: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kdaText: string;
  killParticipation: number | null;
  heroDamageShare: number | null;
  goldPerMin: number | null;
  xpPerMin: number | null;
  netWorth: number | null;
  lastHits: number | null;
  denies: number | null;
  heroDamage: number | null;
  towerDamage: number | null;
  heroHealing: number | null;
  damageTaken: number | null;
  items: IconRef[];
  backpackItems: IconRef[];
  neutralItem: IconRef;
  scepter: AghanimState;
  shard: AghanimState;
  abilityOrder: IconRef[];
  talentTree: TalentTreeNode[];
};
