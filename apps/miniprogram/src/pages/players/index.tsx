import { Input, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ensureTournamentId, loadTournamentPlayers, loadTournaments, setSelectedTournamentId } from "../../api";
import { PageShell, PlayerAvatar, SectionTitle, TournamentPicker } from "../../components";
import type { PlayerListItem, TournamentOption } from "../../types";
import { formatDecimal, formatInteger, formatPercent, navigate } from "../../utils";

export default function PlayersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [players, setPlayers] = useState<PlayerListItem[]>([]);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    setLoading(true);
    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId()) || allTournaments[0]?.id || "";
      const nextPlayers = targetId ? await loadTournamentPlayers(targetId) : [];

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      setTournaments(allTournaments);
      setSelectedId(targetId);
      setPlayers(nextPlayers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "选手读取失败");
    } finally {
      setLoading(false);
    }
  }

  const visiblePlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return players
      .filter((player) => {
        if (normalized.length === 0) return true;
        return `${player.displayName} ${player.currentTeam?.name ?? ""} ${player.accountId ?? ""}`.toLowerCase().includes(normalized);
      })
      .sort((left, right) => (right.stats.totalMatches - left.stats.totalMatches) || left.displayName.localeCompare(right.displayName, "zh-CN"));
  }, [players, query]);

  return (
    <PageShell loading={loading} error={error} routeKey="players">
      <TournamentPicker tournaments={tournaments} selectedTournamentId={selectedTournamentId} onChange={(id) => void refresh(id)} />
      <SectionTitle kicker="选手" title="数据榜" />
      <Input className="search-input" value={query} placeholder="搜索选手、队伍或 Dota account_id" onInput={(event) => setQuery(String(event.detail.value))} />
      {visiblePlayers.map((player) => (
        <View
          className="player-row"
          key={player.id}
          onClick={() => navigate(`/pages/player-detail/index?tournamentId=${selectedTournamentId}&playerId=${player.id}`)}
        >
          <PlayerAvatar player={player} />
          <View className="player-main">
            <Text className="player-name">{player.displayName}</Text>
            <Text className="player-team">{player.currentTeam?.name ?? "暂未归队"} · {player.accountId ?? "无账号"}</Text>
            <View className="player-stats">
              <Text className="mini-stat">{formatInteger(player.stats.totalMatches)} 场</Text>
              <Text className="mini-stat">胜率 {formatPercent(player.stats.winRate)}</Text>
              <Text className="mini-stat">KDA {formatDecimal(player.stats.kda)}</Text>
            </View>
          </View>
        </View>
      ))}
      {visiblePlayers.length === 0 ? <View className="content-panel"><Text className="muted">暂无匹配选手。</Text></View> : null}
    </PageShell>
  );
}
