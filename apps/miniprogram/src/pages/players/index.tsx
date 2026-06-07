import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ensureTournamentId, loadTournamentPlayers, loadTournaments, setSelectedTournamentId } from "../../api";
import { PageShell, PlayerDirectoryCard, TournamentScope } from "../../components";
import type { PlayerListItem, TournamentOption } from "../../types";
import { navigate } from "../../utils";

type PlayerSortKey = "matches" | "winRate" | "kda" | "gpm" | "xpm" | "damage";
type SortDirection = "asc" | "desc";

const playerSortOptions: Array<{ key: PlayerSortKey; label: string; defaultDirection: SortDirection }> = [
  { key: "matches", label: "场次", defaultDirection: "desc" },
  { key: "winRate", label: "胜率", defaultDirection: "desc" },
  { key: "kda", label: "KDA", defaultDirection: "desc" },
  { key: "gpm", label: "GPM", defaultDirection: "desc" },
  { key: "xpm", label: "XPM", defaultDirection: "desc" },
  { key: "damage", label: "伤害", defaultDirection: "desc" },
];

export default function PlayersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<PlayerSortKey>("matches");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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
    return players.slice().sort((left, right) => {
      const leftValue = playerSortValue(left, sortKey);
      const rightValue = playerSortValue(right, sortKey);
      const result = leftValue === rightValue ? left.displayName.localeCompare(right.displayName, "zh-CN") : leftValue - rightValue;

      return sortDirection === "asc" ? result : -result;
    });
  }, [players, sortDirection, sortKey]);

  function handleSort(nextKey: PlayerSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(playerSortOptions.find((option) => option.key === nextKey)?.defaultDirection ?? "desc");
  }

  const activeSort = playerSortOptions.find((option) => option.key === sortKey) ?? playerSortOptions[0]!;

  return (
    <PageShell loading={loading} error={error} routeKey="players">
      <TournamentScope tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)} />
      <View className="section-panel player-board-panel">
        <View className="section-title compact">
          <View>
            <Text className="section-heading">选手数据榜</Text>
          </View>
          <Text className="sync-pill">{visiblePlayers.length} 名</Text>
        </View>
        <View className="player-sort-meta">
          <Text>排序</Text>
          <Text>{activeSort.label} {sortDirection === "desc" ? "↓" : "↑"}</Text>
        </View>
        <View className="player-sort-bar">
          {playerSortOptions.map((option) => {
            const active = option.key === sortKey;
            const shownDirection = active ? sortDirection : option.defaultDirection;

            return (
              <Button className={active ? "active" : ""} key={option.key} onClick={() => handleSort(option.key)}>
                {option.label}
                <Text>{shownDirection === "desc" ? "↓" : "↑"}</Text>
              </Button>
            );
          })}
        </View>
        <View className="player-stat-list">
          {visiblePlayers.map((player) => (
            <PlayerDirectoryCard
              key={player.id}
              player={player}
              onOpen={(playerId) => navigate(`/pages/player-detail/index?tournamentId=${selectedTournamentId}&playerId=${playerId}`)}
            />
          ))}
        </View>
        {visiblePlayers.length === 0 ? <View className="content-panel"><Text className="muted">暂无</Text></View> : null}
      </View>
    </PageShell>
  );
}

function playerSortValue(player: PlayerListItem, key: PlayerSortKey): number {
  switch (key) {
    case "winRate":
      return player.stats.winRate ?? -1;
    case "kda":
      return player.stats.kda ?? -1;
    case "gpm":
      return player.stats.avgGpm ?? -1;
    case "xpm":
      return player.stats.avgXpm ?? -1;
    case "damage":
      return player.stats.avgHeroDamage ?? -1;
    case "matches":
    default:
      return player.stats.totalMatches;
  }
}
