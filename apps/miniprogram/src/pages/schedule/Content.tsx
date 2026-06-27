import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import {
  chooseTournamentId,
  getSelectedTournamentId,
  loadOfficialSchedule,
  loadStageRounds,
  loadTournament,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import {
  FilterRow,
  PageShell,
  SeriesCard,
  TournamentScope,
  useMainTabRefresh,
  seriesScheduleStatusText,
  useMainTabState,
  useStandalonePullDownRefresh,
} from "../../components";
import {
  mergePageViewState,
  pageViewStateKey,
  readPageViewState,
  restorePageScroll,
  usePageScrollMemory,
} from "../../pageState";
import type {
  OfficialScheduleStatus,
  StageRound,
  TournamentDetail,
  TournamentOption,
} from "../../types";
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

type ScheduleViewState = {
  scheduleOrder?: ScheduleOrder;
  scrollTop?: number;
  statusFilter?: ScheduleFilter;
};

export function ScheduleContent() {
  const mainTabState = useMainTabState();
  const [initialStoredTournamentId] = useState(() => getSelectedTournamentId());
  const [initialCache] = useState(() =>
    readPageCache<ScheduleCache>(pageCacheKey("schedule", initialStoredTournamentId || "auto")),
  );
  const [initialViewState] = useState(() =>
    readPageViewState<ScheduleViewState>(
      pageViewStateKey("schedule", initialStoredTournamentId || "auto"),
    ),
  );
  const [loading, setLoading] = useState(initialCache === null);
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
  const [officialSchedule, setOfficialSchedule] = useState<OfficialScheduleStatus | null>(
    () => initialCache?.officialSchedule ?? null,
  );
  const [rounds, setRounds] = useState<StageRound[]>(() => initialCache?.rounds ?? []);
  const [statusFilter, setStatusFilter] = useState<ScheduleFilter>(() =>
    normalizeScheduleFilter(initialViewState?.statusFilter),
  );
  const [scheduleOrder, setScheduleOrder] = useState<ScheduleOrder>(() =>
    normalizeScheduleOrder(initialViewState?.scheduleOrder),
  );
  const viewStateKey = pageViewStateKey(
    "schedule",
    selectedTournamentId || initialStoredTournamentId || "auto",
  );

  usePageScrollMemory(viewStateKey);
  useMainTabRefresh("schedule", () =>
    refresh(mainTabState?.selectedTournamentId, { force: true }),
  );
  useStandalonePullDownRefresh(() => refresh(undefined, { force: true }));

  useDidShow(() => {
    if (mainTabState) {
      return;
    }

    void refresh();
  });

  useEffect(() => {
    if (mainTabState?.activeRouteKey !== "schedule") {
      return;
    }

    void refresh(mainTabState.selectedTournamentId);
  }, [
    mainTabState?.activeRouteKey,
    mainTabState?.selectedTournamentId,
    mainTabState?.selectedTournamentVersion,
  ]);

  async function refresh(nextTournamentId?: string, options?: { force?: boolean }) {
    const storedTournamentId = getSelectedTournamentId();
    const requestedTournamentId = nextTournamentId ?? storedTournamentId;
    const cacheKey = pageCacheKey("schedule", requestedTournamentId || "auto");
    const cached = readPageCache<ScheduleCache>(cacheKey);

    if (cached) {
      const cachedSelectedTournamentId = chooseTournamentId(
        cached.tournaments,
        requestedTournamentId,
        cached.selectedTournamentId,
      );

      setTournaments(cached.tournaments);
      setSelectedId(cachedSelectedTournamentId);
      setDetail(cached.detail);
      setOfficialSchedule(cached.officialSchedule);
      setRounds(cached.rounds);
      setLoading(false);

      if (cachedSelectedTournamentId && cachedSelectedTournamentId !== storedTournamentId) {
        persistSelectedTournamentId(cachedSelectedTournamentId);
      }

      applyScheduleViewState(cachedSelectedTournamentId || requestedTournamentId || "auto");
    } else {
      setLoading(true);
    }

    setError("");

    if (!options?.force && cached && isPageCacheFresh(cacheKey)) {
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
      const nextSchedule = targetId ? await loadOfficialSchedule(targetId).catch(() => null) : null;
      const officialStages = nextDetail?.stages?.filter(isOfficialScheduleStage) ?? [];
      const stageRounds = await Promise.all(
        officialStages.map((stage) => loadStageRounds(stage.id).catch(() => [])),
      );

      if (targetId) {
        persistSelectedTournamentId(targetId);
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
      applyScheduleViewState(targetId || "auto");
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "赛程读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function applyScheduleViewState(tournamentId: string) {
    const key = pageViewStateKey("schedule", tournamentId || "auto");
    const state = readPageViewState<ScheduleViewState>(key);

    if (isScheduleFilter(state?.statusFilter)) {
      setStatusFilter(state.statusFilter);
    }

    if (isScheduleOrder(state?.scheduleOrder)) {
      setScheduleOrder(state.scheduleOrder);
    }

    restorePageScroll(key);
  }

  function persistSelectedTournamentId(tournamentId: string): void {
    if (!tournamentId) {
      return;
    }

    if (mainTabState) {
      mainTabState.selectTournament(tournamentId);
      return;
    }

    setSelectedTournamentId(tournamentId);
  }

  function handleStatusFilter(nextFilter: string) {
    const normalized = normalizeScheduleFilter(nextFilter);
    setStatusFilter(normalized);
    mergePageViewState<ScheduleViewState>(viewStateKey, { statusFilter: normalized });
  }

  function toggleScheduleOrder() {
    setScheduleOrder((current) => {
      const nextOrder = current === "desc" ? "asc" : "desc";
      mergePageViewState<ScheduleViewState>(viewStateKey, { scheduleOrder: nextOrder });

      return nextOrder;
    });
  }

  const visibleSeries = useMemo(() => {
    const allSeries = officialSchedule?.isPublished
      ? rounds.flatMap((round) => round.series.map((series) => ({ round, series })))
      : [];
    const filtered =
      statusFilter === "全部"
        ? allSeries
        : allSeries.filter(
            ({ series }) => seriesScheduleStatusText(series.status) === statusFilter,
          );

    return scheduleOrder === "asc" ? filtered : filtered.slice().reverse();
  }, [officialSchedule?.isPublished, rounds, scheduleOrder, statusFilter]);
  const totalSeries = officialSchedule?.isPublished
    ? rounds.reduce((sum, round) => sum + round.series.length, 0)
    : 0;

  return (
    <PageShell loading={loading} error={error} routeKey="schedule">
      <TournamentScope
        tournament={
          detail ?? tournaments.find((tournament) => tournament.id === selectedTournamentId)
        }
      />

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
              <FilterRow
                labels={[...scheduleFilters]}
                value={statusFilter}
                onChange={handleStatusFilter}
              />
              <Button className="schedule-order-button" onClick={toggleScheduleOrder}>
                {scheduleOrder === "desc" ? "切换正序" : "切换倒序"}
              </Button>
            </View>
            <Text className="schedule-summary">
              当前显示 {visibleSeries.length}/{totalSeries} 场 ·{" "}
              {scheduleOrder === "desc" ? "由晚到早" : "由早到晚"}
            </Text>
          </View>
          {visibleSeries.length > 0 ? (
            visibleSeries.map(({ round, series }) => (
              <View className="section-panel schedule-group" key={series.id}>
                <View className="date-row">
                  <Text>
                    {labelStageType(
                      detail?.stages.find((stage) => stage.id === round.stageId)?.type,
                    )}
                  </Text>
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
            ))
          ) : (
            <View className="section-panel">
              <Text className="muted">暂无符合条件的赛程</Text>
            </View>
          )}
        </>
      ) : (
        <View className="content-panel">
          <Text className="muted">赛程暂未发布。</Text>
        </View>
      )}
    </PageShell>
  );
}

function normalizeScheduleFilter(value: unknown): ScheduleFilter {
  return isScheduleFilter(value) ? value : "全部";
}

function normalizeScheduleOrder(value: unknown): ScheduleOrder {
  return isScheduleOrder(value) ? value : "desc";
}

function isScheduleFilter(value: unknown): value is ScheduleFilter {
  return scheduleFilters.includes(value as ScheduleFilter);
}

function isScheduleOrder(value: unknown): value is ScheduleOrder {
  return value === "asc" || value === "desc";
}
