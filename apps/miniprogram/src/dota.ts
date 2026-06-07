import abilityIdsJson from "./assets/dota/constants/ability_ids.json";
import heroAbilitiesJson from "./assets/dota/constants/hero_abilities.json";
import heroesJson from "./assets/dota/constants/heroes.json";
import itemIdsJson from "./assets/dota/constants/item_ids.json";
import type {
  AghanimState,
  ChatLine,
  ComparisonMetric,
  DraftStep,
  IconRef,
  MatchDetail,
  MatchDetailPlayer,
  MatchRecord,
  MatchRecordHero,
  TalentTreeNode,
  TeamBrief,
  TeamSide,
  TrendCharts,
  TrendPoint,
  WardEvent,
} from "./types";

type DotaHeroConstant = {
  localized_name?: string;
  name?: string;
  img?: string;
  icon?: string;
};

type DotaHeroAbilitiesConstant = {
  talents?: Array<{ name?: string; level?: number }>;
};

export type ApiMatchRecord = Omit<MatchRecord, "heroLineups" | "hasDraft" | "hasVision" | "hasChat"> & {
  matchId?: number;
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

export type ApiMatchDetail = {
  match?: {
    matchId?: number;
    leagueName?: string;
    tournamentName?: string | null;
    stageName?: string | null;
    roundName?: string | null;
    winnerName?: string;
    winnerSide?: TeamSide;
    radiantWin?: boolean | null;
    durationText?: string;
    startTime?: string | null;
    endedAt?: string | null;
    gameMode?: number | null;
  };
  series?: { boType?: string; gameIndex?: number } | null;
  score?: {
    radiantScore?: number;
    direScore?: number;
    radiantTeamName?: string;
    direTeamName?: string;
    winnerName?: string;
    winnerSide?: TeamSide;
    scoreText?: string;
  };
  teams?: Partial<Record<TeamSide, TeamBrief>>;
  players?: {
    radiant?: ApiMatchPlayer[];
    dire?: ApiMatchPlayer[];
    all?: ApiMatchPlayer[];
  };
  mvp?: {
    playerSlot?: number;
    playerName?: string;
    title?: string;
    score?: number;
  } | null;
  drafts?: ApiDraft[];
  vision?: { wards?: ApiWard[]; hasVisionData?: boolean };
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
  dataAvailability?: MatchDetail["dataAvailability"];
  parseStatus?: string;
};

type ApiMatchPlayer = {
  accountId?: number | null;
  playerSlot: number;
  side: TeamSide;
  name?: string;
  heroId?: number;
  level?: number | null;
  kills?: number;
  deaths?: number;
  assists?: number;
  kdaText?: string;
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
  side?: TeamSide | null;
  action?: "ban" | "pick" | string;
  heroId?: number;
  teamName?: string | null;
};

type ApiWard = {
  timeText?: string | null;
  timeSeconds?: number | null;
  time?: number | null;
  side?: TeamSide | null;
  type?: "observer" | "sentry" | string;
  x?: number | null;
  y?: number | null;
  playerName?: string | null;
  removedAt?: number | null;
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
  values?: unknown[];
};

type ApiComparisonMetric = {
  key?: string;
  label?: string;
  radiantValue?: number;
  direValue?: number;
  radiantShare?: number;
};

type ApiChat = {
  timeText?: string | null;
  side?: TeamSide | null;
  playerName?: string | null;
  unit?: string | null;
  message?: string | null;
};

const DOTA_ASSET_BASE_URL = "/assets/dota";
const SVG_ASSET_BASE_URL = "/assets/svg";

const dotaHeroes = heroesJson as Record<string, DotaHeroConstant>;
const dotaHeroAbilities = heroAbilitiesJson as Record<string, DotaHeroAbilitiesConstant>;
const dotaItemIds = itemIdsJson as Record<string, string>;
const dotaAbilityIds = abilityIdsJson as Record<string, string>;

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

export function normalizeAssetUrl(url: string | null | undefined): string {
  if (!url) {
    return "";
  }

  if (url.startsWith("/static/dota/")) {
    return url.replace("/static/dota", DOTA_ASSET_BASE_URL);
  }

  if (url.startsWith("/static/svg/")) {
    return url.replace("/static/svg", SVG_ASSET_BASE_URL);
  }

  return url;
}

export function dotaAssetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, "");
  return `${DOTA_ASSET_BASE_URL}/${normalizedPath}`;
}

export function heroLabel(heroId: number | null | undefined): string {
  if (!heroId) {
    return "未知英雄";
  }

  return SCHINESE_HERO_NAMES_BY_ID[heroId] ?? prettyDotaName(dotaHeroes[String(heroId)]?.localized_name) ?? `英雄 ${heroId}`;
}

export function heroPortrait(heroId: number | null | undefined): string {
  const imagePath = heroId ? dotaHeroes[String(heroId)]?.img : undefined;

  if (imagePath) {
    return dotaAssetUrl(`heroes/${basename(imagePath)}`);
  }

  return dotaAssetUrl("heroes/unknown.svg");
}

export function heroIcon(heroId: number | null | undefined): string {
  const imagePath = heroId ? dotaHeroes[String(heroId)]?.icon : undefined;

  if (imagePath) {
    return dotaAssetUrl(`hero-icons/${basename(imagePath)}`);
  }

  return dotaAssetUrl("heroes/unknown.svg");
}

export function normalizeMatchRecord(record: ApiMatchRecord): MatchRecord {
  return {
    matchId: record.matchId ?? 0,
    leagueName: record.leagueName?.trim() || "OpenDota League",
    tournamentId: record.tournamentId,
    tournamentName: record.tournamentName ?? "MRJZ",
    parseStatus: parseStatusText(record.parseStatus),
    startTime: record.startTime ?? null,
    durationText: record.durationText ?? null,
    radiantWin: record.radiantWin ?? null,
    radiantScore: record.radiantScore ?? null,
    direScore: record.direScore ?? null,
    radiantTeamName: record.radiantTeamName ?? "天辉",
    direTeamName: record.direTeamName ?? "夜魇",
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

export function normalizeMatchDetail(detail: ApiMatchDetail): MatchDetail {
  const radiantPlayers = normalizePlayerSide(detail.players?.radiant, "radiant");
  const direPlayers = normalizePlayerSide(detail.players?.dire, "dire");
  const fallbackPlayers = (detail.players?.all ?? []).map((player) => normalizePlayer(player));
  const allPlayers = radiantPlayers.length + direPlayers.length > 0 ? [...radiantPlayers, ...direPlayers] : fallbackPlayers;
  const finalRadiantPlayers = radiantPlayers.length > 0 ? radiantPlayers : allPlayers.filter((player) => player.side === "radiant");
  const finalDirePlayers = direPlayers.length > 0 ? direPlayers : allPlayers.filter((player) => player.side === "dire");
  const winnerSide = detail.score?.winnerSide ?? detail.match?.winnerSide ?? (detail.match?.radiantWin ? "radiant" : "dire");
  const winnerName = detail.score?.winnerName ?? detail.match?.winnerName ?? (winnerSide === "radiant" ? detail.score?.radiantTeamName : detail.score?.direTeamName) ?? "胜者待定";
  const drafts = (detail.drafts ?? []).map(normalizeDraft).filter(isDefined);
  const wards = (detail.vision?.wards ?? []).map(normalizeWard).filter(isDefined);
  const chat = (detail.chat ?? []).map(normalizeChat).filter(isDefined);
  const charts = normalizeTrendCharts(detail.charts);
  const abilityBuildCount = allPlayers.filter((player) => player.abilityOrder.some((ability) => ability.kind === "ability")).length;

  return {
    match: {
      matchId: detail.match?.matchId ?? 0,
      leagueName: detail.match?.leagueName ?? "OpenDota League",
      tournamentName: detail.match?.tournamentName ?? null,
      stageName: detail.match?.stageName ?? null,
      roundName: detail.match?.roundName ?? null,
      winnerName,
      durationText: detail.match?.durationText ?? "--:--",
      startTime: detail.match?.startTime ?? detail.match?.endedAt ?? null,
    },
    score: {
      radiantScore: detail.score?.radiantScore ?? 0,
      direScore: detail.score?.direScore ?? 0,
      radiantTeamName: detail.score?.radiantTeamName ?? detail.teams?.radiant?.name ?? "天辉",
      direTeamName: detail.score?.direTeamName ?? detail.teams?.dire?.name ?? "夜魇",
      scoreText: detail.score?.scoreText ?? `${detail.score?.radiantScore ?? 0} : ${detail.score?.direScore ?? 0}`,
    },
    players: {
      radiant: finalRadiantPlayers,
      dire: finalDirePlayers,
      all: allPlayers,
    },
    mvp: detail.mvp
      ? {
          playerName: detail.mvp.playerName ?? allPlayers.find((player) => player.playerSlot === detail.mvp?.playerSlot)?.name ?? "MVP",
          title: detail.mvp.title ?? "全场最佳",
          score: detail.mvp.score ?? 0,
        }
      : null,
    drafts,
    vision: {
      wards,
      hasVisionData: Boolean(detail.vision?.hasVisionData ?? wards.length > 0),
    },
    charts,
    comparisons: (detail.comparisons ?? []).map(normalizeComparisonMetric).filter(isDefined),
    chat,
    dataAvailability: {
      hasAbilityBuilds: Boolean(detail.dataAvailability?.hasAbilityBuilds ?? abilityBuildCount > 0),
      hasDraft: Boolean(detail.dataAvailability?.hasDraft ?? drafts.length > 0),
      hasVision: Boolean(detail.dataAvailability?.hasVision ?? wards.length > 0),
      hasChat: Boolean(detail.dataAvailability?.hasChat ?? chat.length > 0),
      hasTrends: Boolean(detail.dataAvailability?.hasTrends ?? charts.hasTrends),
    },
    parseStatus: parseStatusText(detail.parseStatus),
  };
}

export function aghanimIcon(label: "神杖" | "魔晶", state: AghanimState): string {
  const type = label === "魔晶" ? "shard" : "scepter";
  return `${SVG_ASSET_BASE_URL}/${type}${state === "owned" ? "On" : "Off"}.svg`;
}

function normalizeRecordHeroLineup(lineup: ApiMatchRecordHero[] | undefined): MatchRecordHero[] {
  return (lineup ?? [])
    .map((hero) => {
      if (typeof hero.heroId !== "number" || hero.heroId <= 0) {
        return null;
      }

      const name = heroLabel(hero.heroId);

      return {
        playerSlot: hero.playerSlot ?? 0,
        heroId: hero.heroId,
        hero: name,
        icon: heroIcon(hero.heroId),
        portrait: heroPortrait(hero.heroId),
        playerName: hero.playerName?.trim() || name,
      };
    })
    .filter(isDefined)
    .sort((left, right) => left.playerSlot - right.playerSlot)
    .slice(0, 5);
}

function normalizePlayerSide(players: ApiMatchPlayer[] | undefined, side: TeamSide): MatchDetailPlayer[] {
  return (players ?? []).map((player) => normalizePlayer({ ...player, side }));
}

function normalizePlayer(player: ApiMatchPlayer): MatchDetailPlayer {
  const kills = player.kills ?? 0;
  const deaths = player.deaths ?? 0;
  const assists = player.assists ?? 0;
  const heroId = player.heroId ?? 0;
  const abilityOrder = (player.abilityBuild?.order ?? []).map((item, index) =>
    abilityIcon(item.abilityId, item.level ?? index + 1),
  );

  return {
    accountId: player.accountId ?? null,
    playerSlot: player.playerSlot,
    side: player.side,
    name: player.name ?? `玩家 ${player.playerSlot}`,
    heroId,
    hero: heroLabel(heroId),
    portrait: heroPortrait(heroId),
    lane: laneRoleText(player.laneRole),
    level: player.level ?? null,
    kills,
    deaths,
    assists,
    kdaText: player.kdaText ?? `${kills}/${deaths}/${assists}`,
    killParticipation: player.killParticipation ?? null,
    heroDamageShare: player.heroDamageShare ?? null,
    goldPerMin: player.goldPerMin ?? null,
    xpPerMin: player.xpPerMin ?? null,
    netWorth: player.netWorth ?? null,
    lastHits: player.lastHits ?? null,
    denies: player.denies ?? null,
    heroDamage: player.heroDamage ?? null,
    towerDamage: player.towerDamage ?? null,
    heroHealing: player.heroHealing ?? null,
    damageTaken: player.damageTaken ?? null,
    items: normalizeInventoryItems(player.items?.inventory, 6),
    backpackItems: normalizeInventoryItems(player.items?.backpack, 3),
    neutralItem: itemIcon(player.items?.neutral?.itemId),
    scepter: aghanimState(player.aghanim?.hasScepter, player.aghanim?.scepterIconState),
    shard: aghanimState(player.aghanim?.hasShard, player.aghanim?.shardIconState),
    abilityOrder,
    talentTree: normalizeTalentTree(heroInternalName(heroId), abilityOrder),
  };
}

function normalizeInventoryItems(
  items: Array<{ slot?: number; itemId?: number | null }> | undefined,
  size: number,
): IconRef[] {
  const slots = Array.from({ length: size }, () => emptyIcon("-"));

  for (const [index, item] of (items ?? []).entries()) {
    const slot = typeof item.slot === "number" && item.slot >= 0 && item.slot < size ? item.slot : index;
    slots[slot] = itemIcon(item.itemId);
  }

  return slots;
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

function normalizeWard(ward: ApiWard): WardEvent | null {
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

  return { minute: point.minute, value: point.value };
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

function normalizeChat(chat: ApiChat): ChatLine | null {
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
  if (!value) {
    return 0;
  }

  const match = value.match(/^(-?)(\d+):(\d+)$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function itemIcon(itemId: number | null | undefined): IconRef {
  const internalName = itemId ? dotaItemIds[String(itemId)] : undefined;
  const label = itemId ? prettyDotaName(internalName) ?? `#${itemId}` : "-";

  return {
    label,
    imageUrl: internalName ? dotaAssetUrl(`items/${internalName}.png`) : "",
  };
}

function abilityIcon(abilityId: number | undefined, level: number | undefined): IconRef {
  const internalName = abilityId ? dotaAbilityIds[String(abilityId)] : undefined;
  const kind = abilityKind(internalName);
  const ref: IconRef = {
    label: abilityId ? prettyDotaName(internalName) ?? `技能 ${abilityId}` : "待解析",
    imageUrl: internalName && kind === "ability" ? dotaAssetUrl(`abilities/${internalName}.png`) : "",
    kind,
  };

  if (internalName !== undefined) {
    ref.key = internalName;
  }
  if (level !== undefined) {
    ref.level = level;
  }

  return ref;
}

function normalizeTalentTree(heroKey: string | null, abilityOrder: IconRef[]): TalentTreeNode[] {
  const pickedTalents = new Map<string, number>();

  for (const ability of abilityOrder) {
    if (ability.kind === "talent" && ability.key !== undefined) {
      pickedTalents.set(ability.key, ability.level ?? 0);
    }
  }

  const heroTalents = heroKey === null ? [] : (dotaHeroAbilities[heroKey]?.talents ?? []);

  if (heroTalents.length === 0) {
    return fallbackTalentTree(pickedTalents);
  }

  return ([4, 3, 2, 1] as const).flatMap((tier) => {
    const talentsForTier = heroTalents.filter((talent) => talent.level === tier).slice(0, 2);

    return (["left", "right"] as const).map((side, index) => {
      const talent = talentsForTier[index];
      const key = talent?.name;
      const pickedLevel = key === undefined ? undefined : pickedTalents.get(key);
      const node: TalentTreeNode = {
        tier,
        side,
        picked: pickedLevel !== undefined,
        label: abilityLabelByName(key),
      };

      if (pickedLevel !== undefined) {
        node.level = pickedLevel;
      }

      return node;
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
      const node: TalentTreeNode = {
        tier,
        side,
        picked: shouldPick,
        label: shouldPick ? abilityLabelByName(entry?.[0]) : "天赋",
      };

      cursor += 1;

      if (entry?.[1] !== undefined) {
        node.level = entry[1];
      }

      return node;
    }),
  );
}

function emptyIcon(label: string): IconRef {
  return { label, imageUrl: "", kind: "empty" };
}

function abilityKind(internalName: string | undefined): NonNullable<IconRef["kind"]> {
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

function aghanimState(value: boolean | undefined, iconState: string | undefined): AghanimState {
  if (value) {
    return "owned";
  }
  if (iconState === "queued") {
    return "queued";
  }
  return "none";
}

function laneRoleText(laneRole: number | null | undefined): string {
  const text: Record<number, string> = { 1: "优势路", 2: "中路", 3: "劣势路", 4: "野区" };
  return laneRole === undefined || laneRole === null ? "分路待定" : (text[laneRole] ?? "分路待定");
}

function heroInternalName(heroId: number | null | undefined): string | null {
  if (!heroId) {
    return null;
  }

  return dotaHeroes[String(heroId)]?.name ?? null;
}

function heroLabelFromUnit(unit: string | null | undefined): string {
  if (!unit) {
    return "聊天";
  }

  const heroEntry = Object.entries(dotaHeroes).find(([, hero]) => hero.name === unit || hero.localized_name === unit);
  const heroId = heroEntry ? Number(heroEntry[0]) : undefined;

  return heroId ? heroLabel(heroId) : "聊天";
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

function abilityLabelByName(internalName: string | undefined): string {
  return prettyDotaName(internalName) ?? "天赋";
}

function prettyDotaName(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value.trim().length === 0) {
    return null;
  }

  const clean = value.replace(/^item_/, "").replace(/^npc_dota_hero_/, "").replace(/_/g, " ").trim();

  return clean.length === 0 ? null : clean.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function basename(value: string): string {
  return value.replace(/\?.*$/, "").split("/").pop() ?? "";
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
