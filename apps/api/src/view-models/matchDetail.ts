export type TeamSide = "radiant" | "dire";

export type ParseStatus = "basic" | "partial" | "parsed";

export type TeamBrief = {
  id: string;
  name: string;
  shortName: string;
  opendotaTeamId: number | null;
  logoUrl: string | null;
  color: string;
};

export type LeagueBrief = {
  id: string;
  name: string;
  opendotaLeagueId: number;
};

export type TournamentBrief = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type StageBrief = {
  id: string;
  tournamentId: string;
  type: "group" | "swiss" | "knockout";
  name: string;
  status: string;
};

export type RoundBrief = {
  id: string;
  stageId: string;
  roundNumber: number;
  name: string;
  status: string;
};

export type SeriesContext = {
  id: string;
  boType: "BO1" | "BO2" | "BO3" | "BO5";
  status: string;
  scheduledAt: string;
  gameIndex: number;
};

export type MatchDetailContext = {
  league: LeagueBrief | null;
  tournament: TournamentBrief | null;
  stage: StageBrief | null;
  round: RoundBrief | null;
  series: SeriesContext | null;
  teams: Record<TeamSide, TeamBrief>;
};

export type MatchHeaderViewModel = {
  matchId: number;
  leagueId: number | null;
  leagueName: string;
  tournamentName: string | null;
  stageName: string | null;
  roundName: string | null;
  radiantWin: boolean;
  winnerSide: TeamSide;
  winnerName: string;
  durationSeconds: number;
  durationText: string;
  gameMode: number | null;
  startTime: string | null;
  endedAt: string | null;
};

export type ScoreSummaryViewModel = {
  radiantScore: number;
  direScore: number;
  scoreText: string;
  radiantTeamName: string;
  direTeamName: string;
  winnerSide: TeamSide;
  winnerName: string;
};

export type ItemSlotViewModel = {
  slot: number;
  itemId: number | null;
};

export type AbilityUpgradeViewModel = {
  level: number;
  abilityId: number;
  time: number | null;
};

export type AghanimSource = "item" | "permanent_buff" | "none";

export type AghanimStateViewModel = {
  hasScepter: boolean;
  hasShard: boolean;
  scepterSource: AghanimSource;
  shardSource: AghanimSource;
  scepterIconState: "active" | "inactive";
  shardIconState: "active" | "inactive";
};

export type MatchPlayerViewModel = {
  accountId: number | null;
  playerSlot: number;
  side: TeamSide;
  team: TeamBrief;
  name: string;
  heroId: number;
  level: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kdaText: string;
  ratingScore: number;
  killParticipation: number | null;
  heroDamageShare: number | null;
  goldPerMin: number | null;
  xpPerMin: number | null;
  netWorth: number | null;
  lastHits: number | null;
  denies: number | null;
  heroDamage: number | null;
  towerDamage: number | null;
  heroHealing: number | null;
  damageTaken: number | null;
  lane: number | null;
  laneRole: number | null;
  items: {
    inventory: ItemSlotViewModel[];
    backpack: ItemSlotViewModel[];
    neutral: ItemSlotViewModel | null;
  };
  abilityBuild: {
    hasData: boolean;
    order: AbilityUpgradeViewModel[];
  };
  aghanim: AghanimStateViewModel;
};

export type MvpSummaryViewModel = {
  playerSlot: number;
  playerName: string;
  side: TeamSide;
  heroId: number;
  score: number;
  title: string;
};

export type MatchAwardCode =
  | "lie_flat"
  | "breaker"
  | "herbalist"
  | "healer"
  | "pianist"
  | "binder"
  | "pressure"
  | "stiff"
  | "ghost"
  | "tough"
  | "violence"
  | "assist"
  | "support"
  | "talker"
  | "rich"
  | "cty"
  | "demolition"
  | "soul";

export type MatchAwardViewModel = {
  code: MatchAwardCode;
  title: string;
  description: string;
  playerSlot: number;
  playerName: string;
  side: TeamSide;
  heroId: number;
  value: number;
  valueText: string;
};

export type DraftActionViewModel = {
  order: number;
  action: "pick" | "ban";
  side: TeamSide | null;
  teamName: string | null;
  heroId: number;
  playerSlot: number | null;
};

export type DraftSummaryViewModel = {
  hasDraft: boolean;
  total: number;
  source: "picks_bans" | "missing";
};

export type WardTimelineEventViewModel = {
  time: number;
  timeText: string;
  type: "observer" | "sentry";
  side: TeamSide | null;
  playerSlot: number | null;
  playerName: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
  removedAt: number | null;
};

export type ChatMessageViewModel = {
  time: number;
  timeText: string;
  type: string;
  side: TeamSide | null;
  playerSlot: number | null;
  playerName: string | null;
  unit: string | null;
  message: string;
};

export type PlayerTrendSeriesViewModel = {
  playerSlot: number;
  playerName: string;
  side: TeamSide;
  heroId: number;
  values: number[];
};

export type AdvantagePointViewModel = {
  minute: number;
  value: number;
};

export type TrendChartsViewModel = {
  hasTrends: boolean;
  intervalSeconds: number;
  playerGold: PlayerTrendSeriesViewModel[];
  playerXp: PlayerTrendSeriesViewModel[];
  goldAdvantage: AdvantagePointViewModel[];
  xpAdvantage: AdvantagePointViewModel[];
  placeholders: {
    economyTrend: string | null;
    experienceTrend: string | null;
  };
};

export type LaneMatchupViewModel = {
  lane: number;
  laneName: string;
  radiantPlayers: Array<Pick<MatchPlayerViewModel, "playerSlot" | "name" | "heroId">>;
  direPlayers: Array<Pick<MatchPlayerViewModel, "playerSlot" | "name" | "heroId">>;
};

export type ComparisonMetricViewModel = {
  key: string;
  label: string;
  radiantValue: number;
  direValue: number;
  radiantShare: number;
};

export type MatchDetailViewModel = {
  match: MatchHeaderViewModel;
  series: SeriesContext | null;
  teams: Record<TeamSide, TeamBrief>;
  score: ScoreSummaryViewModel;
  players: {
    radiant: MatchPlayerViewModel[];
    dire: MatchPlayerViewModel[];
    all: MatchPlayerViewModel[];
  };
  mvp: MvpSummaryViewModel | null;
  awards: MatchAwardViewModel[];
  drafts: DraftActionViewModel[];
  draftSummary: DraftSummaryViewModel;
  vision: {
    hasVisionData: boolean;
    wards: WardTimelineEventViewModel[];
  };
  charts: TrendChartsViewModel;
  lanes: LaneMatchupViewModel[];
  comparisons: ComparisonMetricViewModel[];
  chat: ChatMessageViewModel[];
  parseStatus: ParseStatus;
  dataAvailability: {
    hasAbilityBuilds: boolean;
    hasDraft: boolean;
    hasVision: boolean;
    hasChat: boolean;
    hasTrends: boolean;
  };
  source: {
    provider: "opendota";
    matchId: number;
    normalizedAt: string;
  };
};
