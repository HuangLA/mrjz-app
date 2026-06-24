import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  loadMatchData,
  loadMobileData,
  loadPlayerProfile,
  loadTeamProfile,
  loadTournamentPlayers,
  loadTournamentTeams,
  type MobileData,
} from "./api";
import {
  type AghanimState,
  type AcknowledgementItem,
  type AppRoute,
  type DraftStep,
  type EntityTeamInfo,
  type HeroLeaderboardCandidate,
  type HeroLeaderboardItem,
  type IconRef,
  type MatchAward,
  type MatchData,
  type MatchRecord,
  type PlayerDirectoryItem,
  type PlayerProfile,
  type PlayerStats,
  type PlayerTag,
  type PlayerTournamentHistoryEntry,
  type ProfileMatchSummary,
  type ScheduleItem,
  type StageKey,
  type StageView,
  type TeamDirectoryItem,
  type TeamProfile,
  type TeamSide,
} from "./data";

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
type ScheduleStatusFilter = "全部" | ScheduleItem["status"];
type RecordTeamFilter = "全部" | string;

type AppRouteSnapshot = { route: AppRoute; profileId: string | null };
type NavigateOptions = { replace?: boolean; scroll?: boolean; profileId?: string | undefined };
type MatchAwardPopover = { key: string; award: MatchAward; left: number; top: number };

const routeOptions: Array<{ key: AppRoute; label: string; kicker: string }> = [
  { key: "home", label: "首页", kicker: "入口" },
  { key: "stage", label: "赛事阶段", kicker: "阶段" },
  { key: "schedule", label: "赛程", kicker: "时间" },
  { key: "records", label: "比赛记录", kicker: "记录" },
  { key: "match", label: "比赛详情", kicker: "战报" },
  { key: "leaderboard", label: "英雄榜", kicker: "称号" },
  { key: "players", label: "选手", kicker: "数据" },
  { key: "teams", label: "队伍", kicker: "战队" },
];

const primaryNavRoutes = routeOptions.filter((route) => route.key !== "match");

const stageOptions: Array<{ key: StageKey; label: string }> = [
  { key: "group", label: "小组赛" },
  { key: "swiss", label: "瑞士轮" },
  { key: "knockout", label: "淘汰赛" },
];

const scheduleFilters: ScheduleStatusFilter[] = ["全部", "未开始", "待补录", "已完赛", "延期"];
const allRecordTeamFilter: RecordTeamFilter = "全部";
const awardPopoverWidth = 156;
const awardPopoverEstimatedHeight = 36;
const awardPopoverMargin = 10;

function getAwardPopoverPosition(rect: DOMRect): { left: number; top: number } {
  const maxLeft = Math.max(awardPopoverMargin, window.innerWidth - awardPopoverWidth - awardPopoverMargin);
  const left = clampNumber(rect.left + rect.width / 2 - awardPopoverWidth / 2, awardPopoverMargin, maxLeft);
  const belowTop = rect.bottom + 8;
  const top =
    belowTop + awardPopoverEstimatedHeight > window.innerHeight - awardPopoverMargin
      ? Math.max(awardPopoverMargin, rect.top - awardPopoverEstimatedHeight - 8)
      : belowTop;

  return { left, top };
}

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

const routeSet = new Set<AppRoute>([...routeOptions.map((route) => route.key), "player", "team"]);
const stageSet = new Set<StageKey>(stageOptions.map((stage) => stage.key));
const playerSortKeySet = new Set<PlayerSortKey>(playerSortOptions.map((option) => option.key));

const defaultApiBaseUrl = "/api";
const emptyIcon: IconRef = { label: "-", imageUrl: "" };
const ungroupedStandingKey = "__all__";
const homeHeroRailCardWidth = 148;
const homeHeroRailGap = 8;
const homeHeroPortraitRows: Record<TeamSide, string[]> = {
  radiant: [
    "/static/dota/heroes/pudge.png",
    "/static/dota/heroes/windrunner.png",
    "/static/dota/heroes/juggernaut.png",
    "/static/dota/heroes/invoker.png",
    "/static/dota/heroes/phantom_assassin.png",
    "/static/dota/heroes/earthshaker.png",
    "/static/dota/heroes/lina.png",
    "/static/dota/heroes/nevermore.png",
    "/static/dota/heroes/queenofpain.png",
    "/static/dota/heroes/axe.png",
    "/static/dota/heroes/mirana.png",
    "/static/dota/heroes/ember_spirit.png",
    "/static/dota/heroes/mars.png",
    "/static/dota/heroes/snapfire.png",
  ],
  dire: [
    "/static/dota/heroes/templar_assassin.png",
    "/static/dota/heroes/void_spirit.png",
    "/static/dota/heroes/drow_ranger.png",
    "/static/dota/heroes/sven.png",
    "/static/dota/heroes/tiny.png",
    "/static/dota/heroes/rubick.png",
    "/static/dota/heroes/slark.png",
    "/static/dota/heroes/tidehunter.png",
    "/static/dota/heroes/morphling.png",
    "/static/dota/heroes/ursa.png",
    "/static/dota/heroes/puck.png",
    "/static/dota/heroes/sniper.png",
    "/static/dota/heroes/chaos_knight.png",
    "/static/dota/heroes/muerta.png",
  ],
};

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromHash());
  const [stage, setStage] = useState<StageKey>("group");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(() => new Set(["r2"]));
  const [wardScrubberSeconds, setWardScrubberSeconds] = useState<Record<string, number>>({});
  const [data, setData] = useState<MobileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [playerSortKey, setPlayerSortKey] = useState<PlayerSortKey>("totalMatches");
  const [playerSortDirection, setPlayerSortDirection] = useState<SortDirection>("desc");
  const [profileId, setProfileId] = useState<string | null>(() => readProfileIdFromHash());
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, PlayerProfile>>({});
  const [teamProfiles, setTeamProfiles] = useState<Record<string, TeamProfile>>({});
  const [profileLoading, setProfileLoading] = useState<Record<string, boolean>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [floatingNavHidden, setFloatingNavHidden] = useState(false);

  const routeHistoryRef = useRef<AppRouteSnapshot[]>([]);
  const loadingKeysRef = useRef(new Set<string>());
  const lastFloatingNavScrollYRef = useRef(0);
  const floatingNavScrollTickingRef = useRef(false);
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
    // Initial API load only; tournament switches call refreshData explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `MRJZ H5 - ${routeLabel(route)}`;
  }, [route]);

  useEffect(() => {
    const syncRouteFromHash = () => {
      setRoute(readRouteFromHash());
      setProfileId(readProfileIdFromHash());
      setFloatingNavHidden(false);
    };

    window.addEventListener("hashchange", syncRouteFromHash);
    window.addEventListener("popstate", syncRouteFromHash);

    return () => {
      window.removeEventListener("hashchange", syncRouteFromHash);
      window.removeEventListener("popstate", syncRouteFromHash);
    };
  }, []);

  useEffect(() => {
    const handleFloatingNavScroll = () => {
      if (route === "home" || floatingNavScrollTickingRef.current) {
        return;
      }

      floatingNavScrollTickingRef.current = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const lastY = lastFloatingNavScrollYRef.current;
        const delta = currentY - lastY;

        if (Math.abs(delta) > 8) {
          setFloatingNavHidden(delta > 0 && currentY > 140);
          lastFloatingNavScrollYRef.current = currentY;
        }

        floatingNavScrollTickingRef.current = false;
      });
    };

    window.addEventListener("scroll", handleFloatingNavScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleFloatingNavScroll);
  }, [route]);

  const navigateTo = useCallback(
    (nextRoute: AppRoute, options: NavigateOptions = {}) => {
      const nextProfileId =
        options.profileId ?? (nextRoute === "player" || nextRoute === "team" ? profileId : null);
      const nextHash =
        nextRoute === "player" || nextRoute === "team"
          ? `#${nextRoute}/${encodeURIComponent(nextProfileId ?? "")}`
          : `#${nextRoute}`;

      if (nextRoute !== route && !options.replace) {
        routeHistoryRef.current.push({ route, profileId });
      }

      setRoute(nextRoute);
      setProfileId(nextProfileId);
      setFloatingNavHidden(false);

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
      navigateTo(previousRoute.route, { replace: true, profileId: previousRoute.profileId ?? undefined });
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

  const openMatch = useCallback(
    async (matchId: string) => {
      const snapshot = data;

      if (!snapshot) {
        return;
      }

      setLoading(true);
      navigateTo("match");

      try {
        const match = await loadMatchData(snapshot.apiBaseUrl, matchId);
        setData((previous) => (previous ? { ...previous, featuredMatch: match, notice: null } : previous));
      } catch {
        setData((previous) =>
          previous ? { ...previous, notice: `match ${matchId} 暂无真实详情或尚未入库。` } : previous,
        );
      } finally {
        setLoading(false);
      }
    },
    [data, navigateTo],
  );

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
      const players = await loadTournamentPlayers(snapshot.apiBaseUrl, snapshot.selectedTournamentId);
      setData((previous) =>
        previous && previous.selectedTournamentId === snapshot.selectedTournamentId ? { ...previous, players } : previous,
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
        previous && previous.selectedTournamentId === snapshot.selectedTournamentId ? { ...previous, teams } : previous,
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
        const profile = await loadPlayerProfile(snapshot.apiBaseUrl, snapshot.selectedTournamentId, playerId);
        setPlayerProfiles((previous) => ({ ...previous, [playerId]: profile }));
      } catch (error) {
        console.error(error);
        setProfileErrors((previous) => ({
          ...previous,
          [key]: "读取失败",
        }));
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
        const profile = await loadTeamProfile(snapshot.apiBaseUrl, snapshot.selectedTournamentId, teamId);
        setTeamProfiles((previous) => ({ ...previous, [teamId]: profile }));
      } catch (error) {
        console.error(error);
        setProfileErrors((previous) => ({
          ...previous,
          [key]: "读取失败",
        }));
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
  }, [ensurePlayersLoaded, profileId, route]);

  useEffect(() => {
    if (route === "teams" || (route === "team" && !profileId)) {
      void ensureTeamsLoaded();
    }
  }, [ensureTeamsLoaded, profileId, route]);

  useEffect(() => {
    const playerId = route === "player" ? profileId ?? viewData.players[0]?.id ?? null : null;

    if (playerId) {
      void ensurePlayerProfileLoaded(playerId);
    }
  }, [ensurePlayerProfileLoaded, profileId, route, viewData.players]);

  useEffect(() => {
    const teamId = route === "team" ? profileId ?? viewData.teams[0]?.id ?? null : null;

    if (teamId) {
      void ensureTeamProfileLoaded(teamId);
    }
  }, [ensureTeamProfileLoaded, profileId, route, viewData.teams]);

  const sortedPlayers = useMemo(
    () => sortTournamentPlayers(viewData.players, playerSortKey, playerSortDirection),
    [playerSortDirection, playerSortKey, viewData.players],
  );

  const handlePlayerSort = useCallback(
    (sortKey: PlayerSortKey) => {
      const option = playerSortOptions.find((item) => item.key === sortKey) ?? playerSortOptions[0]!;

      if (playerSortKey === sortKey) {
        setPlayerSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      } else {
        setPlayerSortKey(sortKey);
        setPlayerSortDirection(option.defaultDirection);
      }
    },
    [playerSortKey],
  );

  const togglePlayerExpanded = useCallback((playerId: string) => {
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

  const updateWardSecond = useCallback((matchId: string, seconds: number) => {
    setWardScrubberSeconds((previous) => ({ ...previous, [matchId]: seconds }));
  }, []);

  const retryProfile = useCallback(
    (type: "player" | "team", id: string) => {
      const key = `${type}:${id}`;
      setProfileErrors((previous) => withoutKey(previous, key));

      if (type === "player") {
        setPlayerProfiles((previous) => withoutKey(previous, id));
        void ensurePlayerProfileLoaded(id);
      } else {
        setTeamProfiles((previous) => withoutKey(previous, id));
        void ensureTeamProfileLoaded(id);
      }
    },
    [ensurePlayerProfileLoaded, ensureTeamProfileLoaded],
  );

  const routeView = (() => {
    switch (route) {
      case "home":
        return <HomePage data={viewData} loading={loading} onSelectTournament={selectTournament} />;
      case "stage":
        return (
          <StagePage
            data={viewData}
            loading={loading}
            stage={stage}
            onStageChange={setStage}
            onNavigate={navigateTo}
            onOpenMatch={openMatch}
          />
        );
      case "schedule":
        return <SchedulePage data={viewData} loading={loading} onNavigate={navigateTo} onOpenMatch={openMatch} />;
      case "records":
        return <RecordsPage data={viewData} loading={loading} onNavigate={navigateTo} onOpenMatch={openMatch} />;
      case "match":
        return (
          <MatchDetailPage
            data={viewData}
            loading={loading}
            match={viewData.featuredMatch}
            expandedPlayers={expandedPlayers}
            wardScrubberSeconds={wardScrubberSeconds}
            onPlayerToggle={togglePlayerExpanded}
            onWardSecondChange={updateWardSecond}
          />
        );
      case "leaderboard":
        return <HeroLeaderboardsPage data={viewData} loading={loading} onNavigate={navigateTo} />;
      case "players":
        return (
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
      case "teams":
        return (
          <TeamsPage
            data={viewData}
            loading={loading}
            profileLoading={profileLoading}
            profileErrors={profileErrors}
            onNavigate={navigateTo}
          />
        );
      case "player":
        return (
          <PlayerProfilePage
            data={viewData}
            loading={loading}
            profileId={profileId}
            profiles={playerProfiles}
            profileErrors={profileErrors}
            onNavigate={navigateTo}
            onOpenMatch={openMatch}
            onRetry={retryProfile}
          />
        );
      case "team":
        return (
          <TeamProfilePage
            data={viewData}
            loading={loading}
            profileId={profileId}
            profiles={teamProfiles}
            profileErrors={profileErrors}
            onNavigate={navigateTo}
            onOpenMatch={openMatch}
            onRetry={retryProfile}
          />
        );
    }
  })();

  const isHome = route === "home";

  return (
    <div className={`app-shell ${isHome ? "route-home" : "route-secondary"}`}>
      {isHome ? <HomeBackgroundMarquee /> : null}
      <AppBar isHome={isHome} onBack={goBack} />
      <main className="view" aria-live="polite">
        {routeView}
      </main>
      {!isHome ? <FloatingRouteNav route={route} hidden={floatingNavHidden} onNavigate={navigateTo} /> : null}
      {!isHome ? (
        <button
          className="back-top"
          type="button"
          aria-label="回到顶部"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          ↑
        </button>
      ) : null}
    </div>
  );
}

function HomeBackgroundMarquee() {
  return (
    <div className="home-background-marquee" aria-hidden="true">
      <HomeHeroRail side="radiant" />
      <HomeHeroRail side="dire" />
    </div>
  );
}

function AppBar({ isHome, onBack }: { isHome: boolean; onBack: () => void }) {
  return (
    <header className={`app-bar ${isHome ? "home-bar" : ""}`}>
      <div className="title-line top-only">
        {isHome ? (
          <span className="brand-mark">MRJZ</span>
        ) : (
          <button className="icon-button" type="button" aria-label="返回上一页" onClick={onBack}>
            ‹
          </button>
        )}
      </div>
    </header>
  );
}

function FloatingRouteNav({
  route,
  hidden,
  onNavigate,
}: {
  route: AppRoute;
  hidden: boolean;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  const navRoute = activePrimaryNavRoute(route);

  return (
    <nav className={`floating-route-nav ${hidden ? "hidden" : ""}`} aria-label="主导航">
      <div className="route-tabs">
        {primaryNavRoutes.map((option) => (
          <button
            className={`route-tab ${option.key === navRoute ? "active" : ""}`}
            type="button"
            key={option.key}
            onClick={() => onNavigate(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function HomePage({
  data,
  loading,
  onSelectTournament,
}: {
  data: MobileData;
  loading: boolean;
  onSelectTournament: (tournamentId: string, targetRoute?: AppRoute) => void;
}) {
  const recordTotal = data.tournamentOptions.reduce((sum, option) => sum + option.matchCount, 0);

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <HomeHero
        tournamentCount={data.tournamentOptions.length}
        recordCount={recordTotal}
        acknowledgements={data.acknowledgements}
      />
      <section className="section-panel tournament-gateway">
        <div className="tournament-entry-list">
          {data.tournamentOptions.length > 0 ? (
            data.tournamentOptions.map((option) => (
              <TournamentEntry
                key={option.id}
                option={option}
                active={data.selectedTournamentId === option.id}
                records={data.tournamentRecentRecords[option.id] ?? []}
                onSelect={onSelectTournament}
              />
            ))
          ) : (
            <EmptyState text="暂无可查看赛事" />
          )}
        </div>
      </section>
    </>
  );
}

function HomeHero({
  tournamentCount,
  recordCount,
  acknowledgements = [],
}: {
  tournamentCount: number;
  recordCount: number;
  acknowledgements?: AcknowledgementItem[];
}) {
  const sponsorAcknowledgements = acknowledgements.filter((item) => item.category === "sponsor");
  const communityAcknowledgements = acknowledgements.filter((item) => item.category === "community");
  const hasAcknowledgements = sponsorAcknowledgements.length > 0 || communityAcknowledgements.length > 0;

  return (
    <section className="home-hero">
      <div className="home-hero-content">
        <div className="home-brand-core">
          <span className="home-brand-season">COMMUNITY LEAGUE</span>
          <strong>每日节奏杯</strong>
          <span className="home-brand-sub">DRAFT · FIGHT · RECORD</span>
        </div>
        <div className="home-hero-stats">
          <HomeHeroStat label="届次" value={String(tournamentCount)} />
          <HomeHeroStat label="比赛" value={String(recordCount)} />
          <HomeHeroStat label="战场" value="DOTA2" />
        </div>
        {hasAcknowledgements ? (
          <div className="home-sponsor-panel" aria-label="鸣谢名单">
            <div className="home-sponsor-heading">
              <span>鸣谢名单</span>
            </div>
            {sponsorAcknowledgements.length > 0 ? (
              <div className="home-sponsor-section">
                <div className="home-sponsor-section-title">
                  <span>赞助商</span>
                  <small>SPONSORS</small>
                </div>
                <div className="home-major-sponsors">
                  {sponsorAcknowledgements.map((sponsor) => (
                    <div className="home-major-sponsor" key={sponsor.id}>
                      {sponsor.imageUrl !== null ? <img src={sponsor.imageUrl} alt={sponsor.displayName} loading="eager" /> : null}
                      <span>{sponsor.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {communityAcknowledgements.length > 0 ? (
              <div className="home-sponsor-section">
                <div className="home-sponsor-section-title">
                  <span>社区支持</span>
                  <small>COMMUNITY</small>
                </div>
                <div className="home-community-supporters" aria-label="社区支持">
                  {communityAcknowledgements.map((supporter) => (
                    <div className="home-community-supporter" key={supporter.id}>
                      <AcknowledgementAvatar item={supporter} />
                      <span>{supporter.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AcknowledgementAvatar({ item }: { item: AcknowledgementItem }) {
  const [failed, setFailed] = useState(false);
  const initial = item.displayName.slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    setFailed(false);
  }, [item.imageUrl]);

  if (!item.imageUrl || failed) {
    return <span className="home-community-avatar fallback">{initial}</span>;
  }

  return (
    <span className="home-community-avatar">
      <img
        src={item.imageUrl}
        alt={item.displayName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function HomeHeroRail({ side }: { side: TeamSide }) {
  const rowHeroes = homeHeroPortraitRows[side];
  const visibleHeroes = [...rowHeroes, ...rowHeroes, ...rowHeroes].map((src) => ({ src, alt: "" }));
  const railDistance = rowHeroes.length * (homeHeroRailCardWidth + homeHeroRailGap);

  return (
    <div className={`home-hero-rail ${side}`}>
      <div
        className="home-hero-track"
        style={cssVars({
          "--hero-rail-distance": `${railDistance}px`,
          "--hero-rail-offset": `-${railDistance}px`,
        })}
      >
        {visibleHeroes.map((hero, index) => (
          <span key={`${hero.src}:${index}`}>
            <ImageWithFallback src={hero.src} fallback="/static/dota/heroes/unknown.svg" alt={hero.alt} loading="eager" />
          </span>
        ))}
      </div>
    </div>
  );
}

function HomeHeroStat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function TournamentEntry({
  option,
  active,
  records,
  onSelect,
}: {
  option: MobileData["tournamentOptions"][number];
  active: boolean;
  records: MatchRecord[];
  onSelect: (tournamentId: string, targetRoute?: AppRoute) => void;
}) {
  const latest = records[0];
  const score =
    latest === undefined || latest.radiantScore === null || latest.direScore === null
      ? "暂无赛果"
      : `${latest.radiantScore}:${latest.direScore}`;
  const latestText =
    latest === undefined ? "--" : `${latest.radiantTeamName} ${score} ${latest.direTeamName}`;

  return (
    <article className={`tournament-entry ${active ? "active" : ""}`}>
      <button className="tournament-entry-main" type="button" onClick={() => onSelect(option.id, "stage")}>
        <div>
          <h3>{option.name}</h3>
          <span>
            {lifecycleLabel(option.status)} · {option.startsAt}
          </span>
        </div>
        <div className="tournament-entry-action">
          <strong>{active ? "当前" : "进入"}</strong>
          <span>{latestText}</span>
        </div>
      </button>
    </article>
  );
}

function StagePage({
  data,
  loading,
  stage,
  onStageChange,
  onNavigate,
  onOpenMatch,
}: {
  data: MobileData;
  loading: boolean;
  stage: StageKey;
  onStageChange: (stage: StageKey) => void;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const availableStageOptions = useMemo(() => officialStageOptions(data), [data]);
  const activeStageKey = availableStageOptions.some((option) => option.key === stage)
    ? stage
    : availableStageOptions[0]?.key ?? "group";
  const currentStage = data.stageViews[activeStageKey];
  const standingGroups = useMemo(() => groupStandingRows(currentStage.standings), [currentStage.standings]);
  const [activeStandingGroupKey, setActiveStandingGroupKey] = useState("");
  const activeStandingGroup = standingGroups.find((group) => group.key === activeStandingGroupKey) ?? standingGroups[0] ?? null;

  useEffect(() => {
    if (data.officialSchedule.isPublished && activeStageKey !== stage) {
      onStageChange(activeStageKey);
    }
  }, [activeStageKey, data.officialSchedule.isPublished, onStageChange, stage]);

  useEffect(() => {
    const nextKey = activeStandingGroup?.key ?? "";

    if (activeStandingGroupKey !== nextKey) {
      setActiveStandingGroupKey(nextKey);
    }
  }, [activeStandingGroup?.key, activeStandingGroupKey]);

  if (!data.officialSchedule.isPublished) {
    return (
      <>
        <DataNotice data={data} loading={loading} />
        <TournamentScope data={data} onNavigate={onNavigate} />
        <section className="section-panel schedule-unpublished">
          <div className="section-title compact">
            <div>
              <h2>赛事阶段暂未发布</h2>
              <p className="muted">管理员发布官方赛程后，这里会展示小组赛、瑞士轮或淘汰赛阶段。</p>
            </div>
            <span className="sync-pill">{officialScheduleStatusText(data.officialSchedule.status)}</span>
          </div>
        </section>
      </>
    );
  }

  if (availableStageOptions.length === 0) {
    return (
      <>
        <DataNotice data={data} loading={loading} />
        <TournamentScope data={data} onNavigate={onNavigate} />
        <section className="section-panel schedule-unpublished">
          <div className="section-title compact">
            <div>
              <h2>暂无官方阶段</h2>
              <p className="muted">管理员发布官方赛程后，这里只展示已启用的阶段。</p>
            </div>
            <span className="sync-pill">{officialScheduleStatusText(data.officialSchedule.status)}</span>
          </div>
        </section>
      </>
    );
  }

  const isKnockoutStage = activeStageKey === "knockout";
  const stageMatches = data.scheduleGroups
    .flatMap((group) => group.matches)
    .filter((match) => match.stage === currentStage.name);

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="stage-switch section-panel">
        <div className="section-title compact">
          <div>
            <h2>赛事阶段</h2>
          </div>
        </div>
        <div className="segmented" role="tablist" aria-label="阶段切换">
          {availableStageOptions.map((option) => (
            <button
              role="tab"
              aria-selected={option.key === activeStageKey}
              className={option.key === activeStageKey ? "active" : ""}
              type="button"
              key={option.key}
              onClick={() => onStageChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="stage-head">
          <div>
            <h2>
              {currentStage.name} · {currentStage.currentRound}
            </h2>
          </div>
        </div>
      </section>

      {!isKnockoutStage ? (
        <section className="section-panel">
          <div className="section-title compact">
            <div>
              <h2>积分榜</h2>
            </div>
          </div>
          {standingGroups.length > 1 ? (
            <div className="standing-tabs segmented" role="tablist" aria-label="积分榜小组切换">
              {standingGroups.map((group) => (
                <button
                  role="tab"
                  aria-selected={group.key === activeStandingGroup?.key}
                  className={group.key === activeStandingGroup?.key ? "active" : ""}
                  type="button"
                  key={group.key}
                  onClick={() => setActiveStandingGroupKey(group.key)}
                >
                  <span>{group.label}</span>
                  <small>{group.rows.length} 队</small>
                </button>
              ))}
            </div>
          ) : null}
          <div className="standing-list">
            {activeStandingGroup && activeStandingGroup.rows.length > 0 ? (
              activeStandingGroup.rows.map((row) => <StandingRow key={`${row.groupName ?? "all"}:${row.rank}:${row.team}`} row={row} />)
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </section>
      ) : null}

      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>当前轮</h2>
          </div>
          <span className="status-tag blue">{currentStage.currentRound}</span>
        </div>
        <div className="schedule-list">
          {stageMatches.length > 0 ? (
            stageMatches.slice(0, 6).map((match) => (
              <ScheduleCard key={`${match.stage}:${match.round}:${match.teamA}:${match.teamB}:${match.time}`} match={match} onOpenMatch={onOpenMatch} />
            ))
          ) : (
            <EmptyState text="暂无" />
          )}
        </div>
      </section>

      {isKnockoutStage ? (
        <section className="section-panel">
          <div className="section-title compact">
            <div>
              <h2>淘汰赛对阵图</h2>
            </div>
          </div>
          {currentStage.bracket.length > 0 ? (
            <StageBracketPreview nodes={currentStage.bracket} />
          ) : (
            <EmptyState text="暂无" />
          )}
        </section>
      ) : null}
    </>
  );
}

function StageBracketPreview({ nodes }: { nodes: StageView["bracket"] }) {
  const [finalConnectorOverlay, setFinalConnectorOverlay] = useState<StageFinalConnectorOverlay | null>(null);
  const unifiedMapRef = useRef<HTMLDivElement | null>(null);
  const grouped = new Map<string, { label: string; rounds: Map<string, { roundNumber: number; roundName: string; nodes: StageView["bracket"] }> }>();
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const linkedNodeIds = new Set<string>();

  for (const node of nodes) {
    const roundKey = `${node.bracketGroup}:${node.roundNumber}:${node.roundName}`;
    const groupKey = node.bracketGroup || "single";
    const group = grouped.get(groupKey) ?? { label: node.groupName, rounds: new Map<string, { roundNumber: number; roundName: string; nodes: StageView["bracket"] }>() };
    const round = group.rounds.get(roundKey) ?? { roundNumber: node.roundNumber, roundName: node.roundName, nodes: [] };
    group.rounds.set(roundKey, { ...round, nodes: [...round.nodes, node] });
    grouped.set(groupKey, group);

    if (node.nextNodeId) linkedNodeIds.add(node.nextNodeId);
    if (node.loserNextNodeId) linkedNodeIds.add(node.loserNextNodeId);
  }

  const groups = [...grouped.entries()]
    .sort(([groupA], [groupB]) => bracketGroupSortValue(groupA) - bracketGroupSortValue(groupB) || groupA.localeCompare(groupB))
    .map(([key, group]) => ({ key, ...group }));
  const isUnifiedDoubleElimination = groups.some((group) => group.key === "winner" || group.key === "loser" || group.key === "grand_final");
  const unifiedLayout = isUnifiedDoubleElimination ? buildUnifiedStageBracketLayout(groups, nodes) : null;
  const extraGroups = groups.filter((group) => group.key !== "winner" && group.key !== "loser" && group.key !== "grand_final");
  const renderGroupLane = (group: (typeof groups)[number], extraClass = "") => {
    const columns = [...group.rounds.entries()]
      .sort(([, roundA], [, roundB]) => roundA.roundNumber - roundB.roundNumber || roundA.roundName.localeCompare(roundB.roundName))
      .map(([roundKey, round]) => ({
        key: roundKey,
        roundName: round.roundName,
        nodes: round.nodes.slice().sort((a, b) => a.position - b.position),
      }));
    const rowCount = Math.max(1, ...columns.map((column) => column.nodes.length));
    const columnBodyStyle = { "--bracket-row-count": rowCount } as CSSProperties & Record<"--bracket-row-count", number>;
    const columnLayouts = columns.map((column, columnIndex) => ({
      ...column,
      nodes: column.nodes.map((node, nodeIndex) => {
        const rowSpan = Math.max(1, Math.floor(rowCount / Math.max(1, column.nodes.length)));
        const gridRowStart = nodeIndex * rowSpan + 1;
        return { node, columnIndex, gridRowStart, rowSpan };
      }),
    }));
    const nodeLayouts = new Map(columnLayouts.flatMap((column) => column.nodes.map((layout) => [layout.node.id, layout])));
    const connectors = columnLayouts.flatMap((column) => column.nodes.flatMap((source) => {
      const targets = [
        { id: source.node.nextNodeId, kind: "winner" },
        { id: source.node.loserNextNodeId, kind: "loser" },
      ].filter((target): target is { id: string; kind: "winner" | "loser" } => target.id !== null);
      return targets
        .map((target) => {
          const targetLayout = nodeLayouts.get(target.id);
          return targetLayout && targetLayout.columnIndex > source.columnIndex
            ? { id: `${source.node.id}:${target.id}:${target.kind}`, kind: target.kind, path: bracketConnectorPath(source, targetLayout) }
            : null;
        })
        .filter((connector): connector is { id: string; kind: "winner" | "loser"; path: string } => connector !== null);
    }));
    const trackWidth = bracketTrackWidth(columns.length);
    const trackHeight = bracketTrackHeight(rowCount);

    return (
      <div className={`bracket-group-lane is-${group.key} ${extraClass}`.trim()} key={group.key}>
        <strong className="bracket-group-title">{group.label}</strong>
        <div className="bracket-round-track">
          {connectors.length > 0 ? (
            <svg className="bracket-connector-layer" width={trackWidth} height={trackHeight} viewBox={`0 0 ${trackWidth} ${trackHeight}`} aria-hidden="true">
              {connectors.map((connector) => <path key={connector.id} className={`bracket-connector-path is-${connector.kind}`} d={connector.path} />)}
            </svg>
          ) : null}
          {columnLayouts.map((column, columnIndex) => (
            <div className="bracket-column" key={column.key}>
              <strong>{column.roundName}</strong>
              <div className="bracket-column-body" style={columnBodyStyle}>
                {column.nodes.map(({ node, gridRowStart, rowSpan }) => {
                  const topWinner = node.winnerTeamId !== null && node.winnerTeamId === node.topTeamId;
                  const bottomWinner = node.winnerTeamId !== null && node.winnerTeamId === node.bottomTeamId;
                  const hasOutgoing = Boolean(node.nextNodeId || node.loserNextNodeId);
                  const hasIncoming = columnIndex > 0 || linkedNodeIds.has(node.id);
                  const winnerTarget = formatBracketTarget(nodeLookup, node.nextNodeId, node.nextSlot, "冠军");
                  const loserTarget = node.loserNextNodeId ? formatBracketTarget(nodeLookup, node.loserNextNodeId, node.loserNextSlot, "淘汰") : "淘汰";
                  const nodeClass = [
                    "bracket-node",
                    node.status === "已完赛" ? "is-completed" : node.status === "待开赛" ? "is-ready" : "is-pending",
                    hasIncoming ? "has-incoming" : "",
                    hasOutgoing ? "has-outgoing" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <article className={nodeClass} key={node.id} style={{ gridRow: `${gridRowStart} / span ${rowSpan}` }}>
                      <div className="bracket-node-topline">
                        <span className="bracket-node-kicker">#{node.position}</span>
                        <span className="bracket-node-state">{node.status}</span>
                      </div>
                      <div className={`bracket-team ${topWinner ? "is-winner" : ""}`}>
                        <span>上</span>
                        <b>{node.topTeam}</b>
                        {topWinner ? <em>胜</em> : null}
                      </div>
                      <div className={`bracket-team ${bottomWinner ? "is-winner" : ""}`}>
                        <span>下</span>
                        <b>{node.bottomTeam}</b>
                        {bottomWinner ? <em>胜</em> : null}
                      </div>
                      <small className="bracket-node-footer">{node.winner === "待定" ? "胜者待定" : `胜者 ${node.winner}`}</small>
                      <div className="bracket-flow-row">
                        <span>胜者 -&gt; {winnerTarget}</span>
                        <span>负者 -&gt; {loserTarget}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  const renderUnifiedColumn = (column: UnifiedStageBracketColumn) => {
    const columnBodyStyle = { "--bracket-row-count": column.rowCount } as CSSProperties & Record<"--bracket-row-count", number>;
    const style = {
      gridColumn: column.displayColumn + 1,
      gridRow: column.key.startsWith("grand_final") ? "1 / span 2" : column.key.startsWith("winner") ? 1 : 2,
    } as CSSProperties;
    const rowSpan = Math.max(1, Math.floor(column.rowCount / Math.max(1, column.nodes.length)));

    return (
      <div className={`bracket-column bracket-unified-column is-${column.groupKey}`} key={column.key} style={style}>
        <strong>{column.roundName}</strong>
        <div className="bracket-column-body" style={columnBodyStyle}>
          {column.nodes.map((node, nodeIndex) => {
            const topWinner = node.winnerTeamId !== null && node.winnerTeamId === node.topTeamId;
            const bottomWinner = node.winnerTeamId !== null && node.winnerTeamId === node.bottomTeamId;
            const hasOutgoing = Boolean(node.nextNodeId || node.loserNextNodeId);
            const hasIncoming = linkedNodeIds.has(node.id);
            const winnerTarget = formatBracketTarget(nodeLookup, node.nextNodeId, node.nextSlot, "冠军");
            const loserTarget = node.loserNextNodeId ? formatBracketTarget(nodeLookup, node.loserNextNodeId, node.loserNextSlot, "淘汰") : "淘汰";
            const nodeClass = [
              "bracket-node",
              node.status === "已完赛" ? "is-completed" : node.status === "待开赛" ? "is-ready" : "is-pending",
              hasIncoming ? "has-incoming" : "",
              hasOutgoing ? "has-outgoing" : "",
            ].filter(Boolean).join(" ");

            return (
              <article className={nodeClass} key={node.id} data-bracket-node-id={node.id} style={{ gridRow: `${nodeIndex * rowSpan + 1} / span ${rowSpan}` }}>
                <div className="bracket-node-topline">
                  <span className="bracket-node-kicker">#{node.position}</span>
                  <span className="bracket-node-state">{node.status}</span>
                </div>
                <div className={`bracket-team ${topWinner ? "is-winner" : ""}`}>
                  <span>上</span>
                  <b>{node.topTeam}</b>
                  {topWinner ? <em>胜</em> : null}
                </div>
                <div className={`bracket-team ${bottomWinner ? "is-winner" : ""}`}>
                  <span>下</span>
                  <b>{node.bottomTeam}</b>
                  {bottomWinner ? <em>胜</em> : null}
                </div>
                <small className="bracket-node-footer">{node.winner === "待定" ? "胜者待定" : `胜者 ${node.winner}`}</small>
                <div className="bracket-flow-row">
                  <span>胜者 -&gt; {winnerTarget}</span>
                  <span>负者 -&gt; {loserTarget}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!unifiedLayout) {
      setFinalConnectorOverlay(null);
      return;
    }

    let frame = 0;
    const updateOverlay = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setFinalConnectorOverlay(measureStageFinalConnectorOverlay(unifiedMapRef.current, nodes));
      });
    };

    updateOverlay();
    window.addEventListener("resize", updateOverlay);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateOverlay);
    if (unifiedMapRef.current) observer?.observe(unifiedMapRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateOverlay);
      observer?.disconnect();
    };
  }, [nodes, Boolean(unifiedLayout)]);

  return (
    <div className={`bracket-mini-board ${unifiedLayout ? "is-unified" : ""}`}>
      {unifiedLayout ? (
        <div ref={unifiedMapRef} className="bracket-unified-map is-combined" style={{ "--bracket-column-count": unifiedLayout.columnCount } as CSSProperties & Record<"--bracket-column-count", number>}>
          {finalConnectorOverlay ? (
            <svg className="bracket-final-connector-overlay" width={finalConnectorOverlay.width} height={finalConnectorOverlay.height} viewBox={`0 0 ${finalConnectorOverlay.width} ${finalConnectorOverlay.height}`} aria-hidden="true">
              {finalConnectorOverlay.paths.map((path) => <path key={path.id} className={`bracket-final-connector-path is-${path.kind}`} d={path.d} />)}
            </svg>
          ) : null}
          <span className="bracket-unified-lane-label is-winner">胜者组</span>
          <span className="bracket-unified-lane-label is-loser">败者组</span>
          {unifiedLayout.columns.map((column) => renderUnifiedColumn(column))}
          {extraGroups.map((group) => <div key={group.key} className="bracket-unified-extra">{renderGroupLane(group)}</div>)}
        </div>
      ) : groups.map((group) => renderGroupLane(group))}
    </div>
  );
}

type StageBracketGroupLayout = {
  key: string;
  label: string;
  rounds: Map<string, { roundNumber: number; roundName: string; nodes: StageView["bracket"] }>;
};

type UnifiedStageBracketColumn = {
  key: string;
  groupKey: string;
  roundName: string;
  displayColumn: number;
  rowCount: number;
  nodes: StageView["bracket"];
};

type StageFinalConnectorOverlay = {
  width: number;
  height: number;
  paths: Array<{ id: string; kind: "winner" | "loser"; d: string }>;
};

function buildUnifiedStageBracketLayout(groups: StageBracketGroupLayout[], nodes: StageView["bracket"]) {
  const winnerGroup = groups.find((group) => group.key === "winner") ?? null;
  const loserGroup = groups.find((group) => group.key === "loser") ?? null;
  const grandFinalGroup = groups.find((group) => group.key === "grand_final") ?? null;

  if (!winnerGroup || !loserGroup || !grandFinalGroup) {
    return null;
  }

  const groupColumns = (group: StageBracketGroupLayout) => [...group.rounds.entries()]
    .sort(([, roundA], [, roundB]) => roundA.roundNumber - roundB.roundNumber || roundA.roundName.localeCompare(roundB.roundName))
    .map(([roundKey, round]) => ({
      key: roundKey,
      roundName: round.roundName,
      nodes: round.nodes.slice().sort((a, b) => a.position - b.position),
    }));
  const winnerColumnsRaw = groupColumns(winnerGroup);
  const loserColumnsRaw = groupColumns(loserGroup);
  const grandFinalColumnsRaw = groupColumns(grandFinalGroup);
  const firstLoserColumnNodeIds = new Set(loserColumnsRaw[0]?.nodes.map((node) => node.id) ?? []);
  const firstLoserRoundReceivesWinnerDrop = nodes.some((node) => node.bracketGroup === "winner" && node.loserNextNodeId !== null && firstLoserColumnNodeIds.has(node.loserNextNodeId));
  const loserOpeningColumnOffset = firstLoserRoundReceivesWinnerDrop ? 1 : 0;
  const winnerRowCount = Math.max(1, ...winnerColumnsRaw.map((column) => column.nodes.length));
  const loserRowCount = Math.max(1, ...loserColumnsRaw.map((column) => column.nodes.length));
  const winnerColumns = winnerColumnsRaw.map((column, index) => ({
    ...column,
    groupKey: "winner",
    displayColumn: index + 1,
    rowCount: winnerRowCount,
  }));
  const loserColumns = loserColumnsRaw.map((column, index) => ({
    ...column,
    groupKey: "loser",
    displayColumn: index + loserOpeningColumnOffset,
    rowCount: loserRowCount,
  }));
  const winnerFinalColumn = Math.max(...winnerColumns.map((column) => column.displayColumn));
  const loserFinalColumn = Math.max(...loserColumns.map((column) => column.displayColumn));
  const grandFinalDisplayColumn = Math.max(winnerFinalColumn, loserFinalColumn) + 1;
  const grandFinalColumns = grandFinalColumnsRaw.map((column, index) => ({
    ...column,
    groupKey: "grand_final",
    displayColumn: grandFinalDisplayColumn + index,
    rowCount: 1,
  }));
  const columns: UnifiedStageBracketColumn[] = [...winnerColumns, ...loserColumns, ...grandFinalColumns]
    .sort((left, right) => left.displayColumn - right.displayColumn || bracketGroupSortValue(left.groupKey) - bracketGroupSortValue(right.groupKey) || left.roundName.localeCompare(right.roundName));
  const columnCount = Math.max(...columns.map((column) => column.displayColumn)) + 1;

  return { columns, columnCount };
}

function measureStageFinalConnectorOverlay(container: HTMLElement | null, nodes: StageView["bracket"]): StageFinalConnectorOverlay | null {
  if (!container) {
    return null;
  }

  const grandFinalNode = nodes.find((node) => node.bracketGroup === "grand_final") ?? null;
  if (!grandFinalNode) {
    return null;
  }

  const targetElement = container.querySelector<HTMLElement>(bracketNodeDataSelector(grandFinalNode.id));
  if (!targetElement) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const targetX = targetRect.left - containerRect.left;
  const targetY = targetRect.top - containerRect.top + targetRect.height / 2;
  const paths = nodes
    .filter((node) => node.nextNodeId === grandFinalNode.id && (node.bracketGroup === "winner" || node.bracketGroup === "loser"))
    .sort((left, right) => bracketGroupSortValue(left.bracketGroup) - bracketGroupSortValue(right.bracketGroup))
    .map((node) => {
      const sourceElement = container.querySelector<HTMLElement>(bracketNodeDataSelector(node.id));
      if (!sourceElement) {
        return null;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const sourceX = sourceRect.right - containerRect.left;
      const sourceY = sourceRect.top - containerRect.top + sourceRect.height / 2;
      const distance = Math.max(1, targetX - sourceX);
      const midX = sourceX + Math.max(24, distance * 0.62);
      const d = `M ${sourceX} ${sourceY} H ${midX} C ${midX + 18} ${sourceY} ${midX + 18} ${targetY} ${targetX} ${targetY}`;

      return { id: node.id, kind: node.bracketGroup as "winner" | "loser", d };
    })
    .filter((path): path is { id: string; kind: "winner" | "loser"; d: string } => path !== null);

  return paths.length > 0 ? { width: container.scrollWidth, height: container.scrollHeight, paths } : null;
}

function bracketNodeDataSelector(nodeId: string): string {
  return `[data-bracket-node-id="${nodeId.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"]`;
}

function bracketGroupSortValue(groupName: string): number {
  if (groupName === "single") return 0;
  if (groupName === "winner") return 1;
  if (groupName === "loser") return 2;
  if (groupName === "grand_final") return 3;
  return 4;
}

const BRACKET_COLUMN_WIDTH = 188;
const BRACKET_COLUMN_GAP = 34;
const BRACKET_ROUND_TITLE_HEIGHT = 18;
const BRACKET_ROUND_GAP = 9;
const BRACKET_ROW_HEIGHT = 150;
const BRACKET_ROW_GAP = 10;

function bracketTrackWidth(columnCount: number): number {
  return columnCount * BRACKET_COLUMN_WIDTH + Math.max(0, columnCount - 1) * BRACKET_COLUMN_GAP;
}

function bracketTrackHeight(rowCount: number): number {
  return BRACKET_ROUND_TITLE_HEIGHT + BRACKET_ROUND_GAP + rowCount * BRACKET_ROW_HEIGHT + Math.max(0, rowCount - 1) * BRACKET_ROW_GAP;
}

function bracketConnectorPath(
  source: { columnIndex: number; gridRowStart: number; rowSpan: number },
  target: { columnIndex: number; gridRowStart: number; rowSpan: number },
): string {
  const sourceX = source.columnIndex * (BRACKET_COLUMN_WIDTH + BRACKET_COLUMN_GAP) + BRACKET_COLUMN_WIDTH;
  const targetX = target.columnIndex * (BRACKET_COLUMN_WIDTH + BRACKET_COLUMN_GAP);
  const midX = sourceX + (targetX - sourceX) / 2;
  const sourceY = bracketNodeCenterY(source.gridRowStart, source.rowSpan);
  const targetY = bracketNodeCenterY(target.gridRowStart, target.rowSpan);

  return `M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`;
}

function bracketNodeCenterY(gridRowStart: number, rowSpan: number): number {
  const rowTop = (gridRowStart - 1) * (BRACKET_ROW_HEIGHT + BRACKET_ROW_GAP);
  const spanHeight = rowSpan * BRACKET_ROW_HEIGHT + Math.max(0, rowSpan - 1) * BRACKET_ROW_GAP;
  return BRACKET_ROUND_TITLE_HEIGHT + BRACKET_ROUND_GAP + rowTop + spanHeight / 2;
}

function formatBracketTarget(
  nodes: Map<string, StageView["bracket"][number]>,
  nodeId: string | null,
  slot: "radiant" | "dire" | null,
  fallback: string,
): string {
  if (!nodeId) return fallback;
  const node = nodes.get(nodeId);
  const slotLabel = slot === "radiant" ? "上位" : slot === "dire" ? "下位" : "待定槽";
  return node ? `${node.groupName} #${node.position} ${slotLabel}` : `下一节点 ${slotLabel}`;
}

function SchedulePage({
  data,
  loading,
  onNavigate,
  onOpenMatch,
}: {
  data: MobileData;
  loading: boolean;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>("全部");
  const [scheduleOrder, setScheduleOrder] = useState<SortDirection>("desc");
  const totalMatches = data.scheduleGroups.reduce((sum, group) => sum + group.matches.length, 0);
  const filteredScheduleGroups = useMemo(() => {
    const groups = data.scheduleGroups
      .map((group) => ({
        ...group,
        matches:
          statusFilter === "全部" ? group.matches : group.matches.filter((match) => match.status === statusFilter),
      }))
      .filter((group) => group.matches.length > 0);

    if (scheduleOrder === "asc") {
      return groups;
    }

    return groups
      .slice()
      .reverse()
      .map((group) => ({ ...group, matches: group.matches.slice().reverse() }));
  }, [data.scheduleGroups, scheduleOrder, statusFilter]);
  const filteredMatchCount = filteredScheduleGroups.reduce((sum, group) => sum + group.matches.length, 0);

  if (!data.officialSchedule.isPublished) {
    return (
      <>
        <DataNotice data={data} loading={loading} />
        <TournamentScope data={data} onNavigate={onNavigate} />
        <section className="section-panel schedule-unpublished">
          <div className="section-title compact">
            <div>
              <h2>赛程暂未发布</h2>
            </div>
            <span className="sync-pill">{officialScheduleStatusText(data.officialSchedule.status)}</span>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>赛程列表</h2>
          </div>
          <span className="status-tag blue">{scheduleOrder === "desc" ? "倒序" : "正序"}</span>
        </div>
        <div className="schedule-toolbar">
          <FilterRow value={statusFilter} options={scheduleFilters} onChange={setStatusFilter} />
          <button
            aria-pressed={scheduleOrder === "desc"}
            className="schedule-order-button"
            type="button"
            onClick={() => setScheduleOrder((current) => (current === "desc" ? "asc" : "desc"))}
          >
            {scheduleOrder === "desc" ? "切换正序" : "切换倒序"}
          </button>
        </div>
        <p className="schedule-summary">
          当前显示 {filteredMatchCount}/{totalMatches} 场 · {scheduleOrder === "desc" ? "由晚到早" : "由早到晚"}
        </p>
      </section>
      {filteredScheduleGroups.length === 0 ? (
        <section className="section-panel">
          <EmptyState text={data.scheduleGroups.length === 0 ? "暂无" : "暂无符合条件的赛程"} />
        </section>
      ) : (
        filteredScheduleGroups.map((group) => (
          <section className="section-panel schedule-group" key={`${group.date}:${group.label}`}>
            <div className="date-row">
              <b>{group.date}</b>
              <span>{group.label}</span>
            </div>
            <div className="schedule-list">
              {group.matches.map((match) => (
                <ScheduleCard key={`${group.date}:${match.time}:${match.teamA}:${match.teamB}`} match={match} onOpenMatch={onOpenMatch} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

function RecordsPage({
  data,
  loading,
  onNavigate,
  onOpenMatch,
}: {
  data: MobileData;
  loading: boolean;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const [teamFilter, setTeamFilter] = useState<RecordTeamFilter>(allRecordTeamFilter);
  const teamFilters = useMemo(() => buildRecordTeamFilters(data.matchRecords), [data.matchRecords]);
  const visibleRecords = useMemo(
    () =>
      teamFilter === allRecordTeamFilter
        ? data.matchRecords
        : data.matchRecords.filter((record) => matchRecordHasTeam(record, teamFilter)),
    [data.matchRecords, teamFilter],
  );

  useEffect(() => {
    if (!teamFilters.includes(teamFilter)) {
      setTeamFilter(allRecordTeamFilter);
    }
  }, [teamFilter, teamFilters]);

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>比赛记录</h2>
          </div>
          <span className="sync-pill">
            {visibleRecords.length}
            {visibleRecords.length === data.matchRecords.length ? "" : `/${data.matchRecords.length}`} 场
          </span>
        </div>
        <FilterRow labels={teamFilters} value={teamFilter} onChange={setTeamFilter} />
      </section>
      <section className="records-list">
        {visibleRecords.length > 0 ? (
          visibleRecords.map((record, index) => (
            <MatchRecordCard key={record.matchId} record={record} index={index} onOpenMatch={onOpenMatch} />
          ))
        ) : (
          <EmptyState text={data.matchRecords.length === 0 ? "暂无" : "暂无该队伍比赛记录"} />
        )}
      </section>
    </>
  );
}

function MatchDetailPage({
  data,
  loading,
  match,
  expandedPlayers,
  wardScrubberSeconds,
  onPlayerToggle,
  onWardSecondChange,
}: {
  data: MobileData;
  loading: boolean;
  match: MatchData;
  expandedPlayers: Set<string>;
  wardScrubberSeconds: Record<string, number>;
  onPlayerToggle: (playerId: string) => void;
  onWardSecondChange: (matchId: string, seconds: number) => void;
}) {
  const mvp = match.players.find((player) => player.id === match.mvpPlayerId);
  const radiantPlayers = match.players.filter((player) => player.side === "radiant");
  const direPlayers = match.players.filter((player) => player.side === "dire");
  const [awardPopover, setAwardPopover] = useState<MatchAwardPopover | null>(null);

  const closeAwardPopover = useCallback(() => setAwardPopover(null), []);
  const openAwardPopover = useCallback((award: MatchAward, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const { left, top } = getAwardPopoverPosition(rect);

    setAwardPopover({
      key: `${award.code}:${award.playerId}`,
      award,
      left,
      top,
    });
  }, []);
  const togglePlayerWithPopoverClose = useCallback(
    (playerId: string) => {
      closeAwardPopover();
      onPlayerToggle(playerId);
    },
    [closeAwardPopover, onPlayerToggle],
  );

  useEffect(() => {
    closeAwardPopover();
  }, [closeAwardPopover, match.id]);

  useEffect(() => {
    if (!awardPopover) {
      return undefined;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAwardPopover();
      }
    };

    document.addEventListener("pointerdown", closeAwardPopover);
    window.addEventListener("scroll", closeAwardPopover, true);
    window.addEventListener("resize", closeAwardPopover);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeAwardPopover);
      window.removeEventListener("scroll", closeAwardPopover, true);
      window.removeEventListener("resize", closeAwardPopover);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [awardPopover, closeAwardPopover]);

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <MatchSummary match={match} />
      {mvp ? <MvpCard player={mvp} match={match} /> : null}
      <MatchQuickStats match={match} />

      <section className="section-panel player-section">
        <div className="section-title compact">
          <div>
            <h2>双方数据</h2>
          </div>
        </div>
        <TeamPanel
          side="radiant"
          players={radiantPlayers}
          match={match}
          expandedPlayers={expandedPlayers}
          activeAwardKey={awardPopover?.key ?? null}
          onAwardOpen={openAwardPopover}
          onPlayerToggle={togglePlayerWithPopoverClose}
        />
        <TeamPanel
          side="dire"
          players={direPlayers}
          match={match}
          expandedPlayers={expandedPlayers}
          activeAwardKey={awardPopover?.key ?? null}
          onAwardOpen={openAwardPopover}
          onPlayerToggle={togglePlayerWithPopoverClose}
        />
      </section>

      {match.draft.length > 0 ? <DraftSection match={match} /> : null}

      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>视野地图</h2>
          </div>
          <span className="tiny-meta">{match.wardTimeline.length} 条</span>
        </div>
        {match.wardTimeline.length > 0 ? (
          <WardTimeline
            match={match}
            selectedSecond={getWardScrubberSecond(match, wardScrubberSeconds)}
            onChange={(seconds) => onWardSecondChange(match.id, seconds)}
          />
        ) : (
          <EmptyState text="暂无" />
        )}
      </section>

      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>战况趋势</h2>
          </div>
          <span className={`status-tag ${match.trends.hasTrends ? "green" : ""}`}>
            {match.trends.hasTrends ? "曲线" : "暂无"}
          </span>
        </div>
        <TrendSection match={match} />
      </section>

      <section className="section-panel chat-section">
        <div className="section-title compact">
          <div>
            <h2>聊天记录</h2>
          </div>
        </div>
        <div className="chat-list">
          {match.chat.length > 0 ? (
            match.chat.map((line, index) => <ChatLine key={`${line.time}:${line.player}:${index}`} line={line} />)
          ) : (
            <EmptyState text="暂无" />
          )}
        </div>
      </section>
      <MatchAwardFloatingPopover popover={awardPopover} />
    </>
  );
}

function HeroLeaderboardsPage({
  data,
  loading,
  onNavigate,
}: {
  data: MobileData;
  loading: boolean;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const leaderboards = data.heroLeaderboards.leaderboards;

  function toggleBoard(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="section-panel hero-leaderboard-panel">
        <div className="section-title compact">
          <div>
            <h2>英雄榜</h2>
            <p>只统计参赛 {data.heroLeaderboards.minMatches} 场以上选手，按称号口径排名</p>
          </div>
          <span className="sync-pill">{leaderboards.length} 榜</span>
        </div>
        <div className="hero-leaderboard-list">
          {leaderboards.length > 0 ? (
            leaderboards.map((board) => (
              <HeroLeaderboardCard
                key={board.key}
                board={board}
                expanded={expandedKeys.has(board.key)}
                onToggle={() => toggleBoard(board.key)}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <EmptyState text="暂无满足 5 场门槛的英雄榜数据" />
          )}
        </div>
      </section>
    </>
  );
}

function HeroLeaderboardCard({
  board,
  expanded,
  onToggle,
  onNavigate,
}: {
  board: HeroLeaderboardItem;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  const winner = board.winner;

  return (
    <article className={`hero-leaderboard-card ${expanded ? "expanded" : ""}`}>
      <button className="hero-leaderboard-main" type="button" onClick={onToggle}>
        <div className="hero-leaderboard-title">
          <span>{board.title}</span>
          <small>{board.description}</small>
        </div>
        <div className="hero-leaderboard-main-row">
          {winner ? (
            <div className="hero-leaderboard-winner">
              <PlayerAvatar player={winner.player} />
              <div>
                <b>{winner.player.displayName}</b>
                <small>{leaderboardTeamName(winner)}</small>
              </div>
            </div>
          ) : (
            <div className="hero-leaderboard-empty">暂无获得者</div>
          )}
          <div className="hero-leaderboard-action">
            <div className="hero-leaderboard-value">
              <b>{winner ? formatLeaderboardValue(winner.average, board) : "-"}</b>
              <small>{board.metricLabel}</small>
            </div>
            <span className="hero-leaderboard-toggle">
              <span>{expanded ? "收起" : "前五"}</span>
              <span className={`hero-leaderboard-toggle-icon ${expanded ? "expanded" : ""}`} aria-hidden="true" />
            </span>
          </div>
        </div>
      </button>
      {expanded ? (
        <div className="hero-leaderboard-candidates">
          {board.candidates.length > 0 ? (
            board.candidates.map((candidate) => (
              <button
                className="hero-leaderboard-row"
                type="button"
                key={`${board.key}-${candidate.player.id}`}
                onClick={() => onNavigate("player", { profileId: candidate.player.id })}
              >
                <span className="hero-leaderboard-rank">#{candidate.rank}</span>
                <PlayerAvatar player={candidate.player} />
                <span className="hero-leaderboard-name">
                  <b>{candidate.player.displayName}</b>
                  <small>{leaderboardTeamName(candidate)} · {candidate.matches} 场</small>
                </span>
                <span className="hero-leaderboard-row-value">
                  <b>{formatLeaderboardValue(candidate.average, board)}</b>
                  <small>总计 {formatLeaderboardTotal(candidate.total, board)}</small>
                </span>
              </button>
            ))
          ) : (
            <EmptyState text={`暂无满足 ${board.minMatches} 场门槛的数据`} />
          )}
        </div>
      ) : null}
    </article>
  );
}

function PlayerAvatar({ player }: { player: HeroLeaderboardCandidate["player"] }) {
  return player.avatarUrl ? (
    <img className="leaderboard-avatar" src={player.avatarUrl} alt="" loading="lazy" />
  ) : (
    <span className="leaderboard-avatar placeholder">{player.displayName.slice(0, 1) || "选"}</span>
  );
}

function PlayersPage({
  data,
  loading,
  players,
  profileLoading,
  profileErrors,
  playerSortKey,
  playerSortDirection,
  onNavigate,
  onSort,
}: {
  data: MobileData;
  loading: boolean;
  players: PlayerDirectoryItem[];
  profileLoading: Record<string, boolean>;
  profileErrors: Record<string, string>;
  playerSortKey: PlayerSortKey;
  playerSortDirection: SortDirection;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
  onSort: (sortKey: PlayerSortKey) => void;
}) {
  const error = profileErrors.players;

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="section-panel player-board-panel">
        <div className="section-title compact">
          <div>
            <h2>选手数据榜</h2>
          </div>
          <span className="sync-pill">{players.length} 名</span>
        </div>
        <PlayerSortBar
          activeKey={playerSortKey}
          direction={playerSortDirection}
          onSort={onSort}
        />
        <div className="player-stat-list">
          {players.length > 0 ? (
            players.map((player) => <PlayerDirectoryCard key={player.id} player={player} onNavigate={onNavigate} />)
          ) : (
            <EmptyState text={error ?? (profileLoading.players ? "读取中" : "暂无")} />
          )}
        </div>
      </section>
    </>
  );
}

function TeamsPage({
  data,
  loading,
  profileLoading,
  profileErrors,
  onNavigate,
}: {
  data: MobileData;
  loading: boolean;
  profileLoading: Record<string, boolean>;
  profileErrors: Record<string, string>;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  const topTeams = useMemo(
    () => [...data.teams].sort((left, right) => right.stats.seriesPlayed - left.stats.seriesPlayed),
    [data.teams],
  );
  const error = profileErrors.teams;

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>队伍主页</h2>
          </div>
          <span className="sync-pill">{topTeams.length} 支</span>
        </div>
        <div className="profile-card-list">
          {topTeams.length > 0 ? (
            topTeams.map((team) => <TeamDirectoryCard key={team.id} team={team} onNavigate={onNavigate} />)
          ) : (
            <EmptyState text={error ?? (profileLoading.teams ? "读取中" : "暂无")} />
          )}
        </div>
      </section>
    </>
  );
}

function PlayerProfilePage({
  data,
  loading,
  profileId,
  profiles,
  profileErrors,
  onNavigate,
  onOpenMatch,
  onRetry,
}: {
  data: MobileData;
  loading: boolean;
  profileId: string | null;
  profiles: Record<string, PlayerProfile>;
  profileErrors: Record<string, string>;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
  onOpenMatch: (matchId: string) => void;
  onRetry: (type: "player" | "team", id: string) => void;
}) {
  const playerId = profileId ?? data.players[0]?.id ?? null;

  if (playerId === null) {
    return <EmptyState text="暂无" />;
  }

  const error = profileErrors[`player:${playerId}`];

  if (error) {
    return <ProfileError title="读取失败" message={error} type="player" profileId={playerId} onRetry={onRetry} />;
  }

  const profile = profiles[playerId];

  if (!profile) {
    return <ProfileLoading text="读取中" />;
  }

  const team = profile.currentTeam ?? profile.teams[0] ?? null;

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="profile-hero player-profile" style={cssVars({ "--accent": team?.color ?? "#5eead4" })}>
        <div className="profile-hero-main">
          <SteamAvatar player={profile} size="large" />
          <div>
            <div className="profile-name-row">
              <h2>{profile.displayName}</h2>
              <PlayerTeamBadge team={team} />
            </div>
            <p>
              {team?.name ?? "暂未归队"} · Account {profile.accountId ?? "-"}
            </p>
          </div>
        </div>
        <div className="profile-winrate">
          <span>本届胜率</span>
          <b>{profile.stats.winRate}</b>
          <small>
            {profile.stats.wins}W / {profile.stats.losses}L
          </small>
        </div>
      </section>

      <PlayerTagCloud tags={profile.tags} />

      <ProfileStatGrid
        stats={[
          ["场次", String(profile.stats.totalMatches)],
          ["胜率", profile.stats.winRate],
          ["KDA", profile.stats.kda],
          ["场均K/D/A", `${profile.stats.avgKills}/${profile.stats.avgDeaths}/${profile.stats.avgAssists}`],
          ["GPM", profile.stats.avgGpm],
          ["XPM", profile.stats.avgXpm],
          ["场均经济", profile.stats.avgNetWorth],
          ["场均伤害", profile.stats.avgHeroDamage],
          ["建筑伤害", profile.stats.avgTowerDamage],
          ["场均承伤", profile.stats.avgDamageTaken],
        ]}
      />

      <SignatureHeroes heroes={profile.stats.topHeroes} />
      <PlayerTournamentHistory profile={profile} records={data.matchRecords} onOpenMatch={onOpenMatch} />
    </>
  );
}

function TeamProfilePage({
  data,
  loading,
  profileId,
  profiles,
  profileErrors,
  onNavigate,
  onOpenMatch,
  onRetry,
}: {
  data: MobileData;
  loading: boolean;
  profileId: string | null;
  profiles: Record<string, TeamProfile>;
  profileErrors: Record<string, string>;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
  onOpenMatch: (matchId: string) => void;
  onRetry: (type: "player" | "team", id: string) => void;
}) {
  const teamId = profileId ?? data.teams[0]?.id ?? null;

  if (teamId === null) {
    return <EmptyState text="暂无" />;
  }

  const error = profileErrors[`team:${teamId}`];

  if (error) {
    return <ProfileError title="读取失败" message={error} type="team" profileId={teamId} onRetry={onRetry} />;
  }

  const profile = profiles[teamId];

  if (!profile) {
    return <ProfileLoading text="读取中" />;
  }

  return (
    <>
      <DataNotice data={data} loading={loading} />
      <TournamentScope data={data} onNavigate={onNavigate} />
      <section className="profile-hero team-profile" style={cssVars({ "--accent": profile.color })}>
        <div className="profile-hero-main">
          <span className="profile-avatar-fallback large team">{profile.shortName.slice(0, 2).toUpperCase()}</span>
          <div>
            <h2>{profile.name}</h2>
            <p>
              {profile.memberCount} 名成员 · {profile.status} · {profile.stats.linkedMatches} 场
            </p>
          </div>
        </div>
        <div className="profile-winrate">
          <span>本届胜率</span>
          <b>{profile.stats.winRate}</b>
          <small>
            {profile.stats.gameWins}W / {profile.stats.gameLosses}L
          </small>
        </div>
      </section>

      <ProfileStatGrid
        stats={[
          ["比赛", String(profile.stats.seriesPlayed)],
          ["胜场", String(profile.stats.seriesWins)],
          ["负场", String(profile.stats.seriesLosses)],
          ["成员", String(profile.memberCount)],
          ["入库比赛", String(profile.stats.linkedMatches)],
          ["状态", profile.status],
        ]}
      />

      <section className="section-panel">
        <div className="section-title compact">
          <div>
            <h2>成员名单</h2>
          </div>
        </div>
        <div className="roster-list">
          {profile.members.length > 0 ? (
            profile.members.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onNavigate("player", { profileId: player.id })}
              >
                <SteamAvatar player={player} size="small" />
                <b>{player.displayName}</b>
                <span>ID {player.accountId ?? player.id}</span>
              </button>
            ))
          ) : (
            <EmptyState text="暂无" />
          )}
        </div>
      </section>

      <SignatureHeroes heroes={profile.stats.topHeroes} />
      <ProfileMatches matches={profile.matches} title="队伍比赛" records={data.matchRecords} onOpenMatch={onOpenMatch} />
    </>
  );
}

function TournamentScope({
  data,
  onNavigate,
}: {
  data: MobileData;
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  const meta = data.selectedTournamentMeta;

  return (
    <section className="tournament-scope">
      <div>
        <b>{data.selectedTournamentName}</b>
        <span>
          League {meta.leagueId} · {meta.statusText}
        </span>
      </div>
      <button className="link-button" type="button" onClick={() => onNavigate("home")}>
        切换
      </button>
    </section>
  );
}

function DataNotice({ loading }: { data: MobileData; loading: boolean }) {
  const text = loading ? "读取中" : null;

  return text ? <section className="api-notice">{text}</section> : null;
}

function FilterRow(
  props:
    | { labels: string[]; value?: string; onChange?: (value: string) => void }
    | { value: ScheduleStatusFilter; options: ScheduleStatusFilter[]; onChange: (value: ScheduleStatusFilter) => void },
) {
  if ("labels" in props) {
    const activeValue = props.value ?? props.labels[0];

    return (
      <div className="filter-row">
        {props.labels.map((label) => (
          <button
            aria-pressed={label === activeValue}
            className={`filter ${label === activeValue ? "active" : ""}`}
            key={label}
            type="button"
            onClick={() => props.onChange?.(label)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="filter-row">
      {props.options.map((label) => (
        <button
          aria-pressed={label === props.value}
          className={`filter ${label === props.value ? "active" : ""}`}
          key={label}
          type="button"
          onClick={() => props.onChange(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function buildRecordTeamFilters(records: MatchRecord[]): RecordTeamFilter[] {
  const names = new Set<string>();

  records.forEach((record) => {
    [record.radiantTeamName, record.direTeamName].forEach((name) => {
      const normalized = cleanRecordTeamName(name);

      if (normalized) {
        names.add(normalized);
      }
    });
  });

  return [allRecordTeamFilter, ...[...names].sort((left, right) => left.localeCompare(right, "zh-CN"))];
}

function matchRecordHasTeam(record: MatchRecord, teamName: string): boolean {
  const normalized = cleanRecordTeamName(teamName);

  return [record.radiantTeamName, record.direTeamName].some((name) => cleanRecordTeamName(name) === normalized);
}

function cleanRecordTeamName(name: string): string {
  const normalized = name.trim();

  return normalized === "天辉" || normalized === "夜魇" ? "" : normalized;
}

function officialStageOptions(data: MobileData): typeof stageOptions {
  const activeKeys = new Set(data.officialStageKeys);

  return stageOptions.filter((option) => activeKeys.has(option.key));
}

function ScheduleCard({
  match,
  onOpenMatch,
}: {
  match: {
    time: string;
    stage: string;
    round: string;
    kind?: string;
    teamA: string;
    teamB: string;
    bo: string;
    status: string;
    score?: string;
    matchId?: string;
  };
  onOpenMatch: (matchId: string) => void;
}) {
  const isFinished = match.status === "已完赛";
  const scoreText = match.score ?? match.bo;
  const parsedScore = parseScheduleScore(match.score);
  const teamAIsWinner = parsedScore !== null && parsedScore.left > parsedScore.right;
  const teamBIsWinner = parsedScore !== null && parsedScore.right > parsedScore.left;
  const roundLabel = `${match.stage} · ${match.kind === "tiebreaker" ? `加赛 · ${match.round}` : match.round}`;

  return (
    <article className={`schedule-card ${isFinished ? "finished" : ""}`}>
      <div className="schedule-card-head">
        <b>{match.time}</b>
        <span>{roundLabel}</span>
      </div>
      <div className="schedule-matchup">
        <span className={`schedule-team ${teamAIsWinner ? "is-winner" : teamBIsWinner ? "is-dimmed" : ""}`}>{match.teamA}</span>
        <strong className={`schedule-score ${match.score ? "is-result" : "is-bo"}`}>{scoreText}</strong>
        <span className={`schedule-team is-right ${teamBIsWinner ? "is-winner" : teamAIsWinner ? "is-dimmed" : ""}`}>{match.teamB}</span>
      </div>
      <div className="schedule-card-foot">
        <span className={`status-tag ${statusClass(match.status)}`}>{match.status}</span>
        {match.matchId ? (
          <button className="link-button" type="button" onClick={() => onOpenMatch(match.matchId!)}>
            打开战报
          </button>
        ) : (
          <small>--</small>
        )}
      </div>
    </article>
  );
}

function parseScheduleScore(score: string | undefined): { left: number; right: number } | null {
  const match = score?.match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
  return match ? { left: Number(match[1]), right: Number(match[2]) } : null;
}

function MatchRecordCard({
  record,
  index = 0,
  onOpenMatch,
}: {
  record: MatchRecord;
  index?: number;
  onOpenMatch: (matchId: string) => void;
}) {
  const score =
    record.radiantScore === null || record.direScore === null
      ? "- : -"
      : `${record.radiantScore} : ${record.direScore}`;
  const winnerClass = record.radiantWin === null ? "" : record.radiantWin ? "radiant-win" : "dire-win";
  const heroCount = record.heroLineups.radiant.length + record.heroLineups.dire.length;

  return (
    <article className={`record-card ${winnerClass}`} style={cssVars({ "--record-delay": `${Math.min(index * 28, 420)}ms` })}>
      <button className="record-main" type="button" onClick={() => onOpenMatch(record.matchId)}>
        <div className="record-head">
          <span>#{record.matchId}</span>
          <b>{record.startTime}</b>
        </div>
        <div className="record-score">
          <span>{record.radiantTeamName}</span>
          <strong>{score}</strong>
          <span>{record.direTeamName}</span>
        </div>
        <RecordHeroMatchup record={record} />
        <div className="record-meta">
          <span>{record.duration}</span>
          <span>{record.parseStatus}</span>
          <span>{record.playerCount} 人</span>
        </div>
        <div className="record-flags">
          <RecordFlag label={`英雄 ${heroCount || "-"}`} active={heroCount > 0} />
          <RecordFlag label="BP" active={record.hasDraft} />
          <RecordFlag label="眼位" active={record.hasVision} />
          <RecordFlag label="聊天" active={record.hasChat} />
        </div>
      </button>
    </article>
  );
}

function RecordHeroMatchup({ record }: { record: MatchRecord }) {
  const hasLineup = record.heroLineups.radiant.length > 0 || record.heroLineups.dire.length > 0;

  if (!hasLineup) {
    return (
      <div className="record-lineup empty">
        <span>英雄阵容待同步</span>
      </div>
    );
  }

  return (
    <div className="record-lineup" aria-label="双方英雄对阵">
      <RecordHeroStrip side="radiant" heroes={record.heroLineups.radiant} />
      <span className="record-versus" aria-hidden="true">
        <i />
        <b>VS</b>
        <i />
      </span>
      <RecordHeroStrip side="dire" heroes={record.heroLineups.dire} />
    </div>
  );
}

function RecordHeroStrip({ side, heroes }: { side: TeamSide; heroes: MatchRecord["heroLineups"][TeamSide] }) {
  return (
    <span className={`record-hero-strip ${side}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <RecordHero side={side} hero={heroes[index]} index={index} key={`${side}:${index}`} />
      ))}
    </span>
  );
}

function RecordHero({
  side,
  hero,
  index,
}: {
  side: TeamSide;
  hero: MatchRecord["heroLineups"][TeamSide][number] | undefined;
  index: number;
}) {
  if (!hero) {
    return (
      <span className="record-hero empty" style={cssVars({ "--hero-delay": `${index * 30}ms` })}>
        <i />
      </span>
    );
  }

  const title = `${side === "radiant" ? "天辉" : "夜魇"} · ${hero.playerName} · ${hero.hero}`;

  return (
    <span className="record-hero" style={cssVars({ "--hero-delay": `${index * 30}ms` })} title={title}>
      <ImageWithFallback src={hero.icon} fallback={hero.portrait} alt={hero.hero} loading="lazy" />
    </span>
  );
}

function RecordFlag({ label, active }: { label: string; active: boolean }) {
  return <span className={active ? "active" : ""}>{label}</span>;
}

function PlayerSortBar({
  activeKey,
  direction,
  onSort,
}: {
  activeKey: PlayerSortKey;
  direction: SortDirection;
  onSort: (sortKey: PlayerSortKey) => void;
}) {
  const activeOption = playerSortOptions.find((option) => option.key === activeKey) ?? playerSortOptions[0]!;

  return (
    <>
      <div className="player-sort-meta">
        <span>排序</span>
        <b>
          {activeOption.label} {direction === "desc" ? "↓" : "↑"}
        </b>
      </div>
      <div className="player-sort-bar" role="toolbar" aria-label="选手排序">
        {playerSortOptions.map((option) => {
          const active = option.key === activeKey;
          const shownDirection = active ? direction : option.defaultDirection;

          return (
            <button
              className={active ? "active" : ""}
              type="button"
              aria-pressed={active}
              key={option.key}
              onClick={() => onSort(option.key)}
            >
              {option.label}
              <span>{shownDirection === "desc" ? "↓" : "↑"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function PlayerDirectoryCard({
  player,
  onNavigate,
}: {
  player: MobileData["players"][number];
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  const team = player.currentTeam ?? player.teams[0] ?? null;
  const winRateValue = clampNumber(numericStatValue(player, "winRate") ?? 0, 0, 100);

  return (
    <article className="player-stat-card" style={cssVars({ "--accent": team?.color ?? "#5eead4" })}>
      <button
        className="player-stat-card-main"
        type="button"
        onClick={() => onNavigate("player", { profileId: player.id })}
      >
        <div className="player-stat-head">
          <SteamAvatar player={player} />
          <div className="player-stat-identity">
            <div className="player-stat-name-row">
              <b>{player.displayName}</b>
              <PlayerTeamBadge team={team} />
            </div>
            <small>
              <span className="profile-id-link">ID {player.accountId ?? player.id}</span>
              <span>
                {player.stats.wins}W / {player.stats.losses}L
              </span>
            </small>
          </div>
          <div className="player-stat-primary">
            <span>
              胜率 <b>{player.stats.winRate}</b>
            </span>
            <i style={cssVars({ "--rate": `${winRateValue}%` })} />
            <strong>{player.stats.kda}</strong>
            <em>KDA</em>
          </div>
        </div>
        <div className="player-stat-grid">
          <PlayerStatTile label="场次" value={String(player.stats.totalMatches)} />
          <PlayerStatTile label="GPM" value={player.stats.avgGpm} />
          <PlayerStatTile label="XPM" value={player.stats.avgXpm} />
          <PlayerStatTile label="击/亡/助" value={`${player.stats.avgKills}/${player.stats.avgDeaths}/${player.stats.avgAssists}`} />
          <PlayerStatTile label="场均经济" value={player.stats.avgNetWorth} />
          <PlayerStatTile label="英雄伤害" value={player.stats.avgHeroDamage} />
          <PlayerStatTile label="建筑伤害" value={player.stats.avgTowerDamage} />
          <PlayerStatTile label="承伤" value={player.stats.avgDamageTaken} />
        </div>
        <PlayerHeroStrip heroes={player.stats.topHeroes} />
      </button>
    </article>
  );
}

function PlayerTeamBadge({ team }: { team: EntityTeamInfo | null }) {
  if (team === null) {
    return <span className="team-mark empty">暂未归队</span>;
  }

  return (
    <span
      className="team-mark"
      style={cssVars({ "--team": team.color })}
      title={`所属战队：${team.name}`}
      aria-label={`所属战队：${team.name}`}
    >
      {team.name}
    </span>
  );
}

function PlayerStatTile({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function PlayerHeroStrip({ heroes }: { heroes: PlayerDirectoryItem["stats"]["topHeroes"] }) {
  if (heroes.length === 0) {
    return <div className="player-hero-strip empty">暂无常用英雄</div>;
  }

  return (
    <div className="player-hero-strip">
      {heroes.slice(0, 3).map((hero) => (
        <span key={hero.heroId}>
          <ImageWithFallback src={hero.icon} fallback={hero.portrait} alt={hero.hero} loading="lazy" />
        </span>
      ))}
    </div>
  );
}

function SteamAvatar({
  player,
  size = "normal",
}: {
  player: Pick<PlayerDirectoryItem, "displayName" | "avatarUrl">;
  size?: "normal" | "large" | "small";
}) {
  const [failed, setFailed] = useState(false);
  const initial = player.displayName.slice(0, 1).toUpperCase();
  const fallback = (
    <span className={`profile-avatar-fallback ${size === "large" ? "large" : ""}`} aria-hidden="true">
      {initial}
    </span>
  );

  useEffect(() => {
    setFailed(false);
  }, [player.avatarUrl]);

  if (!player.avatarUrl || failed) {
    return fallback;
  }

  return (
    <span className={`steam-avatar-shell ${size}`}>
      <img
        className={`steam-avatar ${size}`}
        src={player.avatarUrl}
        alt={player.displayName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      {fallback}
    </span>
  );
}

function TeamDirectoryCard({
  team,
  onNavigate,
}: {
  team: MobileData["teams"][number];
  onNavigate: (route: AppRoute, options?: NavigateOptions) => void;
}) {
  return (
    <article className="profile-list-card team-card" style={cssVars({ "--accent": team.color })}>
      <button type="button" onClick={() => onNavigate("team", { profileId: team.id })}>
        <span className="profile-avatar-fallback team">{team.shortName.slice(0, 2).toUpperCase()}</span>
        <div>
          <b>{team.name}</b>
          <small>
            {team.memberCount} 名成员 · {team.stats.seriesPlayed} 场 · 胜率 {team.stats.winRate}
          </small>
          <span>
            {team.stats.gameWins} 胜 / {team.stats.gameLosses} 负 · 入库 {team.stats.linkedMatches} 场
          </span>
        </div>
        <strong>进入</strong>
      </button>
    </article>
  );
}

function ProfileLoading({ text }: { text: string }) {
  return (
    <section className="section-panel profile-loading">
      <h2>{text}</h2>
    </section>
  );
}

function ProfileError({
  title,
  message,
  type,
  profileId,
  onRetry,
}: {
  title: string;
  message: string;
  type: "player" | "team";
  profileId: string;
  onRetry: (type: "player" | "team", id: string) => void;
}) {
  return (
    <section className="section-panel profile-loading profile-error">
      <h2>{title}</h2>
      <small>{message}</small>
      <button type="button" onClick={() => onRetry(type, profileId)}>
        再试一次
      </button>
    </section>
  );
}

function ProfileStatGrid({ stats }: { stats: Array<[string, string]> }) {
  return (
    <section className="profile-stat-grid">
      {stats.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </article>
      ))}
    </section>
  );
}

function SignatureHeroes({ heroes }: { heroes: Array<{ hero: string; portrait: string; picks: number; wins: number }> }) {
  return (
    <section className="section-panel">
      <div className="section-title compact">
        <div>
          <h2>常用英雄</h2>
        </div>
      </div>
      <div className="signature-heroes">
        {heroes.length > 0 ? (
          heroes.map((hero) => (
            <article key={hero.hero}>
              <ImageWithFallback src={hero.portrait} fallback="/static/dota/heroes/unknown.svg" alt={hero.hero} loading="lazy" />
              <div>
                <b>{hero.hero}</b>
                <span>
                  {hero.picks} 场 · {hero.wins} 胜 · {formatHeroWinRate(hero.wins, hero.picks)}
                </span>
              </div>
            </article>
          ))
        ) : (
          <EmptyState text="暂无" />
        )}
      </div>
    </section>
  );
}

function ProfileMatches({
  matches,
  title,
  records,
  onOpenMatch,
}: {
  matches: ProfileMatchSummary[];
  title: string;
  records: MatchRecord[];
  onOpenMatch: (matchId: string) => void;
}) {
  const recordsByMatchId = useMemo(() => new Map(records.map((record) => [record.matchId, record])), [records]);

  return (
    <section className="section-panel">
      <div className="section-title compact">
        <div>
          <h2>{title}</h2>
        </div>
        <span className="sync-pill">{matches.length} 场</span>
      </div>
      <div className="profile-record-list">
        {matches.length > 0 ? (
          matches.map((match, index) => (
            <MatchRecordCard
              key={match.matchId}
              record={recordsByMatchId.get(match.matchId) ?? profileMatchToRecord(match)}
              index={index}
              onOpenMatch={onOpenMatch}
            />
          ))
        ) : (
          <EmptyState text="暂无" />
        )}
      </div>
    </section>
  );
}

function PlayerTournamentHistory({
  profile,
  records,
  onOpenMatch,
}: {
  profile: PlayerProfile;
  records: MatchRecord[];
  onOpenMatch: (matchId: string) => void;
}) {
  const recordsByMatchId = useMemo(() => new Map(records.map((record) => [record.matchId, record])), [records]);
  const currentEntry =
    profile.tournamentHistory.find((entry) => entry.isCurrent) ??
    ({
      tournamentId: profile.tournamentId,
      tournamentName: "本届赛事",
      startsAt: "时间待定",
      status: "",
      isCurrent: true,
      stats: profile.stats,
      matches: profile.matches,
    } satisfies PlayerTournamentHistoryEntry);
  const previousEntries = profile.tournamentHistory.filter((entry) => !entry.isCurrent);
  const totalMatches = profile.tournamentHistory.reduce((sum, entry) => sum + entry.matches.length, 0) || profile.matches.length;

  return (
    <section className="section-panel player-history-panel">
      <div className="section-title compact">
        <div>
          <h2>参赛记录</h2>
        </div>
        <span className="sync-pill">{totalMatches} 场</span>
      </div>

      <div className="player-season-current">
        <SeasonRecordHeader entry={currentEntry} label="本届" />
        <ProfileMatchCards
          matches={currentEntry.matches}
          recordsByMatchId={recordsByMatchId}
          tournamentName={currentEntry.tournamentName}
          onOpenMatch={onOpenMatch}
        />
      </div>

      {previousEntries.length > 0 ? (
        <div className="player-season-archive">
          <div className="season-archive-title">
            <span>往届参赛</span>
            <small>{previousEntries.length} 届</small>
          </div>
          {previousEntries.map((entry) => (
            <details className="season-details" key={entry.tournamentId}>
              <summary>
                <SeasonRecordHeader entry={entry} />
              </summary>
              <ProfileMatchCards
                matches={entry.matches}
                recordsByMatchId={recordsByMatchId}
                tournamentName={entry.tournamentName}
                onOpenMatch={onOpenMatch}
              />
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SeasonRecordHeader({ entry, label }: { entry: PlayerTournamentHistoryEntry; label?: string }) {
  return (
    <div className="season-record-header">
      <div>
        <h3>{entry.tournamentName}</h3>
        <span>{label ?? entry.startsAt}</span>
      </div>
      <div className="season-record-metrics">
        <b>{entry.matches.length} 场</b>
        <small>{entry.stats.winRate}</small>
      </div>
    </div>
  );
}

function ProfileMatchCards({
  matches,
  recordsByMatchId,
  tournamentName,
  onOpenMatch,
}: {
  matches: ProfileMatchSummary[];
  recordsByMatchId: Map<string, MatchRecord>;
  tournamentName: string;
  onOpenMatch: (matchId: string) => void;
}) {
  return (
    <div className="profile-record-list">
      {matches.length > 0 ? (
        matches.map((match, index) => (
          <MatchRecordCard
            key={match.matchId}
            record={recordsByMatchId.get(match.matchId) ?? profileMatchToRecord(match, tournamentName)}
            index={index}
            onOpenMatch={onOpenMatch}
          />
        ))
      ) : (
        <EmptyState text="暂无" />
      )}
    </div>
  );
}

type FloatingTagBody = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  radius: number;
  driftSpeed: number;
};

type FloatingTagBurst = {
  sequence: number;
  tagId: string;
  x: number;
  y: number;
};

type FloatingTagCheer = {
  sequence: number;
  x: number;
  y: number;
  driftX: number;
};

type FloatingTagActiveBurst = {
  sequence: number;
  sourceId: string;
  centerX: number;
  centerY: number;
  startedAt: number;
  duration: number;
  radius: number;
  strength: number;
};

type ScaledPlayerTag = PlayerTag & {
  popularityRatio: number;
  labelWidth: number;
  labelHeight: number;
  textSize: number;
  heat: number;
  accentColor: string;
  accentGlow: string;
};

function PlayerTagCloud({ tags }: { tags: PlayerTag[] }) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const tagRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const bodiesRef = useRef<FloatingTagBody[]>([]);
  const activeBurstsRef = useRef<FloatingTagActiveBurst[]>([]);
  const burstSequenceRef = useRef(0);
  const energizedTimerRef = useRef<number | null>(null);
  const burstTimerRef = useRef<number | null>(null);
  const cheerTimersRef = useRef<number[]>([]);
  const [energizedTagId, setEnergizedTagId] = useState<string | null>(null);
  const [burst, setBurst] = useState<FloatingTagBurst | null>(null);
  const [cheers, setCheers] = useState<FloatingTagCheer[]>([]);
  const scaledTags = useMemo(() => scalePlayerTags(tags), [tags]);

  useEffect(
    () => () => {
      if (energizedTimerRef.current !== null) {
        window.clearTimeout(energizedTimerRef.current);
      }

      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current);
      }

      for (const cheerTimer of cheerTimersRef.current) {
        window.clearTimeout(cheerTimer);
      }

      cheerTimersRef.current = [];
    },
    [],
  );

  useEffect(() => {
    const field = fieldRef.current;

    if (field === null || scaledTags.length === 0) {
      bodiesRef.current = [];
      activeBurstsRef.current = [];
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let lastTime = performance.now();

    const readBodies = () => {
      const bounds = field.getBoundingClientRect();
      const previousBodies = new Map(bodiesRef.current.map((body) => [body.id, body]));

      bodiesRef.current = scaledTags.map((tag, index) => {
        const element = tagRefs.current[tag.id];
        const elementBounds = element?.getBoundingClientRect();
        const width = Math.max(tag.labelWidth, elementBounds?.width ?? tag.labelWidth);
        const height = Math.max(tag.labelHeight, elementBounds?.height ?? tag.labelHeight);
        const previous = previousBodies.get(tag.id);
        const seed = seededUnit(`${tag.id}:${index}:${tag.text}`);
        const maxX = Math.max(0, bounds.width - width);
        const maxY = Math.max(0, bounds.height - height);
        const angle = seed * Math.PI * 2;
        const speed = 0.11 + tag.popularityRatio * 0.008 + tag.heat * 0.034;

        return {
          id: tag.id,
          x: clampNumber(previous?.x ?? maxX * seededUnit(`${tag.id}:x`), 0, maxX),
          y: clampNumber(previous?.y ?? maxY * seededUnit(`${tag.id}:y`), 0, maxY),
          vx: previous?.vx ?? Math.cos(angle) * speed,
          vy: previous?.vy ?? Math.sin(angle) * speed,
          width,
          height,
          radius: Math.max(width * 0.24, height * 0.62),
          driftSpeed: speed,
        };
      });

      for (let iteration = 0; iteration < 8; iteration += 1) {
        resolveFloatingTagCollisions(bodiesRef.current);
        clampFloatingTagBodies(bodiesRef.current, bounds);
      }
    };

    const tick = (time: number) => {
      const bounds = field.getBoundingClientRect();
      const delta = Math.min(2.4, Math.max(0.45, (time - lastTime) / 16.67));
      lastTime = time;

      applyFloatingTagBursts(bodiesRef.current, activeBurstsRef.current, time, delta);

      for (const body of bodiesRef.current) {
        const maxX = Math.max(0, bounds.width - body.width);
        const maxY = Math.max(0, bounds.height - body.height);

        body.x += body.vx * delta;
        body.y += body.vy * delta;

        if (body.x <= 0 || body.x >= maxX) {
          body.x = clampNumber(body.x, 0, maxX);
          body.vx *= -0.92;
        }

        if (body.y <= 0 || body.y >= maxY) {
          body.y = clampNumber(body.y, 0, maxY);
          body.vy *= -0.92;
        }

        const speed = Math.hypot(body.vx, body.vy);

        if (speed > body.driftSpeed * 2.4) {
          const damping = Math.pow(0.935, delta);
          body.vx *= damping;
          body.vy *= damping;
        } else if (speed < body.driftSpeed * 0.72) {
          const driftAngle = seededUnit(`${body.id}:${Math.floor(time / 900)}`) * Math.PI * 2;

          body.vx += Math.cos(driftAngle) * 0.012 * delta;
          body.vy += Math.sin(driftAngle) * 0.012 * delta;
        }

        clampFloatingTagSpeed(body, 8.4);
      }

      for (let iteration = 0; iteration < 3; iteration += 1) {
        resolveFloatingTagCollisions(bodiesRef.current);
        clampFloatingTagBodies(bodiesRef.current, bounds);
      }
      drawFloatingTagBodies(tagRefs.current, bodiesRef.current);
      animationFrame = window.requestAnimationFrame(tick);
    };

    readBodies();
    drawFloatingTagBodies(tagRefs.current, bodiesRef.current);

    const resizeObserver = new ResizeObserver(() => {
      readBodies();
      drawFloatingTagBodies(tagRefs.current, bodiesRef.current);
    });
    resizeObserver.observe(field);

    if (!reducedMotion) {
      animationFrame = window.requestAnimationFrame(tick);
    }

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [scaledTags]);

  const energizeTag = (tag: ScaledPlayerTag) => {
    const sequence = burstSequenceRef.current + 1;
    const field = fieldRef.current;
    const clickedBody = bodiesRef.current.find((body) => body.id === tag.id);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    burstSequenceRef.current = sequence;
    setEnergizedTagId(tag.id);

    if (energizedTimerRef.current !== null) {
      window.clearTimeout(energizedTimerRef.current);
    }

    if (burstTimerRef.current !== null) {
      window.clearTimeout(burstTimerRef.current);
    }

    if (field !== null && clickedBody !== undefined) {
      const bounds = field.getBoundingClientRect();
      const centerX = clickedBody.x + clickedBody.width / 2;
      const centerY = clickedBody.y + clickedBody.height / 2;
      const burstX = bounds.width <= 0 ? 50 : (centerX / bounds.width) * 100;
      const burstY = bounds.height <= 0 ? 50 : (centerY / bounds.height) * 100;

      setBurst({ sequence, tagId: tag.id, x: burstX, y: burstY });
      pushFloatingTagCheer(sequence, burstX, burstY, tag);

      if (!reducedMotion) {
        activeBurstsRef.current = activeBurstsRef.current
          .filter((activeBurst) => activeBurst.sourceId !== tag.id)
          .slice(-2);
        activeBurstsRef.current.push({
          sequence,
          sourceId: tag.id,
          centerX,
          centerY,
          startedAt: performance.now(),
          duration: 380,
          radius: Math.max(190, Math.min(340, Math.max(bounds.width, bounds.height) * 0.78)),
          strength: 0.96,
        });
      }
    } else {
      setBurst({ sequence, tagId: tag.id, x: 50, y: 50 });
      pushFloatingTagCheer(sequence, 50, 50, tag);
    }

    energizedTimerRef.current = window.setTimeout(() => {
      setEnergizedTagId((current) => (current === tag.id ? null : current));
    }, 620);

    burstTimerRef.current = window.setTimeout(() => {
      setBurst((current) => (current?.sequence === sequence ? null : current));
    }, 700);

  };

  const pushFloatingTagCheer = (sequence: number, x: number, y: number, tag: ScaledPlayerTag) => {
    const driftX = (seededUnit(`${tag.id}:${sequence}:cheer`) - 0.5) * 18;

    setCheers((current) => [...current.slice(-5), { sequence, x, y, driftX }]);

    const timer = window.setTimeout(() => {
      setCheers((current) => current.filter((item) => item.sequence !== sequence));
      cheerTimersRef.current = cheerTimersRef.current.filter((cheerTimer) => cheerTimer !== timer);
    }, 520);

    cheerTimersRef.current.push(timer);
  };

  return (
    <section className="section-panel profile-tag-panel" aria-labelledby="player-tag-heading">
      <div className="section-title compact">
        <div>
          <h2 id="player-tag-heading">选手应援标签</h2>
        </div>
      </div>
      {scaledTags.length > 0 ? (
        <div
          className={`floating-tag-field${burst !== null ? " is-bursting" : ""}`}
          ref={fieldRef}
          style={
            burst !== null
              ? cssVars({
                  "--burst-x": `${burst.x}%`,
                  "--burst-y": `${burst.y}%`,
                })
              : undefined
          }
          aria-label="已审核通过选手标签"
        >
          {burst !== null ? <span key={`${burst.tagId}:${burst.sequence}`} className="floating-tag-shockwave" aria-hidden="true" /> : null}
          {cheers.map((item) => (
            <span
              key={item.sequence}
              className="floating-tag-like-pop"
              style={cssVars({
                "--cheer-x": `${item.x}%`,
                "--cheer-y": `${item.y}%`,
                "--cheer-drift-mid": `${item.driftX * 0.45}px`,
                "--cheer-drift-end": `${item.driftX}px`,
              })}
              aria-hidden="true"
            >
              ❤️ +1
            </span>
          ))}
          {scaledTags.map((tag) => (
            <button
              key={tag.id}
              ref={(element) => {
                tagRefs.current[tag.id] = element;
              }}
              type="button"
              className={`floating-tag floating-tag-${tag.sizeLevel}${energizedTagId === tag.id ? " is-energized" : ""}`}
              style={cssVars({
                "--tag-heat": tag.heat,
                "--tag-ratio": tag.popularityRatio,
                "--tag-accent": tag.accentColor,
                "--tag-glow": tag.accentGlow,
                "--tag-width": `clamp(32px, ${tag.labelWidth}px, min(78vw, 300px))`,
                "--tag-height": `${tag.labelHeight}px`,
                "--tag-font": `clamp(12px, ${tag.textSize}px, min(11vw, 44px))`,
              })}
              title={tag.text}
              aria-label={`${tag.text}，播放应援效果`}
              onClick={() => energizeTag(tag)}
            >
              <span className="floating-tag-text">{tag.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState text="暂无" />
      )}
    </section>
  );
}

function applyFloatingTagBursts(
  bodies: FloatingTagBody[],
  activeBursts: FloatingTagActiveBurst[],
  time: number,
  delta: number,
): void {
  for (let burstIndex = activeBursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
    const burst = activeBursts[burstIndex];

    if (burst === undefined) {
      continue;
    }

    const progress = clampNumber((time - burst.startedAt) / burst.duration, 0, 1);

    if (progress >= 1) {
      activeBursts.splice(burstIndex, 1);
      continue;
    }

    const attack = progress < 0.18 ? progress / 0.18 : 1;
    const decay = Math.pow(1 - progress, 1.65);
    const force = burst.strength * attack * decay;

    if (force <= 0.015) {
      continue;
    }

    for (const body of bodies) {
      const bodyCenterX = body.x + body.width / 2;
      const bodyCenterY = body.y + body.height / 2;
      let dx = bodyCenterX - burst.centerX;
      let dy = bodyCenterY - burst.centerY;
      let distance = Math.hypot(dx, dy);

      if (distance < 1) {
        const angle = seededUnit(`${body.id}:${burst.sequence}:burst`) * Math.PI * 2;

        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      const nx = dx / distance;
      const ny = dy / distance;

      if (body.id === burst.sourceId) {
        continue;
      }

      const falloff = Math.pow(clampNumber(1 - distance / burst.radius, 0, 1), 1.18);

      if (falloff <= 0) {
        continue;
      }

      const impulse = force * falloff * delta;
      const swirlDirection = seededUnit(`${burst.sequence}:${body.id}:swirl`) > 0.5 ? 1 : -1;
      const swirl = impulse * 0.16 * swirlDirection;

      body.vx += nx * impulse - ny * swirl;
      body.vy += ny * impulse + nx * swirl;
      clampFloatingTagSpeed(body, 7.4);
    }
  }
}

const FLOATING_TAG_MAX_POPULARITY_RATIO = 20;
const FLOATING_TAG_BASE_TEXT_SIZE = 13;
const FLOATING_TAG_MAX_TEXT_SIZE = 44;
const FLOATING_TAG_TEXT_VERTICAL_PADDING = 12;
const FLOATING_TAG_TEXT_HORIZONTAL_PADDING = 20;
const FLOATING_TAG_CHARACTER_COLORS = [
  { color: "#ff6b8a", glow: "rgba(255, 107, 138, .46)" },
  { color: "#ffb347", glow: "rgba(255, 179, 71, .42)" },
  { color: "#66d9ff", glow: "rgba(102, 217, 255, .42)" },
  { color: "#a78bfa", glow: "rgba(167, 139, 250, .44)" },
  { color: "#f472b6", glow: "rgba(244, 114, 182, .44)" },
  { color: "#60a5fa", glow: "rgba(96, 165, 250, .42)" },
  { color: "#facc15", glow: "rgba(250, 204, 21, .38)" },
  { color: "#fb7185", glow: "rgba(251, 113, 133, .42)" },
  { color: "#c084fc", glow: "rgba(192, 132, 252, .42)" },
  { color: "#f97316", glow: "rgba(249, 115, 22, .38)" },
] as const;

type FloatingTagCharacterColor = (typeof FLOATING_TAG_CHARACTER_COLORS)[number];

function scalePlayerTags(tags: PlayerTag[]): ScaledPlayerTag[] {
  const positiveLikeCounts = tags.map((tag) => tag.likeCount).filter((likeCount) => likeCount > 0);
  const baselineLikeCount = positiveLikeCounts.length > 0 ? Math.min(...positiveLikeCounts) : 1;
  const rawRatios = tags.map((tag) => (tag.likeCount > 0 ? Math.max(1, tag.likeCount / baselineLikeCount) : 1));
  const maxRawRatio = Math.max(1, ...rawRatios);

  return tags.map((tag, index) => {
    const popularityRatio = normalizeFloatingTagPopularityRatio(rawRatios[index] ?? 1, maxRawRatio);
    const heat = (popularityRatio - 1) / (FLOATING_TAG_MAX_POPULARITY_RATIO - 1);
    const textSize = roundToTenth(
      FLOATING_TAG_BASE_TEXT_SIZE + (FLOATING_TAG_MAX_TEXT_SIZE - FLOATING_TAG_BASE_TEXT_SIZE) * heat,
    );
    const visualTextLength = Math.max(2, Array.from(tag.text).length);
    const labelWidth = Math.round(textSize * visualTextLength * 1.08 + FLOATING_TAG_TEXT_HORIZONTAL_PADDING);
    const labelHeight = Math.round(textSize * 1.18 + FLOATING_TAG_TEXT_VERTICAL_PADDING);
    const accentColor = floatingTagAccentColor(tag, index);

    return {
      ...tag,
      popularityRatio: roundToTenth(popularityRatio),
      labelWidth,
      labelHeight,
      textSize,
      heat: roundToTenth(heat),
      accentColor: accentColor.color,
      accentGlow: accentColor.glow,
    };
  });
}

function normalizeFloatingTagPopularityRatio(rawRatio: number, maxRawRatio: number): number {
  if (maxRawRatio <= FLOATING_TAG_MAX_POPULARITY_RATIO) {
    return clampNumber(rawRatio, 1, FLOATING_TAG_MAX_POPULARITY_RATIO);
  }

  if (rawRatio <= 1) {
    return 1;
  }

  const compressedRatio =
    1 +
    (FLOATING_TAG_MAX_POPULARITY_RATIO - 1) *
      (Math.log(rawRatio) / Math.log(maxRawRatio));

  return clampNumber(compressedRatio, 1, FLOATING_TAG_MAX_POPULARITY_RATIO);
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function floatingTagAccentColor(tag: PlayerTag, index: number): FloatingTagCharacterColor {
  const paletteIndex =
    (Math.floor(seededUnit(`${tag.id}:${tag.text}:accent`) * FLOATING_TAG_CHARACTER_COLORS.length) + index * 2) %
    FLOATING_TAG_CHARACTER_COLORS.length;

  return FLOATING_TAG_CHARACTER_COLORS[paletteIndex] ?? FLOATING_TAG_CHARACTER_COLORS[0];
}

function resolveFloatingTagCollisions(bodies: FloatingTagBody[]): void {
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    const left = bodies[leftIndex];

    if (left === undefined) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex += 1) {
      const right = bodies[rightIndex];

      if (right === undefined) {
        continue;
      }

      const leftCenterX = left.x + left.width / 2;
      const leftCenterY = left.y + left.height / 2;
      const rightCenterX = right.x + right.width / 2;
      const rightCenterY = right.y + right.height / 2;
      const dx = rightCenterX - leftCenterX;
      const dy = rightCenterY - leftCenterY;
      const distance = Math.hypot(dx, dy) || 1;
      const minDistance = Math.max(6, (left.radius + right.radius) * 0.68);

      if (distance >= minDistance) {
        continue;
      }

      const overlap = (minDistance - distance) / 2.6;
      const nx = dx / distance;
      const ny = dy / distance;

      left.x -= nx * overlap;
      left.y -= ny * overlap;
      right.x += nx * overlap;
      right.y += ny * overlap;

      const leftVelocity = left.vx * nx + left.vy * ny;
      const rightVelocity = right.vx * nx + right.vy * ny;
      const impulse = rightVelocity - leftVelocity;

      left.vx += impulse * nx * 0.64;
      left.vy += impulse * ny * 0.64;
      right.vx -= impulse * nx * 0.64;
      right.vy -= impulse * ny * 0.64;

      clampFloatingTagSpeed(left, 8.2);
      clampFloatingTagSpeed(right, 8.2);
    }
  }
}

function clampFloatingTagBodies(bodies: FloatingTagBody[], bounds: { width: number; height: number }): void {
  for (const body of bodies) {
    body.x = clampNumber(body.x, 0, Math.max(0, bounds.width - body.width));
    body.y = clampNumber(body.y, 0, Math.max(0, bounds.height - body.height));
  }
}

function clampFloatingTagSpeed(body: FloatingTagBody, maxSpeed: number): void {
  const speed = Math.hypot(body.vx, body.vy);

  if (speed <= maxSpeed || speed === 0) {
    return;
  }

  const scale = maxSpeed / speed;

  body.vx *= scale;
  body.vy *= scale;
}

function drawFloatingTagBodies(
  tagRefs: Record<string, HTMLButtonElement | null>,
  bodies: FloatingTagBody[],
): void {
  for (const body of bodies) {
    const element = tagRefs[body.id];

    if (element) {
      element.style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
    }
  }
}

function seededUnit(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10000) / 10000;
}

function StandingRow({
  row,
}: {
  row: {
    rank: number;
    team: string;
    score: string;
    points: string;
  };
}) {
  return (
    <div className="standing-row">
      <span className="rank">{row.rank}</span>
      <b>{row.team}</b>
      <span>{row.score}</span>
      <span>{row.points}</span>
    </div>
  );
}

function groupStandingRows(rows: StageView["standings"]): Array<{ key: string; label: string; rows: StageView["standings"] }> {
  const groups = new Map<string, { key: string; label: string; rows: StageView["standings"] }>();

  for (const row of rows) {
    const groupName = row.groupName?.trim() || "";
    const key = groupName || ungroupedStandingKey;
    const group = groups.get(key) ?? { key, label: groupName || "总榜", rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: [...group.rows].sort((left, right) => left.rank - right.rank),
  }));
}

function MatchSummary({ match }: { match: MatchData }) {
  const winner = match.winner === "radiant" ? match.radiant : match.dire;

  return (
    <section className="match-summary battle-summary">
      <div className="summary-meta">
        <span>比赛编号 {match.id}</span>
        <span>{match.endedAt}</span>
      </div>
      <p className="victory-label">{winner.name} 胜利</p>
      <div className="scoreboard">
        <div className="team-side radiant">
          <span>{match.radiant.seed}</span>
          <b>{match.radiant.name}</b>
          <small>天辉</small>
        </div>
        <div className="score-core">
          <p>{match.league}</p>
          <strong>
            {match.radiantScore}
            <i>:</i>
            {match.direScore}
          </strong>
          <span>
            {match.duration} · {match.mode}
          </span>
        </div>
        <div className="team-side dire">
          <span>{match.dire.seed}</span>
          <b>{match.dire.name}</b>
          <small>夜魇</small>
        </div>
      </div>
    </section>
  );
}

function MatchQuickStats({ match }: { match: MatchData }) {
  const radiantKills = match.players
    .filter((player) => player.side === "radiant")
    .reduce((sum, player) => sum + player.kills, 0);
  const direKills = match.players
    .filter((player) => player.side === "dire")
    .reduce((sum, player) => sum + player.kills, 0);

  return (
    <section className="match-ribbon">
      <span className="match-ribbon-stat duration">
        <b>{match.duration}</b>时长
      </span>
      <span className="match-ribbon-stat kill-score">
        <small>击杀</small>
        <b>
          <i className="radiant-score">{radiantKills}</i>
          <em>:</em>
          <i className="dire-score">{direKills}</i>
        </b>
      </span>
    </section>
  );
}

function MvpCard({ player, match }: { player: PlayerStats; match: MatchData }) {
  const team = getTeam(match, player.side);

  return (
    <section className={`mvp-card ${player.side}`}>
      <div className="mvp-copy">
        <p className="eyebrow">MVP</p>
        <h2>{player.name}</h2>
        <p>
          {player.hero} · {team.name}
        </p>
        <div className="mvp-stats">
          <span>
            <b>
              {player.kills}/{player.deaths}/{player.assists}
            </b>
            KDA
          </span>
          <span>
            <b>{player.participation}</b>参战
          </span>
          <span>
            <b>{player.damageShare}</b>伤害
          </span>
        </div>
        <div className="tag-strip">
          {player.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="mvp-visual">
        <ImageWithFallback
          className="mvp-portrait"
          src={player.portrait}
          fallback="/static/dota/heroes/unknown.svg"
          alt={player.hero}
        />
        <span>MVP</span>
      </div>
    </section>
  );
}

function TeamPanel({
  side,
  players,
  match,
  expandedPlayers,
  activeAwardKey,
  onAwardOpen,
  onPlayerToggle,
}: {
  side: TeamSide;
  players: PlayerStats[];
  match: MatchData;
  expandedPlayers: Set<string>;
  activeAwardKey: string | null;
  onAwardOpen: (award: MatchAward, target: HTMLElement) => void;
  onPlayerToggle: (playerId: string) => void;
}) {
  const team = getTeam(match, side);
  const kills = players.reduce((sum, player) => sum + player.kills, 0);
  const isWinner = match.winner === side;

  return (
    <div className={`team-panel ${side}`}>
      <div className="team-panel-head">
        <div>
          <span>
            {side === "radiant" ? "天辉" : "夜魇"} {isWinner ? "胜利" : "失败"}
          </span>
          <b>{team.name}</b>
        </div>
        <small>杀敌 {kills}</small>
      </div>
      <div className="player-list">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            expanded={expandedPlayers.has(player.id)}
            isMvp={player.id === match.mvpPlayerId}
            awards={match.awards.filter((award) => award.playerId === player.id)}
            activeAwardKey={activeAwardKey}
            onAwardOpen={onAwardOpen}
            onToggle={onPlayerToggle}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  expanded,
  isMvp,
  awards,
  activeAwardKey,
  onAwardOpen,
  onToggle,
}: {
  player: PlayerStats;
  expanded: boolean;
  isMvp: boolean;
  awards: MatchAward[];
  activeAwardKey: string | null;
  onAwardOpen: (award: MatchAward, target: HTMLElement) => void;
  onToggle: (playerId: string) => void;
}) {
  const abilitySteps = player.abilityOrder.filter((ability) => ability.kind === "ability");

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(player.id);
    }
  };

  return (
    <article
      className={`player-row ${player.side} ${expanded ? "expanded" : ""} ${isMvp ? "mvp-player" : ""}`}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onClick={() => onToggle(player.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="player-main">
        {isMvp ? <span className="player-mvp-badge">MVP</span> : null}
        <span className="hero-avatar-shell">
          <ImageWithFallback
            className="hero-avatar"
            src={player.portrait}
            fallback="/static/dota/heroes/unknown.svg"
            alt={player.hero}
          />
          <i>{player.level}</i>
        </span>
        <div className="player-id">
          <b>{player.name}</b>
          <span>{player.hero}</span>
          <div className="player-chips">
            <em>{player.lane}</em>
            <span className="player-mini-metrics">
              <small>参战 {player.participation}</small>
              <small>伤害 {player.damageShare}</small>
            </span>
          </div>
          {awards.length > 0 ? <PlayerAwardBadges awards={awards} activeAwardKey={activeAwardKey} onAwardOpen={onAwardOpen} /> : null}
        </div>
        <div className="player-kda">
          <b>
            {player.kills}/{player.deaths}/{player.assists}
          </b>
          <span>KDA {kdaRatio(player)}</span>
        </div>
        <PlayerLoadout player={player} />
      </div>
      {expanded ? (
        <div className="player-expanded">
          <div className="advanced-grid">
            <AdvancedMetric label="GPM" value={String(player.gpm)} />
            <AdvancedMetric label="XPM" value={String(player.xpm)} />
            <AdvancedMetric label="净值" value={player.netWorth} />
            <AdvancedMetric label="正反补" value={`${player.lastHits}/${player.denies}`} />
            <AdvancedMetric label="英雄伤害" value={player.heroDamage} />
            <AdvancedMetric label="建筑" value={player.towerDamage} />
            <AdvancedMetric label="治疗" value={player.healing} />
            <AdvancedMetric label="承伤" value={player.damageTaken} />
          </div>
          <div className="ability-order">
            {abilitySteps.length > 0 ? (
              abilitySteps.map((ability, index) => <AbilityStep key={`${ability.key ?? ability.label}:${index}`} ability={ability} index={index} />)
            ) : (
              <EmptyState text="暂无普通技能加点" />
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PlayerAwardBadges({
  awards,
  activeAwardKey,
  onAwardOpen,
}: {
  awards: MatchAward[];
  activeAwardKey: string | null;
  onAwardOpen: (award: MatchAward, target: HTMLElement) => void;
}) {
  return (
    <div
      className="player-awards"
      aria-label="本场称号"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {awards.map((award) => {
        const awardKey = `${award.code}:${award.playerId}`;
        const description = award.description.trim() || "暂无称号说明";
        const isActive = activeAwardKey === awardKey;

        const open = (target: HTMLElement) => onAwardOpen(award, target);

        return (
          <span
            aria-label={`${award.title}：${description}`}
            className={`player-award-title award-${award.code} ${isActive ? "active" : ""}`}
            key={awardKey}
            role="button"
            tabIndex={0}
            aria-expanded={isActive}
            onFocus={(event) => open(event.currentTarget)}
            onMouseEnter={(event) => open(event.currentTarget)}
            onClick={(event) => {
              event.stopPropagation();
              open(event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                open(event.currentTarget);
              }
            }}
          >
            {award.title}
          </span>
        );
      })}
    </div>
  );
}

function MatchAwardFloatingPopover({ popover }: { popover: MatchAwardPopover | null }) {
  if (!popover || typeof document === "undefined") {
    return null;
  }

  const description = popover.award.description.trim() || "暂无称号说明";

  return createPortal(
    <div
      className="player-award-tooltip"
      role="tooltip"
      style={cssVars({
        "--award-popover-left": `${popover.left}px`,
        "--award-popover-top": `${popover.top}px`,
      })}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <b>{popover.award.title}</b>
      <small>{description}</small>
    </div>,
    document.body,
  );
}

function PlayerLoadout({ player }: { player: PlayerStats }) {
  const itemSlots = Array.from({ length: 6 }, (_, index) => player.items[index] ?? emptyIcon);
  const backpackSlots = Array.from({ length: 3 }, (_, index) => player.backpackItems[index] ?? emptyIcon);

  return (
    <div className="player-loadout">
      <div className="inventory-stack">
        <div className="inventory-grid" aria-label="六格物品栏">
          {itemSlots.map((item, index) => (
            <ItemSlot key={index} item={item} slot={index + 1} />
          ))}
        </div>
        <div className="backpack-grid" aria-label="背包物品栏">
          {backpackSlots.map((item, index) => (
            <ItemSlot key={index} item={item} slot="backpack" />
          ))}
        </div>
      </div>
      <ItemSlot item={player.neutralItem} slot="neutral" />
      <div className="agha-status-row">
        <AghanimIcon label="神杖" state={player.scepter} />
        <AghanimIcon label="魔精" state={player.shard} />
      </div>
      <TalentTreeLegend player={player} />
    </div>
  );
}

function AbilityStep({ ability, index }: { ability: PlayerStats["abilityOrder"][number]; index: number }) {
  const level = ability.level ?? index + 1;
  const kind = ability.kind ?? "ability";
  const hasImage = Boolean(ability.imageUrl);

  return (
    <span className={`ability-step ${kind} ${hasImage ? "" : "fallback"}`} title={`${level}. ${ability.label}`}>
      {hasImage ? (
        <img
          src={ability.imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add("fallback");
          }}
        />
      ) : (
        <AbilityFallbackGlyph kind={kind} />
      )}
      <b>{level}</b>
    </span>
  );
}

function ItemSlot({ item, slot }: { item: IconRef; slot: number | "neutral" | "backpack" }) {
  const empty = item.label === "-" || item.label === "空";

  return (
    <span
      className={`item-slot ${slot === "neutral" ? "neutral" : ""} ${slot === "backpack" ? "backpack" : ""} ${empty ? "empty" : ""}`}
      title={item.label}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add("empty");
          }}
        />
      ) : null}
    </span>
  );
}

function AdvancedMetric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function AghanimIcon({ label, state }: { label: string; state: AghanimState }) {
  const title = state === "owned" ? "已拥有" : state === "queued" ? "待购买" : "未购买";
  const type = label.includes("晶") || label.includes("精") ? "shard" : "scepter";
  const filename = `${type}${state === "owned" ? "On" : "Off"}.svg`;

  return (
    <img
      className={`agha-icon ${type} ${state}`}
      src={`/static/svg/${filename}`}
      alt={label}
      title={`${label} ${title}`}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

function TalentTreeLegend({ player }: { player: PlayerStats }) {
  const pickedCount = player.talentTree.filter((node) => node.picked).length;
  const title = pickedCount > 0 ? `天赋树 已选择 ${pickedCount}/8` : "天赋树 暂无可识别选择";

  return (
    <span className="talent-tree-mini" title={title}>
      <TalentTreeSvg player={player} />
    </span>
  );
}

function TalentTreeSvg({ player }: { player: PlayerStats }) {
  const prefix = `talent-${String(player.id).replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`;
  const nodes = player.talentTree.length > 0 ? player.talentTree : defaultTalentTreeNodes();
  const pickedCount = nodes.filter((node) => node.picked).length;

  return (
    <svg className="talent-tree-svg" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${prefix}-copper-left`} gradientUnits="userSpaceOnUse" x1="4.68" y1="3.66" x2="35.93" y2="57.79">
          <stop offset="0.0938" stopColor="rgb(231, 189, 118)" />
          <stop offset="0.2261" stopColor="rgb(201, 108, 53)" />
          <stop offset="0.4401" stopColor="rgb(207, 126, 65)" />
          <stop offset="0.5891" stopColor="rgb(215, 148, 84)" />
          <stop offset="0.7585" stopColor="rgb(229, 185, 114)" />
          <stop offset="1" stopColor="rgb(242, 214, 139)" />
        </linearGradient>
        <linearGradient
          id={`${prefix}-copper-right`}
          gradientUnits="userSpaceOnUse"
          x1="-7.88"
          y1="3.66"
          x2="23.37"
          y2="57.79"
          gradientTransform="matrix(-1 0 0 1 38.4375 0)"
        >
          <stop offset="0.0938" stopColor="rgb(231, 189, 118)" />
          <stop offset="0.2261" stopColor="rgb(201, 108, 53)" />
          <stop offset="0.4401" stopColor="rgb(207, 126, 65)" />
          <stop offset="0.5891" stopColor="rgb(215, 148, 84)" />
          <stop offset="0.7585" stopColor="rgb(229, 185, 114)" />
          <stop offset="1" stopColor="rgb(242, 214, 139)" />
        </linearGradient>
        <linearGradient id={`${prefix}-copper-dot`} gradientUnits="userSpaceOnUse" x1="3" y1="22" x2="27" y2="31">
          <stop offset="0.1257" stopColor="rgb(231, 189, 118)" />
          <stop offset="0.3335" stopColor="rgb(204, 117, 59)" />
          <stop offset="0.8908" stopColor="rgb(201, 109, 52)" />
          <stop offset="0.9891" stopColor="rgb(229, 185, 114)" />
        </linearGradient>
      </defs>
      <svg viewBox="0 0 51 63" height="23" y="4.45" className="talent-branch-copy" preserveAspectRatio="xMidYMin meet">
        {nodes
          .filter((node) => !node.picked)
          .map((node) => (
            <TalentBranchPath key={`${node.tier}:${node.side}:off`} node={node} prefix={prefix} />
          ))}
        {nodes
          .filter((node) => node.picked)
          .map((node) => (
            <TalentBranchPath key={`${node.tier}:${node.side}:on`} node={node} prefix={prefix} />
          ))}
      </svg>
      <TalentTreeArc prefix={prefix} pickedCount={pickedCount} />
    </svg>
  );
}

function TalentBranchPath({ node, prefix }: { node: PlayerStats["talentTree"][number]; prefix: string }) {
  const title = `${node.tier === 1 ? "10" : node.tier === 2 ? "15" : node.tier === 3 ? "20" : "25"}级天赋${
    node.picked ? " 已选择" : ""
  }`;
  const fill = node.picked ? `url(#${prefix}-copper-${node.side})` : "hsl(0,0%,28%)";

  return (
    <path className={`talent-branch ${node.picked ? "picked" : "off"}`} fill={fill} d={talentBranchPath(node.tier, node.side)}>
      <title>{title}</title>
    </path>
  );
}

function TalentTreeArc({ prefix, pickedCount }: { prefix: string; pickedCount: number }) {
  const activeDots = clampNumber(pickedCount, 0, 7);

  return (
    <>
      {talentArcDots.map((path, index) => (
        <path
          key={path}
          className={`talent-arc-dot ${index < activeDots ? "picked" : ""}`}
          fill={index < activeDots ? `url(#${prefix}-copper-dot)` : "hsla(0,0%,100%,0.12)"}
          d={path}
        />
      ))}
      <path
        className="talent-arc"
        d="M1.974 21.886a15.733 15.733 0 01-1.307-6.302C.667 6.983 7.537 0 16 0c8.463 0 15.333 6.983 15.333 15.584 0 2.226-.46 4.343-1.288 6.259a3.35 3.35 0 00-.942-.549 14.626 14.626 0 001.152-5.71c0-7.996-6.387-14.488-14.255-14.488-7.867 0-14.255 6.492-14.255 14.488 0 2.042.417 3.986 1.169 5.75a3.36 3.36 0 00-.94.552z"
      />
    </>
  );
}

function AbilityFallbackGlyph({ kind }: { kind: PlayerStats["abilityOrder"][number]["kind"] }) {
  if (kind === "attribute") {
    return (
      <svg className="ability-fallback-svg attribute-glyph" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" />
        <circle cx="16" cy="5" r="2" />
        <circle cx="24" cy="9" r="2" />
        <circle cx="27" cy="18" r="2" />
        <circle cx="20" cy="26" r="2" />
        <circle cx="10" cy="26" r="2" />
        <circle cx="5" cy="17" r="2" />
        <circle cx="8" cy="9" r="2" />
      </svg>
    );
  }

  return (
    <svg className="ability-fallback-svg talent-glyph" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 29V7" />
      <path d="M16 21C11 21 8 18 6 14" />
      <path d="M16 18c5 0 8-3 10-8" />
      <path d="M16 12c-3 0-5-2-6-6" />
      <path d="M16 10c3 0 5-2 6-6" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="6" cy="14" r="2" />
      <circle cx="26" cy="10" r="2" />
      <circle cx="16" cy="29" r="2" />
    </svg>
  );
}

function DraftSection({ match }: { match: MatchData }) {
  return (
    <section className="section-panel">
      <div className="section-title compact">
        <div>
          <h2>Ban / Pick 顺序</h2>
        </div>
      </div>
      <DraftTimeline draft={match.draft} />
    </section>
  );
}

function DraftTimeline({ draft }: { draft: DraftStep[] }) {
  if (draft.length === 0) {
    return <EmptyState text="暂无" />;
  }

  return (
    <div className="draft-timeline">
      {draft
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => (
          <DraftStepCard key={`${step.order}:${step.hero}:${step.type}`} step={step} />
        ))}
    </div>
  );
}

function DraftStepCard({ step }: { step: DraftStep }) {
  const actionText = step.type === "Ban" ? "禁用" : "选择";
  const portrait = step.portrait ?? "/static/dota/heroes/unknown.svg";

  return (
    <div className={`draft-step ${step.side} ${step.type.toLowerCase()}`}>
      <span className="draft-order">{step.order}</span>
      <article className="draft-card">
        <ImageWithFallback
          className="draft-hero"
          src={portrait}
          fallback="/static/dota/heroes/unknown.svg"
          alt={step.hero}
          loading="lazy"
        />
        <div className="draft-copy">
          <div>
            <b>{step.hero}</b>
            <span>{step.actor}</span>
          </div>
          <em>{actionText}</em>
        </div>
      </article>
    </div>
  );
}

function WardTimeline({
  match,
  selectedSecond,
  onChange,
}: {
  match: MatchData;
  selectedSecond: number;
  onChange: (seconds: number) => void;
}) {
  const rangeRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const mapEvents = useMemo(
    () =>
      match.wardTimeline
        .filter((event) => event.x !== null && event.y !== null)
        .slice()
        .sort((a, b) => a.timeSeconds - b.timeSeconds),
    [match.wardTimeline],
  );
  const maxSecond = getWardTimelineMaxSecond(match);
  const safeSelectedSecond = clampNumber(selectedSecond, 0, maxSecond);
  const selectedProgress = maxSecond > 0 ? (safeSelectedSecond / maxSecond) * 100 : 0;
  const activeEvents = mapEvents.filter((event) => isWardVisibleAt(event, safeSelectedSecond));
  const markerEvents = uniqueWardEvents(mapEvents);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const range = rangeRef.current;

      if (!range) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : clampNumber((clientX - rect.left) / rect.width, 0, 1);
      const stepped = Math.round((ratio * maxSecond) / 15) * 15;
      onChange(clampNumber(stepped, 0, maxSecond));
    },
    [maxSecond, onChange],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      event.preventDefault();
      updateFromClientX(event.clientX);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragging(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 60 : 15;
    let nextSecond: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextSecond = safeSelectedSecond + step;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextSecond = safeSelectedSecond - step;
    } else if (event.key === "Home") {
      nextSecond = 0;
    } else if (event.key === "End") {
      nextSecond = maxSecond;
    }

    if (nextSecond !== null) {
      event.preventDefault();
      onChange(clampNumber(nextSecond, 0, maxSecond));
    }
  };

  return (
    <div className="vision-timeline">
      <div className="vision-board">
        <div className="vision-map" aria-label="眼位小地图时间轴">
          <img src="/static/dota/wards/minimap/minimap_game.png" alt="" loading="lazy" />
          {markerEvents.map((event, index) => (
            <WardMapDot key={`${event.timeSeconds}:${event.side}:${event.type}:${event.x}:${event.y}:${index}`} event={event} selectedSecond={safeSelectedSecond} />
          ))}
        </div>
        <div className="vision-hud">
          <span className="vision-chip radiant">天辉 {activeEvents.filter((event) => event.side === "radiant").length}</span>
          <span className="vision-chip dire">夜魇 {activeEvents.filter((event) => event.side === "dire").length}</span>
          <span className="vision-clock">{formatWardClock(safeSelectedSecond)}</span>
        </div>
      </div>
      <div className="vision-scrubber">
        <div
          className="vision-range"
          role="slider"
          tabIndex={0}
          ref={rangeRef}
          style={cssVars({ "--ward-progress": `${clampNumber(selectedProgress, 0, 100).toFixed(2)}%` })}
          aria-valuemin={0}
          aria-valuemax={maxSecond}
          aria-valuenow={safeSelectedSecond}
          aria-valuetext={formatWardClock(safeSelectedSecond)}
          aria-label="选择眼位时间点"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={handleKeyDown}
        />
        <div className="vision-scale">
          <span>0:00</span>
          <b>{activeEvents.length} 眼位</b>
          <span>{formatWardClock(maxSecond)}</span>
        </div>
      </div>
    </div>
  );
}

function WardMapDot({
  event,
  selectedSecond,
}: {
  event: MatchData["wardTimeline"][number];
  selectedSecond: number;
}) {
  const x = event.x ?? 128;
  const y = event.y ?? 128;
  const left = clampNumber((x / 255) * 100, 4, 96);
  const top = clampNumber(100 - (y / 255) * 100, 4, 96);
  const isActive = isWardVisibleAt(event, selectedSecond);
  const icon = event.type === "岗哨守卫" ? "sentry" : "observer";
  const displayType = wardDisplayType(event);

  return (
    <span
      role="img"
      className={`ward-marker ${event.side} ${icon} ${isActive ? "active" : ""}`}
      style={{ left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` }}
      title={`${event.time} ${displayType} ${event.note}`}
      aria-label={`${event.time} ${event.side === "radiant" ? "天辉" : "夜魇"} ${displayType}`}
    />
  );
}

function TrendSection({ match }: { match: MatchData }) {
  if (!match.trends.hasTrends) {
    return <EmptyState text="暂无" />;
  }

  return (
    <>
      <div className="trend-grid">
        <AdvantageTrendGraph match={match} />
        <PlayerGoldTrendGraph match={match} />
      </div>
      <ComparisonBars match={match} />
    </>
  );
}

function AdvantageTrendGraph({ match }: { match: MatchData }) {
  const gold = sampleTrend(match.trends.goldAdvantage, 44);
  const xp = sampleTrend(match.trends.xpAdvantage, 44);
  const lastGold = match.trends.goldAdvantage[match.trends.goldAdvantage.length - 1];
  const lastXp = match.trends.xpAdvantage[match.trends.xpAdvantage.length - 1];
  const maxAbs = Math.max(1, ...gold.map((point) => Math.abs(point.value)), ...xp.map((point) => Math.abs(point.value)));

  if (gold.length === 0 && xp.length === 0) {
    return (
      <div className="trend-card">
        <EmptyState text="暂无" />
      </div>
    );
  }

  return (
    <div className="trend-card trend-card-wide">
      <div className="trend-card-head">
        <b>经济 / 经验差</b>
        <span>
          经济 {formatTrendValue(lastGold?.value ?? 0)} · 经验 {formatTrendValue(lastXp?.value ?? 0)}
        </span>
      </div>
      <svg viewBox="0 0 280 112" role="img" aria-label="经济和经验差曲线">
        <TrendGridLines width={280} height={112} />
        <line x1="10" y1="56" x2="270" y2="56" className="trend-axis" />
        {gold.length > 0 ? <polyline points={trendPolyline(gold, { maxAbs, width: 280, height: 112 })} className="trend-poly gold" /> : null}
        {xp.length > 0 ? <polyline points={trendPolyline(xp, { maxAbs, width: 280, height: 112 })} className="trend-poly xp" /> : null}
      </svg>
      <div className="trend-legend">
        <span>
          <i className="trend-dot gold" />经济差
        </span>
        <span>
          <i className="trend-dot xp" />经验差
        </span>
      </div>
      <div className="trend-scale">
        <span>{`${Math.min(gold[0]?.minute ?? 0, xp[0]?.minute ?? 0)}m`}</span>
        <span>{`±${compactNumber(maxAbs)}`}</span>
        <span>{`${Math.max(lastGold?.minute ?? 0, lastXp?.minute ?? 0)}m`}</span>
      </div>
    </div>
  );
}

function PlayerGoldTrendGraph({ match }: { match: MatchData }) {
  const trends = match.trends.playerGold
    .filter((trend) => trend.values.length > 0)
    .slice()
    .sort((left, right) => left.playerSlot - right.playerSlot);
  const maxGold = Math.max(1, ...trends.flatMap((trend) => trend.values));

  if (trends.length === 0) {
    return null;
  }

  return (
    <div className="trend-card trend-card-wide">
      <div className="trend-card-head">
        <b>选手经济曲线</b>
        <span>{trends.length} 名选手</span>
      </div>
      <svg viewBox="0 0 280 128" role="img" aria-label="所有选手经济曲线">
        <TrendGridLines width={280} height={128} />
        {trends.map((trend, index) => (
          <polyline
            key={`${trend.playerSlot}:${trend.playerName}`}
            points={playerTrendPolyline(trend.values, maxGold, 280, 128)}
            className="player-trend-line"
            style={cssVars({ "--trend-color": playerTrendColor(index, trend.side) })}
          />
        ))}
      </svg>
      <div className="trend-player-legend">
        {trends.map((trend, index) => (
          <span className={trend.side} key={`${trend.playerSlot}:${trend.playerName}`}>
            <i style={{ background: playerTrendColor(index, trend.side) }} />
            <b>{playerTrendHeroName(match, trend)}</b>
            <small>{compactNumber(trend.values[trend.values.length - 1] ?? 0)}</small>
          </span>
        ))}
      </div>
      <div className="trend-scale">
        <span>0m</span>
        <span>{compactNumber(maxGold)}</span>
        <span>{`${Math.max(...trends.map((trend) => trend.values.length - 1))}m`}</span>
      </div>
    </div>
  );
}

function TrendGridLines({ width, height }: { width: number; height: number }) {
  const top = 10;
  const middle = height / 2;
  const bottom = height - 10;

  return (
    <>
      <line x1="10" y1={top} x2={width - 10} y2={top} className="trend-grid-line" />
      <line x1="10" y1={middle} x2={width - 10} y2={middle} className="trend-grid-line muted" />
      <line x1="10" y1={bottom} x2={width - 10} y2={bottom} className="trend-grid-line" />
    </>
  );
}

function ComparisonBars({ match }: { match: MatchData }) {
  if (match.comparisons.length === 0) {
    return null;
  }

  return (
    <div className="comparison-list">
      {match.comparisons.map((metric) => {
        const share = clampNumber(metric.radiantShare, 0.08, 0.92);

        return (
          <div className="comparison-row" key={metric.key}>
            <span>{metric.label}</span>
            <div>
              <i className="comparison-fill radiant" style={{ width: `${(share * 100).toFixed(1)}%` }} />
              <i className="comparison-fill dire" style={{ width: `${((1 - share) * 100).toFixed(1)}%` }} />
            </div>
            <small>
              {compactNumber(metric.radiantValue)} / {compactNumber(metric.direValue)}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function ChatLine({
  line,
}: {
  line: {
    time: string;
    side: TeamSide;
    player: string;
    hero: string;
    text: string;
  };
}) {
  return (
    <div className={`chat-line ${line.side}`}>
      <span>{line.time}</span>
      <b>{line.player}</b>
      <small>{line.hero}</small>
      <p>{line.text}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  void text;

  return <div className="empty-state">暂无</div>;
}

function ImageWithFallback({
  src,
  fallback,
  alt,
  className,
  loading,
}: {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <img
      className={className}
      src={currentSrc}
      alt={alt}
      loading={loading}
      onError={() => {
        if (currentSrc !== fallback) {
          setCurrentSrc(fallback);
        }
      }}
    />
  );
}

function profileMatchToRecord(match: ProfileMatchSummary, tournamentName = ""): MatchRecord {
  const [fallbackRadiantScore, fallbackDireScore] = parseProfileScore(match.score);
  const radiantScore = match.radiantScore ?? fallbackRadiantScore;
  const direScore = match.direScore ?? fallbackDireScore;
  const radiantWin =
    match.radiantWin ??
    (match.side === null || match.result === "unknown"
      ? null
      : match.side === "radiant"
        ? match.result === "win"
        : match.result === "loss");

  return {
    matchId: match.matchId,
    leagueName: "",
    tournamentName,
    startTime: match.startTime,
    duration: match.duration,
    radiantTeamName: match.radiantTeamName,
    direTeamName: match.direTeamName,
    radiantScore,
    direScore,
    radiantWin,
    parseStatus: "比赛记录",
    playerCount: match.playerCount,
    heroLineups: match.heroLineups,
    hasDraft: match.hasDraft,
    hasVision: match.hasVision,
    hasChat: match.hasChat,
  };
}

function parseProfileScore(score: string): [number | null, number | null] {
  const parts = score.split(":");
  const left = Number(parts[0]?.trim() ?? "");
  const right = Number(parts[1]?.trim() ?? "");

  return [Number.isFinite(left) ? left : null, Number.isFinite(right) ? right : null];
}

function sortTournamentPlayers(
  players: PlayerDirectoryItem[],
  sortKey: PlayerSortKey,
  direction: SortDirection,
): PlayerDirectoryItem[] {
  return [...players].sort((left, right) => comparePlayers(left, right, sortKey, direction));
}

function comparePlayers(
  left: PlayerDirectoryItem,
  right: PlayerDirectoryItem,
  key: PlayerSortKey,
  direction: SortDirection,
): number {
  if (key === "displayName") {
    const result = left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
    return direction === "asc" ? result : -result;
  }

  const leftValue = numericStatValue(left, key);
  const rightValue = numericStatValue(right, key);

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

function numericStatValue(player: PlayerDirectoryItem, key: PlayerSortKey): number | null {
  switch (key) {
    case "totalMatches":
      return player.stats.totalMatches;
    case "winRate":
      return parseStatNumber(player.stats.winRate);
    case "kda":
      return parseStatNumber(player.stats.kda);
    case "avgKills":
      return parseStatNumber(player.stats.avgKills);
    case "avgGpm":
      return parseStatNumber(player.stats.avgGpm);
    case "avgXpm":
      return parseStatNumber(player.stats.avgXpm);
    case "avgHeroDamage":
      return parseStatNumber(player.stats.avgHeroDamage);
    case "avgTowerDamage":
      return parseStatNumber(player.stats.avgTowerDamage);
    case "avgDamageTaken":
      return parseStatNumber(player.stats.avgDamageTaken);
    case "displayName":
      return null;
  }
}

function parseStatNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0 || normalized === "-") {
    return null;
  }

  const multiplier = normalized.endsWith("k") ? 1000 : 1;
  const parsed = Number.parseFloat(normalized.replace(/[%k,]/g, ""));

  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function formatHeroWinRate(wins: number, picks: number): string {
  if (picks <= 0) {
    return "-";
  }

  return `${Math.round((wins / picks) * 100)}%`;
}

function getTeam(match: MatchData, side: TeamSide) {
  return side === "radiant" ? match.radiant : match.dire;
}

function emptyMobileData(): MobileData {
  return {
      apiBaseUrl: defaultApiBaseUrl,
      source: "unavailable",
      selectedTournamentId: "",
      selectedTournamentName: "MRJZ",
      selectedTournamentMeta: {
        status: "unknown",
        statusText: "--",
        startsAt: "时间待定",
        endsAt: "时间待定",
        leagueId: "-",
    },
    tournamentOptions: [],
    tournamentStats: [],
    officialStageKeys: [],
    stageViews: emptyStageViews(),
    scheduleGroups: [],
    officialSchedule: {
      status: "unconfigured",
      isPublished: false,
      rosterLocked: false,
      publishedAt: null,
      withdrawnAt: null,
    },
    matchRecords: [],
    tournamentRecentRecords: {},
    acknowledgements: [],
    heroLeaderboards: {
      tournamentId: "",
      tournamentName: "MRJZ",
      basis: "per_match",
      minMatches: 5,
      leaderboards: [],
    },
    players: [],
    teams: [],
    featuredMatch: emptyMatchData(),
    notice: null,
  };
}

function emptyStageViews(): MobileData["stageViews"] {
  return {
    group: {
      key: "group",
      name: "小组赛",
      status: "暂无",
      currentRound: "暂无",
      note: "",
      standings: [],
      bracket: [],
    },
    swiss: {
      key: "swiss",
      name: "瑞士轮",
      status: "暂无",
      currentRound: "暂无",
      note: "",
      standings: [],
      bracket: [],
    },
    knockout: {
      key: "knockout",
      name: "淘汰赛",
      status: "暂无",
      currentRound: "暂无",
      note: "",
      standings: [],
      bracket: [],
    },
  };
}

function emptyMatchData(): MatchData {
  return {
    id: "-",
    league: "MRJZ",
    series: "",
    mode: "未知模式",
    endedAt: "时间待定",
    duration: "--:--",
    radiantScore: 0,
    direScore: 0,
    winner: "radiant",
    radiant: { side: "radiant", name: "天辉", shortName: "天辉", seed: "天辉", color: "#78d66c" },
    dire: { side: "dire", name: "夜魇", shortName: "夜魇", seed: "夜魇", color: "#ef6467" },
    mvpPlayerId: "",
    parseStatus: "暂无",
    players: [],
    draft: [],
    wardTimeline: [],
    trends: {
      hasTrends: false,
      goldAdvantage: [],
      xpAdvantage: [],
      playerGold: [],
      playerXp: [],
    },
    comparisons: [],
    awards: [],
    chat: [],
  };
}

function routeLabel(route: AppRoute): string {
  if (route === "player") {
    return "选手主页";
  }

  if (route === "team") {
    return "队伍主页";
  }

  return routeOptions.find((option) => option.key === route)?.label ?? "MRJZ";
}

function statusClass(status: string): string {
  if (status === "已完赛" || status === "晋级区" || status === "completed") {
    return "green";
  }
  if (status === "延期" || status === "淘汰区" || status === "archived") {
    return "red";
  }
  if (status === "待补录" || status === "running") {
    return "blue";
  }
  return "";
}

function lifecycleLabel(status: string): string {
  const text: Record<string, string> = {
    draft: "草稿",
    upcoming: "未开赛",
    running: "进行中",
    completed: "已结束",
    archived: "归档",
    unknown: "未知",
  };

  return text[status] ?? status;
}

function officialScheduleStatusText(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "withdrawn":
      return "已撤回";
    case "published":
      return "已发布";
    case "unconfigured":
      return "未配置";
    default:
      return status;
  }
}

function activePrimaryNavRoute(route: AppRoute): AppRoute {
  if (route === "player") {
    return "players";
  }

  if (route === "team") {
    return "teams";
  }

  return route;
}

function readRouteFromHash(): AppRoute {
  const rawRoute = window.location.hash.replace("#", "").split("/")[0];
  if (rawRoute === "tags") {
    return "players";
  }
  return isRoute(rawRoute) ? rawRoute : "home";
}

function readProfileIdFromHash(): string | null {
  const [, rawProfileId] = window.location.hash.replace("#", "").split("/");

  return rawProfileId ? decodeURIComponent(rawProfileId) : null;
}

function isRoute(value: string | undefined): value is AppRoute {
  return Boolean(value && routeSet.has(value as AppRoute));
}

function isStage(value: string | undefined): value is StageKey {
  return Boolean(value && stageSet.has(value as StageKey));
}

function isPlayerSortKey(value: string | undefined): value is PlayerSortKey {
  return Boolean(value && playerSortKeySet.has(value as PlayerSortKey));
}

function getWardTimelineMaxSecond(match: MatchData): number {
  const durationSeconds = parseClockText(match.duration);
  const lastWardSecond = Math.max(0, ...match.wardTimeline.map((event) => event.timeSeconds));

  return Math.max(600, durationSeconds, lastWardSecond + 120);
}

function getWardScrubberSecond(match: MatchData, scrubberSeconds: Record<string, number>): number {
  const maxSecond = getWardTimelineMaxSecond(match);
  const storedSecond = scrubberSeconds[match.id];

  if (storedSecond !== undefined) {
    return Math.round(clampNumber(storedSecond, 0, maxSecond));
  }

  return 0;
}

function isWardVisibleAt(event: MatchData["wardTimeline"][number], selectedSecond: number): boolean {
  return event.timeSeconds <= selectedSecond && selectedSecond <= wardExpiresAt(event);
}

function wardExpiresAt(event: MatchData["wardTimeline"][number]): number {
  const lifetime = event.type === "岗哨守卫" ? 420 : 360;

  return event.removedAt !== null && event.removedAt > event.timeSeconds ? event.removedAt : event.timeSeconds + lifetime;
}

function wardDisplayType(event: MatchData["wardTimeline"][number]): string {
  return event.type === "岗哨守卫" ? "真眼" : "假眼";
}

function uniqueWardEvents(events: MatchData["wardTimeline"]): MatchData["wardTimeline"] {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = `${event.timeSeconds}:${event.side}:${event.type}:${event.x}:${event.y}:${event.note}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseClockText(value: string | null | undefined): number {
  const parts = String(value ?? "")
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 60 + parts[1]!);
  }

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  }

  return 0;
}

function formatWardClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sampleTrend(points: MatchData["trends"]["goldAdvantage"], targetCount: number) {
  if (points.length <= targetCount) {
    return points;
  }

  const step = (points.length - 1) / (targetCount - 1);

  return Array.from({ length: targetCount }, (_, index) => points[Math.round(index * step)]).filter(
    (point): point is MatchData["trends"]["goldAdvantage"][number] => point !== undefined,
  );
}

function trendPolyline(
  points: MatchData["trends"]["goldAdvantage"],
  options: { maxAbs: number; width: number; height: number },
): string {
  const { maxAbs, width, height } = options;
  const padding = 8;
  const denominator = Math.max(1, points.length - 1);

  return points
    .map((point, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height / 2 - (point.value / maxAbs) * (height / 2 - padding);

      return `${x.toFixed(1)},${clampNumber(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

function playerTrendPolyline(values: number[], maxValue: number, width: number, height: number): string {
  const padding = 8;
  const denominator = Math.max(1, values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height - padding - (value / maxValue) * (height - padding * 2);

      return `${x.toFixed(1)},${clampNumber(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

function playerTrendHeroName(match: MatchData, trend: MatchData["trends"]["playerGold"][number]): string {
  return match.players.find((player) => player.id === String(trend.playerSlot))?.hero ?? trend.playerName;
}

function playerTrendColor(index: number, side: TeamSide): string {
  const radiantColors = ["#75e06c", "#9fe870", "#45d1a4", "#54c7ff", "#d6f06b"];
  const direColors = ["#ff646d", "#ff9b5f", "#d96bff", "#ff5fb7", "#f0c36a"];
  const palette = side === "radiant" ? radiantColors : direColors;

  return palette[index % palette.length]!;
}

function formatTrendValue(value: number): string {
  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${compactNumber(value)}`;
}

function leaderboardTeamName(candidate: HeroLeaderboardCandidate): string {
  const team = candidate.player.currentTeam ?? candidate.player.teams[0] ?? null;

  return team?.name || team?.shortName || "自由人";
}

function formatLeaderboardValue(value: number, board: Pick<HeroLeaderboardItem, "precision" | "unit">): string {
  const normalized = Math.abs(value) >= 1000 ? compactNumber(value) : trimFixed(value, board.precision);

  return board.unit ? `${normalized}${board.unit}` : normalized;
}

function formatLeaderboardTotal(value: number, board: Pick<HeroLeaderboardItem, "precision" | "unit">): string {
  const normalized = Math.abs(value) >= 1000 ? compactNumber(value) : trimFixed(value, Math.min(board.precision, 1));

  return board.unit ? `${normalized}${board.unit}` : normalized;
}

function trimFixed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1000) {
    return `${(value / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  }

  return String(Math.round(value));
}

function kdaRatio(player: PlayerStats): string {
  if (player.deaths === 0) {
    return String(player.kills + player.assists);
  }

  return ((player.kills + player.assists) / player.deaths).toFixed(1);
}

function defaultTalentTreeNodes(): PlayerStats["talentTree"] {
  return ([4, 3, 2, 1] as const).flatMap((tier) =>
    (["left", "right"] as const).map((side) => ({
      tier,
      side,
      picked: false,
      label: "天赋",
    })),
  );
}

function talentBranchPath(
  tier: PlayerStats["talentTree"][number]["tier"],
  side: PlayerStats["talentTree"][number]["side"],
): string {
  const paths: Record<string, string> = {
    "1-left":
      "M0.013,44.716c0,0,6.586,6.584,9.823,6.805c3.236,0.224,7.033,0,7.033,0s7.024,1.732,7.024,7.368V63 l3.195-0.014c0,0,0-3.782,0-5.571c0-6.857-10.053-7.567-10.053-7.567S11.957,41.979,0.013,44.716z",
    "1-right":
      "M51,44.716c0,0-6.586,6.584-9.823,6.805c-3.235,0.224-7.032,0-7.032,0s-7.024,1.732-7.024,7.368V63 l-3.195-0.014c0,0,0-3.782,0-5.571c0-6.857,10.052-7.567,10.052-7.567S39.057,41.979,51,44.716z",
    "2-left":
      "M0,30.326c0,0,5.744,9.07,9.516,9.495c3.1,0.348,6.542,0.107,8.122,0.262 c3.068,0.301,6.256,1.351,6.256,5.667V63h3.181c0,0,0-17.488,0-18.454c0-0.964-0.006-5.235-7.093-6.584 c-1.207-0.232-3.687-0.281-4.913-0.281C15.068,37.681,10.547,29.951,0,30.326z",
    "2-right":
      "M51,30.326c0,0-5.745,9.07-9.517,9.495c-3.1,0.348-6.542,0.107-8.12,0.262 c-3.069,0.301-6.257,1.351-6.257,5.667V63h-3.182c0,0,0-17.488,0-18.454c0-0.964,0.006-5.235,7.093-6.584 c1.208-0.232,3.688-0.281,4.913-0.281C35.931,37.681,40.451,29.951,51,30.326z",
    "3-left":
      "M4.031,16.042c0,0,0.669,3.435,2.899,6.315c2.232,2.878,4.147,4.891,6.489,4.891 c2.344,0,6.208-0.01,7.68,0.868c1.837,1.095,2.803,3.213,2.803,5.373c0,0.976,0,29.511,0,29.511h3.173V33.489 c0,0-0.085-3.859-3.102-6.426c-1.651-1.405-2.911-2.141-5.294-2.141c-0.908,0-2.041-0.019-2.041-0.019s-1.785-4.153-5.188-6.203 C8.046,16.651,4.031,16.042,4.031,16.042z",
    "3-right":
      "M46.969,16.042c0,0-0.669,3.435-2.898,6.315c-2.232,2.878-4.147,4.891-6.489,4.891 c-2.344,0-6.208-0.01-7.68,0.868c-1.837,1.095-2.803,3.213-2.803,5.373c0,0.976,0,29.511,0,29.511h-3.174V33.489 c0,0,0.086-3.859,3.103-6.426c1.651-1.405,2.911-2.141,5.295-2.141c0.907,0,2.041-0.019,2.041-0.019s1.785-4.153,5.187-6.203 C42.954,16.651,46.969,16.042,46.969,16.042z",
    "4-left":
      "M11.033,0c0,0-0.802,7.891,2.625,11.654c3.426,3.761,5.55,2.683,7.765,3.097 c1.969,0.369,2.479,1.772,2.479,3.984c0,2.212,0,44.209,0,44.209h3.101c0,0,0.072-43.305,0.072-44.209 c0-0.905-0.019-4.906-3.792-6.115c-1.592-0.509-2.334-0.376-2.918-2.293C19.782,8.408,17.96,1.99,11.033,0z",
    "4-right":
      "M39.967,0c0,0,0.803,7.891-2.625,11.654c-3.426,3.761-5.551,2.683-7.765,3.097 c-1.969,0.369-2.479,1.772-2.479,3.984c0,2.212,0,44.209,0,44.209h-3.101c0,0-0.073-43.305-0.073-44.209 c0-0.905,0.02-4.906,3.793-6.115c1.592-0.509,2.335-0.376,2.917-2.293C31.218,8.408,33.04,1.99,39.967,0z",
  };

  return paths[`${tier}-${side}`] ?? paths["1-left"]!;
}

const talentArcDots = [
  "M3.258 23.38c.295-.22.624-.303.992-.238.362.057.651.235.868.536.217.3.298.634.243 1.002-.05.376-.225.67-.52.891a1.24 1.24 0 01-1.002.244 1.275 1.275 0 01-.868-.535 1.315 1.315 0 01-.242-1.002c.05-.377.225-.671.529-.898z",
  "M6.244 26.987c.215-.301.503-.482.873-.534.361-.06.69.02.988.24.297.218.474.51.532.878.067.374-.012.708-.227 1.01-.221.31-.51.491-.88.544a1.263 1.263 0 01-.987-.24 1.302 1.302 0 01-.533-.879 1.291 1.291 0 01.234-1.019z",
  "M10.17 29.492c.114-.355.333-.617.669-.783a1.26 1.26 0 011.012-.082c.349.115.607.338.773.669.177.335.204.677.091 1.032a1.27 1.27 0 01-.671.793 1.26 1.26 0 01-1.012.082 1.284 1.284 0 01-.774-.669 1.294 1.294 0 01-.087-1.042z",
  "M14.684 30.638c0-.373.129-.69.398-.954.258-.264.57-.396.938-.396.366 0 .68.13.938.393.27.262.4.58.4.953.002.383-.127.701-.397.965a1.268 1.268 0 01-.937.396c-.367 0-.68-.13-.939-.393-.27-.263-.4-.58-.4-.964z",
  "M19.302 30.322a1.287 1.287 0 01.09-1.032c.165-.331.423-.555.771-.67a1.26 1.26 0 011.013.08c.336.166.556.428.67.782.116.365.09.708-.087 1.043a1.284 1.284 0 01-.772.67 1.26 1.26 0 01-1.013-.08 1.27 1.27 0 01-.672-.793z",
  "M23.614 28.564a1.284 1.284 0 01-.23-1.01c.058-.367.234-.66.53-.88.297-.219.626-.3.988-.241.37.051.659.231.874.532.223.31.302.645.236 1.019-.057.367-.234.66-.53.88-.297.219-.626.3-.988.241a1.252 1.252 0 01-.88-.541z",
  "M27.184 25.537a1.272 1.272 0 01-.523-.89 1.316 1.316 0 01.24-1.002c.215-.302.504-.48.866-.538.368-.067.697.015.993.234.305.226.481.52.531.896.057.368-.023.702-.239 1.003-.216.301-.505.48-.866.538a1.24 1.24 0 01-1.002-.241z",
];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
