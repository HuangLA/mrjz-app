import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useEffect, useState } from "react";
import {
  ensureTournamentId,
  loadStageBracket,
  loadStageRounds,
  loadStageStandings,
  loadTournament,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { PageShell, SeriesCard, TournamentScope } from "../../components";
import type { BracketNode, StageRound, StageSummary, StandingRow, TournamentDetail, TournamentOption } from "../../types";
import { labelStageType, labelStatus, teamName } from "../../utils";

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
    setLoading(true);
    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId()) || allTournaments[0]?.id || "";
      const nextDetail = targetId ? await loadTournament(targetId) : null;
      const officialStages = nextDetail?.stages?.filter(isOfficialStage) ?? [];
      const nextStageId = officialStages.find((stage) => stage.id === nextDetail?.currentStage?.id)?.id ?? officialStages[0]?.id ?? "";

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      setTournaments(allTournaments);
      setSelectedId(targetId);
      setDetail(nextDetail);
      setSelectedStageId(nextStageId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "赛事阶段读取失败");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStage(stageId: string) {
    setStageLoading(true);

    try {
      const [nextRounds, nextStandings, nextBracket] = await Promise.all([
        loadStageRounds(stageId).catch(() => []),
        loadStageStandings(stageId).catch(() => []),
        loadStageBracket(stageId).catch(() => []),
      ]);
      setRounds(nextRounds);
      setStandings(nextStandings);
      setBracket(nextBracket);
    } finally {
      setStageLoading(false);
    }
  }

  const officialStages = detail?.stages?.filter(isOfficialStage) ?? [];
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
              <View className="bracket-mini-board">
                {bracket.length > 0 ? bracket.map((node) => (
                  <View className="bracket-node" key={node.id}>
                    <View className="bracket-node-topline">
                      <Text className="bracket-node-kicker">#{node.position}</Text>
                      <Text className="bracket-node-state">{labelStatus(node.status)}</Text>
                    </View>
                    <View className="bracket-team">
                      <Text>上</Text>
                      <Text>{teamName(node.radiantTeam)}</Text>
                    </View>
                    <View className="bracket-team">
                      <Text>下</Text>
                      <Text>{teamName(node.direTeam)}</Text>
                    </View>
                    <Text className="bracket-node-footer">胜者 {teamName(node.winnerTeam)}</Text>
                  </View>
                )) : <View className="content-panel"><Text className="muted">暂无</Text></View>}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View className="content-panel"><Text className="muted">后台还没有创建官方阶段。</Text></View>
      )}
    </PageShell>
  );
}

function isOfficialStage(stage: StageSummary): boolean {
  return stage.type === "group" || stage.type === "swiss" || stage.type === "knockout";
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
