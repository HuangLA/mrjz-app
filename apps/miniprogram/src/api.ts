import Taro from "@tarojs/taro";
import {
  normalizeMatchDetail,
  normalizeMatchRecord,
  type ApiMatchDetail,
  type ApiMatchRecord,
} from "./dota";
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
  HeroLeaderboardItem,
  HeroLeaderboardsView,
  HeroPickSummary,
  MatchDetail,
  MatchRecord,
  OfficialScheduleStatus,
  PlayerListItem,
  PlayerStatsSummary,
  PlayerProfile,
  PlayerTag,
  StageRound,
  StandingRow,
  TeamBrief,
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

export function chooseTournamentId(
  tournaments: TournamentOption[],
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const tournamentId = typeof candidate === "string" ? candidate.trim() : "";

    if (tournamentId && tournaments.some((tournament) => tournament.id === tournamentId)) {
      return tournamentId;
    }
  }

  return tournaments[0]?.id ?? "";
}

export function getLocalLikedTagIds(userId: string): Set<string> {
  const value = Taro.getStorageSync<Record<string, string[]> | "">(LOCAL_LIKED_TAGS_STORAGE_KEY);
  const ids = typeof value === "object" && value !== null ? (value[userId] ?? []) : [];

  return new Set(ids);
}

export function setLocalLikedTagIds(userId: string, tagIds: Set<string>): void {
  const current = Taro.getStorageSync<Record<string, string[]> | "">(LOCAL_LIKED_TAGS_STORAGE_KEY);
  const next = typeof current === "object" && current !== null ? current : {};
  next[userId] = [...tagIds];
  Taro.setStorageSync(LOCAL_LIKED_TAGS_STORAGE_KEY, next);
}

export async function loginWithWeChat(options: { nickname: string }): Promise<AuthSession> {
  const nickname = cleanDisplayNickname(options.nickname);

  if (!nickname) {
    throw new Error("请输入昵称");
  }

  const code = await getWechatLoginCode();

  const session = await request<AuthSession>("/auth/wechat-login", {
    method: "POST",
    data: { code, nickname },
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

  return caught instanceof Error
    ? `微信登录凭证获取失败：${caught.message}`
    : "微信登录凭证获取失败，请稍后重试";
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

export async function bindDotaAccount(input: {
  accountId?: number | null;
  steamId64?: string | null;
  steamId?: string | null;
}): Promise<DotaAccountBinding> {
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
  return request<TournamentDetail>(`/tournaments/${encodeURIComponent(tournamentId)}`, {
    withAuth: false,
  });
}

export async function loadOfficialSchedule(tournamentId: string): Promise<OfficialScheduleStatus> {
  return request<OfficialScheduleStatus>(
    `/tournaments/${encodeURIComponent(tournamentId)}/official-schedule`,
    {
      withAuth: false,
    },
  );
}

export async function loadStageRounds(stageId: string): Promise<StageRound[]> {
  return request<StageRound[]>(`/stages/${encodeURIComponent(stageId)}/rounds`, {
    withAuth: false,
  });
}

export async function loadStageStandings(stageId: string): Promise<StandingRow[]> {
  return request<StandingRow[]>(`/stages/${encodeURIComponent(stageId)}/standings`, {
    withAuth: false,
  });
}

export async function loadStageBracket(stageId: string): Promise<BracketNode[]> {
  return request<BracketNode[]>(`/stages/${encodeURIComponent(stageId)}/bracket`, {
    withAuth: false,
  });
}

export async function loadTournamentMatches(
  tournamentId: string,
  limit = 80,
): Promise<MatchRecord[]> {
  const records = await request<ApiMatchRecord[]>(
    `/tournaments/${encodeURIComponent(tournamentId)}/matches?limit=${limit}`,
    {
      withAuth: false,
    },
  );

  return records.map(normalizeMatchRecord);
}

export async function loadMatch(matchId: number | string): Promise<MatchDetail> {
  const detail = await request<ApiMatchDetail>(`/matches/${encodeURIComponent(String(matchId))}`, {
    withAuth: false,
  });
  return normalizeMatchDetail(detail);
}

export async function loadTournamentPlayers(tournamentId: string): Promise<PlayerListItem[]> {
  const players = await request<PlayerListItem[]>(
    `/tournaments/${encodeURIComponent(tournamentId)}/players`,
    { withAuth: false },
  );

  return players.map(normalizePlayerListItem);
}

export async function loadHeroLeaderboards(tournamentId: string): Promise<HeroLeaderboardsView> {
  const leaderboards = await request<HeroLeaderboardsView>(
    `/tournaments/${encodeURIComponent(tournamentId)}/hero-leaderboards`,
    {
      withAuth: false,
    },
  );

  return normalizeHeroLeaderboards(leaderboards);
}

export async function loadAcknowledgements(): Promise<AcknowledgementItem[]> {
  const acknowledgements = await request<AcknowledgementItem[]>("/acknowledgements", {
    withAuth: false,
  });

  return acknowledgements.map(normalizeAcknowledgementItem);
}

export async function loadPlayerProfile(
  tournamentId: string,
  playerId: string,
): Promise<PlayerProfile> {
  const profile = await request<PlayerProfile>(
    `/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}`,
    {
      withAuth: false,
    },
  );

  return normalizePlayerProfile(profile);
}

export async function loadPlayerTags(tournamentId: string, playerId: string): Promise<PlayerTag[]> {
  return request<PlayerTag[]>(
    `/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}/tags`,
    { withAuth: false },
  );
}

export async function submitPlayerTag(
  tournamentId: string,
  playerId: string,
  text: string,
): Promise<PlayerTag> {
  return request<PlayerTag>(
    `/miniprogram/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}/tags`,
    {
      method: "POST",
      data: { text },
    },
  );
}

export async function likePlayerTag(tagId: string): Promise<PlayerTag> {
  return request<PlayerTag>(`/miniprogram/tags/${encodeURIComponent(tagId)}/like`, {
    method: "POST",
  });
}

export async function unlikePlayerTag(tagId: string): Promise<PlayerTag> {
  return request<PlayerTag>(`/miniprogram/tags/${encodeURIComponent(tagId)}/like`, {
    method: "DELETE",
  });
}

export async function loadTournamentTeams(tournamentId: string): Promise<TeamListItem[]> {
  const teams = await request<TeamListItem[]>(
    `/tournaments/${encodeURIComponent(tournamentId)}/teams`,
    { withAuth: false },
  );

  return teams.map(normalizeTeamListItem);
}

export async function loadTeamProfile(tournamentId: string, teamId: string): Promise<TeamProfile> {
  const profile = await request<TeamProfile>(
    `/tournaments/${encodeURIComponent(tournamentId)}/teams/${encodeURIComponent(teamId)}`,
    {
      withAuth: false,
    },
  );

  return normalizeTeamProfile(profile);
}

export async function ensureTournamentId(tournaments?: TournamentOption[]): Promise<string> {
  const stored = getSelectedTournamentId();
  const availableTournaments = tournaments ?? (await loadTournaments());
  const tournamentId = chooseTournamentId(availableTournaments, stored);

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

function cleanDisplayNickname(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? Array.from(trimmed).slice(0, 64).join("") : undefined;
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

function logRequestFailure(
  input: { url: string; method: RequestMethod },
  durationMs: number,
  caught: unknown,
): void {
  console.warn(
    "[MRJZ request] failed",
    input.method,
    input.url,
    `${durationMs}ms`,
    requestFailureMessage(caught),
  );
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

export function normalizeHeroLeaderboards(
  view: Partial<HeroLeaderboardsView> | null | undefined,
): HeroLeaderboardsView {
  const minMatches = finiteNumber(view?.minMatches, 5);

  return {
    tournamentId: cleanString(view?.tournamentId),
    tournamentName: cleanString(view?.tournamentName),
    basis: "mixed",
    minMatches,
    leaderboards: safeArray(view?.leaderboards)
      .map((board) => normalizeHeroLeaderboardItem(board, minMatches))
      .filter(isDefined),
  };
}

function normalizeHeroLeaderboardItem(
  board: Partial<HeroLeaderboardItem>,
  defaultMinMatches: number,
): HeroLeaderboardItem | null {
  const key = cleanString(board.key);

  if (!key) {
    return null;
  }

  const candidates = safeArray(board.candidates)
    .map(normalizeHeroLeaderboardCandidate)
    .filter(isDefined);
  const winner = normalizeHeroLeaderboardCandidate(board.winner) ?? candidates[0] ?? null;

  return {
    key,
    title: cleanString(board.title) || key,
    description: cleanString(board.description) || "场均数据最高",
    metricLabel: cleanString(board.metricLabel) || "场均",
    unit: cleanString(board.unit),
    precision: finiteNumber(board.precision, 1),
    minMatches: finiteNumber(board.minMatches, defaultMinMatches),
    winner,
    candidates,
  };
}

function normalizeHeroLeaderboardCandidate(
  candidate: Partial<HeroLeaderboardCandidate> | null | undefined,
): HeroLeaderboardCandidate | null {
  const player = candidate?.player;

  if (!player || !cleanString(player.id)) {
    return null;
  }

  const candidateTeams = safeArray(candidate.teams)
    .map(normalizeTeamBrief)
    .filter(isDefined);
  const playerTeams = safeArray(player.teams).map(normalizeTeamBrief).filter(isDefined);
  const teams = playerTeams.length > 0 ? playerTeams : candidateTeams;

  return {
    rank: finiteNumber(candidate.rank, 0),
    player: normalizePlayerListItem({
      ...player,
      currentTeam: normalizeTeamBrief(player.currentTeam) ?? teams[0] ?? null,
      teams,
    }),
    teams: candidateTeams,
    matches: finiteNumber(candidate.matches, 0),
    average: finiteNumber(candidate.average, 0),
    total: finiteNumber(candidate.total, 0),
  };
}

function normalizePlayerListItem(player: Partial<PlayerListItem>): PlayerListItem {
  const accountId = finiteNullableNumber(player.accountId);
  const id = cleanString(player.id) || String(accountId ?? "");
  const teams = safeArray(player.teams).map(normalizeTeamBrief).filter(isDefined);

  return {
    id,
    accountId,
    steamId64: cleanNullableString(player.steamId64),
    displayName: cleanString(player.displayName) || id || "未知选手",
    avatarUrl: normalizeSteamAvatarUrl({
      accountId,
      avatarUrl: cleanNullableString(player.avatarUrl),
    }),
    currentTeam: normalizeTeamBrief(player.currentTeam) ?? teams[0] ?? null,
    teams,
    stats: normalizePlayerStatsSummary(player.stats),
  };
}

function normalizePlayerStatsSummary(
  stats: Partial<PlayerStatsSummary> | null | undefined,
): PlayerStatsSummary {
  return {
    totalMatches: finiteNumber(stats?.totalMatches, 0),
    wins: finiteNumber(stats?.wins, 0),
    losses: finiteNumber(stats?.losses, 0),
    winRate: finiteNullableNumber(stats?.winRate),
    kda: finiteNullableNumber(stats?.kda),
    avgKills: finiteNullableNumber(stats?.avgKills),
    avgDeaths: finiteNullableNumber(stats?.avgDeaths),
    avgAssists: finiteNullableNumber(stats?.avgAssists),
    avgGpm: finiteNullableNumber(stats?.avgGpm),
    avgXpm: finiteNullableNumber(stats?.avgXpm),
    avgNetWorth: finiteNullableNumber(stats?.avgNetWorth),
    avgHeroDamage: finiteNullableNumber(stats?.avgHeroDamage),
    avgTowerDamage: finiteNullableNumber(stats?.avgTowerDamage),
    avgDamageTaken: finiteNullableNumber(stats?.avgDamageTaken),
    topHeroes: safeArray(stats?.topHeroes).map(normalizeHeroPickSummary),
  };
}

function normalizeHeroPickSummary(hero: Partial<HeroPickSummary>): HeroPickSummary {
  return {
    heroId: finiteNumber(hero.heroId, 0),
    picks: finiteNumber(hero.picks, 0),
    wins: finiteNumber(hero.wins, 0),
  };
}

function normalizeTeamBrief(team: Partial<TeamBrief> | null | undefined): TeamBrief | null {
  const id = cleanString(team?.id) || cleanString(team?.shortName) || cleanString(team?.name);
  const name = cleanString(team?.name) || cleanString(team?.shortName) || id;

  if (!id || !name) {
    return null;
  }

  const normalized: TeamBrief = { id, name };
  const shortName = cleanString(team?.shortName);
  const logoUrl = cleanNullableString(team?.logoUrl);
  const color = cleanString(team?.color);

  if (shortName) {
    normalized.shortName = shortName;
  }

  if (logoUrl !== null) {
    normalized.logoUrl = normalizeApiImageUrl(logoUrl);
  }

  if (color) {
    normalized.color = color;
  }

  return normalized;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value: unknown): string | null {
  const valueString = cleanString(value);

  return valueString || null;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function normalizeSteamAvatarUrl(player: {
  accountId?: number | null;
  avatarUrl?: string | null;
}): string | null {
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
