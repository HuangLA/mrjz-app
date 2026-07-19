import type { MobileData } from "../api";
import type { PlayerDirectoryItem } from "../data";
import {
  DataNotice,
  EmptyState,
  ImageWithFallback,
  PlayerTeamBadge,
  SectionPanel,
  SteamAvatar,
  TournamentScope,
} from "../components/common";
import { playerSortOptions, type PlayerSortKey, type SortDirection } from "../utils";
import type { NavigateFn } from "./StagePage";

export function PlayersPage({
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
  onNavigate: NavigateFn;
  onSort: (sortKey: PlayerSortKey) => void;
}) {
  const error = profileErrors.players;

  return (
    <div className="page-stack">
      <DataNotice loading={loading} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="选手数据榜"
        hint="点击列头切换排序，点击行进入选手主页"
        aside={<span className="pill">{players.length} 名</span>}
      >
        {players.length > 0 ? (
          <div className="player-table-shell">
            <table className="player-table">
              <thead>
                <tr>
                  <PlayerSortHeader
                    label="选手"
                    sortKey="displayName"
                    activeKey={playerSortKey}
                    direction={playerSortDirection}
                    onSort={onSort}
                    className="is-identity"
                  />
                  {playerSortOptions
                    .filter((option) => option.key !== "displayName")
                    .map((option) => (
                      <PlayerSortHeader
                        key={option.key}
                        label={option.label}
                        sortKey={option.key}
                        activeKey={playerSortKey}
                        direction={playerSortDirection}
                        onSort={onSort}
                      />
                    ))}
                  <th className="is-heroes">常用英雄</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <PlayerTableRow
                    key={player.id}
                    player={player}
                    index={index}
                    onNavigate={onNavigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text={error ?? (profileLoading.players ? "读取中" : "暂无")} />
        )}
      </SectionPanel>
    </div>
  );
}

function PlayerSortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: PlayerSortKey;
  activeKey: PlayerSortKey;
  direction: SortDirection;
  onSort: (sortKey: PlayerSortKey) => void;
  className?: string;
}) {
  const active = sortKey === activeKey;
  const option = playerSortOptions.find((item) => item.key === sortKey);
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

function PlayerTableRow({
  player,
  index,
  onNavigate,
}: {
  player: PlayerDirectoryItem;
  index: number;
  onNavigate: NavigateFn;
}) {
  const team = player.currentTeam ?? player.teams[0] ?? null;
  const stats = player.stats;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onNavigate("player", { profileId: player.id });
    }
  };

  return (
    <tr
      className="player-table-row"
      tabIndex={0}
      onClick={() => onNavigate("player", { profileId: player.id })}
      onKeyDown={handleKeyDown}
      style={{ "--row-delay": `${Math.min(index * 24, 360)}ms` } as React.CSSProperties}
    >
      <td className="is-identity">
        <span className="player-cell">
          <span className="player-cell-rank">{index + 1}</span>
          <SteamAvatar player={player} size="small" />
          <span className="player-cell-name">
            <b>{player.displayName}</b>
            <small>ID {player.accountId ?? player.id}</small>
          </span>
          <PlayerTeamBadge team={team} />
        </span>
      </td>
      <td>{stats.totalMatches}</td>
      <td>
        <span className="winrate-cell">
          <b>{stats.winRate}</b>
          <small>
            {stats.wins}W/{stats.losses}L
          </small>
        </span>
      </td>
      <td className="is-strong">{stats.kda}</td>
      <td>{stats.avgKills}</td>
      <td>{stats.avgGpm}</td>
      <td>{stats.avgXpm}</td>
      <td>{stats.avgHeroDamage}</td>
      <td>{stats.avgTowerDamage}</td>
      <td>{stats.avgDamageTaken}</td>
      <td className="is-heroes">
        <span className="player-hero-strip">
          {stats.topHeroes.slice(0, 3).map((hero) => (
            <span key={hero.heroId} title={`${hero.hero} ${hero.picks} 场 ${hero.wins} 胜`}>
              <ImageWithFallback
                src={hero.portrait}
                fallback={hero.icon}
                alt={hero.hero}
                loading="lazy"
              />
            </span>
          ))}
        </span>
      </td>
    </tr>
  );
}
