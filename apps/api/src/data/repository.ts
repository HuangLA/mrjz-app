import {
  SqliteTournamentRepository,
  type CreateRoundInput,
  type CreateSeriesInput,
  type CreateStageInput,
  type CreateKnockoutBracketInput,
  type CreateSyncTaskInput,
  type CreateTeamInput,
  type CreatePlayerInput,
  type CreateTournamentInput,
  type LeagueSyncTarget,
  type LinkOpenDotaMatchInput,
  type OpenDotaMatchListItem,
  type LeagueOption,
  type OpenDotaMatchCache,
  type RunningLeagueSyncTarget,
  type SyncTaskView,
  type TournamentPlayerDetail,
  type TournamentPlayerListItem,
  type TournamentTeamDetail,
  type TournamentTeamListItem,
  type UpdateTournamentLifecycleInput,
  type UpdateGameResultInput,
  type UpsertOpenDotaMatchInput,
  type AddTeamMemberInput,
  type AdvanceBracketNodeInput,
  type KnockoutBracketResult,
  type RemoveTeamMemberInput,
  type UpdateTeamInput,
  type EntityBackfillSummary,
  type SteamPlayerProfileInput,
} from "./sqliteRepository.js";
import type {
  BracketNode,
  StageRound,
  StandingRow,
  TournamentDetail,
  TournamentListItem,
} from "../view-models/tournament.js";
import type { MatchDetailViewModel } from "../view-models/matchDetail.js";

type DataSourceInfo = {
  dataSource: "sqlite";
  databasePath: string;
};

type Repository = {
  info: DataSourceInfo;
  getMatchDetail(matchIdParam: string): MatchDetailViewModel | undefined;
  listTournaments(): TournamentListItem[];
  createTournament(input: CreateTournamentInput): TournamentDetail;
  getTournamentDetail(id: string): TournamentDetail | undefined;
  getStageStandings(stageId: string): StandingRow[] | undefined;
  getStageRounds(stageId: string): StageRound[] | undefined;
  getStageBracket(stageId: string): BracketNode[] | undefined;
  listLeagues(): LeagueOption[];
  listSyncTasks(): SyncTaskView[];
  listRunningLeagueSyncTargets(): RunningLeagueSyncTarget[];
  listLeagueSyncTargets(statuses?: Array<LeagueSyncTarget["status"]>): LeagueSyncTarget[];
  listTournamentOpenDotaMatches(tournamentId: string, limit?: number): OpenDotaMatchListItem[] | undefined;
  listTournamentTeams(tournamentId: string): TournamentTeamListItem[] | undefined;
  listTournamentPlayers(tournamentId: string): TournamentPlayerListItem[] | undefined;
  getTournamentTeamDetail(tournamentId: string, teamId: string): TournamentTeamDetail | undefined;
  getTournamentPlayerDetail(tournamentId: string, playerId: string): TournamentPlayerDetail | undefined;
  backfillCachedTournamentEntities(tournamentId?: string): EntityBackfillSummary;
  listTournamentPlayerAccountIds(tournamentId: string): number[];
  updatePlayerSteamProfiles(profiles: SteamPlayerProfileInput[]): number;
  getOpenDotaMatchCache(matchId: number): OpenDotaMatchCache | undefined;
  upsertOpenDotaMatch(input: UpsertOpenDotaMatchInput): OpenDotaMatchCache;
  updateTournamentLifecycle(tournamentId: string, input: UpdateTournamentLifecycleInput): TournamentDetail;
  createTeam(input: CreateTeamInput): unknown;
  updateTeam(teamId: string, input: UpdateTeamInput): unknown;
  createPlayer(input: CreatePlayerInput): unknown;
  addTeamMember(input: AddTeamMemberInput): unknown;
  removeTeamMember(input: RemoveTeamMemberInput): unknown;
  createStage(input: CreateStageInput): unknown;
  createKnockoutBracket(tournamentId: string, input: CreateKnockoutBracketInput): KnockoutBracketResult;
  advanceBracketNode(nodeId: string, input: AdvanceBracketNodeInput): BracketNode[];
  createRound(input: CreateRoundInput): unknown;
  createSeries(input: CreateSeriesInput): unknown;
  updateSeriesGameResult(seriesId: string, gameIndex: number, input: UpdateGameResultInput): unknown;
  linkOpenDotaMatchToSeries(tournamentId: string, matchId: number, input: LinkOpenDotaMatchInput): unknown;
  createSyncTask(input: CreateSyncTaskInput): SyncTaskView;
};

const repository: Repository = new SqliteTournamentRepository();

export function getRepositoryInfo(): DataSourceInfo {
  return repository.info;
}

export function getMatchDetail(matchIdParam: string) {
  return repository.getMatchDetail(matchIdParam);
}

export function listTournaments() {
  return repository.listTournaments();
}

export function createTournament(input: CreateTournamentInput) {
  return repository.createTournament(input);
}

export function getTournamentDetail(id: string) {
  return repository.getTournamentDetail(id);
}

export function getStageStandings(stageId: string) {
  return repository.getStageStandings(stageId);
}

export function getStageRounds(stageId: string) {
  return repository.getStageRounds(stageId);
}

export function getStageBracket(stageId: string) {
  return repository.getStageBracket(stageId);
}

export function listLeagues() {
  return repository.listLeagues();
}

export function listSyncTasks() {
  return repository.listSyncTasks();
}

export function listRunningLeagueSyncTargets() {
  return repository.listRunningLeagueSyncTargets();
}

export function listLeagueSyncTargets(statuses?: Array<LeagueSyncTarget["status"]>) {
  return repository.listLeagueSyncTargets(statuses);
}

export function listTournamentOpenDotaMatches(tournamentId: string, limit?: number) {
  return repository.listTournamentOpenDotaMatches(tournamentId, limit);
}

export function listTournamentTeams(tournamentId: string) {
  return repository.listTournamentTeams(tournamentId);
}

export function listTournamentPlayers(tournamentId: string) {
  return repository.listTournamentPlayers(tournamentId);
}

export function getTournamentTeamDetail(tournamentId: string, teamId: string) {
  return repository.getTournamentTeamDetail(tournamentId, teamId);
}

export function getTournamentPlayerDetail(tournamentId: string, playerId: string) {
  return repository.getTournamentPlayerDetail(tournamentId, playerId);
}

export function backfillCachedTournamentEntities(tournamentId?: string) {
  return repository.backfillCachedTournamentEntities(tournamentId);
}

export function listTournamentPlayerAccountIds(tournamentId: string) {
  return repository.listTournamentPlayerAccountIds(tournamentId);
}

export function updatePlayerSteamProfiles(profiles: SteamPlayerProfileInput[]) {
  return repository.updatePlayerSteamProfiles(profiles);
}

export function getOpenDotaMatchCache(matchId: number) {
  return repository.getOpenDotaMatchCache(matchId);
}

export function upsertOpenDotaMatch(input: UpsertOpenDotaMatchInput) {
  return repository.upsertOpenDotaMatch(input);
}

export function updateTournamentLifecycle(tournamentId: string, input: UpdateTournamentLifecycleInput) {
  return repository.updateTournamentLifecycle(tournamentId, input);
}

export function createTeam(input: CreateTeamInput) {
  return repository.createTeam(input);
}

export function updateTeam(teamId: string, input: UpdateTeamInput) {
  return repository.updateTeam(teamId, input);
}

export function createPlayer(input: CreatePlayerInput) {
  return repository.createPlayer(input);
}

export function addTeamMember(input: AddTeamMemberInput) {
  return repository.addTeamMember(input);
}

export function removeTeamMember(input: RemoveTeamMemberInput) {
  return repository.removeTeamMember(input);
}

export function createStage(input: CreateStageInput) {
  return repository.createStage(input);
}

export function createKnockoutBracket(tournamentId: string, input: CreateKnockoutBracketInput) {
  return repository.createKnockoutBracket(tournamentId, input);
}

export function advanceBracketNode(nodeId: string, input: AdvanceBracketNodeInput) {
  return repository.advanceBracketNode(nodeId, input);
}

export function createRound(input: CreateRoundInput) {
  return repository.createRound(input);
}

export function createSeries(input: CreateSeriesInput) {
  return repository.createSeries(input);
}

export function updateSeriesGameResult(seriesId: string, gameIndex: number, input: UpdateGameResultInput) {
  return repository.updateSeriesGameResult(seriesId, gameIndex, input);
}

export function linkOpenDotaMatchToSeries(tournamentId: string, matchId: number, input: LinkOpenDotaMatchInput) {
  return repository.linkOpenDotaMatchToSeries(tournamentId, matchId, input);
}

export function createSyncTask(input: CreateSyncTaskInput) {
  return repository.createSyncTask(input);
}
