import { useMemo, useState } from "react";
import type { MobileData } from "../api";
import type { HeroStatsItem, HeroStatsMatchEntry } from "../data";
import {
  DataNotice,
  EmptyState,
  ImageWithFallback,
  SectionPanel,
  TournamentScope,
} from "../components/common";
import type { NavigateFn } from "./StagePage";

type HeroSortKey = "hero" | "picks" | "bans" | "winRate" | "pickRate" | "banRate" | "presence";
type SortDirection = "asc" | "desc";

const heroSortOptions: Array<{
  key: HeroSortKey;
  label: string;
  defaultDirection: SortDirection;
}> = [
  { key: "hero", label: "英雄", defaultDirection: "asc" },
  { key: "picks", label: "选择", defaultDirection: "desc" },
  { key: "bans", label: "禁用", defaultDirection: "desc" },
  { key: "winRate", label: "胜率", defaultDirection: "desc" },
  { key: "pickRate", label: "选择率", defaultDirection: "desc" },
  { key: "banRate", label: "禁用率", defaultDirection: "desc" },
  { key: "presence", label: "热度", defaultDirection: "desc" },
];

function percentText(value: number | null): string {
  return value === null ? "--" : `${value.toFixed(1)}%`;
}

function presenceOf(hero: HeroStatsItem): number {
  return hero.picks + hero.bans;
}

function sortHeroes(
  heroes: HeroStatsItem[],
  sortKey: HeroSortKey,
  direction: SortDirection,
): HeroStatsItem[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...heroes].sort((left, right) => {
    let delta = 0;

    switch (sortKey) {
      case "hero":
        delta = left.hero.localeCompare(right.hero, "zh-CN");
        break;
      case "picks":
        delta = left.picks - right.picks;
        break;
      case "bans":
        delta = left.bans - right.bans;
        break;
      case "winRate":
        delta = (left.winRate ?? -1) - (right.winRate ?? -1);
        break;
      case "pickRate":
        delta = (left.pickRate ?? -1) - (right.pickRate ?? -1);
        break;
      case "banRate":
        delta = (left.banRate ?? -1) - (right.banRate ?? -1);
        break;
      case "presence":
        delta = presenceOf(left) - presenceOf(right);
        break;
    }

    if (delta === 0 && sortKey !== "picks") {
      delta = left.picks - right.picks;
    }

    if (delta === 0) {
      delta = left.heroId - right.heroId;
    }

    return delta * sign;
  });
}

export function HeroesPage({
  data,
  loading,
  profileLoading,
  profileErrors,
  onNavigate,
  onOpenMatch,
}: {
  data: MobileData;
  loading: boolean;
  profileLoading: Record<string, boolean>;
  profileErrors: Record<string, string>;
  onNavigate: NavigateFn;
  onOpenMatch: (matchId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<HeroSortKey>("presence");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedHeroes, setExpandedHeroes] = useState<Set<number>>(() => new Set());
  const heroStats = data.heroStats;
  const error = profileErrors.heroStats;
  const sortedHeroes = useMemo(
    () => sortHeroes(heroStats.heroes, sortKey, sortDirection),
    [heroStats.heroes, sortKey, sortDirection],
  );

  const handleSort = (nextKey: HeroSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(heroSortOptions.find((option) => option.key === nextKey)?.defaultDirection ?? "desc");
  };

  const handleToggle = (heroId: number) => {
    setExpandedHeroes((current) => {
      const next = new Set(current);

      if (next.has(heroId)) {
        next.delete(heroId);
      } else {
        next.add(heroId);
      }

      return next;
    });
  };

  return (
    <div className="page-stack">
      <DataNotice loading={loading || Boolean(profileLoading.heroStats)} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="英雄数据统计"
        hint="点击列头切换排序，点击行展开该英雄的出场场次，点击场次进入比赛详情"
        aside={
          <span className="pill">
            {heroStats.heroes.length} 英雄 · {heroStats.totalMatches} 场
          </span>
        }
      >
        {sortedHeroes.length > 0 ? (
          <div className="player-table-shell">
            <table className="player-table hero-table">
              <thead>
                <tr>
                  {heroSortOptions.map((option) => (
                    <HeroSortHeader
                      key={option.key}
                      label={option.label}
                      sortKey={option.key}
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      className={option.key === "hero" ? "is-identity" : ""}
                    />
                  ))}
                  <th className="is-expand" aria-label="展开" />
                </tr>
              </thead>
              <tbody>
                {sortedHeroes.map((hero, index) => (
                  <HeroTableRow
                    key={hero.heroId}
                    hero={hero}
                    index={index}
                    totalMatches={heroStats.totalMatches}
                    expanded={expandedHeroes.has(hero.heroId)}
                    onToggle={handleToggle}
                    onOpenMatch={onOpenMatch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text={error ?? (profileLoading.heroStats ? "读取中" : "暂无英雄数据")} />
        )}
      </SectionPanel>
    </div>
  );
}

function HeroSortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: HeroSortKey;
  activeKey: HeroSortKey;
  direction: SortDirection;
  onSort: (sortKey: HeroSortKey) => void;
  className?: string;
}) {
  const active = sortKey === activeKey;
  const option = heroSortOptions.find((item) => item.key === sortKey);
  const shownDirection = active ? direction : (option?.defaultDirection ?? "desc");

  return (
    <th className={`is-sortable ${active ? "is-active" : ""} ${className}`.trim()}>
      <button type="button" aria-pressed={active} onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <i aria-hidden="true">{shownDirection === "desc" ? "↓" : "↑"}</i>
      </button>
    </th>
  );
}

function HeroTableRow({
  hero,
  index,
  totalMatches,
  expanded,
  onToggle,
  onOpenMatch,
}: {
  hero: HeroStatsItem;
  index: number;
  totalMatches: number;
  expanded: boolean;
  onToggle: (heroId: number) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const presenceRate =
    totalMatches > 0 ? ((hero.picks + hero.bans) / totalMatches) * 100 : null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(hero.heroId);
    }
  };

  return (
    <>
      <tr
        className={`player-table-row hero-table-row ${expanded ? "is-expanded" : ""}`}
        tabIndex={0}
        onClick={() => onToggle(hero.heroId)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        style={{ "--row-delay": `${Math.min(index * 24, 360)}ms` } as React.CSSProperties}
      >
        <td className="is-identity">
          <span className="player-cell">
            <span className="player-cell-rank">{index + 1}</span>
            <span className="hero-cell-portrait">
              <ImageWithFallback
                src={hero.portrait}
                fallback={hero.icon}
                alt={hero.hero}
                loading="lazy"
              />
            </span>
            <span className="player-cell-name">
              <b>{hero.hero}</b>
              <small>#{hero.heroId}</small>
            </span>
          </span>
        </td>
        <td className="is-strong">{hero.picks}</td>
        <td className="is-strong">{hero.bans}</td>
        <td>
          <span className="winrate-cell">
            <b>{percentText(hero.winRate)}</b>
            <small>
              {hero.wins}W/{hero.losses}L
            </small>
          </span>
        </td>
        <td>{percentText(hero.pickRate)}</td>
        <td>{percentText(hero.banRate)}</td>
        <td>
          <span className="winrate-cell">
            <b>{percentText(presenceRate)}</b>
            <small>{hero.picks + hero.bans} 次</small>
          </span>
        </td>
        <td className="is-expand">
          <span className={`chevron ${expanded ? "is-expanded" : ""}`} aria-hidden="true" />
        </td>
      </tr>
      {expanded ? (
        <tr className="hero-matches-row">
          <td colSpan={8}>
            <HeroMatchList matches={hero.matches} onOpenMatch={onOpenMatch} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function HeroMatchList({
  matches,
  onOpenMatch,
}: {
  matches: HeroStatsMatchEntry[];
  onOpenMatch: (matchId: string) => void;
}) {
  if (matches.length === 0) {
    return <EmptyState text="该英雄仅被禁用，暂无出场场次" />;
  }

  return (
    <div className="hero-match-list">
      {matches.map((match) => {
        const heroTeamName = match.side === "radiant" ? match.radiantTeamName : match.direTeamName;
        const score =
          match.radiantScore === null || match.direScore === null
            ? "-:-"
            : `${match.radiantScore}:${match.direScore}`;
        const kda =
          match.kills === null || match.deaths === null || match.assists === null
            ? "-/-/-"
            : `${match.kills}/${match.deaths}/${match.assists}`;
        const economy = [
          match.goldPerMin === null ? null : `GPM ${match.goldPerMin}`,
          match.xpPerMin === null ? null : `XPM ${match.xpPerMin}`,
          match.netWorth === null ? null : `经济 ${compactNumber(match.netWorth)}`,
          match.heroDamage === null ? null : `伤害 ${compactNumber(match.heroDamage)}`,
        ]
          .filter((part) => part !== null)
          .join(" · ");

        return (
          <button
            key={`${match.matchId}-${match.side}-${match.playerName}`}
            type="button"
            className="hero-match-row"
            onClick={(event) => {
              event.stopPropagation();
              onOpenMatch(match.matchId);
            }}
          >
            <span className="hero-match-time">
              <b>{match.startTime}</b>
              <small>{match.duration}</small>
            </span>
            <span className="hero-match-teams">
              <b>
                {match.radiantTeamName} vs {match.direTeamName}
              </b>
              <small>
                {match.playerName} · {heroTeamName}（{match.side === "radiant" ? "天辉" : "夜魇"}）
              </small>
            </span>
            <span className="hero-match-stats">
              <b>{kda}</b>
              <small>{economy || "暂无数据"}</small>
            </span>
            <span className="hero-match-score">{score}</span>
            <span
              className={`status-tag ${
                match.result === "win" ? "green" : match.result === "loss" ? "red" : "blue"
              }`}
            >
              {match.result === "win" ? "胜" : match.result === "loss" ? "负" : "未知"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function compactNumber(value: number): string {
  return value >= 10000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
