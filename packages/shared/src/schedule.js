export function hasLinkedMatch(game) {
  if (typeof game.matchId === "number") {
    return Number.isSafeInteger(game.matchId) && game.matchId > 0;
  }

  return typeof game.matchId === "string" && game.matchId.trim().length > 0;
}

export function seriesGameWinnerLabel(input) {
  if (input.winnerTeamId === input.radiantTeam.id) {
    return `${input.radiantTeam.name} 胜`;
  }

  if (input.winnerTeamId === input.direTeam.id) {
    return `${input.direTeam.name} 胜`;
  }

  return "查看详情";
}

export function scheduleRoundLabel(input) {
  if (input.stageType === "group") {
    return input.seriesKind === "tiebreaker" ? "小组赛 · 加赛" : "小组赛";
  }

  const round = input.seriesKind === "tiebreaker" ? `加赛 · ${input.roundName}` : input.roundName;
  return [input.stageName, round].filter(Boolean).join(" · ");
}
