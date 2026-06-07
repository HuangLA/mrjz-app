import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { ensureTournamentId, loadTournamentMatches, loadTournaments, setSelectedTournamentId } from "../../api";
import { PageShell, SectionTitle, TournamentPicker } from "../../components";
import type { MatchRecord, TournamentOption } from "../../types";
import { formatDateTime, labelStatus, navigate } from "../../utils";

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
    setLoading(true);
    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId()) || allTournaments[0]?.id || "";
      const nextRecords = targetId ? await loadTournamentMatches(targetId, 100) : [];

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      setTournaments(allTournaments);
      setSelectedId(targetId);
      setRecords(nextRecords);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "比赛记录读取失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell loading={loading} error={error}>
      <TournamentPicker tournaments={tournaments} selectedTournamentId={selectedTournamentId} onChange={(id) => void refresh(id)} />
      <SectionTitle kicker="比赛记录" title={`${records.length} 场战报`} />
      {records.map((record) => (
        <View className="match-record-card" key={record.matchId} onClick={() => navigate(`/pages/match-detail/index?matchId=${record.matchId}`)}>
          <Text className="record-title">{record.radiantTeamName} vs {record.direTeamName}</Text>
          <View className="record-meta">
            <Text className="score-text">{record.radiantScore ?? "-"} : {record.direScore ?? "-"}</Text>
            <Text className="muted">{formatDateTime(record.startTime)}</Text>
          </View>
          <View className="record-flags">
            <Text className="record-flag">{labelStatus(record.parseStatus)}</Text>
            {record.hasDraft ? <Text className="record-flag">BP</Text> : null}
            {record.hasVision ? <Text className="record-flag">视野</Text> : null}
            {record.hasChat ? <Text className="record-flag">聊天</Text> : null}
          </View>
        </View>
      ))}
      {records.length === 0 ? <View className="content-panel"><Text className="muted">暂无比赛记录。</Text></View> : null}
    </PageShell>
  );
}
