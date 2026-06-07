import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import {
  ensureTournamentId,
  loadTournament,
  loadTournamentMatches,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { PageShell, SectionTitle, SeriesCard, StatGrid, TournamentPicker } from "../../components";
import type { MatchRecord, TournamentDetail, TournamentOption } from "../../types";
import { formatDate, labelStageType, labelStatus, navigate, switchTab } from "../../utils";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [records, setRecords] = useState<MatchRecord[]>([]);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    setLoading(true);
    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId()) || allTournaments[0]?.id || "";

      if (targetId.length === 0) {
        setTournaments(allTournaments);
        setSelectedId("");
        setDetail(null);
        setRecords([]);
        return;
      }

      setSelectedTournamentId(targetId);
      const [nextDetail, nextRecords] = await Promise.all([loadTournament(targetId), loadTournamentMatches(targetId, 6)]);
      setTournaments(allTournaments);
      setSelectedId(targetId);
      setDetail(nextDetail);
      setRecords(nextRecords);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "赛事数据读取失败");
    } finally {
      setLoading(false);
    }
  }

  const currentStage = detail?.currentStage ?? detail?.stages?.[0] ?? null;
  const latestRecord = records[0];

  return (
    <PageShell loading={loading} error={error}>
      <View className="hero-panel">
        <Text className="kicker">MRJZ Dota 2 社区赛</Text>
        <Text className="brand-title">赛程、战报和选手数据</Text>
        <Text className="brand-subtitle">小程序端优先承载登录、选手标签提交和真实点赞。</Text>
      </View>

      <TournamentPicker tournaments={tournaments} selectedTournamentId={selectedTournamentId} onChange={(id) => void refresh(id)} />

      <StatGrid
        items={[
          { label: "届次状态", value: labelStatus(detail?.status), hint: detail?.season?.name },
          { label: "当前阶段", value: labelStageType(currentStage?.type), hint: currentStage?.name ?? "等待后台配置" },
          { label: "参赛队伍", value: String(detail?.teamCount ?? 0), hint: `league ${detail?.league?.opendotaLeagueId ?? "-"}` },
        ]}
      />

      <SectionTitle kicker="入口" title="常用页面" />
      <View className="quick-grid">
        <Button className="quick-button" onClick={() => navigate("/pages/stage/index")}>
          赛事阶段
        </Button>
        <Button className="quick-button" onClick={() => switchTab("/pages/schedule/index")}>
          官方赛程
        </Button>
        <Button className="quick-button" onClick={() => switchTab("/pages/records/index")}>
          比赛记录
        </Button>
        <Button className="quick-button" onClick={() => switchTab("/pages/players/index")}>
          选手数据
        </Button>
        <Button className="quick-button" onClick={() => navigate("/pages/teams/index")}>
          队伍主页
        </Button>
      </View>

      <SectionTitle kicker="下一场" title="近期赛程" actionText="看赛程" onAction={() => switchTab("/pages/schedule/index")} />
      {detail?.nextSeries ? <SeriesCard series={detail.nextSeries} /> : <View className="content-panel"><Text className="muted">暂无已发布下一场。</Text></View>}

      <SectionTitle kicker="最新战报" title="最近比赛" actionText="全部记录" onAction={() => switchTab("/pages/records/index")} />
      {latestRecord ? (
        <View className="match-record-card" onClick={() => navigate(`/pages/match-detail/index?matchId=${latestRecord.matchId}`)}>
          <Text className="record-title">{latestRecord.radiantTeamName} vs {latestRecord.direTeamName}</Text>
          <View className="record-meta">
            <Text className="score-text">{latestRecord.radiantScore ?? "-"} : {latestRecord.direScore ?? "-"}</Text>
            <Text className="muted">{formatDate(latestRecord.startTime)}</Text>
          </View>
        </View>
      ) : (
        <View className="content-panel"><Text className="muted">暂无比赛记录。</Text></View>
      )}
    </PageShell>
  );
}
