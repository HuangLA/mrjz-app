import { useState } from "react";
import type { MobileData } from "../api";
import type { HeroLeaderboardItem } from "../data";
import {
  DataNotice,
  EmptyState,
  PlayerAvatar,
  SectionPanel,
  TournamentScope,
} from "../components/common";
import { formatLeaderboardTotal, formatLeaderboardValue, leaderboardTeamName } from "../utils";
import type { NavigateFn } from "./StagePage";

export function LeaderboardPage({
  data,
  loading,
  onNavigate,
}: {
  data: MobileData;
  loading: boolean;
  onNavigate: NavigateFn;
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
    <div className="page-stack">
      <DataNotice loading={loading} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="英雄榜"
        hint={`只统计参赛 ${data.heroLeaderboards.minMatches} 场以上选手，按称号口径排名`}
        aside={<span className="pill">{leaderboards.length} 榜</span>}
      >
        <div className="leaderboard-grid">
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
      </SectionPanel>
    </div>
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
  onNavigate: NavigateFn;
}) {
  const winner = board.winner;

  return (
    <article className={`leaderboard-card ${expanded ? "expanded" : ""}`}>
      <button
        className="leaderboard-main"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="leaderboard-title">
          <span>{board.title}</span>
          <small>{board.description}</small>
        </div>
        <div className="leaderboard-main-row">
          {winner ? (
            <div className="leaderboard-winner">
              <PlayerAvatar player={winner.player} />
              <div>
                <b>{winner.player.displayName}</b>
                <small>{leaderboardTeamName(winner)}</small>
              </div>
            </div>
          ) : (
            <div className="leaderboard-empty">暂无获得者</div>
          )}
          <div className="leaderboard-action">
            <div className="leaderboard-value">
              <b>{winner ? formatLeaderboardValue(winner.average, board) : "-"}</b>
              <small>{board.metricLabel}</small>
            </div>
            <span className="leaderboard-toggle">
              <span>{expanded ? "收起" : "前五"}</span>
              <span className={`chevron ${expanded ? "is-expanded" : ""}`} aria-hidden="true" />
            </span>
          </div>
        </div>
      </button>
      {expanded ? (
        <div className="leaderboard-candidates">
          {board.candidates.length > 0 ? (
            board.candidates.map((candidate) => (
              <button
                className="leaderboard-row"
                type="button"
                key={`${board.key}-${candidate.player.id}`}
                onClick={() => onNavigate("player", { profileId: candidate.player.id })}
              >
                <span className="leaderboard-rank">#{candidate.rank}</span>
                <PlayerAvatar player={candidate.player} />
                <span className="leaderboard-name">
                  <b>{candidate.player.displayName}</b>
                  <small>
                    {leaderboardTeamName(candidate)} · {candidate.matches} 场
                  </small>
                </span>
                <span className="leaderboard-row-value">
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
