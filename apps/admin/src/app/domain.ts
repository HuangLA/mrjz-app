import type { BracketNode, SeriesSummary, StageGroup, StageRound, StandingRow, TeamBrief } from "../api";

export type SeriesFilterMode = "all" | "todo" | "result" | "match";
export type BracketSlotName = "radiant" | "dire";

export function seriesHasResult(series: SeriesSummary): boolean {
  return series.status === "completed" || series.status === "result_pending" || series.radiantScore + series.direScore > 0;
}

export function seriesNeedsResult(series: SeriesSummary): boolean {
  return !["cancelled", "postponed"].includes(series.status ?? "") && !seriesHasResult(series);
}

export function countMissingSeriesMatchIds(series: SeriesSummary): number {
  return series.games.filter((game) => game.matchId === null || game.matchId === undefined).length;
}

export function seriesMatchesFilterMode(series: SeriesSummary, mode: SeriesFilterMode): boolean {
  if (mode === "all") return true;
  if (mode === "result") return seriesNeedsResult(series);
  if (mode === "match") return countMissingSeriesMatchIds(series) > 0;
  return seriesNeedsResult(series) || countMissingSeriesMatchIds(series) > 0;
}

export function matchesSeriesQuery(series: SeriesSummary, query: string, labelStatus: (value: string | null | undefined) => string): boolean {
  if (!query) return true;
  const searchable = [
    series.radiantTeam.name,
    series.direTeam.name,
    series.groupName ?? "",
    series.boType,
    labelStatus(series.status),
    ...series.games.map((game) => game.matchId?.toString() ?? ""),
  ].join(" ").toLowerCase();
  return searchable.includes(query);
}

export function compareSeriesTodoPriority(left: SeriesSummary, right: SeriesSummary): number {
  const leftPriority = seriesNeedsResult(left) ? 0 : countMissingSeriesMatchIds(left) > 0 ? 1 : 2;
  const rightPriority = seriesNeedsResult(right) ? 0 : countMissingSeriesMatchIds(right) > 0 ? 1 : 2;
  return leftPriority - rightPriority;
}

export function quickResultOptions(boType: string): Array<{ radiant: number; dire: number }> {
  if (boType === "BO1") return [{ radiant: 1, dire: 0 }, { radiant: 0, dire: 1 }];
  if (boType === "BO3") return [{ radiant: 2, dire: 0 }, { radiant: 2, dire: 1 }, { radiant: 1, dire: 2 }, { radiant: 0, dire: 2 }];
  if (boType === "BO5") return [{ radiant: 3, dire: 0 }, { radiant: 3, dire: 1 }, { radiant: 3, dire: 2 }, { radiant: 2, dire: 3 }, { radiant: 1, dire: 3 }, { radiant: 0, dire: 3 }];
  return [{ radiant: 2, dire: 0 }, { radiant: 1, dire: 1 }, { radiant: 0, dire: 2 }];
}

export function teamPairKey(leftTeamId: string, rightTeamId: string): string {
  return [leftTeamId, rightTeamId].sort().join("::");
}

export function seriesPairKey(series: SeriesSummary): string {
  return teamPairKey(series.radiantTeam.id, series.direTeam.id);
}

export function isSameSeriesPair(series: SeriesSummary, leftTeamId: string, rightTeamId: string): boolean {
  return (
    (series.radiantTeam.id === leftTeamId && series.direTeam.id === rightTeamId)
    || (series.radiantTeam.id === rightTeamId && series.direTeam.id === leftTeamId)
  );
}

export interface TeamPair {
  left: TeamBrief;
  right: TeamBrief;
}

export function buildTeamPairDrafts(teams: TeamBrief[]): TeamPair[] {
  const pairs: TeamPair[] = [];
  for (let leftIndex = 0; leftIndex < teams.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < teams.length; rightIndex += 1) {
      const left = teams[leftIndex];
      const right = teams[rightIndex];
      if (left && right) pairs.push({ left, right });
    }
  }
  return pairs;
}

export function expectedGroupRegularSeriesCount(groups: StageGroup[]): number {
  return groups.reduce((total, group) => total + buildTeamPairDrafts(group.teams).length, 0);
}

export function scheduledGroupRegularSeriesCount(series: SeriesSummary[]): number {
  const pairKeys = new Set<string>();
  for (const item of series) {
    if (!item.groupId || item.seriesKind === "tiebreaker") continue;
    pairKeys.add(`${item.groupId}:${seriesPairKey(item)}`);
  }
  return pairKeys.size;
}

export function findNextGroupRegularPairSuggestion(
  groups: StageGroup[],
  rounds: StageRound[],
  preferredGroupId = "",
  extraPairKey?: string,
): { group: StageGroup; pair: TeamPair } | null {
  const findInGroup = (group: StageGroup | undefined): TeamPair | null => {
    if (!group) return null;
    const scheduledPairKeys = new Set(
      rounds
        .flatMap((round) => round.series)
        .filter((series) => series.groupId === group.id && series.seriesKind !== "tiebreaker")
        .map(seriesPairKey),
    );
    if (extraPairKey) scheduledPairKeys.add(extraPairKey);
    return buildTeamPairDrafts(group.teams).find((pair) => !scheduledPairKeys.has(teamPairKey(pair.left.id, pair.right.id))) ?? null;
  };

  const preferredGroup = groups.find((group) => group.id === preferredGroupId);
  const orderedGroups = preferredGroup ? [preferredGroup, ...groups.filter((group) => group.id !== preferredGroupId)] : groups;
  for (const group of orderedGroups) {
    const pair = findInGroup(group);
    if (pair) return { group, pair };
  }
  return null;
}

export function standingTeamId(row: StandingRow): string {
  return row.team?.id ?? row.teamId ?? "";
}

export function orderTeamsByStanding<T extends TeamBrief>(teams: T[], rows: StandingRow[]): T[] {
  const map = new Map(teams.map((team) => [team.id, team]));
  const rankedIds = rows.map(standingTeamId).filter(Boolean);
  const rankedTeams = rankedIds.flatMap((id) => {
    const team = map.get(id);
    return team ? [team] : [];
  });
  const rankedSet = new Set(rankedIds);
  return [...rankedTeams, ...teams.filter((team) => !rankedSet.has(team.id))];
}

export function findNextSwissPair(teams: TeamBrief[], standings: StandingRow[], rounds: StageRound[], extraPairKey?: string): TeamPair | null {
  const playedPairKeys = new Set(rounds.flatMap((round) => round.series).map(seriesPairKey));
  if (extraPairKey) playedPairKeys.add(extraPairKey);
  const orderedTeams = orderTeamsByStanding(teams, standings);
  const pairs = buildTeamPairDrafts(orderedTeams);
  return pairs.find((pair) => !playedPairKeys.has(teamPairKey(pair.left.id, pair.right.id))) ?? pairs[0] ?? null;
}

export function getBracketSlotSummary(nodes: BracketNode[]) {
  const incomingSlotKeys = new Set<string>();
  for (const node of nodes) {
    if (node.nextNodeId && node.nextSlot) incomingSlotKeys.add(`${node.nextNodeId}:${node.nextSlot}`);
    if (node.loserNextNodeId && node.loserNextSlot) incomingSlotKeys.add(`${node.loserNextNodeId}:${node.loserNextSlot}`);
  }
  const openSlots = nodes
    .filter((node) => node.winnerTeamId === null)
    .flatMap((node) => [
      node.radiantTeam ? null : { nodeId: node.id, slot: "radiant" as BracketSlotName },
      node.direTeam ? null : { nodeId: node.id, slot: "dire" as BracketSlotName },
    ])
    .filter((slot): slot is { nodeId: string; slot: BracketSlotName } => slot !== null);
  const manualOpenSlots = openSlots.filter((slot) => !incomingSlotKeys.has(`${slot.nodeId}:${slot.slot}`));
  const waitingOpenSlots = openSlots.filter((slot) => incomingSlotKeys.has(`${slot.nodeId}:${slot.slot}`));
  const filledSlots = nodes.reduce((sum, node) => sum + (node.radiantTeam ? 1 : 0) + (node.direTeam ? 1 : 0), 0);
  return {
    incomingSlotKeys,
    manualOpenSlots,
    waitingOpenSlots,
    totalSlots: nodes.length * 2,
    filledSlots,
    manualOpenSlotCount: manualOpenSlots.length,
    waitingOpenSlotCount: waitingOpenSlots.length,
  };
}

export function groupBracketNodes(nodes: BracketNode[]) {
  const groups = new Map<string, Map<string, { key: string; roundName: string; roundNumber: number; nodes: BracketNode[] }>>();

  for (const node of nodes) {
    const key = `${node.bracketGroup}:${node.roundNumber}:${node.roundName}`;
    const group = groups.get(node.bracketGroup) ?? new Map<string, { key: string; roundName: string; roundNumber: number; nodes: BracketNode[] }>();
    const item = group.get(key) ?? { key, roundName: node.roundName, roundNumber: node.roundNumber, nodes: [] };
    group.set(key, { ...item, nodes: [...item.nodes, node] });
    groups.set(node.bracketGroup, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => bracketGroupSortValue(left) - bracketGroupSortValue(right) || left.localeCompare(right))
    .map(([bracketGroup, rounds]) => {
      const columns = [...rounds.values()]
        .sort((left, right) => left.roundNumber - right.roundNumber || left.roundName.localeCompare(right.roundName))
        .map((round) => ({ ...round, nodes: [...round.nodes].sort((left, right) => left.position - right.position) }));

      return {
        key: bracketGroup,
        bracketGroup,
        columns,
        nodes: columns.flatMap((column) => column.nodes),
      };
    });
}

export function bracketGroupSortValue(group: string): number {
  if (group === "single") return 0;
  if (group === "winner") return 1;
  if (group === "loser") return 2;
  if (group === "grand_final") return 3;
  return 4;
}

export function bracketGroupLaneLabel(group: string): string {
  if (group === "winner") return "胜者组";
  if (group === "loser") return "败者组";
  if (group === "grand_final") return "总决赛";
  if (group === "single") return "淘汰赛";
  return group;
}

export function formatBracketTarget(nodes: Map<string, BracketNode>, nodeId: string | null, slot: string | null): string {
  if (!nodeId) return "终点";
  const node = nodes.get(nodeId);
  const slotLabel = slot === "radiant" ? "上位" : slot === "dire" ? "下位" : "待定槽";
  if (!node) return `下一节点 ${slotLabel}`;
  const groupLabelText = node.bracketGroup === "winner"
    ? `胜者组 · ${node.roundName}`
    : node.bracketGroup === "loser"
      ? `败者组 · ${node.roundName}`
      : node.bracketGroup === "grand_final"
        ? `总决赛 · ${node.roundName}`
        : node.roundName;
  return `${groupLabelText} #${node.position} ${slotLabel}`;
}

export function shuffleIds(ids: string[]): string[] {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    const currentId = next[index]!;
    const targetId = next[targetIndex]!;
    next[index] = targetId;
    next[targetIndex] = currentId;
  }
  return next;
}
