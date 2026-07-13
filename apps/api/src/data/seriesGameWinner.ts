export type SeriesGameWinnerInput = {
  storedWinnerTeamId: string | null;
  rawRadiantWin: boolean | null;
  rawRadiantTeamId: number | null;
  rawDireTeamId: number | null;
  seriesRadiantTeamId: string;
  seriesDireTeamId: string;
  seriesRadiantOpenDotaTeamId: number | null;
  seriesDireOpenDotaTeamId: number | null;
};

export function resolveSeriesGameWinnerTeamId(input: SeriesGameWinnerInput): string | null {
  const winningOpenDotaTeamId =
    input.rawRadiantWin === null
      ? null
      : input.rawRadiantWin
        ? input.rawRadiantTeamId
        : input.rawDireTeamId;

  if (
    winningOpenDotaTeamId !== null &&
    winningOpenDotaTeamId === input.seriesRadiantOpenDotaTeamId
  ) {
    return input.seriesRadiantTeamId;
  }

  if (winningOpenDotaTeamId !== null && winningOpenDotaTeamId === input.seriesDireOpenDotaTeamId) {
    return input.seriesDireTeamId;
  }

  if (
    input.storedWinnerTeamId === input.seriesRadiantTeamId ||
    input.storedWinnerTeamId === input.seriesDireTeamId
  ) {
    return input.storedWinnerTeamId;
  }

  return null;
}
