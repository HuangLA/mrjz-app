import { Button, ScrollView, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useEffect, useState } from "react";
import {
  ensureTournamentId,
  getSelectedTournamentId,
  loadStageBracket,
  loadStageRounds,
  loadStageStandings,
  loadTournament,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, SeriesCard, TournamentScope } from "../../components";
import type { BracketNode, StageRound, StandingRow, TournamentDetail, TournamentOption } from "../../types";
import { isOfficialScheduleStage, labelStageType, labelStatus, teamName } from "../../utils";

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
  const [loading, setLoading] = useState(true);
  const [stageLoading, setStageLoading] = useState(false);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [rounds, setRounds] = useState<StageRound[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [bracket, setBracket] = useState<BracketNode[]>([]);

  useDidShow(() => {
    void refresh();
  });

  useEffect(() => {
    if (selectedStageId) {
      void refreshStage(selectedStageId);
    }
  }, [selectedStageId]);

  async function refresh(nextTournamentId?: string) {
    const cacheKey = pageCacheKey("stage", nextTournamentId ?? (getSelectedTournamentId() || "auto"));
    const cached = readPageCache<StageCache>(cacheKey);

    if (cached) {
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setDetail(cached.detail);
      setSelectedStageId(cached.selectedStageId);
      setRounds(cached.rounds);
      setStandings(cached.standings);
      setBracket(cached.bracket);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId(allTournaments)) || "";
      const nextDetail = targetId ? await loadTournament(targetId) : null;
      const officialStages = nextDetail?.stages?.filter(isOfficialScheduleStage) ?? [];
      const nextStageId = officialStages.find((stage) => stage.id === nextDetail?.currentStage?.id)?.id ?? officialStages[0]?.id ?? "";

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
      const cacheKey = pageCacheKey("stage", context?.selectedTournamentId || selectedTournamentId || "auto");
      const cached = readPageCache<StageCache>(cacheKey);
      const [roundsResult, standingsResult, bracketResult] = await Promise.allSettled([
        loadStageRounds(stageId),
        loadStageStandings(stageId),
        loadStageBracket(stageId),
      ]);
      const nextRounds = roundsResult.status === "fulfilled" ? roundsResult.value : cached?.rounds ?? [];
      const nextStandings = standingsResult.status === "fulfilled" ? standingsResult.value : cached?.standings ?? [];
      const nextBracket = bracketResult.status === "fulfilled" ? bracketResult.value : cached?.bracket ?? [];

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

  return (
    <PageShell loading={loading} error={error} routeKey="stage">
      <TournamentScope tournament={detail ?? tournaments.find((tournament) => tournament.id === selectedTournamentId)} />

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
                  onClick={() => setSelectedStageId(stage.id)}
                >
                  {labelStageType(stage.type)}
                </Button>
              ))}
            </View>
            <View className="stage-head">
              <View>
                <Text className="section-heading">{selectedStage.name} · {rounds[0]?.name ?? labelStatus(selectedStage.status)}</Text>
              </View>
            </View>
          </View>

          {stageLoading ? <View className="content-panel"><Text className="muted">阶段数据读取中。</Text></View> : null}

          {selectedStage.type !== "knockout" ? (
            <View className="section-panel">
              <View className="section-title compact">
                <View>
                  <Text className="section-heading">积分榜</Text>
                </View>
              </View>
              <View className="standing-list">
                {standings.length > 0 ? standings.map((row) => (
                  <StandingRowItem key={`${row.teamId}-${row.rank}`} row={row} />
                )) : <View className="content-panel"><Text className="muted">暂无</Text></View>}
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
              {rounds.flatMap((round) => round.series).length > 0 ? rounds.flatMap((round) => (
                round.series.map((series) => <SeriesCard key={series.id} series={{ ...series, roundName: round.name }} />)
              )).slice(0, 6) : <View className="content-panel"><Text className="muted">暂无</Text></View>}
            </View>
          </View>

          {selectedStage.type === "knockout" ? (
            <View className="section-panel">
              <View className="section-title compact">
                <View>
                  <Text className="section-heading">淘汰赛对阵图</Text>
                </View>
              </View>
              {bracket.length > 0 ? <BracketPreview nodes={bracket} /> : <View className="content-panel"><Text className="muted">暂无</Text></View>}
            </View>
          ) : null}
        </>
      ) : (
        <View className="content-panel"><Text className="muted">后台还没有创建官方阶段。</Text></View>
      )}
    </PageShell>
  );
}

function BracketPreview(props: { nodes: BracketNode[] }) {
  const groups = groupBracketNodes(props.nodes);

  return (
    <ScrollView className="bracket-mini-board" scrollX>
      <View className="bracket-scroll-content">
        {groups.map((group) => (
          <View className="bracket-group-lane" key={group.key} style={{ width: `${bracketTrackWidth(group.columns.length)}px` }}>
            <Text className="bracket-group-title">{group.label}</Text>
            <View className="bracket-round-track">
              {group.columns.map((column) => (
                <View className="bracket-column" key={column.key}>
                  <Text className="bracket-round-title">{column.roundName}</Text>
                  <View className="bracket-column-body">
                    {column.nodes.map((node) => (
                      <BracketNodeCard key={node.id} node={node} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function BracketNodeCard(props: { node: BracketNode }) {
  const { node } = props;
  const radiantWinner = isSameTeam(node.radiantTeam, node.winnerTeam);
  const direWinner = isSameTeam(node.direTeam, node.winnerTeam);

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
      <Text className="bracket-node-footer">{node.winnerTeam ? `胜者 ${teamName(node.winnerTeam)}` : "胜者待定"}</Text>
    </View>
  );
}

function groupBracketNodes(nodes: BracketNode[]): Array<{ key: string; label: string; columns: Array<{ key: string; roundName: string; nodes: BracketNode[] }> }> {
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
    .sort(([left], [right]) => bracketGroupSortValue(left) - bracketGroupSortValue(right) || left.localeCompare(right))
    .map(([key, rounds]) => ({
      key,
      label: bracketGroupLabel(key),
      columns: [...rounds.entries()]
        .map(([roundKey, roundNodes]) => ({
          key: roundKey,
          roundName: roundNodes[0]?.roundName ?? "轮次",
          roundNumber: roundNodes[0]?.roundNumber ?? 0,
          nodes: roundNodes.slice().sort((left, right) => left.position - right.position),
        }))
        .sort((left, right) => left.roundNumber - right.roundNumber || left.roundName.localeCompare(right.roundName)),
    }));
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

function bracketTrackWidth(columnCount: number): number {
  return Math.max(1, columnCount) * 150 + Math.max(0, columnCount - 1) * 14;
}

function isSameTeam(left: BracketNode["radiantTeam"], right: BracketNode["winnerTeam"]): boolean {
  return Boolean(left && right && left.id === right.id);
}

function StandingRowItem(props: { row: StandingRow }) {
  const { row } = props;

  return (
    <View className="standing-row">
      <Text className="rank">{row.rank}</Text>
      <Text>{teamName(row.team)}</Text>
      <Text>{row.seriesWins}-{row.seriesDraws}-{row.seriesLosses}</Text>
      <Text>{row.points} 分</Text>
      <Text className="status-tag blue">{row.status ?? "排名"}</Text>
    </View>
  );
}
