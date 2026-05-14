export type AppRoute = "home" | "stage" | "schedule" | "records" | "match" | "tags";

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
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
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
  team: string;
  score: string;
  points: string;
  streak: string;
  status: "晋级区" | "观察区" | "淘汰区";
}

export interface StageView {
  key: StageKey;
  name: string;
  status: string;
  currentRound: string;
  note: string;
  standings: StandingRow[];
}

export interface ScheduleGroup {
  date: string;
  label: string;
  matches: ScheduleItem[];
}

export interface ScheduleItem {
  time: string;
  stage: string;
  round: string;
  teamA: string;
  teamB: string;
  bo: string;
  status: "未开始" | "待补录" | "已完赛" | "延期";
  score?: string;
  matchId?: string;
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
  chat: ChatLine[];
}
