import type {
  AghanimState,
  BracketPreviewNode,
  ComparisonMetric,
  DraftStep,
  HeroPickSummary,
  IconRef,
  MatchRecord,
  MatchRecordHero,
  MatchData,
  OfficialScheduleStatus,
  PlayerDirectoryItem,
  PlayerProfile,
  PlayerStats,
  ProfileMatchSummary,
  ProfileStatsSummary,
  ScheduleGroup,
  ScheduleItem,
  StageKey,
  StageView,
  StandingRow,
  TalentTreeNode,
  TeamDirectoryItem,
  TeamInfo,
  TeamProfile,
  TeamSide,
  TrendCharts,
  TrendPoint,
  TournamentMeta,
  TournamentStat,
} from "./data";

export type TournamentOption = {
  id: string;
  name: string;
  note: string;
  status: TournamentMeta["status"];
  startsAt: string;
  leagueId: string;
  source: "api";
};

export type MobileData = {
  apiBaseUrl: string;
  source: "api" | "unavailable";
  selectedTournamentId: string;
  selectedTournamentName: string;
  selectedTournamentMeta: TournamentMeta;
  tournamentOptions: TournamentOption[];
  tournamentStats: TournamentStat[];
  stageViews: Record<StageKey, StageView>;
  scheduleGroups: ScheduleGroup[];
  officialSchedule: OfficialScheduleStatus;
  matchRecords: MatchRecord[];
  tournamentRecentRecords: Record<string, MatchRecord[]>;
  players: PlayerDirectoryItem[];
  teams: TeamDirectoryItem[];
  featuredMatch: MatchData;
  notice: string | null;
};

type ApiResult<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

type ApiTeam = {
  id?: string;
  name?: string;
  shortName?: string;
  short_name?: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  color?: string;
};

type ApiPlayerStatsSummary = {
  totalMatches?: number;
  wins?: number;
  losses?: number;
  winRate?: number | null;
  avgKills?: number | null;
  avgDeaths?: number | null;
  avgAssists?: number | null;
  kda?: number | null;
  avgGpm?: number | null;
  avgXpm?: number | null;
  avgNetWorth?: number | null;
  avgHeroDamage?: number | null;
  avgTowerDamage?: number | null;
  avgDamageTaken?: number | null;
  topHeroes?: ApiHeroPickSummary[];
};

type ApiHeroPickSummary = {
  heroId?: number;
  picks?: number;
  wins?: number;
};

type ApiPlayerDirectoryItem = {
  id?: string;
  accountId?: number | null;
  displayName?: string;
  avatarUrl?: string | null;
  currentTeam?: ApiTeam | null;
  teams?: ApiTeam[];
  stats?: ApiPlayerStatsSummary;
};

type ApiTeamStatsSummary = {
  seriesPlayed?: number;
  seriesWins?: number;
  seriesLosses?: number;
  gameWins?: number;
  gameLosses?: number;
  linkedMatches?: number;
  winRate?: number | null;
  topHeroes?: ApiHeroPickSummary[];
};

type ApiTeamDirectoryItem = ApiTeam & {
  seed?: number | null;
  status?: string;
  memberCount?: number;
  members?: ApiPlayerDirectoryItem[];
  stats?: ApiTeamStatsSummary;
};

type ApiProfileMatchSummary = {
  matchId?: number;
  startTime?: string | null;
  durationText?: string | null;
  radiantTeamName?: string;
  direTeamName?: string;
  radiantScore?: number | null;
  direScore?: number | null;
  side?: TeamSide | null;
  heroId?: number | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  result?: "win" | "loss" | "unknown";
};

type ApiPlayerProfile = ApiPlayerDirectoryItem & {
  tournamentId?: string;
  matches?: ApiProfileMatchSummary[];
};

type ApiTeamProfile = ApiTeamDirectoryItem & {
  matches?: ApiProfileMatchSummary[];
};

type ApiTournament = {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  league?: { name?: string; opendotaLeagueId?: number };
  season?: { name?: string };
  currentStage?: ApiStage;
  currentStageId?: string;
  startsAt?: string;
  endsAt?: string | null;
  teamCount?: number;
  stages?: ApiStage[];
  nextSeries?: ApiSeries | null;
  latestResult?: ApiSeries | null;
};

type ApiStage = {
  id: string;
  type?: StageKey;
  name?: string;
  status?: string;
  sortOrder?: number;
  advancementRule?: string;
  activeRound?: ApiRound | null;
};

type ApiRound = {
  id: string;
  stageId: string;
  roundNumber?: number;
  name?: string;
  status?: string;
  pairingStatus?: string;
  byes?: ApiTeam[];
  series?: ApiSeries[];
};

type ApiSeries = {
  id: string;
  roundId?: string;
  stageId?: string;
  groupId?: string | null;
  groupName?: string | null;
  seriesKind?: "regular" | "tiebreaker" | string;
  boType?: string;
  status?: string;
  scheduledAt?: string;
  radiantTeam?: ApiTeam;
  direTeam?: ApiTeam;
  radiantScore?: number;
  direScore?: number;
  winnerTeamId?: string | null;
  games?: Array<{
    gameIndex?: number;
    matchId?: number | string | null;
    radiantScore?: number | null;
    direScore?: number | null;
  }>;
};

type ApiBracketNode = {
  id: string;
  stageId?: string;
  bracketGroup?: "single" | "winner" | "loser" | "grand_final" | string;
  roundNumber?: number;
  roundName?: string;
  position?: number;
  status?: string;
  radiantTeam?: ApiTeam | null;
  direTeam?: ApiTeam | null;
  series?: ApiSeries | null;
  winnerTeamId?: string | null;
};

type ApiOfficialScheduleStatus = {
  status?: "unconfigured" | "draft" | "published" | "withdrawn" | string;
  isPublished?: boolean;
  rosterLocked?: boolean;
  publishedAt?: string | null;
  withdrawnAt?: string | null;
};

type ApiStanding = {
  rank?: number;
  team?: ApiTeam;
  seriesWins?: number;
  seriesDraws?: number;
  seriesLosses?: number;
  gameWins?: number;
  gameLosses?: number;
  points?: number;
  opponentScore?: number;
  status?: "advance" | "safe" | "eliminated";
};

type ApiMatchDetail = {
  match?: {
    matchId?: number;
    leagueName?: string;
    tournamentName?: string | null;
    stageName?: string | null;
    roundName?: string | null;
    radiantWin?: boolean;
    winnerSide?: TeamSide;
    durationText?: string;
    gameMode?: number | null;
    endedAt?: string | null;
  };
  series?: { boType?: string; gameIndex?: number } | null;
  teams?: Record<TeamSide, ApiTeam>;
  score?: {
    radiantScore?: number;
    direScore?: number;
    winnerSide?: TeamSide;
    winnerName?: string;
  };
  players?: {
    radiant?: ApiMatchPlayer[];
    dire?: ApiMatchPlayer[];
    all?: ApiMatchPlayer[];
  };
  mvp?: { playerSlot?: number; playerName?: string } | null;
  drafts?: ApiDraft[];
  vision?: { wards?: ApiWard[] };
  charts?: {
    hasTrends?: boolean;
    intervalSeconds?: number;
    goldAdvantage?: ApiTrendPoint[];
    xpAdvantage?: ApiTrendPoint[];
    playerGold?: ApiPlayerTrend[];
    playerXp?: ApiPlayerTrend[];
  };
  comparisons?: ApiComparisonMetric[];
  chat?: ApiChat[];
  parseStatus?: string;
};

type ApiMatchRecord = {
  matchId?: number;
  leagueName?: string;
  tournamentName?: string;
  startTime?: string | null;
  durationText?: string | null;
  radiantTeamName?: string;
  direTeamName?: string;
  radiantScore?: number | null;
  direScore?: number | null;
  radiantWin?: boolean | null;
  parseStatus?: string;
  playerCount?: number;
  heroLineups?: {
    radiant?: ApiMatchRecordHero[];
    dire?: ApiMatchRecordHero[];
  };
  hasDraft?: boolean;
  hasVision?: boolean;
  hasChat?: boolean;
};

type ApiMatchRecordHero = {
  playerSlot?: number;
  heroId?: number;
  playerName?: string;
};

type ApiMatchPlayer = {
  accountId?: number | null;
  playerSlot: number;
  side: TeamSide;
  team?: ApiTeam;
  name?: string;
  heroId?: number;
  level?: number | null;
  kills?: number;
  deaths?: number;
  assists?: number;
  killParticipation?: number | null;
  heroDamageShare?: number | null;
  goldPerMin?: number | null;
  xpPerMin?: number | null;
  netWorth?: number | null;
  lastHits?: number | null;
  denies?: number | null;
  heroDamage?: number | null;
  towerDamage?: number | null;
  heroHealing?: number | null;
  damageTaken?: number | null;
  lane?: number | null;
  laneRole?: number | null;
  items?: {
    inventory?: Array<{ slot?: number; itemId?: number | null }>;
    backpack?: Array<{ slot?: number; itemId?: number | null }>;
    neutral?: { itemId?: number | null } | null;
  };
  abilityBuild?: { hasData?: boolean; order?: Array<{ level?: number; abilityId?: number }> };
  aghanim?: { hasScepter?: boolean; hasShard?: boolean; scepterIconState?: string; shardIconState?: string };
};

type ApiDraft = {
  order?: number;
  action?: "pick" | "ban";
  side?: TeamSide | null;
  teamName?: string | null;
  heroId?: number;
  playerSlot?: number | null;
};

type ApiWard = {
  timeText?: string;
  timeSeconds?: number | null;
  time?: number | null;
  type?: "observer" | "sentry";
  side?: TeamSide | null;
  playerName?: string | null;
  x?: number | null;
  y?: number | null;
  removedAt?: number | null;
};

type ApiChat = {
  timeText?: string;
  side?: TeamSide | null;
  playerName?: string | null;
  unit?: string | null;
  message?: string;
};

type ApiTrendPoint = {
  minute?: number;
  value?: number;
};

type ApiPlayerTrend = {
  playerSlot?: number;
  playerName?: string;
  side?: TeamSide;
  heroId?: number;
  values?: number[];
};

type ApiComparisonMetric = {
  key?: string;
  label?: string;
  radiantValue?: number;
  direValue?: number;
  radiantShare?: number;
};

const defaultApiBaseUrl = "http://127.0.0.1:3001/api";
const localDotaConstantsBaseUrl = "/static/dota/constants";
const remoteDotaConstantsBaseUrl = "https://raw.githubusercontent.com/odota/dotaconstants/master/build";
const localDotaAssetBaseUrl = "/static/dota";
const dotaConstantsFetchTimeoutMs = 2500;
const SCHINESE_HERO_NAMES_BY_ID: Record<number, string> = {
  1: "敌法师",
  2: "斧王",
  3: "祸乱之源",
  4: "血魔",
  5: "水晶室女",
  6: "卓尔游侠",
  7: "撼地者",
  8: "主宰",
  9: "米拉娜",
  10: "变体精灵",
  11: "影魔",
  12: "幻影长矛手",
  13: "帕克",
  14: "帕吉",
  15: "雷泽",
  16: "沙王",
  17: "风暴之灵",
  18: "斯温",
  19: "小小",
  20: "复仇之魂",
  21: "风行者",
  22: "宙斯",
  23: "昆卡",
  25: "莉娜",
  26: "莱恩",
  27: "暗影萨满",
  28: "斯拉达",
  29: "潮汐猎人",
  30: "巫医",
  31: "巫妖",
  32: "力丸",
  33: "谜团",
  34: "修补匠",
  35: "狙击手",
  36: "瘟疫法师",
  37: "术士",
  38: "兽王",
  39: "痛苦女王",
  40: "剧毒术士",
  41: "虚空假面",
  42: "冥魂大帝",
  43: "死亡先知",
  44: "幻影刺客",
  45: "帕格纳",
  46: "圣堂刺客",
  47: "冥界亚龙",
  48: "露娜",
  49: "龙骑士",
  50: "戴泽",
  51: "发条技师",
  52: "拉席克",
  53: "自然先知",
  54: "噬魂鬼",
  55: "黑暗贤者",
  56: "克林克兹",
  57: "全能骑士",
  58: "魅惑魔女",
  59: "哈斯卡",
  60: "暗夜魔王",
  61: "育母蜘蛛",
  62: "赏金猎人",
  63: "编织者",
  64: "杰奇洛",
  65: "蝙蝠骑士",
  66: "陈",
  67: "幽鬼",
  68: "远古冰魄",
  69: "末日使者",
  70: "熊战士",
  71: "裂魂人",
  72: "矮人直升机",
  73: "炼金术士",
  74: "祈求者",
  75: "沉默术士",
  76: "殁境神蚀者",
  77: "狼人",
  78: "酒仙",
  79: "暗影恶魔",
  80: "独行德鲁伊",
  81: "混沌骑士",
  82: "米波",
  83: "树精卫士",
  84: "食人魔魔法师",
  85: "不朽尸王",
  86: "拉比克",
  87: "干扰者",
  88: "司夜刺客",
  89: "娜迦海妖",
  90: "光之守卫",
  91: "艾欧",
  92: "维萨吉",
  93: "斯拉克",
  94: "美杜莎",
  95: "巨魔战将",
  96: "半人马战行者",
  97: "马格纳斯",
  98: "伐木机",
  99: "钢背兽",
  100: "巨牙海民",
  101: "天怒法师",
  102: "亚巴顿",
  103: "上古巨神",
  104: "军团指挥官",
  105: "工程师",
  106: "灰烬之灵",
  107: "大地之灵",
  108: "孽主",
  109: "恐怖利刃",
  110: "凤凰",
  111: "神谕者",
  112: "寒冬飞龙",
  113: "天穹守望者",
  114: "齐天大圣",
  119: "邪影芳灵",
  120: "石鳞剑士",
  121: "天涯墨客",
  123: "森海飞霞",
  126: "虚无之灵",
  128: "电炎绝手",
  129: "玛尔斯",
  131: "百戏大王",
  135: "破晓辰星",
  136: "玛西",
  137: "獸",
  138: "琼英碧灵",
  145: "凯",
  155: "朗戈",
};

type DotaConstants = {
  heroes: Record<string, { localized_name?: string; name?: string; img?: string; icon?: string }>;
  itemIds: Record<string, string>;
  abilityIds: Record<string, string>;
  heroAbilities: Record<string, { talents?: Array<{ name?: string; level?: number }> }>;
};

let dotaConstants: DotaConstants = {
  heroes: {},
  itemIds: {},
  abilityIds: {},
  heroAbilities: {},
};
let dotaConstantsPromise: Promise<DotaConstants> | null = null;

export async function loadMobileData(tournamentId?: string): Promise<MobileData> {
  const apiBaseUrl = resolveApiBaseUrl();
  const constantsPromise = loadDotaConstants();
  const tournamentList = await fetchApi<ApiTournament[]>(apiBaseUrl, "/tournaments").catch(() => []);
  const selectedTournamentId = tournamentId ?? tournamentList[0]?.id ?? "";

  if (selectedTournamentId.length === 0) {
    return emptyMobileData(apiBaseUrl, "后端暂无真实赛事数据，请先初始化数据库并同步 OpenDota。", tournamentList);
  }

  const tournament = await fetchApi<ApiTournament>(apiBaseUrl, `/tournaments/${selectedTournamentId}`).catch(() => null);

  if (tournament === null) {
    return emptyMobileData(apiBaseUrl, "无法读取该赛事的真实数据。", tournamentList, selectedTournamentId);
  }

  const stages = tournament.stages?.length ? tournament.stages : [tournament.currentStage].filter(isDefined);
  const stagePayloads = await Promise.all(
    stages.map(async (stage) => {
      const [standings, rounds, bracket] = await Promise.all([
        fetchApi<ApiStanding[]>(apiBaseUrl, `/stages/${stage.id}/standings`).catch(() => null),
        fetchApi<ApiRound[]>(apiBaseUrl, `/stages/${stage.id}/rounds`).catch(() => null),
        fetchApi<ApiBracketNode[]>(apiBaseUrl, `/stages/${stage.id}/bracket`).catch(() => null),
      ]);

      return { stage, standings, rounds, bracket };
    }),
  );

  const officialSchedule = normalizeOfficialScheduleStatus(
    await fetchApi<ApiOfficialScheduleStatus>(apiBaseUrl, `/tournaments/${selectedTournamentId}/official-schedule`).catch(() => null),
  );
  const officialStagePayloads = officialSchedule.isPublished
    ? stagePayloads.filter(isOfficialScheduleStagePayload)
    : [];
  const scheduleGroups = officialSchedule.isPublished ? normalizeScheduleGroups(officialStagePayloads) : [];
  const matchRecords = await fetchApi<ApiMatchRecord[]>(
    apiBaseUrl,
    `/tournaments/${selectedTournamentId}/matches?limit=80`,
  ).catch(() => []);
  await constantsPromise;
  const normalizedRecords = matchRecords.map(normalizeMatchRecord);
  const tournamentRecentRecords = await loadTournamentRecentRecords(apiBaseUrl, tournamentList, selectedTournamentId, normalizedRecords);
  const matchId = findFeaturedMatchId(tournament, scheduleGroups, normalizedRecords);
  const matchDetail =
    matchId === null ? null : await fetchApi<ApiMatchDetail>(apiBaseUrl, `/matches/${matchId}`).catch(() => null);
  const match = matchDetail === null ? emptyMatchData(matchId ?? "-") : normalizeMatchDetail(matchDetail);

  return {
    apiBaseUrl,
    source: "api",
    selectedTournamentId,
    selectedTournamentName: tournament.name,
    selectedTournamentMeta: normalizeTournamentMeta(tournament),
    tournamentOptions: tournamentOptions(tournamentList),
    tournamentStats: normalizeTournamentStats(tournament, scheduleGroups, match, normalizedRecords),
    stageViews: normalizeStageViews(officialStagePayloads, officialSchedule),
    scheduleGroups,
    officialSchedule,
    matchRecords: normalizedRecords,
    tournamentRecentRecords,
    players: [],
    teams: [],
    featuredMatch: match,
    notice: matchDetail === null ? "该赛事暂无可展示的真实比赛详情。" : null,
  };
}

export async function loadTournamentPlayers(apiBaseUrl: string, tournamentId: string): Promise<PlayerDirectoryItem[]> {
  const [players] = await Promise.all([
    fetchApi<ApiPlayerDirectoryItem[]>(apiBaseUrl, `/tournaments/${encodeURIComponent(tournamentId)}/players`),
    loadDotaConstants(),
  ]);

  return players.map((player) => normalizePlayerDirectoryItem(player, apiBaseUrl));
}

export async function loadTournamentTeams(apiBaseUrl: string, tournamentId: string): Promise<TeamDirectoryItem[]> {
  const [teams] = await Promise.all([
    fetchApi<ApiTeamDirectoryItem[]>(apiBaseUrl, `/tournaments/${encodeURIComponent(tournamentId)}/teams`),
    loadDotaConstants(),
  ]);

  return teams.map((team) => normalizeTeamDirectoryItem(team, apiBaseUrl));
}

export async function loadMatchData(apiBaseUrl: string, matchId: string): Promise<MatchData> {
  const [matchDetail] = await Promise.all([
    fetchApi<ApiMatchDetail>(apiBaseUrl, `/matches/${matchId}`),
    loadDotaConstants(),
  ]);

  return normalizeMatchDetail(matchDetail);
}

export async function loadPlayerProfile(
  apiBaseUrl: string,
  tournamentId: string,
  playerId: string,
): Promise<PlayerProfile> {
  const [profile] = await Promise.all([
    fetchApi<ApiPlayerProfile>(
      apiBaseUrl,
      `/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}`,
    ),
    loadDotaConstants(),
  ]);

  return normalizePlayerProfile(profile, apiBaseUrl);
}

export async function loadTeamProfile(apiBaseUrl: string, tournamentId: string, teamId: string): Promise<TeamProfile> {
  const [profile] = await Promise.all([
    fetchApi<ApiTeamProfile>(
      apiBaseUrl,
      `/tournaments/${encodeURIComponent(tournamentId)}/teams/${encodeURIComponent(teamId)}`,
    ),
    loadDotaConstants(),
  ]);

  return normalizeTeamProfile(profile, apiBaseUrl);
}

function emptyMobileData(
  apiBaseUrl: string,
  notice: string,
  tournaments: ApiTournament[],
  selectedTournamentId = "",
): MobileData {
  return {
    apiBaseUrl,
    source: "unavailable",
    selectedTournamentId,
    selectedTournamentName: "暂无真实赛事",
    selectedTournamentMeta: {
      status: "unknown",
      statusText: "暂无真实数据",
      startsAt: "时间待定",
      endsAt: "时间待定",
      leagueId: "-",
    },
    tournamentOptions: tournamentOptions(tournaments),
    tournamentStats: [],
    stageViews: emptyStageViews(),
    scheduleGroups: [],
    officialSchedule: emptyOfficialScheduleStatus(),
    matchRecords: [],
    tournamentRecentRecords: {},
    players: [],
    teams: [],
    featuredMatch: emptyMatchData(),
    notice,
  };
}

async function loadTournamentRecentRecords(
  apiBaseUrl: string,
  tournaments: ApiTournament[],
  selectedTournamentId: string,
  selectedRecords: MatchRecord[],
): Promise<Record<string, MatchRecord[]>> {
  const entries = await Promise.all(
    tournaments.map(async (tournament) => {
      if (tournament.id === selectedTournamentId) {
        return [tournament.id, selectedRecords.slice(0, 3)] as const;
      }

      const records = await fetchApi<ApiMatchRecord[]>(
        apiBaseUrl,
        `/tournaments/${encodeURIComponent(tournament.id)}/matches?limit=3`,
      ).catch(() => []);

      return [tournament.id, records.map(normalizeMatchRecord)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

async function fetchApi<T>(apiBaseUrl: string, path: string): Promise<T> {
  const response = await fetch(apiUrl(apiBaseUrl, path), { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ApiResult<T> | T;

  if (isApiResult<T>(payload)) {
    if (!payload.success) {
      throw new Error(payload.error?.message ?? "API request failed");
    }

    return payload.data;
  }

  return payload;
}

async function loadDotaConstants(): Promise<DotaConstants> {
  if (dotaConstantsPromise !== null) {
    return dotaConstantsPromise;
  }

  dotaConstantsPromise = Promise.all([
    fetchOpenDotaConstant<DotaConstants["heroes"]>("heroes").catch(() => dotaConstants.heroes),
    fetchOpenDotaConstant<DotaConstants["itemIds"]>("item_ids").catch(() => dotaConstants.itemIds),
    fetchOpenDotaConstant<DotaConstants["abilityIds"]>("ability_ids").catch(() => dotaConstants.abilityIds),
    fetchOpenDotaConstant<DotaConstants["heroAbilities"]>("hero_abilities").catch(() => dotaConstants.heroAbilities),
  ])
    .then(([heroes, itemIds, abilityIds, heroAbilities]) => {
      dotaConstants = { heroes, itemIds, abilityIds, heroAbilities };
      if (Object.keys(heroes).length === 0) {
        dotaConstantsPromise = null;
      }
      return dotaConstants;
    })
    .catch(() => {
      dotaConstantsPromise = null;
      return dotaConstants;
    });

  return dotaConstantsPromise;
}

async function fetchOpenDotaConstant<T>(path: string): Promise<T> {
  const localResponse = await fetchWithTimeout(`${localDotaConstantsBaseUrl}/${path}.json`, dotaConstantsFetchTimeoutMs).catch(
    () => null,
  );

  if (localResponse?.ok) {
    return (await localResponse.json()) as T;
  }

  const env = import.meta.env as Record<string, string | undefined>;
  if (env.VITE_ALLOW_REMOTE_DOTA_CONSTANTS !== "1") {
    throw new Error(`Local Dota constants missing: ${path}`);
  }

  const response = await fetchWithTimeout(`${remoteDotaConstantsBaseUrl}/${path}.json`, dotaConstantsFetchTimeoutMs);

  if (!response.ok) {
    throw new Error(`OpenDota constants HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function apiUrl(apiBaseUrl: string, path: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  const normalizedPath = base.endsWith("/api") && cleanPath.startsWith("api/") ? cleanPath.slice(4) : cleanPath;

  return `${base}/${normalizedPath}`;
}

function resolveApiBaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.PUBLIC_API_BASE_URL ?? env.VITE_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl;
}

function normalizeTournamentStats(
  tournament: ApiTournament,
  groups: ScheduleGroup[],
  match: MatchData,
  matchRecords: MatchRecord[] = [],
): TournamentStat[] {
  const totalSeries = groups.reduce((sum, group) => sum + group.matches.length, 0);
  const completedSeries = groups.reduce(
    (sum, group) => sum + group.matches.filter((item) => item.status === "已完赛").length,
    0,
  );
  const nextMatch = groups.flatMap((group) => group.matches).find((item) => item.status !== "已完赛");

  return [
    { label: "当前赛事", value: tournament.name, hint: lifecycleText(tournament) },
    { label: "队伍数", value: String(tournament.teamCount ?? "-"), hint: tournament.league?.name ?? "MRJZ 联赛" },
    { label: "比赛库", value: String(matchRecords.length || "-"), hint: `已落库 ${matchRecords.length} 场` },
    { label: "赛程", value: String(totalSeries || "-"), hint: `已完赛 ${completedSeries} 场` },
    { label: "最新比赛", value: match.id, hint: nextMatch ? `${nextMatch.time} ${nextMatch.round}` : "暂无下一场" },
  ];
}

function normalizeMatchRecord(record: ApiMatchRecord): MatchRecord {
  return {
    matchId: String(record.matchId ?? "-"),
    leagueName: record.leagueName?.trim() || "OpenDota League",
    tournamentName: record.tournamentName ?? "MRJZ",
    startTime: formatMaybeDateTime(record.startTime) ?? "时间待定",
    duration: record.durationText ?? "--:--",
    radiantTeamName: record.radiantTeamName ?? "天辉",
    direTeamName: record.direTeamName ?? "夜魇",
    radiantScore: record.radiantScore ?? null,
    direScore: record.direScore ?? null,
    radiantWin: record.radiantWin ?? null,
    parseStatus: parseStatusText(record.parseStatus),
    playerCount: record.playerCount ?? 0,
    heroLineups: {
      radiant: normalizeRecordHeroLineup(record.heroLineups?.radiant),
      dire: normalizeRecordHeroLineup(record.heroLineups?.dire),
    },
    hasDraft: Boolean(record.hasDraft),
    hasVision: Boolean(record.hasVision),
    hasChat: Boolean(record.hasChat),
  };
}

function normalizeRecordHeroLineup(lineup: ApiMatchRecordHero[] | undefined): MatchRecordHero[] {
  return (lineup ?? [])
    .map((hero) => {
      if (typeof hero.heroId !== "number" || hero.heroId <= 0) {
        return null;
      }

      const heroName = heroLabel(hero.heroId);

      return {
        playerSlot: hero.playerSlot ?? 0,
        heroId: hero.heroId,
        hero: heroName,
        icon: heroIcon(hero.heroId),
        portrait: heroPortrait(hero.heroId),
        playerName: hero.playerName?.trim() || heroName,
      };
    })
    .filter(isDefined)
    .sort((left, right) => left.playerSlot - right.playerSlot)
    .slice(0, 5);
}

function normalizeTeamBrief(team: ApiTeam | null | undefined): TeamDirectoryItem["members"][number]["currentTeam"] {
  if (!team?.id) {
    return null;
  }

  return {
    id: team.id,
    name: team.name ?? team.shortName ?? team.short_name ?? "未命名队伍",
    shortName: team.shortName ?? team.short_name ?? team.name ?? "TEAM",
    logoUrl: team.logoUrl ?? team.logo_url ?? null,
    color: team.color ?? "#64748b",
  };
}

function normalizeHeroPickSummary(hero: ApiHeroPickSummary): HeroPickSummary {
  const heroId = hero.heroId ?? 0;

  return {
    heroId,
    hero: heroLabel(heroId),
    icon: heroIcon(heroId),
    portrait: heroPortrait(heroId),
    picks: hero.picks ?? 0,
    wins: hero.wins ?? 0,
  };
}

function normalizeProfileStats(stats: ApiPlayerStatsSummary | undefined): ProfileStatsSummary {
  return {
    totalMatches: stats?.totalMatches ?? 0,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    winRate: percentOrDash(stats?.winRate),
    kda: numberOrDash(stats?.kda, 2),
    avgKills: numberOrDash(stats?.avgKills, 1),
    avgDeaths: numberOrDash(stats?.avgDeaths, 1),
    avgAssists: numberOrDash(stats?.avgAssists, 1),
    avgGpm: numberOrDash(stats?.avgGpm, 0),
    avgXpm: numberOrDash(stats?.avgXpm, 0),
    avgNetWorth: compactNumberOrDash(stats?.avgNetWorth),
    avgHeroDamage: compactNumberOrDash(stats?.avgHeroDamage),
    avgTowerDamage: compactNumberOrDash(stats?.avgTowerDamage),
    avgDamageTaken: compactNumberOrDash(stats?.avgDamageTaken),
    topHeroes: (stats?.topHeroes ?? []).map(normalizeHeroPickSummary),
  };
}

function normalizePlayerDirectoryItem(player: ApiPlayerDirectoryItem, apiBaseUrl?: string): PlayerDirectoryItem {
  const accountId = player.accountId ?? null;

  return {
    id: player.id ?? "player_unknown",
    accountId,
    displayName: player.displayName ?? "未命名选手",
    avatarUrl:
      accountId !== null && apiBaseUrl !== undefined
        ? apiUrl(apiBaseUrl, `/assets/steam-avatars/${accountId}.jpg`)
        : player.avatarUrl ?? null,
    currentTeam: normalizeTeamBrief(player.currentTeam),
    teams: (player.teams ?? []).map(normalizeTeamBrief).filter(isDefined),
    stats: normalizeProfileStats(player.stats),
  };
}

function normalizeTeamStats(stats: ApiTeamStatsSummary | undefined): TeamDirectoryItem["stats"] {
  return {
    seriesPlayed: stats?.seriesPlayed ?? 0,
    seriesWins: stats?.seriesWins ?? 0,
    seriesLosses: stats?.seriesLosses ?? 0,
    gameWins: stats?.gameWins ?? 0,
    gameLosses: stats?.gameLosses ?? 0,
    linkedMatches: stats?.linkedMatches ?? 0,
    winRate: percentOrDash(stats?.winRate),
    topHeroes: (stats?.topHeroes ?? []).map(normalizeHeroPickSummary),
  };
}

function normalizeTeamDirectoryItem(team: ApiTeamDirectoryItem, apiBaseUrl?: string): TeamDirectoryItem {
  const brief = normalizeTeamBrief(team);

  return {
    id: brief?.id ?? "team_unknown",
    name: brief?.name ?? "未命名队伍",
    shortName: brief?.shortName ?? "TEAM",
    logoUrl: brief?.logoUrl ?? null,
    color: brief?.color ?? "#64748b",
    seed: team.seed ?? null,
    status: team.status ?? "active",
    memberCount: team.memberCount ?? team.members?.length ?? 0,
    members: (team.members ?? []).map((player) => normalizePlayerDirectoryItem(player, apiBaseUrl)),
    stats: normalizeTeamStats(team.stats),
  };
}

function normalizeProfileMatch(match: ApiProfileMatchSummary): ProfileMatchSummary {
  const score =
    match.radiantScore === null || match.radiantScore === undefined || match.direScore === null || match.direScore === undefined
      ? "-:-"
      : `${match.radiantScore}:${match.direScore}`;
  const heroId = match.heroId ?? null;
  const kda =
    match.kills === null || match.kills === undefined || match.deaths === null || match.deaths === undefined || match.assists === null || match.assists === undefined
      ? null
      : `${match.kills}/${match.deaths}/${match.assists}`;

  return {
    matchId: String(match.matchId ?? "-"),
    startTime: formatMaybeDateTime(match.startTime) ?? "时间待定",
    duration: match.durationText ?? "--:--",
    radiantTeamName: match.radiantTeamName ?? "天辉",
    direTeamName: match.direTeamName ?? "夜魇",
    score,
    side: match.side ?? null,
    hero: heroId === null ? null : heroLabel(heroId),
    heroPortrait: heroId === null ? null : heroPortrait(heroId),
    kda,
    result: match.result ?? "unknown",
  };
}

function normalizePlayerProfile(profile: ApiPlayerProfile, apiBaseUrl?: string): PlayerProfile {
  return {
    ...normalizePlayerDirectoryItem(profile, apiBaseUrl),
    tournamentId: profile.tournamentId ?? "",
    matches: (profile.matches ?? []).map(normalizeProfileMatch),
  };
}

function normalizeTeamProfile(profile: ApiTeamProfile, apiBaseUrl?: string): TeamProfile {
  return {
    ...normalizeTeamDirectoryItem(profile, apiBaseUrl),
    matches: (profile.matches ?? []).map(normalizeProfileMatch),
  };
}

function normalizeTournamentMeta(tournament: ApiTournament): TournamentMeta {
  return {
    status: normalizeTournamentStatus(tournament.status),
    statusText: lifecycleText(tournament),
    startsAt: shortDateTime(tournament.startsAt),
    endsAt: shortDateTime(tournament.endsAt),
    leagueId: tournament.league?.opendotaLeagueId ? String(tournament.league.opendotaLeagueId) : "-",
  };
}

function normalizeStageViews(
  payloads: Array<{ stage: ApiStage; standings: ApiStanding[] | null; rounds: ApiRound[] | null; bracket: ApiBracketNode[] | null }>,
  officialSchedule: OfficialScheduleStatus,
): Record<StageKey, StageView> {
  if (!officialSchedule.isPublished) {
    return unpublishedStageViews();
  }

  const next = emptyStageViews();

  for (const payload of payloads) {
    const stageKey = toStageKey(payload.stage.type);

    if (stageKey === null) {
      continue;
    }

    const activeRound = payload.stage.activeRound ?? payload.rounds?.find((round) => round.status !== "completed") ?? null;

    next[stageKey] = {
      key: stageKey,
      name: payload.stage.name ?? next[stageKey].name,
      status: statusText(payload.stage.status ?? "published"),
      currentRound: activeRound?.name ?? next[stageKey].currentRound,
      note: payload.stage.advancementRule ?? next[stageKey].note,
      standings: payload.standings?.map(normalizeStanding).sort((a, b) => a.rank - b.rank) ?? [],
      bracket: payload.bracket?.map(normalizeBracketNode) ?? [],
    };
  }

  return next;
}

function isOfficialScheduleStagePayload(payload: { stage: ApiStage }): boolean {
  return payload.stage.name !== "真实比赛记录";
}

function unpublishedStageViews(): Record<StageKey, StageView> {
  const next = emptyStageViews();

  for (const view of Object.values(next)) {
    view.status = "赛程暂未发布";
    view.note = "管理员发布官方赛程后，这里会展示真实阶段和排名。";
  }

  return next;
}

function emptyStageViews(): Record<StageKey, StageView> {
  return {
    group: {
      key: "group",
      name: "小组赛",
      status: "暂无真实阶段数据",
      currentRound: "暂无轮次",
      note: "管理员尚未录入小组赛阶段。",
      standings: [],
      bracket: [],
    },
    swiss: {
      key: "swiss",
      name: "瑞士轮",
      status: "暂无真实阶段数据",
      currentRound: "暂无轮次",
      note: "管理员尚未录入瑞士轮阶段。",
      standings: [],
      bracket: [],
    },
    knockout: {
      key: "knockout",
      name: "淘汰赛",
      status: "暂无真实阶段数据",
      currentRound: "暂无轮次",
      note: "管理员尚未录入淘汰赛阶段。",
      standings: [],
      bracket: [],
    },
  };
}

function normalizeOfficialScheduleStatus(status: ApiOfficialScheduleStatus | null): OfficialScheduleStatus {
  return {
    status: status?.status ?? "unconfigured",
    isPublished: status?.isPublished === true,
    rosterLocked: status?.rosterLocked === true,
    publishedAt: status?.publishedAt ?? null,
    withdrawnAt: status?.withdrawnAt ?? null,
  };
}

function emptyOfficialScheduleStatus(): OfficialScheduleStatus {
  return {
    status: "unconfigured",
    isPublished: false,
    rosterLocked: false,
    publishedAt: null,
    withdrawnAt: null,
  };
}

function normalizeStanding(row: ApiStanding): StandingRow {
  const wins = row.seriesWins ?? 0;
  const draws = row.seriesDraws ?? 0;
  const losses = row.seriesLosses ?? 0;

  return {
    rank: row.rank ?? 0,
    team: row.team?.name ?? "待定队伍",
    score: draws > 0 ? `${wins}-${draws}-${losses}` : `${wins}-${losses}`,
    points: `${row.points ?? 0} 分`,
    streak: `${row.gameWins ?? 0}-${row.gameLosses ?? 0}`,
    status: row.status === "advance" ? "晋级区" : row.status === "eliminated" ? "淘汰区" : "观察区",
  };
}

function normalizeBracketNode(node: ApiBracketNode): BracketPreviewNode {
  const topTeam = node.radiantTeam ?? node.series?.radiantTeam ?? null;
  const bottomTeam = node.direTeam ?? node.series?.direTeam ?? null;
  const winnerId = node.winnerTeamId ?? null;
  const winner =
    winnerId === topTeam?.id
      ? topTeam.name ?? "待定"
      : winnerId === bottomTeam?.id
        ? bottomTeam.name ?? "待定"
        : "待定";

  return {
    roundName: node.roundName ?? `第 ${node.roundNumber ?? "-"} 轮`,
    groupName: bracketGroupText(node.bracketGroup),
    position: node.position ?? 0,
    topTeam: topTeam?.name ?? "待定",
    bottomTeam: bottomTeam?.name ?? "待定",
    winner,
    status: node.winnerTeamId ? "已完赛" : node.status === "scheduled" ? "待开赛" : "待定",
  };
}

function normalizeScheduleGroups(
  payloads: Array<{ stage: ApiStage; rounds: ApiRound[] | null }>,
): ScheduleGroup[] {
  const items = payloads.flatMap((payload) =>
    (payload.rounds ?? []).flatMap((round) => [
      ...(round.series ?? []).map((series) => normalizeScheduleItem(payload.stage, round, series)),
      ...(round.byes ?? []).map((team) => normalizeByeScheduleItem(payload.stage, round, team)),
    ].filter(isDefined)),
  );
  const byDate = new Map<string, ScheduleItem[]>();

  for (const item of items) {
    const key = item.time.includes("-") ? "待定日期" : item.timeDate;
    const { timeDate: _timeDate, ...cleanItem } = item;
    byDate.set(key, [...(byDate.get(key) ?? []), cleanItem]);
  }

  return [...byDate.entries()].map(([date, matches]) => ({
    date,
    label: dateLabel(date),
    matches,
  }));
}

function normalizeScheduleItem(stage: ApiStage, round: ApiRound, series: ApiSeries): (ScheduleItem & { timeDate: string }) | null {
  const scheduledAt = series.scheduledAt ? new Date(series.scheduledAt) : null;
  const date = scheduledAt === null || Number.isNaN(scheduledAt.getTime()) ? "待定日期" : formatDate(scheduledAt);
  const time = scheduledAt === null || Number.isNaN(scheduledAt.getTime()) ? "--:--" : formatTime(scheduledAt);
  const firstGame = series.games?.find((game) => game.matchId !== null && game.matchId !== undefined);
  const gameScore =
    firstGame?.radiantScore !== null && firstGame?.radiantScore !== undefined
      ? `${firstGame.radiantScore} : ${firstGame.direScore ?? 0}`
      : undefined;

  const item: ScheduleItem & { timeDate: string } = {
    time,
    timeDate: date,
    stage: stage.name ?? stageNameFromId(series.stageId ?? round.stageId),
    round: [series.groupName, round.name ?? `R${round.roundNumber ?? "-"}`].filter(Boolean).join(" · "),
    kind: series.seriesKind ?? "regular",
    teamA: series.radiantTeam?.name ?? "待定",
    teamB: series.direTeam?.name ?? "待定",
    bo: series.boType ?? "BO1",
    status: seriesStatusText(series.status),
  };

  if (series.status === "completed") {
    item.score = `${series.radiantScore ?? 0} : ${series.direScore ?? 0}`;
  } else if (gameScore !== undefined) {
    item.score = gameScore;
  }

  if (firstGame?.matchId !== null && firstGame?.matchId !== undefined) {
    item.matchId = String(firstGame.matchId);
  }

  return item;
}

function normalizeByeScheduleItem(stage: ApiStage, round: ApiRound, team: ApiTeam): ScheduleItem & { timeDate: string } {
  return {
    time: "--:--",
    timeDate: "待定日期",
    stage: stage.name ?? stageNameFromId(round.stageId),
    round: round.name ?? `R${round.roundNumber ?? "-"}`,
    kind: "regular",
    teamA: team.name ?? "待定",
    teamB: "轮空",
    bo: "BYE",
    status: "已完赛",
    score: "轮空胜",
  };
}

function normalizeMatchDetail(detail: ApiMatchDetail): MatchData {
  const matchId = String(detail.match?.matchId ?? "-");
  const players = [...(detail.players?.radiant ?? []), ...(detail.players?.dire ?? detail.players?.all ?? [])];
  const normalizedPlayers = players.map(normalizePlayer);
  const mvpId = findMvpPlayerId(detail, normalizedPlayers);

  return {
    id: matchId,
    league: detail.match?.tournamentName ?? detail.match?.leagueName ?? "真实比赛",
    series: [detail.match?.stageName, detail.match?.roundName, detail.series?.gameIndex ? `G${detail.series.gameIndex}` : ""]
      .filter(Boolean)
      .join(" · "),
    mode: detail.series?.boType ?? modeText(detail.match?.gameMode) ?? "未知模式",
    endedAt: formatMaybeDateTime(detail.match?.endedAt) ?? "时间待定",
    duration: detail.match?.durationText ?? "--:--",
    radiantScore: detail.score?.radiantScore ?? 0,
    direScore: detail.score?.direScore ?? 0,
    winner: detail.score?.winnerSide ?? detail.match?.winnerSide ?? (detail.match?.radiantWin ? "radiant" : "dire"),
    radiant: normalizeTeam("radiant", detail.teams?.radiant, "天辉"),
    dire: normalizeTeam("dire", detail.teams?.dire, "夜魇"),
    mvpPlayerId: mvpId,
    parseStatus: parseStatusText(detail.parseStatus),
    players: normalizedPlayers,
    draft: (detail.drafts ?? []).map(normalizeDraft).filter(isDefined),
    wardTimeline: (detail.vision?.wards ?? []).map(normalizeWard).filter(isDefined),
    trends: normalizeTrendCharts(detail.charts),
    comparisons: (detail.comparisons ?? []).map(normalizeComparisonMetric).filter(isDefined),
    chat: (detail.chat ?? []).map(normalizeChat).filter(isDefined),
  };
}

function normalizePlayer(player: ApiMatchPlayer): PlayerStats {
  const heroName = heroLabel(player.heroId);
  const abilityOrder =
    player.abilityBuild?.order?.map((item, index) => abilityIcon(item.abilityId, item.level ?? index + 1)) ?? [
      emptyIcon("待解析"),
    ];

  return {
    id: String(player.playerSlot),
    side: player.side,
    name: player.name ?? `玩家 ${player.playerSlot}`,
    hero: heroName,
    heroShort: heroName,
    portrait: heroPortrait(player.heroId),
    lane: laneRoleText(player.laneRole),
    level: player.level ?? 0,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    assists: player.assists ?? 0,
    participation: percentText(player.killParticipation),
    damageShare: percentText(player.heroDamageShare),
    gpm: player.goldPerMin ?? 0,
    xpm: player.xpPerMin ?? 0,
    netWorth: compactNumber(player.netWorth),
    lastHits: player.lastHits ?? 0,
    denies: player.denies ?? 0,
    heroDamage: compactNumber(player.heroDamage),
    towerDamage: compactNumber(player.towerDamage),
    healing: compactNumber(player.heroHealing),
    damageTaken: compactNumber(player.damageTaken),
    items: normalizeInventoryItems(player.items?.inventory, 6),
    backpackItems: normalizeInventoryItems(player.items?.backpack, 3),
    neutralItem: itemIcon(player.items?.neutral?.itemId),
    scepter: aghanimState(player.aghanim?.hasScepter),
    shard: aghanimState(player.aghanim?.hasShard),
    abilityOrder,
    talentTree: normalizeTalentTree(heroInternalName(player.heroId), abilityOrder),
    tags: [],
  };
}

function normalizeInventoryItems(
  items: Array<{ slot?: number; itemId?: number | null }> | undefined,
  size: number,
): IconRef[] {
  const slots = Array.from({ length: size }, () => emptyIcon("-"));

  for (const [index, item] of (items ?? []).entries()) {
    const slot = typeof item.slot === "number" && item.slot >= 0 && item.slot < size ? item.slot : index;

    if (slot < size) {
      slots[slot] = itemIcon(item.itemId);
    }
  }

  return slots;
}

function normalizeTalentTree(heroKey: string | null, abilityOrder: IconRef[]): TalentTreeNode[] {
  const pickedTalents = new Map<string, number>();

  for (const ability of abilityOrder) {
    if (ability.kind === "talent" && ability.key !== undefined) {
      pickedTalents.set(ability.key, ability.level ?? 0);
    }
  }

  const heroTalents = heroKey === null ? [] : (dotaConstants.heroAbilities[heroKey]?.talents ?? []);

  if (heroTalents.length === 0) {
    return fallbackTalentTree(pickedTalents);
  }

  return ([4, 3, 2, 1] as const).flatMap((tier) => {
    const talentsForTier = heroTalents.filter((talent) => talent.level === tier).slice(0, 2);

    return (["left", "right"] as const).map((side, index) => {
      const talent = talentsForTier[index];
      const key = talent?.name;
      const pickedLevel = key === undefined ? undefined : pickedTalents.get(key);

      return {
        tier,
        side,
        picked: pickedLevel !== undefined,
        label: abilityLabelByName(key),
        ...(pickedLevel === undefined ? {} : { level: pickedLevel }),
      };
    });
  });
}

function fallbackTalentTree(pickedTalents: Map<string, number>): TalentTreeNode[] {
  const pickedEntries = [...pickedTalents.entries()];
  let cursor = 0;

  return ([4, 3, 2, 1] as const).flatMap((tier) =>
    (["left", "right"] as const).map((side) => {
      const entry = pickedEntries[cursor];
      const shouldPick = entry !== undefined && cursor < pickedEntries.length;
      cursor += 1;

      return {
        tier,
        side,
        picked: shouldPick,
        label: shouldPick ? abilityLabelByName(entry?.[0]) : "天赋",
        ...(entry?.[1] === undefined ? {} : { level: entry[1] }),
      };
    }),
  );
}

function normalizeTeam(side: TeamSide, team: ApiTeam | undefined, fallbackName: string): TeamInfo {
  return {
    side,
    name: team?.name ?? fallbackName,
    shortName: team?.shortName ?? team?.short_name ?? fallbackName.slice(0, 3),
    seed: side === "radiant" ? "天辉" : "夜魇",
    color: team?.color ?? (side === "radiant" ? "#78d66c" : "#ef6467"),
  };
}

function normalizeDraft(draft: ApiDraft): DraftStep | null {
  if (draft.order === undefined || draft.side === null || draft.side === undefined) {
    return null;
  }

  return {
    order: draft.order,
    side: draft.side,
    type: draft.action === "ban" ? "Ban" : "Pick",
    hero: heroLabel(draft.heroId),
    portrait: heroPortrait(draft.heroId),
    actor: draft.teamName ?? "未知队伍",
  };
}

function normalizeWard(ward: ApiWard): MatchData["wardTimeline"][number] | null {
  if (ward.side === null || ward.side === undefined) {
    return null;
  }

  return {
    time: ward.timeText ?? "--:--",
    timeSeconds: normalizeWardTimeSeconds(ward),
    side: ward.side,
    type: ward.type === "sentry" ? "岗哨守卫" : "观察守卫",
    lane: ward.x !== null && ward.x !== undefined && ward.y !== null && ward.y !== undefined ? `${ward.x}, ${ward.y}` : "地图",
    note: ward.playerName ?? "视野事件",
    x: ward.x ?? null,
    y: ward.y ?? null,
    removedAt: ward.removedAt ?? null,
  };
}

function normalizeWardTimeSeconds(ward: ApiWard): number {
  if (typeof ward.timeSeconds === "number") {
    return ward.timeSeconds;
  }

  if (typeof ward.time === "number") {
    return ward.time;
  }

  return parseClockText(ward.timeText);
}

function parseClockText(value: string | null | undefined): number {
  const parts = String(value ?? "")
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 60 + parts[1]!);
  }

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  }

  return 0;
}

function normalizeTrendCharts(charts: ApiMatchDetail["charts"]): TrendCharts {
  return {
    hasTrends: Boolean(charts?.hasTrends),
    goldAdvantage: (charts?.goldAdvantage ?? []).map(normalizeTrendPoint).filter(isDefined),
    xpAdvantage: (charts?.xpAdvantage ?? []).map(normalizeTrendPoint).filter(isDefined),
    playerGold: (charts?.playerGold ?? []).map(normalizePlayerTrend).filter(isDefined),
    playerXp: (charts?.playerXp ?? []).map(normalizePlayerTrend).filter(isDefined),
  };
}

function normalizeTrendPoint(point: ApiTrendPoint): TrendPoint | null {
  if (typeof point.minute !== "number" || typeof point.value !== "number") {
    return null;
  }

  return {
    minute: point.minute,
    value: point.value,
  };
}

function normalizePlayerTrend(trend: ApiPlayerTrend): TrendCharts["playerGold"][number] | null {
  if (
    typeof trend.playerSlot !== "number" ||
    typeof trend.playerName !== "string" ||
    (trend.side !== "radiant" && trend.side !== "dire") ||
    !Array.isArray(trend.values)
  ) {
    return null;
  }

  return {
    playerSlot: trend.playerSlot,
    playerName: trend.playerName,
    side: trend.side,
    heroId: trend.heroId ?? 0,
    values: trend.values.filter((value): value is number => typeof value === "number"),
  };
}

function normalizeComparisonMetric(metric: ApiComparisonMetric): ComparisonMetric | null {
  if (
    typeof metric.key !== "string" ||
    typeof metric.label !== "string" ||
    typeof metric.radiantValue !== "number" ||
    typeof metric.direValue !== "number"
  ) {
    return null;
  }

  return {
    key: metric.key,
    label: metric.label,
    radiantValue: metric.radiantValue,
    direValue: metric.direValue,
    radiantShare: typeof metric.radiantShare === "number" ? metric.radiantShare : 0.5,
  };
}

function emptyMatchData(matchId = "-"): MatchData {
  return {
    id: matchId,
    league: "暂无真实比赛详情",
    series: "",
    mode: "未知模式",
    endedAt: "时间待定",
    duration: "--:--",
    radiantScore: 0,
    direScore: 0,
    winner: "radiant",
    radiant: normalizeTeam("radiant", undefined, "天辉"),
    dire: normalizeTeam("dire", undefined, "夜魇"),
    mvpPlayerId: "",
    parseStatus: "暂无数据",
    players: [],
    draft: [],
    wardTimeline: [],
    trends: {
      hasTrends: false,
      goldAdvantage: [],
      xpAdvantage: [],
      playerGold: [],
      playerXp: [],
    },
    comparisons: [],
    chat: [],
  };
}

function normalizeChat(chat: ApiChat): MatchData["chat"][number] | null {
  if (!chat.message) {
    return null;
  }

  return {
    time: chat.timeText ?? "--:--",
    side: chat.side ?? "radiant",
    player: chat.playerName ?? "匿名玩家",
    hero: heroLabelFromUnit(chat.unit),
    text: chat.message,
  };
}

function tournamentOptions(tournaments: ApiTournament[]): TournamentOption[] {
  return tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    note: tournament.league?.opendotaLeagueId
      ? `${lifecycleText(tournament)} · OpenDota League ${tournament.league.opendotaLeagueId}`
      : (tournament.season?.name ?? tournament.status ?? "API 赛事"),
    status: normalizeTournamentStatus(tournament.status),
    startsAt: shortDateTime(tournament.startsAt),
    leagueId: tournament.league?.opendotaLeagueId ? String(tournament.league.opendotaLeagueId) : "-",
    source: "api" as const,
  }));
}

function normalizeTournamentStatus(status: string | undefined): TournamentMeta["status"] {
  if (
    status === "draft" ||
    status === "upcoming" ||
    status === "running" ||
    status === "completed" ||
    status === "archived"
  ) {
    return status;
  }

  return "unknown";
}

function findFeaturedMatchId(tournament: ApiTournament, groups: ScheduleGroup[], records: MatchRecord[]): string | null {
  if (records.length > 0) {
    return records[0]!.matchId;
  }

  const fromTournament = [...(tournament.latestResult?.games ?? []), ...(tournament.nextSeries?.games ?? [])].find(
    (game) => game.matchId !== null && game.matchId !== undefined,
  )?.matchId;

  if (fromTournament !== null && fromTournament !== undefined) {
    return String(fromTournament);
  }

  return groups.flatMap((group) => group.matches).find((match) => match.matchId)?.matchId ?? null;
}

function findMvpPlayerId(detail: ApiMatchDetail, players: PlayerStats[]): string {
  if (detail.mvp?.playerSlot !== undefined) {
    return String(detail.mvp.playerSlot);
  }

  const namedMvp = players.find((player) => player.name === detail.mvp?.playerName);
  if (namedMvp) {
    return namedMvp.id;
  }

  return players.slice().sort((a, b) => b.kills + b.assists - (a.kills + a.assists))[0]?.id ?? "";
}

function toStageKey(value: string | undefined): StageKey | null {
  return value === "group" || value === "swiss" || value === "knockout" ? value : null;
}

function statusText(status: string): string {
  const text: Record<string, string> = {
    draft: "草稿",
    upcoming: "即将开始",
    published: "已发布",
    running: "进行中",
    locked: "已锁定",
    completed: "已完成",
  };

  return text[status] ?? status;
}

function lifecycleText(tournament: ApiTournament): string {
  if (tournament.status === "upcoming") {
    return `即将开始 ${shortDateTime(tournament.startsAt)}`;
  }

  if (tournament.status === "running") {
    return `正在进行 · ${shortDateTime(tournament.startsAt)} 开赛`;
  }

  if (tournament.status === "completed") {
    return `已结束 · ${shortDateTime(tournament.endsAt ?? tournament.startsAt)}`;
  }

  return tournament.season?.name ?? statusText(tournament.status ?? "published");
}

function shortDateTime(value: string | null | undefined): string {
  if (!value) {
    return "时间待定";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function seriesStatusText(status: string | undefined): ScheduleItem["status"] {
  if (status === "completed") {
    return "已完赛";
  }
  if (status === "result_pending") {
    return "待补录";
  }
  if (status === "postponed" || status === "cancelled") {
    return "延期";
  }
  return "未开始";
}

function parseStatusText(status: string | undefined): string {
  if (status === "parsed") {
    return "高级解析完成";
  }
  if (status === "partial") {
    return "部分解析";
  }
  return status ?? "基础数据";
}

function modeText(mode: number | null | undefined): string | null {
  if (mode === null || mode === undefined) {
    return null;
  }

  return `Game Mode ${mode}`;
}

function stageNameFromId(stageId: string): string {
  if (stageId.includes("swiss")) {
    return "瑞士轮";
  }
  if (stageId.includes("knockout")) {
    return "淘汰赛";
  }
  if (stageId.includes("group")) {
    return "小组赛";
  }
  return "赛事阶段";
}

function bracketGroupText(group: string | undefined): string {
  switch (group) {
    case "single":
      return "单败";
    case "winner":
      return "胜者组";
    case "loser":
      return "败者组";
    case "grand_final":
      return "总决赛";
    default:
      return "淘汰赛";
  }
}

function laneRoleText(laneRole: number | null | undefined): string {
  const text: Record<number, string> = { 1: "优势路", 2: "中路", 3: "劣势路", 4: "野区" };
  return laneRole === undefined || laneRole === null ? "分路待定" : (text[laneRole] ?? "分路待定");
}

function percentText(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}

function compactNumberOrDash(value: number | null | undefined): string {
  return compactNumber(value);
}

function numberOrDash(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toFixed(digits);
}

function percentOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function aghanimState(value: boolean | undefined): AghanimState {
  return value ? "owned" : "none";
}

function itemLabel(itemId: number | null | undefined): string {
  if (!itemId) {
    return "-";
  }

  return prettyDotaName(dotaConstants.itemIds[String(itemId)]) ?? `#${itemId}`;
}

function itemIcon(itemId: number | null | undefined): IconRef {
  const internalName = itemId ? dotaConstants.itemIds[String(itemId)] : undefined;

  return {
    label: itemLabel(itemId),
    imageUrl: internalName ? `${localDotaAssetBaseUrl}/items/${internalName}.png` : "",
  };
}

function abilityLabel(abilityId: number | undefined): string {
  if (!abilityId) {
    return "待解析";
  }

  return prettyDotaName(dotaConstants.abilityIds[String(abilityId)]) ?? `技能 ${abilityId}`;
}

function abilityLabelByName(internalName: string | undefined): string {
  return prettyDotaName(internalName) ?? "天赋";
}

function abilityIcon(abilityId: number | undefined, level?: number): IconRef {
  const internalName = abilityId ? dotaConstants.abilityIds[String(abilityId)] : undefined;
  const kind = abilityKind(internalName);

  return {
    label: abilityLabel(abilityId),
    imageUrl:
      internalName && kind === "ability"
        ? `${localDotaAssetBaseUrl}/abilities/${internalName}.png`
        : "",
    kind,
    ...(internalName === undefined ? {} : { key: internalName }),
    ...(level === undefined ? {} : { level }),
  };
}

function emptyIcon(label: string): IconRef {
  return { label, imageUrl: "", kind: "empty" };
}

function abilityKind(internalName: string | undefined): "ability" | "talent" | "attribute" | "empty" {
  if (!internalName) {
    return "empty";
  }

  if (internalName.includes("attribute") || internalName.includes("stats")) {
    return "attribute";
  }

  if (internalName.startsWith("special_bonus")) {
    return "talent";
  }

  return "ability";
}

function heroLabel(heroId: number | undefined): string {
  if (!heroId) {
    return "未知英雄";
  }

  const schineseName = SCHINESE_HERO_NAMES_BY_ID[heroId];

  if (schineseName !== undefined) {
    return schineseName;
  }

  return `英雄 ${heroId}`;
}

function heroInternalName(heroId: number | undefined): string | null {
  if (!heroId) {
    return null;
  }

  return dotaConstants.heroes[String(heroId)]?.name ?? null;
}

function heroLabelFromUnit(unit: string | null | undefined): string {
  if (!unit) {
    return "聊天";
  }

  if (unit.startsWith("npc_dota_hero_")) {
    const heroEntry = Object.entries(dotaConstants.heroes).find(([, hero]) => hero.name === unit);
    const heroId = heroEntry ? Number(heroEntry[0]) : undefined;

    return heroId ? heroLabel(heroId) : "未知英雄";
  }

  const heroByEnglishName = Object.entries(dotaConstants.heroes).find(([, hero]) => hero.localized_name === unit);
  const heroId = heroByEnglishName ? Number(heroByEnglishName[0]) : undefined;

  return heroId ? heroLabel(heroId) : "聊天";
}

function heroPortrait(heroId: number | undefined): string {
  const imagePath = heroId ? dotaConstants.heroes[String(heroId)]?.img : undefined;

  if (imagePath !== undefined && imagePath.length > 0) {
    return `${localDotaAssetBaseUrl}/heroes/${imagePath.replace(/\?.*$/, "").split("/").pop()}`;
  }

  return `${localDotaAssetBaseUrl}/heroes/unknown.svg`;
}

function heroIcon(heroId: number | undefined): string {
  const imagePath = heroId ? dotaConstants.heroes[String(heroId)]?.icon : undefined;

  if (imagePath !== undefined && imagePath.length > 0) {
    return `${localDotaAssetBaseUrl}/hero-icons/${imagePath.replace(/\?.*$/, "").split("/").pop()}`;
  }

  return `${localDotaAssetBaseUrl}/heroes/unknown.svg`;
}

function prettyDotaName(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const clean = value
    .replace(/^item_/, "")
    .replace(/^npc_dota_hero_/, "")
    .replace(/_/g, " ")
    .trim();

  return clean.length === 0 ? null : clean.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateLabel(date: string): string {
  const now = new Date();
  const today = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date === today) {
    return "今天";
  }
  if (date === formatDate(yesterday)) {
    return "昨日";
  }
  return "赛程";
}

function formatMaybeDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )} ${formatTime(date)}`;
}

function isApiResult<T>(value: ApiResult<T> | T): value is ApiResult<T> {
  return typeof value === "object" && value !== null && "success" in value;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
