import { getJson } from "../api";
import type {
  AcknowledgementItem,
  AdminTagPlayerItem,
  BracketNode,
  OfficialScheduleManagement,
  OpenDotaMatchListItem,
  PlayerTagModerationItem,
  StageGroup,
  StageRound,
  StandingRow,
  SyncTask,
  TournamentDetail,
  TournamentListItem,
  TournamentPlayerListItem,
  TournamentTeamListItem,
} from "../api";
import { isOfficialScheduleStage } from "./format";

export interface StageData {
  rounds: StageRound[];
  standings: StandingRow[];
  bracket: BracketNode[];
  groups: StageGroup[];
}

export interface AdminData {
  loading: boolean;
  source: "api" | "unavailable";
  notice: string;
  tournaments: TournamentListItem[];
  selectedTournamentId: string;
  selectedStageId: string;
  detail: TournamentDetail | null;
  teams: TournamentTeamListItem[];
  players: TournamentPlayerListItem[];
  matches: OpenDotaMatchListItem[];
  acknowledgements: AcknowledgementItem[];
  tags: PlayerTagModerationItem[];
  tagPlayers: AdminTagPlayerItem[];
  schedule: OfficialScheduleManagement | null;
  syncTasks: SyncTask[];
  stageData: StageData;
}

export const emptyStageData: StageData = { rounds: [], standings: [], bracket: [], groups: [] };

export const initialAdminData: AdminData = {
  loading: true,
  source: "unavailable",
  notice: "正在连接 API...",
  tournaments: [],
  selectedTournamentId: "",
  selectedStageId: "",
  detail: null,
  teams: [],
  players: [],
  matches: [],
  acknowledgements: [],
  tags: [],
  tagPlayers: [],
  schedule: null,
  syncTasks: [],
  stageData: emptyStageData,
};

export async function loadStageData(stageId: string): Promise<StageData> {
  if (!stageId) return emptyStageData;
  const [rounds, standings, bracket, groups] = await Promise.all([
    getJson<StageRound[]>(`/stages/${encodeURIComponent(stageId)}/rounds`).catch(() => []),
    getJson<StandingRow[]>(`/stages/${encodeURIComponent(stageId)}/standings`).catch(() => []),
    getJson<BracketNode[]>(`/stages/${encodeURIComponent(stageId)}/bracket`).catch(() => []),
    getJson<StageGroup[]>(`/stages/${encodeURIComponent(stageId)}/groups`).catch(() => []),
  ]);
  return { rounds, standings, bracket, groups };
}

export function chooseStageId(detail: TournamentDetail, preferredStageId: string): string {
  const officialStages = detail.stages.filter(isOfficialScheduleStage);
  if (officialStages.some((stage) => stage.id === preferredStageId)) return preferredStageId;
  if (detail.currentStage && isOfficialScheduleStage(detail.currentStage)) return detail.currentStage.id;
  if (detail.currentStageId && officialStages.some((stage) => stage.id === detail.currentStageId)) return detail.currentStageId;
  return officialStages[0]?.id ?? "";
}

export async function loadAdminData(preferredTournamentId: string, preferredStageId: string): Promise<AdminData> {
  const [tournaments, acknowledgements] = await Promise.all([
    getJson<TournamentListItem[]>("/tournaments"),
    getJson<AcknowledgementItem[]>("/admin/acknowledgements").catch(() => []),
  ]);
  const selectedTournamentId = tournaments.some((item) => item.id === preferredTournamentId)
    ? preferredTournamentId
    : tournaments[0]?.id ?? "";
  const syncTasks = await getJson<SyncTask[]>("/sync-tasks").catch(() => []);

  if (!selectedTournamentId) {
    return {
      ...initialAdminData,
      loading: false,
      source: "api",
      notice: "API 在线，但数据库暂无赛事。",
      tournaments,
      acknowledgements,
      syncTasks,
    };
  }

  const detail = await getJson<TournamentDetail>(`/tournaments/${encodeURIComponent(selectedTournamentId)}`);
  const selectedStageId = chooseStageId(detail, preferredStageId);
  const [teams, players, matches, tags, tagPlayers, schedule, stageData] = await Promise.all([
    getJson<TournamentTeamListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/teams`).catch(() => []),
    getJson<TournamentPlayerListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/players`).catch(() => []),
    getJson<OpenDotaMatchListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/matches?limit=300`).catch(() => []),
    getJson<PlayerTagModerationItem[]>(`/admin/tags?tournamentId=${encodeURIComponent(selectedTournamentId)}`).catch(() => []),
    getJson<AdminTagPlayerItem[]>("/admin/tag-players").catch(() => []),
    getJson<OfficialScheduleManagement>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/schedule-management`).catch(() => null),
    loadStageData(selectedStageId),
  ]);

  return {
    loading: false,
    source: "api",
    notice: "数据已刷新。",
    tournaments,
    selectedTournamentId,
    selectedStageId,
    detail,
    teams,
    players,
    matches,
    acknowledgements,
    tags,
    tagPlayers,
    schedule,
    syncTasks,
    stageData,
  };
}
