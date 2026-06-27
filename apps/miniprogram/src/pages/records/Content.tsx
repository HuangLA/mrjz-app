import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import {
  chooseTournamentId,
  getSelectedTournamentId,
  loadTournamentMatches,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import {
  FilterRow,
  MatchRecordCard,
  PageShell,
  TournamentScope,
  useMainTabRefresh,
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
import type { MatchRecord, TournamentOption } from "../../types";
import { navigate } from "../../utils";

type RecordsCache = {
  records: MatchRecord[];
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

type RecordsViewState = {
  scrollTop?: number;
  teamFilter?: string;
};

const allRecordTeamFilter = "全部";

export function RecordsContent() {
  const mainTabState = useMainTabState();
  const [initialStoredTournamentId] = useState(() => getSelectedTournamentId());
  const [initialCache] = useState(() =>
    readPageCache<RecordsCache>(pageCacheKey("records", initialStoredTournamentId || "auto")),
  );
  const [initialViewState] = useState(() =>
    readPageViewState<RecordsViewState>(
      pageViewStateKey("records", initialStoredTournamentId || "auto"),
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
  const [records, setRecords] = useState<MatchRecord[]>(() => initialCache?.records ?? []);
  const [teamFilter, setTeamFilter] = useState(
    () => initialViewState?.teamFilter ?? allRecordTeamFilter,
  );
  const viewStateKey = pageViewStateKey(
    "records",
    selectedTournamentId || initialStoredTournamentId || "auto",
  );

  usePageScrollMemory(viewStateKey);
  useMainTabRefresh("records", () =>
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
    if (mainTabState?.activeRouteKey !== "records") {
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
    const cacheKey = pageCacheKey("records", requestedTournamentId || "auto");
    const cached = readPageCache<RecordsCache>(cacheKey);

    if (cached) {
      const cachedSelectedTournamentId = chooseTournamentId(
        cached.tournaments,
        requestedTournamentId,
        cached.selectedTournamentId,
      );

      setTournaments(cached.tournaments);
      setSelectedId(cachedSelectedTournamentId);
      setRecords(cached.records);
      setLoading(false);

      if (cachedSelectedTournamentId && cachedSelectedTournamentId !== storedTournamentId) {
        persistSelectedTournamentId(cachedSelectedTournamentId);
      }

      applyRecordsViewState(cachedSelectedTournamentId || requestedTournamentId || "auto");
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
      const nextRecords = targetId ? await loadTournamentMatches(targetId, 100) : [];

      if (targetId) {
        persistSelectedTournamentId(targetId);
      }

      const snapshot = {
        records: nextRecords,
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setRecords(snapshot.records);
      writePageCache(pageCacheKey("records", targetId || "auto"), snapshot);
      applyRecordsViewState(targetId || "auto");
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "比赛记录读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function applyRecordsViewState(tournamentId: string) {
    const key = pageViewStateKey("records", tournamentId || "auto");
    const state = readPageViewState<RecordsViewState>(key);

    if (state?.teamFilter) {
      setTeamFilter(state.teamFilter);
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

  function handleTeamFilter(nextFilter: string) {
    setTeamFilter(nextFilter);
    mergePageViewState<RecordsViewState>(viewStateKey, { teamFilter: nextFilter });
  }

  const teamFilters = useMemo(() => buildRecordTeamFilters(records), [records]);
  const activeTeamFilter = teamFilters.includes(teamFilter) ? teamFilter : allRecordTeamFilter;
  const visibleRecords = useMemo(
    () =>
      activeTeamFilter === allRecordTeamFilter
        ? records
        : records.filter((record) => matchRecordHasTeam(record, activeTeamFilter)),
    [activeTeamFilter, records],
  );

  return (
    <PageShell loading={loading} error={error} routeKey="records">
      <TournamentScope
        tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)}
      />
      <View className="section-panel">
        <View className="section-title compact">
          <View>
            <Text className="section-heading">比赛记录</Text>
          </View>
          <Text className="sync-pill">
            {visibleRecords.length}
            {visibleRecords.length === records.length ? "" : `/${records.length}`} 场
          </Text>
        </View>
        <FilterRow labels={teamFilters} value={activeTeamFilter} onChange={handleTeamFilter} />
      </View>
      <View className="records-list">
        {visibleRecords.map((record, index) => (
          <MatchRecordCard
            index={index}
            key={record.matchId}
            record={record}
            onOpen={(matchId) => navigate(`/pages/match-detail/index?matchId=${matchId}`)}
          />
        ))}
      </View>
      {visibleRecords.length === 0 ? (
        <View className="content-panel">
          <Text className="muted">{records.length === 0 ? "暂无" : "暂无该队伍比赛记录"}</Text>
        </View>
      ) : null}
    </PageShell>
  );
}

function buildRecordTeamFilters(records: MatchRecord[]): string[] {
  const names = new Set<string>();

  records.forEach((record) => {
    [record.radiantTeamName, record.direTeamName].forEach((name) => {
      const normalized = cleanRecordTeamName(name);

      if (normalized) {
        names.add(normalized);
      }
    });
  });

  return [
    allRecordTeamFilter,
    ...[...names].sort((left, right) => left.localeCompare(right, "zh-CN")),
  ];
}

function matchRecordHasTeam(record: MatchRecord, teamName: string): boolean {
  const normalized = cleanRecordTeamName(teamName);

  return [record.radiantTeamName, record.direTeamName].some(
    (name) => cleanRecordTeamName(name) === normalized,
  );
}

function cleanRecordTeamName(name: string): string {
  const normalized = name.trim();

  return normalized === "天辉" || normalized === "夜魇" ? "" : normalized;
}
