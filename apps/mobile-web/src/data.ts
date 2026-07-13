export type AppRoute =
  | "home"
  | "stage"
  | "schedule"
  | "records"
  | "match"
  | "leaderboard"
  | "players"
  | "teams"
  | "player"
  | "team";

export type StageKey = "group" | "swiss" | "knockout";

export type TeamSide = "radiant" | "dire";

export type AghanimState = "owned" | "queued" | "none";

export interface TeamInfo {
  side: TeamSide;
  name: string;
  shortName: string;
  seed: string;
  color: string;
}

export interface EntityTeamInfo {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  color: string;
}

export interface HeroPickSummary {
  heroId: number;
  hero: string;
  icon: string;
  portrait: string;
  picks: number;
  wins: number;
}

export interface PlayerTag {
  id: string;
  text: string;
  likeCount: number;
  sizeLevel: number;
  createdAt: string;
}

export interface ProfileMatchSummary {
  matchId: string;
  startTime: string;
  duration: string;
  radiantTeamName: string;
  direTeamName: string;
  score: string;
  radiantScore: number | null;
  direScore: number | null;
  radiantWin: boolean | null;
  side: TeamSide | null;
  hero: string | null;
  heroPortrait: string | null;
  playerCount: number;
  heroLineups: Record<TeamSide, MatchRecordHero[]>;
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
  kda: string | null;
  result: "win" | "loss" | "unknown";
}

export interface ProfileStatsSummary {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: string;
  kda: string;
  avgKills: string;
  avgDeaths: string;
  avgAssists: string;
  avgGpm: string;
  avgXpm: string;
  avgNetWorth: string;
  avgHeroDamage: string;
  avgTowerDamage: string;
  avgDamageTaken: string;
  topHeroes: HeroPickSummary[];
}

export interface PlayerTournamentHistoryEntry {
  tournamentId: string;
  tournamentName: string;
  startsAt: string;
  status: string;
  isCurrent: boolean;
  stats: ProfileStatsSummary;
  matches: ProfileMatchSummary[];
}

export interface PlayerDirectoryItem {
  id: string;
  accountId: number | null;
  displayName: string;
  avatarUrl: string | null;
  currentTeam: EntityTeamInfo | null;
  teams: EntityTeamInfo[];
  stats: ProfileStatsSummary;
}

export interface AcknowledgementItem {
  id: string;
  category: "sponsor" | "community";
  displayName: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface HeroLeaderboardCandidate {
  rank: number;
  player: PlayerDirectoryItem;
  matches: number;
  average: number;
  total: number;
}

export interface HeroLeaderboardItem {
  key: string;
  title: string;
  description: string;
  metricLabel: string;
  unit: string;
  precision: number;
  minMatches: number;
  winner: HeroLeaderboardCandidate | null;
  candidates: HeroLeaderboardCandidate[];
}

export interface HeroLeaderboardsView {
  tournamentId: string;
  tournamentName: string;
  basis: "mixed";
  minMatches: number;
  leaderboards: HeroLeaderboardItem[];
}

export interface TeamDirectoryItem extends EntityTeamInfo {
  seed: number | null;
  status: string;
  memberCount: number;
  members: PlayerDirectoryItem[];
  stats: {
    seriesPlayed: number;
    seriesWins: number;
    seriesLosses: number;
    gameWins: number;
    gameLosses: number;
    linkedMatches: number;
    winRate: string;
    topHeroes: HeroPickSummary[];
  };
}

export interface PlayerProfile extends PlayerDirectoryItem {
  tournamentId: string;
  matches: ProfileMatchSummary[];
  tournamentHistory: PlayerTournamentHistoryEntry[];
  tags: PlayerTag[];
}

export interface TeamProfile extends TeamDirectoryItem {
  matches: ProfileMatchSummary[];
}

export interface TournamentStat {
  label: string;
  value: string;
  hint: string;
}

export interface IconRef {
  label: string;
  imageUrl: string;
  level?: number;
  kind?: "ability" | "talent" | "attribute" | "empty";
  key?: string;
}

export interface TalentTreeNode {
  tier: 1 | 2 | 3 | 4;
  side: "left" | "right";
  picked: boolean;
  label: string;
  level?: number;
}

export interface MatchRecord {
  matchId: string;
  leagueName: string;
  tournamentName: string;
  startTime: string;
  duration: string;
  radiantTeamName: string;
  direTeamName: string;
  radiantScore: number | null;
  direScore: number | null;
  radiantWin: boolean | null;
  parseStatus: string;
  playerCount: number;
  heroLineups: Record<TeamSide, MatchRecordHero[]>;
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
}

export interface MatchRecordHero {
  playerSlot: number;
  heroId: number;
  hero: string;
  icon: string;
  portrait: string;
  playerName: string;
}

export interface TournamentMeta {
  status: "draft" | "upcoming" | "running" | "completed" | "archived" | "unknown";
  statusText: string;
  startsAt: string;
  endsAt: string;
  leagueId: string;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  team: string;
  groupName: string | null;
  score: string;
  points: string;
  streak: string;
  status: "晋级区" | "观察区" | "淘汰区";
}

export interface BracketPreviewNode {
  id: string;
  bracketGroup: string;
  roundName: string;
  roundNumber: number;
  groupName: string;
  position: number;
  topTeamId: string | null;
  topTeam: string;
  bottomTeamId: string | null;
  bottomTeam: string;
  winnerTeamId: string | null;
  winner: string;
  status: string;
  nextNodeId: string | null;
  nextSlot: "radiant" | "dire" | null;
  loserNextNodeId: string | null;
  loserNextSlot: "radiant" | "dire" | null;
}

export interface StageView {
  key: StageKey;
  name: string;
  status: string;
  currentRound: string;
  note: string;
  standings: StandingRow[];
  bracket: BracketPreviewNode[];
}

export interface ScheduleGroup {
  date: string;
  label: string;
  matches: ScheduleItem[];
}

export interface ScheduleItem {
  time: string;
  stage: string;
  stageType?: StageKey | undefined;
  round: string;
  kind: "regular" | "tiebreaker" | string;
  teamAId: string;
  teamA: string;
  teamBId: string;
  teamB: string;
  bo: string;
  status: "未开始" | "待补录" | "已完赛" | "延期";
  score?: string;
  matchId?: string;
  games?: Array<{
    gameIndex: number;
    matchId: string | null;
    winnerTeamId: string | null;
  }>;
}

export interface OfficialScheduleStatus {
  status: "unconfigured" | "draft" | "published" | "withdrawn" | string;
  isPublished: boolean;
  rosterLocked: boolean;
  publishedAt: string | null;
  withdrawnAt: string | null;
}

export interface PlayerStats {
  id: string;
  side: TeamSide;
  name: string;
  hero: string;
  heroShort: string;
  portrait: string;
  lane: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  participation: string;
  damageShare: string;
  gpm: number;
  xpm: number;
  netWorth: string;
  lastHits: number;
  denies: number;
  heroDamage: string;
  towerDamage: string;
  healing: string;
  damageTaken: string;
  items: IconRef[];
  backpackItems: IconRef[];
  neutralItem: IconRef;
  scepter: AghanimState;
  shard: AghanimState;
  abilityOrder: IconRef[];
  talentTree: TalentTreeNode[];
  tags: string[];
}

export interface DraftStep {
  order: number;
  side: TeamSide;
  type: "Ban" | "Pick";
  hero: string;
  portrait?: string;
  actor: string;
}

export interface WardEvent {
  time: string;
  timeSeconds: number;
  side: TeamSide;
  type: "观察守卫" | "岗哨守卫" | "反眼";
  lane: string;
  note: string;
  x: number | null;
  y: number | null;
  removedAt: number | null;
}

export interface ChatLine {
  time: string;
  side: TeamSide;
  player: string;
  hero: string;
  text: string;
}

export interface TrendPoint {
  minute: number;
  value: number;
}

export interface PlayerTrend {
  playerSlot: number;
  playerName: string;
  side: TeamSide;
  heroId: number;
  values: number[];
}

export interface TrendCharts {
  hasTrends: boolean;
  goldAdvantage: TrendPoint[];
  xpAdvantage: TrendPoint[];
  playerGold: PlayerTrend[];
  playerXp: PlayerTrend[];
}

export interface ComparisonMetric {
  key: string;
  label: string;
  radiantValue: number;
  direValue: number;
  radiantShare: number;
}

export interface MatchAward {
  code: string;
  title: string;
  description: string;
  playerId: string;
  playerName: string;
  side: TeamSide;
  hero: string;
  portrait: string;
  valueText: string;
}

export interface MatchData {
  id: string;
  league: string;
  series: string;
  mode: string;
  endedAt: string;
  duration: string;
  radiantScore: number;
  direScore: number;
  winner: TeamSide;
  radiant: TeamInfo;
  dire: TeamInfo;
  mvpPlayerId: string;
  parseStatus: string;
  players: PlayerStats[];
  draft: DraftStep[];
  wardTimeline: WardEvent[];
  trends: TrendCharts;
  comparisons: ComparisonMetric[];
  awards: MatchAward[];
  chat: ChatLine[];
}
