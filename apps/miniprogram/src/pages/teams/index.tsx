import { Input, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ensureTournamentId, loadTournamentTeams, loadTournaments, setSelectedTournamentId } from "../../api";
import { PageShell, SectionTitle, TeamBadge, TournamentPicker } from "../../components";
import type { TeamListItem, TournamentOption } from "../../types";
import { formatInteger, formatPercent, navigate } from "../../utils";

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [teams, setTeams] = useState<TeamListItem[]>([]);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    setLoading(true);
    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId()) || allTournaments[0]?.id || "";
      const nextTeams = targetId ? await loadTournamentTeams(targetId) : [];

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      setTournaments(allTournaments);
      setSelectedId(targetId);
      setTeams(nextTeams);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "队伍读取失败");
    } finally {
      setLoading(false);
    }
  }

  const visibleTeams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return teams.filter((team) => `${team.name} ${team.shortName ?? ""}`.toLowerCase().includes(normalized));
  }, [query, teams]);

  return (
    <PageShell loading={loading} error={error}>
      <TournamentPicker tournaments={tournaments} selectedTournamentId={selectedTournamentId} onChange={(id) => void refresh(id)} />
      <SectionTitle kicker="队伍" title="参赛战队" />
      <Input className="search-input" value={query} placeholder="搜索队名或简称" onInput={(event) => setQuery(String(event.detail.value))} />
      {visibleTeams.map((team) => (
        <View className="team-row" key={team.id} onClick={() => navigate(`/pages/team-detail/index?tournamentId=${selectedTournamentId}&teamId=${team.id}`)}>
          <TeamBadge team={team} />
          <View className="team-main">
            <View className="team-stats">
              <Text className="mini-stat">{formatInteger(team.memberCount)} 人</Text>
              <Text className="mini-stat">胜率 {formatPercent(team.stats.winRate)}</Text>
              <Text className="mini-stat">{team.stats.seriesWins}-{team.stats.seriesLosses}</Text>
            </View>
          </View>
        </View>
      ))}
      {visibleTeams.length === 0 ? <View className="content-panel"><Text className="muted">暂无匹配队伍。</Text></View> : null}
    </PageShell>
  );
}
