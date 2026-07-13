export type PublicSeriesGame = {
  gameIndex?: number | null;
  matchId?: number | string | null;
  radiantScore?: number | null;
  direScore?: number | null;
};

export declare function hasLinkedMatch(game: PublicSeriesGame): boolean;
export declare function formatSeriesGameResult(game: PublicSeriesGame): string;
export declare function scheduleRoundLabel(input: {
  stageType?: "group" | "swiss" | "knockout" | string | undefined;
  stageName: string;
  roundName: string;
  seriesKind?: string | undefined;
}): string;
