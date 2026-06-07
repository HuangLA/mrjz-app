import Taro from "@tarojs/taro";
import { normalizeMatchDetail, normalizeMatchRecord, type ApiMatchDetail, type ApiMatchRecord } from "./dota";
import type {
  ApiResult,
  AppUserMe,
  AppUserStats,
  AuthSession,
  DotaAccountBinding,
  BracketNode,
  MatchDetail,
  MatchRecord,
  OfficialScheduleStatus,
  PlayerListItem,
  PlayerProfile,
  PlayerTag,
  StageRound,
  StandingRow,
  TeamListItem,
  TeamProfile,
  TournamentDetail,
  TournamentOption,
} from "./types";

declare const __MRJZ_MINIPROGRAM_API_BASE_URL__: string | undefined;

const LOCAL_API_BASE_URL = "http://127.0.0.1:3001/api";
const DEFAULT_API_BASE_URL = resolveBuildApiBaseUrl();
const API_BASE_STORAGE_KEY = "mrjz.apiBaseUrl";
const AUTH_SESSION_STORAGE_KEY = "mrjz.authSession";
const SELECTED_TOURNAMENT_STORAGE_KEY = "mrjz.selectedTournamentId";
const LOCAL_LIKED_TAGS_STORAGE_KEY = "mrjz.localLikedTags";

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function getApiBaseUrl(): string {
  const stored = Taro.getStorageSync<string>(API_BASE_STORAGE_KEY);

  return stored && stored.trim().length > 0 ? trimTrailingSlash(stored) : DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(value: string): void {
  const nextValue = trimTrailingSlash(value.trim());

  if (nextValue.length === 0) {
    Taro.removeStorageSync(API_BASE_STORAGE_KEY);
    return;
  }

  Taro.setStorageSync(API_BASE_STORAGE_KEY, nextValue);
}

export function getStoredAuthSession(): AuthSession | null {
  const session = Taro.getStorageSync<AuthSession | "">(AUTH_SESSION_STORAGE_KEY);

  return typeof session === "object" && session !== null && "token" in session ? session : null;
}

export function clearStoredAuthSession(): void {
  Taro.removeStorageSync(AUTH_SESSION_STORAGE_KEY);
}

export function getSelectedTournamentId(): string {
  return Taro.getStorageSync<string>(SELECTED_TOURNAMENT_STORAGE_KEY) || "";
}

export function setSelectedTournamentId(tournamentId: string): void {
  Taro.setStorageSync(SELECTED_TOURNAMENT_STORAGE_KEY, tournamentId);
}

export function getLocalLikedTagIds(userId: string): Set<string> {
  const value = Taro.getStorageSync<Record<string, string[]> | "">(LOCAL_LIKED_TAGS_STORAGE_KEY);
  const ids = typeof value === "object" && value !== null ? value[userId] ?? [] : [];

  return new Set(ids);
}

export function setLocalLikedTagIds(userId: string, tagIds: Set<string>): void {
  const current = Taro.getStorageSync<Record<string, string[]> | "">(LOCAL_LIKED_TAGS_STORAGE_KEY);
  const next = typeof current === "object" && current !== null ? current : {};
  next[userId] = [...tagIds];
  Taro.setStorageSync(LOCAL_LIKED_TAGS_STORAGE_KEY, next);
}

export async function loginWithWeChat(): Promise<AuthSession> {
  const loginResult = await Taro.login();
  const session = await request<AuthSession>("/auth/wechat-login", {
    method: "POST",
    data: {
      code: loginResult.code,
      nickname: "微信用户",
      devUserId: "local",
    },
    withAuth: false,
  });

  Taro.setStorageSync(AUTH_SESSION_STORAGE_KEY, session);
  return session;
}

export async function loadMe(): Promise<AppUserMe> {
  return request<AppUserMe>("/me");
}

export async function logout(): Promise<void> {
  await request<{ revoked: true }>("/auth/logout", { method: "POST" });
  clearStoredAuthSession();
}

export async function bindDotaAccount(input: { accountId?: number | null; steamId64?: string | null; steamId?: string | null }): Promise<DotaAccountBinding> {
  return request<DotaAccountBinding>("/me/player-binding", {
    method: "POST",
    data: input,
  });
}

export async function loadMyStats(): Promise<AppUserStats> {
  return request<AppUserStats>("/me/stats");
}

export async function loadTournaments(): Promise<TournamentOption[]> {
  return request<TournamentOption[]>("/tournaments", { withAuth: false });
}

export async function loadTournament(tournamentId: string): Promise<TournamentDetail> {
  return request<TournamentDetail>(`/tournaments/${encodeURIComponent(tournamentId)}`, { withAuth: false });
}

export async function loadOfficialSchedule(tournamentId: string): Promise<OfficialScheduleStatus> {
  return request<OfficialScheduleStatus>(`/tournaments/${encodeURIComponent(tournamentId)}/official-schedule`, {
    withAuth: false,
  });
}

export async function loadStageRounds(stageId: string): Promise<StageRound[]> {
  return request<StageRound[]>(`/stages/${encodeURIComponent(stageId)}/rounds`, { withAuth: false });
}

export async function loadStageStandings(stageId: string): Promise<StandingRow[]> {
  return request<StandingRow[]>(`/stages/${encodeURIComponent(stageId)}/standings`, { withAuth: false });
}

export async function loadStageBracket(stageId: string): Promise<BracketNode[]> {
  return request<BracketNode[]>(`/stages/${encodeURIComponent(stageId)}/bracket`, { withAuth: false });
}

export async function loadTournamentMatches(tournamentId: string, limit = 80): Promise<MatchRecord[]> {
  const records = await request<ApiMatchRecord[]>(`/tournaments/${encodeURIComponent(tournamentId)}/matches?limit=${limit}`, {
    withAuth: false,
  });

  return records.map(normalizeMatchRecord);
}

export async function loadMatch(matchId: number | string): Promise<MatchDetail> {
  const detail = await request<ApiMatchDetail>(`/matches/${encodeURIComponent(String(matchId))}`, { withAuth: false });
  return normalizeMatchDetail(detail);
}

export async function loadTournamentPlayers(tournamentId: string): Promise<PlayerListItem[]> {
  return request<PlayerListItem[]>(`/tournaments/${encodeURIComponent(tournamentId)}/players`, { withAuth: false });
}

export async function loadPlayerProfile(tournamentId: string, playerId: string): Promise<PlayerProfile> {
  return request<PlayerProfile>(`/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}`, {
    withAuth: false,
  });
}

export async function loadPlayerTags(tournamentId: string, playerId: string): Promise<PlayerTag[]> {
  return request<PlayerTag[]>(
    `/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}/tags`,
    { withAuth: false },
  );
}

export async function submitPlayerTag(tournamentId: string, playerId: string, text: string): Promise<PlayerTag> {
  return request<PlayerTag>(`/miniprogram/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}/tags`, {
    method: "POST",
    data: { text },
  });
}

export async function likePlayerTag(tagId: string): Promise<PlayerTag> {
  return request<PlayerTag>(`/miniprogram/tags/${encodeURIComponent(tagId)}/like`, { method: "POST" });
}

export async function unlikePlayerTag(tagId: string): Promise<PlayerTag> {
  return request<PlayerTag>(`/miniprogram/tags/${encodeURIComponent(tagId)}/like`, { method: "DELETE" });
}

export async function loadTournamentTeams(tournamentId: string): Promise<TeamListItem[]> {
  return request<TeamListItem[]>(`/tournaments/${encodeURIComponent(tournamentId)}/teams`, { withAuth: false });
}

export async function loadTeamProfile(tournamentId: string, teamId: string): Promise<TeamProfile> {
  return request<TeamProfile>(`/tournaments/${encodeURIComponent(tournamentId)}/teams/${encodeURIComponent(teamId)}`, {
    withAuth: false,
  });
}

export async function ensureTournamentId(): Promise<string> {
  const stored = getSelectedTournamentId();

  if (stored.length > 0) {
    return stored;
  }

  const tournaments = await loadTournaments();
  const tournamentId = tournaments[0]?.id ?? "";

  if (tournamentId.length > 0) {
    setSelectedTournamentId(tournamentId);
  }

  return tournamentId;
}

async function request<T>(
  path: string,
  options: { method?: RequestMethod; data?: unknown; withAuth?: boolean } = {},
): Promise<T> {
  const session = getStoredAuthSession();
  const shouldAttachAuth = options.withAuth !== false && session !== null;
  const response = await Taro.request<ApiResult<T>>({
    url: `${getApiBaseUrl()}${path}`,
    method: options.method ?? "GET",
    data: options.data,
    header: {
      "content-type": "application/json",
      ...(shouldAttachAuth
        ? {
            authorization: `Bearer ${session.token}`,
          }
        : {}),
    },
  });
  const result = response.data;

  if (result?.success) {
    return result.data;
  }

  if (response.statusCode === 401) {
    clearStoredAuthSession();
  }

  throw new Error(result?.error?.message ?? `API request failed: ${response.statusCode}`);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveBuildApiBaseUrl(): string {
  const buildValue =
    typeof __MRJZ_MINIPROGRAM_API_BASE_URL__ === "string" ? __MRJZ_MINIPROGRAM_API_BASE_URL__ : "";

  return trimTrailingSlash(buildValue.trim() || LOCAL_API_BASE_URL);
}
