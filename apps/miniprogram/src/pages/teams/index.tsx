import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import {
  chooseTournamentId,
  getSelectedTournamentId,
  loadTournamentTeams,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, TeamDirectoryCard, TournamentScope } from "../../components";
import type { TeamListItem, TournamentOption } from "../../types";
import { navigate } from "../../utils";

type TeamsCache = {
  selectedTournamentId: string;
  teams: TeamListItem[];
  tournaments: TournamentOption[];
};

export default function TeamsPage() {
  const [initialStoredTournamentId] = useState(() => getSelectedTournamentId());
  const [initialCache] = useState(() =>
    readPageCache<TeamsCache>(pageCacheKey("teams", initialStoredTournamentId || "auto")),
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
  const [teams, setTeams] = useState<TeamListItem[]>(() => initialCache?.teams ?? []);

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    const storedTournamentId = getSelectedTournamentId();
    const requestedTournamentId = nextTournamentId ?? storedTournamentId;
    const cacheKey = pageCacheKey("teams", requestedTournamentId || "auto");
    const cached = readPageCache<TeamsCache>(cacheKey);

    if (cached) {
      const cachedSelectedTournamentId = chooseTournamentId(
        cached.tournaments,
        requestedTournamentId,
        cached.selectedTournamentId,
      );

      setTournaments(cached.tournaments);
      setSelectedId(cachedSelectedTournamentId);
      setTeams(cached.teams);
      setLoading(false);

      if (cachedSelectedTournamentId && cachedSelectedTournamentId !== storedTournamentId) {
        setSelectedTournamentId(cachedSelectedTournamentId);
      }
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
      const nextTeams = targetId ? await loadTournamentTeams(targetId) : [];

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      const snapshot = {
        selectedTournamentId: targetId,
        teams: nextTeams,
        tournaments: allTournaments,
      };

      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setTeams(snapshot.teams);
      writePageCache(pageCacheKey("teams", targetId || "auto"), snapshot);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "队伍读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  const visibleTeams = useMemo(() => {
    return teams
      .slice()
      .sort(
        (left, right) =>
          right.stats.seriesPlayed - left.stats.seriesPlayed ||
          left.name.localeCompare(right.name, "zh-CN"),
      );
  }, [teams]);

  return (
    <PageShell loading={loading} error={error} routeKey="teams">
      <TournamentScope
        tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)}
      />
      <View className="section-panel">
        <View className="section-title compact">
          <View>
            <Text className="section-heading">队伍主页</Text>
          </View>
          <Text className="sync-pill">{visibleTeams.length} 支</Text>
        </View>
        <View className="profile-card-list">
          {visibleTeams.map((team) => (
            <TeamDirectoryCard
              key={team.id}
              team={team}
              onOpen={(teamId) =>
                navigate(
                  `/pages/team-detail/index?tournamentId=${selectedTournamentId}&teamId=${teamId}`,
                )
              }
            />
          ))}
        </View>
        {visibleTeams.length === 0 ? (
          <View className="content-panel">
            <Text className="muted">暂无</Text>
          </View>
        ) : null}
      </View>
    </PageShell>
  );
}
