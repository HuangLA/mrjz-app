import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { ensureTournamentId, loadOfficialSchedule, loadStageRounds, loadTournament, loadTournaments, setSelectedTournamentId } from "../../api";
import { PageShell, SectionTitle, SeriesCard, TournamentPicker } from "../../components";
import type { OfficialScheduleStatus, StageRound, TournamentDetail, TournamentOption } from "../../types";
import { labelStageType, labelStatus, navigate } from "../../utils";

export default function SchedulePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [officialSchedule, setOfficialSchedule] = useState<OfficialScheduleStatus | null>(null);
  const [rounds, setRounds] = useState<StageRound[]>([]);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    setLoading(true);
    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId()) || allTournaments[0]?.id || "";
      const nextDetail = targetId ? await loadTournament(targetId) : null;
      const nextSchedule = targetId ? await loadOfficialSchedule(targetId).catch(() => null) : null;
      const officialStages = nextDetail?.stages?.filter((stage) => ["group", "swiss", "knockout"].includes(stage.type)) ?? [];
      const stageRounds = await Promise.all(officialStages.map((stage) => loadStageRounds(stage.id).catch(() => [])));

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      setTournaments(allTournaments);
      setSelectedId(targetId);
      setDetail(nextDetail);
      setOfficialSchedule(nextSchedule);
      setRounds(stageRounds.flat());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "赛程读取失败");
    } finally {
      setLoading(false);
    }
  }

  const visibleSeries = officialSchedule?.isPublished ? rounds.flatMap((round) => round.series.map((series) => ({ round, series }))) : [];

  return (
    <PageShell loading={loading} error={error} routeKey="schedule">
      <TournamentPicker tournaments={tournaments} selectedTournamentId={selectedTournamentId} onChange={(id) => void refresh(id)} />
      <View className="content-panel">
        <Text className="section-heading">{detail?.name ?? "赛事"}</Text>
        <Text className="muted">官方赛程：{labelStatus(officialSchedule?.status)} · 名单{officialSchedule?.rosterLocked ? "已锁定" : "未锁定"}</Text>
      </View>

      {officialSchedule?.isPublished ? (
        <>
          <SectionTitle kicker="赛程" title="已发布对阵" />
          {visibleSeries.length > 0 ? visibleSeries.map(({ round, series }) => (
            <View key={series.id}>
              <Text className="kicker">{labelStageType(detail?.stages.find((stage) => stage.id === round.stageId)?.type)} · {round.name}</Text>
              <SeriesCard
                series={{ ...series, roundName: round.name }}
                onOpen={() => {
                  const matchId = series.games?.find((game) => game.matchId)?.matchId;
                  if (matchId) navigate(`/pages/match-detail/index?matchId=${matchId}`);
                }}
              />
            </View>
          )) : <View className="content-panel"><Text className="muted">赛程已发布，但暂无对阵。</Text></View>}
        </>
      ) : (
        <View className="content-panel">
          <Text className="section-heading">赛程暂未发布</Text>
          <Text className="muted">比赛记录和战报不受影响；官方阶段发布后，这里会展示管理员确认后的公开赛程。</Text>
        </View>
      )}
    </PageShell>
  );
}
