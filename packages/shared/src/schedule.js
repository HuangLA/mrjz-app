export function hasLinkedMatch(game) {
  if (typeof game.matchId === "number") {
    return Number.isSafeInteger(game.matchId) && game.matchId > 0;
  }

  return typeof game.matchId === "string" && game.matchId.trim().length > 0;
}

export function formatSeriesGameResult(game) {
  if (game.radiantScore === null || game.radiantScore === undefined) {
    return "结果待同步";
  }

  if (game.direScore === null || game.direScore === undefined) {
    return "结果待同步";
  }

  return `${game.radiantScore} : ${game.direScore}`;
}

export function scheduleRoundLabel(input) {
  if (input.stageType === "group") {
    return input.seriesKind === "tiebreaker" ? "小组赛 · 加赛" : "小组赛";
  }

  const round = input.seriesKind === "tiebreaker" ? `加赛 · ${input.roundName}` : input.roundName;
  return [input.stageName, round].filter(Boolean).join(" · ");
}
