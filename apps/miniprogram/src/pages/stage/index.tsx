import { Button, ScrollView, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useEffect, useState } from "react";
import {
  chooseTournamentId,
  getSelectedTournamentId,
  loadStageBracket,
  loadStageRounds,
  loadStageStandings,
  loadTournament,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, SeriesCard, TournamentScope } from "../../components";
import type {
  BracketNode,
  StageRound,
  StandingRow,
  TournamentDetail,
  TournamentOption,
} from "../../types";
import { isOfficialScheduleStage, labelStageType, labelStatus, teamName } from "../../utils";

const ungroupedStandingKey = "__all__";

type StageCache = {
  bracket: BracketNode[];
  detail: TournamentDetail | null;
  rounds: StageRound[];
  selectedStageId: string;
  selectedTournamentId: string;
  standings: StandingRow[];
  tournaments: TournamentOption[];
};

export default function StagePage() {
  const [initialStoredTournamentId] = useState(() => getSelectedTournamentId());
  const [initialCache] = useState(() =>
    readPageCache<StageCache>(pageCacheKey("stage", initialStoredTournamentId || "auto")),
  );
  const [loading, setLoading] = useState(initialCache === null);
  const [stageLoading, setStageLoading] = useState(false);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>(
    () => initialCache?.tournaments ?? [],
  );
  const [selectedTournamentId, setSelectedId] = useState(() =>
    chooseTournamentId(
      initialCache?.tournaments ?? [],
      initialStoredTournamentId,
      initialCache?.selectedTournamentId,
    ),
  );
  const [detail, setDetail] = useState<TournamentDetail | null>(() => initialCache?.detail ?? null);
  const [selectedStageId, setSelectedStageId] = useState(() => initialCache?.selectedStageId ?? "");
  const [rounds, setRounds] = useState<StageRound[]>(() => initialCache?.rounds ?? []);
  const [standings, setStandings] = useState<StandingRow[]>(() => initialCache?.standings ?? []);
  const [bracket, setBracket] = useState<BracketNode[]>(() => initialCache?.bracket ?? []);
  const [activeStandingGroupKey, setActiveStandingGroupKey] = useState("");

  useDidShow(() => {
    void refresh();
  });

  useEffect(() => {
    const groups = groupStandingRows(standings);
    const nextKey =
      groups.find((group) => group.key === activeStandingGroupKey)?.key ?? groups[0]?.key ?? "";

    if (activeStandingGroupKey !== nextKey) {
      setActiveStandingGroupKey(nextKey);
    }
  }, [activeStandingGroupKey, standings]);

  async function refresh(nextTournamentId?: string) {
    const storedTournamentId = getSelectedTournamentId();
    const requestedTournamentId = nextTournamentId ?? storedTournamentId;
    const cacheKey = pageCacheKey("stage", requestedTournamentId || "auto");
    const cached = readPageCache<StageCache>(cacheKey);

    if (cached) {
      const cachedSelectedTournamentId = chooseTournamentId(
        cached.tournaments,
        requestedTournamentId,
        cached.selectedTournamentId,
      );

      setTournaments(cached.tournaments);
      setSelectedId(cachedSelectedTournamentId);
      setDetail(cached.detail);
      setSelectedStageId(cached.selectedStageId);
      setRounds(cached.rounds);
      setStandings(cached.standings);
      setBracket(cached.bracket);
      setLoading(false);

      if (cachedSelectedTournamentId && cachedSelectedTournamentId !== storedTournamentId) {
        setSelectedTournamentId(cachedSelectedTournamentId);
      }
    } else {
      setLoading(true);
    }

    setError("");

    if (cached && isPageCacheFresh(cacheKey)) {
      return;
    }

    try {
      const allTournaments = await loadTournaments();
      const targetId = chooseTournamentId(
        allTournaments,
        nextTournamentId,
        getSelectedTournamentId(),
      );
      const nextDetail = targetId ? await loadTournament(targetId) : null;
      const officialStages = nextDetail?.stages?.filter(isOfficialScheduleStage) ?? [];
      const nextStageId =
        officialStages.find((stage) => stage.id === nextDetail?.currentStage?.id)?.id ??
        officialStages[0]?.id ??
        "";

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      setTournaments(allTournaments);
      setSelectedId(targetId);
      setDetail(nextDetail);
      setSelectedStageId(nextStageId);
      if (nextStageId) {
        void refreshStage(nextStageId, {
          detail: nextDetail,
          selectedTournamentId: targetId,
          tournaments: allTournaments,
        });
      } else {
        writePageCache(pageCacheKey("stage", targetId || "current"), {
          bracket: [],
          detail: nextDetail,
          rounds: [],
          selectedStageId: "",
          selectedTournamentId: targetId,
          standings: [],
          tournaments: allTournaments,
        });
      }
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "赛事阶段读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function selectStage(stageId: string): void {
    setSelectedStageId(stageId);
    void refreshStage(stageId);
  }

  async function refreshStage(
    stageId: string,
    context?: {
      detail: TournamentDetail | null;
      selectedTournamentId: string;
      tournaments: TournamentOption[];
    },
  ) {
    setStageLoading(true);

    try {
      const cacheKey = pageCacheKey(
        "stage",
        context?.selectedTournamentId || selectedTournamentId || "auto",
      );
      const cached = readPageCache<StageCache>(cacheKey);
      const [roundsResult, standingsResult, bracketResult] = await Promise.allSettled([
        loadStageRounds(stageId),
        loadStageStandings(stageId),
        loadStageBracket(stageId),
      ]);
      const nextRounds =
        roundsResult.status === "fulfilled" ? roundsResult.value : (cached?.rounds ?? []);
      const nextStandings =
        standingsResult.status === "fulfilled" ? standingsResult.value : (cached?.standings ?? []);
      const nextBracket =
        bracketResult.status === "fulfilled" ? bracketResult.value : (cached?.bracket ?? []);

      setRounds(nextRounds);
      setStandings(nextStandings);
      setBracket(nextBracket);
      writePageCache(cacheKey, {
        bracket: nextBracket,
        detail: context?.detail ?? detail,
        rounds: nextRounds,
        selectedStageId: stageId,
        selectedTournamentId: context?.selectedTournamentId ?? selectedTournamentId,
        standings: nextStandings,
        tournaments: context?.tournaments ?? tournaments,
      });
    } finally {
      setStageLoading(false);
    }
  }

  const officialStages = detail?.stages?.filter(isOfficialScheduleStage) ?? [];
  const selectedStage = officialStages.find((stage) => stage.id === selectedStageId) ?? null;
  const standingGroups = groupStandingRows(standings);
  const activeStandingGroup =
    standingGroups.find((group) => group.key === activeStandingGroupKey) ??
    standingGroups[0] ??
    null;

  return (
    <PageShell loading={loading} error={error} routeKey="stage">
      <TournamentScope
        tournament={
          detail ?? tournaments.find((tournament) => tournament.id === selectedTournamentId)
        }
      />

      {selectedStage ? (
        <>
          <View className="stage-switch section-panel">
            <View className="section-title compact">
              <View>
                <Text className="section-heading">赛事阶段</Text>
              </View>
            </View>
            <View className="segmented">
              {officialStages.map((stage) => (
                <Button
                  key={stage.id}
                  className={stage.id === selectedStageId ? "active" : ""}
                  onClick={() => selectStage(stage.id)}
                >
                  {labelStageType(stage.type)}
                </Button>
              ))}
            </View>
            <View className="stage-head">
              <View>
                <Text className="section-heading">
                  {selectedStage.name} · {rounds[0]?.name ?? labelStatus(selectedStage.status)}
                </Text>
              </View>
            </View>
          </View>

          {stageLoading ? (
            <View className="content-panel">
              <Text className="muted">阶段数据读取中。</Text>
            </View>
          ) : null}

          {selectedStage.type !== "knockout" ? (
            <View className="section-panel">
              <View className="section-title compact">
                <View>
                  <Text className="section-heading">积分榜</Text>
                </View>
              </View>
              {standingGroups.length > 1 ? (
                <View className="standing-tabs segmented">
                  {standingGroups.map((group) => (
                    <Button
                      key={group.key}
                      className={group.key === activeStandingGroup?.key ? "active" : ""}
                      onClick={() => setActiveStandingGroupKey(group.key)}
                    >
                      <Text>{group.label}</Text>
                      <Text className="standing-tab-count">{group.rows.length} 队</Text>
                    </Button>
                  ))}
                </View>
              ) : null}
              <View className="standing-list">
                {activeStandingGroup && activeStandingGroup.rows.length > 0 ? (
                  activeStandingGroup.rows.map((row) => (
                    <StandingRowItem
                      key={`${row.groupName ?? "all"}-${row.teamId}-${row.rank}`}
                      row={row}
                    />
                  ))
                ) : (
                  <View className="content-panel">
                    <Text className="muted">暂无</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          <View className="section-panel">
            <View className="section-title compact">
              <View>
                <Text className="section-heading">当前轮</Text>
              </View>
              <Text className="status-tag blue">{rounds[0]?.name ?? "暂无"}</Text>
            </View>
            <View className="schedule-list">
              {rounds.flatMap((round) => round.series).length > 0 ? (
                rounds
                  .flatMap((round) =>
                    round.series.map((series) => (
                      <SeriesCard key={series.id} series={{ ...series, roundName: round.name }} />
                    )),
                  )
                  .slice(0, 6)
              ) : (
                <View className="content-panel">
                  <Text className="muted">暂无</Text>
                </View>
              )}
            </View>
          </View>

          {selectedStage.type === "knockout" ? (
            <View className="section-panel">
              <View className="section-title compact">
                <View>
                  <Text className="section-heading">淘汰赛对阵图</Text>
                </View>
              </View>
              {bracket.length > 0 ? (
                <BracketPreview nodes={bracket} />
              ) : (
                <View className="content-panel">
                  <Text className="muted">暂无</Text>
                </View>
              )}
            </View>
          ) : null}
        </>
      ) : (
        <View className="content-panel">
          <Text className="muted">后台还没有创建官方阶段。</Text>
        </View>
      )}
    </PageShell>
  );
}

function BracketPreview(props: { nodes: BracketNode[] }) {
  const groups = groupBracketNodes(props.nodes);
  const nodeLookup = new Map(props.nodes.map((node) => [node.id, node]));
  const isUnifiedDoubleElimination = groups.some(
    (group) => group.key === "winner" || group.key === "loser" || group.key === "grand_final",
  );
  const unifiedLayout = isUnifiedDoubleElimination
    ? buildUnifiedMiniBracketLayout(groups, props.nodes)
    : null;
  const extraGroups = groups.filter(
    (group) => group.key !== "winner" && group.key !== "loser" && group.key !== "grand_final",
  );

  return (
    <ScrollView className="bracket-mini-board" scrollX>
      <View
        className={`bracket-scroll-content ${unifiedLayout ? "is-unified" : ""}`}
        {...(unifiedLayout ? { style: { width: `${unifiedLayout.width}px` } } : {})}
      >
        {unifiedLayout ? (
          <View
            className="bracket-unified-map is-combined"
            style={{
              width: `${unifiedLayout.width}px`,
              gridTemplateColumns: `repeat(${unifiedLayout.columnCount}, ${MINI_BRACKET_COLUMN_WIDTH}px)`,
            }}
          >
            <Text className="bracket-unified-lane-label is-winner">胜者组</Text>
            <Text className="bracket-unified-lane-label is-loser">败者组</Text>
            {unifiedLayout.columns.map((column) => (
              <BracketUnifiedColumn key={column.key} column={column} nodeLookup={nodeLookup} />
            ))}
            {extraGroups.map((group) => (
              <BracketGroupLane
                key={group.key}
                group={group}
                nodeLookup={nodeLookup}
                width={bracketTrackWidth(group.columns.length)}
              />
            ))}
          </View>
        ) : (
          groups.map((group) => (
            <BracketGroupLane
              key={group.key}
              group={group}
              nodeLookup={nodeLookup}
              width={bracketTrackWidth(group.columns.length)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

type BracketGroupLayout = {
  key: string;
  label: string;
  nodeCount: number;
  columns: Array<{ key: string; roundName: string; nodes: BracketNode[] }>;
};

type UnifiedMiniBracketColumn = {
  key: string;
  groupKey: string;
  roundName: string;
  displayColumn: number;
  nodes: BracketNode[];
};

function BracketUnifiedColumn(props: {
  column: UnifiedMiniBracketColumn;
  nodeLookup: Map<string, BracketNode>;
}) {
  const { column } = props;
  const isGrandFinal = column.groupKey === "grand_final";

  return (
    <View
      className={`bracket-column bracket-unified-column is-${column.groupKey}`}
      style={{
        gridColumn: `${column.displayColumn + 1}`,
        gridRow: isGrandFinal ? "1" : column.groupKey === "winner" ? "1" : "2",
      }}
    >
      <Text className="bracket-round-title">{column.roundName}</Text>
      <View className="bracket-column-body">
        {column.nodes.map((node) => (
          <BracketNodeCard key={node.id} node={node} nodeLookup={props.nodeLookup} />
        ))}
      </View>
    </View>
  );
}

function BracketGroupLane(props: {
  group: BracketGroupLayout;
  nodeLookup: Map<string, BracketNode>;
  width: number;
  extraClassName?: string;
}) {
  const { group } = props;

  return (
    <View
      className={`bracket-group-lane ${props.extraClassName ?? ""}`.trim()}
      style={{ width: `${props.width}px` }}
    >
      <View className="bracket-group-title">
        <Text>{group.label}</Text>
        <Text>{group.nodeCount} 场</Text>
      </View>
      <View className="bracket-round-track">
        {group.columns.map((column) => (
          <View className="bracket-column" key={column.key}>
            <Text className="bracket-round-title">{column.roundName}</Text>
            <View className="bracket-column-body">
              {column.nodes.map((node) => (
                <BracketNodeCard key={node.id} node={node} nodeLookup={props.nodeLookup} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function BracketNodeCard(props: { node: BracketNode; nodeLookup: Map<string, BracketNode> }) {
  const { node } = props;
  const radiantWinner = Boolean(node.winnerTeamId && node.radiantTeam?.id === node.winnerTeamId);
  const direWinner = Boolean(node.winnerTeamId && node.direTeam?.id === node.winnerTeamId);
  const winnerName = radiantWinner
    ? teamName(node.radiantTeam)
    : direWinner
      ? teamName(node.direTeam)
      : "";
  const winnerTarget = formatBracketTarget(
    props.nodeLookup,
    node.nextNodeId ?? null,
    node.nextSlot ?? null,
    "冠军",
  );
  const loserTarget = node.loserNextNodeId
    ? formatBracketTarget(
        props.nodeLookup,
        node.loserNextNodeId,
        node.loserNextSlot ?? null,
        "淘汰",
      )
    : "淘汰";

  return (
    <View className={`bracket-node ${node.status === "completed" ? "is-completed" : ""}`}>
      <View className="bracket-node-topline">
        <Text className="bracket-node-kicker">#{node.position}</Text>
        <Text className="bracket-node-state">{labelStatus(node.status)}</Text>
      </View>
      <View className={`bracket-team ${radiantWinner ? "is-winner" : ""}`}>
        <Text>上</Text>
        <Text>{teamName(node.radiantTeam)}</Text>
      </View>
      <View className={`bracket-team ${direWinner ? "is-winner" : ""}`}>
        <Text>下</Text>
        <Text>{teamName(node.direTeam)}</Text>
      </View>
      <Text className="bracket-node-footer">{winnerName ? `胜者 ${winnerName}` : "胜者待定"}</Text>
      <View className="bracket-flow-row">
        <Text>胜者 -&gt; {winnerTarget}</Text>
        <Text>负者 -&gt; {loserTarget}</Text>
      </View>
    </View>
  );
}

function groupBracketNodes(nodes: BracketNode[]): BracketGroupLayout[] {
  const groups = new Map<string, Map<string, BracketNode[]>>();

  for (const node of nodes) {
    const groupKey = node.bracketGroup || "single";
    const roundKey = `${node.roundNumber}:${node.roundName}`;
    const group = groups.get(groupKey) ?? new Map<string, BracketNode[]>();
    const roundNodes = group.get(roundKey) ?? [];
    group.set(roundKey, [...roundNodes, node]);
    groups.set(groupKey, group);
  }

  return [...groups.entries()]
    .sort(
      ([left], [right]) =>
        bracketGroupSortValue(left) - bracketGroupSortValue(right) || left.localeCompare(right),
    )
    .map(([key, rounds]) => ({
      key,
      label: bracketGroupLabel(key),
      nodeCount: [...rounds.values()].reduce((total, roundNodes) => total + roundNodes.length, 0),
      columns: [...rounds.entries()]
        .map(([roundKey, roundNodes]) => ({
          key: roundKey,
          roundName: roundNodes[0]?.roundName ?? "轮次",
          roundNumber: roundNodes[0]?.roundNumber ?? 0,
          nodes: roundNodes.slice().sort((left, right) => left.position - right.position),
        }))
        .sort(
          (left, right) =>
            left.roundNumber - right.roundNumber || left.roundName.localeCompare(right.roundName),
        ),
    }));
}

function buildUnifiedMiniBracketLayout(groups: BracketGroupLayout[], nodes: BracketNode[]) {
  const winnerGroup = groups.find((group) => group.key === "winner") ?? null;
  const loserGroup = groups.find((group) => group.key === "loser") ?? null;
  const grandFinalGroup = groups.find((group) => group.key === "grand_final") ?? null;

  if (!winnerGroup || !loserGroup || !grandFinalGroup) {
    return null;
  }

  const firstLoserColumnNodeIds = new Set(
    loserGroup.columns[0]?.nodes.map((node) => node.id) ?? [],
  );
  const firstLoserRoundReceivesWinnerDrop = nodes.some((node) => {
    const loserNextNodeId = node.loserNextNodeId ?? null;
    return (
      node.bracketGroup === "winner" &&
      loserNextNodeId !== null &&
      firstLoserColumnNodeIds.has(loserNextNodeId)
    );
  });
  const loserOpeningColumnOffset = firstLoserRoundReceivesWinnerDrop ? 1 : 0;
  const winnerColumns = winnerGroup.columns.map((column, index) => ({
    ...column,
    groupKey: "winner",
    displayColumn: index + 1,
  }));
  const loserColumns = loserGroup.columns.map((column, index) => ({
    ...column,
    groupKey: "loser",
    displayColumn: index + loserOpeningColumnOffset,
  }));
  const winnerFinalColumn = Math.max(...winnerColumns.map((column) => column.displayColumn));
  const loserFinalColumn = Math.max(...loserColumns.map((column) => column.displayColumn));
  const grandFinalDisplayColumn = Math.max(winnerFinalColumn, loserFinalColumn) + 1;
  const grandFinalColumns = grandFinalGroup.columns.map((column, index) => ({
    ...column,
    groupKey: "grand_final",
    displayColumn: grandFinalDisplayColumn + index,
  }));
  const columns: UnifiedMiniBracketColumn[] = [
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

  return {
    columns,
    columnCount,
    width: bracketTrackWidth(columnCount) + 20,
  };
}

function bracketGroupLabel(group: string): string {
  if (group === "winner") return "胜者组";
  if (group === "loser") return "败者组";
  if (group === "grand_final") return "总决赛";
  if (group === "single") return "淘汰赛";
  return group;
}

function bracketGroupSortValue(group: string): number {
  if (group === "single") return 0;
  if (group === "winner") return 1;
  if (group === "loser") return 2;
  if (group === "grand_final") return 3;
  return 4;
}

const MINI_BRACKET_COLUMN_WIDTH = 150;
const MINI_BRACKET_COLUMN_GAP = 14;

function bracketTrackWidth(columnCount: number): number {
  return (
    Math.max(1, columnCount) * MINI_BRACKET_COLUMN_WIDTH +
    Math.max(0, columnCount - 1) * MINI_BRACKET_COLUMN_GAP
  );
}

function formatBracketTarget(
  nodes: Map<string, BracketNode>,
  nodeId: string | null,
  slot: "radiant" | "dire" | null,
  fallback: string,
): string {
  if (!nodeId) return fallback;
  const node = nodes.get(nodeId);
  const slotLabel = slot === "radiant" ? "上位" : slot === "dire" ? "下位" : "待定槽";
  return node
    ? `${bracketGroupLabel(node.bracketGroup)} #${node.position} ${slotLabel}`
    : `下一节点 ${slotLabel}`;
}

function groupStandingRows(
  rows: StandingRow[],
): Array<{ key: string; label: string; rows: StandingRow[] }> {
  const groups = new Map<string, { key: string; label: string; rows: StandingRow[] }>();

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

function StandingRowItem(props: { row: StandingRow }) {
  const { row } = props;

  return (
    <View className="standing-row">
      <Text className="rank">{row.rank}</Text>
      <Text>{teamName(row.team)}</Text>
      <Text>
        {row.seriesWins}-{row.seriesDraws}-{row.seriesLosses}
      </Text>
      <Text>{row.points} 分</Text>
    </View>
  );
}
