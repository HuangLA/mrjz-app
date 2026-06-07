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
import { PageShell, SectionTitle, SeriesCard, StatGrid } from "../../components";
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
  const recordCount = records.length;

  return (
    <PageShell loading={loading} error={error} routeKey="home">
      <View className="home-hero">
        <View className="home-hero-content">
          <View className="home-hero-kicker">
            <Text>MRJZ</Text>
            <View />
            <Text>DOTA 2</Text>
          </View>
          <View className="home-brand-core">
            <Text className="home-brand-season">COMMUNITY LEAGUE</Text>
            <Text className="home-brand-name">每日节奏杯</Text>
            <Text className="home-brand-sub">DRAFT · FIGHT · RECORD</Text>
          </View>
          <View className="home-quick-actions">
            <Button onClick={() => navigate("/pages/stage/index")}>阶段</Button>
            <Button onClick={() => switchTab("/pages/records/index")}>记录</Button>
            <Button onClick={() => switchTab("/pages/players/index")}>选手</Button>
          </View>
        </View>
        <View className="home-hero-stats">
          <View>
            <Text>届次</Text>
            <Text>{String(tournaments.length)}</Text>
          </View>
          <View>
            <Text>比赛</Text>
            <Text>{String(recordCount)}</Text>
          </View>
          <View>
            <Text>战场</Text>
            <Text>DOTA2</Text>
          </View>
        </View>
      </View>

      <View className="tournament-entry-list">
        {tournaments.map((tournament) => (
          <View className={`tournament-entry ${tournament.id === selectedTournamentId ? "active" : ""}`} key={tournament.id}>
            <Button className="tournament-entry-main" onClick={() => void refresh(tournament.id)}>
              <View>
                <Text className="tournament-entry-title">{tournament.name}</Text>
                <Text className="tournament-entry-meta">
                  {labelStatus(tournament.status)} · {formatDate(tournament.startsAt)}
                </Text>
              </View>
              <View className="tournament-entry-action">
                <Text>{tournament.id === selectedTournamentId ? "当前" : "进入"}</Text>
                <Text>{tournament.id === selectedTournamentId && latestRecord ? `${latestRecord.radiantTeamName} vs ${latestRecord.direTeamName}` : tournament.season?.name ?? "--"}</Text>
              </View>
            </Button>
          </View>
        ))}
      </View>

      <StatGrid
        items={[
          { label: "届次状态", value: labelStatus(detail?.status), hint: detail?.season?.name },
          { label: "当前阶段", value: labelStageType(currentStage?.type), hint: currentStage?.name ?? "等待后台配置" },
          { label: "参赛队伍", value: String(detail?.teamCount ?? 0), hint: `league ${detail?.league?.opendotaLeagueId ?? "-"}` },
        ]}
      />

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
