import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import {
  chooseTournamentId,
  getSelectedTournamentId,
  loadTournamentPlayers,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, PlayerDirectoryCard, TournamentScope, useMainTabState } from "../../components";
import {
  mergePageViewState,
  pageViewStateKey,
  readPageViewState,
  restorePageScroll,
  usePageScrollMemory,
} from "../../pageState";
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

const playerSortOptions: Array<{
  key: PlayerSortKey;
  label: string;
  defaultDirection: SortDirection;
}> = [
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

type PlayersViewState = {
  scrollTop?: number;
  sortDirection?: SortDirection;
  sortKey?: PlayerSortKey;
};

export function PlayersContent() {
  const mainTabState = useMainTabState();
  const [initialStoredTournamentId] = useState(() => getSelectedTournamentId());
  const [initialCache] = useState(() =>
    readPageCache<PlayersCache>(pageCacheKey("players", initialStoredTournamentId || "auto")),
  );
  const [initialViewState] = useState(() =>
    readPageViewState<PlayersViewState>(
      pageViewStateKey("players", initialStoredTournamentId || "auto"),
    ),
  );
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<PlayerSortKey>(() =>
    normalizePlayerSortKey(initialViewState?.sortKey),
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(() =>
    normalizeSortDirection(initialViewState?.sortDirection),
  );
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
  const [players, setPlayers] = useState<PlayerListItem[]>(() => initialCache?.players ?? []);
  const viewStateKey = pageViewStateKey(
    "players",
    selectedTournamentId || initialStoredTournamentId || "auto",
  );

  usePageScrollMemory(viewStateKey);

  useDidShow(() => {
    if (mainTabState) {
      return;
    }

    void refresh();
  });

  useEffect(() => {
    if (mainTabState?.activeRouteKey !== "players") {
      return;
    }

    void refresh(mainTabState.selectedTournamentId);
  }, [
    mainTabState?.activeRouteKey,
    mainTabState?.selectedTournamentId,
    mainTabState?.selectedTournamentVersion,
  ]);

  async function refresh(nextTournamentId?: string) {
    const storedTournamentId = getSelectedTournamentId();
    const requestedTournamentId = nextTournamentId ?? storedTournamentId;
    const cacheKey = pageCacheKey("players", requestedTournamentId || "auto");
    const cached = readPageCache<PlayersCache>(cacheKey);

    if (cached) {
      const cachedSelectedTournamentId = chooseTournamentId(
        cached.tournaments,
        requestedTournamentId,
        cached.selectedTournamentId,
      );

      setTournaments(cached.tournaments);
      setSelectedId(cachedSelectedTournamentId);
      setPlayers(cached.players);
      setLoading(false);

      if (cachedSelectedTournamentId && cachedSelectedTournamentId !== storedTournamentId) {
        persistSelectedTournamentId(cachedSelectedTournamentId);
      }

      applyPlayersViewState(cachedSelectedTournamentId || requestedTournamentId || "auto");
    } else {
      setLoading(true);
    }

    setError("");

    if (cached && isPageCacheFresh(cacheKey)) {
      return;
    }

    try {
      const allTournaments = await loadTournaments();
      const targetId = chooseTournamentId(
        allTournaments,
        nextTournamentId,
        getSelectedTournamentId(),
      );
      const nextPlayers = targetId ? await loadTournamentPlayers(targetId) : [];

      if (targetId) {
        persistSelectedTournamentId(targetId);
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
      applyPlayersViewState(targetId || "auto");
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "选手读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  const visiblePlayers = useMemo(
    () => sortTournamentPlayers(players, sortKey, sortDirection),
    [players, sortDirection, sortKey],
  );

  function handleSort(nextKey: PlayerSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => {
        const nextDirection = current === "desc" ? "asc" : "desc";
        mergePageViewState<PlayersViewState>(viewStateKey, {
          sortDirection: nextDirection,
          sortKey: nextKey,
        });

        return nextDirection;
      });
      return;
    }

    const nextDirection =
      playerSortOptions.find((option) => option.key === nextKey)?.defaultDirection ?? "desc";

    setSortKey(nextKey);
    setSortDirection(nextDirection);
    mergePageViewState<PlayersViewState>(viewStateKey, {
      sortDirection: nextDirection,
      sortKey: nextKey,
    });
  }

  function applyPlayersViewState(tournamentId: string) {
    const key = pageViewStateKey("players", tournamentId || "auto");
    const state = readPageViewState<PlayersViewState>(key);

    if (isPlayerSortKey(state?.sortKey)) {
      setSortKey(state.sortKey);
    }

    if (isSortDirection(state?.sortDirection)) {
      setSortDirection(state.sortDirection);
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

  const activeSort =
    playerSortOptions.find((option) => option.key === sortKey) ?? playerSortOptions[0]!;

  return (
    <PageShell loading={loading} error={error} routeKey="players">
      <TournamentScope
        tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)}
      />
      <View className="section-panel player-board-panel">
        <View className="section-title compact">
          <View>
            <Text className="section-heading">选手数据榜</Text>
          </View>
          <Text className="sync-pill">{visiblePlayers.length} 名</Text>
        </View>
        <View className="player-sort-meta">
          <Text>排序</Text>
          <Text>
            {activeSort.label} {sortDirection === "desc" ? "↓" : "↑"}
          </Text>
        </View>
        <View className="player-sort-bar">
          {playerSortOptions.map((option) => {
            const active = option.key === sortKey;
            const shownDirection = active ? sortDirection : option.defaultDirection;

            return (
              <Button
                className={active ? "active" : ""}
                key={option.key}
                onClick={() => handleSort(option.key)}
              >
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
              onOpen={(playerId) =>
                navigate(
                  `/pages/player-detail/index?tournamentId=${selectedTournamentId}&playerId=${playerId}`,
                )
              }
            />
          ))}
        </View>
        {visiblePlayers.length === 0 ? (
          <View className="content-panel">
            <Text className="muted">暂无</Text>
          </View>
        ) : null}
      </View>
    </PageShell>
  );
}

function sortTournamentPlayers(
  players: PlayerListItem[],
  sortKey: PlayerSortKey,
  direction: SortDirection,
): PlayerListItem[] {
  return players.slice().sort((left, right) => comparePlayers(left, right, sortKey, direction));
}

function comparePlayers(
  left: PlayerListItem,
  right: PlayerListItem,
  key: PlayerSortKey,
  direction: SortDirection,
): number {
  if (key === "displayName") {
    const result =
      left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
    return direction === "asc" ? result : -result;
  }

  const leftValue = playerSortValue(left, key);
  const rightValue = playerSortValue(right, key);

  if (leftValue === null && rightValue === null) {
    return (
      left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id)
    );
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  const result = leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
  const normalized = direction === "asc" ? result : -result;

  return (
    normalized ||
    left.displayName.localeCompare(right.displayName, "zh-CN") ||
    left.id.localeCompare(right.id)
  );
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

function normalizePlayerSortKey(value: PlayerSortKey | undefined): PlayerSortKey {
  return isPlayerSortKey(value) ? value : "totalMatches";
}

function normalizeSortDirection(value: SortDirection | undefined): SortDirection {
  return isSortDirection(value) ? value : "desc";
}

function isPlayerSortKey(value: unknown): value is PlayerSortKey {
  return playerSortOptions.some((option) => option.key === value);
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}
