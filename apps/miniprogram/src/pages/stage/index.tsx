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
import { PageShell, SectionTitle, SeriesCard, StatGrid, TournamentPicker } from "../../components";
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
    <PageShell loading={loading} error={error}>
      <TournamentPicker tournaments={tournaments} selectedTournamentId={selectedTournamentId} onChange={(id) => void refresh(id)} />
      <SectionTitle kicker="阶段" title="赛事进展" />
      <View className="stage-tabs">
        {officialStages.map((stage) => (
          <Button
            key={stage.id}
            className={`chip-button ${stage.id === selectedStageId ? "chip-button-active" : ""}`}
            onClick={() => setSelectedStageId(stage.id)}
          >
            {labelStageType(stage.type)}
          </Button>
        ))}
      </View>

      {selectedStage ? (
        <>
          <View className="content-panel">
            <Text className="section-heading">{selectedStage.name}</Text>
            <Text className="muted">{labelStatus(selectedStage.status)} · 排名、晋级和 bracket 均读取后端结果</Text>
          </View>
          {stageLoading ? <View className="content-panel"><Text className="muted">阶段数据读取中。</Text></View> : null}
          <StatGrid
            items={[
              { label: "轮次", value: String(rounds.length), hint: "后端返回" },
              { label: "积分行", value: String(standings.length), hint: selectedStage.type === "knockout" ? "非必需" : "当前排名" },
              { label: "对阵节点", value: String(bracket.length), hint: "淘汰赛" },
            ]}
          />

          <SectionTitle kicker="积分" title="积分榜" />
          {standings.length > 0 ? standings.map((row) => (
            <View className="content-panel history-item" key={`${row.teamId}-${row.rank}`}>
              <Text className="record-title">#{row.rank} {teamName(row.team)}</Text>
              <Text className="status-text">{row.points} 分 · {row.seriesWins}-{row.seriesDraws}-{row.seriesLosses}</Text>
            </View>
          )) : <View className="content-panel"><Text className="muted">暂无后端积分榜。</Text></View>}

          <SectionTitle kicker="赛程" title="阶段对阵" />
          {rounds.flatMap((round) => round.series).length > 0 ? rounds.map((round) => (
            <View key={round.id}>
              <Text className="kicker">{round.name}</Text>
              {round.series.map((series) => <SeriesCard key={series.id} series={{ ...series, roundName: round.name }} />)}
            </View>
          )) : <View className="content-panel"><Text className="muted">暂无官方阶段对阵。</Text></View>}

          <SectionTitle kicker="Bracket" title="淘汰赛节点" />
          {bracket.length > 0 ? bracket.map((node) => (
            <View className="content-panel" key={node.id}>
              <Text className="record-title">{node.roundName} #{node.position}</Text>
              <Text className="muted">{teamName(node.radiantTeam)} vs {teamName(node.direTeam)}</Text>
              <Text className="status-text">胜者：{teamName(node.winnerTeam)}</Text>
            </View>
          )) : <View className="content-panel"><Text className="muted">当前阶段没有 bracket 数据。</Text></View>}
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
