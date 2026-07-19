import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadMatchData,
  loadMobileData,
  loadPlayerProfile,
  loadTeamProfile,
  loadTournamentPlayers,
  loadTournamentTeams,
  type MobileData,
} from "./api";
import type { AppRoute, MatchData, PlayerProfile, StageKey, TeamProfile } from "./data";
import { HomePage } from "./pages/HomePage";
import { StagePage } from "./pages/StagePage";
import { SchedulePage } from "./pages/SchedulePage";
import { RecordsPage } from "./pages/RecordsPage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { PlayersPage } from "./pages/PlayersPage";
import { TeamsPage } from "./pages/TeamsPage";
import { PlayerProfilePage, TeamProfilePage } from "./pages/ProfilePages";
import { EmptyState } from "./components/common";
import { MatchRecordCard } from "./components/MatchRecordCard";
import {
  activePrimaryNavRoute,
  emptyMobileData,
  primaryNavRoutes,
  readProfileIdFromHash,
  readRouteFromHash,
  routeLabel,
  sortTournamentPlayers,
  withoutKey,
  type PlayerSortKey,
  type SortDirection,
} from "./utils";

type AppRouteSnapshot = { route: AppRoute; profileId: string | null };
type NavigateOptions = { replace?: boolean; scroll?: boolean; profileId?: string | undefined };

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromHash());
  const [stage, setStage] = useState<StageKey>("group");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(() => new Set());
  const [wardScrubberSeconds, setWardScrubberSeconds] = useState<Record<string, number>>({});
  const [data, setData] = useState<MobileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [playerSortKey, setPlayerSortKey] = useState<PlayerSortKey>("totalMatches");
  const [playerSortDirection, setPlayerSortDirection] = useState<SortDirection>("desc");
  const [profileId, setProfileId] = useState<string | null>(() => readProfileIdFromHash());
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, PlayerProfile>>({});
  const [teamProfiles, setTeamProfiles] = useState<Record<string, TeamProfile>>({});
  const [matchCache, setMatchCache] = useState<Record<string, MatchData>>({});
  const [profileLoading, setProfileLoading] = useState<Record<string, boolean>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const routeHistoryRef = useRef<AppRouteSnapshot[]>([]);
  const loadingKeysRef = useRef(new Set<string>());
  const viewData = data ?? emptyMobileData();

  const resetProfiles = useCallback(() => {
    setPlayerProfiles({});
    setTeamProfiles({});
    setProfileLoading({});
    setProfileErrors({});
    loadingKeysRef.current.clear();
  }, []);

  const refreshData = useCallback(
    async (tournamentId?: string) => {
      setLoading(true);

      try {
        const nextData = await loadMobileData(tournamentId);
        setData(nextData);
        setSelectedTournamentId(nextData.selectedTournamentId);
        resetProfiles();
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [resetProfiles],
  );

  useEffect(() => {
    void refreshData(selectedTournamentId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `MRJZ 桌面 - ${routeLabel(route)}`;
  }, [route]);

  useEffect(() => {
    const syncRouteFromHash = () => {
      setRoute(readRouteFromHash());
      setProfileId(readProfileIdFromHash());
    };

    window.addEventListener("hashchange", syncRouteFromHash);
    window.addEventListener("popstate", syncRouteFromHash);

    return () => {
      window.removeEventListener("hashchange", syncRouteFromHash);
      window.removeEventListener("popstate", syncRouteFromHash);
    };
  }, []);

  const navigateTo = useCallback(
    (nextRoute: AppRoute, options: NavigateOptions = {}) => {
      const carriesId = nextRoute === "player" || nextRoute === "team" || nextRoute === "match";
      const nextProfileId = options.profileId ?? (carriesId ? profileId : null);
      const nextHash = carriesId
        ? `#${nextRoute}/${encodeURIComponent(nextProfileId ?? "")}`
        : `#${nextRoute}`;

      if (nextRoute !== route && !options.replace) {
        routeHistoryRef.current.push({ route, profileId });
      }

      setRoute(nextRoute);
      setProfileId(nextProfileId);

      if (options.replace) {
        window.history.replaceState(null, "", nextHash);
      } else if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }

      if (options.scroll !== false) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [profileId, route],
  );

  const goBack = useCallback(() => {
    const previousRoute = routeHistoryRef.current.pop();

    if (previousRoute) {
      navigateTo(previousRoute.route, {
        replace: true,
        profileId: previousRoute.profileId ?? undefined,
      });
      return;
    }

    if (route === "player") {
      navigateTo("players", { replace: true });
      return;
    }

    if (route === "team") {
      navigateTo("teams", { replace: true });
      return;
    }

    if (route === "match") {
      navigateTo("records", { replace: true });
      return;
    }

    if (route !== "home") {
      navigateTo("home", { replace: true });
    }
  }, [navigateTo, route]);

  const selectTournament = useCallback(
    async (tournamentId: string, targetRoute: AppRoute = "stage") => {
      setSelectedTournamentId(tournamentId);
      resetProfiles();
      navigateTo(targetRoute, { scroll: true });
      await refreshData(tournamentId);
    },
    [navigateTo, refreshData, resetProfiles],
  );

  const ensureMatchLoaded = useCallback(
    async (matchId: string) => {
      const snapshot = data;
      const key = `match:${matchId}`;

      if (!snapshot || matchCache[matchId] || loadingKeysRef.current.has(key)) {
        return;
      }

      loadingKeysRef.current.add(key);
      setProfileLoading((previous) => ({ ...previous, [key]: true }));
      setProfileErrors((previous) => withoutKey(previous, key));

      try {
        const match = await loadMatchData(snapshot.apiBaseUrl, matchId);
        setMatchCache((previous) => ({ ...previous, [matchId]: match }));
        setData((previous) =>
          previous ? { ...previous, featuredMatch: match, notice: null } : previous,
        );
      } catch {
        setProfileErrors((previous) => ({
          ...previous,
          [key]: `match ${matchId} 暂无真实详情或尚未入库。`,
        }));
      } finally {
        loadingKeysRef.current.delete(key);
        setProfileLoading((previous) => withoutKey(previous, key));
      }
    },
    [data, matchCache],
  );

  const openMatch = useCallback(
    (matchId: string) => {
      navigateTo("match", { profileId: matchId });
    },
    [navigateTo],
  );

  useEffect(() => {
    if (route === "match" && profileId) {
      void ensureMatchLoaded(profileId);
    }
  }, [route, profileId, ensureMatchLoaded]);

  const ensurePlayersLoaded = useCallback(async () => {
    const snapshot = data;
    const key = "players";

    if (!snapshot || snapshot.players.length > 0 || loadingKeysRef.current.has(key)) {
      return;
    }

    loadingKeysRef.current.add(key);
    setProfileLoading((previous) => ({ ...previous, [key]: true }));
    setProfileErrors((previous) => withoutKey(previous, key));

    try {
      const players = await loadTournamentPlayers(
        snapshot.apiBaseUrl,
        snapshot.selectedTournamentId,
      );
      setData((previous) =>
        previous && previous.selectedTournamentId === snapshot.selectedTournamentId
          ? { ...previous, players }
          : previous,
      );
    } catch (error) {
      console.error(error);
      setProfileErrors((previous) => ({ ...previous, [key]: "读取失败" }));
    } finally {
      loadingKeysRef.current.delete(key);
      setProfileLoading((previous) => withoutKey(previous, key));
    }
  }, [data]);

  const ensureTeamsLoaded = useCallback(async () => {
    const snapshot = data;
    const key = "teams";

    if (!snapshot || snapshot.teams.length > 0 || loadingKeysRef.current.has(key)) {
      return;
    }

    loadingKeysRef.current.add(key);
    setProfileLoading((previous) => ({ ...previous, [key]: true }));
    setProfileErrors((previous) => withoutKey(previous, key));

    try {
      const teams = await loadTournamentTeams(snapshot.apiBaseUrl, snapshot.selectedTournamentId);
      setData((previous) =>
        previous && previous.selectedTournamentId === snapshot.selectedTournamentId
          ? { ...previous, teams }
          : previous,
      );
    } catch (error) {
      console.error(error);
      setProfileErrors((previous) => ({ ...previous, [key]: "读取失败" }));
    } finally {
      loadingKeysRef.current.delete(key);
      setProfileLoading((previous) => withoutKey(previous, key));
    }
  }, [data]);

  const ensurePlayerProfileLoaded = useCallback(
    async (playerId: string) => {
      const snapshot = data;
      const key = `player:${playerId}`;

      if (!snapshot || playerProfiles[playerId] || loadingKeysRef.current.has(key)) {
        return;
      }

      loadingKeysRef.current.add(key);
      setProfileLoading((previous) => ({ ...previous, [key]: true }));
      setProfileErrors((previous) => withoutKey(previous, key));

      try {
        const profile = await loadPlayerProfile(
          snapshot.apiBaseUrl,
          snapshot.selectedTournamentId,
          playerId,
        );
        setPlayerProfiles((previous) => ({ ...previous, [playerId]: profile }));
      } catch (error) {
        console.error(error);
        setProfileErrors((previous) => ({ ...previous, [key]: "读取失败" }));
      } finally {
        loadingKeysRef.current.delete(key);
        setProfileLoading((previous) => withoutKey(previous, key));
      }
    },
    [data, playerProfiles],
  );

  const ensureTeamProfileLoaded = useCallback(
    async (teamId: string) => {
      const snapshot = data;
      const key = `team:${teamId}`;

      if (!snapshot || teamProfiles[teamId] || loadingKeysRef.current.has(key)) {
        return;
      }

      loadingKeysRef.current.add(key);
      setProfileLoading((previous) => ({ ...previous, [key]: true }));
      setProfileErrors((previous) => withoutKey(previous, key));

      try {
        const profile = await loadTeamProfile(
          snapshot.apiBaseUrl,
          snapshot.selectedTournamentId,
          teamId,
        );
        setTeamProfiles((previous) => ({ ...previous, [teamId]: profile }));
      } catch (error) {
        console.error(error);
        setProfileErrors((previous) => ({ ...previous, [key]: "读取失败" }));
      } finally {
        loadingKeysRef.current.delete(key);
        setProfileLoading((previous) => withoutKey(previous, key));
      }
    },
    [data, teamProfiles],
  );

  useEffect(() => {
    if (route === "players" || (route === "player" && !profileId)) {
      void ensurePlayersLoaded();
    }

    if (route === "teams" || (route === "team" && !profileId)) {
      void ensureTeamsLoaded();
    }

    const playerId = route === "player" ? (profileId ?? viewData.players[0]?.id ?? null) : null;

    if (route === "player" && playerId) {
      void ensurePlayerProfileLoaded(playerId);
    }

    const teamId = route === "team" ? (profileId ?? viewData.teams[0]?.id ?? null) : null;

    if (route === "team" && teamId) {
      void ensureTeamProfileLoaded(teamId);
    }
  }, [
    route,
    profileId,
    viewData.players,
    viewData.teams,
    ensurePlayerProfileLoaded,
    ensurePlayersLoaded,
    ensureTeamProfileLoaded,
    ensureTeamsLoaded,
  ]);

  const handlePlayerSort = useCallback(
    (sortKey: PlayerSortKey) => {
      if (sortKey === playerSortKey) {
        setPlayerSortDirection((current) => (current === "desc" ? "asc" : "desc"));
        return;
      }

      setPlayerSortKey(sortKey);
      setPlayerSortDirection(sortKey === "displayName" ? "asc" : "desc");
    },
    [playerSortKey],
  );

  const handlePlayerToggle = useCallback((playerId: string) => {
    setExpandedPlayers((current) => {
      const next = new Set(current);

      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }

      return next;
    });
  }, []);

  const handleWardSecondChange = useCallback((matchId: string, seconds: number) => {
    setWardScrubberSeconds((current) => ({ ...current, [matchId]: seconds }));
  }, []);

  const handleRetryProfile = useCallback(
    (type: "player" | "team", id: string) => {
      if (type === "player") {
        void ensurePlayerProfileLoaded(id);
        return;
      }

      void ensureTeamProfileLoaded(id);
    },
    [ensurePlayerProfileLoaded, ensureTeamProfileLoaded],
  );

  const sortedPlayers = sortTournamentPlayers(viewData.players, playerSortKey, playerSortDirection);
  const activeMatch = route === "match" && profileId ? (matchCache[profileId] ?? null) : null;
  const matchError =
    route === "match" && profileId ? profileErrors[`match:${profileId}`] : undefined;
  const activeNav = activePrimaryNavRoute(route);

  let routeView: React.ReactNode;
  switch (route) {
    case "home":
      routeView = (
        <HomePage data={viewData} onSelectTournament={(id) => void selectTournament(id, "stage")} />
      );
      break;
    case "stage":
      routeView = (
        <StagePage
          data={viewData}
          loading={loading}
          stage={stage}
          onStageChange={setStage}
          onNavigate={navigateTo}
          onOpenMatch={openMatch}
        />
      );
      break;
    case "schedule":
      routeView = (
        <SchedulePage
          data={viewData}
          loading={loading}
          onNavigate={navigateTo}
          onOpenMatch={openMatch}
        />
      );
      break;
    case "records":
      routeView = (
        <RecordsPage
          data={viewData}
          loading={loading}
          onNavigate={navigateTo}
          onOpenMatch={openMatch}
        />
      );
      break;
    case "match":
      routeView = activeMatch ? (
        <MatchDetailPage
          data={viewData}
          loading={loading}
          match={activeMatch}
          expandedPlayers={expandedPlayers}
          wardScrubberSeconds={wardScrubberSeconds}
          onPlayerToggle={handlePlayerToggle}
          onWardSecondChange={handleWardSecondChange}
        />
      ) : (
        <MatchPicker
          data={viewData}
          loading={loading || Boolean(profileId && profileLoading[`match:${profileId}`])}
          error={matchError ?? null}
          matchId={profileId}
          onOpenMatch={openMatch}
          onRetry={ensureMatchLoaded}
        />
      );
      break;
    case "leaderboard":
      routeView = <LeaderboardPage data={viewData} loading={loading} onNavigate={navigateTo} />;
      break;
    case "players":
      routeView = (
        <PlayersPage
          data={viewData}
          loading={loading}
          players={sortedPlayers}
          profileLoading={profileLoading}
          profileErrors={profileErrors}
          playerSortKey={playerSortKey}
          playerSortDirection={playerSortDirection}
          onNavigate={navigateTo}
          onSort={handlePlayerSort}
        />
      );
      break;
    case "teams":
      routeView = (
        <TeamsPage
          data={viewData}
          loading={loading}
          profileLoading={profileLoading}
          profileErrors={profileErrors}
          onNavigate={navigateTo}
        />
      );
      break;
    case "player":
      routeView = (
        <PlayerProfilePage
          data={viewData}
          loading={loading}
          profileId={profileId}
          profiles={playerProfiles}
          profileErrors={profileErrors}
          onNavigate={navigateTo}
          onOpenMatch={openMatch}
          onRetry={handleRetryProfile}
        />
      );
      break;
    case "team":
      routeView = (
        <TeamProfilePage
          data={viewData}
          loading={loading}
          profileId={profileId}
          profiles={teamProfiles}
          profileErrors={profileErrors}
          onNavigate={navigateTo}
          onOpenMatch={openMatch}
          onRetry={handleRetryProfile}
        />
      );
      break;
    default:
      routeView = (
        <HomePage data={viewData} onSelectTournament={(id) => void selectTournament(id, "stage")} />
      );
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <div className="ambient-bg" aria-hidden="true">
        <i className="ambient-orb orb-one" />
        <i className="ambient-orb orb-two" />
        <i className="ambient-orb orb-three" />
        <i className="ambient-grid" />
      </div>
      <aside className="sidebar">
        <button className="sidebar-brand" type="button" onClick={() => navigateTo("home")}>
          <span className="sidebar-logo">M</span>
          <span className="sidebar-brand-text">
            <b>MRJZ</b>
            <small>指挥中心</small>
          </span>
        </button>
        <nav className="sidebar-nav" aria-label="主导航">
          {primaryNavRoutes.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-nav-item ${activeNav === item.key ? "active" : ""}`}
              onClick={() => navigateTo(item.key)}
              aria-current={activeNav === item.key ? "page" : undefined}
            >
              <span className="sidebar-nav-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              <small className="sidebar-nav-kicker">{item.kicker}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-tournament">
            <span>当前赛事</span>
            <b>{viewData.selectedTournamentName}</b>
            <small>
              League {viewData.selectedTournamentMeta.leagueId} ·{" "}
              {viewData.selectedTournamentMeta.statusText}
            </small>
          </div>
          <button
            className="sidebar-collapse"
            type="button"
            aria-pressed={sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button
            className="topbar-back"
            type="button"
            onClick={goBack}
            disabled={route === "home"}
          >
            ‹ 返回
          </button>
          <div className="topbar-title">
            <span className="topbar-crumb">MRJZ / {routeLabel(route)}</span>
            <h1>{routeLabel(route)}</h1>
          </div>
          <div className="topbar-actions">
            <span className={`topbar-status ${loading ? "is-loading" : ""}`}>
              <i aria-hidden="true" />
              {loading ? "同步中" : viewData.source === "api" ? "API 在线" : "离线"}
            </span>
          </div>
        </header>
        <main className="view" key={`${route}:${profileId ?? ""}`}>
          {routeView}
        </main>
      </div>
    </div>
  );
}

function MatchPicker({
  data,
  loading,
  error,
  matchId,
  onOpenMatch,
  onRetry,
}: {
  data: MobileData;
  loading: boolean;
  error: string | null;
  matchId: string | null;
  onOpenMatch: (matchId: string) => void;
  onRetry: (matchId: string) => Promise<void>;
}) {
  if (error && matchId) {
    return (
      <div className="page-stack">
        <section className="panel profile-loading profile-error">
          <h2>读取失败</h2>
          <small>{error}</small>
          <button type="button" className="ghost-button" onClick={() => void onRetry(matchId)}>
            再试一次
          </button>
        </section>
      </div>
    );
  }

  if (loading && matchId) {
    return (
      <div className="page-stack">
        <section className="panel profile-loading">
          <span className="data-notice-pulse" aria-hidden="true" />
          <h2>战报读取中</h2>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="panel reveal">
        <header className="panel-head">
          <div className="panel-title">
            <h2>选择一场比赛</h2>
            <p>从最近入库的战报中选择要查看的比赛详情</p>
          </div>
          <span className="pill">{data.matchRecords.length} 场</span>
        </header>
        <div className="records-grid">
          {data.matchRecords.length > 0 ? (
            data.matchRecords
              .slice(0, 12)
              .map((record, index) => (
                <MatchRecordCard
                  key={record.matchId}
                  record={record}
                  index={index}
                  onOpenMatch={onOpenMatch}
                />
              ))
          ) : (
            <EmptyState text={loading ? "读取中" : "暂无"} />
          )}
        </div>
      </section>
    </div>
  );
}
