import { Button, Image, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { ReactNode } from "react";
import { heroIcon } from "./dota";
import type { MatchRecord, PlayerListItem, SeriesSummary, TeamBrief, TeamListItem, TournamentOption } from "./types";
import { formatDateTime, formatDecimal, formatInteger, formatPercent, formatScore, labelStatus, seriesTitle, teamName } from "./utils";

export type MiniRouteKey = "home" | "stage" | "schedule" | "records" | "players" | "teams" | "mine";

const routeNavItems: Array<{ key: MiniRouteKey; label: string; url: string }> = [
  { key: "home", label: "首页", url: "/pages/index/index" },
  { key: "stage", label: "赛事阶段", url: "/pages/stage/index" },
  { key: "schedule", label: "赛程", url: "/pages/schedule/index" },
  { key: "records", label: "比赛记录", url: "/pages/records/index" },
  { key: "players", label: "选手", url: "/pages/players/index" },
  { key: "teams", label: "队伍", url: "/pages/teams/index" },
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
  const showFloatingNav = !isHome && routeKey !== "mine";

  return (
    <View className={`app-shell ${isHome ? "route-home" : "route-secondary"}`}>
      {isHome ? <HomeBackgroundMarquee /> : null}
      <AppBar isHome={isHome} />
      <View className="view">
        {props.loading ? <StatePanel title="读取中" text="正在同步赛事数据" /> : null}
        {!props.loading && props.error ? <StatePanel title="暂时不可用" text={props.error} tone="danger" /> : null}
        {!props.loading && !props.error ? props.children : null}
      </View>
      {showFloatingNav ? <FloatingRouteNav routeKey={routeKey} /> : null}
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
        <Button className="account-link" onClick={() => switchRoute("/pages/mine/index")}>
          我的
        </Button>
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

export function TournamentScope(props: { tournament?: TournamentOption | null | undefined }) {
  const meta = props.tournament;
  const leagueId = meta?.league?.opendotaLeagueId ?? "-";

  return (
    <View className="tournament-scope">
      <View>
        <Text>{meta?.name ?? "选择赛事"}</Text>
        <Text>League {leagueId} · {labelStatus(meta?.status)}</Text>
      </View>
      <Button className="link-button" onClick={() => switchRoute("/pages/index/index")}>
        切换
      </Button>
    </View>
  );
}

export function FilterRow<T extends string>(props: { labels: T[]; value?: T; onChange?: (value: T) => void }) {
  const activeValue = props.value ?? props.labels[0];

  return (
    <View className="filter-row">
      {props.labels.map((label) => (
        <Button className={`filter ${label === activeValue ? "active" : ""}`} key={label} onClick={() => props.onChange?.(label)}>
          {label}
        </Button>
      ))}
    </View>
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
  const statusText = seriesScheduleStatusText(props.series.status);

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
        <Text className={`status-tag ${seriesScheduleStatusClass(statusText)}`}>{statusText}</Text>
        <Text className="match-id">{firstMatchId ? `match ${firstMatchId}` : props.series.seriesKind === "tiebreaker" ? "加赛" : "--"}</Text>
      </View>
    </View>
  );
}

export function seriesScheduleStatusText(status?: string | null): "未开始" | "待补录" | "已完赛" | "延期" {
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

export function PlayerAvatar(props: { player: Pick<PlayerListItem, "displayName" | "avatarUrl">; size?: "normal" | "large" }) {
  const className = props.size === "large" ? "player-avatar player-avatar-large" : "player-avatar";

  return props.player.avatarUrl ? (
    <Image className={className} mode="aspectFill" src={props.player.avatarUrl} />
  ) : (
    <View className={`${className} player-avatar-fallback`}>{props.player.displayName.slice(0, 1)}</View>
  );
}

export function MatchRecordCard(props: { record: MatchRecord; index?: number; onOpen: (matchId: number) => void }) {
  const { record } = props;
  const score = record.radiantScore === null || record.direScore === null ? "- : -" : `${record.radiantScore} : ${record.direScore}`;
  const winnerClass = record.radiantWin === null ? "" : record.radiantWin ? "radiant-win" : "dire-win";
  const heroCount = (record.heroLineups?.radiant.length ?? 0) + (record.heroLineups?.dire.length ?? 0);

  return (
    <View className={`record-card match-record-card ${winnerClass}`}>
      <Button className="record-main" onClick={() => props.onOpen(record.matchId)}>
        <View className="record-head">
          <Text>#{record.matchId}</Text>
          <Text>{formatDateTime(record.startTime)}</Text>
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

function RecordHeroStrip(props: { side: "radiant" | "dire"; heroes: NonNullable<MatchRecord["heroLineups"]>["radiant"] }) {
  return (
    <View className={`record-hero-strip ${props.side}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const hero = props.heroes[index];

        return hero ? (
          <Image className="record-hero" key={`${props.side}:${index}`} mode="aspectFill" src={hero.icon || hero.portrait} />
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

export function PlayerDirectoryCard(props: { player: PlayerListItem; onOpen: (playerId: string) => void }) {
  const { player } = props;
  const team = player.currentTeam ?? player.teams[0] ?? null;
  const rate = clampPercent((player.stats.winRate ?? 0) * 100);

  return (
    <View className="player-stat-card">
      <Button className="player-stat-card-main" style={{ borderLeftColor: team?.color ?? "#5eead4" }} onClick={() => props.onOpen(player.id)}>
        <View className="player-stat-head">
          <SteamAvatar player={player} />
          <View className="player-stat-identity">
            <View className="player-stat-name-row">
              <Text>{player.displayName}</Text>
              <PlayerTeamMark team={team} />
            </View>
            <View className="player-stat-subline">
              <Text className="profile-id-link">ID {player.accountId ?? player.id}</Text>
              <Text>{player.stats.wins}W / {player.stats.losses}L</Text>
            </View>
          </View>
          <View className="player-stat-primary">
            <Text>胜率 <Text>{formatPercent(player.stats.winRate)}</Text></Text>
            <View className="rate-bar"><View style={{ width: `${rate.toFixed(1)}%` }} /></View>
            <Text>{formatDecimal(player.stats.kda)}</Text>
            <Text>KDA</Text>
          </View>
        </View>
        <View className="player-stat-grid">
          <PlayerStatTile label="场次" value={formatInteger(player.stats.totalMatches)} />
          <PlayerStatTile label="GPM" value={formatDecimal(player.stats.avgGpm, 0)} />
          <PlayerStatTile label="XPM" value={formatDecimal(player.stats.avgXpm, 0)} />
          <PlayerStatTile label="击/亡/助" value={`${formatDecimal(player.stats.avgKills)}/${formatDecimal(player.stats.avgDeaths)}/${formatDecimal(player.stats.avgAssists)}`} />
          <PlayerStatTile label="场均经济" value={formatDecimal(player.stats.avgNetWorth, 0)} />
          <PlayerStatTile label="英雄伤害" value={formatDecimal(player.stats.avgHeroDamage, 0)} />
          <PlayerStatTile label="建筑伤害" value={formatDecimal(player.stats.avgTowerDamage, 0)} />
          <PlayerStatTile label="承伤" value={formatDecimal(player.stats.avgDamageTaken, 0)} />
        </View>
        <PlayerHeroStrip heroes={player.stats.topHeroes} />
      </Button>
    </View>
  );
}

export function TeamDirectoryCard(props: { team: TeamListItem; onOpen: (teamId: string) => void }) {
  const { team } = props;

  return (
    <View className="profile-list-card team-card">
      <Button style={{ borderLeftColor: team.color ?? "#f0c36a" }} onClick={() => props.onOpen(team.id)}>
        <View className="profile-avatar-fallback team">{(team.shortName ?? team.name).slice(0, 2).toUpperCase()}</View>
        <View>
          <Text>{team.name}</Text>
          <Text>{team.memberCount} 名成员 · {team.stats.seriesPlayed} 场 · 胜率 {formatPercent(team.stats.winRate)}</Text>
          <Text>{team.stats.gameWins} 胜 / {team.stats.gameLosses} 负 · 入库 {team.stats.linkedMatches} 场</Text>
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

  return <Text className="team-mark" style={{ borderColor: props.team.color ?? "#f0c36a" }}>{props.team.name}</Text>;
}

export function PlayerHeroStrip(props: { heroes: Array<{ heroId: number }> }) {
  if (props.heroes.length === 0) {
    return <View className="player-hero-strip empty"><Text>暂无常用英雄</Text></View>;
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

export function SteamAvatar(props: { player: Pick<PlayerListItem, "displayName" | "avatarUrl">; size?: "normal" | "large" | "small" }) {
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
