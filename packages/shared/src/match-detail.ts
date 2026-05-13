export type DotaTeamSide = "radiant" | "dire";

export type DraftActionType = "ban" | "pick";

export type AghanimState = {
  scepter: boolean;
  shard: boolean;
  source: "items" | "permanent_buffs" | "mixed" | "unknown";
};

export type AbilityUpgrade = {
  level: number;
  abilityId: number;
  time?: number;
};

export type DraftAction = {
  order: number;
  type: DraftActionType;
  team: DotaTeamSide;
  heroId: number;
  playerSlot?: number;
  timeTaken?: number;
};

export type WardTimelineEvent = {
  id: string;
  time: number;
  team: DotaTeamSide;
  playerSlot: number;
  playerName: string;
  type: "observer" | "sentry";
  action: "placed" | "expired" | "destroyed";
  x?: number;
  y?: number;
};

export type ChatMessage = {
  time: number;
  playerSlot?: number;
  playerName: string;
  team?: DotaTeamSide;
  message: string;
  channel: "all" | "team" | "system";
};

export type MatchDetailPlayer = {
  playerSlot: number;
  accountId?: number;
  name: string;
  team: DotaTeamSide;
  heroId: number;
  heroName: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  items: number[];
  backpack: number[];
  neutralItem?: number;
  abilityBuild: AbilityUpgrade[];
  aghanim: AghanimState;
};

export type MatchDetailDraft = {
  hasDraft: boolean;
  actions: DraftAction[];
};

export type MatchTrendSeries = {
  times: number[];
  radiantGoldAdvantage: number[];
  radiantXpAdvantage: number[];
};

export type MatchDetailViewModel = {
  matchId: number;
  tournamentId: string;
  stageId: string;
  roundId: string;
  seriesId: string;
  gameIndex: number;
  leagueId: number;
  startedAt: string;
  durationSeconds: number;
  radiantWin: boolean;
  radiantScore: number;
  direScore: number;
  radiantTeam: {
    id: string;
    name: string;
    shortName: string;
  };
  direTeam: {
    id: string;
    name: string;
    shortName: string;
  };
  players: MatchDetailPlayer[];
  draft: MatchDetailDraft;
  wards: WardTimelineEvent[];
  chat: ChatMessage[];
  trends: MatchTrendSeries;
};
