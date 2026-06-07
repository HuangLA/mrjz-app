import { Button, Image, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { ReactNode } from "react";
import type { PlayerListItem, SeriesSummary, TeamBrief, TournamentOption } from "./types";
import { formatDateTime, formatScore, labelStatus, seriesTitle, teamName } from "./utils";

export type MiniRouteKey = "home" | "stage" | "schedule" | "records" | "players" | "teams" | "mine";

const routeNavItems: Array<{ key: MiniRouteKey; label: string; url: string }> = [
  { key: "home", label: "首页", url: "/pages/index/index" },
  { key: "stage", label: "赛事阶段", url: "/pages/stage/index" },
  { key: "schedule", label: "赛程", url: "/pages/schedule/index" },
  { key: "records", label: "比赛记录", url: "/pages/records/index" },
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

export function PageShell(props: { children: ReactNode; loading?: boolean; error?: string; routeKey?: MiniRouteKey }) {
  const routeKey = props.routeKey ?? "stage";
  const isHome = routeKey === "home";

  return (
    <View className={`app-shell ${isHome ? "route-home" : "route-secondary"}`}>
      {isHome ? <HomeBackgroundMarquee /> : null}
      <AppBar isHome={isHome} />
      <View className="view">
        {props.loading ? <StatePanel title="读取中" text="正在同步赛事数据" /> : null}
        {!props.loading && props.error ? <StatePanel title="暂时不可用" text={props.error} tone="danger" /> : null}
        {!props.loading && !props.error ? props.children : null}
      </View>
      {!isHome ? <FloatingRouteNav routeKey={routeKey} /> : null}
    </View>
  );
}

function AppBar(props: { isHome: boolean }) {
  return (
    <View className={`app-bar ${props.isHome ? "home-bar" : ""}`}>
      <View className="title-line top-only">
        {props.isHome ? (
          <Text className="brand-mark">MRJZ</Text>
        ) : (
          <Button className="icon-button" onClick={goBack}>
            ‹
          </Button>
        )}
      </View>
    </View>
  );
}

function FloatingRouteNav(props: { routeKey: MiniRouteKey }) {
  return (
    <View className="floating-route-nav">
      <View className="route-tabs">
        {routeNavItems.map((item) => (
          <Button
            className={`route-tab ${item.key === props.routeKey ? "active" : ""}`}
            key={item.key}
            onClick={() => switchRoute(item.url)}
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
            <Image className="home-hero-image" mode="aspectFill" src={`/assets/heroes/${hero}.png`} />
          </View>
        ))}
      </View>
    </View>
  );
}

function goBack() {
  const pages = Taro.getCurrentPages();

  if (pages.length > 1) {
    void Taro.navigateBack();
    return;
  }

  void Taro.redirectTo({ url: "/pages/index/index" });
}

function switchRoute(url: string) {
  const currentRoute = Taro.getCurrentPages().at(-1)?.route;

  if (currentRoute && url === `/${currentRoute}`) {
    return;
  }

  void Taro.redirectTo({ url });
}

export function StatePanel(props: { title: string; text: string; tone?: "default" | "danger" }) {
  return (
    <View className={`state-panel ${props.tone === "danger" ? "state-panel-danger" : ""}`}>
      <Text className="state-title">{props.title}</Text>
      <Text className="state-text">{props.text}</Text>
    </View>
  );
}

export function SectionTitle(props: { kicker?: string; title: string; actionText?: string; onAction?: () => void }) {
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

export function StatGrid(props: { items: Array<{ label: string; value: string; hint?: string | undefined }> }) {
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
        <View className="team-logo team-logo-fallback" style={{ backgroundColor: team?.color ?? "#334155" }}>
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

  return (
    <View className={`schedule-card series-card ${isFinished ? "finished" : ""}`} onClick={() => props.onOpen?.()}>
      <View className="schedule-card-head series-meta-row">
        <Text className="schedule-time">{formatDateTime(props.series.scheduledAt)}</Text>
        <Text className="muted">{props.series.groupName || props.series.roundName || seriesTitle(props.series)}</Text>
      </View>
      <View className="schedule-matchup series-vs">
        <Text className="schedule-team">{teamName(props.series.radiantTeam)}</Text>
        <Text className={`schedule-score ${isFinished ? "is-result" : "is-bo"} score-text`}>
          {isFinished ? formatScore(props.series) : (props.series.boType ?? "BO")}
        </Text>
        <Text className="schedule-team is-right">{teamName(props.series.direTeam)}</Text>
      </View>
      <View className="schedule-card-foot series-footer">
        <Text className={`status-tag ${isFinished ? "green" : "blue"}`}>{labelStatus(props.series.status)}</Text>
        <Text className="match-id">{firstMatchId ? `match ${firstMatchId}` : props.series.seriesKind === "tiebreaker" ? "加赛" : "--"}</Text>
      </View>
    </View>
  );
}

export function PlayerAvatar(props: { player: Pick<PlayerListItem, "displayName" | "avatarUrl">; size?: "normal" | "large" }) {
  const className = props.size === "large" ? "player-avatar player-avatar-large" : "player-avatar";

  return props.player.avatarUrl ? (
    <Image className={className} mode="aspectFill" src={props.player.avatarUrl} />
  ) : (
    <View className={`${className} player-avatar-fallback`}>{props.player.displayName.slice(0, 1)}</View>
  );
}
