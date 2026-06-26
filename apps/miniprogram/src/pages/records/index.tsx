import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ensureTournamentId, getSelectedTournamentId, loadTournamentMatches, loadTournaments, setSelectedTournamentId } from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { FilterRow, MatchRecordCard, PageShell, TournamentScope } from "../../components";
import type { MatchRecord, TournamentOption } from "../../types";
import { navigate } from "../../utils";

type RecordsCache = {
  records: MatchRecord[];
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

const allRecordTeamFilter = "全部";

export default function RecordsPage() {
  const [initialCache] = useState(() => readPageCache<RecordsCache>(pageCacheKey("records", getSelectedTournamentId() || "auto")));
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>(() => initialCache?.tournaments ?? []);
  const [selectedTournamentId, setSelectedId] = useState(() => initialCache?.selectedTournamentId ?? "");
  const [records, setRecords] = useState<MatchRecord[]>(() => initialCache?.records ?? []);
  const [teamFilter, setTeamFilter] = useState(allRecordTeamFilter);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    const cacheKey = pageCacheKey("records", nextTournamentId ?? (getSelectedTournamentId() || "auto"));
    const cached = readPageCache<RecordsCache>(cacheKey);

    if (cached) {
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setRecords(cached.records);
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
      const nextRecords = targetId ? await loadTournamentMatches(targetId, 100) : [];

      if (targetId) {
        setSelectedTournamentId(targetId);
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
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "比赛记录读取失败");
      }
    } finally {
      setLoading(false);
    }
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
      <TournamentScope tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)} />
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
        <FilterRow labels={teamFilters} value={activeTeamFilter} onChange={setTeamFilter} />
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

  return [allRecordTeamFilter, ...[...names].sort((left, right) => left.localeCompare(right, "zh-CN"))];
}

function matchRecordHasTeam(record: MatchRecord, teamName: string): boolean {
  const normalized = cleanRecordTeamName(teamName);

  return [record.radiantTeamName, record.direTeamName].some((name) => cleanRecordTeamName(name) === normalized);
}

function cleanRecordTeamName(name: string): string {
  const normalized = name.trim();

  return normalized === "天辉" || normalized === "夜魇" ? "" : normalized;
}
