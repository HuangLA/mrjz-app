import {
  SqliteTournamentRepository,
  type AdminCreatePlayerTagInput,
  type AdminAuditLogInput,
  type AdminLoginInput,
  type AdminSessionView,
  type AdminTagPlayerItem,
  type AdminUserView,
  type AppUserMeView,
  type AppUserStatsView,
  type BindDotaAccountInput,
  type CreateRoundInput,
  type CreateSeriesInput,
  type CreateStageInput,
  type CreateKnockoutBracketInput,
  type CreateSyncTaskInput,
  type CreateTeamInput,
  type CreatePlayerInput,
  type CreateTournamentInput,
  type DeletePlayerTagInput,
  type DotaAccountBindingView,
  type LeagueSyncTarget,
  type LinkOpenDotaMatchInput,
  type LikePlayerTagInput,
  type ListAdminTagPlayersInput,
  type ListAdminTagsInput,
  type TournamentHeroLeaderboardsView,
  type OpenDotaMatchListItem,
  type LeagueOption,
  type OpenDotaMatchCache,
  type PlayerTagView,
  type ReviewPlayerTagInput,
  type RunningLeagueSyncTarget,
  type SubmitPlayerTagInput,
  type SyncTaskView,
  type TournamentPlayerDetail,
  type TournamentPlayerListItem,
  type TournamentTeamDetail,
  type TournamentTeamListItem,
  type UpdateTournamentLifecycleInput,
  type UpdateGameResultInput,
  type AppUserView,
  type UpsertAppUserInput,
  type UserSessionView,
  type UpsertOpenDotaMatchInput,
  type AddTeamMemberInput,
  type AdvanceBracketNodeInput,
  type AddStageGroupTeamInput,
  type AdjustPlayerTagLikesInput,
  type ClearTournamentMatchRecordsResult,
  type ClearTournamentScheduleRecordsResult,
  type CreateStageGroupInput,
  type KnockoutBracketResult,
  type LockOfficialScheduleRosterInput,
  type GenerateGroupRoundRobinInput,
  type GenerateSwissPairingsInput,
  type ConfirmSwissRoundInput,
  type OfficialSchedulePublicStatus,
  type RandomizeStageGroupsInput,
  type RemoveTeamMemberInput,
  type RetractBracketNodeInput,
  type SetBracketNodeSlotInput,
  type UpdateStageManualRanksInput,
  type UpdateOfficialScheduleConfigInput,
  type UpdateStageGroupInput,
  type UpdateSeriesInput,
  type UpdateSeriesResultInput,
  type UpdateTeamInput,
  type EntityBackfillSummary,
  type SteamPlayerProfileInput,
} from "./sqliteRepository.js";
import type {
  BracketNode,
  OfficialScheduleManagement,
  StageGroup,
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
  listTournamentHeroLeaderboards(tournamentId: string): TournamentHeroLeaderboardsView | undefined;
  getTournamentTeamDetail(tournamentId: string, teamId: string): TournamentTeamDetail | undefined;
  getTournamentPlayerDetail(tournamentId: string, playerId: string): TournamentPlayerDetail | undefined;
  getAppUser(userId: string): AppUserView | undefined;
  upsertAppUser(input: UpsertAppUserInput): AppUserView;
  createUserSession(userId: string): UserSessionView;
  resolveAppUserBySessionToken(token: string): AppUserView | undefined;
  revokeUserSession(token: string): { revoked: true };
  getAppUserMe(userId: string): AppUserMeView | undefined;
  bindAppUserDotaAccount(userId: string, input: BindDotaAccountInput): DotaAccountBindingView;
  getAppUserStats(userId: string): AppUserStatsView | undefined;
  loginAdmin(input: AdminLoginInput): AdminSessionView;
  resolveAdminBySessionToken(token: string): AdminUserView | undefined;
  revokeAdminSession(token: string): { revoked: true };
  recordAdminAudit(input: AdminAuditLogInput): void;
  listPlayerTags(tournamentId: string, playerId: string): PlayerTagView[] | undefined;
  submitPlayerTag(tournamentId: string, playerId: string, input: SubmitPlayerTagInput): PlayerTagView;
  likePlayerTag(tagId: string, input: LikePlayerTagInput): PlayerTagView;
  unlikePlayerTag(tagId: string, input: LikePlayerTagInput): PlayerTagView;
  adjustPlayerTagLikes(tagId: string, input: AdjustPlayerTagLikesInput): PlayerTagView;
  listAdminTagPlayers(input?: ListAdminTagPlayersInput): AdminTagPlayerItem[];
  createAdminPlayerTag(tournamentId: string, playerId: string, input: AdminCreatePlayerTagInput): PlayerTagView;
  listAdminTags(input?: ListAdminTagsInput): PlayerTagView[];
  updatePlayerTagReview(tagId: string, input: ReviewPlayerTagInput): PlayerTagView;
  deletePlayerTag(tagId: string, input?: DeletePlayerTagInput): { deleted: true; tagId: string };
  getOfficialScheduleManagement(tournamentId: string): OfficialScheduleManagement | undefined;
  getOfficialSchedulePublicStatus(tournamentId: string): OfficialSchedulePublicStatus | undefined;
  updateOfficialScheduleConfig(tournamentId: string, input: UpdateOfficialScheduleConfigInput): OfficialScheduleManagement;
  lockOfficialScheduleRoster(tournamentId: string, input: LockOfficialScheduleRosterInput): OfficialScheduleManagement;
  unlockOfficialScheduleRoster(tournamentId: string, actor?: string): OfficialScheduleManagement;
  publishOfficialSchedule(tournamentId: string, actor?: string): OfficialScheduleManagement;
  withdrawOfficialSchedule(tournamentId: string, actor?: string): OfficialScheduleManagement;
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
  listStageGroups(stageId: string): StageGroup[] | undefined;
  createStageGroup(input: CreateStageGroupInput): StageGroup;
  updateStageGroup(groupId: string, input: UpdateStageGroupInput): StageGroup;
  deleteStageGroup(groupId: string): { deleted: true; groupId: string };
  randomizeStageGroups(stageId: string, input: RandomizeStageGroupsInput): StageGroup[];
  generateGroupRoundRobin(stageId: string, input: GenerateGroupRoundRobinInput): StageRound[];
  updateStageManualRanks(stageId: string, input: UpdateStageManualRanksInput): StandingRow[];
  generateSwissPairings(stageId: string, input: GenerateSwissPairingsInput): StageRound;
  confirmSwissRound(roundId: string, input: ConfirmSwissRoundInput): StageRound;
  retractSwissRound(roundId: string, input: ConfirmSwissRoundInput): StageRound[];
  addStageGroupTeam(input: AddStageGroupTeamInput): StageGroup;
  removeStageGroupTeam(groupId: string, teamId: string): StageGroup;
  createKnockoutBracket(tournamentId: string, input: CreateKnockoutBracketInput): KnockoutBracketResult;
  advanceBracketNode(nodeId: string, input: AdvanceBracketNodeInput): BracketNode[];
  retractBracketNode(nodeId: string, input?: RetractBracketNodeInput): BracketNode[];
  setBracketNodeSlot(nodeId: string, input: SetBracketNodeSlotInput): BracketNode[];
  createRound(input: CreateRoundInput): unknown;
  createSeries(input: CreateSeriesInput): unknown;
  updateSeries(seriesId: string, input: UpdateSeriesInput): unknown;
  updateSeriesResult(seriesId: string, input: UpdateSeriesResultInput): unknown;
  deleteSeries(seriesId: string): { deleted: true; seriesId: string };
  clearTournamentMatchRecords(tournamentId: string): ClearTournamentMatchRecordsResult;
  clearTournamentScheduleRecords(tournamentId: string): ClearTournamentScheduleRecordsResult;
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

export function listTournamentHeroLeaderboards(tournamentId: string) {
  return repository.listTournamentHeroLeaderboards(tournamentId);
}

export function getTournamentTeamDetail(tournamentId: string, teamId: string) {
  return repository.getTournamentTeamDetail(tournamentId, teamId);
}

export function getTournamentPlayerDetail(tournamentId: string, playerId: string) {
  return repository.getTournamentPlayerDetail(tournamentId, playerId);
}

export function getAppUser(userId: string) {
  return repository.getAppUser(userId);
}

export function upsertAppUser(input: UpsertAppUserInput) {
  return repository.upsertAppUser(input);
}

export function createUserSession(userId: string) {
  return repository.createUserSession(userId);
}

export function resolveAppUserBySessionToken(token: string) {
  return repository.resolveAppUserBySessionToken(token);
}

export function revokeUserSession(token: string) {
  return repository.revokeUserSession(token);
}

export function getAppUserMe(userId: string) {
  return repository.getAppUserMe(userId);
}

export function bindAppUserDotaAccount(userId: string, input: BindDotaAccountInput) {
  return repository.bindAppUserDotaAccount(userId, input);
}

export function getAppUserStats(userId: string) {
  return repository.getAppUserStats(userId);
}

export function loginAdmin(input: AdminLoginInput) {
  return repository.loginAdmin(input);
}

export function resolveAdminBySessionToken(token: string) {
  return repository.resolveAdminBySessionToken(token);
}

export function revokeAdminSession(token: string) {
  return repository.revokeAdminSession(token);
}

export function recordAdminAudit(input: AdminAuditLogInput) {
  return repository.recordAdminAudit(input);
}

export function listPlayerTags(tournamentId: string, playerId: string) {
  return repository.listPlayerTags(tournamentId, playerId);
}

export function submitPlayerTag(tournamentId: string, playerId: string, input: SubmitPlayerTagInput) {
  return repository.submitPlayerTag(tournamentId, playerId, input);
}

export function likePlayerTag(tagId: string, input: LikePlayerTagInput) {
  return repository.likePlayerTag(tagId, input);
}

export function unlikePlayerTag(tagId: string, input: LikePlayerTagInput) {
  return repository.unlikePlayerTag(tagId, input);
}

export function adjustPlayerTagLikes(tagId: string, input: AdjustPlayerTagLikesInput) {
  return repository.adjustPlayerTagLikes(tagId, input);
}

export function listAdminTagPlayers(input?: ListAdminTagPlayersInput) {
  return repository.listAdminTagPlayers(input);
}

export function createAdminPlayerTag(tournamentId: string, playerId: string, input: AdminCreatePlayerTagInput) {
  return repository.createAdminPlayerTag(tournamentId, playerId, input);
}

export function listAdminTags(input?: ListAdminTagsInput) {
  return repository.listAdminTags(input);
}

export function updatePlayerTagReview(tagId: string, input: ReviewPlayerTagInput) {
  return repository.updatePlayerTagReview(tagId, input);
}

export function deletePlayerTag(tagId: string, input?: DeletePlayerTagInput) {
  return repository.deletePlayerTag(tagId, input);
}

export function getOfficialScheduleManagement(tournamentId: string) {
  return repository.getOfficialScheduleManagement(tournamentId);
}

export function getOfficialSchedulePublicStatus(tournamentId: string) {
  return repository.getOfficialSchedulePublicStatus(tournamentId);
}

export function updateOfficialScheduleConfig(tournamentId: string, input: UpdateOfficialScheduleConfigInput) {
  return repository.updateOfficialScheduleConfig(tournamentId, input);
}

export function lockOfficialScheduleRoster(tournamentId: string, input: LockOfficialScheduleRosterInput) {
  return repository.lockOfficialScheduleRoster(tournamentId, input);
}

export function unlockOfficialScheduleRoster(tournamentId: string, actor?: string) {
  return repository.unlockOfficialScheduleRoster(tournamentId, actor);
}

export function publishOfficialSchedule(tournamentId: string, actor?: string) {
  return repository.publishOfficialSchedule(tournamentId, actor);
}

export function withdrawOfficialSchedule(tournamentId: string, actor?: string) {
  return repository.withdrawOfficialSchedule(tournamentId, actor);
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

export function listStageGroups(stageId: string) {
  return repository.listStageGroups(stageId);
}

export function createStageGroup(input: CreateStageGroupInput) {
  return repository.createStageGroup(input);
}

export function updateStageGroup(groupId: string, input: UpdateStageGroupInput) {
  return repository.updateStageGroup(groupId, input);
}

export function deleteStageGroup(groupId: string) {
  return repository.deleteStageGroup(groupId);
}

export function randomizeStageGroups(stageId: string, input: RandomizeStageGroupsInput) {
  return repository.randomizeStageGroups(stageId, input);
}

export function generateGroupRoundRobin(stageId: string, input: GenerateGroupRoundRobinInput) {
  return repository.generateGroupRoundRobin(stageId, input);
}

export function updateStageManualRanks(stageId: string, input: UpdateStageManualRanksInput) {
  return repository.updateStageManualRanks(stageId, input);
}

export function generateSwissPairings(stageId: string, input: GenerateSwissPairingsInput) {
  return repository.generateSwissPairings(stageId, input);
}

export function confirmSwissRound(roundId: string, input: ConfirmSwissRoundInput) {
  return repository.confirmSwissRound(roundId, input);
}

export function retractSwissRound(roundId: string, input: ConfirmSwissRoundInput) {
  return repository.retractSwissRound(roundId, input);
}

export function addStageGroupTeam(input: AddStageGroupTeamInput) {
  return repository.addStageGroupTeam(input);
}

export function removeStageGroupTeam(groupId: string, teamId: string) {
  return repository.removeStageGroupTeam(groupId, teamId);
}

export function createKnockoutBracket(tournamentId: string, input: CreateKnockoutBracketInput) {
  return repository.createKnockoutBracket(tournamentId, input);
}

export function advanceBracketNode(nodeId: string, input: AdvanceBracketNodeInput) {
  return repository.advanceBracketNode(nodeId, input);
}

export function retractBracketNode(nodeId: string, input?: RetractBracketNodeInput) {
  return repository.retractBracketNode(nodeId, input);
}

export function setBracketNodeSlot(nodeId: string, input: SetBracketNodeSlotInput) {
  return repository.setBracketNodeSlot(nodeId, input);
}

export function createRound(input: CreateRoundInput) {
  return repository.createRound(input);
}

export function createSeries(input: CreateSeriesInput) {
  return repository.createSeries(input);
}

export function updateSeries(seriesId: string, input: UpdateSeriesInput) {
  return repository.updateSeries(seriesId, input);
}

export function updateSeriesResult(seriesId: string, input: UpdateSeriesResultInput) {
  return repository.updateSeriesResult(seriesId, input);
}

export function deleteSeries(seriesId: string) {
  return repository.deleteSeries(seriesId);
}

export function clearTournamentMatchRecords(tournamentId: string) {
  return repository.clearTournamentMatchRecords(tournamentId);
}

export function clearTournamentScheduleRecords(tournamentId: string) {
  return repository.clearTournamentScheduleRecords(tournamentId);
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
