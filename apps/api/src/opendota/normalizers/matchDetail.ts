import type {
  OpenDotaChatMessage,
  OpenDotaDraftAction,
  OpenDotaMatchDetail,
  OpenDotaMatchPlayer,
  OpenDotaPermanentBuff,
  OpenDotaWardLogEntry,
} from "../types.js";
import type {
  AdvantagePointViewModel,
  AghanimSource,
  AghanimStateViewModel,
  ChatMessageViewModel,
  ComparisonMetricViewModel,
  DraftActionViewModel,
  DraftSummaryViewModel,
  LaneMatchupViewModel,
  MatchAwardCode,
  MatchAwardViewModel,
  MatchDetailContext,
  MatchDetailViewModel,
  MatchPlayerViewModel,
  MvpSummaryViewModel,
  ParseStatus,
  PlayerTrendSeriesViewModel,
  TeamBrief,
  TeamSide,
  TrendChartsViewModel,
  WardTimelineEventViewModel,
} from "../../view-models/matchDetail.js";
import { getMatchAwardRuleDescription } from "@mrjz/shared/match-awards";

const AGHANIMS_SCEPTER_ITEM_ID = 108;
const AGHANIMS_SHARD_ITEM_ID = 609;
const SUPPORT_PURCHASE_KEYS = ["ward_sentry", "smoke_of_deceit", "dust", "gem"] as const;

const FALLBACK_TEAMS: Record<TeamSide, TeamBrief> = {
  radiant: {
    id: "radiant",
    name: "天辉",
    shortName: "RADIANT",
    opendotaTeamId: null,
    logoUrl: null,
    color: "#34d399",
  },
  dire: {
    id: "dire",
    name: "夜魇",
    shortName: "DIRE",
    opendotaTeamId: null,
    logoUrl: null,
    color: "#f87171",
  },
};

export function normalizeOpenDotaMatchDetail(
  raw: OpenDotaMatchDetail,
  context?: Partial<MatchDetailContext>,
  now = new Date(),
): MatchDetailViewModel {
  const teams = {
    radiant: context?.teams?.radiant ?? teamFromRaw("radiant", raw),
    dire: context?.teams?.dire ?? teamFromRaw("dire", raw),
  };
  const radiantScore = numberOr(raw.radiant_score, 0);
  const direScore = numberOr(raw.dire_score, 0);
  const radiantWin = raw.radiant_win ?? radiantScore >= direScore;
  const winnerSide: TeamSide = radiantWin ? "radiant" : "dire";
  const durationSeconds = numberOr(raw.duration, 0);
  const startTime = typeof raw.start_time === "number" ? raw.start_time : null;
  const endedAt = startTime === null ? null : toIso(startTime + durationSeconds);
  const rawPlayers = raw.players ?? [];
  const allPlayers = normalizePlayers(rawPlayers, teams, radiantScore, direScore);
  const radiantPlayers = allPlayers.filter((player) => player.side === "radiant");
  const direPlayers = allPlayers.filter((player) => player.side === "dire");
  const playersBySlot = new Map(allPlayers.map((player) => [player.playerSlot, player]));
  const drafts = normalizeDrafts(raw.picks_bans, teams);
  const draftSummary: DraftSummaryViewModel = {
    hasDraft: drafts.length > 0,
    total: drafts.length,
    source: drafts.length > 0 ? "picks_bans" : "missing",
  };
  const vision = normalizeVisionTimeline(rawPlayers, playersBySlot);
  const chat = normalizeChat(raw.chat, playersBySlot);
  const charts = normalizeTrendCharts(allPlayers, rawPlayers);
  const comparisons = normalizeComparisons(radiantPlayers, direPlayers);
  const lanes = normalizeLanes(allPlayers);
  const awards = pickMatchAwards(allPlayers, rawPlayers, raw.chat, winnerSide);
  const hasAbilityBuilds = allPlayers.some((player) => player.abilityBuild.hasData);
  const hasAdvancedParseSignals =
    hasAbilityBuilds || draftSummary.hasDraft || vision.length > 0 || chat.length > 0 || charts.hasTrends;
  const parseStatus = getParseStatus(raw, hasAdvancedParseSignals, draftSummary.hasDraft, charts.hasTrends);

  return {
    match: {
      matchId: raw.match_id,
      leagueId: raw.leagueid ?? raw.league_id ?? context?.league?.opendotaLeagueId ?? null,
      leagueName: context?.league?.name ?? raw.league?.name ?? "OpenDota League",
      tournamentName: context?.tournament?.name ?? null,
      stageName: context?.stage?.name ?? null,
      roundName: context?.round?.name ?? null,
      radiantWin,
      winnerSide,
      winnerName: teams[winnerSide].name,
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      gameMode: raw.game_mode ?? null,
      startTime: startTime === null ? null : toIso(startTime),
      endedAt,
    },
    series: context?.series ?? null,
    teams,
    score: {
      radiantScore,
      direScore,
      scoreText: `${radiantScore} : ${direScore}`,
      radiantTeamName: teams.radiant.name,
      direTeamName: teams.dire.name,
      winnerSide,
      winnerName: teams[winnerSide].name,
    },
    players: {
      radiant: radiantPlayers,
      dire: direPlayers,
      all: allPlayers,
    },
    mvp: pickMvp(allPlayers, winnerSide),
    awards,
    drafts,
    draftSummary,
    vision: {
      hasVisionData: vision.length > 0,
      wards: vision,
    },
    charts,
    lanes,
    comparisons,
    chat,
    parseStatus,
    dataAvailability: {
      hasAbilityBuilds,
      hasDraft: draftSummary.hasDraft,
      hasVision: vision.length > 0,
      hasChat: chat.length > 0,
      hasTrends: charts.hasTrends,
    },
    source: {
      provider: "opendota",
      matchId: raw.match_id,
      normalizedAt: now.toISOString(),
    },
  };
}

function teamFromRaw(side: TeamSide, raw: OpenDotaMatchDetail): TeamBrief {
  const fallback = FALLBACK_TEAMS[side];
  const name = side === "radiant" ? raw.radiant_name : raw.dire_name;
  const teamId = side === "radiant" ? raw.radiant_team_id : raw.dire_team_id;
  const normalizedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : fallback.name;

  return {
    ...fallback,
    id: typeof teamId === "number" ? `${side}_${teamId}` : fallback.id,
    opendotaTeamId: typeof teamId === "number" ? teamId : fallback.opendotaTeamId,
    name: normalizedName,
    shortName: normalizedName === fallback.name ? fallback.shortName : shortName(normalizedName),
  };
}

function shortName(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .slice(0, 6)
      .toUpperCase() || name.slice(0, 3)
  );
}

function normalizePlayers(
  players: OpenDotaMatchPlayer[],
  teams: Record<TeamSide, TeamBrief>,
  radiantScore: number,
  direScore: number,
): MatchPlayerViewModel[] {
  const radiantDamageTotal = sumBy(
    players.filter((player) => sideFromPlayerSlot(player.player_slot) === "radiant"),
    (player) => numberOrNull(player.hero_damage) ?? 0,
  );
  const direDamageTotal = sumBy(
    players.filter((player) => sideFromPlayerSlot(player.player_slot) === "dire"),
    (player) => numberOrNull(player.hero_damage) ?? 0,
  );

  return players.map((player, index) => {
    const side = sideFromPlayerSlot(player.player_slot);
    const teamKills = side === "radiant" ? radiantScore : direScore;
    const heroDamage = numberOrNull(player.hero_damage);
    const teamDamage = side === "radiant" ? radiantDamageTotal : direDamageTotal;
    const abilityBuild = normalizeAbilityBuild(player);
    const items = normalizeItems(player);

    return {
      accountId: numberOrNull(player.account_id),
      playerSlot: player.player_slot,
      side,
      team: teams[side],
      name: player.personaname ?? player.player_name ?? player.name ?? `Player ${index + 1}`,
      heroId: numberOr(player.hero_id, 0),
      level: numberOrNull(player.level),
      kills: numberOr(player.kills, 0),
      deaths: numberOr(player.deaths, 0),
      assists: numberOr(player.assists, 0),
      kdaText: `${numberOr(player.kills, 0)}/${numberOr(player.deaths, 0)}/${numberOr(player.assists, 0)}`,
      ratingScore: 0,
      killParticipation:
        teamKills > 0 ? roundRatio((numberOr(player.kills, 0) + numberOr(player.assists, 0)) / teamKills) : null,
      heroDamageShare: heroDamage !== null && teamDamage > 0 ? roundRatio(heroDamage / teamDamage) : null,
      goldPerMin: numberOrNull(player.gold_per_min),
      xpPerMin: numberOrNull(player.xp_per_min),
      netWorth: numberOrNull(player.net_worth),
      lastHits: numberOrNull(player.last_hits),
      denies: numberOrNull(player.denies),
      heroDamage,
      towerDamage: numberOrNull(player.tower_damage),
      heroHealing: numberOrNull(player.hero_healing),
      damageTaken: damageTakenTotal(player.damage_taken),
      lane: numberOrNull(player.lane),
      laneRole: numberOrNull(player.lane_role),
      items,
      abilityBuild,
      aghanim: normalizeAghanimState(items, player),
    };
  }).map((player) => ({
    ...player,
    ratingScore: playerRatingScore(player),
  }));
}

function normalizeAbilityBuild(player: OpenDotaMatchPlayer): MatchPlayerViewModel["abilityBuild"] {
  if (Array.isArray(player.ability_upgrades_arr) && player.ability_upgrades_arr.length > 0) {
    return {
      hasData: true,
      order: player.ability_upgrades_arr.map((abilityId, index) => ({
        level: index + 1,
        abilityId,
        time: null,
      })),
    };
  }

  if (Array.isArray(player.ability_upgrades) && player.ability_upgrades.length > 0) {
    return {
      hasData: true,
      order: player.ability_upgrades.map((upgrade, index) => ({
        level: upgrade.level ?? index + 1,
        abilityId: upgrade.ability ?? upgrade.ability_id ?? 0,
        time: upgrade.time ?? null,
      })),
    };
  }

  return {
    hasData: false,
    order: [],
  };
}

function normalizeItems(player: OpenDotaMatchPlayer): MatchPlayerViewModel["items"] {
  return {
    inventory: [
      { slot: 0, itemId: itemOrNull(player.item_0) },
      { slot: 1, itemId: itemOrNull(player.item_1) },
      { slot: 2, itemId: itemOrNull(player.item_2) },
      { slot: 3, itemId: itemOrNull(player.item_3) },
      { slot: 4, itemId: itemOrNull(player.item_4) },
      { slot: 5, itemId: itemOrNull(player.item_5) },
    ],
    backpack: [
      { slot: 0, itemId: itemOrNull(player.backpack_0) },
      { slot: 1, itemId: itemOrNull(player.backpack_1) },
      { slot: 2, itemId: itemOrNull(player.backpack_2) },
    ],
    neutral: {
      slot: 0,
      itemId: itemOrNull(player.item_neutral),
    },
  };
}

function normalizeAghanimState(
  items: MatchPlayerViewModel["items"],
  player: OpenDotaMatchPlayer,
): AghanimStateViewModel {
  const permanentBuffs = player.permanent_buffs ?? [];
  const itemIds = [
    ...items.inventory.map((item) => item.itemId),
    ...items.backpack.map((item) => item.itemId),
    items.neutral?.itemId ?? null,
  ].filter((itemId): itemId is number => itemId !== null);

  const hasScepterItem = itemIds.includes(AGHANIMS_SCEPTER_ITEM_ID);
  const hasShardItem = itemIds.includes(AGHANIMS_SHARD_ITEM_ID);
  const hasScepterFlag = player.aghanims_scepter === 1 || player.aghanim_scepter === 1;
  const hasShardFlag = player.aghanims_shard === 1 || player.aghanim_shard === 1;
  const hasScepterBuff = permanentBuffs.some((buff) => permanentBuffMatches(buff, ["scepter", "ultimate"]));
  const hasShardBuff = permanentBuffs.some((buff) => permanentBuffMatches(buff, ["shard", "aghanim_shard"]));
  const hasScepter = hasScepterItem || hasScepterFlag || hasScepterBuff;
  const hasShard = hasShardItem || hasShardFlag || hasShardBuff;
  const scepterSource: AghanimSource = hasScepterItem || hasScepterFlag ? "item" : hasScepterBuff ? "permanent_buff" : "none";
  const shardSource: AghanimSource = hasShardItem || hasShardFlag ? "item" : hasShardBuff ? "permanent_buff" : "none";

  return {
    hasScepter,
    hasShard,
    scepterSource,
    shardSource,
    scepterIconState: hasScepter ? "active" : "inactive",
    shardIconState: hasShard ? "active" : "inactive",
  };
}

function normalizeDrafts(
  picksBans: OpenDotaDraftAction[] | undefined,
  teams: Record<TeamSide, TeamBrief>,
): DraftActionViewModel[] {
  if (!Array.isArray(picksBans) || picksBans.length === 0) {
    return [];
  }

  return [...picksBans]
    .sort((left, right) => draftOrder(left, 0) - draftOrder(right, 0))
    .map((draft, index) => {
      const side = sideFromDraftTeam(draft.team);

      return {
        order: draftOrder(draft, index),
        action: draft.is_pick ? "pick" : "ban",
        side,
        teamName: side === null ? null : teams[side].name,
        heroId: numberOr(draft.hero_id, 0),
        playerSlot: numberOrNull(draft.player_slot),
      };
    });
}

function normalizeVisionTimeline(
  players: OpenDotaMatchPlayer[],
  playersBySlot: Map<number, MatchPlayerViewModel>,
): WardTimelineEventViewModel[] {
  const events: WardTimelineEventViewModel[] = [];

  for (const player of players) {
    appendWardEvents(events, "observer", player, player.obs_log ?? [], playersBySlot);
    appendWardEvents(events, "sentry", player, player.sen_log ?? [], playersBySlot);
  }

  return events.sort((left, right) => left.time - right.time);
}

function appendWardEvents(
  events: WardTimelineEventViewModel[],
  type: "observer" | "sentry",
  sourcePlayer: OpenDotaMatchPlayer,
  logs: OpenDotaWardLogEntry[],
  playersBySlot: Map<number, MatchPlayerViewModel>,
): void {
  for (const log of logs) {
    const playerSlot = log.player_slot ?? sourcePlayer.player_slot;
    const player = playersBySlot.get(playerSlot) ?? null;

    events.push({
      time: numberOr(log.time, 0),
      timeText: formatClock(numberOr(log.time, 0)),
      type,
      side: player?.side ?? sideFromPlayerSlot(playerSlot),
      playerSlot,
      playerName: player?.name ?? null,
      x: numberOrNull(log.x),
      y: numberOrNull(log.y),
      z: numberOrNull(log.z),
      removedAt: numberOrNull(log.entityleft),
    });
  }
}

function normalizeChat(
  rawChat: OpenDotaChatMessage[] | undefined,
  playersBySlot: Map<number, MatchPlayerViewModel>,
): ChatMessageViewModel[] {
  if (!Array.isArray(rawChat) || rawChat.length === 0) {
    return [];
  }

  return rawChat
    .map((message) => normalizeChatMessage(message, playersBySlot))
    .filter((message): message is ChatMessageViewModel => message !== null)
    .sort((left, right) => left.time - right.time);
}

function normalizeChatMessage(
  message: OpenDotaChatMessage,
  playersBySlot: Map<number, MatchPlayerViewModel>,
): ChatMessageViewModel | null {
  const text = message.key === undefined || message.key === null ? "" : String(message.key);

  if (text.trim().length === 0) {
    return null;
  }

  const playerSlot = message.player_slot ?? message.slot ?? null;
  const player = playerSlot === null ? null : playersBySlot.get(playerSlot) ?? null;

  return {
    time: numberOr(message.time, 0),
    timeText: formatClock(numberOr(message.time, 0)),
    type: message.type ?? "chat",
    side: player?.side ?? null,
    playerSlot,
    playerName: player?.name ?? null,
    unit: message.unit ?? null,
    message: text,
  };
}

function normalizeTrendCharts(
  normalizedPlayers: MatchPlayerViewModel[],
  rawPlayers: OpenDotaMatchPlayer[],
): TrendChartsViewModel {
  const playerGold = normalizePlayerTrend(normalizedPlayers, rawPlayers, "gold_t");
  const playerXp = normalizePlayerTrend(normalizedPlayers, rawPlayers, "xp_t");
  const goldAdvantage = normalizeAdvantageSeries(normalizedPlayers, rawPlayers, "gold_t");
  const xpAdvantage = normalizeAdvantageSeries(normalizedPlayers, rawPlayers, "xp_t");
  const hasGold = playerGold.length > 0 || goldAdvantage.length > 0;
  const hasXp = playerXp.length > 0 || xpAdvantage.length > 0;

  return {
    hasTrends: hasGold || hasXp,
    intervalSeconds: 60,
    playerGold,
    playerXp,
    goldAdvantage,
    xpAdvantage,
    placeholders: {
      economyTrend: hasGold ? null : "OpenDota players.gold_t is missing; keep chart shell empty.",
      experienceTrend: hasXp ? null : "OpenDota players.xp_t is missing; keep chart shell empty.",
    },
  };
}

function normalizePlayerTrend(
  normalizedPlayers: MatchPlayerViewModel[],
  rawPlayers: OpenDotaMatchPlayer[],
  key: "gold_t" | "xp_t",
): PlayerTrendSeriesViewModel[] {
  const rawBySlot = new Map(rawPlayers.map((player) => [player.player_slot, player]));
  const trends: PlayerTrendSeriesViewModel[] = [];

  for (const player of normalizedPlayers) {
    const raw = rawBySlot.get(player.playerSlot);
    const values = raw?.[key];

    if (Array.isArray(values) && values.length > 0) {
      trends.push({
        playerSlot: player.playerSlot,
        playerName: player.name,
        side: player.side,
        heroId: player.heroId,
        values,
      });
    }
  }

  return trends;
}

function normalizeAdvantageSeries(
  normalizedPlayers: MatchPlayerViewModel[],
  rawPlayers: OpenDotaMatchPlayer[],
  key: "gold_t" | "xp_t",
): AdvantagePointViewModel[] {
  const rawBySlot = new Map(rawPlayers.map((player) => [player.player_slot, player]));
  const maxLength = normalizedPlayers.reduce((length, player) => {
    const values = rawBySlot.get(player.playerSlot)?.[key];
    return Math.max(length, Array.isArray(values) ? values.length : 0);
  }, 0);
  const points: AdvantagePointViewModel[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    let radiantTotal = 0;
    let direTotal = 0;

    for (const player of normalizedPlayers) {
      const values = rawBySlot.get(player.playerSlot)?.[key];
      const value = Array.isArray(values) ? values[index] ?? 0 : 0;

      if (player.side === "radiant") {
        radiantTotal += value;
      } else {
        direTotal += value;
      }
    }

    points.push({
      minute: index,
      value: radiantTotal - direTotal,
    });
  }

  return points;
}

function normalizeComparisons(
  radiantPlayers: MatchPlayerViewModel[],
  direPlayers: MatchPlayerViewModel[],
): ComparisonMetricViewModel[] {
  return [
    comparison("heroDamage", "英雄伤害", radiantPlayers, direPlayers, (player) => player.heroDamage ?? 0),
    comparison("towerDamage", "建筑伤害", radiantPlayers, direPlayers, (player) => player.towerDamage ?? 0),
    comparison("heroHealing", "治疗", radiantPlayers, direPlayers, (player) => player.heroHealing ?? 0),
    comparison("damageTaken", "承伤", radiantPlayers, direPlayers, (player) => player.damageTaken ?? 0),
    comparison("kills", "击杀", radiantPlayers, direPlayers, (player) => player.kills),
  ];
}

function normalizeLanes(players: MatchPlayerViewModel[]): LaneMatchupViewModel[] {
  const lanes = new Map<number, MatchPlayerViewModel[]>();

  for (const player of players) {
    const lane = player.lane ?? 0;
    const current = lanes.get(lane) ?? [];
    current.push(player);
    lanes.set(lane, current);
  }

  return [...lanes.entries()]
    .sort(([left], [right]) => left - right)
    .map(([lane, lanePlayers]) => ({
      lane,
      laneName: laneName(lane),
      radiantPlayers: lanePlayers
        .filter((player) => player.side === "radiant")
        .map((player) => ({ playerSlot: player.playerSlot, name: player.name, heroId: player.heroId })),
      direPlayers: lanePlayers
        .filter((player) => player.side === "dire")
        .map((player) => ({ playerSlot: player.playerSlot, name: player.name, heroId: player.heroId })),
    }));
}

function pickMatchAwards(
  players: MatchPlayerViewModel[],
  rawPlayers: OpenDotaMatchPlayer[],
  rawChat: OpenDotaChatMessage[] | undefined,
  winnerSide: TeamSide,
): MatchAwardViewModel[] {
  const rawBySlot = new Map(rawPlayers.map((player) => [player.player_slot, player]));
  const chatCounts = chatCountBySlot(rawChat);
  const loserSide = winnerSide === "radiant" ? "dire" : "radiant";
  const winnerPlayers = players.filter((player) => player.side === winnerSide);
  const loserPlayers = players.filter((player) => player.side === loserSide);
  const awards: MatchAwardViewModel[] = [];

  appendAward(
    awards,
    "lie_flat",
    "躺",
    getMatchAwardRuleDescription("lie_flat"),
    pickLowest(winnerPlayers, (player) => player.ratingScore),
    (value) => `评分 ${formatDecimal(value)}`,
  );
  appendAward(
    awards,
    "breaker",
    "破",
    getMatchAwardRuleDescription("breaker"),
    pickHighest(players, (player) => player.kills),
    (value) => `${formatInteger(value)} 杀`,
  );
  appendAward(
    awards,
    "herbalist",
    "采灵芝",
    getMatchAwardRuleDescription("herbalist"),
    pickHighest(players, (player) => numberOrNull(rawBySlot.get(player.playerSlot)?.neutral_kills), { minValue: 1 }),
    (value) => `${formatInteger(value)} 野怪`,
  );
  appendAward(
    awards,
    "healer",
    "奶",
    getMatchAwardRuleDescription("healer"),
    pickHighest(players, (player) => player.heroHealing, { minValue: 1 }),
    (value) => formatCompactNumber(value),
  );
  appendAward(
    awards,
    "pianist",
    "钢琴手",
    getMatchAwardRuleDescription("pianist"),
    pickHighest(players, (player) => numberOrNull(rawBySlot.get(player.playerSlot)?.actions_per_min), { minValue: 1 }),
    (value) => `${formatInteger(value)} APM`,
  );
  appendAward(
    awards,
    "binder",
    "捆绑王",
    getMatchAwardRuleDescription("binder"),
    pickHighest(players, (player) => numberOrNull(rawBySlot.get(player.playerSlot)?.stuns), { minValue: 0.1 }),
    (value) => `${formatDecimal(value)} 秒`,
  );
  appendAward(
    awards,
    "pressure",
    "压力怪",
    getMatchAwardRuleDescription("pressure"),
    pickHighest(players, (player) => numberOrNull(rawBySlot.get(player.playerSlot)?.pings), { minValue: 1 }),
    (value) => `${formatInteger(value)} 次`,
  );
  appendAward(
    awards,
    "stiff",
    "僵",
    getMatchAwardRuleDescription("stiff"),
    pickLowest(loserPlayers, (player) => player.ratingScore),
    (value) => `评分 ${formatDecimal(value)}`,
  );
  appendAward(
    awards,
    "ghost",
    "鬼",
    getMatchAwardRuleDescription("ghost"),
    pickHighest(players, (player) => player.deaths),
    (value) => `${formatInteger(value)} 死`,
  );
  appendAward(
    awards,
    "tough",
    "硬",
    getMatchAwardRuleDescription("tough"),
    pickHighest(players, (player) => player.damageTaken, { minValue: 1 }),
    (value) => formatCompactNumber(value),
  );
  appendAward(
    awards,
    "violence",
    "力中暴力",
    getMatchAwardRuleDescription("violence"),
    pickHighest(players, (player) => player.heroDamage, { minValue: 1 }),
    (value) => formatCompactNumber(value),
  );
  appendAward(
    awards,
    "assist",
    "助",
    getMatchAwardRuleDescription("assist"),
    pickHighest(players, (player) => player.assists),
    (value) => `${formatInteger(value)} 助`,
  );
  appendAward(
    awards,
    "support",
    "辅",
    getMatchAwardRuleDescription("support"),
    pickHighest(players, (player) => supportPurchaseCount(rawBySlot.get(player.playerSlot)), { minValue: 1 }),
    (value) => `${formatInteger(value)} 次`,
  );
  appendAward(
    awards,
    "talker",
    "话痨",
    getMatchAwardRuleDescription("talker"),
    pickHighest(players, (player) => chatCounts.get(player.playerSlot) ?? 0, { minValue: 1 }),
    (value) => `${formatInteger(value)} 条`,
  );
  appendAward(
    awards,
    "rich",
    "富",
    getMatchAwardRuleDescription("rich"),
    pickHighest(players, (player) => richestValue(player, rawBySlot.get(player.playerSlot)), { minValue: 1 }),
    (value) => formatCompactNumber(value),
  );
  appendAward(
    awards,
    "cty",
    "CTY",
    getMatchAwardRuleDescription("cty"),
    pickHighest(players, (player) => tenMinuteGold(rawBySlot.get(player.playerSlot)), { minValue: 1 }),
    (value) => formatCompactNumber(value),
  );
  appendAward(
    awards,
    "demolition",
    "拆",
    getMatchAwardRuleDescription("demolition"),
    pickHighest(players, (player) => player.towerDamage, { minValue: 1 }),
    (value) => formatCompactNumber(value),
  );
  appendAward(
    awards,
    "soul",
    "魂",
    getMatchAwardRuleDescription("soul"),
    pickHighest(loserPlayers, (player) => player.ratingScore),
    (value) => `评分 ${formatDecimal(value)}`,
  );

  return awards;
}

function pickMvp(players: MatchPlayerViewModel[], winnerSide: TeamSide): MvpSummaryViewModel | null {
  const candidates = players.filter((player) => player.side === winnerSide);
  let bestPlayer: MatchPlayerViewModel | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const player of candidates) {
    const score = playerRatingScore(player);

    if (score > bestScore) {
      bestScore = score;
      bestPlayer = player;
    }
  }

  if (bestPlayer === null) {
    return null;
  }

  return {
    playerSlot: bestPlayer.playerSlot,
    playerName: bestPlayer.name,
    side: bestPlayer.side,
    heroId: bestPlayer.heroId,
    score: roundDecimal(bestScore),
    title: "MVP",
  };
}

function playerRatingScore(player: MatchPlayerViewModel): number {
  const kda = (player.kills + player.assists) / Math.max(1, player.deaths);
  const score =
    kda * 0.25 +
    (player.killParticipation ?? 0) * 100 * 0.25 +
    (player.heroDamageShare ?? 0) * 100 * 0.2 +
    ((player.towerDamage ?? 0) / 1000) * 0.15 +
    ((player.goldPerMin ?? 0) / 10) * 0.15;

  return roundDecimal(score);
}

type AwardCandidate = {
  player: MatchPlayerViewModel;
  value: number;
};

type AwardPickOptions = {
  minValue?: number;
};

function appendAward(
  awards: MatchAwardViewModel[],
  code: MatchAwardCode,
  title: string,
  description: string,
  candidate: AwardCandidate | null,
  valueText: (value: number) => string,
): void {
  if (candidate === null) {
    return;
  }

  awards.push({
    code,
    title,
    description,
    playerSlot: candidate.player.playerSlot,
    playerName: candidate.player.name,
    side: candidate.player.side,
    heroId: candidate.player.heroId,
    value: roundDecimal(candidate.value),
    valueText: valueText(candidate.value),
  });
}

function pickHighest(
  players: MatchPlayerViewModel[],
  selector: (player: MatchPlayerViewModel) => number | null,
  options: AwardPickOptions = {},
): AwardCandidate | null {
  return pickBy(players, selector, "highest", options);
}

function pickLowest(
  players: MatchPlayerViewModel[],
  selector: (player: MatchPlayerViewModel) => number | null,
  options: AwardPickOptions = {},
): AwardCandidate | null {
  return pickBy(players, selector, "lowest", options);
}

function pickBy(
  players: MatchPlayerViewModel[],
  selector: (player: MatchPlayerViewModel) => number | null,
  direction: "highest" | "lowest",
  options: AwardPickOptions,
): AwardCandidate | null {
  let selected: AwardCandidate | null = null;

  for (const player of players) {
    const value = selector(player);

    if (value === null || !Number.isFinite(value) || value < (options.minValue ?? Number.NEGATIVE_INFINITY)) {
      continue;
    }

    if (
      selected === null ||
      (direction === "highest" && value > selected.value) ||
      (direction === "lowest" && value < selected.value) ||
      (value === selected.value && player.playerSlot < selected.player.playerSlot)
    ) {
      selected = { player, value };
    }
  }

  return selected;
}

function supportPurchaseCount(player: OpenDotaMatchPlayer | undefined): number | null {
  if (player?.purchase === undefined) {
    return null;
  }

  return SUPPORT_PURCHASE_KEYS.reduce((total, key) => total + numberOr(player.purchase?.[key], 0), 0);
}

function chatCountBySlot(rawChat: OpenDotaChatMessage[] | undefined): Map<number, number> {
  const counts = new Map<number, number>();

  for (const message of rawChat ?? []) {
    const playerSlot = message.player_slot ?? message.slot;

    if (message.type !== "chat" || typeof playerSlot !== "number") {
      continue;
    }

    counts.set(playerSlot, (counts.get(playerSlot) ?? 0) + 1);
  }

  return counts;
}

function richestValue(player: MatchPlayerViewModel, rawPlayer: OpenDotaMatchPlayer | undefined): number | null {
  return player.netWorth ?? numberOrNull(rawPlayer?.total_gold) ?? numberOrNull(rawPlayer?.gold);
}

function tenMinuteGold(player: OpenDotaMatchPlayer | undefined): number | null {
  const value = player?.gold_t?.[10];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function comparison(
  key: string,
  label: string,
  radiantPlayers: MatchPlayerViewModel[],
  direPlayers: MatchPlayerViewModel[],
  selector: (player: MatchPlayerViewModel) => number,
): ComparisonMetricViewModel {
  const radiantValue = sumBy(radiantPlayers, selector);
  const direValue = sumBy(direPlayers, selector);
  const total = radiantValue + direValue;

  return {
    key,
    label,
    radiantValue,
    direValue,
    radiantShare: total > 0 ? roundRatio(radiantValue / total) : 0.5,
  };
}

function getParseStatus(
  raw: OpenDotaMatchDetail,
  hasAdvancedParseSignals: boolean,
  hasDraft: boolean,
  hasTrends: boolean,
): ParseStatus {
  if (raw.version !== undefined && hasDraft && hasTrends) {
    return "parsed";
  }

  if (hasAdvancedParseSignals) {
    return "partial";
  }

  return "basic";
}

function permanentBuffMatches(buff: OpenDotaPermanentBuff, tokens: string[]): boolean {
  const searchable = [
    buff.name,
    buff.key,
    buff.permanent_buff === undefined ? undefined : String(buff.permanent_buff),
    buff.permanent_buff_id === undefined ? undefined : String(buff.permanent_buff_id),
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLowerCase();

  return tokens.some((token) => searchable.includes(token));
}

function sideFromPlayerSlot(playerSlot: number): TeamSide {
  return playerSlot < 128 ? "radiant" : "dire";
}

function sideFromDraftTeam(team: number | undefined): TeamSide | null {
  if (team === 0 || team === 2) {
    return "radiant";
  }

  if (team === 1 || team === 3) {
    return "dire";
  }

  return null;
}

function draftOrder(draft: OpenDotaDraftAction, fallback: number): number {
  return draft.order ?? draft.ord ?? fallback;
}

function itemOrNull(value: number | undefined): number | null {
  return typeof value === "number" && value > 0 ? value : null;
}

function numberOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function damageTakenTotal(value: OpenDotaMatchPlayer["damage_taken"]): number | null {
  if (typeof value === "number") {
    return numberOrNull(value);
  }

  if (value === undefined || value === null || Array.isArray(value)) {
    return null;
  }

  const total = Object.values(value).reduce((sum, damage) => {
    return typeof damage === "number" && Number.isFinite(damage) ? sum + damage : sum;
  }, 0);

  return total > 0 ? total : null;
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function roundDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatDecimal(value: number): string {
  return roundDecimal(value).toFixed(1);
}

function formatInteger(value: number): string {
  return Math.round(value).toString();
}

function formatCompactNumber(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 10000) {
    return `${formatDecimal(value / 1000)}K`;
  }

  if (absolute >= 1000) {
    return `${formatDecimal(value / 1000)}K`;
  }

  return formatInteger(value);
}

function laneName(lane: number): string {
  if (lane === 1) {
    return "优势路";
  }

  if (lane === 2) {
    return "中路";
  }

  if (lane === 3) {
    return "劣势路";
  }

  if (lane === 4) {
    return "野区";
  }

  return "未知分路";
}

function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatClock(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const absolute = Math.abs(seconds);
  const minutes = Math.floor(absolute / 60);
  const remainingSeconds = absolute % 60;

  return `${sign}${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function toIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}
