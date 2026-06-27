import { Button, Picker, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { createContext, useContext } from "react";
import type { CSSProperties, ReactNode } from "react";
import { dotaAssetUrl, heroIcon } from "./dota";
import { SmartImage as Image } from "./SmartImage";
import type {
  MatchRecord,
  PlayerListItem,
  SeriesSummary,
  TeamBrief,
  TeamListItem,
  TournamentOption,
} from "./types";
import {
  formatDateTime,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatScore,
  labelStatus,
  seriesTitle,
  teamName,
} from "./utils";

export type MiniRouteKey =
  | "home"
  | "stage"
  | "schedule"
  | "records"
  | "leaderboard"
  | "players"
  | "teams"
  | "mine";

export type MiniRouteNavItem = { key: MiniRouteKey; label: string; url: string };

export const routeNavItems: MiniRouteNavItem[] = [
  { key: "home", label: "首页", url: "/pages/index/index" },
  { key: "stage", label: "赛事阶段", url: "/pages/stage/index" },
  { key: "schedule", label: "赛程", url: "/pages/schedule/index" },
  { key: "records", label: "比赛记录", url: "/pages/records/index" },
  { key: "leaderboard", label: "英雄榜", url: "/pages/hero-leaderboard/index" },
  { key: "players", label: "选手", url: "/pages/players/index" },
  { key: "teams", label: "队伍", url: "/pages/teams/index" },
  { key: "mine", label: "我的", url: "/pages/mine/index" },
];

const heroRows: Record<"radiant" | "dire", string[]> = {
  radiant: [
    "pudge",
    "windrunner",
    "juggernaut",
    "invoker",
    "phantom_assassin",
    "earthshaker",
    "lina",
    "nevermore",
    "queenofpain",
    "axe",
    "mirana",
    "ember_spirit",
    "mars",
    "snapfire",
  ],
  dire: [
    "templar_assassin",
    "void_spirit",
    "drow_ranger",
    "sven",
    "tiny",
    "rubick",
    "slark",
    "tidehunter",
    "morphling",
    "ursa",
    "puck",
    "sniper",
    "chaos_knight",
    "muerta",
  ],
};

type MiniNavMetrics = {
  top: number;
  height: number;
  sideInset: number;
};

const DEFAULT_MINI_NAV_METRICS: MiniNavMetrics = {
  top: 30,
  height: 30,
  sideInset: 10,
};

type MainTabHostContextValue = {
  activeRouteKey: MiniRouteKey;
  embedded: boolean;
  selectedTournamentId: string;
  selectedTournamentVersion: number;
  selectTournament: (tournamentId: string) => void;
  setSwipeLocked: (locked: boolean) => void;
  switchRoute: (url: string) => void;
};

const MainTabHostContext = createContext<MainTabHostContextValue | null>(null);
const PENDING_MAIN_TAB_ROUTE_KEY = "mrjz.mainTab.pendingRouteKey";

export function MainTabHostProvider(props: {
  activeRouteKey: MiniRouteKey;
  children: ReactNode;
  selectedTournamentId: string;
  selectedTournamentVersion: number;
  selectTournament: (tournamentId: string) => void;
  setSwipeLocked: (locked: boolean) => void;
  switchRoute: (url: string) => void;
}) {
  return (
    <MainTabHostContext.Provider
      value={{
        activeRouteKey: props.activeRouteKey,
        embedded: true,
        selectedTournamentId: props.selectedTournamentId,
        selectedTournamentVersion: props.selectedTournamentVersion,
        selectTournament: props.selectTournament,
        setSwipeLocked: props.setSwipeLocked,
        switchRoute: props.switchRoute,
      }}
    >
      {props.children}
    </MainTabHostContext.Provider>
  );
}

export function useMainTabSwitcher(): ((url: string) => void) | null {
  return useContext(MainTabHostContext)?.switchRoute ?? null;
}

export function useMainTabState(): MainTabHostContextValue | null {
  return useContext(MainTabHostContext);
}

export function mainTabHostUrl(routeKey: MiniRouteKey): string {
  return `/pages/index/index?tab=${routeKey}`;
}

export function mainTabRouteKeyFromUrl(url: string): MiniRouteKey | null {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  const [path = "", queryString = ""] = normalizedUrl.split("?");
  const tabParam = queryString
    .split("&")
    .map((pair) => pair.split("="))
    .find(([key]) => key === "tab")?.[1];
  const tabRouteKey = routeKeyFromUnknown(tabParam ? decodeURIComponent(tabParam) : "");

  if (path === "/pages/index/index" && tabRouteKey) {
    return tabRouteKey;
  }

  return routeNavItems.find((item) => item.url === path)?.key ?? null;
}

export function takePendingMainTabRouteKey(): MiniRouteKey | null {
  try {
    const value = Taro.getStorageSync<string | "">(PENDING_MAIN_TAB_ROUTE_KEY);
    Taro.removeStorageSync(PENDING_MAIN_TAB_ROUTE_KEY);

    return routeKeyFromUnknown(value);
  } catch {
    return null;
  }
}

export function PageShell(props: {
  children: ReactNode;
  loading?: boolean;
  error?: string;
  routeKey?: MiniRouteKey;
  backUrl?: string | undefined;
  className?: string;
  embedded?: boolean;
}) {
  const hostContext = useContext(MainTabHostContext);
  const shouldRenderEmbedded = props.embedded ?? Boolean(hostContext?.embedded);
  const routeKey = props.routeKey ?? "stage";
  const isHome = routeKey === "home";
  const body = (
    <>
      {props.loading ? <StatePanel title="读取中" text="正在同步赛事数据" /> : null}
      {!props.loading && props.error ? (
        <StatePanel title="暂时不可用" text={props.error} tone="danger" />
      ) : null}
      {!props.loading && !props.error ? props.children : null}
    </>
  );

  if (shouldRenderEmbedded) {
    return <View className="embedded-page-view">{body}</View>;
  }

  return (
    <View
      className={`app-shell ${isHome ? "route-home" : "route-secondary"} ${props.className ?? ""}`.trim()}
    >
      {isHome ? <HomeBackgroundMarquee /> : null}
      <AppBar
        backUrl={props.backUrl}
        isHome={isHome}
        onBack={hostContext ? () => hostContext.switchRoute("/pages/index/index") : undefined}
      />
      <View className="view">{body}</View>
      <FloatingRouteNav routeKey={routeKey} />
    </View>
  );
}

function AppBar(props: {
  backUrl?: string | undefined;
  isHome: boolean;
  onBack?: (() => void) | undefined;
}) {
  const navMetrics = getMiniNavMetrics();
  const appBarStyle: CSSProperties = {
    paddingTop: `${navMetrics.top}px`,
    paddingLeft: `${navMetrics.sideInset}px`,
    paddingRight: `${navMetrics.sideInset}px`,
  };
  const navRowStyle: CSSProperties = {
    minHeight: `${navMetrics.height}px`,
  };
  const navControlStyle: CSSProperties = {
    height: `${navMetrics.height}px`,
    lineHeight: `${navMetrics.height}px`,
  };
  const navButtonStyle: CSSProperties = {
    ...navControlStyle,
    width: `${navMetrics.height}px`,
  };

  return (
    <View className={`app-bar ${props.isHome ? "home-bar" : ""}`} style={appBarStyle}>
      <View className="title-line top-only" style={navRowStyle}>
        {props.isHome ? (
          <Text className="brand-mark" style={navControlStyle}>
            MRJZ
          </Text>
        ) : (
          <Button
            className="icon-button"
            style={navButtonStyle}
            onClick={() => {
              if (props.onBack) {
                props.onBack();
                return;
              }

              goBack(props.backUrl);
            }}
          >
            ‹
          </Button>
        )}
      </View>
    </View>
  );
}

function FloatingRouteNav(props: { routeKey: MiniRouteKey }) {
  const hostContext = useContext(MainTabHostContext);
  const activeIndex = Math.max(
    0,
    routeNavItems.findIndex((item) => item.key === props.routeKey),
  );
  const indicatorStyle: CSSProperties = {
    transform: `translateX(${activeIndex * 100}%)`,
    width: `${100 / routeNavItems.length}%`,
  };

  return (
    <View className="floating-route-nav">
      <View className="route-tabs">
        <View className="route-tab-indicator" style={indicatorStyle} />
        {routeNavItems.map((item) => (
          <Button
            className={`route-tab ${item.key === props.routeKey ? "active" : ""}`}
            key={item.key}
            onClick={() => {
              if (hostContext) {
                hostContext.switchRoute(item.url);
                return;
              }

              switchRoute(item.url);
            }}
          >
            {item.label}
          </Button>
        ))}
      </View>
    </View>
  );
}

function HomeBackgroundMarquee() {
  return (
    <View className="home-background-marquee">
      <HomeHeroRail side="radiant" />
      <HomeHeroRail side="dire" />
    </View>
  );
}

function HomeHeroRail(props: { side: "radiant" | "dire" }) {
  const heroes = [...heroRows[props.side], ...heroRows[props.side], ...heroRows[props.side]];

  return (
    <View className={`home-hero-rail ${props.side}`}>
      <View className="home-hero-track">
        {heroes.map((hero, index) => (
          <View className="home-hero-card" key={`${props.side}-${hero}-${index}`}>
            <Image
              className="home-hero-image"
              mode="aspectFill"
              src={dotaAssetUrl(`heroes/${hero}.png`)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function goBack(backUrl?: string) {
  if (backUrl) {
    void Taro.redirectTo({ url: backUrl });
    return;
  }

  const pages = Taro.getCurrentPages();

  if (pages.length > 1) {
    void Taro.navigateBack();
    return;
  }

  void Taro.redirectTo({ url: "/pages/index/index" });
}

function getMiniNavMetrics(): MiniNavMetrics {
  try {
    const menuButton = Taro.getMenuButtonBoundingClientRect?.();
    const windowInfo = Taro.getWindowInfo?.();
    const sideInset =
      windowInfo?.windowWidth && menuButton?.right
        ? Math.round(Math.max(8, windowInfo.windowWidth - menuButton.right))
        : DEFAULT_MINI_NAV_METRICS.sideInset;

    if (menuButton && menuButton.top > 0 && menuButton.height > 0) {
      return {
        top: Math.round(menuButton.top),
        height: Math.round(menuButton.height),
        sideInset,
      };
    }

    const statusBarHeight = windowInfo?.statusBarHeight;
    if (typeof statusBarHeight === "number" && statusBarHeight > 0) {
      return {
        top: Math.round(statusBarHeight + 10),
        height: DEFAULT_MINI_NAV_METRICS.height,
        sideInset,
      };
    }
  } catch {
    // H5 preview and some non-WeChat runtimes do not expose capsule metrics.
  }

  return DEFAULT_MINI_NAV_METRICS;
}

function switchRoute(url: string) {
  const routeKey = mainTabRouteKeyFromUrl(url);

  if (routeKey) {
    openMainTabRoute(routeKey);
    return;
  }

  const currentRoute = Taro.getCurrentPages().at(-1)?.route;

  if (currentRoute && url === `/${currentRoute}`) {
    return;
  }

  void Taro.redirectTo({ url });
}

function openMainTabRoute(routeKey: MiniRouteKey) {
  const pages = Taro.getCurrentPages();
  const currentRoute = pages.at(-1)?.route;
  const hostPageIndex = pages.findIndex((page) => page.route === "pages/index/index");

  if (currentRoute === "pages/index/index") {
    writePendingMainTabRouteKey(routeKey);
    return;
  }

  if (hostPageIndex >= 0 && hostPageIndex < pages.length - 1) {
    writePendingMainTabRouteKey(routeKey);
    void Taro.navigateBack({ delta: pages.length - 1 - hostPageIndex });
    return;
  }

  void Taro.redirectTo({ url: mainTabHostUrl(routeKey) });
}

function writePendingMainTabRouteKey(routeKey: MiniRouteKey): void {
  try {
    Taro.setStorageSync(PENDING_MAIN_TAB_ROUTE_KEY, routeKey);
  } catch {
    // Best effort only; redirect fallback still carries the tab in the URL.
  }
}

function routeKeyFromUnknown(value: unknown): MiniRouteKey | null {
  return routeNavItems.find((item) => item.key === value)?.key ?? null;
}

export function StatePanel(props: { title: string; text: string; tone?: "default" | "danger" }) {
  return (
    <View className={`state-panel ${props.tone === "danger" ? "state-panel-danger" : ""}`}>
      <Text className="state-title">{props.title}</Text>
      <Text className="state-text">{props.text}</Text>
    </View>
  );
}

export function SectionTitle(props: {
  kicker?: string;
  title: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <View className="section-title">
      <View className="section-title-copy">
        {props.kicker ? <Text className="kicker">{props.kicker}</Text> : null}
        <Text className="section-heading">{props.title}</Text>
      </View>
      {props.actionText ? (
        <Button className="text-button" onClick={() => props.onAction?.()}>
          {props.actionText}
        </Button>
      ) : null}
    </View>
  );
}

export function TournamentPicker(props: {
  tournaments: TournamentOption[];
  selectedTournamentId: string;
  onChange: (tournamentId: string) => void;
}) {
  const selectedIndex = Math.max(
    0,
    props.tournaments.findIndex((tournament) => tournament.id === props.selectedTournamentId),
  );
  const selected = props.tournaments[selectedIndex];

  return (
    <Picker
      mode="selector"
      range={props.tournaments.map((tournament) => tournament.name)}
      value={selectedIndex}
      onChange={(event) => {
        const index = Number(event.detail.value);
        const tournamentId = props.tournaments[index]?.id;
        if (tournamentId) {
          props.onChange(tournamentId);
        }
      }}
    >
      <View className="tournament-picker">
        <View className="picker-main">
          <Text className="kicker">当前届次</Text>
          <Text className="picker-title">{selected?.name ?? "选择赛事"}</Text>
        </View>
        <Text className="picker-status">{labelStatus(selected?.status)}</Text>
      </View>
    </Picker>
  );
}

export function TournamentScope(props: { tournament?: TournamentOption | null | undefined }) {
  const hostContext = useContext(MainTabHostContext);
  const meta = props.tournament;
  const leagueId = meta?.league?.opendotaLeagueId ?? "-";
  const startsAtText = formatTournamentStart(meta?.startsAt);

  return (
    <View className="tournament-scope">
      <View>
        <Text>{meta?.name ?? "选择赛事"}</Text>
        <Text>
          League {leagueId} · {labelStatus(meta?.status)}
          {startsAtText ? ` · ${startsAtText} 开赛` : ""}
        </Text>
      </View>
      <Button
        className="link-button"
        onClick={() => {
          if (hostContext) {
            hostContext.switchRoute("/pages/index/index");
            return;
          }

          switchRoute("/pages/index/index");
        }}
      >
        切换
      </Button>
    </View>
  );
}

function formatTournamentStart(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

export function FilterRow<T extends string>(props: {
  labels: T[];
  value?: T;
  onChange?: (value: T) => void;
}) {
  const hostContext = useContext(MainTabHostContext);
  const activeValue = props.value ?? props.labels[0];
  const setSwipeLocked = (locked: boolean) => hostContext?.setSwipeLocked(locked);

  return (
    <ScrollView
      className="filter-row"
      enhanced
      scrollX
      showScrollbar={false}
      onTouchCancel={() => setSwipeLocked(false)}
      onTouchEnd={() => setSwipeLocked(false)}
      onTouchStart={() => setSwipeLocked(true)}
    >
      <View className="filter-row-content">
        {props.labels.map((label) => (
          <Button
            className={`filter ${label === activeValue ? "active" : ""}`}
            key={label}
            onClick={() => props.onChange?.(label)}
          >
            {label}
          </Button>
        ))}
      </View>
    </ScrollView>
  );
}

export function StatGrid(props: {
  items: Array<{ label: string; value: string; hint?: string | undefined }>;
}) {
  return (
    <View className="metric-grid stat-grid">
      {props.items.map((item) => (
        <View className="metric-card stat-cell" key={item.label}>
          <Text className="stat-value">{item.value}</Text>
          <Text className="stat-label">{item.label}</Text>
          {item.hint ? <Text className="stat-hint">{item.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function TeamBadge(props: { team?: TeamBrief | null; align?: "left" | "right" }) {
  const team = props.team;
  const initial = teamName(team).slice(0, 1);

  return (
    <View className={`team-badge ${props.align === "right" ? "team-badge-right" : ""}`}>
      {team?.logoUrl ? (
        <Image className="team-logo" mode="aspectFill" src={team.logoUrl} />
      ) : (
        <View
          className="team-logo team-logo-fallback"
          style={{ backgroundColor: team?.color ?? "#334155" }}
        >
          {initial}
        </View>
      )}
      <View className="team-name-wrap">
        <Text className="team-name">{teamName(team)}</Text>
        {team?.shortName ? <Text className="team-short">{team.shortName}</Text> : null}
      </View>
    </View>
  );
}

export function SeriesCard(props: { series: SeriesSummary; onOpen?: () => void }) {
  const firstMatchId = props.series.games?.find((game) => game.matchId)?.matchId;
  const isFinished = props.series.status === "completed";
  const statusText = seriesScheduleStatusText(props.series.status);

  return (
    <View
      className={`schedule-card series-card ${isFinished ? "finished" : ""}`}
      onClick={() => props.onOpen?.()}
    >
      <View className="schedule-card-head series-meta-row">
        <Text className="schedule-time">{formatDateTime(props.series.scheduledAt)}</Text>
        <Text className="muted">
          {props.series.groupName || props.series.roundName || seriesTitle(props.series)}
        </Text>
      </View>
      <View className="schedule-matchup series-vs">
        <Text className="schedule-team">{teamName(props.series.radiantTeam)}</Text>
        <Text className={`schedule-score ${isFinished ? "is-result" : "is-bo"} score-text`}>
          {isFinished ? formatScore(props.series) : (props.series.boType ?? "BO")}
        </Text>
        <Text className="schedule-team is-right">{teamName(props.series.direTeam)}</Text>
      </View>
      <View className="schedule-card-foot series-footer">
        <Text className={`status-tag ${seriesScheduleStatusClass(statusText)}`}>{statusText}</Text>
        <Text className="match-id">
          {firstMatchId
            ? `match ${firstMatchId}`
            : props.series.seriesKind === "tiebreaker"
              ? "加赛"
              : "--"}
        </Text>
      </View>
    </View>
  );
}

export function seriesScheduleStatusText(
  status?: string | null,
): "未开始" | "待补录" | "已完赛" | "延期" {
  if (status === "completed") {
    return "已完赛";
  }

  if (status === "result_pending" || status === "conflict") {
    return "待补录";
  }

  if (status === "postponed" || status === "cancelled") {
    return "延期";
  }

  return "未开始";
}

function seriesScheduleStatusClass(status: ReturnType<typeof seriesScheduleStatusText>): string {
  if (status === "已完赛") {
    return "green";
  }

  if (status === "延期") {
    return "red";
  }

  if (status === "待补录") {
    return "blue";
  }

  return "";
}

export function PlayerAvatar(props: {
  player: Pick<PlayerListItem, "displayName" | "avatarUrl">;
  size?: "normal" | "large";
}) {
  const className = props.size === "large" ? "player-avatar player-avatar-large" : "player-avatar";

  return props.player.avatarUrl ? (
    <Image className={className} mode="aspectFill" src={props.player.avatarUrl} />
  ) : (
    <View className={`${className} player-avatar-fallback`}>
      {props.player.displayName.slice(0, 1)}
    </View>
  );
}

export function MatchRecordCard(props: {
  record: MatchRecord;
  index?: number;
  onOpen: (matchId: number) => void;
}) {
  const { record } = props;
  const score =
    record.radiantScore === null || record.direScore === null
      ? "- : -"
      : `${record.radiantScore} : ${record.direScore}`;
  const winnerClass =
    record.radiantWin === null ? "" : record.radiantWin ? "radiant-win" : "dire-win";
  const heroCount =
    (record.heroLineups?.radiant.length ?? 0) + (record.heroLineups?.dire.length ?? 0);

  return (
    <View className={`record-card match-record-card ${winnerClass}`}>
      <Button className="record-main" onClick={() => props.onOpen(record.matchId)}>
        <View className="record-head">
          <Text>#{record.matchId}</Text>
          <Text>{formatFullRecordDateTime(record.startTime)}</Text>
        </View>
        <View className="record-score">
          <Text>{record.radiantTeamName}</Text>
          <Text>{score}</Text>
          <Text>{record.direTeamName}</Text>
        </View>
        <RecordHeroMatchup record={record} />
        <View className="record-meta">
          <Text>{record.durationText ?? "--:--"}</Text>
          <Text>{record.parseStatus}</Text>
          <Text>{record.playerCount} 人</Text>
        </View>
        <View className="record-flags">
          <RecordFlag label={`英雄 ${heroCount || "-"}`} active={heroCount > 0} />
          <RecordFlag label="BP" active={record.hasDraft} />
          <RecordFlag label="眼位" active={record.hasVision} />
          <RecordFlag label="聊天" active={record.hasChat} />
        </View>
      </Button>
    </View>
  );
}

function formatFullRecordDateTime(value?: string | null): string {
  if (!value) {
    return "时间待定";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function RecordHeroMatchup(props: { record: MatchRecord }) {
  const radiant = props.record.heroLineups?.radiant ?? [];
  const dire = props.record.heroLineups?.dire ?? [];
  const hasLineup = radiant.length > 0 || dire.length > 0;

  if (!hasLineup) {
    return (
      <View className="record-lineup empty">
        <Text>英雄阵容待同步</Text>
      </View>
    );
  }

  return (
    <View className="record-lineup">
      <RecordHeroStrip heroes={radiant} side="radiant" />
      <View className="record-versus">
        <View />
        <Text>VS</Text>
        <View />
      </View>
      <RecordHeroStrip heroes={dire} side="dire" />
    </View>
  );
}

function RecordHeroStrip(props: {
  side: "radiant" | "dire";
  heroes: NonNullable<MatchRecord["heroLineups"]>["radiant"];
}) {
  return (
    <View className={`record-hero-strip ${props.side}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const hero = props.heroes[index];

        return hero ? (
          <Image
            className="record-hero"
            key={`${props.side}:${index}`}
            mode="aspectFill"
            src={hero.icon || hero.portrait}
          />
        ) : (
          <View className="record-hero empty" key={`${props.side}:${index}`}>
            <View />
          </View>
        );
      })}
    </View>
  );
}

function RecordFlag(props: { label: string; active: boolean }) {
  return <Text className={props.active ? "active" : ""}>{props.label}</Text>;
}

export function PlayerDirectoryCard(props: {
  player: PlayerListItem;
  onOpen: (playerId: string) => void;
}) {
  const { player } = props;
  const team = player.currentTeam ?? player.teams[0] ?? null;
  const rate = clampPercent(player.stats.winRate ?? 0);

  return (
    <View className="player-stat-card">
      <Button
        className="player-stat-card-main"
        style={{ borderLeftColor: team?.color ?? "#5eead4" }}
        onClick={() => props.onOpen(player.id)}
      >
        <View className="player-stat-head">
          <SteamAvatar player={player} />
          <View className="player-stat-identity">
            <View className="player-stat-name-row">
              <Text>{player.displayName}</Text>
              <PlayerTeamMark team={team} />
            </View>
            <View className="player-stat-subline">
              <Text className="profile-id-link">ID {player.accountId ?? player.id}</Text>
              <Text>
                {player.stats.wins}W / {player.stats.losses}L
              </Text>
            </View>
          </View>
          <View className="player-stat-primary">
            <Text>
              胜率 <Text>{formatPercent(player.stats.winRate)}</Text>
            </Text>
            <View className="rate-bar">
              <View style={{ width: `${rate.toFixed(1)}%` }} />
            </View>
            <Text>{formatDecimal(player.stats.kda, 2)}</Text>
            <Text>KDA</Text>
          </View>
        </View>
        <View className="player-stat-grid">
          <PlayerStatTile label="场次" value={formatInteger(player.stats.totalMatches)} />
          <PlayerStatTile label="GPM" value={formatDecimal(player.stats.avgGpm, 0)} />
          <PlayerStatTile label="XPM" value={formatDecimal(player.stats.avgXpm, 0)} />
          <PlayerStatTile
            label="击/亡/助"
            value={`${formatDecimal(player.stats.avgKills)}/${formatDecimal(player.stats.avgDeaths)}/${formatDecimal(player.stats.avgAssists)}`}
          />
          <PlayerStatTile label="场均经济" value={formatCompact(player.stats.avgNetWorth)} />
          <PlayerStatTile label="英雄伤害" value={formatCompact(player.stats.avgHeroDamage)} />
          <PlayerStatTile label="建筑伤害" value={formatCompact(player.stats.avgTowerDamage)} />
          <PlayerStatTile label="承伤" value={formatCompact(player.stats.avgDamageTaken)} />
        </View>
        <PlayerHeroStrip heroes={player.stats.topHeroes} />
      </Button>
    </View>
  );
}

function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

export function TeamDirectoryCard(props: { team: TeamListItem; onOpen: (teamId: string) => void }) {
  const { team } = props;

  return (
    <View className="profile-list-card team-card">
      <Button
        style={{ borderLeftColor: team.color ?? "#f0c36a" }}
        onClick={() => props.onOpen(team.id)}
      >
        <View className="profile-avatar-fallback team">
          {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
        </View>
        <View>
          <Text>{team.name}</Text>
          <Text>
            {team.memberCount} 名成员 · {team.stats.seriesPlayed} 场 · 胜率{" "}
            {formatPercent(team.stats.winRate)}
          </Text>
          <Text>
            {team.stats.gameWins} 胜 / {team.stats.gameLosses} 负 · 入库 {team.stats.linkedMatches}{" "}
            场
          </Text>
        </View>
        <Text>进入</Text>
      </Button>
    </View>
  );
}

export function PlayerTeamMark(props: { team: TeamBrief | null }) {
  if (props.team === null) {
    return <Text className="team-mark empty">暂未归队</Text>;
  }

  return (
    <Text className="team-mark" style={{ borderColor: props.team.color ?? "#f0c36a" }}>
      {props.team.name}
    </Text>
  );
}

export function PlayerHeroStrip(props: { heroes: Array<{ heroId: number }> }) {
  if (props.heroes.length === 0) {
    return (
      <View className="player-hero-strip empty">
        <Text>暂无常用英雄</Text>
      </View>
    );
  }

  return (
    <View className="player-hero-strip">
      {props.heroes.slice(0, 3).map((hero) => (
        <View key={hero.heroId}>
          <Image mode="aspectFill" src={heroIcon(hero.heroId)} />
        </View>
      ))}
    </View>
  );
}

function PlayerStatTile(props: { label: string; value: string }) {
  return (
    <View>
      <Text>{props.label}</Text>
      <Text>{props.value}</Text>
    </View>
  );
}

export function SteamAvatar(props: {
  player: Pick<PlayerListItem, "displayName" | "avatarUrl">;
  size?: "normal" | "large" | "small";
}) {
  const size = props.size ?? "normal";
  const initial = props.player.displayName.slice(0, 1).toUpperCase();

  return props.player.avatarUrl ? (
    <View className={`steam-avatar-shell ${size}`}>
      <Image className={`steam-avatar ${size}`} mode="aspectFill" src={props.player.avatarUrl} />
    </View>
  ) : (
    <View className={`profile-avatar-fallback ${size === "large" ? "large" : ""}`}>{initial}</View>
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}
