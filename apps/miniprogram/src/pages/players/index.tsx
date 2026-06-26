import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ensureTournamentId, getSelectedTournamentId, loadTournamentPlayers, loadTournaments, setSelectedTournamentId } from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, PlayerDirectoryCard, TournamentScope } from "../../components";
import type { PlayerListItem, TournamentOption } from "../../types";
import { navigate } from "../../utils";

type PlayerSortKey =
  | "displayName"
  | "totalMatches"
  | "winRate"
  | "kda"
  | "avgKills"
  | "avgGpm"
  | "avgXpm"
  | "avgHeroDamage"
  | "avgTowerDamage"
  | "avgDamageTaken";
type SortDirection = "asc" | "desc";

const playerSortOptions: Array<{ key: PlayerSortKey; label: string; defaultDirection: SortDirection }> = [
  { key: "totalMatches", label: "场次", defaultDirection: "desc" },
  { key: "winRate", label: "胜率", defaultDirection: "desc" },
  { key: "kda", label: "KDA", defaultDirection: "desc" },
  { key: "avgKills", label: "击杀", defaultDirection: "desc" },
  { key: "avgGpm", label: "GPM", defaultDirection: "desc" },
  { key: "avgXpm", label: "XPM", defaultDirection: "desc" },
  { key: "avgHeroDamage", label: "伤害", defaultDirection: "desc" },
  { key: "avgTowerDamage", label: "建筑", defaultDirection: "desc" },
  { key: "avgDamageTaken", label: "承伤", defaultDirection: "desc" },
  { key: "displayName", label: "名字", defaultDirection: "asc" },
];

type PlayersCache = {
  players: PlayerListItem[];
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

export default function PlayersPage() {
  const [initialCache] = useState(() => readPageCache<PlayersCache>(pageCacheKey("players", getSelectedTournamentId() || "auto")));
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<PlayerSortKey>("totalMatches");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [tournaments, setTournaments] = useState<TournamentOption[]>(() => initialCache?.tournaments ?? []);
  const [selectedTournamentId, setSelectedId] = useState(() => initialCache?.selectedTournamentId ?? "");
  const [players, setPlayers] = useState<PlayerListItem[]>(() => initialCache?.players ?? []);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    const cacheKey = pageCacheKey("players", nextTournamentId ?? (getSelectedTournamentId() || "auto"));
    const cached = readPageCache<PlayersCache>(cacheKey);

    if (cached) {
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setPlayers(cached.players);
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
      const nextPlayers = targetId ? await loadTournamentPlayers(targetId) : [];

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      const snapshot = {
        players: nextPlayers,
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setPlayers(snapshot.players);
      writePageCache(pageCacheKey("players", targetId || "auto"), snapshot);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "选手读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  const visiblePlayers = useMemo(() => sortTournamentPlayers(players, sortKey, sortDirection), [players, sortDirection, sortKey]);

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

function sortTournamentPlayers(players: PlayerListItem[], sortKey: PlayerSortKey, direction: SortDirection): PlayerListItem[] {
  return players.slice().sort((left, right) => comparePlayers(left, right, sortKey, direction));
}

function comparePlayers(left: PlayerListItem, right: PlayerListItem, key: PlayerSortKey, direction: SortDirection): number {
  if (key === "displayName") {
    const result = left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
    return direction === "asc" ? result : -result;
  }

  const leftValue = playerSortValue(left, key);
  const rightValue = playerSortValue(right, key);

  if (leftValue === null && rightValue === null) {
    return left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  const result = leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
  const normalized = direction === "asc" ? result : -result;

  return normalized || left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
}

function playerSortValue(player: PlayerListItem, key: PlayerSortKey): number | null {
  switch (key) {
    case "totalMatches":
      return player.stats.totalMatches;
    case "winRate":
      return player.stats.winRate;
    case "kda":
      return player.stats.kda;
    case "avgKills":
      return player.stats.avgKills;
    case "avgGpm":
      return player.stats.avgGpm;
    case "avgXpm":
      return player.stats.avgXpm;
    case "avgHeroDamage":
      return player.stats.avgHeroDamage;
    case "avgTowerDamage":
      return player.stats.avgTowerDamage;
    case "avgDamageTaken":
      return player.stats.avgDamageTaken;
    case "displayName":
      return null;
  }
}
