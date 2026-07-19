import type { CSSProperties } from "react";
import type {
  AppRoute,
  HeroLeaderboardCandidate,
  HeroLeaderboardItem,
  MatchData,
  MatchRecord,
  PlayerDirectoryItem,
  PlayerStats,
  ProfileMatchSummary,
  ScheduleGroup,
  StageKey,
  StageView,
  TeamSide,
} from "./data";
import type { MobileData } from "./api";

export type PlayerSortKey =
  | "displayName"
  | "totalMatches"
  | "winRate"
  | "kda"
  | "avgKills"
  | "avgGpm"
  | "avgXpm"
  | "avgHeroDamage"
  | "avgTowerDamage"
  | "avgDamageTaken";

export type SortDirection = "asc" | "desc";

export const stageOptions: Array<{ key: StageKey; label: string }> = [
  { key: "group", label: "小组赛" },
  { key: "swiss", label: "瑞士轮" },
  { key: "knockout", label: "淘汰赛" },
];

export const playerSortOptions: Array<{
  key: PlayerSortKey;
  label: string;
  defaultDirection: SortDirection;
}> = [
  { key: "totalMatches", label: "场次", defaultDirection: "desc" },
  { key: "winRate", label: "胜率", defaultDirection: "desc" },
  { key: "kda", label: "KDA", defaultDirection: "desc" },
  { key: "avgKills", label: "击杀", defaultDirection: "desc" },
  { key: "avgGpm", label: "GPM", defaultDirection: "desc" },
  { key: "avgXpm", label: "XPM", defaultDirection: "desc" },
  { key: "avgHeroDamage", label: "伤害", defaultDirection: "desc" },
  { key: "avgTowerDamage", label: "建筑", defaultDirection: "desc" },
  { key: "avgDamageTaken", label: "承伤", defaultDirection: "desc" },
  { key: "displayName", label: "名字", defaultDirection: "asc" },
];

export const emptyIcon = { label: "-", imageUrl: "" };

export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function statusClass(status: string): string {
  if (status === "已完赛" || status === "晋级区" || status === "completed") {
    return "green";
  }
  if (status === "延期" || status === "淘汰区" || status === "archived") {
    return "red";
  }
  if (status === "待补录" || status === "running") {
    return "blue";
  }
  return "";
}

export function lifecycleLabel(status: string): string {
  const text: Record<string, string> = {
    draft: "草稿",
    upcoming: "未开赛",
    running: "进行中",
    completed: "已结束",
    archived: "归档",
    unknown: "未知",
  };

  return text[status] ?? status;
}

export function officialScheduleStatusText(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "withdrawn":
      return "已撤回";
    case "published":
      return "已发布";
    case "unconfigured":
      return "未配置";
    default:
      return status;
  }
}

export function officialStageOptions(data: MobileData): typeof stageOptions {
  const activeKeys = new Set(data.officialStageKeys);

  return stageOptions.filter((option) => activeKeys.has(option.key));
}

export function parseScheduleScore(
  score: string | undefined,
): { left: number; right: number } | null {
  const match = score?.match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
  return match ? { left: Number(match[1]), right: Number(match[2]) } : null;
}

export const allRecordTeamFilter = "全部";

export function buildRecordTeamFilterOptions(
  records: MatchRecord[],
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();

  records.forEach((record) => {
    const names = new Set(
      [record.radiantTeamName, record.direTeamName].map(cleanRecordTeamName).filter(Boolean),
    );
    names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  });

  return [
    { label: allRecordTeamFilter, count: records.length },
    ...[...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
      .map(([label, count]) => ({ label, count })),
  ];
}

export function matchRecordHasTeam(record: MatchRecord, teamName: string): boolean {
  const normalized = cleanRecordTeamName(teamName);

  return [record.radiantTeamName, record.direTeamName].some(
    (name) => cleanRecordTeamName(name) === normalized,
  );
}

function cleanRecordTeamName(name: string): string {
  const normalized = name.trim();

  return normalized === "天辉" || normalized === "夜魇" ? "" : normalized;
}

export function sortScheduleGroups(
  groups: ScheduleGroup[],
  direction: SortDirection,
): ScheduleGroup[] {
  const scheduledGroups = groups.filter((group) => !isTentativeScheduleGroup(group));
  const tentativeGroups = groups.filter(isTentativeScheduleGroup);

  if (direction === "asc") {
    return [...scheduledGroups, ...tentativeGroups];
  }

  const reversedScheduledGroups = scheduledGroups
    .slice()
    .reverse()
    .map((group) => ({ ...group, matches: group.matches.slice().reverse() }));

  return [...reversedScheduledGroups, ...tentativeGroups];
}

function isTentativeScheduleGroup(group: ScheduleGroup): boolean {
  return group.date === "待定日期" || group.matches.every((match) => match.time === "时间待定");
}

export function getWardTimelineMaxSecond(match: MatchData): number {
  const durationSeconds = parseClockText(match.duration);
  const lastWardSecond = Math.max(0, ...match.wardTimeline.map((event) => event.timeSeconds));

  return Math.max(600, durationSeconds, lastWardSecond + 120);
}

export function isWardVisibleAt(
  event: MatchData["wardTimeline"][number],
  selectedSecond: number,
): boolean {
  return event.timeSeconds <= selectedSecond && selectedSecond <= wardExpiresAt(event);
}

function wardExpiresAt(event: MatchData["wardTimeline"][number]): number {
  const lifetime = event.type === "岗哨守卫" ? 420 : 360;

  return event.removedAt !== null && event.removedAt > event.timeSeconds
    ? event.removedAt
    : event.timeSeconds + lifetime;
}

export function wardDisplayType(event: MatchData["wardTimeline"][number]): string {
  return event.type === "岗哨守卫" ? "真眼" : "假眼";
}

export function uniqueWardEvents(events: MatchData["wardTimeline"]): MatchData["wardTimeline"] {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = `${event.timeSeconds}:${event.side}:${event.type}:${event.x}:${event.y}:${event.note}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function parseClockText(value: string | null | undefined): number {
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

export function formatWardClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type TrendPointSeries = MatchData["trends"]["goldAdvantage"];

export function sampleTrend(points: TrendPointSeries, targetCount: number): TrendPointSeries {
  if (points.length <= targetCount) {
    return points;
  }

  const step = (points.length - 1) / (targetCount - 1);

  return Array.from({ length: targetCount }, (_, index) => points[Math.round(index * step)]).filter(
    (point): point is TrendPointSeries[number] => point !== undefined,
  );
}

export function trendPolyline(
  points: TrendPointSeries,
  options: { maxAbs: number; width: number; height: number },
): string {
  const { maxAbs, width, height } = options;
  const padding = 8;
  const denominator = Math.max(1, points.length - 1);

  return points
    .map((point, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height / 2 - (point.value / maxAbs) * (height / 2 - padding);

      return `${x.toFixed(1)},${clampNumber(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

export function playerTrendPolyline(
  values: number[],
  maxValue: number,
  width: number,
  height: number,
): string {
  const padding = 8;
  const denominator = Math.max(1, values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height - padding - (value / maxValue) * (height - padding * 2);

      return `${x.toFixed(1)},${clampNumber(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

export function playerTrendHeroName(
  match: MatchData,
  trend: MatchData["trends"]["playerGold"][number],
): string {
  return (
    match.players.find((player) => player.id === String(trend.playerSlot))?.hero ?? trend.playerName
  );
}

export function playerTrendColor(index: number, side: TeamSide): string {
  const radiantColors = ["#75e06c", "#9fe870", "#45d1a4", "#54c7ff", "#d6f06b"];
  const direColors = ["#ff646d", "#ff9b5f", "#d96bff", "#ff5fb7", "#f0c36a"];
  const palette = side === "radiant" ? radiantColors : direColors;

  return palette[index % palette.length]!;
}

export function formatTrendValue(value: number): string {
  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${compactNumber(value)}`;
}

export function leaderboardTeamName(candidate: HeroLeaderboardCandidate): string {
  const team = candidate.player.currentTeam ?? candidate.player.teams[0] ?? null;

  return team?.name || team?.shortName || "自由人";
}

export function formatLeaderboardValue(
  value: number,
  board: Pick<HeroLeaderboardItem, "precision" | "unit">,
): string {
  const normalized =
    Math.abs(value) >= 1000 ? compactNumber(value) : trimFixed(value, board.precision);

  return board.unit ? `${normalized}${board.unit}` : normalized;
}

export function formatLeaderboardTotal(
  value: number,
  board: Pick<HeroLeaderboardItem, "precision" | "unit">,
): string {
  const normalized =
    Math.abs(value) >= 1000 ? compactNumber(value) : trimFixed(value, Math.min(board.precision, 1));

  return board.unit ? `${normalized}${board.unit}` : normalized;
}

function trimFixed(value: number, digits: number): string {
  return value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1000) {
    return `${(value / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  }

  return String(Math.round(value));
}

export function kdaRatio(player: PlayerStats): string {
  if (player.deaths === 0) {
    return String(player.kills + player.assists);
  }

  return ((player.kills + player.assists) / player.deaths).toFixed(1);
}

export function defaultTalentTreeNodes(): PlayerStats["talentTree"] {
  return ([4, 3, 2, 1] as const).flatMap((tier) =>
    (["left", "right"] as const).map((side) => ({
      tier,
      side,
      picked: false,
      label: "天赋",
    })),
  );
}

export function talentBranchPath(
  tier: PlayerStats["talentTree"][number]["tier"],
  side: PlayerStats["talentTree"][number]["side"],
): string {
  const paths: Record<string, string> = {
    "1-left":
      "M0.013,44.716c0,0,6.586,6.584,9.823,6.805c3.236,0.224,7.033,0,7.033,0s7.024,1.732,7.024,7.368V63 l3.195-0.014c0,0,0-3.782,0-5.571c0-6.857-10.053-7.567-10.053-7.567S11.957,41.979,0.013,44.716z",
    "1-right":
      "M51,44.716c0,0-6.586,6.584-9.823,6.805c-3.235,0.224-7.032,0-7.032,0s-7.024,1.732-7.024,7.368V63 l-3.195-0.014c0,0,0-3.782,0-5.571c0-6.857,10.052-7.567,10.052-7.567S39.057,41.979,51,44.716z",
    "2-left":
      "M0,30.326c0,0,5.744,9.07,9.516,9.495c3.1,0.348,6.542,0.107,8.122,0.262 c3.068,0.301,6.256,1.351,6.256,5.667V63h3.181c0,0,0-17.488,0-18.454c0-0.964-0.006-5.235-7.093-6.584 c-1.207-0.232-3.687-0.281-4.913-0.281C15.068,37.681,10.547,29.951,0,30.326z",
    "2-right":
      "M51,30.326c0,0-5.745,9.07-9.517,9.495c-3.1,0.348-6.542,0.107-8.12,0.262 c-3.069,0.301-6.257,1.351-6.257,5.667V63h-3.182c0,0,0-17.488,0-18.454c0-0.964,0.006-5.235,7.093-6.584 c1.208-0.232,3.688-0.281,4.913-0.281C35.931,37.681,40.451,29.951,51,30.326z",
    "3-left":
      "M4.031,16.042c0,0,0.669,3.435,2.899,6.315c2.232,2.878,4.147,4.891,6.489,4.891 c2.344,0,6.208-0.01,7.68,0.868c1.837,1.095,2.803,3.213,2.803,5.373c0,0.976,0,29.511,0,29.511h3.173V33.489 c0,0-0.085-3.859-3.102-6.426c-1.651-1.405-2.911-2.141-5.294-2.141c-0.908,0-2.041-0.019-2.041-0.019s-1.785-4.153-5.188-6.203 C8.046,16.651,4.031,16.042,4.031,16.042z",
    "3-right":
      "M46.969,16.042c0,0-0.669,3.435-2.898,6.315c-2.232,2.878-4.147,4.891-6.489,4.891 c-2.344,0-6.208-0.01-7.68,0.868c-1.837,1.095-2.803,3.213-2.803,5.373c0,0.976,0,29.511,0,29.511h-3.174V33.489 c0,0,0.086-3.859,3.103-6.426c1.651-1.405,2.911-2.141,5.295-2.141c0.907,0,2.041-0.019,2.041-0.019s1.785-4.153,5.187-6.203 C42.954,16.651,46.969,16.042,46.969,16.042z",
    "4-left":
      "M11.033,0c0,0-0.802,7.891,2.625,11.654c3.426,3.761,5.55,2.683,7.765,3.097 c1.969,0.369,2.479,1.772,2.479,3.984c0,2.212,0,44.209,0,44.209h3.101c0,0,0.072-43.305,0.072-44.209 c0-0.905-0.019-4.906-3.792-6.115c-1.592-0.509-2.334-0.376-2.918-2.293C19.782,8.408,17.96,1.99,11.033,0z",
    "4-right":
      "M39.967,0c0,0,0.803,7.891-2.625,11.654c-3.426,3.761-5.551,2.683-7.765,3.097 c-1.969,0.369-2.479,1.772-2.479,3.984c0,2.212,0,44.209,0,44.209h-3.101c0,0-0.073-43.305-0.073-44.209 c0-0.905,0.02-4.906,3.793-6.115c1.592-0.509,2.335-0.376,2.917-2.293C31.218,8.408,33.04,1.99,39.967,0z",
  };

  return paths[`${tier}-${side}`] ?? paths["1-left"]!;
}

export const talentArcDots = [
  "M3.258 23.38c.295-.22.624-.303.992-.238.362.057.651.235.868.536.217.3.298.634.243 1.002-.05.376-.225.67-.52.891a1.24 1.24 0 01-1.002.244 1.275 1.275 0 01-.868-.535 1.315 1.315 0 01-.242-1.002c.05-.377.225-.671.529-.898z",
  "M6.244 26.987c.215-.301.503-.482.873-.534.361-.06.69.02.988.24.297.218.474.51.532.878.067.374-.012.708-.227 1.01-.221.31-.51.491-.88.544a1.263 1.263 0 01-.987-.24 1.302 1.302 0 01-.533-.879 1.291 1.291 0 01.234-1.019z",
  "M10.17 29.492c.114-.355.333-.617.669-.783a1.26 1.26 0 011.012-.082c.349.115.607.338.773.669.177.335.204.677.091 1.032a1.27 1.27 0 01-.671.793 1.26 1.26 0 01-1.012.082 1.284 1.284 0 01-.774-.669 1.294 1.294 0 01-.087-1.042z",
  "M14.684 30.638c0-.373.129-.69.398-.954.258-.264.57-.396.938-.396.366 0 .68.13.938.393.27.262.4.58.4.953.002.383-.127.701-.397.965a1.268 1.268 0 01-.937.396c-.367 0-.68-.13-.939-.393-.27-.263-.4-.58-.4-.964z",
  "M19.302 30.322a1.287 1.287 0 01.09-1.032c.165-.331.423-.555.771-.67a1.26 1.26 0 011.013.08c.336.166.556.428.67.782.116.365.09.708-.087 1.043a1.284 1.284 0 01-.772.67 1.26 1.26 0 01-1.013-.08 1.27 1.27 0 01-.672-.793z",
  "M23.614 28.564a1.284 1.284 0 01-.23-1.01c.058-.367.234-.66.53-.88.297-.219.626-.3.988-.241.37.051.659.231.874.532.223.31.302.645.236 1.019-.057.367-.234.66-.53.88-.297.219-.626.3-.988.241a1.252 1.252 0 01-.88-.541z",
  "M27.184 25.537a1.272 1.272 0 01-.523-.89 1.316 1.316 0 01.24-1.002c.215-.302.504-.48.866-.538.368-.067.697.015.993.234.305.226.481.52.531.896.057.368-.023.702-.239 1.003-.216.301-.505.48-.866.538a1.24 1.24 0 01-1.002-.241z",
];

export function profileMatchToRecord(match: ProfileMatchSummary, tournamentName = ""): MatchRecord {
  const [fallbackRadiantScore, fallbackDireScore] = parseProfileScore(match.score);
  const radiantScore = match.radiantScore ?? fallbackRadiantScore;
  const direScore = match.direScore ?? fallbackDireScore;
  const radiantWin =
    match.radiantWin ??
    (match.side === null || match.result === "unknown"
      ? null
      : match.side === "radiant"
        ? match.result === "win"
        : match.result === "loss");

  return {
    matchId: match.matchId,
    leagueName: "",
    tournamentName,
    startTime: match.startTime,
    duration: match.duration,
    radiantTeamName: match.radiantTeamName,
    direTeamName: match.direTeamName,
    radiantScore,
    direScore,
    radiantWin,
    parseStatus: "比赛记录",
    playerCount: match.playerCount,
    heroLineups: match.heroLineups,
    hasDraft: match.hasDraft,
    hasVision: match.hasVision,
    hasChat: match.hasChat,
  };
}

function parseProfileScore(score: string): [number | null, number | null] {
  const parts = score.split(":");
  const left = Number(parts[0]?.trim() ?? "");
  const right = Number(parts[1]?.trim() ?? "");

  return [Number.isFinite(left) ? left : null, Number.isFinite(right) ? right : null];
}

export function sortTournamentPlayers(
  players: PlayerDirectoryItem[],
  sortKey: PlayerSortKey,
  direction: SortDirection,
): PlayerDirectoryItem[] {
  return [...players].sort((left, right) => comparePlayers(left, right, sortKey, direction));
}

function comparePlayers(
  left: PlayerDirectoryItem,
  right: PlayerDirectoryItem,
  key: PlayerSortKey,
  direction: SortDirection,
): number {
  if (key === "displayName") {
    const result =
      left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
    return direction === "asc" ? result : -result;
  }

  const leftValue = numericStatValue(left, key);
  const rightValue = numericStatValue(right, key);

  if (leftValue === null && rightValue === null) {
    return (
      left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id)
    );
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  const result = leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
  const normalized = direction === "asc" ? result : -result;

  return (
    normalized ||
    left.displayName.localeCompare(right.displayName, "zh-CN") ||
    left.id.localeCompare(right.id)
  );
}

export function numericStatValue(player: PlayerDirectoryItem, key: PlayerSortKey): number | null {
  switch (key) {
    case "totalMatches":
      return player.stats.totalMatches;
    case "winRate":
      return parseStatNumber(player.stats.winRate);
    case "kda":
      return parseStatNumber(player.stats.kda);
    case "avgKills":
      return parseStatNumber(player.stats.avgKills);
    case "avgGpm":
      return parseStatNumber(player.stats.avgGpm);
    case "avgXpm":
      return parseStatNumber(player.stats.avgXpm);
    case "avgHeroDamage":
      return parseStatNumber(player.stats.avgHeroDamage);
    case "avgTowerDamage":
      return parseStatNumber(player.stats.avgTowerDamage);
    case "avgDamageTaken":
      return parseStatNumber(player.stats.avgDamageTaken);
    case "displayName":
      return null;
  }
}

function parseStatNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0 || normalized === "-") {
    return null;
  }

  const multiplier = normalized.endsWith("k") ? 1000 : 1;
  const parsed = Number.parseFloat(normalized.replace(/[%k,]/g, ""));

  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

export function formatHeroWinRate(wins: number, picks: number): string {
  if (picks <= 0) {
    return "-";
  }

  return `${Math.round((wins / picks) * 100)}%`;
}

export function getTeam(match: MatchData, side: TeamSide) {
  return side === "radiant" ? match.radiant : match.dire;
}

export const ungroupedStandingKey = "__all__";

export type StandingTeamMember = Pick<
  PlayerDirectoryItem,
  "id" | "accountId" | "displayName" | "avatarUrl"
>;
export type StandingTeamMemberLookup = Map<string, StandingTeamMember[]>;

export function buildStandingTeamMemberLookup(data: MobileData): StandingTeamMemberLookup {
  const lookup: StandingTeamMemberLookup = new Map();

  for (const team of data.teams) {
    addStandingTeamMembers(lookup, standingTeamLookupKeys(team), team.members);
  }

  for (const player of data.players) {
    const teams = player.currentTeam ? [player.currentTeam] : player.teams;

    for (const team of teams) {
      addStandingTeamMembers(lookup, standingTeamLookupKeys(team), [player]);
    }
  }

  return lookup;
}

export function standingMembersForRow(
  row: StageView["standings"][number],
  lookup: StandingTeamMemberLookup,
): StandingTeamMember[] {
  for (const key of standingTeamLookupKeys({
    id: row.teamId,
    name: row.team,
    shortName: row.team,
  })) {
    const members = lookup.get(key);

    if (members && members.length > 0) {
      return members;
    }
  }

  return [];
}

export function standingRowKey(row: StageView["standings"][number]): string {
  return row.teamId || `${row.groupName ?? "all"}:${row.team}`;
}

function standingTeamLookupKeys(team: {
  id?: string | null;
  name?: string | null;
  shortName?: string | null;
}): string[] {
  const keys: string[] = [];

  if (team.id) {
    keys.push(`id:${team.id}`);
  }

  for (const value of [team.name, team.shortName]) {
    const normalized = normalizeStandingLookupValue(value);

    if (normalized) {
      keys.push(`name:${normalized}`);
    }
  }

  return [...new Set(keys)];
}

function addStandingTeamMembers(
  lookup: StandingTeamMemberLookup,
  keys: string[],
  members: StandingTeamMember[],
): void {
  if (keys.length === 0 || members.length === 0) {
    return;
  }

  for (const key of keys) {
    const current = lookup.get(key) ?? [];
    const seen = new Set(current.map((member) => member.id || member.displayName));

    for (const member of members) {
      const memberKey = member.id || member.displayName;

      if (!seen.has(memberKey)) {
        current.push(member);
        seen.add(memberKey);
      }
    }

    lookup.set(key, current);
  }
}

function normalizeStandingLookupValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function standingMemberDisplayId(member: StandingTeamMember): string {
  return member.displayName || (member.accountId === null ? "未登记" : String(member.accountId));
}

export function groupStandingRows(
  rows: StageView["standings"],
): Array<{ key: string; label: string; rows: StageView["standings"] }> {
  const groups = new Map<string, { key: string; label: string; rows: StageView["standings"] }>();

  for (const row of rows) {
    const groupName = row.groupName?.trim() || "";
    const key = groupName || ungroupedStandingKey;
    const group = groups.get(key) ?? { key, label: groupName || "总榜", rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: [...group.rows].sort((left, right) => left.rank - right.rank),
  }));
}

export function bracketGroupSortValue(groupName: string): number {
  if (groupName === "single") return 0;
  if (groupName === "winner") return 1;
  if (groupName === "loser") return 2;
  if (groupName === "grand_final") return 3;
  return 4;
}

export const BRACKET_COLUMN_WIDTH = 240;
export const BRACKET_COLUMN_GAP = 56;
export const BRACKET_ROUND_TITLE_HEIGHT = 26;
export const BRACKET_ROUND_GAP = 12;
export const BRACKET_ROW_HEIGHT = 168;
export const BRACKET_ROW_GAP = 18;

export function bracketTrackWidth(columnCount: number): number {
  return columnCount * BRACKET_COLUMN_WIDTH + Math.max(0, columnCount - 1) * BRACKET_COLUMN_GAP;
}

export function bracketTrackHeight(rowCount: number): number {
  return (
    BRACKET_ROUND_TITLE_HEIGHT +
    BRACKET_ROUND_GAP +
    rowCount * BRACKET_ROW_HEIGHT +
    Math.max(0, rowCount - 1) * BRACKET_ROW_GAP
  );
}

export function bracketConnectorPath(
  source: { columnIndex: number; gridRowStart: number; rowSpan: number },
  target: { columnIndex: number; gridRowStart: number; rowSpan: number },
): string {
  const sourceX =
    source.columnIndex * (BRACKET_COLUMN_WIDTH + BRACKET_COLUMN_GAP) + BRACKET_COLUMN_WIDTH;
  const targetX = target.columnIndex * (BRACKET_COLUMN_WIDTH + BRACKET_COLUMN_GAP);
  const midX = sourceX + (targetX - sourceX) / 2;
  const sourceY = bracketNodeCenterY(source.gridRowStart, source.rowSpan);
  const targetY = bracketNodeCenterY(target.gridRowStart, target.rowSpan);

  return `M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`;
}

function bracketNodeCenterY(gridRowStart: number, rowSpan: number): number {
  const rowTop = (gridRowStart - 1) * (BRACKET_ROW_HEIGHT + BRACKET_ROW_GAP);
  const spanHeight = rowSpan * BRACKET_ROW_HEIGHT + Math.max(0, rowSpan - 1) * BRACKET_ROW_GAP;
  return BRACKET_ROUND_TITLE_HEIGHT + BRACKET_ROUND_GAP + rowTop + spanHeight / 2;
}

export function formatBracketTarget(
  nodes: Map<string, StageView["bracket"][number]>,
  nodeId: string | null,
  slot: "radiant" | "dire" | null,
  fallback: string,
): string {
  if (!nodeId) return fallback;
  const node = nodes.get(nodeId);
  const slotLabel = slot === "radiant" ? "上位" : slot === "dire" ? "下位" : "待定槽";
  return node ? `${node.groupName} #${node.position} ${slotLabel}` : `下一节点 ${slotLabel}`;
}

export type StageBracketGroupLayout = {
  key: string;
  label: string;
  rounds: Map<string, { roundNumber: number; roundName: string; nodes: StageView["bracket"] }>;
};

export type UnifiedStageBracketColumn = {
  key: string;
  groupKey: string;
  roundName: string;
  displayColumn: number;
  rowCount: number;
  nodes: StageView["bracket"];
};

export type StageFinalConnectorOverlay = {
  width: number;
  height: number;
  paths: Array<{ id: string; kind: "winner" | "loser"; d: string }>;
};

export function buildUnifiedStageBracketLayout(
  groups: StageBracketGroupLayout[],
  nodes: StageView["bracket"],
) {
  const winnerGroup = groups.find((group) => group.key === "winner") ?? null;
  const loserGroup = groups.find((group) => group.key === "loser") ?? null;
  const grandFinalGroup = groups.find((group) => group.key === "grand_final") ?? null;

  if (!winnerGroup || !loserGroup || !grandFinalGroup) {
    return null;
  }

  const groupColumns = (group: StageBracketGroupLayout) =>
    [...group.rounds.entries()]
      .sort(
        ([, roundA], [, roundB]) =>
          roundA.roundNumber - roundB.roundNumber ||
          roundA.roundName.localeCompare(roundB.roundName),
      )
      .map(([roundKey, round]) => ({
        key: roundKey,
        roundName: round.roundName,
        nodes: round.nodes.slice().sort((a, b) => a.position - b.position),
      }));
  const winnerColumnsRaw = groupColumns(winnerGroup);
  const loserColumnsRaw = groupColumns(loserGroup);
  const grandFinalColumnsRaw = groupColumns(grandFinalGroup);
  const firstLoserColumnNodeIds = new Set(loserColumnsRaw[0]?.nodes.map((node) => node.id) ?? []);
  const firstLoserRoundReceivesWinnerDrop = nodes.some(
    (node) =>
      node.bracketGroup === "winner" &&
      node.loserNextNodeId !== null &&
      firstLoserColumnNodeIds.has(node.loserNextNodeId),
  );
  const loserOpeningColumnOffset = firstLoserRoundReceivesWinnerDrop ? 1 : 0;
  const winnerRowCount = Math.max(1, ...winnerColumnsRaw.map((column) => column.nodes.length));
  const loserRowCount = Math.max(1, ...loserColumnsRaw.map((column) => column.nodes.length));
  const winnerColumns = winnerColumnsRaw.map((column, index) => ({
    ...column,
    groupKey: "winner",
    displayColumn: index + 1,
    rowCount: winnerRowCount,
  }));
  const loserColumns = loserColumnsRaw.map((column, index) => ({
    ...column,
    groupKey: "loser",
    displayColumn: index + loserOpeningColumnOffset,
    rowCount: loserRowCount,
  }));
  const winnerFinalColumn = Math.max(...winnerColumns.map((column) => column.displayColumn));
  const loserFinalColumn = Math.max(...loserColumns.map((column) => column.displayColumn));
  const grandFinalDisplayColumn = Math.max(winnerFinalColumn, loserFinalColumn) + 1;
  const grandFinalColumns = grandFinalColumnsRaw.map((column, index) => ({
    ...column,
    groupKey: "grand_final",
    displayColumn: grandFinalDisplayColumn + index,
    rowCount: 1,
  }));
  const columns: UnifiedStageBracketColumn[] = [
    ...winnerColumns,
    ...loserColumns,
    ...grandFinalColumns,
  ].sort(
    (left, right) =>
      left.displayColumn - right.displayColumn ||
      bracketGroupSortValue(left.groupKey) - bracketGroupSortValue(right.groupKey) ||
      left.roundName.localeCompare(right.roundName),
  );
  const columnCount = Math.max(...columns.map((column) => column.displayColumn)) + 1;

  return { columns, columnCount };
}

export function measureStageFinalConnectorOverlay(
  container: HTMLElement | null,
  nodes: StageView["bracket"],
): StageFinalConnectorOverlay | null {
  if (!container) {
    return null;
  }

  const grandFinalNode = nodes.find((node) => node.bracketGroup === "grand_final") ?? null;
  if (!grandFinalNode) {
    return null;
  }

  const targetElement = container.querySelector<HTMLElement>(
    bracketNodeDataSelector(grandFinalNode.id),
  );
  if (!targetElement) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const targetX = targetRect.left - containerRect.left;
  const targetY = targetRect.top - containerRect.top + targetRect.height / 2;
  const paths = nodes
    .filter(
      (node) =>
        node.nextNodeId === grandFinalNode.id &&
        (node.bracketGroup === "winner" || node.bracketGroup === "loser"),
    )
    .sort(
      (left, right) =>
        bracketGroupSortValue(left.bracketGroup) - bracketGroupSortValue(right.bracketGroup),
    )
    .map((node) => {
      const sourceElement = container.querySelector<HTMLElement>(bracketNodeDataSelector(node.id));
      if (!sourceElement) {
        return null;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const sourceX = sourceRect.right - containerRect.left;
      const sourceY = sourceRect.top - containerRect.top + sourceRect.height / 2;
      const distance = Math.max(1, targetX - sourceX);
      const midX = sourceX + Math.max(24, distance * 0.62);
      const d = `M ${sourceX} ${sourceY} H ${midX} C ${midX + 18} ${sourceY} ${midX + 18} ${targetY} ${targetX} ${targetY}`;

      return { id: node.id, kind: node.bracketGroup as "winner" | "loser", d };
    })
    .filter((path): path is { id: string; kind: "winner" | "loser"; d: string } => path !== null);

  return paths.length > 0
    ? { width: container.scrollWidth, height: container.scrollHeight, paths }
    : null;
}

function bracketNodeDataSelector(nodeId: string): string {
  return `[data-bracket-node-id="${nodeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

export function emptyMobileData(): MobileData {
  return {
    apiBaseUrl: "/api",
    source: "unavailable",
    selectedTournamentId: "",
    selectedTournamentName: "MRJZ",
    selectedTournamentMeta: {
      status: "unknown",
      statusText: "--",
      startsAt: "时间待定",
      endsAt: "时间待定",
      leagueId: "-",
    },
    tournamentOptions: [],
    tournamentStats: [],
    officialStageKeys: [],
    stageViews: emptyStageViews(),
    scheduleGroups: [],
    officialSchedule: {
      status: "unconfigured",
      isPublished: false,
      rosterLocked: false,
      publishedAt: null,
      withdrawnAt: null,
    },
    matchRecords: [],
    tournamentRecentRecords: {},
    acknowledgements: [],
    heroLeaderboards: {
      tournamentId: "",
      tournamentName: "MRJZ",
      basis: "mixed",
      minMatches: 5,
      leaderboards: [],
    },
    players: [],
    teams: [],
    featuredMatch: emptyMatchData(),
    notice: null,
  };
}

function emptyStageViews(): MobileData["stageViews"] {
  return {
    group: {
      key: "group",
      name: "小组赛",
      status: "暂无",
      currentRound: "暂无",
      note: "",
      standings: [],
      bracket: [],
    },
    swiss: {
      key: "swiss",
      name: "瑞士轮",
      status: "暂无",
      currentRound: "暂无",
      note: "",
      standings: [],
      bracket: [],
    },
    knockout: {
      key: "knockout",
      name: "淘汰赛",
      status: "暂无",
      currentRound: "暂无",
      note: "",
      standings: [],
      bracket: [],
    },
  };
}

export function emptyMatchData(): MatchData {
  return {
    id: "-",
    league: "MRJZ",
    series: "",
    mode: "未知模式",
    endedAt: "时间待定",
    duration: "--:--",
    radiantScore: 0,
    direScore: 0,
    winner: "radiant",
    radiant: { side: "radiant", name: "天辉", shortName: "天辉", seed: "天辉", color: "#78d66c" },
    dire: { side: "dire", name: "夜魇", shortName: "夜魇", seed: "夜魇", color: "#ef6467" },
    mvpPlayerId: "",
    parseStatus: "暂无",
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
    awards: [],
    chat: [],
  };
}

export const routeOptions: Array<{ key: AppRoute; label: string; kicker: string }> = [
  { key: "home", label: "首页", kicker: "HOME" },
  { key: "stage", label: "赛事阶段", kicker: "STAGE" },
  { key: "schedule", label: "赛程", kicker: "SCHEDULE" },
  { key: "records", label: "比赛记录", kicker: "RECORDS" },
  { key: "match", label: "比赛详情", kicker: "MATCH" },
  { key: "leaderboard", label: "英雄榜", kicker: "AWARDS" },
  { key: "players", label: "选手", kicker: "PLAYERS" },
  { key: "teams", label: "队伍", kicker: "TEAMS" },
];

export const primaryNavRoutes = routeOptions.filter((route) => route.key !== "match");

const routeSet = new Set<AppRoute>([...routeOptions.map((route) => route.key), "player", "team"]);

export function isRoute(value: string | undefined): value is AppRoute {
  return Boolean(value && routeSet.has(value as AppRoute));
}

export function readRouteFromHash(): AppRoute {
  const rawRoute = window.location.hash.replace("#", "").split("/")[0];
  if (rawRoute === "tags") {
    return "players";
  }
  return isRoute(rawRoute) ? rawRoute : "home";
}

export function readProfileIdFromHash(): string | null {
  const [, rawProfileId] = window.location.hash.replace("#", "").split("/");

  return rawProfileId ? decodeURIComponent(rawProfileId) : null;
}

export function routeLabel(route: AppRoute): string {
  if (route === "player") {
    return "选手主页";
  }

  if (route === "team") {
    return "队伍主页";
  }

  return routeOptions.find((option) => option.key === route)?.label ?? "MRJZ";
}

export function activePrimaryNavRoute(route: AppRoute): AppRoute {
  if (route === "player") {
    return "players";
  }

  if (route === "team") {
    return "teams";
  }

  return route;
}
