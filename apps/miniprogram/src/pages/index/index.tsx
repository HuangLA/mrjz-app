import { Button, ScrollView, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { useState } from "react";
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
  type MiniRouteKey,
  type MiniRouteNavItem,
  useMainTabSwitcher,
} from "../../components";
import { SmartImage as Image } from "../../SmartImage";
import type { AcknowledgementItem, MatchRecord, TournamentOption } from "../../types";
import { formatDate, labelStatus, switchTab } from "../../utils";
import HeroLeaderboardPage from "../hero-leaderboard/index";
import MinePage from "../mine/index";
import PlayersPage from "../players/index";
import RecordsPage from "../records/index";
import SchedulePage from "../schedule/index";
import StagePage from "../stage/index";
import TeamsPage from "../teams/index";

type HomeCache = {
  acknowledgements: AcknowledgementItem[];
  recentRecordsByTournament: Record<string, MatchRecord[]>;
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

type MainTabPage = MiniRouteNavItem & {
  render: () => JSX.Element;
};

const mainTabPages: MainTabPage[] = routeNavItems.map((item) => ({
  ...item,
  render: mainTabRenderer(item.key),
}));

export default function MainTabsPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(() =>
    routeIndexFromKey(routeKeyFromParam(router.params.tab)),
  );
  const activePage = mainTabPages[activeIndex] ?? mainTabPages[0]!;

  function switchMainRoute(url: string) {
    const nextIndex = routeIndexFromUrl(url);

    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
      return;
    }

    void Taro.redirectTo({ url });
  }

  function handleSwiperChange(event: { detail?: { current?: number } }) {
    const nextIndex = event.detail?.current;

    if (typeof nextIndex !== "number" || !mainTabPages[nextIndex]) {
      return;
    }

    setActiveIndex(nextIndex);
  }

  return (
    <MainTabHostProvider activeRouteKey={activePage.key} switchRoute={switchMainRoute}>
      <PageShell className="main-tab-shell" embedded={false} routeKey={activePage.key}>
        <Swiper
          className="main-tab-swiper"
          current={activeIndex}
          duration={260}
          onChange={handleSwiperChange}
        >
          {mainTabPages.map((page) => (
            <SwiperItem className="main-tab-item" key={page.key}>
              <ScrollView className="main-tab-scroll" enhanced scrollY showScrollbar={false}>
                <View className="main-tab-pane">{page.render()}</View>
              </ScrollView>
            </SwiperItem>
          ))}
        </Swiper>
      </PageShell>
    </MainTabHostProvider>
  );
}

function HomePage() {
  const switchMainTab = useMainTabSwitcher();
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

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
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

      setSelectedTournamentId(targetId);
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
    setSelectedTournamentId(tournamentId);
    setSelectedId(tournamentId);
    if (switchMainTab) {
      switchMainTab("/pages/stage/index");
      return;
    }

    switchTab("/pages/stage/index");
  }

  const recordCount = Object.values(recentRecordsByTournament).reduce(
    (sum, tournamentRecords) => sum + tournamentRecords.length,
    0,
  );

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
              <Text>{String(recordCount)}</Text>
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
      return () => <StagePage />;
    case "schedule":
      return () => <SchedulePage />;
    case "records":
      return () => <RecordsPage />;
    case "leaderboard":
      return () => <HeroLeaderboardPage />;
    case "players":
      return () => <PlayersPage />;
    case "teams":
      return () => <TeamsPage />;
    case "mine":
      return () => <MinePage />;
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
