export type ApiSource = "api" | "unavailable";

export type Tone = "neutral" | "good" | "warn" | "danger" | "info";

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  status: "active" | "disabled" | string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuthSession {
  token: string;
  expiresAt: string;
  admin: AdminUser;
}

export type TournamentStatus = "draft" | "upcoming" | "published" | "running" | "completed" | "archived" | string;
export type StageStatus = "draft" | "published" | "running" | "locked" | "completed" | string;
export type StageType = "group" | "swiss" | "knockout" | string;

export interface TeamBrief {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string | null;
  color: string;
}

export interface LeagueBrief {
  id: string;
  name: string;
  opendotaLeagueId?: number | null;
}

export interface SeasonBrief {
  id: string;
  name: string;
}

export interface StageSummary {
  id: string;
  tournamentId: string;
  type: StageType;
  name: string;
  sortOrder: number;
  status: StageStatus;
  advancementRule?: string;
  config?: Record<string, unknown>;
  activeRound?: RoundBrief | null;
}

export interface TournamentListItem {
  id: string;
  seasonId?: string;
  leagueId?: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  season?: SeasonBrief;
  league?: LeagueBrief;
  currentStage?: StageSummary;
  currentStageId?: string;
  startsAt?: string;
  endsAt?: string | null;
  teamCount?: number;
  matchCount?: number;
}

export interface TournamentDetail extends TournamentListItem {
  visibility?: "public" | "private";
  stages: StageSummary[];
  nextSeries?: SeriesSummary | null;
  latestResult?: SeriesSummary | null;
}

export interface RoundBrief {
  id: string;
  stageId: string;
  roundNumber: number;
  name: string;
  status: string;
}

export interface SeriesGame {
  gameIndex: number;
  matchId: number | null;
  radiantScore: number | null;
  direScore: number | null;
}

export interface PlayerBrief {
  id: string;
  accountId: number | null;
  steamId64: string | null;
  displayName: string;
  avatarUrl: string | null;
  currentTeam: TeamBrief | null;
}

export interface TeamStatsSummary {
  seriesPlayed: number;
  seriesWins: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  linkedMatches: number;
  winRate: number | null;
  topHeroes: Array<{
    heroId: number;
    picks: number;
    wins: number;
  }>;
}

export interface PlayerStatsSummary {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgKills: number | null;
  avgDeaths: number | null;
  avgAssists: number | null;
  kda: number | null;
  avgGpm: number | null;
  avgXpm: number | null;
  avgNetWorth: number | null;
  avgHeroDamage: number | null;
  avgTowerDamage: number | null;
  avgDamageTaken: number | null;
  topHeroes: Array<{
    heroId: number;
    picks: number;
    wins: number;
  }>;
}

export interface TournamentTeamListItem extends TeamBrief {
  tournamentId: string;
  seed: number | null;
  status: string;
  memberCount: number;
  members: PlayerBrief[];
  stats: TeamStatsSummary;
}

export interface TournamentPlayerListItem extends PlayerBrief {
  teams: TeamBrief[];
  stats: PlayerStatsSummary;
}

export interface OpenDotaMatchListItem {
  matchId: number;
  leagueId: number | null;
  leagueName: string;
  tournamentId: string;
  tournamentName: string;
  parseStatus: "requested" | "parsed" | "failed";
  startTime: string | null;
  durationSeconds: number | null;
  durationText: string | null;
  gameMode: number | null;
  radiantWin: boolean | null;
  radiantScore: number | null;
  direScore: number | null;
  radiantTeamName: string;
  direTeamName: string;
  playerCount: number;
  hasDraft: boolean;
  hasVision: boolean;
  hasChat: boolean;
  linkedSeries: {
    seriesId: string;
    stageId: string;
    roundId: string;
    gameIndex: number;
    status: string;
    radiantTeam: TeamBrief;
    direTeam: TeamBrief;
  } | null;
  updatedAt: string;
}

export interface SeriesSummary {
  id: string;
  roundId: string;
  stageId: string;
  groupId: string | null;
  groupName: string | null;
  seriesKind: "regular" | "tiebreaker" | string;
  boType: string;
  status: string;
  scheduledAt: string;
  radiantTeam: TeamBrief;
  direTeam: TeamBrief;
  radiantScore: number;
  direScore: number;
  winnerTeamId: string | null;
  games: SeriesGame[];
}

export interface StageRound extends RoundBrief {
  pairingStatus?: "draft" | "published" | "confirmed" | string;
  byes?: TeamBrief[];
  series: SeriesSummary[];
}

export interface StageGroup {
  id: string;
  stageId: string;
  name: string;
  sortOrder: number;
  teams: TeamBrief[];
}

export interface StandingRow {
  id?: string;
  rank: number;
  team?: TeamBrief;
  teamId?: string;
  groupName?: string | null;
  seriesPlayed?: number;
  seriesWins: number;
  seriesDraws: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  points: number;
  opponentScore?: number;
  headToHeadScore?: number;
  manualRank?: number | null;
  status?: "advance" | "safe" | "eliminated" | string;
}

export interface BracketNode {
  id: string;
  stageId: string;
  bracketGroup: "single" | "winner" | "loser" | "grand_final" | string;
  roundNumber: number;
  roundName: string;
  position: number;
  status: string;
  radiantTeam: TeamBrief | null;
  direTeam: TeamBrief | null;
  series: SeriesSummary | null;
  nextNodeId: string | null;
  nextSlot: "radiant" | "dire" | null;
  loserNextNodeId: string | null;
  loserNextSlot: "radiant" | "dire" | null;
  winnerTeamId: string | null;
}

export type OfficialScheduleStatus = "unconfigured" | "draft" | "published" | "withdrawn" | string;

export interface OfficialScheduleTeam {
  team: TeamBrief;
  seed: number | null;
  isSeeded: boolean;
}

export interface OfficialScheduleLogEntry {
  id: string;
  tournamentId: string;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface OfficialScheduleManagement {
  tournamentId: string;
  status: OfficialScheduleStatus;
  rosterLocked: boolean;
  preliminaryType: "group" | "swiss" | null;
  knockoutType: "single_elimination" | "double_elimination" | null;
  lockedAt: string | null;
  publishedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string | null;
  teams: OfficialScheduleTeam[];
  logs: OfficialScheduleLogEntry[];
}

export interface SyncTask {
  id: string;
  kind: string;
  status: string;
  leagueId?: number | null;
  targetType?: string | null;
  targetId?: string | null;
  attempts: number;
  lastError?: string | null;
  nextRunAt?: string | null;
  updatedAt?: string;
}

export type PlayerTagStatus = "pending_review" | "approved" | "rejected" | "hidden";

export type AcknowledgementCategory = "sponsor" | "community";
export type AcknowledgementStatus = "visible" | "hidden";

export interface AcknowledgementItem {
  id: string;
  category: AcknowledgementCategory;
  displayName: string;
  imageUrl: string | null;
  sortOrder: number;
  status: AcknowledgementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerTagModerationItem {
  id: string;
  tournamentId: string;
  targetType: "player";
  targetId: string;
  targetName: string;
  text: string;
  normalizedText: string;
  likeCount: number;
  sizeLevel: number;
  status: PlayerTagStatus;
  reviewReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: {
    id: string;
    nickname: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdminTagPlayerItem extends TournamentPlayerListItem {
  tournamentIds: string[];
  tags: PlayerTagModerationItem[];
  tagCounts: Record<PlayerTagStatus, number>;
}

export interface WriteResult {
  ok: boolean;
  status: number;
  message: string;
  data?: unknown;
}

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

const DEFAULT_API_BASE_URL = "https://api.dota2mrjz.icu/api";

export const apiBaseUrl = String(
  import.meta.env.PUBLIC_API_BASE_URL || import.meta.env.VITE_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
).replace(/\/$/, "");

const ADMIN_SESSION_STORAGE_KEY = "mrjz.adminSession";
const ADMIN_UNAUTHORIZED_EVENT = "mrjz:admin-unauthorized";

export function getStoredAdminSession(): AdminAuthSession | null {
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as AdminAuthSession;

    return typeof parsed.token === "string" && parsed.token.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredAdminSession(session: AdminAuthSession): void {
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAdminSession(): void {
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

function adminAuthHeaders(): Record<string, string> {
  const session = getStoredAdminSession();

  return session === null ? {} : { Authorization: `Bearer ${session.token}` };
}

function notifyAdminUnauthorized(): void {
  window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT));
}

export async function adminLogin(username: string, password: string): Promise<AdminAuthSession> {
  const response = await fetch(`${apiBaseUrl}/admin/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json()) as ApiSuccess<AdminAuthSession> | ApiFailure;

  if (!response.ok || body.success !== true) {
    throw new Error(body.success === false ? body.error?.message ?? response.statusText : response.statusText);
  }

  setStoredAdminSession(body.data);
  return body.data;
}

export async function adminLogout(): Promise<void> {
  try {
    await sendAdminRequest("/admin/auth/logout", "POST");
  } finally {
    clearStoredAdminSession();
  }
}

export async function getAdminMe(): Promise<AdminUser> {
  return getJson<AdminUser>("/admin/auth/me");
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      ...adminAuthHeaders(),
    },
  });

  const body = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (response.status === 401) {
    clearStoredAdminSession();
    notifyAdminUnauthorized();
  }

  if (!response.ok || body.success !== true) {
    throw new Error(body.success === false ? body.error?.message ?? response.statusText : response.statusText);
  }

  return body.data;
}

export async function sendAdminRequest(path: string, method: "POST" | "PATCH" | "DELETE", payload?: unknown): Promise<WriteResult> {
  try {
    const init: RequestInit = {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...adminAuthHeaders(),
      },
    };

    if (payload !== undefined) {
      init.body = JSON.stringify(payload);
    }

    const response = await fetch(`${apiBaseUrl}${path}`, init);

    let message = response.statusText;
    let data: unknown;

    try {
      const body = (await response.json()) as ApiSuccess<unknown> | ApiFailure;
      data = body.success === true ? body.data : undefined;
      message = body.success === false ? body.error?.message ?? message : message;
    } catch {
      // Empty or non-JSON responses are common while backend write routes are still being wired.
    }

    if (response.status === 404 || response.status === 405) {
      return {
        ok: false,
        status: response.status,
        message: "后端写接口尚未提供，已保留表单结构和请求路径。",
      };
    }

    if (response.status === 401) {
      clearStoredAdminSession();
      notifyAdminUnauthorized();
    }

    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? "请求已提交。" : message || "请求失败，请稍后重试。",
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: `无法连接 API：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
