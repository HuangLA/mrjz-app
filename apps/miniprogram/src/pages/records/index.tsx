import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { ensureTournamentId, getSelectedTournamentId, loadTournamentMatches, loadTournaments, setSelectedTournamentId } from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { FilterRow, MatchRecordCard, PageShell, TournamentScope } from "../../components";
import type { MatchRecord, TournamentOption } from "../../types";
import { navigate } from "../../utils";

type RecordsCache = {
  records: MatchRecord[];
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

export default function RecordsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [records, setRecords] = useState<MatchRecord[]>([]);

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

  return (
    <PageShell loading={loading} error={error} routeKey="records">
      <TournamentScope tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)} />
      <View className="section-panel">
        <View className="section-title compact">
          <View>
            <Text className="section-heading">比赛记录</Text>
          </View>
          <Text className="sync-pill">{records.length} 场</Text>
        </View>
        <FilterRow labels={["全部", "已解析", "BP", "眼位", "聊天"]} />
      </View>
      <View className="records-list">
        {records.map((record, index) => (
          <MatchRecordCard
            index={index}
            key={record.matchId}
            record={record}
            onOpen={(matchId) => navigate(`/pages/match-detail/index?matchId=${matchId}`)}
          />
        ))}
      </View>
      {records.length === 0 ? <View className="content-panel"><Text className="muted">暂无</Text></View> : null}
    </PageShell>
  );
}
