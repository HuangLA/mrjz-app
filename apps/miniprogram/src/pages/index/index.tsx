import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseTournamentId,
  getSelectedTournamentId,
  loadAcknowledgements,
  loadTournamentMatches,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import {
  MainTabHostProvider,
  PageShell,
  routeNavItems,
  takePendingMainTabRouteKey,
  type MiniRouteKey,
  type MiniRouteNavItem,
  useMainTabRefresh,
  useMainTabState,
} from "../../components";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";
import { SmartImage as Image } from "../../SmartImage";
import type { AcknowledgementItem, MatchRecord, TournamentOption } from "../../types";
import { formatDate, formatInteger, labelStatus, switchTab } from "../../utils";
import { HeroLeaderboardContent } from "../hero-leaderboard/Content";
import { MineContent } from "../mine/Content";
import { PlayersContent } from "../players/Content";
import { RecordsContent } from "../records/Content";
import { ScheduleContent } from "../schedule/Content";
import { StageContent } from "../stage/Content";
import { TeamsContent } from "../teams/Content";

type HomeCache = {
  acknowledgements: AcknowledgementItem[];
  recentRecordsByTournament: Record<string, MatchRecord[]>;
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

const HOME_PAGE_CACHE_MAX_AGE_MS = 30 * 1000;

type MainTabPage = MiniRouteNavItem & {
  render: () => JSX.Element;
};

const mainTabPages: MainTabPage[] = routeNavItems.map((item) => ({
  ...item,
  render: mainTabRenderer(item.key),
}));
const MAIN_TAB_PAGE_WIDTH_PERCENT = 100 / mainTabPages.length;

export default function MainTabsPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(() =>
    routeIndexFromKey(routeKeyFromParam(router.params.tab)),
  );
  const [selectedTournamentIdState, setSelectedTournamentIdState] = useState(() =>
    getSelectedTournamentId(),
  );
  const [selectedTournamentVersion, setSelectedTournamentVersion] = useState(0);
  const [refreshingRouteKey, setRefreshingRouteKey] = useState<MiniRouteKey | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const refreshHandlersRef = useRef(new Map<MiniRouteKey, () => Promise<void> | void>());
  const refreshingRouteKeyRef = useRef<MiniRouteKey | null>(null);
  const activePage = mainTabPages[activeIndex] ?? mainTabPages[0]!;
  const mainTabTrackStyle = {
    transform: `translateX(${-activeIndex * MAIN_TAB_PAGE_WIDTH_PERCENT}%)`,
  };

  useMiniProgramShare(() => mainTabShareConfig(activePage.key));

  const registerRefreshHandler = useCallback(
    (routeKey: MiniRouteKey, handler: () => Promise<void> | void) => {
      refreshHandlersRef.current.set(routeKey, handler);

      return () => {
        if (refreshHandlersRef.current.get(routeKey) === handler) {
          refreshHandlersRef.current.delete(routeKey);
        }
      };
    },
    [],
  );

  useDidShow(() => {
    const pendingRouteKey = takePendingMainTabRouteKey();

    if (pendingRouteKey) {
      commitActiveIndex(routeIndexFromKey(pendingRouteKey));
    }

    syncSelectedTournamentFromStorage();
  });

  useEffect(() => {
    commitActiveIndex(routeIndexFromKey(routeKeyFromParam(router.params.tab)));
  }, [router.params.tab]);

  function switchMainRoute(url: string) {
    const nextIndex = routeIndexFromUrl(url);

    if (nextIndex >= 0) {
      commitActiveIndex(nextIndex);
      return;
    }

    void Taro.redirectTo({ url });
  }

  function commitActiveIndex(nextIndex: number) {
    if (!mainTabPages[nextIndex]) {
      return;
    }

    activeIndexRef.current = nextIndex;
    setActiveIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
  }

  function setMainTabSwipeLocked(_locked: boolean) {
    // Main tab swipe is disabled; child horizontal scrollers can keep their native behavior.
  }

  function selectMainTournament(tournamentId: string): void {
    const nextTournamentId = tournamentId.trim();

    if (!nextTournamentId) {
      return;
    }

    setSelectedTournamentId(nextTournamentId);
    setSelectedTournamentIdState((currentTournamentId) => {
      if (currentTournamentId === nextTournamentId) {
        return currentTournamentId;
      }

      setSelectedTournamentVersion((currentVersion) => currentVersion + 1);
      return nextTournamentId;
    });
  }

  function syncSelectedTournamentFromStorage(): void {
    const storedTournamentId = getSelectedTournamentId();

    if (!storedTournamentId) {
      return;
    }

    setSelectedTournamentIdState((currentTournamentId) => {
      if (currentTournamentId === storedTournamentId) {
        return currentTournamentId;
      }

      setSelectedTournamentVersion((currentVersion) => currentVersion + 1);
      return storedTournamentId;
    });
  }

  async function refreshMainTab(routeKey: MiniRouteKey) {
    if (refreshingRouteKeyRef.current) {
      return;
    }

    const handler = refreshHandlersRef.current.get(routeKey);

    if (!handler) {
      return;
    }

    refreshingRouteKeyRef.current = routeKey;
    setRefreshingRouteKey(routeKey);

    try {
      await handler();
    } finally {
      refreshingRouteKeyRef.current = null;
      setRefreshingRouteKey(null);
    }
  }

  return (
    <MainTabHostProvider
      activeRouteKey={activePage.key}
      registerRefreshHandler={registerRefreshHandler}
      selectedTournamentId={selectedTournamentIdState}
      selectedTournamentVersion={selectedTournamentVersion}
      selectTournament={selectMainTournament}
      setSwipeLocked={setMainTabSwipeLocked}
      switchRoute={switchMainRoute}
    >
      <PageShell
        className="main-tab-shell"
        embedded={false}
        routeKey={activePage.key}
      >
        <View
          className="main-tab-swiper"
        >
          <View className="main-tab-track" style={mainTabTrackStyle}>
            {mainTabPages.map((page) => (
              <View className="main-tab-item" key={page.key}>
                <ScrollView
                  className="main-tab-scroll"
                  enhanced
                  refresherBackground="#07090c"
                  refresherDefaultStyle="white"
                  refresherEnabled
                  refresherTriggered={refreshingRouteKey === page.key}
                  scrollY
                  showScrollbar={false}
                  onRefresherRefresh={() => {
                    void refreshMainTab(page.key);
                  }}
                >
                  <View className="main-tab-pane">{page.render()}</View>
                </ScrollView>
              </View>
            ))}
          </View>
        </View>
      </PageShell>
    </MainTabHostProvider>
  );
}

function HomePage() {
  const mainTabState = useMainTabState();
  const [initialStoredTournamentId] = useState(() => getSelectedTournamentId());
  const [initialCache] = useState(() => readPageCache<HomeCache>(pageCacheKey("home")));
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState("");
  const [acknowledgements, setAcknowledgements] = useState<AcknowledgementItem[]>(
    () => initialCache?.acknowledgements ?? [],
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
  const [recentRecordsByTournament, setRecentRecordsByTournament] = useState<
    Record<string, MatchRecord[]>
  >(() => initialCache?.recentRecordsByTournament ?? {});

  useMainTabRefresh("home", () => refresh(undefined, { force: true }));

  useDidShow(() => {
    void refresh();
  });

  useEffect(() => {
    if (mainTabState?.activeRouteKey !== "home") {
      return;
    }

    void refresh();
  }, [mainTabState?.activeRouteKey]);

  useEffect(() => {
    const hostTournamentId = mainTabState?.selectedTournamentId ?? "";

    if (!hostTournamentId || hostTournamentId === selectedTournamentId) {
      return;
    }

    if (tournaments.some((tournament) => tournament.id === hostTournamentId)) {
      setSelectedId(hostTournamentId);
      return;
    }

    void refresh(hostTournamentId);
  }, [
    mainTabState?.selectedTournamentId,
    mainTabState?.selectedTournamentVersion,
    selectedTournamentId,
    tournaments,
  ]);

  async function refresh(nextTournamentId?: string, options?: { force?: boolean }) {
    const cacheKey = pageCacheKey("home");
    const storedTournamentId = getSelectedTournamentId();
    const cached = nextTournamentId ? null : readPageCache<HomeCache>(cacheKey);

    if (cached) {
      const cachedSelectedTournamentId = chooseTournamentId(
        cached.tournaments,
        nextTournamentId,
        storedTournamentId,
        cached.selectedTournamentId,
      );

      setAcknowledgements(cached.acknowledgements ?? []);
      setTournaments(cached.tournaments);
      setSelectedId(cachedSelectedTournamentId);
      setRecentRecordsByTournament(cached.recentRecordsByTournament);
      setLoading(false);

      if (cachedSelectedTournamentId && cachedSelectedTournamentId !== storedTournamentId) {
        persistSelectedTournamentId(cachedSelectedTournamentId);
      }
    } else {
      setLoading(true);
    }

    setError("");

    if (!options?.force && cached && isPageCacheFresh(cacheKey, HOME_PAGE_CACHE_MAX_AGE_MS)) {
      return;
    }

    try {
      const [allTournaments, acknowledgementItems] = await Promise.all([
        loadTournaments(),
        loadAcknowledgements().catch(() => []),
      ]);
      const targetId = chooseTournamentId(
        allTournaments,
        nextTournamentId,
        getSelectedTournamentId(),
      );

      if (targetId.length === 0) {
        setAcknowledgements(acknowledgementItems);
        setTournaments(allTournaments);
        setSelectedId("");
        setRecentRecordsByTournament({});
        return;
      }

      persistSelectedTournamentId(targetId);
      const recentEntries: Array<readonly [string, MatchRecord[]]> = [];

      for (const tournament of allTournaments) {
        try {
          recentEntries.push([
            tournament.id,
            await loadTournamentMatches(tournament.id, 3),
          ] as const);
        } catch {
          recentEntries.push([tournament.id, []] as const);
        }
      }
      const snapshot = {
        acknowledgements: acknowledgementItems,
        recentRecordsByTournament: Object.fromEntries(recentEntries),
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setAcknowledgements(snapshot.acknowledgements);
      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setRecentRecordsByTournament(snapshot.recentRecordsByTournament);
      writePageCache(cacheKey, snapshot);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "赛事数据读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function enterTournament(tournamentId: string) {
    persistSelectedTournamentId(tournamentId);
    setSelectedId(tournamentId);
    if (mainTabState) {
      mainTabState.switchRoute("/pages/stage/index");
      return;
    }

    switchTab("/pages/stage/index");
  }

  function persistSelectedTournamentId(tournamentId: string): void {
    if (mainTabState) {
      mainTabState.selectTournament(tournamentId);
      return;
    }

    setSelectedTournamentId(tournamentId);
  }

  const recordCount = tournaments.reduce((sum, tournament) => {
    return sum + (typeof tournament.matchCount === "number" ? tournament.matchCount : 0);
  }, 0);

  return (
    <PageShell loading={loading} error={error} routeKey="home">
      <View className="home-hero">
        <View className="home-hero-content">
          <View className="home-brand-core">
            <Text className="home-brand-season">COMMUNITY LEAGUE</Text>
            <Text className="home-brand-name">每日节奏杯</Text>
            <Text className="home-brand-sub">DRAFT · FIGHT · RECORD</Text>
          </View>
          <View className="home-hero-stats">
            <View>
              <Text>届次</Text>
              <Text>{String(tournaments.length)}</Text>
            </View>
            <View>
              <Text>比赛</Text>
              <Text>{formatInteger(recordCount)}</Text>
            </View>
            <View>
              <Text>战场</Text>
              <Text>DOTA2</Text>
            </View>
          </View>
          <AcknowledgementsPanel items={acknowledgements} />
        </View>
      </View>

      <View className="tournament-entry-list">
        {tournaments.map((tournament) => (
          <View
            className={`tournament-entry ${tournament.id === selectedTournamentId ? "active" : ""}`}
            key={tournament.id}
          >
            <Button
              className="tournament-entry-main"
              onClick={() => enterTournament(tournament.id)}
            >
              <View>
                <Text className="tournament-entry-title">{tournament.name}</Text>
                <Text className="tournament-entry-meta">
                  {labelStatus(tournament.status)} · {formatDate(tournament.startsAt)}
                </Text>
              </View>
              <View className="tournament-entry-action">
                <Text>{tournament.id === selectedTournamentId ? "当前" : "进入"}</Text>
                <Text>{formatLatestRecord(recentRecordsByTournament[tournament.id]?.[0])}</Text>
              </View>
            </Button>
          </View>
        ))}
      </View>
    </PageShell>
  );
}

function mainTabRenderer(routeKey: MiniRouteKey): () => JSX.Element {
  switch (routeKey) {
    case "home":
      return () => <HomePage />;
    case "stage":
      return () => <StageContent />;
    case "schedule":
      return () => <ScheduleContent />;
    case "records":
      return () => <RecordsContent />;
    case "leaderboard":
      return () => <HeroLeaderboardContent />;
    case "players":
      return () => <PlayersContent />;
    case "teams":
      return () => <TeamsContent />;
    case "mine":
      return () => <MineContent />;
  }
}

function routeIndexFromKey(routeKey: MiniRouteKey): number {
  return Math.max(
    0,
    mainTabPages.findIndex((page) => page.key === routeKey),
  );
}

function routeIndexFromUrl(url: string): number {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  return mainTabPages.findIndex((page) => page.url === normalizedUrl);
}

function routeKeyFromParam(value: unknown): MiniRouteKey {
  return routeNavItems.find((item) => item.key === value)?.key ?? "home";
}

function AcknowledgementsPanel({ items = [] }: { items?: AcknowledgementItem[] }) {
  const sponsors = items.filter((item) => item.category === "sponsor");
  const supporters = items.filter((item) => item.category === "community");
  const sponsorGridClassName =
    sponsors.length >= 3 ? "home-major-sponsors is-compact" : "home-major-sponsors";

  if (sponsors.length === 0 && supporters.length === 0) {
    return null;
  }

  return (
    <View className="home-sponsor-panel">
      <View className="home-sponsor-heading">
        <Text>鸣谢名单</Text>
      </View>
      {sponsors.length > 0 ? (
        <View className="home-sponsor-section">
          <View className="home-sponsor-section-title">
            <Text>赞助商</Text>
            <Text>SPONSORS</Text>
          </View>
          <View className={sponsorGridClassName}>
            {sponsors.map((sponsor) => (
              <View className="home-major-sponsor" key={sponsor.id}>
                {sponsor.imageUrl ? <Image src={sponsor.imageUrl} mode="aspectFit" /> : null}
                <Text>{sponsor.displayName}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {supporters.length > 0 ? (
        <View className="home-sponsor-section">
          <View className="home-sponsor-section-title">
            <Text>社区支持</Text>
            <Text>COMMUNITY</Text>
          </View>
          <View className="home-community-supporters">
            {supporters.map((supporter) => (
              <View className="home-community-supporter" key={supporter.id}>
                {supporter.imageUrl ? (
                  <View className="home-community-avatar">
                    <Image
                      className="home-community-avatar-image"
                      src={supporter.imageUrl}
                      mode="aspectFill"
                    />
                  </View>
                ) : (
                  <View className="home-community-avatar fallback">
                    <Text>{supporter.displayName.slice(0, 1).toUpperCase() || "?"}</Text>
                  </View>
                )}
                <Text>{supporter.displayName}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatLatestRecord(record?: MatchRecord): string {
  if (!record) {
    return "--";
  }

  const score =
    record.radiantScore === null || record.direScore === null
      ? "暂无赛果"
      : `${record.radiantScore}:${record.direScore}`;
  return `${record.radiantTeamName} ${score} ${record.direTeamName}`;
}
