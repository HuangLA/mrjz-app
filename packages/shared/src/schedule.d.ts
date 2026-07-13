export type PublicSeriesGame = {
  gameIndex?: number | null;
  matchId?: number | string | null;
  winnerTeamId?: string | null;
};

export declare function hasLinkedMatch(game: PublicSeriesGame): boolean;
export declare function seriesGameWinnerLabel(input: {
  winnerTeamId?: string | null;
  radiantTeam: { id: string; name: string };
  direTeam: { id: string; name: string };
}): string;
export declare function scheduleRoundLabel(input: {
  stageType?: "group" | "swiss" | "knockout" | string | undefined;
  stageName: string;
  roundName: string;
  seriesKind?: string | undefined;
}): string;
