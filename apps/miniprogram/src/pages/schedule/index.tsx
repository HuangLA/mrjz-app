import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ensureTournamentId, getSelectedTournamentId, loadOfficialSchedule, loadStageRounds, loadTournament, loadTournaments, setSelectedTournamentId } from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { FilterRow, PageShell, SeriesCard, TournamentScope, seriesScheduleStatusText } from "../../components";
import type { OfficialScheduleStatus, StageRound, TournamentDetail, TournamentOption } from "../../types";
import { isOfficialScheduleStage, labelStageType, navigate } from "../../utils";

type ScheduleOrder = "asc" | "desc";

const scheduleFilters = ["全部", "未开始", "待补录", "已完赛", "延期"] as const;
type ScheduleFilter = (typeof scheduleFilters)[number];

type ScheduleCache = {
  detail: TournamentDetail | null;
  officialSchedule: OfficialScheduleStatus | null;
  rounds: StageRound[];
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

export default function SchedulePage() {
  const [initialCache] = useState(() => readPageCache<ScheduleCache>(pageCacheKey("schedule", getSelectedTournamentId() || "auto")));
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>(() => initialCache?.tournaments ?? []);
  const [selectedTournamentId, setSelectedId] = useState(() => initialCache?.selectedTournamentId ?? "");
  const [detail, setDetail] = useState<TournamentDetail | null>(() => initialCache?.detail ?? null);
  const [officialSchedule, setOfficialSchedule] = useState<OfficialScheduleStatus | null>(() => initialCache?.officialSchedule ?? null);
  const [rounds, setRounds] = useState<StageRound[]>(() => initialCache?.rounds ?? []);
  const [statusFilter, setStatusFilter] = useState<ScheduleFilter>("全部");
  const [scheduleOrder, setScheduleOrder] = useState<ScheduleOrder>("desc");

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    const cacheKey = pageCacheKey("schedule", nextTournamentId ?? (getSelectedTournamentId() || "auto"));
    const cached = readPageCache<ScheduleCache>(cacheKey);

    if (cached) {
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setDetail(cached.detail);
      setOfficialSchedule(cached.officialSchedule);
      setRounds(cached.rounds);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    if (cached && isPageCacheFresh(cacheKey)) {
      return;
    }

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId(allTournaments)) || "";
      const nextDetail = targetId ? await loadTournament(targetId) : null;
      const nextSchedule = targetId ? await loadOfficialSchedule(targetId).catch(() => null) : null;
      const officialStages = nextDetail?.stages?.filter(isOfficialScheduleStage) ?? [];
      const stageRounds = await Promise.all(officialStages.map((stage) => loadStageRounds(stage.id).catch(() => [])));

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      const snapshot = {
        detail: nextDetail,
        officialSchedule: nextSchedule,
        rounds: stageRounds.flat(),
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setDetail(snapshot.detail);
      setOfficialSchedule(snapshot.officialSchedule);
      setRounds(snapshot.rounds);
      writePageCache(pageCacheKey("schedule", targetId || "auto"), snapshot);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "赛程读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  const visibleSeries = useMemo(() => {
    const allSeries = officialSchedule?.isPublished ? rounds.flatMap((round) => round.series.map((series) => ({ round, series }))) : [];
    const filtered = statusFilter === "全部" ? allSeries : allSeries.filter(({ series }) => seriesScheduleStatusText(series.status) === statusFilter);

    return scheduleOrder === "asc" ? filtered : filtered.slice().reverse();
  }, [officialSchedule?.isPublished, rounds, scheduleOrder, statusFilter]);
  const totalSeries = officialSchedule?.isPublished ? rounds.reduce((sum, round) => sum + round.series.length, 0) : 0;

  return (
    <PageShell loading={loading} error={error} routeKey="schedule">
      <TournamentScope tournament={detail ?? tournaments.find((tournament) => tournament.id === selectedTournamentId)} />

      {officialSchedule?.isPublished ? (
        <>
          <View className="section-panel">
            <View className="section-title compact">
              <View>
                <Text className="section-heading">赛程列表</Text>
              </View>
              <Text className="status-tag blue">{scheduleOrder === "desc" ? "倒序" : "正序"}</Text>
            </View>
            <View className="schedule-toolbar">
              <FilterRow labels={[...scheduleFilters]} value={statusFilter} onChange={setStatusFilter} />
              <Button className="schedule-order-button" onClick={() => setScheduleOrder((current) => (current === "desc" ? "asc" : "desc"))}>
                {scheduleOrder === "desc" ? "切换正序" : "切换倒序"}
              </Button>
            </View>
            <Text className="schedule-summary">
              当前显示 {visibleSeries.length}/{totalSeries} 场 · {scheduleOrder === "desc" ? "由晚到早" : "由早到晚"}
            </Text>
          </View>
          {visibleSeries.length > 0 ? visibleSeries.map(({ round, series }) => (
            <View className="section-panel schedule-group" key={series.id}>
              <View className="date-row">
                <Text>{labelStageType(detail?.stages.find((stage) => stage.id === round.stageId)?.type)}</Text>
                <Text>{round.name}</Text>
              </View>
              <SeriesCard
                series={{ ...series, roundName: round.name }}
                onOpen={() => {
                  const matchId = series.games?.find((game) => game.matchId)?.matchId;
                  if (matchId) navigate(`/pages/match-detail/index?matchId=${matchId}`);
                }}
              />
            </View>
          )) : <View className="section-panel"><Text className="muted">暂无符合条件的赛程</Text></View>}
        </>
      ) : (
        <View className="content-panel"><Text className="muted">赛程暂未发布。</Text></View>
      )}
    </PageShell>
  );
}
