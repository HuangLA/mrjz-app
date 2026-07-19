import { useState } from "react";
import { hasLinkedMatch, scheduleRoundLabel, seriesGameWinnerLabel } from "@mrjz/shared/schedule";
import type { ScheduleItem } from "../data";
import { parseScheduleScore, statusClass } from "../utils";

export function ScheduleCard({
  match,
  onOpenMatch,
}: {
  match: ScheduleItem;
  onOpenMatch: (matchId: string) => void;
}) {
  const [gamesExpanded, setGamesExpanded] = useState(false);
  const isFinished = match.status === "已完赛";
  const scoreText = match.score ?? match.bo;
  const parsedScore = parseScheduleScore(match.score);
  const teamAIsWinner = parsedScore !== null && parsedScore.left > parsedScore.right;
  const teamBIsWinner = parsedScore !== null && parsedScore.right > parsedScore.left;
  const games = match.games ?? [];
  const hasGameDetails = games.some(hasLinkedMatch);
  const roundLabel = scheduleRoundLabel({
    stageType: match.stageType,
    stageName: match.stage,
    roundName: match.round,
    seriesKind: match.kind,
  });

  return (
    <article className={`schedule-card ${isFinished ? "finished" : ""}`}>
      <div className="schedule-card-head">
        <b>{match.time}</b>
        <span>{roundLabel}</span>
      </div>
      <div className="schedule-matchup">
        <span
          className={`schedule-team ${teamAIsWinner ? "is-winner" : teamBIsWinner ? "is-dimmed" : ""}`}
        >
          {match.teamA}
        </span>
        <strong className={`schedule-score ${match.score ? "is-result" : "is-bo"}`}>
          {scoreText}
        </strong>
        <span
          className={`schedule-team is-right ${teamBIsWinner ? "is-winner" : teamAIsWinner ? "is-dimmed" : ""}`}
        >
          {match.teamB}
        </span>
      </div>
      <div className="schedule-card-foot">
        <span className={`status-tag ${statusClass(match.status)}`}>{match.status}</span>
        {hasGameDetails ? (
          <button
            className="series-games-toggle"
            type="button"
            aria-expanded={gamesExpanded}
            onClick={() => setGamesExpanded((current) => !current)}
          >
            <span>{games.length} 场比赛</span>
            <span className={`chevron ${gamesExpanded ? "is-expanded" : ""}`} aria-hidden="true" />
          </button>
        ) : (
          <small>--</small>
        )}
      </div>
      {hasGameDetails && gamesExpanded ? (
        <div className="series-games-list">
          {games.map((game) => {
            const isLinked = hasLinkedMatch(game);
            const content = (
              <>
                <span className="series-game-index">第 {game.gameIndex} 局</span>
                <strong className="series-game-winner">
                  {isLinked
                    ? seriesGameWinnerLabel({
                        winnerTeamId: game.winnerTeamId,
                        radiantTeam: { id: match.teamAId, name: match.teamA },
                        direTeam: { id: match.teamBId, name: match.teamB },
                      })
                    : "比赛 ID 未关联"}
                </strong>
                <span className="series-game-arrow" aria-hidden="true">
                  {isLinked ? "›" : ""}
                </span>
              </>
            );

            return isLinked ? (
              <button
                className="series-game-row"
                type="button"
                aria-label={`打开第 ${game.gameIndex} 局比赛详情`}
                key={game.gameIndex}
                onClick={() => onOpenMatch(String(game.matchId))}
              >
                {content}
              </button>
            ) : (
              <div className="series-game-row is-disabled" key={game.gameIndex}>
                {content}
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
