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
import { DashboardPage } from "./pages/DashboardPage";
import { StagePage } from "./pages/StagePage";
import { SchedulePage } from "./pages/SchedulePage";
import { RecordsWorkspace } from "./pages/RecordsWorkspace";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { PlayersPage } from "./pages/PlayersPage";
import { TeamsPage } from "./pages/TeamsPage";
import { PlayerProfileContent, TeamProfileContent } from "./pages/ProfilePages";
import { CommandPalette, type PaletteTarget } from "./components/CommandPalette";
import {
  activePrimaryNavRoute,
  emptyMobileData,
  lifecycleLabel,
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

const railItems: Array<{ key: AppRoute; label: string; icon: React.ReactNode }> = [
  {
    key: "home",
    label: "驾驶舱",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "stage",
    label: "赛事阶段",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </svg>
    ),
  },
  {
    key: "schedule",
    label: "赛程",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    key: "records",
    label: "战报工作台",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M4 4h7v16H4zM13 4h7v16h-7z" />
        <path d="M7 8h1M7 12h1M16 8h1M16 12h1" />
      </svg>
    ),
  },
  {
    key: "leaderboard",
    label: "英雄榜",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1" />
      </svg>
    ),
  },
  {
    key: "players",
    label: "选手",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
      </svg>
    ),
  },
  {
    key: "teams",
    label: "队伍",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <circle cx="8" cy="9" r="3" />
        <circle cx="16.5" cy="10.5" r="2.5" />
        <path d="M2.5 20c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5M14 20c.7-2.3 2.3-3.5 4.5-3.5 1 0 2 .2 2.9.8" />
      </svg>
    ),
  },
];

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tournamentMenuOpen, setTournamentMenuOpen] = useState(false);

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
    document.title = `MRJZ Console - ${routeLabel(route)}`;
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

  useEffect(() => {
    const handleGlobalKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (!typing && event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
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
      setTournamentMenuOpen(false);

      if (options.replace) {
        window.history.replaceState(null, "", nextHash);
      } else if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }

      const currentSection =
        route === "match" ? "records" : route === "player" ? "players" : route === "team" ? "teams" : route;
      const nextSection =
        nextRoute === "match"
          ? "records"
          : nextRoute === "player"
            ? "players"
            : nextRoute === "team"
              ? "teams"
              : nextRoute;

      if (options.scroll !== false && nextSection !== currentSection) {
        document.querySelector(".workspace")?.scrollTo({ top: 0, behavior: "smooth" });
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
    async (tournamentId: string, targetRoute?: AppRoute) => {
      setSelectedTournamentId(tournamentId);
      resetProfiles();
      navigateTo(targetRoute ?? (route === "match" ? "records" : route), { scroll: true });
      await refreshData(tournamentId);
    },
    [navigateTo, refreshData, resetProfiles, route],
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
    if (route === "home" || route === "players" || route === "player") {
      void ensurePlayersLoaded();
    }

    if (route === "home" || route === "teams" || route === "team") {
      void ensureTeamsLoaded();
    }

    const playerId = route === "player" ? profileId : null;

    if (route === "player" && playerId) {
      void ensurePlayerProfileLoaded(playerId);
    }

    const teamId = route === "team" ? profileId : null;

    if (route === "team" && teamId) {
      void ensureTeamProfileLoaded(teamId);
    }
  }, [
    route,
    profileId,
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

  const handlePaletteSelect = useCallback(
    (target: PaletteTarget) => {
      setPaletteOpen(false);

      switch (target.kind) {
        case "route":
          navigateTo(target.route);
          break;
        case "tournament":
          void selectTournament(target.tournamentId, "stage");
          break;
        case "player":
          navigateTo("player", { profileId: target.playerId });
          break;
        case "team":
          navigateTo("team", { profileId: target.teamId });
          break;
        case "match":
          navigateTo("match", { profileId: target.matchId });
          break;
      }
    },
    [navigateTo, selectTournament],
  );

  const sortedPlayers = sortTournamentPlayers(viewData.players, playerSortKey, playerSortDirection);
  const activeNav = activePrimaryNavRoute(route);

  const workspaceRoute =
    route === "match"
      ? "records"
      : route === "player"
        ? "players"
        : route === "team"
          ? "teams"
          : route;
  const drawerType =
    route === "player" && profileId ? "player" : route === "team" && profileId ? "team" : null;

  let routeView: React.ReactNode;
  switch (workspaceRoute) {
    case "home":
      routeView = (
        <DashboardPage
          data={viewData}
          onNavigate={(next) => navigateTo(next)}
          onOpenMatch={openMatch}
          onSelectTournament={(id) => void selectTournament(id)}
        />
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
        <RecordsWorkspace
          data={viewData}
          loading={loading}
          selectedMatchId={route === "match" ? profileId : null}
          matchCache={matchCache}
          profileErrors={profileErrors}
          profileLoading={profileLoading}
          expandedPlayers={expandedPlayers}
          wardScrubberSeconds={wardScrubberSeconds}
          onSelectMatch={openMatch}
          onEnsureMatch={(matchId) => void ensureMatchLoaded(matchId)}
          onPlayerToggle={handlePlayerToggle}
          onWardSecondChange={handleWardSecondChange}
          onRetryMatch={(matchId) => void ensureMatchLoaded(matchId)}
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
    default:
      routeView = (
        <DashboardPage
          data={viewData}
          onNavigate={(next) => navigateTo(next)}
          onOpenMatch={openMatch}
          onSelectTournament={(id) => void selectTournament(id)}
        />
      );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="topbar-brand"
          type="button"
          onClick={() => navigateTo("home")}
          aria-label="回到驾驶舱"
        >
          <span className="topbar-logo">M</span>
        </button>
        <button
          className="topbar-tournament"
          type="button"
          onClick={() => setTournamentMenuOpen((current) => !current)}
          aria-expanded={tournamentMenuOpen}
        >
          <span className="tt-kicker">赛事</span>
          <span className="tt-name">{viewData.selectedTournamentName}</span>
          <span className="tt-meta">
            League {viewData.selectedTournamentMeta.leagueId} ·{" "}
            {viewData.selectedTournamentMeta.statusText}
          </span>
          <span
            className={`chevron tt-caret ${tournamentMenuOpen ? "is-expanded" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div className="topbar-crumb">
          <span>MRJZ /</span>
          <b>{routeLabel(route)}</b>
        </div>
        <div className="topbar-actions">
          <button className="palette-trigger" type="button" onClick={() => setPaletteOpen(true)}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>搜索或跳转…</span>
            <kbd>⌘K</kbd>
          </button>
          <span
            className={`topbar-status ${loading ? "is-loading" : viewData.source === "api" ? "" : "is-offline"}`}
          >
            <i aria-hidden="true" />
            {loading ? "同步中" : viewData.source === "api" ? "API 在线" : "离线"}
          </span>
          <button
            className="ghost-button"
            type="button"
            onClick={goBack}
            disabled={route === "home"}
          >
            返回
          </button>
        </div>
      </header>

      <nav className="rail" aria-label="主导航">
        {railItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`rail-item ${activeNav === item.key ? "active" : ""}`}
            onClick={() => navigateTo(item.key)}
            aria-current={activeNav === item.key ? "page" : undefined}
            aria-label={item.label}
          >
            {item.icon}
            <span className="rail-tip">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="workspace">
        <div className="view" key={workspaceRoute}>
          {routeView}
        </div>
      </main>

      {tournamentMenuOpen ? (
        <>
          <div
            className="drawer-overlay"
            style={{ background: "transparent" }}
            onClick={() => setTournamentMenuOpen(false)}
          />
          <div className="tournament-menu panel">
            {viewData.tournamentOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`tournament-menu-item ${viewData.selectedTournamentId === option.id ? "is-active" : ""}`}
                onClick={() => void selectTournament(option.id)}
              >
                <span className="pi-main">
                  <b>{option.name}</b>
                  <small>
                    League {option.leagueId} · {lifecycleLabel(option.status)} · {option.matchCount}{" "}
                    场
                  </small>
                </span>
                {viewData.selectedTournamentId === option.id ? (
                  <span className="status-tag green">当前</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          data={viewData}
          onSelect={handlePaletteSelect}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}

      {drawerType === "player" && profileId ? (
        <ProfileDrawer title="选手档案" onClose={() => navigateTo("players", { replace: true })}>
          <PlayerProfileContent
            data={viewData}
            profileId={profileId}
            profiles={playerProfiles}
            profileErrors={profileErrors}
            onOpenMatch={openMatch}
            onRetry={handleRetryProfile}
          />
        </ProfileDrawer>
      ) : null}

      {drawerType === "team" && profileId ? (
        <ProfileDrawer title="队伍档案" onClose={() => navigateTo("teams", { replace: true })}>
          <TeamProfileContent
            data={viewData}
            profileId={profileId}
            profiles={teamProfiles}
            profileErrors={profileErrors}
            onNavigate={navigateTo}
            onOpenMatch={openMatch}
            onRetry={handleRetryProfile}
          />
        </ProfileDrawer>
      ) : null}
    </div>
  );
}

function ProfileDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <div className="drawer-head">
          <span className="kicker">{title}</span>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
