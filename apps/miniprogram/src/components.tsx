import { Button, Image, Picker, Text, View } from "@tarojs/components";
import type { ReactNode } from "react";
import type { PlayerListItem, SeriesSummary, TeamBrief, TournamentOption } from "./types";
import { formatDateTime, formatScore, labelStatus, seriesTitle, teamName } from "./utils";

export function PageShell(props: { children: ReactNode; loading?: boolean; error?: string }) {
  return (
    <View className="page-shell">
      {props.loading ? <StatePanel title="读取中" text="正在同步赛事数据" /> : null}
      {!props.loading && props.error ? <StatePanel title="暂时不可用" text={props.error} tone="danger" /> : null}
      {!props.loading && !props.error ? props.children : null}
    </View>
  );
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
      <View>
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
        <View>
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
    <View className="stat-grid">
      {props.items.map((item) => (
        <View className="stat-cell" key={item.label}>
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

  return (
    <View className="series-card" onClick={() => props.onOpen?.()}>
      <View className="series-meta-row">
        <Text className="badge">{props.series.boType ?? "BO"}</Text>
        <Text className="muted">{formatDateTime(props.series.scheduledAt)}</Text>
        <Text className="status-text">{labelStatus(props.series.status)}</Text>
      </View>
      <View className="series-vs">
        <TeamBadge team={props.series.radiantTeam} />
        <View className="score-block">
          <Text className="score-text">{formatScore(props.series)}</Text>
          <Text className="muted">{props.series.seriesKind === "tiebreaker" ? "加赛" : "常规"}</Text>
        </View>
        <TeamBadge team={props.series.direTeam} align="right" />
      </View>
      <View className="series-footer">
        <Text className="muted">{props.series.groupName || props.series.roundName || seriesTitle(props.series)}</Text>
        {firstMatchId ? <Text className="match-id">match {firstMatchId}</Text> : null}
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
