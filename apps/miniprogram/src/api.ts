import Taro from "@tarojs/taro";
import { normalizeMatchDetail, normalizeMatchRecord, type ApiMatchDetail, type ApiMatchRecord } from "./dota";
import { getApiBaseUrl } from "./runtimeConfig";
import type {
  ApiResult,
  AppUserMe,
  AppUserStats,
  AcknowledgementItem,
  AuthSession,
  DotaAccountBinding,
  BracketNode,
  HeroLeaderboardCandidate,
  HeroLeaderboardsView,
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

const AUTH_SESSION_STORAGE_KEY = "mrjz.authSession";
const SELECTED_TOURNAMENT_STORAGE_KEY = "mrjz.selectedTournamentId";
const LOCAL_LIKED_TAGS_STORAGE_KEY = "mrjz.localLikedTags";
const REQUEST_TIMEOUT_MS = 25000;
const REQUEST_RETRY_DELAY_MS = 500;

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

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
  const code = await getWechatLoginCode();
  const data = {
    code,
    nickname: "微信用户",
  };

  const session = await request<AuthSession>("/auth/wechat-login", {
    method: "POST",
    data,
    withAuth: false,
  });

  Taro.setStorageSync(AUTH_SESSION_STORAGE_KEY, session);
  return session;
}

async function getWechatLoginCode(): Promise<string> {
  let loginError: unknown;

  try {
    const loginResult = await Taro.login();
    const code = typeof loginResult.code === "string" ? loginResult.code.trim() : "";

    if (code.length > 0) {
      return code;
    }
  } catch (caught) {
    loginError = caught;
    console.warn("[MRJZ login] wx.login failed", requestFailureMessage(caught));
  }

  throw new Error(formatWechatLoginCodeError(loginError));
}

function formatWechatLoginCodeError(caught: unknown): string {
  if (typeof caught === "object" && caught !== null && "errMsg" in caught) {
    return `微信登录凭证获取失败：${String((caught as { errMsg?: unknown }).errMsg ?? "请稍后重试")}`;
  }

  return caught instanceof Error ? `微信登录凭证获取失败：${caught.message}` : "微信登录凭证获取失败，请稍后重试";
}

export async function loadMe(): Promise<AppUserMe> {
  const me = await request<AppUserMe>("/me");

  return {
    ...me,
    bindings: me.bindings.map(normalizeDotaAccountBinding),
  };
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
  const stats = await request<AppUserStats>("/me/stats");

  return normalizeAppUserStats(stats);
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
  const players = await request<PlayerListItem[]>(`/tournaments/${encodeURIComponent(tournamentId)}/players`, { withAuth: false });

  return players.map(normalizePlayerListItem);
}

export async function loadHeroLeaderboards(tournamentId: string): Promise<HeroLeaderboardsView> {
  const leaderboards = await request<HeroLeaderboardsView>(`/tournaments/${encodeURIComponent(tournamentId)}/hero-leaderboards`, {
    withAuth: false,
  });

  return normalizeHeroLeaderboards(leaderboards);
}

export async function loadAcknowledgements(): Promise<AcknowledgementItem[]> {
  const acknowledgements = await request<AcknowledgementItem[]>("/acknowledgements", { withAuth: false });

  return acknowledgements.map(normalizeAcknowledgementItem);
}

export async function loadPlayerProfile(tournamentId: string, playerId: string): Promise<PlayerProfile> {
  const profile = await request<PlayerProfile>(`/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}`, {
    withAuth: false,
  });

  return normalizePlayerProfile(profile);
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
  const teams = await request<TeamListItem[]>(`/tournaments/${encodeURIComponent(tournamentId)}/teams`, { withAuth: false });

  return teams.map(normalizeTeamListItem);
}

export async function loadTeamProfile(tournamentId: string, teamId: string): Promise<TeamProfile> {
  const profile = await request<TeamProfile>(`/tournaments/${encodeURIComponent(tournamentId)}/teams/${encodeURIComponent(teamId)}`, {
    withAuth: false,
  });

  return normalizeTeamProfile(profile);
}

export async function ensureTournamentId(tournaments?: TournamentOption[]): Promise<string> {
  const stored = getSelectedTournamentId();
  const availableTournaments = tournaments ?? (await loadTournaments());
  const tournamentId = availableTournaments.some((tournament) => tournament.id === stored)
    ? stored
    : availableTournaments[0]?.id ?? "";

  if (tournamentId.length > 0 && tournamentId !== stored) {
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
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}${path}`;
  const method = options.method ?? "GET";
  const header = {
    "content-type": "application/json",
    ...(shouldAttachAuth
      ? {
          authorization: `Bearer ${session.token}`,
        }
      : {}),
  };
  let response: Taro.request.SuccessCallbackResult<ApiResult<T>>;

  try {
    response = await sendRequest<T>({
      url,
      method,
      data: options.data,
      header,
    });
  } catch (caught) {
    if (method !== "GET" || !isTimeoutFailure(caught)) {
      throw new Error(formatRequestFailure(caught));
    }

    await delay(REQUEST_RETRY_DELAY_MS);

    try {
      response = await sendRequest<T>({
        url,
        method,
        data: options.data,
        header,
      });
    } catch (retryCaught) {
      throw new Error(formatRequestFailure(retryCaught));
    }
  }

  const result = response.data;

  if (result?.success) {
    return result.data;
  }

  if (response.statusCode === 401) {
    clearStoredAuthSession();
  }

  throw new Error(result?.error?.message ?? `API request failed: ${response.statusCode}`);
}

async function sendRequest<T>(input: {
  url: string;
  method: RequestMethod;
  data?: unknown;
  header: Record<string, string>;
}): Promise<Taro.request.SuccessCallbackResult<ApiResult<T>>> {
  const startedAt = Date.now();

  try {
    return await Taro.request<ApiResult<T>>({
      url: input.url,
      method: input.method,
      data: input.data,
      timeout: REQUEST_TIMEOUT_MS,
      header: input.header,
    });
  } catch (caught) {
    logRequestFailure(input, Date.now() - startedAt, caught);
    throw caught;
  }
}

function isTimeoutFailure(caught: unknown): boolean {
  return requestFailureMessage(caught).toLowerCase().includes("timeout");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requestFailureMessage(caught: unknown): string {
  return typeof caught === "object" && caught !== null && "errMsg" in caught
    ? String((caught as { errMsg?: unknown }).errMsg ?? "")
    : caught instanceof Error
      ? caught.message
      : String(caught);
}

function formatRequestFailure(caught: unknown): string {
  const message = requestFailureMessage(caught);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("timeout")) {
    return "API 请求超时，请稍后重试";
  }

  if (lowerMessage.includes("fail")) {
    return "API 请求失败，请稍后重试";
  }

  return message || "API 请求失败，请稍后重试";
}

function logRequestFailure(input: { url: string; method: RequestMethod }, durationMs: number, caught: unknown): void {
  console.warn("[MRJZ request] failed", input.method, input.url, `${durationMs}ms`, requestFailureMessage(caught));
}

function normalizeAppUserStats(stats: AppUserStats): AppUserStats {
  return {
    ...stats,
    binding: stats.binding ? normalizeDotaAccountBinding(stats.binding) : null,
    player: stats.player ? normalizePlayerListItem(stats.player) : null,
  };
}

function normalizeDotaAccountBinding(binding: DotaAccountBinding): DotaAccountBinding {
  return {
    ...binding,
    avatarUrl: normalizeSteamAvatarUrl({
      accountId: binding.accountId,
      avatarUrl: binding.avatarUrl,
    }),
  };
}

function normalizePlayerProfile(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    avatarUrl: normalizeSteamAvatarUrl(profile),
  };
}

function normalizeTeamProfile(profile: TeamProfile): TeamProfile {
  return {
    ...profile,
    logoUrl: normalizeApiImageUrl(profile.logoUrl ?? null),
    members: profile.members.map(normalizePlayerListItem),
  };
}

function normalizeTeamListItem(team: TeamListItem): TeamListItem {
  return {
    ...team,
    logoUrl: normalizeApiImageUrl(team.logoUrl ?? null),
    members: team.members.map(normalizePlayerListItem),
  };
}

function normalizeHeroLeaderboards(view: HeroLeaderboardsView): HeroLeaderboardsView {
  return {
    ...view,
    leaderboards: view.leaderboards.map((board) => ({
      ...board,
      winner: board.winner ? normalizeHeroLeaderboardCandidate(board.winner) : null,
      candidates: board.candidates.map(normalizeHeroLeaderboardCandidate),
    })),
  };
}

function normalizeHeroLeaderboardCandidate(candidate: HeroLeaderboardCandidate): HeroLeaderboardCandidate {
  return {
    ...candidate,
    player: normalizePlayerListItem(candidate.player),
  };
}

function normalizePlayerListItem(player: PlayerListItem): PlayerListItem {
  return {
    ...player,
    avatarUrl: normalizeSteamAvatarUrl(player),
  };
}

function normalizeAcknowledgementItem(item: AcknowledgementItem): AcknowledgementItem {
  return {
    id: item.id,
    category: item.category === "community" ? "community" : "sponsor",
    displayName: item.displayName || "未命名",
    imageUrl: normalizeApiImageUrl(item.imageUrl),
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
  };
}

function normalizeSteamAvatarUrl(player: { accountId?: number | null; avatarUrl?: string | null }): string | null {
  const avatarUrl = normalizeApiImageUrl(player.avatarUrl ?? null);

  if (!avatarUrl) {
    return null;
  }

  if (Number.isSafeInteger(player.accountId) && isSteamAvatarUrl(avatarUrl)) {
    return `${apiOrigin()}/api/assets/steam-avatars/${player.accountId}.jpg`;
  }

  return avatarUrl;
}

function isSteamAvatarUrl(avatarUrl: string): boolean {
  try {
    return new URL(avatarUrl).hostname.toLowerCase() === "avatars.steamstatic.com";
  } catch {
    return false;
  }
}

function normalizeApiImageUrl(imageUrl: string | null): string | null {
  if (imageUrl === null || imageUrl.trim().length === 0) {
    return null;
  }

  const trimmed = imageUrl.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${apiOrigin()}${trimmed}`;
  }

  return trimmed;
}

function apiOrigin(): string {
  return getApiBaseUrl().replace(/\/api\/?$/i, "");
}
