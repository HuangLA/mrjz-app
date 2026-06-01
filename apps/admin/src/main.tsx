import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  type Announcements,
  type ScreenReaderInstructions,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getSeedSlotOrder } from "@mrjz/shared/bracket-seeding";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Brackets,
  CalendarClock,
  Check,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Dices,
  GitBranch,
  GripVertical,
  Link2,
  ListRestart,
  Loader2,
  Lock,
  MousePointer2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Unlock,
  Users,
  X,
} from "lucide-react";
import "./react-admin.css";
import {
  apiBaseUrl,
  getJson,
  sendAdminRequest,
  type BracketNode,
  type OfficialScheduleManagement,
  type OpenDotaMatchListItem,
  type PlayerBrief,
  type RoundBrief,
  type SeriesSummary,
  type StageGroup,
  type StageRound,
  type StageSummary,
  type StandingRow,
  type SyncTask,
  type TeamBrief,
  type Tone,
  type TournamentDetail,
  type TournamentListItem,
  type TournamentPlayerListItem,
  type TournamentTeamListItem,
} from "./api";

type ViewKey = "tournament" | "teams" | "matches" | "sync";
type RequestMethod = "POST" | "PATCH" | "DELETE";
type CompetitionMode = "single_elimination" | "double_elimination";
type RosterDropTarget = "pool" | "entrant" | "seeded";
type BracketEntrantDropTarget = "pool" | "entrant";
type ManualSeriesDropTarget = "pool" | "radiant" | "dire";
type ManualSeriesTeamSlotTarget = Exclude<ManualSeriesDropTarget, "pool">;
type EditSeriesDropTarget = "pool" | "radiant" | "dire";
type BracketSlotName = "radiant" | "dire";
type WorkflowFocusTarget = "schedule-control" | "stage-workspace" | "schedule-frame" | "stage-composer";
type SeriesFilterMode = "all" | "todo" | "result" | "match";
type BracketSlotSource = { kind: "bracketSlot"; nodeId: string; slot: BracketSlotName };
type GroupTeamSource = { kind: "group"; groupId: string };
type TeamDragSource = BracketSlotSource | GroupTeamSource;
type TeamDragData = { type: "team"; teamId: string; label: string; color: string; source?: TeamDragSource };
type DragItem = TeamDragData | { type: "none" };
type NextActionView = { title: string; text: string; tone: Tone };
type NextActionCta = { label: string; onClick: () => void; disabled?: boolean; kind?: "primary" | "secondary" | "danger" };
type StageNextStep = { title: string; text: string; metric: string; actionLabel: string; targetId: string; tone: Tone; icon: React.ReactNode; seriesId?: string; seriesFilterMode?: SeriesFilterMode };
type StageSectionShortcut = { label: string; metric: string; targetId: string; tone: Tone; icon: React.ReactNode; hint?: string; seriesId?: string; seriesFilterMode?: SeriesFilterMode };
type SeriesFocusTarget = { seriesId: string; filterMode: SeriesFilterMode };
type MatchIdFocusTarget = SeriesFocusTarget & { gameIndex?: number };
type CreateTournamentStatus = "draft" | "upcoming" | "running" | "completed" | "archived";
type GroupAdvancePreset = { label: string; text: string; teamIds: string[]; targetCount: number; groupCount: number; perGroup: number };
type EntrantSeedRole = { badge: string; detail: string; tone: "winner" | "play" | "wait" | "loser" };
type ManualSeriesCreateOverrides = Partial<Pick<StageFormState, "manualRadiantTeamId" | "manualDireTeamId" | "manualRoundId" | "manualRoundName" | "manualGroupId" | "manualSeriesKind" | "manualScheduledAt">>;
type CreateManualSeriesHandler = (overrides?: ManualSeriesCreateOverrides) => Promise<void>;

interface AdminData {
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
  rounds: StageRound[];
  standings: StandingRow[];
  bracket: BracketNode[];
  groups: StageGroup[];
  schedule: OfficialScheduleManagement | null;
  syncTasks: SyncTask[];
}

interface StageFormState {
  groupName: string;
  groupCount: number;
  groupSize: number;
  plannedGroupAssignments: Record<string, number>;
  swissRounds: number;
  swissRoundNumber: number;
  knockoutName: string;
  knockoutMode: CompetitionMode;
  bracketSize: number;
  winnerTeamCount: number;
  loserTeamCount: number;
  selectedTeamIds: string[];
  manualRadiantTeamId: string;
  manualDireTeamId: string;
  manualRoundId: string;
  manualRoundName: string;
  manualGroupId: string;
  manualSeriesKind: "regular" | "tiebreaker";
  manualScheduledAt: string;
  editingSeriesId: string;
  editRadiantTeamId: string;
  editDireTeamId: string;
  editRoundId: string;
  editGroupId: string;
  editSeriesKind: "regular" | "tiebreaker";
  editStatus: string;
  editScheduledAt: string;
}

interface TeamDraftForm {
  name: string;
  shortName: string;
  logoUrl: string;
  color: string;
  opendotaTeamId: string;
}

interface TournamentCreateForm {
  name: string;
  seasonName: string;
  opendotaLeagueId: string;
  startsAt: string;
  status: CreateTournamentStatus;
}

const initialData: AdminData = {
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
  rounds: [],
  standings: [],
  bracket: [],
  groups: [],
  schedule: null,
  syncTasks: [],
};

const DEFAULT_GROUP_COUNT = 1;
const MIN_GROUP_COUNT = 1;
const MAX_GROUP_COUNT = 16;
const GROUP_COUNT_PRESETS = [1, 2, 3, 4, 5, 6] as const;
const SERIES_FOCUS_EVENT = "mrjz:focus-series-row";
const BRACKET_NEXT_FOCUS_EVENT = "mrjz:focus-bracket-next";
const KNOCKOUT_GENERATE_BUTTON_ID = "knockout-generate-primary-action";
const dndScreenReaderInstructions: ScreenReaderInstructions = {
  draggable: "按空格或回车开始拖拽，使用方向键移动；再次按空格或回车放下，按 Esc 取消。",
};
const dndAnnouncements: Announcements = {
  onDragStart({ active }) {
    return `已拿起${formatDndItemId(active.id)}。`;
  },
  onDragOver({ active, over }) {
    if (!over) return `${formatDndItemId(active.id)}已离开可投放区域。`;
    return `${formatDndItemId(active.id)}移到${formatDndItemId(over.id)}。`;
  },
  onDragEnd({ active, over }) {
    if (!over) return `${formatDndItemId(active.id)}已放下。`;
    return `${formatDndItemId(active.id)}已放入${formatDndItemId(over.id)}。`;
  },
  onDragCancel({ active }) {
    return `已取消拖拽${formatDndItemId(active.id)}。`;
  },
};

const initialTournamentForm: TournamentCreateForm = {
  name: "",
  seasonName: "",
  opendotaLeagueId: "",
  startsAt: "",
  status: "upcoming",
};

const tournamentStatusOptions: Array<{ value: CreateTournamentStatus; label: string }> = [
  { value: "upcoming", label: "未开始" },
  { value: "running", label: "进行中" },
  { value: "draft", label: "草稿" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "归档" },
];

const initialStageForm: StageFormState = {
  groupName: "A 组",
  groupCount: DEFAULT_GROUP_COUNT,
  groupSize: 0,
  plannedGroupAssignments: {},
  swissRounds: 5,
  swissRoundNumber: 1,
  knockoutName: "淘汰赛",
  knockoutMode: "single_elimination",
  bracketSize: 8,
  winnerTeamCount: 8,
  loserTeamCount: 0,
  selectedTeamIds: [],
  manualRadiantTeamId: "",
  manualDireTeamId: "",
  manualRoundId: "",
  manualRoundName: "",
  manualGroupId: "",
  manualSeriesKind: "regular",
  manualScheduledAt: "",
  editingSeriesId: "",
  editRadiantTeamId: "",
  editDireTeamId: "",
  editRoundId: "",
  editGroupId: "",
  editSeriesKind: "regular",
  editStatus: "draft",
  editScheduledAt: "",
};

const navItems: Array<{ key: ViewKey; label: string; hint: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "tournament", label: "赛事管理", hint: "名单、赛制、阶段、对阵", icon: GitBranch },
  { key: "teams", label: "战队与选手", hint: "队伍资料、成员池", icon: Users },
  { key: "matches", label: "比赛结果库", hint: "OpenDota 与赛果", icon: ClipboardCheck },
  { key: "sync", label: "同步任务", hint: "发现、解析、重试", icon: RefreshCw },
];

function App() {
  const [activeView, setActiveView] = useState<ViewKey>(() => viewFromHash());
  const [data, setData] = useState<AdminData>(initialData);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const [stageForm, setStageForm] = useState<StageFormState>(initialStageForm);
  const [tournamentForm, setTournamentForm] = useState<TournamentCreateForm>(initialTournamentForm);
  const [tournamentCreateOpen, setTournamentCreateOpen] = useState(false);
  const [rosterIds, setRosterIds] = useState<string[]>([]);
  const [seededIds, setSeededIds] = useState<string[]>([]);
  const [activeDrag, setActiveDrag] = useState<DragItem>({ type: "none" });
  const [lastCreatedSeriesId, setLastCreatedSeriesId] = useState("");
  const [manualSeriesSubmitting, setManualSeriesSubmitting] = useState(false);
  const [seriesDraftSubmitting, setSeriesDraftSubmitting] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const officialStages = useMemo(() => data.detail?.stages.filter(isOfficialScheduleStage) ?? [], [data.detail]);
  const selectedStage = useMemo(
    () => officialStages.find((stage) => stage.id === data.selectedStageId) ?? officialStages[0] ?? null,
    [officialStages, data.selectedStageId],
  );
  const allSeries = useMemo(() => data.rounds.flatMap((round) => round.series), [data.rounds]);
  const availableTeams = data.schedule?.rosterLocked && data.schedule.teams.length > 0
    ? data.schedule.teams.map((item) => item.team)
    : data.teams;
  const selectedKnockoutEntrantIds = useMemo(
    () => selectedStage?.type === "knockout" ? stageConfigStringList(selectedStage, "teamIds") : [],
    [selectedStage],
  );
  const selectedKnockoutEntrantIdSet = useMemo(() => new Set(selectedKnockoutEntrantIds), [selectedKnockoutEntrantIds]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveView(viewFromHash());
      setTournamentCreateOpen(false);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const lockedIds = data.schedule?.teams.map((item) => item.team.id) ?? [];
    const teamIds = data.teams.map((team) => team.id);
    setRosterIds(lockedIds.length > 0 ? lockedIds : teamIds);
    setSeededIds(data.schedule?.teams.filter((item) => item.isSeeded).map((item) => item.team.id) ?? []);
  }, [data.schedule, data.teams]);

  useEffect(() => {
    if (!data.loading && data.source === "api" && data.tournaments.length === 0) {
      setTournamentCreateOpen(true);
    }
  }, [data.loading, data.source, data.tournaments.length]);

  useEffect(() => {
    setLastCreatedSeriesId("");
  }, [data.selectedTournamentId, data.selectedStageId]);

  useEffect(() => {
    if (!tournamentCreateOpen) return;
    const timer = focusTournamentCreatePanelSoon();
    return () => window.clearTimeout(timer);
  }, [tournamentCreateOpen]);

  function openTournamentCreatePanel() {
    if (tournamentCreateOpen) {
      focusTournamentCreatePanelSoon();
      return;
    }
    setTournamentCreateOpen(true);
  }

  function focusTournamentCreatePanelSoon() {
    return window.setTimeout(() => {
      focusElementById("tournament-create-panel");
      document.getElementById("tournament-create-name-input")?.focus({ preventScroll: true });
    }, 80);
  }

  async function load(preferredTournamentId = data.selectedTournamentId, preferredStageId = data.selectedStageId) {
    setData((current) => ({ ...current, loading: true, notice: "正在连接 API..." }));
    try {
      const tournaments = await getJson<TournamentListItem[]>("/tournaments");
      const selectedTournamentId = tournaments.some((item) => item.id === preferredTournamentId) ? preferredTournamentId : tournaments[0]?.id ?? "";
      const syncTasks = await getJson<SyncTask[]>("/sync-tasks").catch(() => []);
      if (!selectedTournamentId) {
        setData({ ...initialData, loading: false, source: "api", notice: "API 在线，但数据库暂无赛事。", tournaments, syncTasks });
        return;
      }

      const detail = await getJson<TournamentDetail>(`/tournaments/${encodeURIComponent(selectedTournamentId)}`);
      const selectedStageId = chooseStageId(detail, preferredStageId);
      const [teams, players, matches, schedule, stageData] = await Promise.all([
        getJson<TournamentTeamListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/teams`).catch(() => []),
        getJson<TournamentPlayerListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/players`).catch(() => []),
        getJson<OpenDotaMatchListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/matches?limit=300`).catch(() => []),
        getJson<OfficialScheduleManagement>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/schedule-management`).catch(() => null),
        loadStageData(selectedStageId),
      ]);
      const bracketTeamIds = (schedule?.teams.map((item) => item.team.id) ?? []).length > 0
        ? schedule?.teams.map((item) => item.team.id) ?? []
        : teams.map((team) => team.id);
      const officialStageSummaries = detail.stages.filter(
        (stage) => stage.name !== "真实比赛记录" && (stage.type === "group" || stage.type === "swiss" || stage.type === "knockout"),
      );
      const hasPreliminaryStage = officialStageSummaries.some((stage) => stage.type === "group" || stage.type === "swiss");
      const hasKnockoutStage = officialStageSummaries.some((stage) => stage.type === "knockout");
      const defaultBracketTeamIds = hasPreliminaryStage && !hasKnockoutStage ? [] : bracketTeamIds.slice(0, 8);
      const resolvedGroupCount = stageData.groups.length > 0
        ? clampInteger(stageData.groups.length, MIN_GROUP_COUNT, MAX_GROUP_COUNT)
        : DEFAULT_GROUP_COUNT;
      setStageForm((current) => {
        const savedKnockoutMode = schedule?.knockoutType === "double_elimination" ? "double_elimination" : schedule?.knockoutType === "single_elimination" ? "single_elimination" : current.knockoutMode;
        const bracketSize = savedKnockoutMode === "double_elimination" && current.bracketSize === 6 ? 8 : current.bracketSize;
        return {
          ...current,
          selectedTeamIds: current.selectedTeamIds.length > 0 ? current.selectedTeamIds.filter((id) => bracketTeamIds.includes(id)) : defaultBracketTeamIds,
          groupCount: resolvedGroupCount,
          plannedGroupAssignments: filterPlannedGroupAssignments(
            current.plannedGroupAssignments,
            schedule?.teams.map((item) => item.team.id) ?? [],
            resolvedGroupCount,
          ),
          swissRoundNumber: Math.max(1, ...stageData.rounds.map((round) => round.roundNumber + 1)),
          knockoutMode: savedKnockoutMode,
          bracketSize,
          winnerTeamCount: savedKnockoutMode === "double_elimination" ? clampInteger(current.winnerTeamCount, 2, bracketSize) : bracketSize,
          loserTeamCount: savedKnockoutMode === "double_elimination" ? clampInteger(current.loserTeamCount, 0, Math.floor(bracketSize / 2)) : 0,
        };
      });
      setData({
        loading: false,
        source: "api",
        notice: "真实数据已从 API 刷新。",
        tournaments,
        selectedTournamentId,
        selectedStageId,
        detail,
        teams,
        players,
        matches,
        schedule,
        syncTasks,
        ...stageData,
      });
    } catch (error) {
      setData({ ...initialData, loading: false, notice: `API 不可用：${error instanceof Error ? error.message : String(error)}` });
    }
  }

  async function runAction(label: string, method: RequestMethod, path: string, payload?: Record<string, unknown>, nextStageId = data.selectedStageId) {
    setNotice({ tone: "info", text: `${label}处理中...` });
    const result = await sendAdminRequest(path, method, payload);
    setNotice({ tone: result.ok ? "good" : "warn", text: `${label}：${result.message}` });
    if (result.ok) await load(data.selectedTournamentId, nextStageId);
    return result;
  }

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = tournamentForm.name.trim();
    const opendotaLeagueId = numberFromDraft(tournamentForm.opendotaLeagueId);

    if (!name) {
      setNotice({ tone: "warn", text: "请填写联赛名称。" });
      return;
    }

    if (opendotaLeagueId === undefined) {
      setNotice({ tone: "warn", text: "请填写有效的 OpenDota league_id。" });
      return;
    }

    const startsAt = localDateTimeToIso(tournamentForm.startsAt);
    if (tournamentForm.startsAt.trim() && startsAt === undefined) {
      setNotice({ tone: "warn", text: "开始时间格式不正确。" });
      return;
    }

    setNotice({ tone: "info", text: "创建联赛处理中..." });
    const result = await sendAdminRequest("/tournaments", "POST", {
      name,
      seasonName: tournamentForm.seasonName.trim() || undefined,
      opendotaLeagueId,
      startsAt,
      status: tournamentForm.status,
    });
    setNotice({ tone: result.ok ? "good" : "warn", text: `创建联赛：${result.message}` });

    if (!result.ok) return;

    const created = result.data as Partial<TournamentDetail> | undefined;
    setTournamentForm(initialTournamentForm);
    setTournamentCreateOpen(false);
    const createdTournamentId = typeof created?.id === "string" ? created.id : "";
    await load(createdTournamentId, "");
    if (createdTournamentId) {
      void triggerTournamentOpenDotaSync(createdTournamentId);
    }
  }

  async function triggerTournamentOpenDotaSync(tournamentId: string) {
    setNotice({ tone: "info", text: "新联赛已创建，正在从 OpenDota 拉取比赛记录..." });
    const result = await sendAdminRequest(`/tournaments/${encodeURIComponent(tournamentId)}/sync-opendota?limit=300`, "POST");
    setNotice({
      tone: result.ok ? "good" : "warn",
      text: result.ok ? "OpenDota 比赛记录同步完成，已刷新新届次。" : `OpenDota 同步未完成：${result.message}`,
    });
    if (result.ok) await load(tournamentId, "");
  }

  function requireTournament() {
    if (!data.selectedTournamentId) {
      setNotice({ tone: "warn", text: "请先选择届次。" });
      return false;
    }
    return true;
  }

  function switchView(key: ViewKey) {
    setActiveView(key);
    setTournamentCreateOpen(false);
    if (window.location.hash !== `#${key}`) window.history.replaceState(null, "", `#${key}`);
  }

  function requireStage() {
    if (!selectedStage) {
      setNotice({ tone: "warn", text: "请先创建或选择官方赛程阶段。" });
      return false;
    }
    return true;
  }

  async function lockRoster(teamIds: string[], seededTeamIds: string[]) {
    if (!requireTournament()) return;
    await runAction("锁定参赛名单", "POST", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-management/lock-roster`, { teamIds, seededTeamIds, actor: "admin" });
  }

  async function unlockRoster() {
    if (!requireTournament() || !window.confirm("解锁名单会清空官方赛程草稿。确认继续？")) return;
    await runAction("解锁名单", "POST", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-management/unlock-roster`, { actor: "admin" });
  }

  async function updateScheduleConfig(preliminaryType: "group" | "swiss", knockoutType: CompetitionMode) {
    if (!requireTournament() || !requireEditableSchedule()) return;
    const result = await runAction("保存赛制", "PATCH", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-management`, { preliminaryType, knockoutType, actor: "admin" });
    if (result.ok) {
      setStageForm((current) => ({
        ...current,
        knockoutMode: knockoutType,
        bracketSize: knockoutType === "double_elimination" && current.bracketSize === 6 ? 8 : current.bracketSize,
      }));
    }
  }

  async function publishSchedule() {
    if (!requireTournament()) return;
    const readiness = getScheduleReadiness(data.schedule, officialStages, selectedStage, allSeries);
    if (!readiness.readyToPublish) {
      setNotice({ tone: "warn", text: `发布前还需要：${missingSchedulePieces(data.schedule, readiness).join("、")}。` });
      return;
    }
    if (!window.confirm("发布后 H5 赛程页将展示官方赛程。确认发布？")) return;
    await runAction("发布官方赛程", "POST", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-management/publish`, { actor: "admin" });
  }

  async function withdrawSchedule() {
    if (!requireTournament() || !window.confirm("撤回后 H5 赛程页会显示赛程暂未发布。确认撤回？")) return;
    await runAction("撤回发布", "POST", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-management/withdraw`, { actor: "admin" });
  }

  async function clearScheduleRecords() {
    if (!requireTournament()) return;
    if (!window.confirm("确认重置本届官方赛程？这会删除已锁参赛名单、赛制配置、小组 / 瑞士轮 / 淘汰赛阶段、对阵、赛果和对阵图；OpenDota 拉取的比赛记录和比赛详情会保留。")) return;
    await runAction("重置官方赛程", "DELETE", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-records`, undefined, "");
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireStage() || !requireEditableSchedule()) return;
    const usedNames = new Set(data.groups.map((group) => group.name.trim()).filter(Boolean));
    const requestedName = stageForm.groupName.trim();
    const groupName = requestedName && !usedNames.has(requestedName) ? requestedName : nextAvailableGroupName(usedNames, data.groups.length);
    const result = await runAction("添加小组", "POST", `/stages/${encodeURIComponent(data.selectedStageId)}/groups`, { name: groupName, sortOrder: data.groups.length + 1 });
    if (result.ok) {
      const nextUsedNames = new Set(usedNames);
      nextUsedNames.add(groupName);
      setStageForm((current) => ({ ...current, groupName: nextAvailableGroupName(nextUsedNames, data.groups.length + 1) }));
    }
  }

  async function randomizeGroups() {
    if (!requireStage() || !requireEditableSchedule()) return;
    const targetGroupCount = clampInteger(stageForm.groupCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
    const assignedTeamCount = data.groups.reduce((total, group) => total + group.teams.length, 0);
    const regularGroupSeriesCount = allSeries.filter((series) => series.groupId && series.seriesKind !== "tiebreaker").length;
    const existingGroupText = data.groups.length > 0
      ? `当前已有 ${data.groups.length} 个小组、${assignedTeamCount} 支已分组队伍。`
      : "当前还没有小组。";
    const groupSizeText = stageForm.groupSize > 0 ? `，每组约 ${stageForm.groupSize} 支队伍` : "";
    const seriesWarningText = regularGroupSeriesCount > 0
      ? `\n当前还有 ${regularGroupSeriesCount} 场小组常规对阵；随机分组不会自动重排这些对阵，后续可能需要重新生成或手动修正赛程。`
      : "";
    if (!window.confirm(`确认随机分组？\n${existingGroupText}\n系统会按 ${targetGroupCount} 个小组${groupSizeText}重新分配参赛名单，生成后仍可拖拽微调。${seriesWarningText}`)) return;
    await runAction("随机分组", "POST", `/stages/${encodeURIComponent(data.selectedStageId)}/groups/randomize`, {
      groupCount: targetGroupCount,
      groupSize: stageForm.groupSize > 0 ? stageForm.groupSize : undefined,
      actor: "admin",
    });
  }

  async function addTeamToGroup(groupId: string, teamId: string) {
    if (!requireStage() || !requireEditableSchedule()) return;
    await runAction("移动队伍", "POST", `/stage-groups/${encodeURIComponent(groupId)}/teams`, { teamId });
  }

  async function removeTeamFromGroup(groupId: string, teamId: string) {
    if (!requireStage() || !requireEditableSchedule()) return;
    await runAction("移出队伍", "DELETE", `/stage-groups/${encodeURIComponent(groupId)}/teams/${encodeURIComponent(teamId)}`);
  }

  async function updateStageGroupName(groupId: string, name: string) {
    if (!requireStage() || !requireEditableSchedule()) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice({ tone: "warn", text: "小组名称不能为空。" });
      return;
    }
    await runAction("重命名小组", "PATCH", `/stage-groups/${encodeURIComponent(groupId)}`, { name: trimmed });
  }

  async function deleteStageGroup(group: StageGroup) {
    if (!requireStage() || !requireEditableSchedule()) return;
    const message = group.teams.length > 0
      ? `“${group.name}”里还有 ${group.teams.length} 支队伍。确认删除这个小组？`
      : `确认删除“${group.name}”？`;
    if (!window.confirm(message)) return;
    await runAction("删除小组", "DELETE", `/stage-groups/${encodeURIComponent(group.id)}`);
  }

  async function resizeStageGroups(targetCount: number) {
    if (!requireStage() || !requireEditableSchedule() || !selectedStage || selectedStage.type !== "group") return;
    const safeTarget = clampInteger(targetCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
    const sortedGroups = [...data.groups].sort((left, right) => left.sortOrder - right.sortOrder);
    const currentCount = sortedGroups.length;

    if (safeTarget === currentCount) {
      setNotice({ tone: "info", text: `当前已经是 ${safeTarget} 个小组。` });
      return;
    }

    if (safeTarget > currentCount) {
      setNotice({ tone: "info", text: "补足小组处理中..." });
      const usedNames = new Set(sortedGroups.map((group) => group.name.trim()));
      for (let index = currentCount; index < safeTarget; index += 1) {
        const name = nextAvailableGroupName(usedNames, index);
        usedNames.add(name);
        const result = await sendAdminRequest(`/stages/${encodeURIComponent(selectedStage.id)}/groups`, "POST", {
          name,
          sortOrder: index + 1,
        });
        if (!result.ok) {
          setNotice({ tone: "warn", text: `补足小组：${result.message}` });
          await load(data.selectedTournamentId, selectedStage.id);
          return;
        }
      }
      setStageForm((current) => ({ ...current, groupCount: safeTarget, groupName: defaultGroupName(safeTarget) }));
      setNotice({ tone: "good", text: `已调整为 ${safeTarget} 个小组。` });
      await load(data.selectedTournamentId, selectedStage.id);
      return;
    }

    const groupsToDelete = sortedGroups.slice(safeTarget);
    const nonEmptyGroups = groupsToDelete.filter((group) => group.teams.length > 0);
    const warning = nonEmptyGroups.length > 0
      ? `要删除后 ${groupsToDelete.length} 个小组，其中 ${nonEmptyGroups.length} 个已有队伍；相关队伍会回到未分组，已有对阵会保留但不再绑定这些小组。确认继续？`
      : `要删除后 ${groupsToDelete.length} 个空小组，确认调整为 ${safeTarget} 个小组？`;
    if (!window.confirm(warning)) return;

    setNotice({ tone: "info", text: "缩减小组处理中..." });
    for (const group of groupsToDelete.reverse()) {
      const result = await sendAdminRequest(`/stage-groups/${encodeURIComponent(group.id)}`, "DELETE");
      if (!result.ok) {
        setNotice({ tone: "warn", text: `缩减小组：${result.message}` });
        await load(data.selectedTournamentId, selectedStage.id);
        return;
      }
    }
    const deletedIds = new Set(groupsToDelete.map((group) => group.id));
    setStageForm((current) => ({
      ...current,
      groupCount: safeTarget,
      manualGroupId: deletedIds.has(current.manualGroupId) ? sortedGroups[0]?.id ?? "" : current.manualGroupId,
    }));
    setNotice({ tone: "good", text: `已调整为 ${safeTarget} 个小组。` });
    await load(data.selectedTournamentId, selectedStage.id);
  }

  async function generateGroupRoundRobin() {
    if (!requireStage() || !requireEditableSchedule()) return;
    const targetSeriesCount = data.groups.reduce((total, group) => total + buildTeamPairDrafts(group.teams).length, 0);
    const targetText = targetSeriesCount > 0 ? `将按当前分组生成 ${targetSeriesCount} 场 BO2 单循环。` : "";
    const regularSeriesCount = data.rounds
      .flatMap((round) => round.series)
      .filter((series) => series.groupId && series.seriesKind !== "tiebreaker")
      .length;
    if (regularSeriesCount > 0 && !window.confirm(`当前阶段已有 ${regularSeriesCount} 场常规对阵。${targetText}重新生成单循环会覆盖这些常规对阵，加赛会保留。确认继续？`)) return;
    const result = await runAction("生成小组赛程", "POST", `/stages/${encodeURIComponent(data.selectedStageId)}/group-round-robin`, { boType: "BO2", replaceExisting: true, actor: "admin" });
    if (result.ok) {
      window.setTimeout(() => requestSeriesListFocus(null, "result"), 120);
    }
  }

  async function generateSwissPairings() {
    if (!requireStage() || !requireEditableSchedule()) return;
    const affectedRoundCount = data.rounds.filter((round) => round.roundNumber >= stageForm.swissRoundNumber).length;
    const targetText = formatSwissDraftImpact(availableTeams.length);
    if (affectedRoundCount > 0 && !window.confirm(`生成第 ${stageForm.swissRoundNumber} 轮草稿会覆盖第 ${stageForm.swissRoundNumber} 轮及之后的 ${affectedRoundCount} 个轮次。本轮预计生成 ${targetText}。确认继续？`)) return;
    const result = await runAction("生成瑞士轮配对", "POST", `/stages/${encodeURIComponent(data.selectedStageId)}/swiss-pairings`, { roundNumber: stageForm.swissRoundNumber, boType: "BO2", actor: "admin" });
    if (result.ok) {
      window.setTimeout(() => focusElementById("swiss-round-lanes"), 80);
    }
  }

  async function confirmSwissRound(roundId: string, description = "本轮瑞士轮") {
    const visibilityText = data.schedule?.status === "published"
      ? "当前官方赛程已发布，确认后 H5 会同步展示这一轮。"
      : "确认后这一轮会进入正式赛程，等官方赛程发布后对用户可见。";
    if (!window.confirm(`确认 ${description}？\n${visibilityText}`)) return;
    const firstRoundPendingSeriesId = data.rounds.find((round) => round.id === roundId)?.series.find(seriesNeedsResult)?.id ?? null;
    const result = await runAction("确认瑞士轮", "POST", `/rounds/${encodeURIComponent(roundId)}/confirm-swiss`, { actor: "admin" });
    if (result.ok) {
      window.setTimeout(() => requestSeriesListFocus(firstRoundPendingSeriesId, "result"), 120);
    }
  }

  async function retractSwissRound(roundId: string, description = "本轮瑞士轮") {
    const visibilityText = data.schedule?.status === "published"
      ? "当前官方赛程已发布，撤回后 H5 会同步移除该轮及后续瑞士轮。"
      : "撤回后会清空该轮及后续瑞士轮配对，之后可重新生成或手动创建。";
    if (!window.confirm(`确认撤回 ${description} 及后续瑞士轮？\n${visibilityText}`)) return;
    const result = await runAction("撤回瑞士轮", "POST", `/rounds/${encodeURIComponent(roundId)}/retract-swiss`, { actor: "admin" });
    if (result.ok) {
      window.setTimeout(() => focusElementById("swiss-pairing-desk"), 120);
    }
  }

  async function generateBracket() {
    if (!requireTournament() || !requireEditableSchedule() || !requireScheduleConfigured()) return;
    const teamIds = stageForm.selectedTeamIds;
    const splitError = validateBracketEntrants(stageForm.knockoutMode, stageForm.bracketSize, teamIds.length, stageForm.winnerTeamCount, stageForm.loserTeamCount);
    if (splitError) {
      setNotice({ tone: "warn", text: splitError });
      return;
    }
    const result = await runAction("生成淘汰赛对阵图", "POST", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/knockout-bracket`, {
      name: stageForm.knockoutName || "淘汰赛",
      bracketType: stageForm.knockoutMode,
      bracketSize: stageForm.bracketSize,
      winnerTeamCount: stageForm.knockoutMode === "double_elimination" ? stageForm.winnerTeamCount : undefined,
      loserTeamCount: stageForm.knockoutMode === "double_elimination" ? stageForm.loserTeamCount : undefined,
      boType: "BO3",
      teamIds,
    });
    const payload = result.data as { stage?: StageSummary } | undefined;
    if (result.ok && payload?.stage?.id) {
      await load(data.selectedTournamentId, payload.stage.id);
      requestBracketNextFocus();
    }
  }

  async function createScheduleFrame() {
    if (!requireTournament() || !requireEditableSchedule() || !requireScheduleConfigured()) return;
    const readiness = getScheduleReadiness(data.schedule, officialStages, selectedStage, allSeries);
    if (readiness.hasPreliminaryStage) {
      setNotice({ tone: "good", text: "预赛阶段已经存在。等预赛结果确定后，再选择晋级队伍生成淘汰赛对阵图。" });
      return;
    }

    const configuredPreliminaryType = data.schedule?.preliminaryType === "swiss" ? "swiss" : "group";
    const configuredPreliminaryLabel = configuredPreliminaryType === "swiss" ? "瑞士轮" : "小组赛";
    const lockedRosterTeams = data.schedule?.teams.map((item) => item.team) ?? [];
    const plannedGroupAssignments = { ...stageForm.plannedGroupAssignments };

    setNotice({ tone: "info", text: "正在创建预赛草稿..." });
    let preferredStageId = data.selectedStageId;

    const stageResult = await sendAdminRequest("/stages", "POST", {
      tournamentId: data.selectedTournamentId,
      name: `${configuredPreliminaryLabel}预赛`,
      type: configuredPreliminaryType,
      advancementRule: configuredPreliminaryType === "swiss" ? `瑞士轮 ${stageForm.swissRounds} 轮 · BO2` : "小组赛 · BO2",
      config: { officialSchedule: true, boType: "BO2", swissRounds: configuredPreliminaryType === "swiss" ? stageForm.swissRounds : undefined },
    });
    if (!stageResult.ok) {
      setNotice({ tone: "warn", text: `创建预赛阶段：${stageResult.message}` });
      return;
    }
    const createdStage = stageResult.data as StageSummary | undefined;
    preferredStageId = createdStage?.id ?? preferredStageId;

    const createdGroups: StageGroup[] = [];
    let appliedGroupAssignmentCount = 0;

    if (configuredPreliminaryType === "group" && createdStage?.id) {
      const groupCount = clampInteger(stageForm.groupCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
      for (let index = 0; index < groupCount; index += 1) {
        const groupResult = await sendAdminRequest(`/stages/${encodeURIComponent(createdStage.id)}/groups`, "POST", {
          name: defaultGroupName(index),
          sortOrder: index + 1,
        });
        if (!groupResult.ok) {
          setNotice({ tone: "warn", text: `创建小组：${groupResult.message}` });
          await load(data.selectedTournamentId, preferredStageId);
          return;
        }
        const createdGroup = groupResult.data as StageGroup | undefined;
        if (createdGroup?.id) createdGroups.push(createdGroup);
      }

      const groupAssignmentCounts = new Map<string, number>();
      for (const team of lockedRosterTeams) {
        const groupIndex = plannedGroupAssignments[team.id];
        const group = typeof groupIndex === "number" ? createdGroups[groupIndex] : undefined;
        if (!group) continue;
        const seed = (groupAssignmentCounts.get(group.id) ?? 0) + 1;
        groupAssignmentCounts.set(group.id, seed);
        const assignmentResult = await sendAdminRequest(`/stage-groups/${encodeURIComponent(group.id)}/teams`, "POST", {
          teamId: team.id,
          seed,
        });
        if (!assignmentResult.ok) {
          setNotice({ tone: "warn", text: `应用预分组：${assignmentResult.message}` });
          await load(data.selectedTournamentId, preferredStageId);
          return;
        }
        appliedGroupAssignmentCount += 1;
      }
    }

    setStageForm((current) => ({ ...current, selectedTeamIds: [], plannedGroupAssignments: {} }));
    setNotice({
      tone: "good",
      text: configuredPreliminaryType === "group"
        ? appliedGroupAssignmentCount > 0
          ? `预赛草稿已创建，并已应用 ${appliedGroupAssignmentCount} 支队伍的预分组。现在可以继续微调分组，再手动排赛。`
          : "预赛草稿和空小组已创建。现在把队伍拖进目标小组，再手动或按当前分组生成组内对阵。"
        : "预赛草稿已创建。先完成配对和赛果，再生成淘汰赛对阵图。",
    });
    await load(data.selectedTournamentId, preferredStageId);
  }

  async function setBracketSlot(nodeId: string, slot: BracketSlotName, teamId: string | null) {
    const result = await runAction("调整对阵图槽位", "PATCH", `/bracket-nodes/${encodeURIComponent(nodeId)}/slot`, { slot, teamId, actor: "admin" });
    if (result.ok) requestBracketNextFocus();
  }

  async function moveBracketTeamToSlot(teamId: string, target: { nodeId: string; slot: BracketSlotName }, source?: BracketSlotSource) {
    const targetTeam = getBracketSlotTeam(data.bracket, target.nodeId, target.slot);
    if (source && source.nodeId === target.nodeId && source.slot === target.slot) return;
    if (source && targetTeam && targetTeam.id !== teamId) {
      setNotice({ tone: "info", text: "正在交换对阵图槽位..." });
      const first = await sendAdminRequest(`/bracket-nodes/${encodeURIComponent(target.nodeId)}/slot`, "PATCH", { slot: target.slot, teamId, actor: "admin" });
      if (!first.ok) {
        setNotice({ tone: "warn", text: `交换对阵图槽位：${first.message}` });
        return;
      }
      const second = await sendAdminRequest(`/bracket-nodes/${encodeURIComponent(source.nodeId)}/slot`, "PATCH", { slot: source.slot, teamId: targetTeam.id, actor: "admin" });
      setNotice({ tone: second.ok ? "good" : "warn", text: `交换对阵图槽位：${second.message}` });
      if (second.ok) {
        await load(data.selectedTournamentId, data.selectedStageId);
        requestBracketNextFocus();
      }
      return;
    }
    await setBracketSlot(target.nodeId, target.slot, teamId);
  }

  async function advanceBracketNode(nodeId: string, winnerTeamId: string) {
    const result = await runAction("选择胜者", "POST", `/bracket-nodes/${encodeURIComponent(nodeId)}/winner`, { winnerTeamId });
    if (result.ok) requestBracketNextFocus();
  }

  async function updateSeriesResult(seriesId: string, radiantScore: number, direScore: number): Promise<boolean> {
    const result = await runAction("录入赛果", "PATCH", `/series/${encodeURIComponent(seriesId)}/result`, { radiantScore, direScore });
    return result.ok;
  }

  async function updateSeriesGameMatchId(seriesId: string, gameIndex: number, matchId: number | null): Promise<boolean> {
    const result = await runAction(
      matchId === null ? "解绑 Dota2 比赛 ID" : "保存 Dota2 比赛 ID",
      "POST",
      `/series/${encodeURIComponent(seriesId)}/games/${encodeURIComponent(String(gameIndex))}/result`,
      { matchId },
    );
    return result.ok;
  }

  async function updateSeriesScheduledAt(seriesId: string, scheduledAt: string): Promise<boolean> {
    if (!requireEditableSchedule()) return false;
    const result = await runAction(
      scheduledAt ? "保存对阵时间" : "清空对阵时间",
      "PATCH",
      `/series/${encodeURIComponent(seriesId)}`,
      { scheduledAt },
    );
    return result.ok;
  }

  async function deleteSeries(seriesId: string, description = "这场对阵") {
    if (!window.confirm(`确认删除 ${description}？\n删除后积分、排名和阶段赛程会按后端规则重算。`)) return;
    await runAction("删除对阵", "DELETE", `/series/${encodeURIComponent(seriesId)}`);
  }

  async function updateManualRanks(teamIds: string[]) {
    if (!selectedStage || !requireEditableSchedule()) return;
    await runAction("保存手动排名", "PATCH", `/stages/${encodeURIComponent(selectedStage.id)}/manual-ranks`, {
      actor: "admin",
      ranks: teamIds.map((teamId, index) => ({ teamId, manualRank: index + 1 })),
    });
  }

  async function resetManualRanks() {
    if (!selectedStage || !requireEditableSchedule()) return;
    await runAction("恢复自动排序", "PATCH", `/stages/${encodeURIComponent(selectedStage.id)}/manual-ranks`, {
      actor: "admin",
      ranks: data.standings.map((row) => ({ teamId: standingTeamId(row), manualRank: null })).filter((rank) => rank.teamId),
    });
  }

  function startEditSeries(series: SeriesSummary) {
    setStageForm((current) => ({
      ...current,
      editingSeriesId: series.id,
      editRadiantTeamId: series.radiantTeam.id,
      editDireTeamId: series.direTeam.id,
      editRoundId: series.roundId,
      editGroupId: series.groupId ?? "",
      editSeriesKind: series.seriesKind === "tiebreaker" ? "tiebreaker" : "regular",
      editStatus: series.status || "draft",
      editScheduledAt: toDatetimeLocalInput(series.scheduledAt),
    }));

    window.setTimeout(() => {
      const element = document.getElementById("stage-inline-series-editor");
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY - 18;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      element.focus({ preventScroll: true });
    }, 40);
  }

  async function updateSeriesDraft() {
    if (!stageForm.editingSeriesId || !requireEditableSchedule() || seriesDraftSubmitting) return;
    if (!stageForm.editRadiantTeamId || !stageForm.editDireTeamId || !stageForm.editRoundId) {
      setNotice({ tone: "warn", text: "请确认左右队伍和轮次都已填写。" });
      return;
    }
    if (stageForm.editRadiantTeamId === stageForm.editDireTeamId) {
      setNotice({ tone: "warn", text: "同一支队伍不能同时在对阵两侧。" });
      return;
    }
    const editingSeriesId = stageForm.editingSeriesId;
    setSeriesDraftSubmitting(true);
    try {
      const result = await runAction("保存对阵修改", "PATCH", `/series/${encodeURIComponent(editingSeriesId)}`, {
        roundId: stageForm.editRoundId,
        groupId: selectedStage?.type === "group" ? stageForm.editGroupId || null : null,
        seriesKind: selectedStage?.type === "group" ? stageForm.editSeriesKind : "regular",
        status: stageForm.editStatus,
        scheduledAt: stageForm.editScheduledAt ? serializeDatetimeLocal(stageForm.editScheduledAt) : "",
        radiantTeamId: stageForm.editRadiantTeamId,
        direTeamId: stageForm.editDireTeamId,
      });
      if (result.ok) {
        setStageForm((current) => current.editingSeriesId === editingSeriesId
          ? { ...current, editingSeriesId: "", editRadiantTeamId: "", editDireTeamId: "", editRoundId: "", editGroupId: "", editScheduledAt: "" }
          : current);
        window.setTimeout(() => requestSeriesListFocus(editingSeriesId, "all"), 120);
      }
    } finally {
      setSeriesDraftSubmitting(false);
    }
  }

  async function createManualSeries(overrides: ManualSeriesCreateOverrides = {}) {
    if (!requireStage() || !requireEditableSchedule() || !selectedStage) return;
    if (manualSeriesSubmitting) return;
    const form = { ...stageForm, ...overrides };
    if (!form.manualRadiantTeamId || !form.manualDireTeamId) {
      setNotice({ tone: "warn", text: "请把两支队伍放到左侧和右侧。" });
      return;
    }
    if (form.manualRadiantTeamId === form.manualDireTeamId) {
      setNotice({ tone: "warn", text: "同一支队伍不能同时在对阵两侧。" });
      return;
    }

    setManualSeriesSubmitting(true);
    try {
      setNotice({ tone: "info", text: "创建对阵处理中..." });
      let roundId = form.manualRoundId;
      let createdRoundId = "";
      if (!roundId) {
        const roundResult = await sendAdminRequest("/rounds", "POST", {
          stageId: selectedStage.id,
          name: form.manualRoundName.trim() || defaultManualRoundName(selectedStage, data.rounds.length + 1),
          roundNumber: nextRoundNumber(data.rounds),
          status: "draft",
          pairingStatus: selectedStage.type === "swiss" ? "draft" : undefined,
        });
        if (!roundResult.ok) {
          setNotice({ tone: "warn", text: `创建轮次：${roundResult.message}` });
          return;
        }
        const createdRound = roundResult.data as RoundBrief | undefined;
        roundId = createdRound?.id ?? "";
        createdRoundId = roundId;
      }

      if (!roundId) {
        setNotice({ tone: "warn", text: "轮次创建失败，无法继续创建对阵。" });
        return;
      }

      const createdSeriesKind = selectedStage.type === "group" ? form.manualSeriesKind : "regular";
      const createdPairKey = teamPairKey(form.manualRadiantTeamId, form.manualDireTeamId);
      const createdGroupId = selectedStage.type === "group" ? form.manualGroupId || data.groups[0]?.id || "" : "";
      const seriesResult = await sendAdminRequest("/series", "POST", {
        stageId: selectedStage.id,
        roundId,
        groupId: selectedStage.type === "group" ? createdGroupId || null : null,
        seriesKind: createdSeriesKind,
        boType: "BO2",
        status: "draft",
        scheduledAt: form.manualScheduledAt ? serializeDatetimeLocal(form.manualScheduledAt) : "",
        radiantTeamId: form.manualRadiantTeamId,
        direTeamId: form.manualDireTeamId,
      });
      setNotice({ tone: seriesResult.ok ? "good" : "warn", text: `创建对阵：${seriesResult.message}` });
      if (seriesResult.ok) {
        const createdSeriesId = createdSeriesIdFromResult(seriesResult.data);
        setLastCreatedSeriesId(createdSeriesId);
        const nextGroupPairSuggestion = selectedStage.type === "group" && createdSeriesKind === "regular"
          ? findNextGroupRegularPairSuggestion(data.groups, data.rounds, createdGroupId, createdPairKey)
          : null;
        const nextSwissPair = selectedStage.type === "swiss"
          ? findNextSwissPair(availableTeams, data.standings, data.rounds, createdPairKey)
          : null;
        const nextManualPair = nextGroupPairSuggestion?.pair ?? nextSwissPair;
        setStageForm((current) => ({
          ...current,
          manualGroupId: nextGroupPairSuggestion?.group.id ?? current.manualGroupId,
          manualRadiantTeamId: nextManualPair?.left.id ?? "",
          manualDireTeamId: nextManualPair?.right.id ?? "",
          manualSeriesKind: "regular",
          manualRoundId: createdSeriesKind === "regular" && createdRoundId ? createdRoundId : current.manualRoundId,
          manualRoundName: createdRoundId ? "" : current.manualRoundName,
        }));
        await load(data.selectedTournamentId, selectedStage.id);
        const continuousPairText = nextGroupPairSuggestion
          ? `${nextGroupPairSuggestion.group.name} · ${nextGroupPairSuggestion.pair.left.name} vs ${nextGroupPairSuggestion.pair.right.name}`
          : nextManualPair ? `${nextManualPair.left.name} vs ${nextManualPair.right.name}` : "";
        const createdSeriesLocationText = createdSeriesId ? "赛程列表已高亮新对阵" : "赛程列表已刷新";
        const successText = createdSeriesKind === "tiebreaker"
          ? `加赛已创建，${createdSeriesLocationText}；下一场已自动切回常规赛。`
          : continuousPairText
            ? `对阵已创建，${createdSeriesLocationText}；并已自动填入推荐下一场：${continuousPairText}。确认后可继续创建。`
            : createdRoundId
              ? `对阵已创建并沿用该轮次，当前可排常规对阵已处理完；${createdSeriesLocationText}。`
              : `对阵已创建，${createdSeriesLocationText}。下一步录入赛果或补 Dota2 match_id。`;
        const focusTarget = nextManualPair
          ? selectedStage.type === "swiss" ? "swiss-pairing-primary-action" : "group-pairing-primary-action"
          : createdSeriesId ? seriesRowElementId(createdSeriesId) : "stage-series-list";
        setNotice({ tone: "good", text: successText });
        window.setTimeout(() => focusElementById(focusTarget), 80);
      }
    } finally {
      setManualSeriesSubmitting(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const dragData = normalizeTeamDragData(event.active.data.current, String(event.active.id), data.teams, availableTeams);
    const teamId = dragData.teamId;
    const team = data.teams.find((item) => item.id === teamId) ?? availableTeams.find((item) => item.id === teamId);
    const nextDrag: DragItem = team ? { type: "team", teamId: team.id, label: team.name, color: team.color } : { type: "none" };
    if (nextDrag.type === "team" && dragData.source) nextDrag.source = dragData.source;
    setActiveDrag(nextDrag);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : "";
    setActiveDrag({ type: "none" });
    if (activeId.startsWith("rank:") && overId.startsWith("rank:")) {
      const activeTeamId = activeId.slice("rank:".length);
      const overTeamId = overId.slice("rank:".length);
      const orderedIds = data.standings.map(standingTeamId).filter(Boolean);
      const activeIndex = orderedIds.indexOf(activeTeamId);
      const overIndex = orderedIds.indexOf(overTeamId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        void updateManualRanks(arrayMove(orderedIds, activeIndex, overIndex));
      }
      return;
    }
    if (activeId.startsWith("entrant-order:") && overId.startsWith("entrant-order:")) {
      const activeTeamId = activeId.slice("entrant-order:".length);
      const overTeamId = overId.slice("entrant-order:".length);
      const activeIndex = stageForm.selectedTeamIds.indexOf(activeTeamId);
      const overIndex = stageForm.selectedTeamIds.indexOf(overTeamId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setStageForm((current) => ({ ...current, selectedTeamIds: arrayMove(current.selectedTeamIds, activeIndex, overIndex) }));
      }
      return;
    }
    const dragData = normalizeTeamDragData(event.active.data.current, activeId, data.teams, availableTeams);
    if (!dragData.teamId || !overId) return;
    const teamId = dragData.teamId;

    if ((overId === "pre-group-pool" || overId.startsWith("pre-group:")) && data.schedule?.status !== "published") {
      movePlannedGroupTeam(overId, teamId, setStageForm);
      return;
    }
    if (overId.startsWith("roster:") && !data.schedule?.rosterLocked) {
      moveRosterDraftTeam(overId.slice("roster:".length) as RosterDropTarget, teamId, setRosterIds, setSeededIds);
      return;
    }
    if (overId.startsWith("bracket-entrant:") && data.schedule?.status !== "published") {
      const target = overId.slice("bracket-entrant:".length) as BracketEntrantDropTarget;
      const entrantLimit = bracketEntrantTargetCount(stageForm.knockoutMode, stageForm.bracketSize, stageForm.winnerTeamCount, stageForm.loserTeamCount);
      if (target === "entrant" && !stageForm.selectedTeamIds.includes(teamId) && stageForm.selectedTeamIds.length >= entrantLimit) {
        setNotice({ tone: "warn", text: `淘汰赛入围队伍已达到 ${entrantLimit} 支。先拖出一支队伍再加入。` });
        return;
      }
      moveBracketEntrantDraftTeam(target, teamId, setStageForm);
      return;
    }
    if (overId.startsWith("manual-series:") && data.schedule?.status !== "published" && !manualSeriesSubmitting) {
      moveManualSeriesDraftTeam(overId.slice("manual-series:".length) as ManualSeriesDropTarget, teamId, setStageForm);
      return;
    }
    if (overId.startsWith("edit-series:") && data.schedule?.status !== "published") {
      moveEditSeriesDraftTeam(overId.slice("edit-series:".length) as EditSeriesDropTarget, teamId, setStageForm);
      return;
    }
    if (data.schedule?.status === "published" && (overId === "group-pool" || overId === "bracket-pool" || overId.startsWith("group:") || overId.startsWith("slot:") || overId.startsWith("manual-series:") || overId.startsWith("edit-series:"))) {
      setNotice({ tone: "warn", text: "官方赛程已发布。请先撤回，再拖拽调整分组或对阵图槽位。" });
      return;
    }
    if (overId === "bracket-pool") {
      const sourceSlot = dragData.source?.kind === "bracketSlot" ? dragData.source : undefined;
      if (sourceSlot) void setBracketSlot(sourceSlot.nodeId, sourceSlot.slot, null);
      return;
    }
    if (overId === "group-pool") {
      const sourceGroupId = dragData.source?.kind === "group" ? dragData.source.groupId : findStageGroupIdForTeam(data.groups, teamId);
      if (sourceGroupId) void removeTeamFromGroup(sourceGroupId, teamId);
      return;
    }
    if (overId.startsWith("group:")) {
      const targetGroupId = overId.slice("group:".length);
      if (dragData.source?.kind === "group" && dragData.source.groupId === targetGroupId) return;
      void addTeamToGroup(targetGroupId, teamId);
      return;
    }
    if (overId.startsWith("slot:")) {
      const [, nodeId, slot] = overId.split(":");
      const sourceSlot = dragData.source?.kind === "bracketSlot" ? dragData.source : undefined;
      if (selectedKnockoutEntrantIdSet.size > 0 && !selectedKnockoutEntrantIdSet.has(teamId)) {
        setNotice({ tone: "warn", text: "这支队伍不在当前淘汰赛入围名单里。需要更换入围队伍时，请回到预赛画布重新生成对阵图。" });
        return;
      }
      if (nodeId && (slot === "radiant" || slot === "dire")) void moveBracketTeamToSlot(teamId, { nodeId, slot }, sourceSlot);
    }
  }

  function requireEditableSchedule() {
    if (data.schedule?.status === "published") {
      setNotice({ tone: "warn", text: "官方赛程已发布。请先撤回，再调整赛制、分组或对阵图。" });
      return false;
    }
    return true;
  }

  function requireScheduleConfigured() {
    if (!data.schedule?.rosterLocked || !data.schedule.preliminaryType || !data.schedule.knockoutType) {
      setNotice({ tone: "warn", text: "请先锁定参赛名单，并保存预赛 / 淘汰赛赛制。" });
      return false;
    }
    return true;
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: dndAnnouncements, screenReaderInstructions: dndScreenReaderInstructions }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="admin-app">
        <aside className="admin-sidebar">
          <div className="brand-lockup"><div className="brand-mark">MR</div><div><strong>MRJZ Admin</strong><span>赛事运营台</span></div></div>
          <label className="field-label">
            当前届次
            <select value={data.selectedTournamentId} onChange={(event) => void load(event.target.value, "")} disabled={data.loading || data.tournaments.length === 0}>
              {data.tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="league-chip"><span>league_id</span><strong>{data.detail?.league?.opendotaLeagueId ?? "未配置"}</strong></div>
          <button className="tournament-create-launcher" type="button" onClick={openTournamentCreatePanel} disabled={data.loading} aria-label="新建大联赛 / 届次">
            <Plus size={16} />
            <span><strong>新建大联赛</strong><small>新增届次 · 绑定 league_id</small></span>
            <ArrowRight size={15} />
          </button>
          <nav className="nav-stack">
            {navItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.key} className={activeView === item.key ? "nav-row is-active" : "nav-row"} type="button" onClick={() => switchView(item.key)}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>;
            })}
          </nav>
        </aside>

        <main className="admin-workspace">
          <header className="workspace-topbar">
            <div><span>{data.detail?.season?.name ?? "未选择届次"} / {selectedStage?.name ?? "未选择官方阶段"}</span><h1>{data.detail?.name ?? "MRJZ 赛事后台"}</h1><p>{data.notice}</p></div>
            <div className="topbar-actions">
              <button className="primary-button topbar-create-button" type="button" onClick={openTournamentCreatePanel} disabled={data.loading} title="新建大的联赛 / 届次，不是赛程阶段" aria-label="新建大联赛 / 届次"><Plus size={15} /><span>新建大联赛</span></button>
              <StatusPill tone={data.source === "api" ? "good" : "danger"}>{data.source === "api" ? "API 在线" : "API 不可用"}</StatusPill>
              <span className="api-chip">{apiBaseUrl}</span>
              <button className="icon-button" type="button" onClick={() => void load()} title="刷新后台数据" aria-label="刷新后台数据">{data.loading ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}<span className="sr-only">刷新后台数据</span></button>
            </div>
          </header>
          {tournamentCreateOpen ? (
            <TournamentCreatePanel
              form={tournamentForm}
              open={tournamentCreateOpen}
              loading={data.loading}
              isEmpty={data.source === "api" && data.tournaments.length === 0}
              onToggle={() => setTournamentCreateOpen((current) => !current)}
              onChange={(patch) => setTournamentForm((current) => ({ ...current, ...patch }))}
              onSubmit={createTournament}
            />
          ) : null}
          {notice ? <div className={`notice-bar notice-${notice.tone}`}>{notice.text}</div> : null}
          {activeView === "tournament" ? (
            <TournamentWorkspace
              data={data}
              selectedStage={selectedStage}
              officialStages={officialStages}
              allSeries={allSeries}
              lastCreatedSeriesId={lastCreatedSeriesId}
              manualSeriesSubmitting={manualSeriesSubmitting}
              seriesDraftSubmitting={seriesDraftSubmitting}
              availableTeams={availableTeams}
              rosterIds={rosterIds}
              seededIds={seededIds}
              stageForm={stageForm}
              setStageForm={setStageForm}
              setRosterIds={setRosterIds}
              setSeededIds={setSeededIds}
              load={load}
              lockRoster={lockRoster}
              unlockRoster={unlockRoster}
              updateScheduleConfig={updateScheduleConfig}
              publishSchedule={publishSchedule}
              withdrawSchedule={withdrawSchedule}
              clearScheduleRecords={clearScheduleRecords}
              createGroup={createGroup}
              resizeStageGroups={resizeStageGroups}
              randomizeGroups={randomizeGroups}
              addTeamToGroup={addTeamToGroup}
              removeTeamFromGroup={removeTeamFromGroup}
              updateStageGroupName={updateStageGroupName}
              deleteStageGroup={deleteStageGroup}
              generateGroupRoundRobin={generateGroupRoundRobin}
              generateSwissPairings={generateSwissPairings}
              confirmSwissRound={confirmSwissRound}
              retractSwissRound={retractSwissRound}
              generateBracket={generateBracket}
              createScheduleFrame={createScheduleFrame}
              setBracketSlot={setBracketSlot}
              advanceBracketNode={advanceBracketNode}
              updateSeriesResult={updateSeriesResult}
              updateSeriesScheduledAt={updateSeriesScheduledAt}
              updateSeriesGameMatchId={updateSeriesGameMatchId}
              deleteSeries={deleteSeries}
              updateManualRanks={updateManualRanks}
              resetManualRanks={resetManualRanks}
              startEditSeries={startEditSeries}
              updateSeriesDraft={updateSeriesDraft}
              createManualSeries={createManualSeries}
            />
          ) : activeView === "teams" ? (
            <TeamManagementView data={data} reload={() => load(data.selectedTournamentId, data.selectedStageId)} setNotice={setNotice} />
          ) : <SupportView activeView={activeView} data={data} />}
        </main>
      </div>
      <DragOverlay>{activeDrag.type === "team" ? <div className="drag-overlay" style={{ borderColor: activeDrag.color }}>{activeDrag.label}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function TournamentCreatePanel(props: {
  form: TournamentCreateForm;
  open: boolean;
  loading: boolean;
  isEmpty: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<TournamentCreateForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const canSubmit = Boolean(props.form.name.trim()) && numberFromDraft(props.form.opendotaLeagueId) !== undefined && !props.loading;

  return (
    <section id="tournament-create-panel" tabIndex={-1} className={props.open ? "tournament-create-panel is-open" : "tournament-create-panel"}>
      <button className="tournament-create-toggle" type="button" onClick={props.onToggle} aria-expanded={props.open} aria-controls="tournament-create-form">
        <Plus size={16} />
        <span><strong>{props.isEmpty ? "先新建第一届联赛" : "新建大联赛 / 届次"}</strong><small>填入名称和 OpenDota league_id</small></span>
        <ArrowRight size={15} className={props.open ? "is-open" : ""} />
      </button>
      {props.open ? (
        <form id="tournament-create-form" className="tournament-create-form" onSubmit={(event) => void props.onSubmit(event)}>
          <label>
            联赛名称
            <input id="tournament-create-name-input" value={props.form.name} onChange={(event) => props.onChange({ name: event.target.value })} placeholder="每日节奏第四届" autoComplete="off" />
          </label>
          <label>
            OpenDota league_id
            <input id="tournament-create-league-id-input" inputMode="numeric" value={props.form.opendotaLeagueId} onChange={(event) => props.onChange({ opendotaLeagueId: event.target.value })} placeholder="例如 19483" autoComplete="off" />
          </label>
          <label>
            赛季名
            <input value={props.form.seasonName} onChange={(event) => props.onChange({ seasonName: event.target.value })} placeholder="可选，默认同联赛名称" autoComplete="off" />
          </label>
          <div className="tournament-create-mini-grid">
            <label>
              开始时间
              <input type="datetime-local" value={props.form.startsAt} onChange={(event) => props.onChange({ startsAt: event.target.value })} />
            </label>
            <label>
              状态
              <select value={props.form.status} onChange={(event) => props.onChange({ status: event.target.value as CreateTournamentStatus })}>
                {tournamentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <button className="primary-button full" type="submit" disabled={!canSubmit}>
            <Plus size={15} /> 创建大联赛并同步
          </button>
          <p>创建成功后自动切换到新届次并拉取 OpenDota 比赛记录；小组赛、瑞士轮和淘汰赛仍在“赛事管理”里单独搭建。</p>
        </form>
      ) : null}
    </section>
  );
}

function TournamentWorkspace(props: {
  data: AdminData;
  selectedStage: StageSummary | null;
  officialStages: StageSummary[];
  allSeries: SeriesSummary[];
  lastCreatedSeriesId: string;
  manualSeriesSubmitting: boolean;
  seriesDraftSubmitting: boolean;
  availableTeams: TeamBrief[];
  rosterIds: string[];
  seededIds: string[];
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  setRosterIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSeededIds: React.Dispatch<React.SetStateAction<string[]>>;
  load: (preferredTournamentId?: string, preferredStageId?: string) => Promise<void>;
  lockRoster: (teamIds: string[], seededTeamIds: string[]) => Promise<void>;
  unlockRoster: () => Promise<void>;
  updateScheduleConfig: (preliminaryType: "group" | "swiss", knockoutType: CompetitionMode) => Promise<void>;
  publishSchedule: () => Promise<void>;
  withdrawSchedule: () => Promise<void>;
  clearScheduleRecords: () => Promise<void>;
  createGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resizeStageGroups: (targetCount: number) => Promise<void>;
  randomizeGroups: () => Promise<void>;
  addTeamToGroup: (groupId: string, teamId: string) => Promise<void>;
  removeTeamFromGroup: (groupId: string, teamId: string) => Promise<void>;
  updateStageGroupName: (groupId: string, name: string) => Promise<void>;
  deleteStageGroup: (group: StageGroup) => Promise<void>;
  generateGroupRoundRobin: () => Promise<void>;
  createManualSeries: CreateManualSeriesHandler;
  generateSwissPairings: () => Promise<void>;
  confirmSwissRound: (roundId: string, description?: string) => Promise<void>;
  retractSwissRound: (roundId: string, description?: string) => Promise<void>;
  generateBracket: () => Promise<void>;
  createScheduleFrame: () => Promise<void>;
  setBracketSlot: (nodeId: string, slot: BracketSlotName, teamId: string | null) => Promise<void>;
  advanceBracketNode: (nodeId: string, winnerTeamId: string) => Promise<void>;
  updateSeriesResult: (seriesId: string, radiantScore: number, direScore: number) => Promise<boolean>;
  updateSeriesScheduledAt: (seriesId: string, scheduledAt: string) => Promise<boolean>;
  updateSeriesGameMatchId: (seriesId: string, gameIndex: number, matchId: number | null) => Promise<boolean>;
  deleteSeries: (seriesId: string, description?: string) => Promise<void>;
  updateManualRanks: (teamIds: string[]) => Promise<void>;
  resetManualRanks: () => Promise<void>;
  startEditSeries: (series: SeriesSummary) => void;
  updateSeriesDraft: () => Promise<void>;
}) {
  const readiness = getScheduleReadiness(props.data.schedule, props.officialStages, props.selectedStage, props.allSeries);
  const [focusedWorkflowTarget, setFocusedWorkflowTarget] = useState<WorkflowFocusTarget | null>(null);
  const [scheduleContextOpen, setScheduleContextOpen] = useState(false);
  const focusWorkflowTarget = (target: WorkflowFocusTarget) => {
    const targetIds: Record<WorkflowFocusTarget, string> = {
      "schedule-control": "schedule-control-panel",
      "stage-workspace": "stage-workspace",
      "schedule-frame": "schedule-frame-builder",
      "stage-composer": "stage-composer-panel",
    };
    const element = document.getElementById(targetIds[target]);

    setFocusedWorkflowTarget(target);
    if (target === "schedule-control") setScheduleContextOpen(true);
    window.setTimeout(() => {
      setFocusedWorkflowTarget((current) => (current === target ? null : current));
    }, 1400);

    if (!element) return;

    const top = element.getBoundingClientRect().top + window.scrollY - 18;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    element.focus({ preventScroll: true });
  };
  const schedule = props.data.schedule;
  const hasBaseConfig = Boolean(schedule?.rosterLocked && schedule.preliminaryType && schedule.knockoutType);
  const configuredPreliminaryType = schedule?.preliminaryType === "swiss" ? "swiss" : "group";
  const workflowItemsBase = [
    { label: "参赛名单", ok: Boolean(props.data.schedule?.rosterLocked), hint: props.data.schedule?.rosterLocked ? `${props.data.schedule.teams.length} 队已锁定` : "拖队伍并锁定" },
    { label: "赛制选择", ok: Boolean(props.data.schedule?.preliminaryType && props.data.schedule.knockoutType), hint: `${labelPreliminary(props.data.schedule?.preliminaryType)} + ${labelKnockout(props.data.schedule?.knockoutType)}` },
    { label: "预赛阶段", ok: readiness.hasPreliminaryStage, hint: "小组赛或瑞士轮" },
    {
      label: "淘汰赛",
      ok: readiness.hasKnockoutStage,
      optional: readiness.readyToPublish && !readiness.hasKnockoutStage,
      hint: readiness.hasKnockoutStage ? "对阵图已生成" : readiness.readyToPublish ? "可稍后生成" : "预赛结果后生成",
    },
    { label: "发布", ok: readiness.publishedAndComplete, hint: readiness.publishedButIncomplete ? "已发布但缺阶段" : scheduleStatusLabel(props.data.schedule?.status) },
  ];
  const firstPendingIndex = workflowItemsBase.findIndex((item) => !item.ok && !item.optional);
  const completedStepCount = workflowItemsBase.filter((item) => item.ok || item.optional).length;
  const workflowItems = workflowItemsBase.map((item, index) => ({
    ...item,
    action: index === firstPendingIndex
      ? getWorkflowStepAction(index, props, readiness, hasBaseConfig, focusWorkflowTarget)
      : null,
  }));
  const stageBeforePublishStep = props.selectedStage
    ? getPrePublishStageStep(props.selectedStage, props.data, props.officialStages, props.allSeries, props.availableTeams, props.stageForm)
    : null;
  const nextAction = stageBeforePublishStep
    ? { tone: stageBeforePublishStep.tone, title: stageBeforePublishStep.title, text: stageBeforePublishStep.text }
    : getNextAction(props.data, props.officialStages, props.selectedStage, props.allSeries);
  const nextActionCta = stageBeforePublishStep
    ? {
        label: stageBeforePublishStep.actionLabel,
        onClick: () => {
          if (stageBeforePublishStep.seriesId) {
            requestSeriesListFocus(stageBeforePublishStep.seriesId, stageBeforePublishStep.seriesFilterMode ?? "todo");
            return;
          }
          focusElementById(stageBeforePublishStep.targetId);
        },
      }
    : getNextActionCta(props, readiness, hasBaseConfig, focusWorkflowTarget);
  const shouldPrioritizeFrameBuilder = !props.selectedStage
    && props.officialStages.length === 0
    && props.data.schedule?.status !== "published"
    && Boolean(props.data.schedule?.rosterLocked && props.data.schedule.preliminaryType && props.data.schedule.knockoutType);
  const shouldPrioritizeStageBoard = Boolean(props.selectedStage) && !shouldPrioritizeFrameBuilder;
  const shouldHideTopNextAction = shouldPrioritizeStageBoard && props.selectedStage
    ? shouldHideStageTopNextAction(props.selectedStage, props.data, props.allSeries, props.availableTeams)
    : false;
  const stageStripTitle = shouldPrioritizeFrameBuilder ? "创建预赛草稿" : "官方阶段画布";
  const stageStripCopy = shouldPrioritizeFrameBuilder
    ? "当前只做一件事：先创建预赛画布。淘汰赛等预赛结果确定后再生成。"
    : "这里只有小组赛、瑞士轮和淘汰赛。真实 OpenDota 比赛记录请去“比赛结果库”。";
  const shouldShowStageStrip = !shouldPrioritizeStageBoard || props.officialStages.length > 1;
  const stageWorkspace = (
    <>
      {shouldShowStageStrip ? (
        <section className="stage-strip">
          <div><h2>{stageStripTitle}</h2><p>{stageStripCopy}</p></div>
          <div className="stage-tabs">
            {props.officialStages.length === 0 && !shouldPrioritizeFrameBuilder ? <span className="stage-empty-hint">还没有官方阶段</span> : null}
            {props.officialStages.map((stage) => <button key={stage.id} type="button" className={stage.id === props.data.selectedStageId ? "stage-tab is-active" : "stage-tab"} onClick={() => void props.load(props.data.selectedTournamentId, stage.id)}><span>{labelStageType(stage.type)}</span><strong>{stage.name}</strong></button>)}
          </div>
        </section>
      ) : null}
      {props.selectedStage ? <StageBoard {...props} stage={props.selectedStage} /> : <StageEmptyCanvas {...props} readiness={readiness} focusedWorkflowTarget={focusedWorkflowTarget} focusWorkflowTarget={focusWorkflowTarget} />}
    </>
  );
  const layoutClass = ["tournament-layout", shouldPrioritizeFrameBuilder ? "is-primary-setup" : "", shouldPrioritizeStageBoard ? "is-stage-active" : ""].filter(Boolean).join(" ");
  const stageCanvasClass = [
    "stage-canvas",
    shouldPrioritizeFrameBuilder ? "is-primary-setup" : "",
    shouldPrioritizeStageBoard ? "is-stage-active" : "",
    shouldPrioritizeStageBoard && focusedWorkflowTarget === "stage-workspace" ? "is-attention" : "",
  ].filter(Boolean).join(" ");
  const shouldShowStageComposer = !shouldPrioritizeFrameBuilder && !shouldPrioritizeStageBoard;
  const statusStrip = shouldPrioritizeStageBoard ? null : <OperatorStatusStrip data={props.data} readiness={readiness} officialStages={props.officialStages} />;
  const scheduleControlPanel = (
    <ScheduleControlPanel
      {...props}
      focusActive={focusedWorkflowTarget === "schedule-control"}
      compactMode={shouldPrioritizeFrameBuilder || shouldPrioritizeStageBoard}
      compactOpen={scheduleContextOpen}
      setCompactOpen={setScheduleContextOpen}
    />
  );
  const workflowSteps = workflowItems.map((item, index) => (
    <div key={item.label} className={["workflow-step", item.ok ? "is-done" : "", item.optional ? "is-optional" : "", index === firstPendingIndex ? "is-current" : ""].filter(Boolean).join(" ")}>
      <span>{item.ok ? <Check size={14} /> : item.optional ? <CircleDot size={12} /> : index + 1}</span>
      <strong>{item.label}</strong>
      <small>{item.hint}</small>
      {item.action ? <button type="button" onClick={item.action.onClick} disabled={item.action.disabled}>{item.action.label}</button> : null}
    </div>
  ));
  const workflowProgress = (
    <div className="workflow-progress">
      <div><strong>{completedStepCount}</strong><span>/ {workflowItems.length}</span></div>
      <small>{readiness.publishedAndComplete ? "H5 已发布" : "草稿搭建中"}</small>
      <i><b style={{ width: `${Math.round((completedStepCount / workflowItems.length) * 100)}%` }} /></i>
    </div>
  );
  const workflowRail = shouldPrioritizeStageBoard ? null : (
    <section className="workflow-rail">
      <div className="rail-heading"><ShieldCheck size={18} /><span>赛事搭建流程</span></div>
      {workflowProgress}
      {workflowSteps}
    </section>
  );
  const renderWorkflowAfterWorkspace = shouldPrioritizeFrameBuilder || shouldPrioritizeStageBoard;

  return (
    <div className={layoutClass}>
      {!renderWorkflowAfterWorkspace ? workflowRail : null}
      <section id={shouldPrioritizeStageBoard ? "stage-workspace" : undefined} tabIndex={shouldPrioritizeStageBoard ? -1 : undefined} className={stageCanvasClass}>
        {!shouldPrioritizeFrameBuilder && !shouldHideTopNextAction ? <NextActionBanner action={nextAction} cta={nextActionCta} /> : null}
        {shouldPrioritizeFrameBuilder || shouldPrioritizeStageBoard ? stageWorkspace : null}
        {statusStrip}
        {scheduleControlPanel}
        {!shouldPrioritizeFrameBuilder && !shouldPrioritizeStageBoard ? stageWorkspace : null}
      </section>
      {renderWorkflowAfterWorkspace ? workflowRail : null}
      {shouldShowStageComposer ? <aside id="stage-composer-panel" tabIndex={-1} className={focusedWorkflowTarget === "stage-composer" ? "inspector is-attention" : "inspector"}><StageComposer {...props} focusWorkflowTarget={focusWorkflowTarget} /></aside> : null}
    </div>
  );
}

function shouldHideStageTopNextAction(stage: StageSummary, data: AdminData, allSeries: SeriesSummary[], availableTeams: TeamBrief[]) {
  if (stage.type === "group") {
    const assignedCount = data.groups.reduce((sum, group) => sum + group.teams.length, 0);
    const allAssigned = availableTeams.length > 0 && assignedCount >= availableTeams.length;
    const everyGroupReady = data.groups.length > 0 && data.groups.every((group) => group.teams.length >= 2);
    const groupSeriesCount = allSeries.filter((series) => series.groupId).length;
    return allAssigned && everyGroupReady && groupSeriesCount === 0;
  }

  if (stage.type === "swiss") {
    const hasDraftRound = data.rounds.some((round) => round.pairingStatus !== "confirmed");
    return !hasDraftRound;
  }

  return false;
}

function getWorkflowStepAction(
  index: number,
  props: Parameters<typeof TournamentWorkspace>[0],
  readiness: ScheduleReadiness,
  hasBaseConfig: boolean,
  focusWorkflowTarget: (target: WorkflowFocusTarget) => void,
): NextActionCta | null {
  if (readiness.publishedButIncomplete) return null;
  if (index === 0) {
    return {
      label: "查看名单",
      onClick: () => focusWorkflowTarget("schedule-control"),
    };
  }
  if (index === 1) {
    return {
      label: "选择赛制",
      onClick: () => focusWorkflowTarget("schedule-control"),
    };
  }
  if (index === 2 && hasBaseConfig) {
    if (!readiness.hasPreliminaryStage && !readiness.hasKnockoutStage) {
      return { label: "查看搭建区", onClick: () => focusWorkflowTarget("schedule-frame") };
    }

    return {
      label: "查看创建入口",
      onClick: () => focusWorkflowTarget("stage-workspace"),
    };
  }
  if (index === 4 && readiness.readyToPublish && props.data.schedule?.status !== "published") {
    return { label: "查看发布检查", onClick: () => focusWorkflowTarget("schedule-control") };
  }
  if (index === 3 && hasBaseConfig && readiness.hasPreliminaryStage) {
    return {
      label: "查看预赛画布",
      onClick: () => focusWorkflowTarget("stage-workspace"),
      disabled: props.availableTeams.length < 2,
    };
  }
  return null;
}

function getNextActionCta(
  props: Parameters<typeof TournamentWorkspace>[0],
  readiness: ScheduleReadiness,
  hasBaseConfig: boolean,
  focusWorkflowTarget: (target: WorkflowFocusTarget) => void,
): NextActionCta | null {
  const schedule = props.data.schedule;
  if (readiness.publishedButIncomplete) return null;
  if (!schedule?.rosterLocked) {
    return {
      label: "查看名单",
      onClick: () => focusWorkflowTarget("schedule-control"),
    };
  }
  if (!schedule.preliminaryType || !schedule.knockoutType) {
    return {
      label: "选择赛制",
      onClick: () => focusWorkflowTarget("schedule-control"),
    };
  }
  if (!readiness.hasPreliminaryStage && !readiness.hasKnockoutStage && hasBaseConfig) {
    return {
      label: "查看搭建区",
      onClick: () => focusWorkflowTarget("schedule-frame"),
    };
  }
  if (!readiness.hasPreliminaryStage && hasBaseConfig) {
    return {
      label: "查看创建入口",
      onClick: () => focusWorkflowTarget("stage-workspace"),
    };
  }
  if (readiness.readyToPublish && schedule.status !== "published") {
    return { label: "查看发布检查", onClick: () => focusWorkflowTarget("schedule-control") };
  }
  if (!readiness.hasKnockoutStage && hasBaseConfig) {
    return {
      label: "查看预赛画布",
      onClick: () => focusWorkflowTarget("stage-workspace"),
      disabled: props.availableTeams.length < 2,
    };
  }
  if (readiness.publishedAndComplete) return { label: "查看发布状态", onClick: () => focusWorkflowTarget("schedule-control"), kind: "secondary" };
  return null;
}

function NextActionBanner({ action, cta }: { action: NextActionView; cta: NextActionCta | null }) {
  return <section className={`next-action next-action-${action.tone}`}><div><span>下一步</span><strong>{action.title}</strong><p>{action.text}</p></div><div className="next-action-side">{cta ? <button type="button" className={`next-action-cta next-action-cta-${cta.kind ?? "primary"}`} onClick={cta.onClick} disabled={cta.disabled}>{cta.label}</button> : null}<ArrowRight size={22} /></div></section>;
}

function OperatorStatusStrip({ data, readiness, officialStages }: { data: AdminData; readiness: ScheduleReadiness; officialStages: StageSummary[] }) {
  const scheduleStatus = readiness.publishedButIncomplete ? "已发布但缺内容" : scheduleStatusLabel(data.schedule?.status);
  const h5Visibility = getScheduleVisibilityStatus(data.schedule, readiness);
  const editStatus = data.schedule?.status === "published" ? "发布锁定" : "草稿可编辑";
  const stageText = formatOfficialStageStatus(readiness);
  return (
    <section className="operator-status-strip" aria-label="官方赛程运营状态">
      <div><span>参赛名单</span><strong>{data.schedule?.rosterLocked ? `${data.schedule.teams.length} 队已锁定` : "未锁定"}</strong></div>
      <div><span>赛程状态</span><strong>{scheduleStatus}</strong></div>
      <div><span>官方阶段</span><strong>{officialStages.length} 个 · {stageText}</strong></div>
      <div><span>{h5Visibility.label}</span><strong>{h5Visibility.detail || editStatus}</strong></div>
    </section>
  );
}

function getScheduleVisibilityStatus(schedule: OfficialScheduleManagement | null, readiness: ScheduleReadiness): { tone: Tone; label: string; detail: string } {
  if (schedule?.status === "published" && readiness.readyToPublish) {
    return { tone: "good", label: "H5 可见", detail: "赛程页展示中" };
  }

  if (schedule?.status === "published") {
    return { tone: "warn", label: "H5 状态异常", detail: "已发布但缺内容" };
  }

  if (schedule?.status === "withdrawn") {
    return { tone: "warn", label: "H5 未发布", detail: "已撤回" };
  }

  if (schedule?.status === "draft") {
    return { tone: "info", label: "H5 未发布", detail: "草稿中" };
  }

  return { tone: "neutral", label: "H5 未发布", detail: "未配置" };
}

function formatOfficialStageStatus(readiness: ScheduleReadiness) {
  const preliminaryText = !readiness.hasPreliminaryStage
    ? "待建预赛"
    : readiness.hasPreliminarySeries
      ? "预赛有对阵"
      : "预赛待排赛";
  const knockoutText = readiness.hasKnockoutStage
    ? "淘汰赛已建"
    : readiness.hasPreliminarySeries
      ? "淘汰赛可稍后"
      : "淘汰赛等预赛";
  return `${preliminaryText} / ${knockoutText}`;
}

function StageEmptyCanvas(props: {
  data: AdminData;
  readiness: ScheduleReadiness;
  focusedWorkflowTarget: WorkflowFocusTarget | null;
  focusWorkflowTarget: (target: WorkflowFocusTarget) => void;
  availableTeams: TeamBrief[];
  rosterIds: string[];
  seededIds: string[];
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  lockRoster: (teamIds: string[], seededTeamIds: string[]) => Promise<void>;
  withdrawSchedule: () => Promise<void>;
  generateBracket: () => Promise<void>;
  createScheduleFrame: () => Promise<void>;
}) {
  const schedule = props.data.schedule;
  const isPublished = schedule?.status === "published";
  const hasBaseConfig = Boolean(schedule?.rosterLocked && schedule.preliminaryType && schedule.knockoutType);
  const configuredPreliminaryType = schedule?.preliminaryType === "swiss" ? "swiss" : "group";
  const configuredPreliminaryLabel = configuredPreliminaryType === "swiss" ? "瑞士轮" : "小组赛";
  const canCreateFrame = !isPublished && hasBaseConfig && !props.readiness.hasPreliminaryStage;
  const shouldCreateFullFrame = canCreateFrame && !props.readiness.hasKnockoutStage;
  const rosterTeams = schedule?.rosterLocked
    ? schedule.teams.map((item) => item.team)
    : orderTeamsByIds(props.data.teams, props.rosterIds);
  const headline = props.readiness.publishedButIncomplete
    ? "先恢复草稿，再补齐官方阶段"
    : !schedule?.rosterLocked
      ? "先确定这届比赛有哪些队伍"
      : !schedule.preliminaryType || !schedule.knockoutType
        ? "选择本届赛制后开始搭建"
        : !props.readiness.hasPreliminaryStage
          ? "创建预赛草稿"
          : !props.readiness.hasKnockoutStage
          ? "预赛完成后生成淘汰赛"
          : "官方阶段已准备好";
  const copy = props.readiness.publishedButIncomplete
    ? "当前 H5 处于发布状态，但后台没有完整官方阶段。撤回后，预赛和淘汰赛工具会重新开放。"
    : !schedule?.rosterLocked
      ? "在官方赛程控制台把队伍拖进参赛名单，确认无误后锁定。锁定前不会生成任何公开赛程。"
      : !schedule.preliminaryType || !schedule.knockoutType
        ? "在上方控制台保存“小组赛/瑞士轮 + 单败/双败”组合，之后这里会变成对应的创建入口。"
        : !props.readiness.hasPreliminaryStage
          ? "点击后只创建预赛阶段草稿，不会提前生成淘汰赛。等小组赛或瑞士轮结果确定后，再选择晋级队伍生成对阵图。"
        : !props.readiness.hasKnockoutStage
          ? "先完成预赛对阵和赛果，再在预赛主画布把晋级队伍拖进入围区；例如 6 队单败时，前 2 个种子会直接在半决赛等待。"
          : "预赛和淘汰赛阶段都已经存在。确认赛程、赛果和对阵图无误后再发布。";

  const stageSteps = [
    {
      label: "参赛名单",
      status: schedule?.rosterLocked ? `${schedule.teams.length} 队已锁定` : `${props.rosterIds.length} 队待锁定`,
      done: Boolean(schedule?.rosterLocked),
      locked: isPublished,
      action: !schedule?.rosterLocked ? { label: "查看名单区", onClick: () => props.focusWorkflowTarget("schedule-control"), disabled: false } : null,
    },
    {
      label: "赛制",
      status: `${labelPreliminary(schedule?.preliminaryType)} + ${labelKnockout(schedule?.knockoutType)}`,
      done: Boolean(schedule?.preliminaryType && schedule.knockoutType),
      locked: isPublished || !schedule?.rosterLocked,
      action: null,
    },
    {
      label: "预赛阶段",
      status: props.readiness.hasPreliminaryStage ? "已创建" : configuredPreliminaryLabel,
      done: props.readiness.hasPreliminaryStage,
      locked: isPublished || !hasBaseConfig,
      action: !shouldCreateFullFrame && !props.readiness.hasPreliminaryStage && hasBaseConfig && !isPublished ? { label: "查看创建设置", onClick: () => props.focusWorkflowTarget("schedule-frame"), disabled: false } : null,
    },
    {
      label: "淘汰赛",
      status: props.readiness.hasKnockoutStage ? "已生成" : "预赛完成后生成",
      done: props.readiness.hasKnockoutStage,
      locked: isPublished || !hasBaseConfig || !props.readiness.hasPreliminaryStage,
      action: !shouldCreateFullFrame && !props.readiness.hasKnockoutStage && hasBaseConfig && props.readiness.hasPreliminaryStage && !isPublished ? { label: "查看预赛画布", onClick: () => props.focusWorkflowTarget("stage-workspace"), disabled: props.availableTeams.length < 2 } : null,
    },
  ];

  return (
    <section id="stage-workspace" tabIndex={-1} className={props.focusedWorkflowTarget === "stage-workspace" ? "empty-stage-workspace is-attention" : "empty-stage-workspace"}>
      {!canCreateFrame ? <div className="empty-stage-main">
        <div>
          <span className="stage-workspace-kicker">官方阶段工作面</span>
          <h2>{headline}</h2>
          <p>{copy}</p>
        </div>
        <div className="empty-stage-actions">
          {isPublished ? <button type="button" className="primary-button" onClick={() => void props.withdrawSchedule()}><RotateCcw size={15} /> 撤回发布</button> : null}
          {!isPublished && !schedule?.rosterLocked ? <button type="button" className="primary-button" onClick={() => props.focusWorkflowTarget("schedule-control")}><Lock size={15} /> 查看名单区</button> : null}
          {!shouldCreateFullFrame && !isPublished && hasBaseConfig && !props.readiness.hasPreliminaryStage ? <button type="button" className="primary-button" onClick={() => props.focusWorkflowTarget("schedule-frame")}><GitBranch size={15} /> 查看创建设置</button> : null}
          {!shouldCreateFullFrame && !isPublished && hasBaseConfig && props.readiness.hasPreliminaryStage && !props.readiness.hasKnockoutStage ? <button type="button" className="primary-button" onClick={() => props.focusWorkflowTarget("stage-workspace")} disabled={props.availableTeams.length < 2}><Brackets size={15} /> 查看预赛画布</button> : null}
        </div>
      </div> : null}
      {canCreateFrame ? <ScheduleFrameBuilder schedule={schedule} preliminaryLabel={configuredPreliminaryLabel} stageForm={props.stageForm} setStageForm={props.setStageForm} createScheduleFrame={props.createScheduleFrame} focusActive={props.focusedWorkflowTarget === "schedule-frame"} /> : null}
      {!canCreateFrame ? <div className="stage-plan-list">
        {stageSteps.map((step, index) => <div key={step.label} className={["stage-plan-step", step.done ? "is-done" : "", step.locked ? "is-locked" : ""].filter(Boolean).join(" ")}><span>{step.done ? <Check size={14} /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.status}</small></div>{step.action ? <button type="button" onClick={step.action.onClick} disabled={step.action.disabled}>{step.action.label}</button> : null}</div>)}
      </div> : null}
      {!canCreateFrame ? <div className="empty-stage-roster">
        <div><strong>{schedule?.rosterLocked ? "已锁定参赛队" : "当前名单草稿"}</strong><small>{rosterTeams.length} 支队伍</small></div>
        <div className="empty-stage-team-list">
          {rosterTeams.length === 0 ? <span className="muted">还没有选择队伍。</span> : rosterTeams.map((team) => <span key={team.id} className="stage-team-token"><i style={{ background: team.color }} />{team.name}</span>)}
        </div>
      </div> : null}
    </section>
  );
}

function ScheduleFrameBuilder(props: {
  schedule: OfficialScheduleManagement | null;
  preliminaryLabel: string;
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createScheduleFrame: () => Promise<void>;
  focusActive?: boolean;
}) {
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const rosterCount = props.schedule?.teams.length ?? 0;
  const groupCount = clampInteger(props.stageForm.groupCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
  const frameReady = Boolean(props.schedule?.rosterLocked && props.schedule.preliminaryType && props.schedule.knockoutType);
  const isSwiss = props.preliminaryLabel === "瑞士轮";
  const lockedTeams = props.schedule?.teams.map((entry) => entry.team) ?? [];
  const groupOptions = Array.from({ length: groupCount }, (_, index) => ({ index, name: defaultGroupName(index) }));
  const groupCountPresets = GROUP_COUNT_PRESETS;
  const swissRoundPresets = [3, 4, 5, 6];
  const updateGroupCount = (nextCount: number) => {
    const safeCount = clampInteger(nextCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
    props.setStageForm((current) => ({
      ...current,
      groupCount: safeCount,
      plannedGroupAssignments: filterPlannedGroupAssignments(current.plannedGroupAssignments, lockedTeams.map((team) => team.id), safeCount),
    }));
  };
  const updateSwissRounds = (nextRounds: number) => {
    patch({ swissRounds: clampInteger(nextRounds, 1, 9) });
  };
  const plannedGroupCount = lockedTeams.filter((team) => {
    const groupIndex = props.stageForm.plannedGroupAssignments[team.id];
    return typeof groupIndex === "number" && groupIndex >= 0 && groupIndex < groupCount;
  }).length;
  const createLabel = isSwiss ? "创建瑞士轮画布" : plannedGroupCount > 0 ? "创建并应用分组" : "创建空小组画布";
  const createButtonLabel = isSwiss ? "创建瑞士轮画布" : plannedGroupCount > 0 ? "创建并应用分组" : "创建空小组";
  const createProgressTone = isSwiss ? "info" : plannedGroupCount === 0 ? "neutral" : plannedGroupCount >= rosterCount ? "good" : "info";
  const createProgressPercent = isSwiss ? 100 : rosterCount > 0 ? Math.round((plannedGroupCount / rosterCount) * 100) : 0;
  const createProgressLabel = isSwiss ? "轮数" : "预分组";
  const createProgressValue = isSwiss ? `${props.stageForm.swissRounds} 轮` : `${plannedGroupCount}/${rosterCount}`;
  const createProgressNote = isSwiss
    ? "创建后手动配对"
    : plannedGroupCount === 0
      ? "可以空组创建"
      : plannedGroupCount >= rosterCount
        ? "全部已放入小组"
        : "未放入队伍可创建后再拖";
  const cards = [
    { label: "预赛", title: props.preliminaryLabel, text: isSwiss ? `${props.stageForm.swissRounds} 轮 · BO2` : `${groupCount} 个小组 · 拖拽分组` },
    { label: "参赛名单", title: `${rosterCount} 支队伍`, text: isSwiss ? "进入画布后手动配对" : `${plannedGroupCount}/${rosterCount} 支已预分组` },
    { label: "淘汰赛", title: labelKnockout(props.schedule?.knockoutType), text: "预赛结果确定后再生成对阵图" },
  ];
  const frameSummaryText = `${props.preliminaryLabel} · ${rosterCount} 支队伍 · ${labelKnockout(props.schedule?.knockoutType)}`;
  const flowSteps = isSwiss
    ? [
      { label: "创建画布", title: "瑞士轮预赛", text: "只创建预赛阶段，H5 暂不可见" },
      { label: "配对", title: `第 ${props.stageForm.swissRoundNumber} 轮`, text: "先拖两队；自动配对只是辅助" },
      { label: "确认", title: "确认轮次与赛果", text: "确认后成为正式赛程" },
      { label: "淘汰赛", title: "从排名拖入晋级队", text: "预赛结束后再生成对阵图" },
    ]
    : [
      { label: "预分组", title: "把队伍拖进小组", text: "可留空，创建后继续调整" },
      { label: "创建画布", title: `${groupCount} 个小组`, text: "只应用分组，不生成赛程" },
      { label: "排赛", title: "生成或手动创建 BO2", text: "默认单循环，也可手动补加赛" },
      { label: "淘汰赛", title: "从排名拖入晋级队", text: "预赛结束后再生成对阵图" },
    ];
  const createPrimarySummary = isSwiss
    ? `瑞士轮 ${props.stageForm.swissRounds} 轮 · BO2`
    : `${groupCount} 个小组${plannedGroupCount > 0 ? ` · 应用 ${plannedGroupCount} 支预分组` : " · 创建空小组"}`;
  const createMetaItems = [
    { icon: <GitBranch size={13} />, text: isSwiss ? "只创建瑞士轮画布" : "只创建小组画布" },
    { icon: <Check size={13} />, text: "不自动生成对阵" },
    { icon: <Brackets size={13} />, text: "淘汰赛稍后生成" },
    { icon: <Lock size={13} />, text: "发布前 H5 不可见" },
  ];
  const setupSteps = isSwiss
    ? [
      { label: "1", title: "选轮数", text: `${props.stageForm.swissRounds} 轮 BO2` },
      { label: "2", title: "创建画布", text: "先不排淘汰赛" },
      { label: "3", title: "手动配对", text: "进入画布后拖两队" },
    ]
    : [
      { label: "1", title: "选小组", text: `${groupCount} 组` },
      { label: "2", title: "拖分组", text: plannedGroupCount > 0 ? `${plannedGroupCount}/${rosterCount} 已放入` : "可先空组" },
      { label: "3", title: "创建画布", text: "只建组，不排赛" },
    ];
  return (
    <section id="schedule-frame-builder" tabIndex={-1} className={props.focusActive ? "schedule-frame-builder is-attention" : "schedule-frame-builder"}>
      <div className="frame-builder-command">
        <div className="frame-builder-copy">
          <span>推荐路径</span>
          <strong>先创建预赛草稿</strong>
          <p>{isSwiss ? "先创建瑞士轮画布；配对和淘汰赛都在后续画布里处理。" : "先选小组数量，再拖队伍；创建后仍可继续调整分组。"}</p>
        </div>
        <div className="frame-builder-stepper" aria-label="创建预赛草稿步骤">
          {setupSteps.map((step, index) => <div key={step.title} className={index === 0 ? "frame-builder-step is-current" : "frame-builder-step"}><span>{step.label}</span><strong>{step.title}</strong><small>{step.text}</small></div>)}
        </div>
      </div>
      <div className={frameReady ? "frame-builder-submit frame-builder-create-bar is-ready" : "frame-builder-submit frame-builder-create-bar"}>
        <div className="frame-builder-submit-copy">
          <span>下一步</span>
          <strong>{frameReady ? createLabel : "先完成名单和赛制"}</strong>
          <small>{createPrimarySummary}</small>
        </div>
        <div className="frame-builder-create-controls">
          {isSwiss
            ? <div className="swiss-round-picker">
              <span>瑞士轮轮数</span>
              <div className="group-count-presets">
                {swissRoundPresets.map((rounds) => <button key={rounds} type="button" className={props.stageForm.swissRounds === rounds ? "is-active" : ""} onClick={() => updateSwissRounds(rounds)}>{rounds} 轮</button>)}
              </div>
              <label>自定义<input aria-label="自定义瑞士轮轮数" type="number" min={1} max={9} value={props.stageForm.swissRounds} onChange={(event) => updateSwissRounds(Number(event.target.value))} /></label>
            </div>
            : <div className="group-count-picker">
              <span>小组数量</span>
              <div className="group-count-presets">
                {groupCountPresets.map((count) => <button key={count} type="button" className={groupCount === count ? "is-active" : ""} onClick={() => updateGroupCount(count)}>{count} 组</button>)}
              </div>
              <label>自定义<input aria-label="自定义小组数量" type="number" min={MIN_GROUP_COUNT} max={MAX_GROUP_COUNT} value={props.stageForm.groupCount} onChange={(event) => updateGroupCount(Number(event.target.value))} /></label>
              <small className="group-count-current">新建默认 1 组，不固定 A/B；当前将创建 {groupCount} 个空小组，队伍可先拖入目标小组，也可以创建后再调整。</small>
            </div>}
        </div>
        <div className={`frame-builder-create-progress is-${createProgressTone}`} aria-label={isSwiss ? `瑞士轮 ${props.stageForm.swissRounds} 轮` : `预分组 ${plannedGroupCount}/${rosterCount}`}>
          <div><span>{createProgressLabel}</span><strong>{createProgressValue}</strong></div>
          <i><b style={{ width: `${createProgressPercent}%` }} /></i>
          <small>{createProgressNote}</small>
        </div>
        <div className="frame-builder-submit-meta">
          {createMetaItems.map((item) => <span key={item.text}>{item.icon}{item.text}</span>)}
        </div>
        <button type="button" className="primary-button" onClick={() => void props.createScheduleFrame()} disabled={!frameReady}><GitBranch size={15} /> {createButtonLabel}</button>
      </div>
      {!isSwiss ? (
        <PreCreateGroupPlanner
          teams={lockedTeams}
          groupOptions={groupOptions}
          assignments={props.stageForm.plannedGroupAssignments}
          setStageForm={props.setStageForm}
        />
      ) : null}
      <details className="frame-builder-summary-details">
        <summary>当前创建摘要：{frameSummaryText}</summary>
        <div className="frame-builder-cards">
          {cards.map((card) => <div key={card.label}><span>{card.label}</span><strong>{card.title}</strong><small>{card.text}</small></div>)}
        </div>
      </details>
      <details className="frame-builder-flow-details">
        <summary>查看创建后的操作路径</summary>
        <div className="frame-builder-flow" aria-label="创建预赛后的操作路径">
          {flowSteps.map((step, index) => (
            <div key={step.label}>
              <span>{index + 1}</span>
              <div><strong>{step.title}</strong><small>{step.text}</small></div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function PreCreateGroupPlanner(props: {
  teams: TeamBrief[];
  groupOptions: Array<{ index: number; name: string }>;
  assignments: Record<string, number>;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
}) {
  const [teamFilter, setTeamFilter] = useState("");
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const validAssignments = new Map(
    props.teams
      .map((team) => [team.id, props.assignments[team.id]] as const)
      .filter(([, groupIndex]) => typeof groupIndex === "number" && props.groupOptions.some((option) => option.index === groupIndex)),
  );
  const assignedCount = validAssignments.size;
  const groupedTeams = props.groupOptions.map((option) => ({
    ...option,
    teams: props.teams.filter((team) => validAssignments.get(team.id) === option.index),
  }));
  const unassignedTeams = props.teams.filter((team) => !validAssignments.has(team.id));
  const visibleUnassignedTeams = normalizedTeamFilter
    ? unassignedTeams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter))
    : unassignedTeams;
  const visibleGroupedTeams = groupedTeams.map((group) => ({
    ...group,
    visibleTeams: normalizedTeamFilter ? group.teams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : group.teams,
  }));
  const visibleTeamCount = visibleUnassignedTeams.length + visibleGroupedTeams.reduce((sum, group) => sum + group.visibleTeams.length, 0);
  const groupCounts = props.groupOptions.map((option) => ({
    ...option,
    count: props.teams.filter((team) => validAssignments.get(team.id) === option.index).length,
  }));
  const groupSummaryText = groupCounts.length > 0 ? groupCounts.map((group) => `${group.name} ${group.count}`).join(" · ") : "暂无小组";
  const nonEmptyGroupCounts = groupCounts.map((group) => group.count);
  const minGroupCount = nonEmptyGroupCounts.length > 0 ? Math.min(...nonEmptyGroupCounts) : 0;
  const maxGroupCount = nonEmptyGroupCounts.length > 0 ? Math.max(...nonEmptyGroupCounts) : 0;
  const isBalanced = props.groupOptions.length > 0 && unassignedTeams.length === 0 && maxGroupCount - minGroupCount <= 1;
  const isEmptyPlan = props.teams.length > 0 && assignedCount === 0;
  const balanceTone = isBalanced ? "good" : isEmptyPlan ? "info" : unassignedTeams.length > 0 ? "warn" : "info";
  const balanceTitle = isBalanced ? "分组均衡，可以创建" : isEmptyPlan ? "可以创建空小组" : unassignedTeams.length > 0 ? `还有 ${unassignedTeams.length} 支未分组` : "人数不均，可继续拖拽";
  const balanceCopy = isBalanced
    ? `当前 ${props.groupOptions.length} 个小组人数差不超过 1。`
    : isEmptyPlan
      ? "不预分组也可以继续；创建后在小组画布里拖队伍入组。"
      : unassignedTeams.length > 0
        ? "可以继续拖队伍进组，也可以按当前安排创建后再微调。"
        : "如果这是刻意安排，可以照常创建；也可以继续拖拽微调。";
  const setAssignment = (teamId: string, value: string) => {
    props.setStageForm((current) => {
      const next = { ...current.plannedGroupAssignments };
      if (value === "") delete next[teamId];
      else next[teamId] = Number(value);
      return { ...current, plannedGroupAssignments: next };
    });
  };
  const clearAssignments = () => {
    props.setStageForm((current) => ({ ...current, plannedGroupAssignments: {} }));
  };
  const randomizeAssignments = () => {
    if (props.groupOptions.length === 0) return;
    props.setStageForm((current) => {
      const next: Record<string, number> = {};
      shuffleTeamIds(props.teams).forEach((teamId, index) => {
        const targetGroup = props.groupOptions[index % props.groupOptions.length];
        if (targetGroup) next[teamId] = targetGroup.index;
      });
      return { ...current, plannedGroupAssignments: next };
    });
  };

  return (
    <section className="precreate-group-planner">
      <div className="precreate-workbar">
        <div className={`precreate-workbar-status is-${balanceTone}`}>
          <ShieldCheck size={15} />
          <div>
            <strong>{balanceTitle}</strong>
            <small>{assignedCount}/{props.teams.length} 已放入 · {groupSummaryText}</small>
          </div>
        </div>
        <div className="precreate-workbar-search">
          <label><Search size={14} /><span>查找</span><input value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} placeholder="队名或缩写" /></label>
          <strong>{normalizedTeamFilter ? `${visibleTeamCount}/${props.teams.length}` : `${props.teams.length} 队`}</strong>
          {normalizedTeamFilter ? <button type="button" onClick={() => setTeamFilter("")}>清除</button> : null}
        </div>
        <details className="precreate-assist-details is-compact">
          <summary>辅助</summary>
          <div className="precreate-assist-actions">
            <button type="button" onClick={randomizeAssignments} disabled={props.teams.length === 0 || props.groupOptions.length === 0}><Dices size={13} /> 随机预分组</button>
            <button type="button" onClick={clearAssignments} disabled={assignedCount === 0}>清空预分组</button>
            <span>{balanceCopy}</span>
          </div>
        </details>
      </div>
      <div className="precreate-drag-board" aria-label="拖拽预分组">
        <PreCreatePool
          teams={visibleUnassignedTeams}
          totalCount={unassignedTeams.length}
          emptyText={props.teams.length === 0 ? "先在左侧锁定参赛名单" : normalizedTeamFilter ? "未分组池无匹配队伍" : "所有队伍都已放入小组"}
        />
        <div className="precreate-group-columns">
          {visibleGroupedTeams.map((group) => (
            <PreCreateGroupColumn
              key={group.index}
              groupIndex={group.index}
              name={group.name}
              teams={group.visibleTeams}
              totalCount={group.teams.length}
              emptyText={normalizedTeamFilter ? "本组无匹配队伍" : "拖队伍到这里"}
            />
          ))}
        </div>
      </div>
      <details className="precreate-group-details">
        <summary>用下拉精确修正分组</summary>
        <div className="precreate-group-grid">
          {props.teams.length === 0 ? <div className="drop-placeholder compact">先在左侧锁定参赛名单</div> : null}
          {props.teams.map((team) => {
            const groupIndex = validAssignments.get(team.id);
            return (
              <label key={team.id} className="precreate-group-row">
                <span><i style={{ background: team.color }} />{team.name}</span>
                <select value={typeof groupIndex === "number" ? String(groupIndex) : ""} onChange={(event) => setAssignment(team.id, event.target.value)}>
                  <option value="">创建后再分</option>
                  {props.groupOptions.map((group) => <option key={group.index} value={group.index}>{group.name}</option>)}
                </select>
              </label>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function PreCreatePool({ teams, totalCount, emptyText }: { teams: TeamBrief[]; totalCount?: number; emptyText: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: "pre-group-pool" });
  const countText = totalCount !== undefined && totalCount !== teams.length ? `${teams.length}/${totalCount} 队` : `${teams.length} 队`;
  return (
    <section ref={setNodeRef} className={["precreate-pool", isOver ? "is-over" : ""].filter(Boolean).join(" ")}>
      <div className="precreate-column-title"><strong>未分组池</strong><small>{countText}</small></div>
      <div className="precreate-chip-list">
        {teams.length === 0 ? <div className="drop-placeholder compact">{emptyText}</div> : null}
        {teams.map((team) => <DraggableTeam key={team.id} team={team} dragId={`pre-group-team:${team.id}`} />)}
      </div>
    </section>
  );
}

function PreCreateGroupColumn({ groupIndex, name, teams, totalCount, emptyText = "拖队伍到这里" }: { groupIndex: number; name: string; teams: TeamBrief[]; totalCount?: number; emptyText?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: `pre-group:${groupIndex}` });
  const countText = totalCount !== undefined && totalCount !== teams.length ? `${teams.length}/${totalCount} 队` : `${teams.length} 队`;
  return (
    <section ref={setNodeRef} className={["precreate-group-column", isOver ? "is-over" : ""].filter(Boolean).join(" ")}>
      <div className="precreate-column-title"><strong>{name}</strong><small>{countText}</small></div>
      <div className="precreate-chip-list">
        {teams.length === 0 ? <div className="drop-placeholder compact">{emptyText}</div> : null}
        {teams.map((team) => <DraggableTeam key={team.id} team={team} dragId={`pre-group-team:${team.id}`} />)}
      </div>
    </section>
  );
}

function BracketSeedPreview(props: {
  bracketSize: number;
  selectedTeams: TeamBrief[];
  isDoubleElimination: boolean;
  winnerTeamCount: number;
  loserTeamCount: number;
}) {
  if (!props.isDoubleElimination && props.bracketSize === 6) {
    const teamAtSeed = (seed: number) => props.selectedTeams[seed - 1] ?? null;
    const firstRoundPairs = [
      { position: 1, top: { label: "Seed 3", team: teamAtSeed(3) }, bottom: { label: "Seed 6", team: teamAtSeed(6) }, next: "胜者进入半决赛下半区" },
      { position: 2, top: { label: "Seed 4", team: teamAtSeed(4) }, bottom: { label: "Seed 5", team: teamAtSeed(5) }, next: "胜者进入半决赛上半区" },
    ];
    const waitingSeeds = [
      { position: 1, top: { label: "Seed 1", team: teamAtSeed(1) }, bottom: "等待 4/5 胜者" },
      { position: 2, top: { label: "Seed 2", team: teamAtSeed(2) }, bottom: "等待 3/6 胜者" },
    ];

    return (
      <section className="frame-builder-preview">
        <div className="frame-builder-preview-head">
          <div>
            <strong>6 队单败槽位预览</strong>
            <small>前 2 个种子直接进入半决赛；其余 4 支队伍先打一轮。</small>
          </div>
          <span>6 队对阵图</span>
        </div>
        <div className="seed-preview-grid">
          {firstRoundPairs.map((pair) => (
            <div key={pair.position} className="seed-preview-node">
              <span>第 1 轮对阵 {pair.position}</span>
              <SeedPreviewSlot label={pair.top.label} team={pair.top.team} emptyText="空槽" />
              <SeedPreviewSlot label={pair.bottom.label} team={pair.bottom.team} emptyText="空槽" />
              <small>{pair.next}</small>
            </div>
          ))}
          {waitingSeeds.map((seed) => (
            <div key={`waiting-${seed.position}`} className="seed-preview-node is-waiting-seed">
              <span>半决赛等待 {seed.position}</span>
              <SeedPreviewSlot label={seed.top.label} team={seed.top.team} emptyText="空槽" />
              <div className="seed-preview-slot is-empty"><b>下一槽位</b><span>{seed.bottom}</span></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const seedOrder = getSeedSlotOrder(props.bracketSize);
  const winnerTeams = props.isDoubleElimination
    ? props.selectedTeams.slice(0, props.winnerTeamCount)
    : props.selectedTeams;
  const loserTeams = props.isDoubleElimination
    ? props.selectedTeams.slice(props.winnerTeamCount, props.winnerTeamCount + props.loserTeamCount)
    : [];
  const winnerSlots = seedOrder.map((seed) => ({ label: `Seed ${seed}`, team: winnerTeams[seed - 1] ?? null }));
  const getWinnerSlot = (index: number) => winnerSlots[index] ?? { label: `Seed ${index + 1}`, team: null };
  const winnerPairs = Array.from({ length: props.bracketSize / 2 }, (_, index) => ({
    position: index + 1,
    top: getWinnerSlot(index * 2),
    bottom: getWinnerSlot(index * 2 + 1),
  }));
  const loserPairs = Array.from({ length: Math.ceil(loserTeams.length / 2) }, (_, index) => ({
    position: index + 1,
    top: { label: `败者组 ${index * 2 + 1}`, team: loserTeams[index * 2] ?? null },
    bottom: { label: `败者组 ${index * 2 + 2}`, team: loserTeams[index * 2 + 1] ?? null },
  }));

  return (
    <section className="frame-builder-preview">
      <div className="frame-builder-preview-head">
        <div>
          <strong>{props.isDoubleElimination ? "胜者组首轮槽位预览" : "首轮槽位预览"}</strong>
          <small>{props.isDoubleElimination ? "前面的入围队伍按种子槽进入胜者组；后面的队伍进入败者组首轮。" : "这里使用和后端生成对阵图相同的种子槽位规则。"}</small>
        </div>
        <span>{props.bracketSize} 队对阵图</span>
      </div>
      <div className="seed-preview-grid">
        {winnerPairs.map((pair) => (
          <div key={pair.position} className="seed-preview-node">
            <span>对阵 {pair.position}</span>
            <SeedPreviewSlot label={pair.top.label} team={pair.top.team} emptyText="空槽" />
            <SeedPreviewSlot label={pair.bottom.label} team={pair.bottom.team} emptyText="空槽" />
          </div>
        ))}
      </div>
      {props.isDoubleElimination ? (
        <div className="seed-preview-loser">
          <div className="seed-preview-loser-head">
            <strong>败者组起始位</strong>
            <small>{loserTeams.length > 0 ? "这些队伍一开始就在败者组，输掉后直接淘汰。" : "当前没有设置败者组起始队伍。"}</small>
          </div>
          {loserPairs.length > 0 ? (
            <div className="seed-preview-grid loser-grid">
              {loserPairs.map((pair) => (
                <div key={pair.position} className="seed-preview-node">
                  <span>败者组对阵 {pair.position}</span>
                  <SeedPreviewSlot label={pair.top.label} team={pair.top.team} emptyText="空位" />
                  <SeedPreviewSlot label={pair.bottom.label} team={pair.bottom.team} emptyText="空位" />
                </div>
              ))}
            </div>
          ) : <div className="seed-preview-empty-note">没有败者组起始对阵。</div>}
        </div>
      ) : null}
    </section>
  );
}

function SeedPreviewSlot(props: { label: string; team: TeamBrief | null; emptyText: string }) {
  return (
    <div className={props.team ? "seed-preview-slot" : "seed-preview-slot is-empty"}>
      <b>{props.label}</b>
      <span>{props.team ? <><i style={{ background: props.team.color }} />{props.team.name}</> : props.emptyText}</span>
    </div>
  );
}

function ScheduleControlPanel(props: {
  data: AdminData;
  selectedStage: StageSummary | null;
  officialStages: StageSummary[];
  allSeries: SeriesSummary[];
  focusActive?: boolean;
  rosterIds: string[];
  seededIds: string[];
  setRosterIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSeededIds: React.Dispatch<React.SetStateAction<string[]>>;
  lockRoster: (teamIds: string[], seededTeamIds: string[]) => Promise<void>;
  unlockRoster: () => Promise<void>;
  updateScheduleConfig: (preliminaryType: "group" | "swiss", knockoutType: CompetitionMode) => Promise<void>;
  publishSchedule: () => Promise<void>;
  withdrawSchedule: () => Promise<void>;
  clearScheduleRecords: () => Promise<void>;
  createManualSeries: CreateManualSeriesHandler;
  compactMode?: boolean;
  compactOpen?: boolean;
  setCompactOpen?: (open: boolean) => void;
}) {
  const [preliminaryType, setPreliminaryType] = useState<"group" | "swiss">("group");
  const [knockoutType, setKnockoutType] = useState<CompetitionMode>("single_elimination");
  useEffect(() => {
    setPreliminaryType(props.data.schedule?.preliminaryType === "swiss" ? "swiss" : "group");
    setKnockoutType(props.data.schedule?.knockoutType === "double_elimination" ? "double_elimination" : "single_elimination");
  }, [props.data.schedule]);
  const readiness = getScheduleReadiness(props.data.schedule, props.officialStages, props.selectedStage, props.allSeries);
  const isPublished = props.data.schedule?.status === "published";
  const statusTone = readiness.publishedButIncomplete ? "warn" : toneForStatus(props.data.schedule?.status);
  const statusLabel = readiness.publishedButIncomplete ? "已发布 · 缺阶段" : scheduleStatusLabel(props.data.schedule?.status);
  const missingPieces = missingSchedulePieces(props.data.schedule, readiness);
  const unlockRosterLabel = props.officialStages.length > 0 ? `解锁并清空 ${props.officialStages.length} 个官方阶段` : "解锁名单";
  const unlockRosterHint = props.officialStages.length > 0 ? "解锁名单会清空当前官方阶段草稿。" : "当前没有官方阶段草稿，解锁只会恢复名单编辑。";
  const publishChecklistItems = [
    { ok: Boolean(props.data.schedule?.rosterLocked), text: props.data.schedule?.rosterLocked ? "参赛名单已锁定" : "锁定参赛名单" },
    { ok: Boolean(props.data.schedule?.preliminaryType), text: props.data.schedule?.preliminaryType ? "预赛赛制已选择" : "选择预赛赛制" },
    { ok: Boolean(props.data.schedule?.knockoutType), text: props.data.schedule?.knockoutType ? "淘汰赛赛制已选择" : "选择淘汰赛赛制" },
    { ok: readiness.hasPreliminaryStage, text: readiness.hasPreliminaryStage ? "预赛阶段已创建" : "创建预赛阶段" },
    { ok: readiness.hasPreliminarySeries, text: readiness.hasPreliminarySeries ? "预赛对阵已创建" : "创建预赛对阵" },
    { ok: true, text: readiness.hasKnockoutStage ? "淘汰赛阶段已创建" : "淘汰赛可在预赛后生成" },
  ];
  const publishMissingCount = publishChecklistItems.filter((item) => !item.ok).length;
  const publishHint = readiness.readyToPublish ? "发布检查通过，可以发布到 H5。" : `发布前还差：${missingPieces.join("、")}。`;
  const publishSummaryStatus = readiness.readyToPublish ? "可发布" : `差 ${publishMissingCount} 项`;
  const publishSummaryTitle = readiness.readyToPublish ? "可以发布到 H5" : "暂不能发布";
  const publishSummaryTone = readiness.readyToPublish ? "good" : "warn";
  const selectedConfigChanged = preliminaryType !== (props.data.schedule?.preliminaryType ?? "") || knockoutType !== (props.data.schedule?.knockoutType ?? "");
  const preliminaryConfigChanged = preliminaryType !== (props.data.schedule?.preliminaryType ?? "");
  const knockoutConfigChanged = knockoutType !== (props.data.schedule?.knockoutType ?? "");
  const savedConfigLabel = `${labelPreliminary(props.data.schedule?.preliminaryType)} + ${labelKnockout(props.data.schedule?.knockoutType)}`;
  const draftConfigLabel = `${labelPreliminary(preliminaryType)} + ${labelKnockout(knockoutType)}`;
  const preliminaryStage = props.officialStages.find(isPreliminaryStage);
  const knockoutStage = props.officialStages.find(isKnockoutStage);
  const preliminaryStageName = preliminaryStage?.name ?? "未创建";
  const knockoutStageName = knockoutStage?.name ?? "可稍后生成";
  const h5Visibility = getScheduleVisibilityStatus(props.data.schedule, readiness);
  const h5DraftText = readiness.readyToPublish ? "发布后 H5 显示预赛赛程" : "H5 仍显示赛程暂未发布";
  const configChangeBlocker = preliminaryConfigChanged && preliminaryStage
    ? `预赛阶段“${preliminaryStage.name}”已创建，不能直接改成另一种预赛。请先重置官方赛程，再重新选择赛制。`
    : knockoutConfigChanged && knockoutStage
      ? `淘汰赛阶段“${knockoutStage.name}”已创建，不能直接切换单败 / 双败。请先重置官方赛程，再重新生成。`
      : "";
  const formatStripClass = ["format-save-strip", configChangeBlocker ? "is-blocked" : selectedConfigChanged ? "is-dirty" : "is-synced"].join(" ");
  const formatSyncText = configChangeBlocker
    || (selectedConfigChanged
      ? `下方创建入口暂时仍使用已保存方案：${savedConfigLabel}。保存后才会切换为：${draftConfigLabel}。`
      : `已同步。下方创建预赛草稿会使用：${savedConfigLabel}。`);
  const canSaveConfig = selectedConfigChanged && !isPublished && !configChangeBlocker;
  const formatConfigSaved = Boolean(props.data.schedule?.preliminaryType && props.data.schedule?.knockoutType);
  const shouldExpandFormatEditor = !formatConfigSaved || selectedConfigChanged || Boolean(configChangeBlocker);
  const formatSummaryStatus = configChangeBlocker ? "需重建阶段" : selectedConfigChanged ? "有未保存修改" : formatConfigSaved ? "已保存" : "待选择";
  const formatSummaryTone = configChangeBlocker ? "warn" : selectedConfigChanged ? "warn" : formatConfigSaved ? "good" : "warn";
  const formatCommandTitle = configChangeBlocker
    ? "赛制需要重建阶段"
    : selectedConfigChanged
      ? "赛制还没保存"
      : formatConfigSaved
        ? "赛制已保存"
        : "先选本届赛制";
  const formatCommandHint = selectedConfigChanged
    ? `${savedConfigLabel} -> ${draftConfigLabel}`
    : formatConfigSaved
      ? savedConfigLabel
      : draftConfigLabel;
  const formatPresets: Array<{ label: string; text: string; icon: React.ReactNode; preliminaryType: "group" | "swiss"; knockoutType: CompetitionMode }> = [
    { label: "小组 + 单败", text: "常用", icon: <Dices size={14} />, preliminaryType: "group", knockoutType: "single_elimination" },
    { label: "瑞士轮 + 单败", text: "队伍多", icon: <CircleDot size={14} />, preliminaryType: "swiss", knockoutType: "single_elimination" },
    { label: "小组 + 双败", text: "更耐打", icon: <GitBranch size={14} />, preliminaryType: "group", knockoutType: "double_elimination" },
  ];
  const lockedRosterTeams = props.data.schedule?.teams ?? [];
  const hasScheduleSetup = props.officialStages.length > 0
    || lockedRosterTeams.length > 0
    || Boolean(props.data.schedule?.preliminaryType || props.data.schedule?.knockoutType)
    || Boolean(props.data.schedule && props.data.schedule.status !== "unconfigured");
  const seededRosterCount = lockedRosterTeams.filter((item) => item.isSeeded).length;
  const rosterPreviewTeams = lockedRosterTeams.slice(0, 4);
  const rosterExtraCount = Math.max(lockedRosterTeams.length - rosterPreviewTeams.length, 0);
  const compactIsStageMode = props.officialStages.length > 0;
  const compactOnlyNeedsSeries = compactIsStageMode
    && Boolean(props.data.schedule?.rosterLocked)
    && formatConfigSaved
    && readiness.hasPreliminaryStage
    && !readiness.hasPreliminarySeries;
  const compactStatusTone = readiness.readyToPublish ? "good" : compactOnlyNeedsSeries ? "info" : publishMissingCount > 0 ? "warn" : "info";
  const compactStatusText = readiness.readyToPublish ? "可发布" : publishMissingCount > 0 ? `差 ${publishMissingCount} 项` : "草稿";
  const compactSummaryCopy = compactIsStageMode
    ? "当前主任务在上方阶段画布；需要修正名单、赛制或发布检查时再展开。"
    : "当前主任务在上方创建预赛草稿；需要修正名单、赛制或发布检查时再展开。";
  const compactCommandTitle = readiness.readyToPublish
    ? "发布检查通过"
    : compactOnlyNeedsSeries
      ? "基础设置已保存"
    : !props.data.schedule?.rosterLocked
      ? "先锁定参赛名单"
      : !formatConfigSaved
        ? "先保存本届赛制"
        : !readiness.hasPreliminaryStage
          ? "先创建预赛草稿"
          : !readiness.hasPreliminarySeries
            ? "先创建预赛对阵"
            : publishSummaryTitle;
  const compactCommandText = readiness.readyToPublish
    ? "可以直接发布到 H5；展开后仍可查看完整检查项。"
    : compactOnlyNeedsSeries
      ? "当前只差上方阶段排赛；不用展开基础设置。"
    : missingPieces.length > 0
      ? `还差：${missingPieces.join("、")}`
      : compactSummaryCopy;
  const compactStageTaskText = compactOnlyNeedsSeries ? "只差上方阶段排赛" : compactCommandText;
  const compactContextLabel = compactIsStageMode ? "基础设置" : "创建前设置";
  const compactCommandHint = compactIsStageMode ? `${h5Visibility.label}：${h5Visibility.detail}；${compactStageTaskText}` : compactCommandText;
  const compactCommandDisplayTitle = compactIsStageMode ? `${compactCommandTitle} · ${h5Visibility.label}` : compactCommandTitle;
  const toggleCompactControl = () => props.setCompactOpen?.(!props.compactOpen);

  if (isPublished) {
    return (
      <section id="schedule-control-panel" tabIndex={-1} className={props.focusActive ? "control-panel control-panel-locked is-attention" : "control-panel control-panel-locked"}>
        <div className="section-title"><div><h2>官方赛程控制台</h2><p>已发布后结构会锁定，防止 H5 正在展示的赛程被误改。</p></div><div className="status-row"><StatusPill tone={statusTone}>{statusLabel}</StatusPill><StatusPill tone={props.data.schedule?.rosterLocked ? "good" : "warn"}>{props.data.schedule?.rosterLocked ? "名单已锁定" : "名单未锁定"}</StatusPill></div></div>
        <div className="locked-control-grid">
          <div className="locked-control-main">
            <div className="block-head"><ShieldCheck size={16} /><strong>{readiness.publishedButIncomplete ? "发布状态需要修复" : "官方赛程已发布"}</strong></div>
            <p>{readiness.publishedButIncomplete ? `当前发布状态缺少：${missingPieces.join("、")}。主工作面已经给出唯一的修复入口。` : "H5 正在展示当前官方赛程。如需调整赛制、名单、分组或对阵图，先撤回发布。"}</p>
            {readiness.publishedButIncomplete ? <div className="locked-control-note">请在中间工作面的主按钮执行撤回，撤回后会自动恢复阶段创建和拖拽编排工具。</div> : <div className="locked-control-actions"><button className="ghost-danger" type="button" onClick={() => void props.withdrawSchedule()}><RotateCcw size={15} /> 撤回发布</button><button className="ghost-danger" type="button" onClick={() => void props.clearScheduleRecords()}><Trash2 size={15} /> 重置官方赛程</button></div>}
          </div>
          <div className="locked-control-meta">
            <div><span>参赛名单</span><strong>{props.data.schedule?.teams.length ?? 0} 支队伍</strong></div>
            <div><span>赛制</span><strong>{labelPreliminary(props.data.schedule?.preliminaryType)} + {labelKnockout(props.data.schedule?.knockoutType)}</strong></div>
            <div><span>官方阶段</span><strong>{props.officialStages.length} 个</strong></div>
          </div>
        </div>
      </section>
    );
  }

  const controlInner = (
    <>
      <div className="section-title"><div><h2>官方赛程控制台</h2><p>先锁名单，再保存赛制；发布前都是草稿，只影响 H5 的赛程页。</p></div><div className="status-row"><StatusPill tone={statusTone}>{statusLabel}</StatusPill><StatusPill tone={props.data.schedule?.rosterLocked ? "good" : "warn"}>{props.data.schedule?.rosterLocked ? "名单已锁定" : "名单未锁定"}</StatusPill></div></div>
      <div className="control-grid">
        <div className="control-block roster-block">
          <div className="block-head"><Lock size={16} /><strong>参赛名单</strong></div>
          {props.data.schedule?.rosterLocked ? (
            <div className="locked-roster-summary">
              <div className="locked-roster-overview">
                <div className="locked-roster-count">
                  <span>已锁名单</span>
                  <strong>{lockedRosterTeams.length} 支队伍</strong>
                  <small>{seededRosterCount > 0 ? `${seededRosterCount} 支种子队` : "未设置种子队"}</small>
                </div>
                <button className="ghost-danger" type="button" onClick={() => void props.unlockRoster()} disabled={isPublished}><Unlock size={15} /> {unlockRosterLabel}</button>
              </div>
              <div className="locked-roster-preview" aria-label="已锁参赛队预览">
                {rosterPreviewTeams.map((item) => <span key={item.team.id} className="roster-pill compact">{item.team.name}<small>{item.isSeeded ? "种子" : `Seed ${item.seed ?? "-"}`}</small></span>)}
                {rosterExtraCount > 0 ? <span className="roster-pill compact is-more">+{rosterExtraCount} 支</span> : null}
              </div>
              <details className="locked-roster-details">
                <summary>查看参赛队明细</summary>
                <div className="locked-roster-grid">{lockedRosterTeams.map((item) => <span key={item.team.id} className="roster-pill">{item.team.name}<small>{item.isSeeded ? "种子" : `Seed ${item.seed ?? "-"}`}</small></span>)}</div>
              </details>
              <p className="muted">{isPublished ? "已发布状态下如需重改名单，请先撤回发布。" : unlockRosterHint}</p>
            </div>
          ) : <RosterBuilder teams={props.data.teams} rosterIds={props.rosterIds} seededIds={props.seededIds} setRosterIds={props.setRosterIds} setSeededIds={props.setSeededIds} lockRoster={() => void props.lockRoster(props.rosterIds, props.seededIds)} />}
        </div>
        <div className="control-block">
          <div className="block-head"><GitBranch size={16} /><strong>赛制选择</strong></div>
          <div className="format-editor-shell">
            <div className="format-summary-strip">
              <div className="format-summary-main">
                <span>已保存赛制</span>
                <strong>{formatConfigSaved ? savedConfigLabel : "未选择"}</strong>
                <small>{selectedConfigChanged ? `正在选择：${draftConfigLabel}` : "创建入口会使用这里保存的方案。"}</small>
              </div>
              <StatusPill tone={formatSummaryTone}>{formatSummaryStatus}</StatusPill>
            </div>
            <div className="format-command-strip">
              <div className={`format-command-status is-${formatSummaryTone}`}>
                <span><GitBranch size={15} /></span>
                <div>
                  <strong>{formatCommandTitle}</strong>
                  <small>{formatCommandHint}</small>
                </div>
              </div>
              <div className="format-command-presets" aria-label="常用赛制模板">
                {formatPresets.map((preset) => {
                  const active = preliminaryType === preset.preliminaryType && knockoutType === preset.knockoutType;
                  return (
                    <button key={preset.label} type="button" className={active ? "is-active" : ""} onClick={() => {
                      setPreliminaryType(preset.preliminaryType);
                      setKnockoutType(preset.knockoutType);
                    }} disabled={isPublished || Boolean(configChangeBlocker)}>
                      <span>{preset.icon}</span>
                      <strong>{preset.label}</strong>
                      <small>{preset.text}</small>
                    </button>
                  );
                })}
              </div>
              <button className={canSaveConfig ? "primary-button" : "secondary-button"} type="button" onClick={() => void props.updateScheduleConfig(preliminaryType, knockoutType)} disabled={!canSaveConfig}><Check size={15} /> {selectedConfigChanged ? "保存赛制" : "已保存"}</button>
            </div>
            <details className="format-editor-details" open={shouldExpandFormatEditor}>
              <summary>{formatConfigSaved ? "精确调整赛制" : "展开精确选择"}</summary>
              <div className="format-picker">
                <FormatChoiceGroup
                  title="预赛"
                  value={preliminaryType}
                  options={[
                    { value: "group", label: "小组赛", description: "拖拽分组，默认 BO2 单循环，按积分排名。", icon: <Dices size={15} /> },
                    { value: "swiss", label: "瑞士轮", description: "设置轮数，进入画布后先手动拖两队；自动配对只是辅助。", icon: <CircleDot size={15} /> },
                  ]}
                  onChange={setPreliminaryType}
                />
                <FormatChoiceGroup
                  title="淘汰赛"
                  value={knockoutType}
                  options={[
                    { value: "single_elimination", label: "单败", description: "适合小组前几名晋级，支持空槽等待下一轮。", icon: <Brackets size={15} /> },
                    { value: "double_elimination", label: "双败", description: "可设置胜者组和初始败者组队伍数量。", icon: <GitBranch size={15} /> },
                  ]}
                  onChange={setKnockoutType}
                />
              </div>
              <div className={formatStripClass}>
                <div className="format-save-main">
                  <div className="format-save-pair">
                    <div><span>已保存</span><strong>{savedConfigLabel}</strong></div>
                    <ArrowRight size={14} />
                    <div><span>{selectedConfigChanged ? "正在选择" : "当前选择"}</span><strong>{draftConfigLabel}</strong></div>
                  </div>
                  <p>{formatSyncText}</p>
                </div>
              </div>
            </details>
          </div>
          {isPublished ? <p className="muted">赛制已经发布，结构调整需要先撤回。</p> : null}
        </div>
        <div className="control-block publish-block">
          <div className="block-head"><Trophy size={16} /><strong>发布检查</strong></div>
          <div className={readiness.readyToPublish ? "publish-command-strip is-ready" : "publish-command-strip"}>
            <div className={`publish-command-status is-${publishSummaryTone}`}>
              <span>{readiness.readyToPublish ? <Play size={15} /> : <MousePointer2 size={15} />}</span>
              <div>
                <strong>{publishSummaryTitle}</strong>
                <small>{publishHint}</small>
              </div>
              <StatusPill tone={publishSummaryTone}>{publishSummaryStatus}</StatusPill>
            </div>
            <div className="publish-command-impact" aria-label="H5 发布影响摘要">
              <div><span>H5 当前</span><strong>{h5DraftText}</strong></div>
              <div><span>预赛</span><strong>{preliminaryStageName}</strong></div>
              <div><span>淘汰赛</span><strong>{knockoutStageName}</strong></div>
            </div>
            <div className="publish-command-actions">
              <button className="primary-button" type="button" onClick={() => void props.publishSchedule()} disabled={!readiness.readyToPublish}><Play size={15} /> 发布到 H5</button>
              {hasScheduleSetup ? <button className="ghost-danger" type="button" onClick={() => void props.clearScheduleRecords()}><Trash2 size={15} /> 重置官方赛程</button> : null}
            </div>
          </div>
          <details className="publish-details">
            <summary>查看发布检查和 H5 影响</summary>
            <Checklist items={publishChecklistItems} />
            <div className="publish-impact-grid">
              <div><span>H5 当前</span><strong>{h5DraftText}</strong></div>
              <div><span>预赛</span><strong>{preliminaryStageName}</strong></div>
              <div><span>淘汰赛</span><strong>{knockoutStageName}</strong></div>
            </div>
            <p className="muted">发布前只保存在后台草稿，H5 赛程页仍显示暂未发布。</p>
          </details>
        </div>
      </div>
    </>
  );

  if (props.compactMode) {
    const quickbarClass = ["setup-context-quickbar", `is-${compactStatusTone}`, compactIsStageMode ? "is-stage-mode" : "is-setup-mode"].join(" ");
    return (
      <section id="schedule-control-panel" tabIndex={-1} className={props.focusActive ? "control-panel setup-context-drawer is-attention" : "control-panel setup-context-drawer"}>
        <div className={quickbarClass}>
          <div className="setup-context-command">
            <span>{compactContextLabel}</span>
            <strong>{compactCommandDisplayTitle}</strong>
            <small>{compactCommandHint}</small>
          </div>
          {!compactIsStageMode ? <div className="setup-context-quick-metrics" aria-label="官方赛程基础状态">
            <div><span>名单</span><strong>{props.data.schedule?.rosterLocked ? `${lockedRosterTeams.length} 队` : "未锁"}</strong></div>
            <div><span>赛制</span><strong>{formatConfigSaved ? savedConfigLabel : "未选"}</strong></div>
            <div><span>发布</span><strong>{compactStatusText}</strong></div>
          </div> : null}
          <div className="setup-context-quick-actions">
            <button type="button" className="secondary-button" onClick={toggleCompactControl}>{props.compactOpen ? "收起设置" : "展开设置"}</button>
            {readiness.readyToPublish ? <button type="button" className="primary-button" onClick={() => void props.publishSchedule()}><Play size={15} /> 发布到 H5</button> : null}
          </div>
        </div>
        {props.compactOpen ? (
          <details open onToggle={(event) => props.setCompactOpen?.(event.currentTarget.open)}>
            <summary>
              <div className="setup-context-summary">
                <span>{compactIsStageMode ? "基础设置与发布" : "基础设置"}</span>
                <strong>{lockedRosterTeams.length} 支参赛队 · {savedConfigLabel}</strong>
                <small>{compactSummaryCopy}</small>
              </div>
              <StatusPill tone={compactStatusTone}>{compactStatusText}</StatusPill>
            </summary>
            <div className="setup-context-body">{controlInner}</div>
          </details>
        ) : null}
      </section>
    );
  }

  return (
    <section id="schedule-control-panel" tabIndex={-1} className={props.focusActive ? "control-panel is-attention" : "control-panel"}>
      {controlInner}
    </section>
  );
}

function FormatChoiceGroup<T extends string>(props: {
  title: string;
  value: T;
  options: Array<{ value: T; label: string; description: string; icon: React.ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <section className="format-choice-group">
      <div className="format-choice-title">{props.title}</div>
      <div className="format-choice-options">
        {props.options.map((option) => (
          <button key={option.value} type="button" className={props.value === option.value ? "format-choice is-active" : "format-choice"} onClick={() => props.onChange(option.value)}>
            <span>{option.icon}</span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function FormatPresetStrip(props: {
  preliminaryType: "group" | "swiss";
  knockoutType: CompetitionMode;
  onApply: (preset: { preliminaryType: "group" | "swiss"; knockoutType: CompetitionMode }) => void;
  disabled: boolean;
}) {
  const presets: Array<{ label: string; text: string; icon: React.ReactNode; preliminaryType: "group" | "swiss"; knockoutType: CompetitionMode }> = [
    { label: "小组 + 单败", text: "社区赛常用", icon: <Dices size={14} />, preliminaryType: "group", knockoutType: "single_elimination" },
    { label: "瑞士轮 + 单败", text: "队伍多时使用", icon: <CircleDot size={14} />, preliminaryType: "swiss", knockoutType: "single_elimination" },
    { label: "小组 + 双败", text: "淘汰赛更耐打", icon: <GitBranch size={14} />, preliminaryType: "group", knockoutType: "double_elimination" },
  ];
  return (
    <section className="format-preset-strip" aria-label="常用赛制模板">
      <div><strong>常用模板</strong><small>先选一个，再在下方微调。</small></div>
      <div className="format-preset-list">
        {presets.map((preset) => {
          const active = props.preliminaryType === preset.preliminaryType && props.knockoutType === preset.knockoutType;
          return (
            <button key={preset.label} type="button" className={active ? "format-preset is-active" : "format-preset"} onClick={() => props.onApply(preset)} disabled={props.disabled}>
              <span>{preset.icon}</span>
              <strong>{preset.label}</strong>
              <small>{preset.text}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RosterBuilder(props: {
  teams: TournamentTeamListItem[];
  rosterIds: string[];
  seededIds: string[];
  setRosterIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSeededIds: React.Dispatch<React.SetStateAction<string[]>>;
  lockRoster: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (team: TournamentTeamListItem) => {
    if (!normalizedQuery) return true;
    return [team.name, team.shortName, String(team.seed ?? ""), team.status].some((value) => value.toLowerCase().includes(normalizedQuery));
  };
  const poolTeams = props.teams.filter((team) => !props.rosterIds.includes(team.id) && matchesQuery(team));
  const rosterTeams = orderTeamsByIds(props.teams, props.rosterIds);
  const seedTeams = orderTeamsByIds(props.teams, props.seededIds.filter((id) => props.rosterIds.includes(id)));
  const addFilteredTeams = () => props.setRosterIds((current) => {
    const next = new Set(current);
    poolTeams.forEach((team) => next.add(team.id));
    return Array.from(next);
  });
  const hasTournamentTeams = props.teams.length > 0;
  const readyToLock = rosterTeams.length >= 2;
  const rosterTone = readyToLock ? "good" : "warn";
  const rosterTitle = !hasTournamentTeams ? "当前届次暂无队伍" : readyToLock ? "名单可以锁定" : "先拖入参赛队伍";
  const rosterHint = !hasTournamentTeams
    ? "先同步 OpenDota，或在战队与选手里提前创建队伍。"
    : readyToLock
      ? `${rosterTeams.length} 支参赛队 · ${seedTeams.length} 支种子队`
      : `至少需要 2 支队伍，当前 ${rosterTeams.length}/${props.teams.length}`;
  const poolHint = !hasTournamentTeams
    ? "等待队伍数据后再锁定名单"
    : normalizedQuery
      ? "只显示筛选结果；拖回这里可移出名单"
      : "拖回这里可移出名单";
  const poolEmptyText = !hasTournamentTeams
    ? "当前届次暂无队伍；先同步 OpenDota 或创建队伍"
    : normalizedQuery
      ? "没有符合搜索的未选队伍"
      : "所有队伍都已加入名单";

  return (
    <div className="roster-builder">
      <div className="roster-command-strip">
        <div className={`roster-command-status is-${rosterTone}`}>
          <span><Users size={15} /></span>
          <div>
            <strong>{rosterTitle}</strong>
            <small>{rosterHint}</small>
          </div>
        </div>
        <label className="roster-search is-command">
          <Search size={14} />
          <span>查找</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="队名、缩写、种子或状态" />
          {normalizedQuery ? <button type="button" onClick={() => setQuery("")}>清空</button> : null}
        </label>
        <div className="roster-command-actions">
          <div><span>可拖入</span><strong>{poolTeams.length}</strong></div>
          <button type="button" onClick={addFilteredTeams} disabled={poolTeams.length === 0}>{normalizedQuery ? "加入筛选" : "全部加入"}</button>
          <button type="button" onClick={() => { props.setRosterIds([]); props.setSeededIds([]); }} disabled={rosterTeams.length === 0}>清空</button>
          <button className="primary-button" type="button" onClick={props.lockRoster} disabled={!readyToLock}><Lock size={15} /> 锁定</button>
        </div>
      </div>
      <RosterDropZone target="pool" title="当前届次队伍" hint={poolHint} teams={poolTeams} emptyText={poolEmptyText} />
      <RosterDropZone target="entrant" title="参赛名单" hint="拖队伍到这里" teams={rosterTeams} emptyText="拖队伍到这里" />
      <RosterDropZone target="seeded" title="种子队（可选）" hint="拖到这里会自动加入名单" teams={seedTeams} emptyText="需要种子队时拖到这里" />
    </div>
  );
}

function RosterDropZone(props: { target: RosterDropTarget; title: string; hint: string; teams: TeamBrief[]; emptyText: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: `roster:${props.target}` });
  return <section ref={setNodeRef} className={isOver ? "roster-drop-zone is-over" : "roster-drop-zone"}><div className="roster-zone-head"><strong>{props.title}</strong><small>{props.hint}</small></div><div className="roster-zone-list">{props.teams.length === 0 ? <div className="drop-placeholder compact">{props.emptyText}</div> : null}{props.teams.map((team) => <DraggableTeam key={team.id} team={team} />)}</div></section>;
}

function BracketEntrantBuilder(props: {
  teams: TeamBrief[];
  selectedTeamIds: string[];
  bracketSize: number;
  targetCount: number;
  isDoubleElimination: boolean;
  winnerTeamCount: number;
  loserTeamCount: number;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  rankingRows?: StandingRow[];
  groupAdvancePreset?: GroupAdvancePreset | null;
  onApplyGroupAdvancePreset?: (() => void) | undefined;
}) {
  const [teamFilter, setTeamFilter] = useState("");
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const rankedTeamIds = (props.rankingRows ?? []).map(standingTeamId).filter(Boolean);
  const rankedTeams = orderTeamsByIds(props.teams, rankedTeamIds);
  const rankedTeamSet = new Set(rankedTeams.map((team) => team.id));
  const sourceTeams = [...rankedTeams, ...props.teams.filter((team) => !rankedTeamSet.has(team.id))];
  const selectedTeams = orderTeamsByIds(props.teams, props.selectedTeamIds);
  const selectedSet = new Set(props.selectedTeamIds);
  const poolTeams = sourceTeams.filter((team) => !selectedSet.has(team.id));
  const visiblePoolTeams = normalizedTeamFilter ? poolTeams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : poolTeams;
  const rankingLookup = new Map((props.rankingRows ?? []).map((row) => [standingTeamId(row), row]));
  const hasRankingRows = (props.rankingRows ?? []).length > 0;
  const fillPreviewTeams = sourceTeams.slice(0, props.targetCount);
  const fillEntrantsLabel = hasRankingRows ? `按排名填满 ${props.targetCount} 队` : `自动填满 ${props.targetCount} 队`;
  const fillEntrantsTitle = fillPreviewTeams.length > 0
    ? `${hasRankingRows ? "将按当前排名填入" : "将按当前队伍顺序填入"}：${fillPreviewTeams.map((team) => team.name).join(" / ")}`
    : "当前没有可填入队伍";
  const fillPreviewLabel = hasRankingRows ? "排名填满预览" : "自动填满预览";
  const fillPreviewText = fillPreviewTeams.map((team) => team.name).join(" / ");
  const fillPreviewIds = fillPreviewTeams.map((team) => team.id);
  const hasGroupAdvancePreset = Boolean(props.groupAdvancePreset);
  const canApplyGroupAdvancePreset = Boolean(props.groupAdvancePreset && props.onApplyGroupAdvancePreset);
  const showGenericFillHelper = !hasGroupAdvancePreset;
  const entrantCountLabel = hasGroupAdvancePreset && props.groupAdvancePreset && selectedTeams.length === 0
    ? `推荐 ${props.groupAdvancePreset.targetCount} 队入围`
    : `${selectedTeams.length} / ${props.targetCount} 队入围`;
  const seedRoles = buildEntrantSeedRoles({
    bracketSize: props.bracketSize,
    targetCount: props.targetCount,
    isDoubleElimination: props.isDoubleElimination,
    winnerTeamCount: props.winnerTeamCount,
    loserTeamCount: props.loserTeamCount,
  });
  const nextSeedRole = seedRoles[selectedTeams.length] ?? null;
  const entrantProgressPercent = props.targetCount > 0 ? Math.min(100, Math.round((selectedTeams.length / props.targetCount) * 100)) : 0;
  const entrantNextTitle = selectedTeams.length >= props.targetCount
    ? "入围已满，检查排序"
    : nextSeedRole ? `下一槽：${nextSeedRole.badge}` : `下一槽：${selectedTeams.length + 1} 号种子`;
  const entrantNextText = selectedTeams.length >= props.targetCount
    ? "拖动右侧入围队伍即可调整初始种子；确认后回到上方生成对阵图。"
    : nextSeedRole?.detail ?? "从左侧候选池拖入，或直接点击队伍填入下一槽。";
  const fillEntrants = () => props.setStageForm((current) => {
    const willChangeExisting = current.selectedTeamIds.length > 0 && current.selectedTeamIds.join("|") !== fillPreviewIds.join("|");
    if (willChangeExisting && !window.confirm(`确定用${hasRankingRows ? "当前排名" : "当前队伍顺序"}覆盖 ${current.selectedTeamIds.length} 支淘汰赛入围队伍？`)) return current;
    return { ...current, selectedTeamIds: fillPreviewIds };
  });
  const clearEntrants = () => {
    if (selectedTeams.length > 0 && !window.confirm(`确定清空 ${selectedTeams.length} 支淘汰赛入围队伍？`)) return;
    props.setStageForm((current) => ({ ...current, selectedTeamIds: [] }));
  };
  const removeEntrant = (teamId: string) => props.setStageForm((current) => ({
    ...current,
    selectedTeamIds: current.selectedTeamIds.filter((id) => id !== teamId),
  }));
  const pickEntrant = (teamId: string) => props.setStageForm((current) => {
    if (current.selectedTeamIds.includes(teamId) || current.selectedTeamIds.length >= props.targetCount) return current;
    return { ...current, selectedTeamIds: [...current.selectedTeamIds, teamId] };
  });
  const canPickMore = selectedTeams.length < props.targetCount;
  return (
    <section className="entrant-builder">
      <div className="entrant-builder-head">
        <span>{entrantCountLabel}</span>
        <div className="micro-actions">
          {showGenericFillHelper ? <button type="button" onClick={fillEntrants} title={fillEntrantsTitle} disabled={sourceTeams.length === 0}>{fillEntrantsLabel}</button> : null}
          <button className="entrant-clear-button" type="button" onClick={clearEntrants} disabled={selectedTeams.length === 0} title={selectedTeams.length > 0 ? `清空 ${selectedTeams.length} 支入围队伍` : "当前没有入围队伍"}>清空入围</button>
        </div>
      </div>
      <div className={selectedTeams.length >= props.targetCount ? "entrant-progress-command is-complete" : "entrant-progress-command"}>
        <div>
          <strong>{entrantNextTitle}</strong>
          <small>{entrantNextText}</small>
        </div>
        <i><b style={{ width: `${entrantProgressPercent}%` }} /></i>
        <span>{selectedTeams.length}/{props.targetCount}</span>
      </div>
      {showGenericFillHelper && fillPreviewTeams.length > 0 ? <div className="entrant-fill-preview" title={fillEntrantsTitle}><span>{fillPreviewLabel}</span><strong>{fillPreviewText}</strong></div> : null}
      {canApplyGroupAdvancePreset && props.groupAdvancePreset && props.onApplyGroupAdvancePreset ? (
        <button className="entrant-preset-strip" type="button" onClick={props.onApplyGroupAdvancePreset} title={`应用推荐入围：${props.groupAdvancePreset.text}`} aria-label={`应用推荐入围：${props.groupAdvancePreset.label}`}>
          <ShieldCheck size={15} />
          <span><strong>{props.groupAdvancePreset.label}</strong><small>{props.groupAdvancePreset.text}</small></span>
          <ArrowRight size={15} />
        </button>
      ) : null}
      <div className="group-filter-bar entrant-filter-bar">
        <label><Search size={14} /><span>查找队伍</span><input value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} placeholder="输入队名或缩写" disabled={props.teams.length === 0} /></label>
        <strong>{normalizedTeamFilter ? `可拖 ${visiblePoolTeams.length}/${poolTeams.length} 支` : `${poolTeams.length} 支可拖`}</strong>
        {normalizedTeamFilter ? <button type="button" onClick={() => setTeamFilter("")}>清除</button> : null}
      </div>
      <BracketEntrantDropZone target="entrant" title="淘汰赛入围槽位" hint="拖动调整种子；点 × 可移出单支队伍" teams={selectedTeams} emptyText="从候选池拖入晋级队伍" sortable seedRoles={seedRoles} onRemoveTeam={removeEntrant} />
      <BracketEntrantDropZone
        target="pool"
        title={hasRankingRows ? "预赛排名候选" : "可选队伍"}
        hint={hasRankingRows ? "从这里拖入入围槽；也可点按排名填满" : "从这里拖入入围槽；拖回这里移出淘汰赛"}
        teams={visiblePoolTeams}
        emptyText={normalizedTeamFilter ? "候选池无匹配队伍" : hasRankingRows ? "排名内队伍都已加入入围区" : "没有剩余可选队伍"}
        rankingLookup={rankingLookup}
        onPickTeam={canPickMore ? pickEntrant : undefined}
      />
    </section>
  );
}

function BracketEntrantDropZone(props: { target: BracketEntrantDropTarget; title: string; hint: string; teams: TeamBrief[]; emptyText: string; sortable?: boolean; rankingLookup?: Map<string, StandingRow>; onPickTeam?: ((teamId: string) => void) | undefined; onRemoveTeam?: ((teamId: string) => void) | undefined; seedRoles?: EntrantSeedRole[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: `bracket-entrant:${props.target}` });
  const zoneId = props.target === "pool" ? "bracket-entrant-pool" : "bracket-entrant-selected";
  const remainingSeedRoles = props.sortable ? props.seedRoles?.slice(props.teams.length) ?? [] : [];
  const content = props.sortable ? (
    <>
      <SortableContext items={props.teams.map((team) => `entrant-order:${team.id}`)} strategy={verticalListSortingStrategy}>
        {props.teams.map((team, index) => {
          const seedRole = props.seedRoles?.[index];
          return <SortableEntrantTeam key={team.id} team={team} index={index} {...(seedRole ? { seedRole } : {})} onRemove={props.onRemoveTeam} />;
        })}
      </SortableContext>
      {remainingSeedRoles.map((role, index) => <EntrantSeedPlaceholder key={`${role.badge}-${index}`} seedRole={role} index={props.teams.length + index} />)}
    </>
  ) : props.teams.map((team) => <DraggableRankedTeam key={team.id} team={team} row={props.rankingLookup?.get(team.id) ?? null} onClick={props.onPickTeam ? () => props.onPickTeam?.(team.id) : undefined} />);
  const hint = props.onPickTeam ? `${props.hint}；点击队伍可加入` : props.hint;
  const className = ["entrant-drop-zone", props.target === "entrant" ? "is-selected-zone" : "is-pool-zone", isOver ? "is-over" : ""].filter(Boolean).join(" ");
  return <section id={zoneId} ref={setNodeRef} tabIndex={-1} className={className}><div className="roster-zone-head"><strong>{props.title}</strong><small>{hint}</small></div><div className="roster-zone-list">{props.teams.length === 0 && remainingSeedRoles.length === 0 ? <div className="drop-placeholder compact">{props.emptyText}</div> : null}{content}</div></section>;
}

function DraggableRankedTeam({ team, row, onClick, recommended = false, recommendedLabel = "推荐", actionLabel = "填入", compactAction = false, disabled = false, dragOnlyLabel }: { team: TeamBrief; row: StandingRow | null; onClick?: (() => void) | undefined; recommended?: boolean; recommendedLabel?: string | undefined; actionLabel?: string; compactAction?: boolean; disabled?: boolean; dragOnlyLabel?: string }) {
  const dragData: TeamDragData = { type: "team", teamId: team.id, label: team.name, color: team.color };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `team:${team.id}:rank-source`, data: dragData, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };
  const className = ["team-chip", "ranked-team-chip", onClick ? "is-click-fill" : "", recommended ? "is-recommended" : "", isDragging ? "is-dragging" : ""].filter(Boolean).join(" ");
  const chipLabel = onClick ? `拖拽或点击${actionLabel} ${team.name}${recommended ? `，${recommendedLabel}` : ""}` : dragOnlyLabel ?? team.name;
  return (
    <button ref={setNodeRef} style={style} className={className} type="button" disabled={disabled} onClick={disabled ? undefined : onClick} title={chipLabel} aria-label={chipLabel} {...attributes} {...listeners}>
      <GripVertical className="team-chip-grip" size={13} aria-hidden="true" />{row ? <strong>{row.rank}</strong> : <strong className="rank-placeholder">-</strong>}<span className="team-chip-color" style={{ background: team.color }} /><span className="team-chip-name">{team.name}</span>
      {recommended ? <span className="team-chip-badge">{recommendedLabel}</span> : null}
      {row ? <small>{row.groupName ? `${row.groupName} · ` : ""}{row.seriesWins}-{row.seriesDraws}-{row.seriesLosses} · {row.points} 分</small> : null}
      {onClick ? <TeamChipAction label={actionLabel} iconOnly={compactAction || (recommended && actionLabel === "填入")} /> : null}
    </button>
  );
}

function TeamChipAction({ label = "填入", iconOnly = false }: { label?: string; iconOnly?: boolean }) {
  const directedFillLabel = label === "放左侧" ? "放左" : label === "放右侧" ? "放右" : "";
  const isDirectedFill = Boolean(directedFillLabel) && !iconOnly;
  const isCompactFill = iconOnly || (!isDirectedFill && label === "填入");
  return (
    <span className={isCompactFill ? "team-chip-action is-icon-only" : isDirectedFill ? "team-chip-action is-directed-fill" : "team-chip-action"} title={label} aria-label={label}>
      {isCompactFill ? <Plus size={12} aria-hidden="true" /> : isDirectedFill ? <><Plus size={11} aria-hidden="true" /><span aria-hidden="true">{directedFillLabel}</span></> : label}
    </span>
  );
}

function getNextSlotActionLabel(leftTeam: TeamBrief | null, rightTeam: TeamBrief | null) {
  if (!leftTeam) return "放左侧";
  if (!rightTeam) return "放右侧";
  return "填入";
}

function formatPoolClickHint(actionLabel: string) {
  if (actionLabel === "放左侧") return "拖队伍，或点 + 放入左侧";
  if (actionLabel === "放右侧") return "拖队伍，或点 + 放入右侧";
  return "拖队伍，或点 + 放入空位";
}

function formatPassivePoolHint(countText: string, canDragReplace: boolean) {
  return canDragReplace ? `${countText} · 拖到左/右替换` : countText;
}

function formatDragReplaceTeamLabel(teamName: string) {
  return `拖拽 ${teamName} 到左侧或右侧替换`;
}

function SortableEntrantTeam({ team, index, seedRole, onRemove }: { team: TeamBrief; index: number; seedRole?: EntrantSeedRole; onRemove?: ((teamId: string) => void) | undefined }) {
  const dragData: TeamDragData = { type: "team", teamId: team.id, label: team.name, color: team.color };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `entrant-order:${team.id}`, data: dragData });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "team-chip entrant-sort-chip is-dragging" : "team-chip entrant-sort-chip"} title={`${index + 1} 号种子：${team.name}`} aria-label={`${index + 1} 号种子：${team.name}，拖动可调整排序`} {...attributes} {...listeners}>
      <GripVertical className="team-chip-grip" size={13} aria-hidden="true" /><strong>{index + 1}</strong><span className="team-chip-color" style={{ background: team.color }} /><span className="team-chip-name">{team.name}</span>
      {seedRole ? <small className={`entrant-seed-role is-${seedRole.tone}`} title={seedRole.detail}>{seedRole.badge}</small> : null}
      {onRemove ? (
        <button
          type="button"
          className="entrant-remove-button"
          title={`移出 ${team.name}`}
          aria-label={`移出 ${team.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(team.id);
          }}
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function EntrantSeedPlaceholder({ seedRole, index }: { seedRole: EntrantSeedRole; index: number }) {
  return (
    <div className={`entrant-seed-placeholder is-${seedRole.tone}`}>
      <span>{index + 1}</span>
      <strong>{seedRole.badge}</strong>
      <small>{seedRole.detail}</small>
    </div>
  );
}

function ManualSeriesBuilder(props: { data: AdminData; stage: StageSummary; availableTeams: TeamBrief[]; stageForm: StageFormState; setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>; createManualSeries: CreateManualSeriesHandler; manualSeriesSubmitting: boolean }) {
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const selectedGroupId = props.stage.type === "group" ? props.stageForm.manualGroupId || props.data.groups[0]?.id || "" : "";
  const groupTeams = selectedGroupId ? props.data.groups.find((group) => group.id === selectedGroupId)?.teams ?? [] : [];
  const candidateTeams = props.stage.type === "group" && selectedGroupId ? groupTeams : props.availableTeams;
  const radiantTeam = candidateTeams.find((team) => team.id === props.stageForm.manualRadiantTeamId) ?? props.availableTeams.find((team) => team.id === props.stageForm.manualRadiantTeamId) ?? null;
  const direTeam = candidateTeams.find((team) => team.id === props.stageForm.manualDireTeamId) ?? props.availableTeams.find((team) => team.id === props.stageForm.manualDireTeamId) ?? null;
  const selectedIds = new Set([props.stageForm.manualRadiantTeamId, props.stageForm.manualDireTeamId].filter(Boolean));
  const poolTeams = candidateTeams.filter((team) => !selectedIds.has(team.id));
  const poolPickActionLabel = getNextSlotActionLabel(radiantTeam, direTeam);
  const canPickPoolTeam = !radiantTeam || !direTeam;

  return (
    <section className="tool-panel is-primary-tool manual-series-panel">
      <div className="panel-kicker"><ClipboardCheck size={15} /> 手动添加对阵</div>
      <p className="tool-copy">把队伍拖到左侧和右侧，必要时选择小组或轮次；创建后会进入中间阶段赛程。</p>
      {props.stage.type === "group" ? <label>所属小组<select value={selectedGroupId} onChange={(event) => patch({ manualGroupId: event.target.value, manualRadiantTeamId: "", manualDireTeamId: "" })}>{props.data.groups.length === 0 ? <option value="">未创建小组</option> : props.data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label> : null}
      <label>轮次<select value={props.stageForm.manualRoundId} onChange={(event) => patch({ manualRoundId: event.target.value })}><option value="">新建轮次</option>{props.data.rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
      {!props.stageForm.manualRoundId ? <label>新轮次名称<input value={props.stageForm.manualRoundName} onChange={(event) => patch({ manualRoundName: event.target.value })} /></label> : null}
      <label>计划时间<input type="datetime-local" value={props.stageForm.manualScheduledAt} onChange={(event) => patch({ manualScheduledAt: event.target.value })} /></label>
      {props.stage.type === "group" ? <div className="segmented-grid compact"><button type="button" className={props.stageForm.manualSeriesKind === "regular" ? "is-active" : ""} onClick={() => patch({ manualSeriesKind: "regular" })}>常规赛</button><button type="button" className={props.stageForm.manualSeriesKind === "tiebreaker" ? "is-active" : ""} onClick={() => patch({ manualSeriesKind: "tiebreaker" })}>加赛</button></div> : null}
      <div className="manual-match-dropgrid">
        <ManualSeriesDropZone target="pool" title="队伍池" teams={poolTeams} emptyText={candidateTeams.length === 0 ? "先把队伍加入小组" : "所有候选队伍已在左侧或右侧"} onPickTeam={canPickPoolTeam ? (teamId) => pickManualSeriesTeam(teamId, props.setStageForm) : undefined} actionLabel={poolPickActionLabel} disabled={props.manualSeriesSubmitting} />
        <ManualSeriesSlot target="radiant" title="左侧队伍" team={radiantTeam} suggestedTeam={null} setStageForm={props.setStageForm} disabled={props.manualSeriesSubmitting} />
        <ManualSeriesSlot target="dire" title="右侧队伍" team={direTeam} suggestedTeam={null} setStageForm={props.setStageForm} disabled={props.manualSeriesSubmitting} />
      </div>
      <button type="button" className="primary-button full" onClick={() => void props.createManualSeries()} disabled={props.manualSeriesSubmitting || !props.stageForm.manualRadiantTeamId || !props.stageForm.manualDireTeamId}>{props.manualSeriesSubmitting ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} {props.manualSeriesSubmitting ? "创建中..." : "创建 BO2 对阵"}</button>
    </section>
  );
}

function ManualSeriesDropZone(props: { target: ManualSeriesDropTarget; title: string; teams: TeamBrief[]; emptyText: string; totalCount?: number; onPickTeam?: ((teamId: string, target?: ManualSeriesTeamSlotTarget) => void) | undefined; actionLabel?: string; tools?: React.ReactNode; recommendedTeamIds?: ReadonlySet<string> | undefined; recommendedLabels?: ReadonlyMap<string, string> | undefined; pickTargets?: ReadonlyMap<string, ManualSeriesTeamSlotTarget> | undefined; compactUntargetedActions?: boolean; disabled?: boolean }) {
  const isDisabled = props.disabled === true;
  const { isOver, setNodeRef } = useDroppable({ id: `manual-series:${props.target}`, disabled: isDisabled });
  const countText = props.totalCount !== undefined && props.totalCount !== props.teams.length ? `${props.teams.length}/${props.totalCount} 队` : `${props.teams.length} 队`;
  const actionLabel = props.actionLabel ?? "填入";
  const clickHint = props.pickTargets && props.pickTargets.size > 0 ? "拖队伍，或点 + 放入左/右" : formatPoolClickHint(actionLabel);
  const canDragReplaceFromPool = props.target === "pool" && props.teams.length > 0 && !isDisabled;
  const hint = props.onPickTeam ? `${countText} · ${clickHint}` : formatPassivePoolHint(countText, canDragReplaceFromPool);
  return <section ref={setNodeRef} className={["manual-drop-zone", props.tools ? "has-zone-tools" : "", isDisabled ? "is-locked" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ")}><div className="roster-zone-head"><strong>{props.title}</strong><small>{hint}</small></div>{props.tools ? <div className="manual-zone-tools">{props.tools}</div> : null}<div className="roster-zone-list">{props.teams.length === 0 ? <div className="drop-placeholder compact">{props.emptyText}</div> : null}{props.teams.map((team) => {
    const target = props.pickTargets?.get(team.id);
    const teamActionLabel = target === "radiant" ? "放左侧" : target === "dire" ? "放右侧" : actionLabel;
    return <DraggableTeam key={team.id} team={team} recommended={props.recommendedTeamIds?.has(team.id) ?? false} recommendedLabel={props.recommendedLabels?.get(team.id)} actionLabel={teamActionLabel} compactAction={props.compactUntargetedActions === true && !target} disabled={isDisabled} onClick={!isDisabled && props.onPickTeam ? () => { props.onPickTeam?.(team.id, target); } : undefined} {...(canDragReplaceFromPool ? { dragOnlyLabel: formatDragReplaceTeamLabel(team.name) } : {})} />;
  })}</div></section>;
}

function ManualSeriesSlot(props: { target: "radiant" | "dire"; title: string; team: TeamBrief | null; suggestedTeam: TeamBrief | null; suggestedPairLabel?: string | undefined; setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>; onUseSuggestion?: (() => void) | undefined; disabled?: boolean; slotId?: string }) {
  const isDisabled = props.disabled === true;
  const { isOver, setNodeRef } = useDroppable({ id: `manual-series:${props.target}`, disabled: isDisabled });
  const clear = () => props.setStageForm((current) => ({ ...current, [props.target === "radiant" ? "manualRadiantTeamId" : "manualDireTeamId"]: "" }));
  const className = ["manual-drop-zone", "manual-slot-zone", `is-${props.target}`, props.team ? "is-filled" : "is-empty", isDisabled ? "is-locked" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ");
  const sideName = props.target === "radiant" ? "左侧" : "右侧";
  const stateLabel = props.team ? isDisabled ? "已选" : "已选 · 可替换" : props.suggestedTeam ? `推荐${sideName}` : `${sideName}空位`;
  return <section id={props.slotId} ref={setNodeRef} tabIndex={props.slotId ? -1 : undefined} className={className}><div className="roster-zone-head"><strong>{props.title}</strong><small>{stateLabel}</small></div>{props.team ? <div className="manual-slot-team"><span className="manual-slot-filled-label">已放入{sideName}</span><DraggableTeam team={props.team} disabled={isDisabled} /><button type="button" className="manual-slot-clear" onClick={clear} disabled={isDisabled} aria-label={`清空${sideName}队伍`} title={`清空${sideName}队伍`}><X size={13} aria-hidden="true" /></button></div> : <ManualSlotEmpty target={props.target} poolLabel="队伍池" suggestedTeam={props.suggestedTeam} suggestedPairLabel={props.suggestedPairLabel} onUseSuggestion={isDisabled ? undefined : props.onUseSuggestion} />}</section>;
}

function ManualSlotEmpty({ target, poolLabel, suggestedTeam, suggestedPairLabel, onUseSuggestion }: { target: "radiant" | "dire"; poolLabel: string; suggestedTeam: TeamBrief | null; suggestedPairLabel?: string | undefined; onUseSuggestion?: (() => void) | undefined }) {
  const isLeft = target === "radiant";
  const sideName = isLeft ? "左侧" : "右侧";
  const suggestionTitle = suggestedPairLabel ?? suggestedTeam?.name ?? "";
  const suggestedHint = onUseSuggestion ? `点击放入${sideName}检查位` : "点“填入推荐对阵”进入检查位";
  const content = (
    <>
      {suggestedTeam ? <span className="manual-slot-suggestion-marker" aria-hidden="true">推荐</span> : <span className="manual-slot-side-marker" aria-hidden="true">{isLeft ? "左" : "右"}</span>}
      <strong>{suggestedTeam ? suggestedTeam.name : "拖队伍到这里"}</strong>
      <small>{suggestedTeam ? suggestedHint : `或点${poolLabel}里的 + 放入${sideName}`}</small>
      {suggestedTeam && onUseSuggestion ? <b className="manual-slot-action">放入{sideName}</b> : null}
    </>
  );
  return suggestedTeam && onUseSuggestion ? (
    <button type="button" className="manual-slot-empty has-suggestion is-clickable" onClick={onUseSuggestion} title={`填入推荐对阵：${suggestionTitle}`} aria-label={`填入推荐对阵：${suggestionTitle}`}>
      {content}
    </button>
  ) : (
    <div className={suggestedTeam ? "manual-slot-empty has-suggestion" : "manual-slot-empty"}>
      {content}
    </div>
  );
}

function PairingSlotStack(props: { radiantTeam: TeamBrief | null; direTeam: TeamBrief | null; suggestedRadiantTeam: TeamBrief | null; suggestedDireTeam: TeamBrief | null; suggestedPairLabel: string; setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>; onUseSuggestion: () => void; disabled?: boolean; radiantSlotId: string; direSlotId: string }) {
  const isDisabled = props.disabled === true;
  const canUseSuggestion = !isDisabled && Boolean(props.suggestedRadiantTeam || props.suggestedDireTeam);
  const isFullPairSuggestion = !props.radiantTeam && !props.direTeam && Boolean(props.suggestedRadiantTeam && props.suggestedDireTeam);
  const suggestionActionLabel = props.suggestedRadiantTeam && !props.radiantTeam && props.direTeam ? "放左" : props.suggestedDireTeam && !props.direTeam && props.radiantTeam ? "放右" : "放入";
  const suggestionActionTitle = suggestionActionLabel === "放左"
    ? `把推荐队伍放入左侧：${props.suggestedRadiantTeam?.name ?? props.suggestedPairLabel}`
    : suggestionActionLabel === "放右"
      ? `把推荐队伍放入右侧：${props.suggestedDireTeam?.name ?? props.suggestedPairLabel}`
      : `把推荐对阵放入两侧：${props.suggestedPairLabel}`;
  return (
    <div className="pairing-slot-stack" aria-label="对阵队伍投放位">
      <ManualSeriesSlot target="radiant" title="左侧" team={props.radiantTeam} suggestedTeam={props.suggestedRadiantTeam} suggestedPairLabel={props.suggestedPairLabel} onUseSuggestion={canUseSuggestion ? props.onUseSuggestion : undefined} setStageForm={props.setStageForm} disabled={isDisabled} slotId={props.radiantSlotId} />
      {canUseSuggestion && isFullPairSuggestion ? (
        <div className="pairing-slot-vs is-suggestion-preview" title={`推荐对阵：${props.suggestedPairLabel}`} aria-label={`推荐对阵：${props.suggestedPairLabel}`}>
          <span>VS</span>
        </div>
      ) : canUseSuggestion ? (
        <button type="button" className="pairing-slot-vs is-suggestion-action" onClick={props.onUseSuggestion} title={suggestionActionTitle} aria-label={suggestionActionTitle}>
          <span>VS</span>
          <b>{suggestionActionLabel}</b>
        </button>
      ) : (
        <div className="pairing-slot-vs" aria-hidden="true">VS</div>
      )}
      <ManualSeriesSlot target="dire" title="右侧" team={props.direTeam} suggestedTeam={props.suggestedDireTeam} suggestedPairLabel={props.suggestedPairLabel} onUseSuggestion={canUseSuggestion ? props.onUseSuggestion : undefined} setStageForm={props.setStageForm} disabled={isDisabled} slotId={props.direSlotId} />
    </div>
  );
}

function getManualPickFocusTarget(radiantTeam: TeamBrief | null, direTeam: TeamBrief | null, pickedTarget: ManualSeriesTeamSlotTarget | undefined, primaryActionId: string, radiantSlotId: string, direSlotId: string) {
  if (pickedTarget === "radiant") return direTeam ? primaryActionId : direSlotId;
  if (pickedTarget === "dire") return radiantTeam ? primaryActionId : radiantSlotId;
  if (!radiantTeam) return direTeam ? primaryActionId : direSlotId;
  if (!direTeam) return primaryActionId;
  return primaryActionId;
}

function EditSeriesPanel(props: { data: AdminData; stage: StageSummary; availableTeams: TeamBrief[]; stageForm: StageFormState; setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>; updateSeriesDraft: () => Promise<void>; submitting: boolean }) {
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const editingSeries = props.data.rounds.flatMap((round) => round.series).find((series) => series.id === props.stageForm.editingSeriesId);
  const selectedGroupId = props.stage.type === "group" ? props.stageForm.editGroupId || props.data.groups[0]?.id || "" : "";
  const groupTeams = selectedGroupId ? props.data.groups.find((group) => group.id === selectedGroupId)?.teams ?? [] : [];
  const candidateTeams = props.stage.type === "group" && selectedGroupId ? groupTeams : props.availableTeams;
  const radiantTeam = candidateTeams.find((team) => team.id === props.stageForm.editRadiantTeamId) ?? props.availableTeams.find((team) => team.id === props.stageForm.editRadiantTeamId) ?? null;
  const direTeam = candidateTeams.find((team) => team.id === props.stageForm.editDireTeamId) ?? props.availableTeams.find((team) => team.id === props.stageForm.editDireTeamId) ?? null;
  const selectedIds = new Set([props.stageForm.editRadiantTeamId, props.stageForm.editDireTeamId].filter(Boolean));
  const poolTeams = candidateTeams.filter((team) => !selectedIds.has(team.id));
  const poolPickActionLabel = getNextSlotActionLabel(radiantTeam, direTeam);
  const canPickPoolTeam = !radiantTeam || !direTeam;
  const clearEdit = () => props.setStageForm((current) => ({ ...current, editingSeriesId: "", editRadiantTeamId: "", editDireTeamId: "", editRoundId: "", editGroupId: "", editScheduledAt: "" }));
  const disabled = props.submitting;
  const selectedRound = props.data.rounds.find((round) => round.id === props.stageForm.editRoundId) ?? null;
  const selectedGroup = props.stage.type === "group" ? props.data.groups.find((group) => group.id === selectedGroupId) ?? null : null;
  const roundLabel = selectedRound?.name ?? "未选轮次";
  const groupLabel = selectedGroup?.name ?? "未选小组";
  const statusLabel = labelSeriesStatus(props.stageForm.editStatus);
  const timeLabel = formatDate(props.stageForm.editScheduledAt);
  const kindLabel = props.stage.type === "group" ? props.stageForm.editSeriesKind === "tiebreaker" ? "加赛" : "常规赛" : editingSeries?.boType ?? "BO2";
  const pairLabel = `${radiantTeam?.name ?? "左侧待补"} vs ${direTeam?.name ?? "右侧待补"}`;
  const selectedSlotCount = [radiantTeam, direTeam].filter(Boolean).length;
  const canSave = Boolean(props.stageForm.editRadiantTeamId && props.stageForm.editDireTeamId && props.stageForm.editRoundId);

  return (
    <section className="tool-panel is-primary-tool edit-series-panel">
      <div className="panel-kicker"><ClipboardCheck size={15} /> 修改当前对阵</div>
      <div className={["pairing-desk-final", canSave ? "is-ready" : "", disabled ? "is-saving" : ""].filter(Boolean).join(" ")}>
        <div className="pairing-final-copy">
          <span>{canSave ? "可保存修改" : `已选 ${selectedSlotCount}/2`}</span>
          <strong title={pairLabel}>{pairLabel}</strong>
          <small>{editingSeries ? `原对阵：${editingSeries.radiantTeam.name} vs ${editingSeries.direTeam.name}` : "拖动队伍修正左右位置，细节放在下方抽屉里。"}</small>
        </div>
        <div className="pairing-final-meta">
          {props.stage.type === "group" ? <span>{groupLabel}</span> : null}
          <span>{roundLabel}</span>
          <span>{kindLabel}</span>
          <span>{statusLabel}</span>
          <span>{timeLabel}</span>
        </div>
        <div className="pairing-final-actions">
          <button type="button" className="secondary-button" onClick={() => swapEditSeriesTeams(props.setStageForm)} disabled={disabled || !radiantTeam || !direTeam} title="交换左侧和右侧队伍"><ArrowLeftRight size={15} /> 交换左右</button>
          <button type="button" className={["primary-button", props.submitting ? "is-submitting" : canSave ? "is-ready-action" : "is-waiting"].filter(Boolean).join(" ")} onClick={() => void props.updateSeriesDraft()} disabled={disabled || !canSave}>{props.submitting ? <Loader2 size={15} className="spin" /> : <Check size={15} />} {props.submitting ? "保存中..." : "保存修改"}</button>
          <button type="button" className="secondary-button" onClick={clearEdit} disabled={disabled}>取消</button>
        </div>
      </div>
      <div className="manual-match-dropgrid">
        <EditSeriesDropZone target="pool" title="候选队伍" teams={poolTeams} emptyText={candidateTeams.length === 0 ? "先把队伍加入小组" : "所有候选队伍已在左侧或右侧"} onPickTeam={canPickPoolTeam ? (teamId) => pickEditSeriesTeam(teamId, props.setStageForm) : undefined} actionLabel={poolPickActionLabel} disabled={disabled} />
        <EditSeriesSlot target="radiant" title="左侧队伍" team={radiantTeam} setStageForm={props.setStageForm} disabled={disabled} />
        <EditSeriesSlot target="dire" title="右侧队伍" team={direTeam} setStageForm={props.setStageForm} disabled={disabled} />
      </div>
      <details className="pairing-details-drawer edit-series-details-drawer">
        <summary><span>赛程细节</span><strong>{props.stage.type === "group" ? `${groupLabel} · ${roundLabel} · ${timeLabel}` : `${roundLabel} · ${statusLabel} · ${timeLabel}`}</strong></summary>
        <div className="pairing-desk-controls">
          {props.stage.type === "group" ? <label>所属小组<select value={selectedGroupId} onChange={(event) => patch({ editGroupId: event.target.value, editRadiantTeamId: "", editDireTeamId: "" })} disabled={disabled}>{props.data.groups.length === 0 ? <option value="">未创建小组</option> : props.data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label> : null}
          <label>轮次<select value={props.stageForm.editRoundId} onChange={(event) => patch({ editRoundId: event.target.value })} disabled={disabled}>{props.data.rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
          <label>计划时间<input type="datetime-local" value={props.stageForm.editScheduledAt} onChange={(event) => patch({ editScheduledAt: event.target.value })} disabled={disabled} /></label>
          <label>状态<select value={props.stageForm.editStatus} onChange={(event) => patch({ editStatus: event.target.value })} disabled={disabled}>{["draft", "scheduled", "live", "result_pending", "completed", "conflict", "postponed"].map((status) => <option key={status} value={status}>{labelSeriesStatus(status)}</option>)}</select></label>
          {props.stage.type === "group" ? <div className="segmented-grid compact"><button type="button" className={props.stageForm.editSeriesKind === "regular" ? "is-active" : ""} onClick={() => patch({ editSeriesKind: "regular" })} disabled={disabled}>常规赛</button><button type="button" className={props.stageForm.editSeriesKind === "tiebreaker" ? "is-active" : ""} onClick={() => patch({ editSeriesKind: "tiebreaker" })} disabled={disabled}>加赛</button></div> : null}
        </div>
      </details>
    </section>
  );
}

function EditSeriesDropZone(props: { target: EditSeriesDropTarget; title: string; teams: TeamBrief[]; emptyText: string; onPickTeam?: ((teamId: string) => void) | undefined; actionLabel?: string; disabled?: boolean }) {
  const isDisabled = props.disabled === true;
  const { isOver, setNodeRef } = useDroppable({ id: `edit-series:${props.target}`, disabled: isDisabled });
  const actionLabel = props.actionLabel ?? "填入";
  const countText = `${props.teams.length} 队`;
  const canDragReplaceFromPool = props.target === "pool" && props.teams.length > 0 && !isDisabled;
  const hint = props.onPickTeam ? `${countText} · ${formatPoolClickHint(actionLabel)}` : formatPassivePoolHint(countText, canDragReplaceFromPool);
  return <section ref={setNodeRef} className={["manual-drop-zone", isDisabled ? "is-locked" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ")}><div className="roster-zone-head"><strong>{props.title}</strong><small>{hint}</small></div><div className="roster-zone-list">{props.teams.length === 0 ? <div className="drop-placeholder compact">{props.emptyText}</div> : null}{props.teams.map((team) => <DraggableTeam key={team.id} team={team} actionLabel={actionLabel} disabled={isDisabled} onClick={!isDisabled && props.onPickTeam ? () => { props.onPickTeam?.(team.id); } : undefined} {...(canDragReplaceFromPool ? { dragOnlyLabel: formatDragReplaceTeamLabel(team.name) } : {})} />)}</div></section>;
}

function EditSeriesSlot(props: { target: "radiant" | "dire"; title: string; team: TeamBrief | null; setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>; disabled?: boolean }) {
  const isDisabled = props.disabled === true;
  const { isOver, setNodeRef } = useDroppable({ id: `edit-series:${props.target}`, disabled: isDisabled });
  const clear = () => props.setStageForm((current) => ({ ...current, [props.target === "radiant" ? "editRadiantTeamId" : "editDireTeamId"]: "" }));
  const className = ["manual-drop-zone", "manual-slot-zone", `is-${props.target}`, props.team ? "is-filled" : "is-empty", isDisabled ? "is-locked" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ");
  const sideName = props.target === "radiant" ? "左侧" : "右侧";
  const stateLabel = props.team ? isDisabled ? "已选" : "已选 · 可替换" : `${sideName}空位`;
  return <section ref={setNodeRef} className={className}><div className="roster-zone-head"><strong>{props.title}</strong><small>{stateLabel}</small></div>{props.team ? <div className="manual-slot-team"><span className="manual-slot-filled-label">已放入{sideName}</span><DraggableTeam team={props.team} disabled={isDisabled} /><button type="button" className="manual-slot-clear" onClick={clear} disabled={isDisabled} aria-label={`清空${sideName}队伍`} title={`清空${sideName}队伍`}><X size={13} aria-hidden="true" /></button></div> : <ManualSlotEmpty target={props.target} poolLabel="候选池" suggestedTeam={null} />}</section>;
}

function StageComposer(props: {
  data: AdminData;
  selectedStage: StageSummary | null;
  officialStages: StageSummary[];
  allSeries: SeriesSummary[];
  lastCreatedSeriesId: string;
  manualSeriesSubmitting: boolean;
  seriesDraftSubmitting: boolean;
  availableTeams: TeamBrief[];
  load: (preferredTournamentId?: string, preferredStageId?: string) => Promise<void>;
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resizeStageGroups: (targetCount: number) => Promise<void>;
  randomizeGroups: () => Promise<void>;
  generateBracket: () => Promise<void>;
  createScheduleFrame: () => Promise<void>;
  withdrawSchedule: () => Promise<void>;
  createManualSeries: CreateManualSeriesHandler;
  updateSeriesDraft: () => Promise<void>;
  focusWorkflowTarget: (target: WorkflowFocusTarget) => void;
}) {
  const configuredPreliminaryType = props.data.schedule?.preliminaryType === "swiss" ? "swiss" : "group";
  const preliminaryStage = props.officialStages.find(isPreliminaryStage);
  const knockoutStage = props.officialStages.find(isKnockoutStage);
  const groupSelected = props.selectedStage?.type === "group";
  const isPublished = props.data.schedule?.status === "published";
  const readiness = getScheduleReadiness(props.data.schedule, props.officialStages, props.selectedStage, props.allSeries);
  const hasBaseConfig = Boolean(props.data.schedule?.rosterLocked && props.data.schedule.preliminaryType && props.data.schedule.knockoutType);
  const canCreateManualSeries = !isPublished && props.selectedStage !== null && isPreliminaryStage(props.selectedStage);
  const guidance = getComposerGuidance(props.data, readiness, preliminaryStage, knockoutStage);
  const configuredPreliminaryLabel = configuredPreliminaryType === "swiss" ? "瑞士轮" : "小组赛";
  const shouldCreateFullFrame = !isPublished && hasBaseConfig && !preliminaryStage && !knockoutStage;
  const openKnockoutStage = async () => {
    if (!knockoutStage) return;
    await props.load(props.data.selectedTournamentId, knockoutStage.id);
    requestBracketNextFocus();
  };

  return (
    <div className="inspector-stack is-focused">
      <section className="tool-panel command-panel">
        <div className="panel-kicker"><ArrowRight size={15} /> 操作指引</div>
        <p className="muted">{guidance}</p>
      </section>
      {isPublished ? (
        <section className="tool-panel is-primary-tool">
          <div className="panel-kicker"><RotateCcw size={15} /> 恢复编辑路径</div>
          <p className="tool-copy">{readiness.publishedButIncomplete ? "当前 H5 发布状态不完整。先撤回发布，后台才会重新开放创建阶段和拖拽编排。" : "官方赛程已经发布。需要调整赛制、分组或对阵图时，先撤回再编辑。"}</p>
          {readiness.publishedButIncomplete ? <div className="tool-note">修复按钮已放在中间主工作面，避免误点多个入口。</div> : <button className="primary-button" type="button" onClick={() => void props.withdrawSchedule()}><RotateCcw size={15} /> 撤回发布</button>}
        </section>
      ) : !hasBaseConfig ? (
        <section className="tool-panel is-primary-tool">
          <div className="panel-kicker"><ShieldCheck size={15} /> 先完成基础设置</div>
          <p className="tool-copy">先在中间控制台锁定参赛名单，并保存预赛和淘汰赛赛制。完成后这里会只显示当前可用工具。</p>
          <Checklist items={[{ ok: Boolean(props.data.schedule?.rosterLocked), text: "名单已锁定" }, { ok: Boolean(props.data.schedule?.preliminaryType), text: "预赛赛制已保存" }, { ok: Boolean(props.data.schedule?.knockoutType), text: "淘汰赛赛制已保存" }]} />
        </section>
      ) : shouldCreateFullFrame ? (
        <section className="tool-panel is-primary-tool">
          <div className="panel-kicker"><GitBranch size={15} /> 创建预赛草稿</div>
          <p className="tool-copy">基础设置已经完成。中间画布只保留一个主按钮，用它先创建预赛阶段。</p>
          <div className="tool-note">预赛结果确定后，再从预赛排名拖拽晋级队伍生成淘汰赛对阵图。</div>
        </section>
      ) : !preliminaryStage ? (
        <section className="tool-panel is-primary-tool">
          <div className="panel-kicker"><Plus size={15} /> 创建{configuredPreliminaryLabel}预赛</div>
          <p className="tool-copy">创建入口已收敛到中间主画布的“推荐路径”卡片。那里会展示创建后的操作顺序，再点击唯一主按钮。</p>
          <div className="tool-note">右侧只保留说明，避免同一个创建动作出现在多个区域。</div>
        </section>
      ) : (
        <>
          {groupSelected ? (
            <section className="tool-panel is-secondary-tool">
              <div className="panel-kicker"><Dices size={15} /> 小组赛工具</div>
              <p className="tool-copy">建组、拖队伍、随机分组和手动排赛都在中间小组画布完成。</p>
              <div className="tool-note">右侧只保留说明，避免管理员在两个地方找同一套按钮。</div>
            </section>
          ) : null}
          {props.selectedStage?.type === "swiss" ? (
            <section className="tool-panel is-primary-tool">
              <div className="panel-kicker"><CircleDot size={15} /> 瑞士轮编排</div>
              <p className="tool-copy">瑞士轮配对在中间画布完成：先按当前战绩拖两队创建 BO2；需要系统铺底时，再展开自动配对辅助。</p>
              <div className="tool-metrics"><span>当前轮次</span><strong>{props.data.rounds.length} 轮</strong></div>
            </section>
          ) : null}
          {canCreateManualSeries && props.stageForm.editingSeriesId ? (
            <section className="tool-panel is-secondary-tool">
              <div className="panel-kicker"><ClipboardCheck size={15} /> 正在编辑对阵</div>
              <p className="tool-copy">编辑表单已放到中间阶段画布的赛程列表上方，和被编辑的对阵保持在同一工作区。</p>
              <div className="tool-note">右侧不再重复展示同一张表单，避免保存到错误位置。</div>
            </section>
          ) : null}
          {canCreateManualSeries && props.selectedStage && props.selectedStage.type !== "group" && props.selectedStage.type !== "swiss" ? <ManualSeriesBuilder data={props.data} stage={props.selectedStage} availableTeams={props.availableTeams} stageForm={props.stageForm} setStageForm={props.setStageForm} createManualSeries={props.createManualSeries} manualSeriesSubmitting={props.manualSeriesSubmitting} /> : null}
          {!knockoutStage && props.selectedStage && isPreliminaryStage(props.selectedStage) ? (
            <section className="tool-panel is-secondary-tool">
              <div className="panel-kicker"><Brackets size={15} /> 淘汰赛入口</div>
              <p className="tool-copy">入围队伍拖拽和对阵图生成已经放到中间预赛画布，按排名拖队伍即可。</p>
              <div className="tool-note">右侧只保留提示，避免两个地方同时出现同一套入围区。</div>
            </section>
          ) : !knockoutStage ? (
            <section className="tool-panel is-secondary-tool">
              <div className="panel-kicker"><Brackets size={15} /> 淘汰赛稍后生成</div>
              <p className="tool-copy">淘汰赛入围要从预赛排名来。请先进入预赛画布，录完赛果后在中间的入围区拖拽生成对阵图。</p>
              <button type="button" className="secondary-button" onClick={() => props.focusWorkflowTarget("stage-workspace")} disabled={!preliminaryStage}><ArrowRight size={15} /> 去预赛主画布</button>
            </section>
          ) : (
            <section className="tool-panel is-primary-tool">
              <div className="panel-kicker"><Brackets size={15} /> 淘汰赛管理</div>
              <p className="tool-copy">淘汰赛阶段已创建。切到淘汰赛画布后，可以把队伍拖入槽位，并在节点上直接选择胜者。</p>
              <div className="tool-metrics"><span>阶段</span><strong>{knockoutStage.name}</strong></div>
              <button type="button" className="primary-button" onClick={() => void openKnockoutStage()}><Brackets size={15} /> 打开对阵图</button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StageBoard(props: {
  stage: StageSummary;
  data: AdminData;
  officialStages: StageSummary[];
  allSeries: SeriesSummary[];
  lastCreatedSeriesId: string;
  manualSeriesSubmitting: boolean;
  seriesDraftSubmitting: boolean;
  availableTeams: TeamBrief[];
  load: (preferredTournamentId?: string, preferredStageId?: string) => Promise<void>;
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resizeStageGroups: (targetCount: number) => Promise<void>;
  randomizeGroups: () => Promise<void>;
  addTeamToGroup: (groupId: string, teamId: string) => Promise<void>;
  removeTeamFromGroup: (groupId: string, teamId: string) => Promise<void>;
  updateStageGroupName: (groupId: string, name: string) => Promise<void>;
  deleteStageGroup: (group: StageGroup) => Promise<void>;
  generateGroupRoundRobin: () => Promise<void>;
  createManualSeries: CreateManualSeriesHandler;
  generateSwissPairings: () => Promise<void>;
  confirmSwissRound: (roundId: string, description?: string) => Promise<void>;
  retractSwissRound: (roundId: string, description?: string) => Promise<void>;
  generateBracket: () => Promise<void>;
  setBracketSlot: (nodeId: string, slot: BracketSlotName, teamId: string | null) => Promise<void>;
  advanceBracketNode: (nodeId: string, winnerTeamId: string) => Promise<void>;
  updateSeriesResult: (seriesId: string, radiantScore: number, direScore: number) => Promise<boolean>;
  updateSeriesScheduledAt: (seriesId: string, scheduledAt: string) => Promise<boolean>;
  updateSeriesGameMatchId: (seriesId: string, gameIndex: number, matchId: number | null) => Promise<boolean>;
  deleteSeries: (seriesId: string, description?: string) => Promise<void>;
  updateManualRanks: (teamIds: string[]) => Promise<void>;
  resetManualRanks: () => Promise<void>;
  startEditSeries: (series: SeriesSummary) => void;
  updateSeriesDraft: () => Promise<void>;
}) {
  const [followupOpen, setFollowupOpen] = useState(false);
  const nextStep = getStageNextStep(props.stage, props.data, props.officialStages, props.allSeries, props.availableTeams, props.stageForm);
  const stageContextSummary = getStageContextSummary(props.stage, props.data, props.allSeries);
  const stageWorkbench = (
    <>
      {props.stage.type === "group" ? <GroupCanvas {...props} /> : null}
      {props.stage.type === "swiss" ? <SwissCanvas {...props} /> : null}
      {props.stage.type === "knockout" ? <BracketCanvas {...props} stage={props.stage} bracket={props.data.bracket} /> : null}
    </>
  );
  const seriesBoard = (
    <div id="stage-series-list" tabIndex={-1} className="board-grid">
      <SeriesList rounds={props.data.rounds} series={props.allSeries} emptyStep={nextStep} highlightSeriesId={props.lastCreatedSeriesId} editingSeriesId={props.stageForm.editingSeriesId} updateSeriesResult={props.updateSeriesResult} updateSeriesScheduledAt={props.updateSeriesScheduledAt} updateSeriesGameMatchId={props.updateSeriesGameMatchId} deleteSeries={props.deleteSeries} startEditSeries={props.startEditSeries} />
      <StandingsTable rows={props.data.standings} seriesCount={props.allSeries.length} emptyStep={nextStep} resetManualRanks={props.resetManualRanks} />
    </div>
  );
  const shouldDeferFollowup = isPreliminaryStage(props.stage) && props.allSeries.length === 0;
  const shouldRenderBoardHeader = !shouldDeferFollowup;
  const shouldShowStageNavigation = !shouldDeferFollowup;
  const followupTitle = shouldDeferFollowup
    ? "排完赛再看赛果、排名、淘汰赛"
    : props.stage.type === "swiss" ? "配对后处理赛果 / 排名" : "排赛后处理赛果 / 排名";
  const followupSummaryLabel = shouldDeferFollowup ? "稍后处理" : "后续处理";
  const followupBody = (
    <>
      {shouldDeferFollowup ? <StageSnapshotBar stage={props.stage} data={props.data} allSeries={props.allSeries} /> : null}
      {seriesBoard}
      {isPreliminaryStage(props.stage) ? <KnockoutEntryDesk {...props} /> : null}
    </>
  );
  const stageContextDrawer = (
    <details className="stage-context-drawer">
      <summary>
        <div>
          <span>阶段概览</span>
          <strong>{stageContextSummary.title}</strong>
          <small>{stageContextSummary.metric}</small>
        </div>
        <ArrowRight size={16} />
      </summary>
      <StageSnapshotBar stage={props.stage} data={props.data} allSeries={props.allSeries} />
    </details>
  );
  return (
    <section className="board-shell">
      {shouldRenderBoardHeader ? <div className="board-header"><div><span>{labelStageType(props.stage.type)}</span><h2>{props.stage.name}</h2></div><StatusPill tone={toneForStatus(props.stage.status)}>{labelStageStatus(props.stage.status)}</StatusPill></div> : null}
      <StageSeriesQuickDock series={props.allSeries} recentSeriesId={props.lastCreatedSeriesId} />
      {stageWorkbench}
      {shouldShowStageNavigation ? (
        <div className="stage-inline-navigation">
          <StageSectionDock stage={props.stage} data={props.data} officialStages={props.officialStages} allSeries={props.allSeries} availableTeams={props.availableTeams} />
        </div>
      ) : null}
      {isPreliminaryStage(props.stage) && props.stageForm.editingSeriesId ? (
        <div id="stage-inline-series-editor" tabIndex={-1} className="stage-inline-editor">
          <EditSeriesPanel data={props.data} stage={props.stage} availableTeams={props.availableTeams} stageForm={props.stageForm} setStageForm={props.setStageForm} updateSeriesDraft={props.updateSeriesDraft} submitting={props.seriesDraftSubmitting} />
        </div>
      ) : null}
      {shouldDeferFollowup ? (
        <details id="stage-followup-drawer" className="stage-followup-drawer is-merged-context" open={followupOpen} onToggle={(event) => setFollowupOpen(event.currentTarget.open)}>
          <summary>
            <span className={`stage-followup-icon is-${nextStep.tone}`}>{nextStep.icon}</span>
            <div>
              <span>{followupSummaryLabel}</span>
              <strong>{followupTitle}</strong>
            </div>
            <ArrowRight size={16} className="stage-followup-chevron" />
          </summary>
          {followupOpen ? <div className="stage-followup-body">{followupBody}</div> : null}
        </details>
      ) : followupBody}
      {shouldDeferFollowup ? null : stageContextDrawer}
    </section>
  );
}

function StageSeriesQuickDock({ series, recentSeriesId }: { series: SeriesSummary[]; recentSeriesId: string }) {
  if (series.length === 0) return null;

  const completedResultCount = series.filter(seriesHasResult).length;
  const pendingResultCount = series.filter(seriesNeedsResult).length;
  const matchSlotCount = series.reduce((sum, item) => sum + item.games.length, 0);
  const linkedMatchCount = series.reduce((sum, item) => sum + item.games.filter((game) => game.matchId !== null && game.matchId !== undefined).length, 0);
  const pendingResultStep = getPendingSeriesResultStep(series);
  const missingMatchStep = getMissingSeriesMatchIdStep(series);
  const firstTodoStep = pendingResultStep ?? missingMatchStep;
  const firstTodoSeriesId = firstTodoStep?.seriesId ?? "";
  const firstTodoFilterMode = firstTodoStep?.seriesFilterMode ?? "todo";
  const recentSeries = series.find((item) => item.id === recentSeriesId) ?? null;
  const recentFocus = recentSeries
    ? seriesNeedsResult(recentSeries)
      ? { label: "补刚创建赛果", filterMode: "result" as SeriesFilterMode }
      : countMissingSeriesMatchIds(recentSeries) > 0
        ? { label: "补刚创建 ID", filterMode: "match" as SeriesFilterMode }
        : { label: "查看刚创建", filterMode: "all" as SeriesFilterMode }
    : null;
  const dockTone: Tone = pendingResultCount > 0 ? "warn" : linkedMatchCount < matchSlotCount ? "info" : "good";
  const locateTodoLabel = pendingResultStep ? "定位待赛果" : missingMatchStep ? "定位缺 ID" : "定位待处理";
  const title = recentSeries
    ? "刚创建对阵已高亮"
    : pendingResultCount > 0
      ? "继续补赛果"
      : linkedMatchCount < matchSlotCount
        ? "继续补 match_id"
        : "赛果已处理";
  const hint = recentSeries
    ? `${recentSeries.radiantTeam.name} vs ${recentSeries.direTeam.name}`
    : pendingResultCount > 0
      ? `${pendingResultCount} 场还没有比分`
      : linkedMatchCount < matchSlotCount
        ? `${matchSlotCount - linkedMatchCount} 个单局缺 match_id`
        : "当前阶段没有明显待处理项";

  return (
    <section className={`stage-series-quick-dock is-${dockTone}`} aria-label="赛果处理入口">
      <div className="stage-series-quick-main">
        <span><ClipboardCheck size={15} /> 赛果处理</span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </div>
      <div className="stage-series-quick-metrics">
        <div><span>赛果</span><strong>{completedResultCount}/{series.length}</strong></div>
        <div><span>match_id</span><strong>{linkedMatchCount}/{matchSlotCount}</strong></div>
      </div>
      <div className="stage-series-quick-actions">
        {recentSeries && recentFocus ? <button type="button" className="secondary-action" onClick={() => requestSeriesListFocus(recentSeries.id, recentFocus.filterMode)}>{recentFocus.label}</button> : null}
        {firstTodoSeriesId && firstTodoSeriesId !== recentSeries?.id ? <button type="button" className="secondary-action" onClick={() => requestSeriesListFocus(firstTodoSeriesId, firstTodoFilterMode)}>{locateTodoLabel}</button> : null}
        <button type="button" className="primary-action" onClick={() => requestSeriesListFocus(null, "all")}>打开赛程列表</button>
      </div>
    </section>
  );
}

function focusElementById(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    if (openLazyContainerForTarget(id)) {
      window.setTimeout(() => focusElementById(id), 80);
    }
    return;
  }
  if (element instanceof HTMLDetailsElement) element.open = true;
  let parentDetails = element.parentElement?.closest("details") ?? null;
  while (parentDetails) {
    parentDetails.open = true;
    parentDetails = parentDetails.parentElement?.closest("details") ?? null;
  }
  const top = element.getBoundingClientRect().top + window.scrollY - 18;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  element.focus({ preventScroll: true });
}

function focusElementByIdAfterRender(id: string) {
  window.setTimeout(() => focusElementById(id), 40);
  window.setTimeout(() => {
    if (document.activeElement?.id !== id) focusElementById(id);
  }, 160);
  window.setTimeout(() => {
    if (document.activeElement?.id !== id) focusElementById(id);
  }, 320);
}

function openLazyContainerForTarget(id: string) {
  const groupPriorityTargets = new Set(["group-priority-canvas"]);
  if (groupPriorityTargets.has(id) || id.startsWith("group-column-") || id === "group-unassigned-tray") {
    const details = document.getElementById("group-priority-details");
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
      return true;
    }
  }
  return false;
}

function StageSectionDock(props: { stage: StageSummary; data: AdminData; officialStages: StageSummary[]; allSeries: SeriesSummary[]; availableTeams: TeamBrief[] }) {
  const shortcuts = getStageSectionShortcuts(props.stage, props.data, props.officialStages, props.allSeries, props.availableTeams);
  return (
    <nav className="stage-section-dock" aria-label="阶段操作导航">
      {shortcuts.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`stage-section-shortcut is-${item.tone}`}
          data-target-id={item.targetId}
          title={item.hint ? `定位到：${item.label} · ${item.metric}；${item.hint}` : `定位到：${item.label} · ${item.metric}`}
          aria-label={item.hint ? `${item.label}，${item.metric}，${item.hint}` : `${item.label}，${item.metric}`}
          onClick={() => {
            if (item.seriesId) {
              requestSeriesListFocus(item.seriesId, item.seriesFilterMode ?? "todo");
              return;
            }
            focusElementById(item.targetId);
          }}
        >
          <span>{item.icon}</span>
          <strong>{item.label}</strong>
          <small>{item.metric}</small>
        </button>
      ))}
    </nav>
  );
}

function StageSnapshotBar({ stage, data, allSeries }: { stage: StageSummary; data: AdminData; allSeries: SeriesSummary[] }) {
  const items = getStageSnapshotItems(stage, data, allSeries);
  return (
    <section className="stage-snapshot-bar" aria-label="当前阶段概览">
      {items.map((item) => (
        <div key={item.label} className={`stage-snapshot-item is-${item.tone}`}>
          <span>{item.icon}</span>
          <div>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </div>
        </div>
      ))}
    </section>
  );
}

function getStageSectionShortcuts(stage: StageSummary, data: AdminData, officialStages: StageSummary[], allSeries: SeriesSummary[], availableTeams: TeamBrief[]): StageSectionShortcut[] {
  const resultCount = countSeriesWithResult(allSeries);
  const resultShortcutMetric = allSeries.length === 0 ? "待排赛" : `${resultCount}/${allSeries.length}`;
  const resultShortcutTone: Tone = allSeries.length === 0 ? "neutral" : resultCount > 0 ? "good" : "info";
  const seriesFollowUpStep = getSeriesFollowUpStep(allSeries, true);
  const resultShortcutTargetId = seriesFollowUpStep?.targetId ?? getResultShortcutTarget(stage, data, allSeries, availableTeams);
  const resultShortcutSeriesProps: Partial<Pick<StageSectionShortcut, "seriesId" | "seriesFilterMode" | "hint">> = seriesFollowUpStep?.seriesId
    ? { seriesId: seriesFollowUpStep.seriesId, seriesFilterMode: seriesFollowUpStep.seriesFilterMode ?? "todo", hint: seriesFollowUpStep.title }
    : {};
  if (stage.type === "group") {
    const assignedCount = data.groups.reduce((sum, group) => sum + group.teams.length, 0);
    const groupsWithEnoughTeams = data.groups.filter((group) => group.teams.length >= 2).length;
    const groupingIsCollapsedBehindPairing = allSeries.length === 0
      && data.groups.length > 0
      && availableTeams.length > 0
      && assignedCount === availableTeams.length
      && groupsWithEnoughTeams === data.groups.length;
    const groupingSetupTarget = getGroupSetupTarget(data, availableTeams);
    const groupingTargetId = groupingIsCollapsedBehindPairing
      ? "group-priority-canvas"
      : groupingSetupTarget.targetId === "group-pairing-desk" ? "group-drag-canvas" : groupingSetupTarget.targetId;
    const groupingHint = groupingIsCollapsedBehindPairing ? "分组画布已收起，点击可展开并定位到小组队伍" : undefined;
    const knockoutStage = officialStages.find(isKnockoutStage);
    const knockoutReadiness = getKnockoutEntryReadiness(stage, data, allSeries, availableTeams);
    const knockoutShortcutTargetId = knockoutStage || knockoutReadiness.ready ? "knockout-entry-desk" : knockoutReadiness.step.targetId;
    const knockoutShortcutMetric = getKnockoutShortcutMetric(knockoutStage, knockoutReadiness);
    const knockoutShortcutTone = knockoutStage || knockoutReadiness.ready ? "good" : knockoutReadiness.step.tone;
    const knockoutShortcutHint = knockoutStage ? "淘汰赛阶段已经生成" : knockoutReadiness.step.title;
    return [
      { icon: <Users size={15} />, label: "分组", metric: `${assignedCount}/${availableTeams.length} 队`, targetId: groupingTargetId, tone: assignedCount === availableTeams.length && availableTeams.length > 0 ? "good" : "warn", ...(groupingHint ? { hint: groupingHint } : {}) },
      { icon: <MousePointer2 size={15} />, label: "排赛", metric: `${allSeries.length} 场`, targetId: "group-pairing-desk", tone: allSeries.length > 0 ? "info" : "warn" },
      { icon: <ClipboardCheck size={15} />, label: "赛果", metric: resultShortcutMetric, targetId: resultShortcutTargetId, tone: resultShortcutTone, ...resultShortcutSeriesProps },
      { icon: <Brackets size={15} />, label: "淘汰赛", metric: knockoutShortcutMetric, targetId: knockoutShortcutTargetId, tone: knockoutShortcutTone, hint: knockoutShortcutHint },
    ];
  }
  if (stage.type === "swiss") {
    const draftRounds = data.rounds.filter((round) => round.pairingStatus !== "confirmed");
    const confirmedRounds = data.rounds.filter((round) => round.pairingStatus === "confirmed");
    const knockoutStage = officialStages.find(isKnockoutStage);
    const knockoutReadiness = getKnockoutEntryReadiness(stage, data, allSeries, availableTeams);
    const knockoutShortcutTargetId = knockoutStage || knockoutReadiness.ready ? "knockout-entry-desk" : knockoutReadiness.step.targetId;
    const knockoutShortcutMetric = getKnockoutShortcutMetric(knockoutStage, knockoutReadiness);
    const knockoutShortcutTone = knockoutStage || knockoutReadiness.ready ? "good" : knockoutReadiness.step.tone;
    const knockoutShortcutHint = knockoutStage ? "淘汰赛阶段已经生成" : knockoutReadiness.step.title;
    return [
      { icon: <ListRestart size={15} />, label: "配对", metric: `${data.rounds.length} 轮`, targetId: "swiss-pairing-desk", tone: data.rounds.length > 0 ? "info" : "warn" },
      { icon: <Check size={15} />, label: "确认", metric: `${draftRounds.length} 待确认`, targetId: "swiss-round-lanes", tone: draftRounds.length > 0 ? "warn" : confirmedRounds.length > 0 ? "good" : "info" },
      { icon: <ClipboardCheck size={15} />, label: "赛果", metric: resultShortcutMetric, targetId: resultShortcutTargetId, tone: resultShortcutTone, ...resultShortcutSeriesProps },
      { icon: <Brackets size={15} />, label: "淘汰赛", metric: knockoutShortcutMetric, targetId: knockoutShortcutTargetId, tone: knockoutShortcutTone, hint: knockoutShortcutHint },
    ];
  }

  const bracketTargets = getBracketActionTargets(data.bracket);
  const slotSummary = bracketTargets.slotSummary;
  const readyNodes = bracketTargets.readyNodes.length;
  return [
    { icon: <Brackets size={15} />, label: "对阵图", metric: `${data.bracket.length} 节点`, targetId: "bracket-workbench", tone: data.bracket.length > 0 ? "info" : "warn" },
    { icon: <GripVertical size={15} />, label: "槽位", metric: slotSummary.manualOpenSlotCount > 0 ? `${slotSummary.manualOpenSlotCount} 待补` : slotSummary.waitingOpenSlotCount > 0 ? `${slotSummary.waitingOpenSlotCount} 等上游` : "已就绪", targetId: slotSummary.manualOpenSlotCount > 0 ? bracketTargets.manualOpenSlotTargetId : slotSummary.waitingOpenSlotCount > 0 ? bracketTargets.waitingOpenSlotTargetId : "bracket-workbench", tone: slotSummary.manualOpenSlotCount > 0 ? "warn" : slotSummary.waitingOpenSlotCount > 0 ? "info" : "good" },
    { icon: <MousePointer2 size={15} />, label: "判胜", metric: `${readyNodes} 待判`, targetId: bracketTargets.readyNodeTargetId, tone: readyNodes > 0 ? "info" : "good" },
    { icon: <ClipboardCheck size={15} />, label: "赛果", metric: resultShortcutMetric, targetId: resultShortcutTargetId, tone: resultShortcutTone },
  ];
}

function getKnockoutShortcutMetric(knockoutStage: StageSummary | undefined, readiness: { ready: boolean; step: StageNextStep }): string {
  if (knockoutStage) return "已生成";
  if (readiness.ready) return "可生成";
  if (readiness.step.targetId === "group-pairing-desk") return "先排赛";
  if (readiness.step.targetId === "swiss-workbench" || readiness.step.targetId === "swiss-pairing-desk") return "先配对";
  if (readiness.step.targetId === "swiss-round-lanes") return "先确认";
  if (readiness.step.title.includes("赛果")) return "先赛果";
  if (readiness.step.title.includes("排名")) return "等排名";
  return "稍后";
}

function getResultShortcutTarget(stage: StageSummary, data: AdminData, allSeries: SeriesSummary[], availableTeams: TeamBrief[]): string {
  if (allSeries.length > 0) return "stage-series-list";
  if (stage.type === "group") {
    return getGroupSetupTarget(data, availableTeams).targetId;
  }
  if (stage.type === "swiss") return "swiss-pairing-desk";
  return "bracket-workbench";
}

function getGroupSetupTarget(data: AdminData, availableTeams: TeamBrief[]): { targetId: string; actionLabel: string } {
  const assignedCount = data.groups.reduce((sum, group) => sum + group.teams.length, 0);
  const unassignedCount = Math.max(availableTeams.length - assignedCount, 0);
  const firstUnderfilledGroup = data.groups.find((group) => group.teams.length < 2) ?? null;
  if (data.groups.length === 0) return { targetId: "group-count-control", actionLabel: "选择小组数量" };
  if (unassignedCount > 0) return { targetId: "group-unassigned-tray", actionLabel: "去拖队伍" };
  if (firstUnderfilledGroup) return { targetId: groupColumnElementId(firstUnderfilledGroup.id), actionLabel: "检查小组" };
  return { targetId: "group-pairing-desk", actionLabel: "去排赛区" };
}

function getStageNextStep(stage: StageSummary, data: AdminData, officialStages: StageSummary[], allSeries: SeriesSummary[], availableTeams: TeamBrief[], stageForm: StageFormState): StageNextStep {
  if (data.schedule?.status === "published") {
    return {
      icon: <Lock size={16} />,
      title: "赛程已发布，结构编辑已锁定",
      text: "如果需要继续改分组、对阵或淘汰赛槽位，先在官方赛程控制台撤回发布。",
      metric: "H5 正在展示",
      actionLabel: "去发布控制台",
      targetId: "schedule-control-panel",
      tone: "warn",
    };
  }

  if (stage.type === "group") {
    const assignedCount = data.groups.reduce((sum, group) => sum + group.teams.length, 0);
    const unassignedCount = Math.max(availableTeams.length - assignedCount, 0);
    const groupsWithEnoughTeams = data.groups.filter((group) => group.teams.length >= 2).length;
    const groupingSetupTarget = getGroupSetupTarget(data, availableTeams);
    const knockoutStage = officialStages.find(isKnockoutStage);
    if (data.groups.length === 0) {
      return { icon: <Plus size={16} />, title: "先创建小组", text: "小组赛不会自动分队，可以只建 1 组，也可以建多组；随后把队伍手动加入目标小组。", metric: "0 个小组", actionLabel: groupingSetupTarget.actionLabel, targetId: groupingSetupTarget.targetId, tone: "warn" };
    }
    if (unassignedCount > 0) {
      return { icon: <Users size={16} />, title: "把队伍拖进目标小组", text: "在小组画布里把队伍拖到目标小组；下拉表只用于精确修正。", metric: `${unassignedCount} 队未分组`, actionLabel: groupingSetupTarget.actionLabel, targetId: groupingSetupTarget.targetId, tone: "warn" };
    }
    if (groupsWithEnoughTeams !== data.groups.length) {
      return { icon: <ShieldCheck size={16} />, title: "检查每个小组人数", text: "每个小组至少 2 支队伍后，才能顺利生成 BO2 单循环或手动排赛。", metric: `${groupsWithEnoughTeams}/${data.groups.length} 个小组可排赛`, actionLabel: groupingSetupTarget.actionLabel, targetId: groupingSetupTarget.targetId, tone: "warn" };
    }
    if (allSeries.length === 0) {
      return { icon: <CalendarClock size={16} />, title: "手动创建组内对阵", text: "分组完成后，先在排赛板里拖两支队伍创建 BO2；完整单循环只是下方辅助捷径。", metric: "还没有对阵", actionLabel: "去排赛区", targetId: "group-pairing-desk", tone: "info" };
    }
    const pendingResultStep = getPendingSeriesResultStep(allSeries);
    if (pendingResultStep) return pendingResultStep;
    if (!knockoutStage) {
      const knockoutReadiness = getKnockoutEntryReadiness(stage, data, allSeries, availableTeams);
      if (!knockoutReadiness.ready) return knockoutReadiness.step;
      return { icon: <Brackets size={16} />, title: "预赛赛程已建立，后续生成淘汰赛", text: "录入小组赛结果后，从排名区拖入晋级队伍生成淘汰赛对阵图。", metric: `${allSeries.length} 场对阵`, actionLabel: "去淘汰赛入口", targetId: "knockout-entry-desk", tone: "good" };
    }
    const missingMatchStep = getMissingSeriesMatchIdStep(allSeries);
    if (missingMatchStep) return missingMatchStep;
    return { icon: <ClipboardCheck size={16} />, title: "维护赛果和 match_id", text: "当前阶段结构已具备，继续在赛程列表里录比分、补 Dota2 比赛 ID 或修正对阵。", metric: `${allSeries.length} 场对阵`, actionLabel: "去赛程列表", targetId: "stage-series-list", tone: "good" };
  }

  if (stage.type === "swiss") {
    const draftRounds = data.rounds.filter((round) => round.pairingStatus !== "confirmed");
    const confirmedRounds = data.rounds.filter((round) => round.pairingStatus === "confirmed");
    const knockoutStage = officialStages.find(isKnockoutStage);
    if (data.rounds.length === 0) {
      return { icon: <MousePointer2 size={16} />, title: `创建第 ${stageForm.swissRoundNumber} 轮配对`, text: "先在瑞士轮手动配对板拖两支队伍创建 BO2；需要系统铺底时，再展开自动配对辅助。", metric: "0 轮", actionLabel: "去手动配对", targetId: "swiss-pairing-desk", tone: "info" };
    }
    if (draftRounds.length > 0) {
      return { icon: <Check size={16} />, title: "确认待确认轮次", text: "检查草稿配对无误后确认，本轮才会作为正式赛程进入 H5。", metric: `${draftRounds.length} 轮待确认`, actionLabel: "去确认轮次", targetId: "swiss-round-lanes", tone: "warn" };
    }
    const pendingResultStep = getPendingSeriesResultStep(allSeries);
    if (pendingResultStep) return pendingResultStep;
    if (!knockoutStage) {
      const knockoutReadiness = getKnockoutEntryReadiness(stage, data, allSeries, availableTeams);
      if (!knockoutReadiness.ready) return knockoutReadiness.step;
      return { icon: <Trophy size={16} />, title: "从排名生成淘汰赛入围", text: "瑞士轮已有可用赛果。确认排名后，从预赛排名拖入晋级队伍生成淘汰赛。", metric: `${confirmedRounds.length} 轮已确认`, actionLabel: "去淘汰赛入口", targetId: "knockout-entry-desk", tone: "good" };
    }
    const missingMatchStep = getMissingSeriesMatchIdStep(allSeries);
    if (missingMatchStep) return missingMatchStep;
    return { icon: <ClipboardCheck size={16} />, title: "维护瑞士轮赛程详情", text: "可以继续补 match_id、修正比分，或在积分榜里手动调整最终排序。", metric: `${confirmedRounds.length} 轮已确认`, actionLabel: "去赛程列表", targetId: "stage-series-list", tone: "good" };
  }

  const bracketTargets = getBracketActionTargets(data.bracket);
  const slotSummary = bracketTargets.slotSummary;
  const readyNodes = bracketTargets.readyNodes;
  const completedNodes = bracketTargets.completedNodes;
  if (data.bracket.length === 0) {
    return { icon: <Brackets size={16} />, title: "还没有淘汰赛对阵图", text: "回到预赛阶段，从排名区拖入晋级队伍并生成淘汰赛对阵图。", metric: "0 个节点", actionLabel: "看对阵图画布", targetId: "bracket-workbench", tone: "warn" };
  }
  if (slotSummary.manualOpenSlotCount > 0) {
    return { icon: <GripVertical size={16} />, title: "拖拽补齐首轮槽位", text: "把待落位队伍拖到上位或下位；等待上游的槽位会由胜者自动进入，也可手动修正。", metric: `${slotSummary.manualOpenSlotCount} 个待补槽`, actionLabel: "去待补槽", targetId: bracketTargets.manualOpenSlotTargetId, tone: "warn" };
  }
  if (readyNodes.length > 0) {
    return { icon: <MousePointer2 size={16} />, title: "选择每场比赛胜者", text: "双方都已落位的节点可以直接点胜者，后端会推进下一轮或掉入败者组。", metric: `${readyNodes.length} 场待判胜`, actionLabel: "去待判胜", targetId: bracketTargets.readyNodeTargetId, tone: "info" };
  }
  if (slotSummary.waitingOpenSlotCount > 0) {
    return { icon: <Clock3 size={16} />, title: "等待上游比赛产生晋级队伍", text: "这些槽位会在上一轮确认胜者后自动补齐；必要时仍可手动拖拽修正。", metric: `${slotSummary.waitingOpenSlotCount} 个等上游槽`, actionLabel: "查看等待槽", targetId: bracketTargets.waitingOpenSlotTargetId, tone: "info" };
  }
  return { icon: <Trophy size={16} />, title: "淘汰赛当前无待处理动作", text: "对阵图节点已经处理到当前可推进状态，后续等上游结果或继续补 match_id。", metric: `${completedNodes.length}/${data.bracket.length} 已完成`, actionLabel: "查看对阵图", targetId: "bracket-workbench", tone: "good" };
}

function getPrePublishStageStep(stage: StageSummary, data: AdminData, officialStages: StageSummary[], allSeries: SeriesSummary[], availableTeams: TeamBrief[], stageForm: StageFormState): StageNextStep | null {
  if (data.schedule?.status === "published") return null;
  if (stage.type === "group") {
    const assignedCount = data.groups.reduce((sum, group) => sum + group.teams.length, 0);
    const unassignedCount = Math.max(availableTeams.length - assignedCount, 0);
    const groupsWithEnoughTeams = data.groups.filter((group) => group.teams.length >= 2).length;
    if (data.groups.length === 0 || unassignedCount > 0 || groupsWithEnoughTeams !== data.groups.length || allSeries.length === 0) {
      return getStageNextStep(stage, data, officialStages, allSeries, availableTeams, stageForm);
    }
    return null;
  }
  if (stage.type === "swiss") {
    const hasDraftRound = data.rounds.some((round) => round.pairingStatus !== "confirmed");
    if (data.rounds.length === 0 || hasDraftRound) {
      return getStageNextStep(stage, data, officialStages, allSeries, availableTeams, stageForm);
    }
    return null;
  }
  if (stage.type === "knockout") {
    const slotSummary = getBracketSlotSummary(data.bracket);
    const readyNodes = data.bracket.filter((node) => node.winnerTeamId === null && node.radiantTeam !== null && node.direTeam !== null);
    if (data.bracket.length === 0 || slotSummary.manualOpenSlotCount > 0 || readyNodes.length > 0) {
      return getStageNextStep(stage, data, officialStages, allSeries, availableTeams, stageForm);
    }
  }
  return null;
}

function getKnockoutEntryReadiness(stage: StageSummary, data: AdminData, allSeries: SeriesSummary[], availableTeams: TeamBrief[] = []): { ready: boolean; step: StageNextStep } {
  const resultSeriesCount = countSeriesWithResult(allSeries);
  const standingsCount = data.standings.length;
  const pendingResultStep = getPendingSeriesResultStep(allSeries);

  if (stage.type === "group") {
    const expectedRegularSeriesCount = expectedGroupRegularSeriesCount(data.groups);
    const scheduledRegularSeriesCount = scheduledGroupRegularSeriesCount(allSeries);
    if (allSeries.length === 0) {
      const groupingSetupTarget = getGroupSetupTarget(data, availableTeams);
      return {
        ready: false,
        step: { icon: <CalendarClock size={16} />, title: "淘汰赛稍后生成", text: "先完成小组分组并创建小组赛对阵；这里暂不展开入围队伍配置，避免提前设置淘汰赛。", metric: "未创建预赛对阵", actionLabel: groupingSetupTarget.actionLabel, targetId: groupingSetupTarget.targetId, tone: "warn" },
      };
    }
    if (expectedRegularSeriesCount > 0 && scheduledRegularSeriesCount < expectedRegularSeriesCount) {
      return {
        ready: false,
        step: { icon: <CalendarClock size={16} />, title: "先排完小组赛对阵", text: "当前小组常规单循环还没有排满。排完所有常规对阵并补齐赛果后，再生成淘汰赛。", metric: `${scheduledRegularSeriesCount}/${expectedRegularSeriesCount} 场常规对阵`, actionLabel: "去排赛区", targetId: "group-pairing-desk", tone: "warn" },
      };
    }
    if (pendingResultStep) {
      return {
        ready: false,
        step: { ...pendingResultStep, title: "先录入小组赛果", text: `${pendingResultStep.text} 赛果补齐后，再从排名区拖入淘汰赛入围队伍。` },
      };
    }
    if (standingsCount < 2) {
      return {
        ready: false,
        step: { icon: <ShieldCheck size={16} />, title: "等待可用排名", text: "淘汰赛入围需要来自预赛排名。当前排名数据不足，先检查小组、对阵和赛果是否完整。", metric: `${standingsCount} 条排名`, actionLabel: "去排名区", targetId: "stage-series-list", tone: "warn" },
      };
    }
    return {
      ready: true,
      step: { icon: <Brackets size={16} />, title: "从小组排名生成淘汰赛", text: "预赛已有赛果。确认排名后，把晋级队伍拖入入围区生成淘汰赛对阵图。", metric: `${resultSeriesCount}/${allSeries.length} 场有赛果`, actionLabel: "去淘汰赛入口", targetId: "knockout-entry-desk", tone: "good" },
    };
  }

  if (stage.type === "swiss") {
    const draftRounds = data.rounds.filter((round) => round.pairingStatus !== "confirmed");
    const confirmedRounds = data.rounds.filter((round) => round.pairingStatus === "confirmed");
    const expectedRounds = stageConfigPositiveInteger(stage, "swissRounds");
    if (data.rounds.length === 0) {
      return {
        ready: false,
        step: { icon: <ListRestart size={16} />, title: "淘汰赛稍后生成", text: "先手动创建并确认瑞士轮配对；这里暂不展开入围区，避免在没有预赛排名时配置淘汰赛。", metric: "0 轮瑞士轮", actionLabel: "去手动配对", targetId: "swiss-pairing-desk", tone: "warn" },
      };
    }
    if (draftRounds.length > 0) {
      return {
        ready: false,
        step: { icon: <Check size={16} />, title: "先确认瑞士轮草稿", text: "还有未确认的瑞士轮草稿。确认轮次后，再录入赛果并生成淘汰赛入围。", metric: `${draftRounds.length} 轮待确认`, actionLabel: "去确认轮次", targetId: "swiss-round-lanes", tone: "warn" },
      };
    }
    if (pendingResultStep) {
      return {
        ready: false,
        step: { ...pendingResultStep, title: "先录入瑞士轮赛果", metric: `${confirmedRounds.length} 轮已确认 · ${pendingResultStep.metric}`, text: `${pendingResultStep.text} 赛果补齐后，再从排名区拖入淘汰赛入围队伍。` },
      };
    }
    if (expectedRounds !== null && confirmedRounds.length < expectedRounds) {
      return {
        ready: false,
        step: { icon: <ListRestart size={16} />, title: "继续瑞士轮配对", text: "还没有打满管理员设置的瑞士轮轮数。继续创建并确认下一轮，打满后再生成淘汰赛。", metric: `${confirmedRounds.length}/${expectedRounds} 轮已完成`, actionLabel: "去手动配对", targetId: "swiss-pairing-desk", tone: "warn" },
      };
    }
    return {
      ready: true,
      step: { icon: <Trophy size={16} />, title: "从瑞士轮排名生成淘汰赛", text: "瑞士轮已有可用赛果。确认排名后，把晋级队伍拖入入围区生成淘汰赛对阵图。", metric: `${resultSeriesCount}/${allSeries.length} 场有赛果`, actionLabel: "去淘汰赛入口", targetId: "knockout-entry-desk", tone: "good" },
    };
  }

  return {
    ready: true,
    step: { icon: <Brackets size={16} />, title: "生成淘汰赛", text: "从当前排名选择晋级队伍并生成对阵图。", metric: `${resultSeriesCount} 场有赛果`, actionLabel: "去淘汰赛入口", targetId: "knockout-entry-desk", tone: "good" },
  };
}

function countSeriesWithResult(series: SeriesSummary[]): number {
  return series.filter(seriesHasResult).length;
}

function getKnockoutWaitMetrics(stage: StageSummary, data: AdminData, allSeries: SeriesSummary[], step: StageNextStep) {
  const resultSeriesCount = countSeriesWithResult(allSeries);
  if (allSeries.length === 0) {
    return [
      { label: "当前卡点", value: stage.type === "swiss" ? "未配对" : "未排赛", emphasis: true },
      { label: stage.type === "swiss" ? "瑞士轮次" : "预赛对阵", value: stage.type === "swiss" ? String(data.rounds.length) : "0" },
      { label: "下一步", value: step.actionLabel },
    ];
  }
  if (resultSeriesCount === 0) {
    return [
      { label: "当前卡点", value: "待录赛果", emphasis: true },
      { label: "预赛对阵", value: String(allSeries.length) },
      { label: "已有赛果", value: "0" },
    ];
  }
  if (data.standings.length < 2) {
    return [
      { label: "当前卡点", value: "等排名", emphasis: true },
      { label: "已有赛果", value: `${resultSeriesCount}/${allSeries.length}` },
      { label: "排名行", value: String(data.standings.length) },
    ];
  }
  return [
    { label: "当前卡点", value: step.metric, emphasis: true },
    { label: "已有赛果", value: `${resultSeriesCount}/${allSeries.length}` },
    { label: "下一步", value: step.actionLabel },
  ];
}

function seriesHasResult(series: SeriesSummary): boolean {
  return series.status === "completed" || series.status === "result_pending" || series.radiantScore + series.direScore > 0;
}

function seriesNeedsResult(series: SeriesSummary): boolean {
  return !["cancelled", "postponed"].includes(series.status ?? "") && !seriesHasResult(series);
}

function countMissingSeriesMatchIds(series: SeriesSummary): number {
  return series.games.filter((game) => game.matchId === null || game.matchId === undefined).length;
}

function seriesPairLabel(series: SeriesSummary): string {
  return `${series.radiantTeam.name} vs ${series.direTeam.name}`;
}

function getPendingSeriesResultStep(series: SeriesSummary[]): StageNextStep | null {
  const pending = series.filter(seriesNeedsResult);
  const firstPending = pending[0];
  if (!firstPending) return null;
  return {
    icon: <ClipboardCheck size={16} />,
    title: "录入下一场赛果",
    text: `${seriesPairLabel(firstPending)} 还没有比分。先点左胜 / 平局 / 右胜，特殊情况再编辑。`,
    metric: `${pending.length} 场待补`,
    actionLabel: "去待赛果",
    targetId: seriesRowElementId(firstPending.id),
    tone: "warn",
    seriesId: firstPending.id,
    seriesFilterMode: "result",
  };
}

function getMissingSeriesMatchIdStep(series: SeriesSummary[]): StageNextStep | null {
  const missingSeries = series.filter((item) => countMissingSeriesMatchIds(item) > 0);
  const firstMissing = missingSeries[0];
  if (!firstMissing) return null;
  const missingSlotCount = countMissingSeriesMatchIds(firstMissing);
  return {
    icon: <Link2 size={16} />,
    title: "补 Dota2 match_id",
    text: `${seriesPairLabel(firstMissing)} 还有 ${missingSlotCount} 个单局 ID 可补；不影响手动赛果，但会影响比赛详情入口。`,
    metric: `${missingSeries.length} 场缺 ID`,
    actionLabel: "去缺 ID",
    targetId: seriesRowElementId(firstMissing.id),
    tone: "info",
    seriesId: firstMissing.id,
    seriesFilterMode: "match",
  };
}

function getSeriesFollowUpStep(series: SeriesSummary[], includeMatchIds: boolean): StageNextStep | null {
  return getPendingSeriesResultStep(series) ?? (includeMatchIds ? getMissingSeriesMatchIdStep(series) : null);
}

function getAfterResultFocusTarget(current: SeriesSummary, series: SeriesSummary[]): SeriesFocusTarget {
  const nextResultSeries = series
    .filter((item) => item.id !== current.id && seriesNeedsResult(item))
    .sort(compareSeriesTodoPriority)[0];
  if (nextResultSeries) return { seriesId: nextResultSeries.id, filterMode: "result" };

  const currentMissingCount = countMissingSeriesMatchIds(current);
  if (currentMissingCount > 0) return { seriesId: current.id, filterMode: "match" };

  const nextMissingMatchSeries = series
    .filter((item) => item.id !== current.id && countMissingSeriesMatchIds(item) > 0)
    .sort(compareSeriesTodoPriority)[0];
  if (nextMissingMatchSeries) return { seriesId: nextMissingMatchSeries.id, filterMode: "match" };

  return { seriesId: current.id, filterMode: "all" };
}

function getFirstMissingMatchGame(series: SeriesSummary): number | undefined {
  return series.games.find((game) => game.matchId === null || game.matchId === undefined)?.gameIndex;
}

function getAfterMatchIdFocusTarget(current: SeriesSummary, series: SeriesSummary[], gameIndex: number, willBeMissing: boolean): MatchIdFocusTarget {
  if (willBeMissing) return { seriesId: current.id, filterMode: "match", gameIndex };

  const nextCurrentMissingGame = current.games.find((game) => game.gameIndex !== gameIndex && (game.matchId === null || game.matchId === undefined));
  if (nextCurrentMissingGame) return { seriesId: current.id, filterMode: "match", gameIndex: nextCurrentMissingGame.gameIndex };

  const nextMissingSeries = series
    .filter((item) => item.id !== current.id && countMissingSeriesMatchIds(item) > 0)
    .sort(compareSeriesTodoPriority)[0];
  if (nextMissingSeries) {
    const nextGameIndex = getFirstMissingMatchGame(nextMissingSeries);
    return nextGameIndex === undefined
      ? { seriesId: nextMissingSeries.id, filterMode: "match" }
      : { seriesId: nextMissingSeries.id, filterMode: "match", gameIndex: nextGameIndex };
  }

  return { seriesId: current.id, filterMode: "all" };
}

function seriesMatchesFilterMode(series: SeriesSummary, mode: SeriesFilterMode): boolean {
  if (mode === "all") return true;
  if (mode === "result") return seriesNeedsResult(series);
  if (mode === "match") return countMissingSeriesMatchIds(series) > 0;
  return seriesNeedsResult(series) || countMissingSeriesMatchIds(series) > 0;
}

function compareSeriesTodoPriority(left: SeriesSummary, right: SeriesSummary): number {
  const leftPriority = seriesNeedsResult(left) ? 0 : countMissingSeriesMatchIds(left) > 0 ? 1 : 2;
  const rightPriority = seriesNeedsResult(right) ? 0 : countMissingSeriesMatchIds(right) > 0 ? 1 : 2;
  return leftPriority - rightPriority;
}

function seriesRowElementId(seriesId: string): string {
  return `series-row-${seriesId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function matchIdInputElementId(seriesId: string, gameIndex: number): string {
  return `match-id-input-${seriesId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${String(gameIndex).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function requestSeriesListFocus(seriesId: string | null, filterMode: SeriesFilterMode = "all") {
  window.dispatchEvent(new CustomEvent(SERIES_FOCUS_EVENT, { detail: { seriesId, filterMode } }));
  window.setTimeout(() => {
    const targetId = seriesId && document.getElementById(seriesRowElementId(seriesId)) ? seriesRowElementId(seriesId) : "stage-series-list";
    focusElementById(targetId);
  }, 120);
}

function requestMatchIdFocus(target: MatchIdFocusTarget) {
  requestSeriesListFocus(target.seriesId, target.filterMode);
  const gameIndex = target.gameIndex;
  if (gameIndex === undefined) return;
  window.setTimeout(() => {
    const input = document.getElementById(matchIdInputElementId(target.seriesId, gameIndex));
    if (input instanceof HTMLElement) input.focus({ preventScroll: true });
  }, 240);
}

function requestBracketNextFocus() {
  window.setTimeout(() => {
    window.dispatchEvent(new Event(BRACKET_NEXT_FOCUS_EVENT));
  }, 120);
  window.setTimeout(() => {
    const activeId = document.activeElement instanceof HTMLElement ? document.activeElement.id : "";
    if (!activeId.startsWith("bracket-")) focusElementById("bracket-workbench");
  }, 240);
}

function getBracketActionTargets(bracket: BracketNode[]) {
  const slotSummary = getBracketSlotSummary(bracket);
  const readyNodes = bracket.filter((node) => node.winnerTeamId === null && node.radiantTeam !== null && node.direTeam !== null);
  const completedNodes = bracket.filter((node) => node.winnerTeamId !== null);
  const firstManualOpenSlot = slotSummary.manualOpenSlots[0] ?? null;
  const firstWaitingOpenSlot = slotSummary.waitingOpenSlots[0] ?? null;
  const firstReadyNode = readyNodes[0] ?? null;
  return {
    slotSummary,
    readyNodes,
    completedNodes,
    manualOpenSlotTargetId: firstManualOpenSlot ? bracketSlotElementId(firstManualOpenSlot.nodeId, firstManualOpenSlot.slot) : "bracket-workbench",
    waitingOpenSlotTargetId: firstWaitingOpenSlot ? bracketSlotElementId(firstWaitingOpenSlot.nodeId, firstWaitingOpenSlot.slot) : "bracket-workbench",
    readyNodeTargetId: firstReadyNode ? bracketNodeElementId(firstReadyNode.id) : "bracket-workbench",
  };
}

function groupColumnElementId(groupId: string): string {
  return `group-column-${groupId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function createdSeriesIdFromResult(data: unknown): string {
  if (data && typeof data === "object" && "id" in data && typeof (data as { id?: unknown }).id === "string") {
    return (data as { id: string }).id;
  }
  return "";
}

function getStageContextSummary(stage: StageSummary, data: AdminData, allSeries: SeriesSummary[]): { title: string; metric: string } {
  const items = getStageSnapshotItems(stage, data, allSeries);
  return {
    title: items.slice(0, 2).map((item) => `${item.label}${item.value}`).join(" · "),
    metric: items.slice(2).map((item) => `${item.label}${item.value}`).join(" · "),
  };
}

function getStageSnapshotItems(stage: StageSummary, data: AdminData, allSeries: SeriesSummary[]) {
  if (stage.type === "group") {
    const assignedCount = data.groups.reduce((sum, group) => sum + group.teams.length, 0);
    const rosterCount = data.schedule?.teams.length ?? 0;
    const unassignedCount = Math.max(rosterCount - assignedCount, 0);
    return [
      { icon: <Users size={15} />, label: "分组进度", value: `${assignedCount}/${rosterCount} 队`, tone: unassignedCount === 0 && rosterCount > 0 ? "good" : "warn" },
      { icon: <Dices size={15} />, label: "小组", value: `${data.groups.length} 个`, tone: data.groups.length > 0 ? "good" : "warn" },
      { icon: <MousePointer2 size={15} />, label: "对阵", value: `${allSeries.length} 场`, tone: allSeries.length > 0 ? "info" : "warn" },
      { icon: <Trophy size={15} />, label: "排名", value: `${data.standings.length} 队`, tone: data.standings.length > 0 ? "info" : "neutral" },
    ];
  }
  if (stage.type === "swiss") {
    const confirmedRounds = data.rounds.filter((round) => round.pairingStatus === "confirmed").length;
    const draftRounds = data.rounds.length - confirmedRounds;
    return [
      { icon: <ListRestart size={15} />, label: "轮次", value: `${data.rounds.length} 轮`, tone: data.rounds.length > 0 ? "info" : "warn" },
      { icon: <CircleDot size={15} />, label: "待确认", value: `${draftRounds} 轮`, tone: draftRounds > 0 ? "warn" : "good" },
      { icon: <Check size={15} />, label: "已确认", value: `${confirmedRounds} 轮`, tone: confirmedRounds > 0 ? "good" : "neutral" },
      { icon: <Trophy size={15} />, label: "战绩", value: `${data.standings.length} 队`, tone: data.standings.length > 0 ? "info" : "neutral" },
    ];
  }
  const slotSummary = getBracketSlotSummary(data.bracket);
  const decidedNodes = data.bracket.filter((node) => node.winnerTeamId !== null).length;
  const readyNodes = data.bracket.filter((node) => node.winnerTeamId === null && node.radiantTeam !== null && node.direTeam !== null).length;
  const slotValue = slotSummary.manualOpenSlotCount > 0
    ? `${slotSummary.manualOpenSlotCount} 待补`
    : slotSummary.waitingOpenSlotCount > 0
      ? `${slotSummary.waitingOpenSlotCount} 等上游`
      : "已就绪";
  const slotTone: Tone = slotSummary.manualOpenSlotCount > 0 ? "warn" : slotSummary.waitingOpenSlotCount > 0 ? "info" : "good";
  return [
    { icon: <Brackets size={15} />, label: "节点", value: `${data.bracket.length} 个`, tone: data.bracket.length > 0 ? "info" : "warn" },
    { icon: <GripVertical size={15} />, label: "槽位", value: slotValue, tone: slotTone },
    { icon: <MousePointer2 size={15} />, label: "待判胜", value: `${readyNodes} 场`, tone: readyNodes > 0 ? "info" : "neutral" },
    { icon: <Trophy size={15} />, label: "已完成", value: `${decidedNodes}/${data.bracket.length}`, tone: data.bracket.length > 0 && decidedNodes === data.bracket.length ? "good" : "neutral" },
  ];
}

function GroupCanvas(props: {
  data: AdminData;
  availableTeams: TeamBrief[];
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resizeStageGroups: (targetCount: number) => Promise<void>;
  addTeamToGroup: (groupId: string, teamId: string) => Promise<void>;
  removeTeamFromGroup: (groupId: string, teamId: string) => Promise<void>;
  updateStageGroupName: (groupId: string, name: string) => Promise<void>;
  deleteStageGroup: (group: StageGroup) => Promise<void>;
  generateGroupRoundRobin: () => Promise<void>;
  randomizeGroups: () => Promise<void>;
  createManualSeries: CreateManualSeriesHandler;
  manualSeriesSubmitting: boolean;
}) {
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const [teamFilter, setTeamFilter] = useState("");
  const [groupPriorityOpen, setGroupPriorityOpen] = useState(false);
  const [groupBulkOpen, setGroupBulkOpen] = useState(false);
  const [groupStatusOpen, setGroupStatusOpen] = useState(false);
  const [groupToolsOpen, setGroupToolsOpen] = useState(false);
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const assignedIds = new Set(props.data.groups.flatMap((group) => group.teams.map((team) => team.id)));
  const unassigned = props.availableTeams.filter((team) => !assignedIds.has(team.id));
  const visibleUnassigned = normalizedTeamFilter ? unassigned.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : unassigned;
  const visibleGroups = props.data.groups.map((group) => ({
    ...group,
    visibleTeams: normalizedTeamFilter ? group.teams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : group.teams,
  }));
  const visibleTeamCount = visibleUnassigned.length + visibleGroups.reduce((sum, group) => sum + group.visibleTeams.length, 0);
  const assignedCount = props.data.groups.reduce((sum, group) => sum + group.teams.length, 0);
  const groupProgressPercent = props.availableTeams.length > 0 ? Math.round((assignedCount / props.availableTeams.length) * 100) : 0;
  const groupProgressLabel = props.availableTeams.length > 0 ? `${assignedCount}/${props.availableTeams.length} 已分组` : "暂无队伍";
  const groupsWithEnoughTeams = props.data.groups.filter((group) => group.teams.length >= 2).length;
  const targetGroupSize = props.data.groups.length > 0 ? Math.ceil(props.availableTeams.length / props.data.groups.length) : 0;
  const hasUnevenGroups = props.data.groups.some((group) => targetGroupSize > 0 && Math.abs(group.teams.length - targetGroupSize) > 1);
  const canGenerateSchedule = props.data.groups.length > 0 && unassigned.length === 0 && groupsWithEnoughTeams === props.data.groups.length;
  const canStartManualPairing = props.data.groups.some((group) => group.teams.length >= 2);
  const totalGroupSeriesCount = props.data.rounds.flatMap((round) => round.series).filter((series) => series.groupId).length;
  const regularGroupSeriesCount = props.data.rounds.flatMap((round) => round.series).filter((series) => series.groupId && series.seriesKind !== "tiebreaker").length;
  const roundRobinTargetCount = props.data.groups.reduce((total, group) => total + buildTeamPairDrafts(group.teams).length, 0);
  const roundRobinGroupCount = props.data.groups.filter((group) => group.teams.length >= 2).length;
  const hasRegularSeries = regularGroupSeriesCount > 0;
  const roundRobinAssistLabel = roundRobinTargetCount > 0
    ? hasRegularSeries ? `重新铺满 ${roundRobinTargetCount} 场` : `一键铺满 ${roundRobinTargetCount} 场`
    : "一键铺满单循环";
  const roundRobinButtonLabel = roundRobinTargetCount > 0
    ? hasRegularSeries ? `重新生成 ${roundRobinTargetCount} 场` : `生成 ${roundRobinTargetCount} 场`
    : hasRegularSeries ? "重新生成" : "生成全部";
  const roundRobinAssistHint = roundRobinTargetCount > 0
    ? hasRegularSeries
      ? `已有 ${regularGroupSeriesCount} 场常规对阵，将重新生成 ${roundRobinTargetCount} 场，覆盖前会二次确认。`
      : `按当前 ${roundRobinGroupCount} 个小组生成全部 BO2 常规赛，共 ${roundRobinTargetCount} 场。`
    : "至少需要一个有 2 支队伍的小组，才能生成单循环。";
  const roundRobinActionTitle = roundRobinTargetCount > 0
    ? `按当前分组生成 ${roundRobinTargetCount} 场 BO2 单循环`
    : "至少需要 2 支队伍才能生成单循环";
  const shouldPrioritizePairing = canGenerateSchedule && totalGroupSeriesCount === 0;
  const isPublished = props.data.schedule?.status === "published";
  const selectedPairingGroupId = props.stageForm.manualGroupId || props.data.groups[0]?.id || "";
  const targetGroupCount = clampInteger(props.stageForm.groupCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
  const groupCountPresets = GROUP_COUNT_PRESETS;
  const groupCountActionLabel = props.data.groups.length === 0
    ? `创建 ${targetGroupCount} 组`
    : targetGroupCount === props.data.groups.length
      ? `当前 ${props.data.groups.length} 组`
      : targetGroupCount > props.data.groups.length
        ? `补到 ${targetGroupCount} 组`
        : `缩到 ${targetGroupCount} 组`;
  const groupCountStateLabel = props.data.groups.length === 0
    ? `准备创建 ${targetGroupCount} 组`
    : targetGroupCount === props.data.groups.length
      ? `已是 ${props.data.groups.length} 组`
      : targetGroupCount > props.data.groups.length
        ? `将新增 ${targetGroupCount - props.data.groups.length} 组`
        : `将减少 ${props.data.groups.length - targetGroupCount} 组`;
  const isGroupCountUnchanged = props.data.groups.length > 0 && targetGroupCount === props.data.groups.length;
  const seriesByGroupId = props.data.rounds
    .flatMap((round) => round.series)
    .reduce((map, series) => {
      if (series.groupId) map.set(series.groupId, (map.get(series.groupId) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
  const selectGroupForPairing = (group: StageGroup) => {
    props.setStageForm((current) => ({
      ...current,
      manualGroupId: group.id,
      manualRadiantTeamId: group.teams.length === 2 ? group.teams[0]?.id ?? "" : "",
      manualDireTeamId: group.teams.length === 2 ? group.teams[1]?.id ?? "" : "",
    }));
  };
  const blockerText = props.data.groups.length === 0
    ? "先添加小组"
    : unassigned.length > 0
      ? `还有 ${unassigned.length} 支队伍未分组`
      : groupsWithEnoughTeams !== props.data.groups.length
        ? "每个小组至少需要 2 支队伍"
        : "可以生成 BO2 单循环";
  const firstUnderfilledGroup = props.data.groups.find((group) => group.teams.length < 2) ?? null;
  const groupFocus = props.data.groups.length === 0
    ? { tone: "warn", icon: <Plus size={16} />, title: "先创建小组", text: "可以先选 1 组，也可以选 2/3/4/5/6 组或自定义数量；系统只建空小组，不自动分队。", actionLabel: "选择小组数量", targetId: "group-count-control" }
    : unassigned.length > 0
      ? { tone: "warn", icon: <Users size={16} />, title: "把队伍拖进目标小组", text: `还有 ${unassigned.length} 支队伍在未分组池。先完成拖拽分组，再排赛。`, actionLabel: "去拖队伍", targetId: "group-unassigned-tray" }
      : groupsWithEnoughTeams !== props.data.groups.length
        ? { tone: "warn", icon: <ShieldCheck size={16} />, title: "检查每个小组人数", text: "至少 2 支队伍的小组才能手动排赛或生成单循环。", actionLabel: "检查小组", targetId: firstUnderfilledGroup ? groupColumnElementId(firstUnderfilledGroup.id) : "group-drag-canvas" }
      : { tone: "good", icon: <MousePointer2 size={16} />, title: "分组完成，开始排赛", text: "排赛板可以逐场拖两支队伍，也可以一键生成完整 BO2 单循环；随机分组只留在分组辅助里。", actionLabel: "去手动排赛", targetId: "group-pairing-desk" };
  const groupFocusActionDisabled = groupFocus.targetId === "group-pairing-desk" && !canStartManualPairing;
  const groupWorkbenchClass = ["canvas-section", "group-workbench", shouldPrioritizePairing ? "is-pairing-priority" : ""].filter(Boolean).join(" ");
  const pairingDesk = (
    <GroupPairingDesk
      groups={props.data.groups}
      rounds={props.data.rounds}
      stageForm={props.stageForm}
      setStageForm={props.setStageForm}
      createManualSeries={props.createManualSeries}
      generateGroupRoundRobin={props.generateGroupRoundRobin}
      canGenerateRoundRobin={canGenerateSchedule}
      regularSeriesCount={regularGroupSeriesCount}
      disabled={isPublished || props.manualSeriesSubmitting}
      isSubmitting={props.manualSeriesSubmitting}
      showBulkAssist={!shouldPrioritizePairing}
      showDirectWriteAssist={!shouldPrioritizePairing}
    />
  );
  const groupBulkAssistPanel = (
    <details className="group-priority-assist-panel" onToggle={(event) => setGroupBulkOpen(event.currentTarget.open)}>
      <summary><span>完整单循环辅助</span><strong>{roundRobinAssistLabel}</strong></summary>
      {groupBulkOpen ? (
      <div className={hasRegularSeries ? "pairing-fast-action is-caution is-assist" : "pairing-fast-action is-assist"}>
        <div>
          <span>批量排赛</span>
          <strong>{roundRobinAssistLabel}</strong>
          <small>{roundRobinAssistHint}</small>
        </div>
        <button type="button" onClick={() => void props.generateGroupRoundRobin()} disabled={isPublished || !canGenerateSchedule} title={roundRobinActionTitle}>
          <CalendarClock size={15} /> {roundRobinButtonLabel}
        </button>
      </div>
      ) : null}
    </details>
  );
  const usedGroupNames = new Set(props.data.groups.map((group) => group.name.trim()).filter(Boolean));
  const requestedGroupName = props.stageForm.groupName.trim();
  const suggestedGroupName = nextAvailableGroupName(usedGroupNames, props.data.groups.length);
  const displayedGroupName = requestedGroupName && !usedGroupNames.has(requestedGroupName) ? props.stageForm.groupName : suggestedGroupName;
  const groupNameInputTitle = displayedGroupName !== props.stageForm.groupName
    ? `当前名称已存在，提交时会创建 ${displayedGroupName}`
    : `将创建 ${displayedGroupName || "新小组"}`;
  const groupCreateForm = (
    <form className="inline-group-form" onSubmit={(event) => void props.createGroup(event)}>
      <label>新增小组<input value={displayedGroupName} onChange={(event) => patch({ groupName: event.target.value })} disabled={isPublished} title={groupNameInputTitle} aria-label="新增小组名称" /></label>
      <button type="submit" disabled={isPublished || displayedGroupName.trim().length === 0} title={groupNameInputTitle}><Plus size={15} /> 添加 {displayedGroupName}</button>
    </form>
  );
  const groupCountQuick = (id: string, extraClass = "", showPairingAction = true) => (
    <div id={id} tabIndex={-1} className={["group-count-quick", extraClass, showPairingAction ? "" : "without-pairing-action"].filter(Boolean).join(" ")}>
      <div className="group-count-quick-copy">
        <span>目标组数</span>
        <strong>{groupCountStateLabel}</strong>
      </div>
      <div className="group-count-presets compact" aria-label="目标小组数快捷选择">
        {groupCountPresets.map((count) => <button key={count} type="button" className={targetGroupCount === count ? "is-active" : ""} onClick={() => patch({ groupCount: count })} disabled={isPublished} aria-label={`设置为 ${count} 组`}>{count}组</button>)}
      </div>
      <label className="group-count-custom"><span>自定义</span><input aria-label="自定义小组数量" type="number" min={MIN_GROUP_COUNT} max={MAX_GROUP_COUNT} value={props.stageForm.groupCount} onChange={(event) => patch({ groupCount: clampInteger(Number(event.target.value), MIN_GROUP_COUNT, MAX_GROUP_COUNT) })} disabled={isPublished} /></label>
      {isGroupCountUnchanged
        ? <strong className="group-count-current-state">{groupCountActionLabel}</strong>
        : <button type="button" onClick={() => void props.resizeStageGroups(targetGroupCount)} disabled={isPublished}>{groupCountActionLabel}</button>}
      {showPairingAction ? <button type="button" className="secondary-button" onClick={() => focusElementById("group-pairing-desk")} disabled={!canStartManualPairing}><MousePointer2 size={15} /> 排赛</button> : null}
    </div>
  );
  const groupCommandStrip = (groupCountControlId = "group-count-control", showPairingAction = true, showFocusAction = true) => (
    <div className="group-command-strip">
      <div className={["group-command-status", `is-${groupFocus.tone}`, showFocusAction ? "" : "without-next-action"].filter(Boolean).join(" ")}>
        <span>{groupFocus.icon}</span>
        <div>
          <strong>{groupFocus.title}</strong>
          <small>{blockerText}</small>
          <div className="group-command-progress" aria-label={groupProgressLabel}>
            <i><b style={{ width: `${groupProgressPercent}%` }} /></i>
            <span>{groupProgressLabel}</span>
          </div>
        </div>
        {showFocusAction ? <button type="button" className="group-command-next-action" onClick={() => focusElementById(groupFocus.targetId)} disabled={groupFocusActionDisabled}>{groupFocus.actionLabel}</button> : null}
      </div>
      <div className="group-filter-bar is-command">
        <label><Search size={14} /><span>查找</span><input value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} placeholder="队名或缩写" /></label>
        <strong>{normalizedTeamFilter ? `${visibleTeamCount}/${props.availableTeams.length}` : `${props.availableTeams.length} 支`}</strong>
        {normalizedTeamFilter ? <button type="button" onClick={() => setTeamFilter("")}>清除</button> : null}
      </div>
      {groupCountQuick(groupCountControlId, "", showPairingAction)}
    </div>
  );
  const groupPriorityFilterBar = (
    <div className="group-priority-filter-bar">
      <label><Search size={14} /><span>查找队伍</span><input value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} placeholder="队名或缩写" /></label>
      <strong>{normalizedTeamFilter ? `${visibleTeamCount}/${props.availableTeams.length}` : `${props.availableTeams.length} 支队伍`}</strong>
      {normalizedTeamFilter ? <button type="button" onClick={() => setTeamFilter("")}>清除</button> : null}
    </div>
  );
  const groupDragCanvas = (
    <div id="group-drag-canvas" tabIndex={-1} className="drag-canvas group-canvas">
      <TeamTray
        id="group-unassigned-tray"
        teams={visibleUnassigned}
        totalCount={unassigned.length}
        title="未分组队伍"
        emptyText={props.availableTeams.length === 0 ? "当前届次暂无队伍" : normalizedTeamFilter ? "未分组池无匹配队伍" : "所有队伍都已进入小组；拖回这里可取消分组"}
        dropId="group-pool"
        dropHint="拖回这里取消分组"
      />
      <div className="group-columns">{visibleGroups.length === 0 ? <EmptyPanel title="还没有小组" text="在上方输入小组名并添加；创建预赛草稿时也可以一次性创建多个空小组。" /> : visibleGroups.map((group) => (
        <DroppableGroup
          key={group.id}
          group={group}
          visibleTeams={group.visibleTeams}
          emptyText={normalizedTeamFilter ? "本组无匹配队伍" : "拖到这里"}
          targetSize={targetGroupSize}
          seriesCount={seriesByGroupId.get(group.id) ?? 0}
          isPairingSelected={group.id === selectedPairingGroupId}
          removeTeamFromGroup={props.removeTeamFromGroup}
          updateStageGroupName={props.updateStageGroupName}
          deleteStageGroup={props.deleteStageGroup}
          selectGroupForPairing={selectGroupForPairing}
        />
      ))}</div>
    </div>
  );
  const groupStatusDrawer = (
    <details className="group-status-drawer" onToggle={(event) => setGroupStatusOpen(event.currentTarget.open)}>
      <summary>
        <span>分组状态与下一步</span>
        <strong>{assignedCount}/{props.availableTeams.length} 已分组 · {props.data.groups.length} 组</strong>
      </summary>
      {groupStatusOpen ? (
        <>
          <div className="group-summary-strip">
            <GroupSummaryMetric label="已分组" value={`${assignedCount}/${props.availableTeams.length}`} tone={unassigned.length === 0 ? "good" : "warn"} />
            <GroupSummaryMetric label="小组数" value={`${props.data.groups.length}`} tone={props.data.groups.length > 0 ? "good" : "warn"} />
            <GroupSummaryMetric label="可生成小组" value={`${groupsWithEnoughTeams}/${props.data.groups.length}`} tone={groupsWithEnoughTeams === props.data.groups.length && props.data.groups.length > 0 ? "good" : "warn"} />
            <GroupSummaryMetric label="下一步" value={blockerText} tone={canGenerateSchedule ? "good" : "warn"} />
          </div>
          <div className={`group-focus-strip is-${groupFocus.tone}`}>
            <span className="group-focus-icon">{groupFocus.icon}</span>
            <div>
              <strong>{groupFocus.title}</strong>
              <small>{groupFocus.text}</small>
            </div>
            {groupFocus.actionLabel && !shouldPrioritizePairing ? <button type="button" onClick={() => focusElementById(groupFocus.targetId)} disabled={groupFocusActionDisabled}>{groupFocus.actionLabel}</button> : null}
          </div>
        </>
      ) : null}
    </details>
  );
  const groupToolsDrawer = (
    <details id="group-tools-drawer" tabIndex={-1} className="group-tools-drawer" onToggle={(event) => setGroupToolsOpen(event.currentTarget.open)}>
      <summary>随机分组辅助</summary>
      {groupToolsOpen ? (
        <div className="group-assist-strip">
          <div>
            <strong>随机分组辅助</strong>
            <small>这是可选捷径，不会替代手动分组；生成后仍可继续选择或拖拽调整。</small>
          </div>
          <div className="group-count-presets compact" aria-label="随机分组小组数快捷选择">
            {groupCountPresets.map((count) => <button key={count} type="button" className={props.stageForm.groupCount === count ? "is-active" : ""} onClick={() => patch({ groupCount: count })} disabled={isPublished}>{count} 组</button>)}
          </div>
          <label>小组数<input type="number" min={MIN_GROUP_COUNT} max={MAX_GROUP_COUNT} value={props.stageForm.groupCount} onChange={(event) => patch({ groupCount: clampInteger(Number(event.target.value), MIN_GROUP_COUNT, MAX_GROUP_COUNT) })} disabled={isPublished} /></label>
          <label>每组人数<input type="number" min={0} value={props.stageForm.groupSize} onChange={(event) => patch({ groupSize: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} disabled={isPublished} /></label>
          <button type="button" onClick={() => void props.randomizeGroups()} disabled={isPublished || props.availableTeams.length < 2}><Dices size={15} /> 随机分组</button>
        </div>
      ) : null}
    </details>
  );
  const groupAssignmentPanel = (
    <GroupAssignmentPanel
      groups={props.data.groups}
      teams={props.availableTeams}
      addTeamToGroup={props.addTeamToGroup}
      removeTeamFromGroup={props.removeTeamFromGroup}
      disabled={isPublished}
    />
  );
  const groupWarning = hasUnevenGroups ? <div className="group-warning"><ShieldCheck size={15} /> 小组人数不太均衡，可以继续拖拽微调；如这是刻意安排，也可以照常维护对阵。</div> : null;
  return (
    <div id="group-workbench" tabIndex={-1} className={groupWorkbenchClass}>
      {!shouldPrioritizePairing ? <div className="canvas-toolbar group-toolbar">
        <div>
          <strong>拖拽分组工作台</strong>
          <small>先拖队伍进组，再到排赛板创建对阵；随机分组在下方辅助区。</small>
        </div>
        <div className="group-toolbar-actions">{groupCreateForm}</div>
      </div> : null}
      {!shouldPrioritizePairing ? groupCommandStrip("group-count-control") : null}
      {shouldPrioritizePairing ? pairingDesk : null}
      {shouldPrioritizePairing ? groupCountQuick("group-count-control", "is-priority-inline", false) : null}
      {shouldPrioritizePairing ? (
        <details id="group-priority-details" tabIndex={-1} className="group-priority-details" open={groupPriorityOpen} onToggle={(event) => setGroupPriorityOpen(event.currentTarget.open)}>
          <summary><span>{groupPriorityOpen ? "收起：调整分组 / 批量排赛" : "调整分组 / 批量排赛"}</span><strong>{props.data.groups.length} 组 · {groupProgressLabel} · 展开可拖拽换组</strong></summary>
          {groupPriorityOpen ? (
            <>
              <div className="group-priority-create">{groupCreateForm}</div>
              {groupPriorityFilterBar}
              <div id="group-priority-canvas" tabIndex={-1} className="group-priority-canvas">{groupDragCanvas}</div>
              {groupBulkAssistPanel}
              {groupStatusDrawer}
              {groupToolsDrawer}
              {groupAssignmentPanel}
              {groupWarning}
            </>
          ) : null}
        </details>
      ) : null}
      {!shouldPrioritizePairing ? groupDragCanvas : null}
      {!shouldPrioritizePairing ? groupStatusDrawer : null}
      {!shouldPrioritizePairing ? groupToolsDrawer : null}
      {!shouldPrioritizePairing ? groupAssignmentPanel : null}
      {!shouldPrioritizePairing ? groupWarning : null}
      {!shouldPrioritizePairing ? <div className="group-schedule-strip">
        <div>
          <strong>分组确认后，再创建对阵</strong>
          <small>推荐在下方手动排赛板逐场添加；如果确定要完整单循环，才使用自动生成。</small>
        </div>
        <button type="button" className="secondary-button" onClick={() => focusElementById("group-pairing-desk")} disabled={!canStartManualPairing}><MousePointer2 size={15} /> 手动添加对阵</button>
      </div> : null}
      {!shouldPrioritizePairing ? pairingDesk : null}
    </div>
  );
}

function GroupAssignmentPanel(props: {
  groups: StageGroup[];
  teams: TeamBrief[];
  addTeamToGroup: (groupId: string, teamId: string) => Promise<void>;
  removeTeamFromGroup: (groupId: string, teamId: string) => Promise<void>;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const groupByTeamId = new Map<string, StageGroup>();
  props.groups.forEach((group) => group.teams.forEach((team) => groupByTeamId.set(team.id, group)));
  const assignedCount = props.teams.filter((team) => groupByTeamId.has(team.id)).length;
  const unassignedCount = Math.max(props.teams.length - assignedCount, 0);
  const moveTeam = (teamId: string, nextGroupId: string) => {
    const currentGroupId = groupByTeamId.get(teamId)?.id ?? "";
    if (nextGroupId === currentGroupId) return;
    if (!nextGroupId) {
      if (currentGroupId) void props.removeTeamFromGroup(currentGroupId, teamId);
      return;
    }
    void props.addTeamToGroup(nextGroupId, teamId);
  };

  return (
    <details id="group-assignment-panel" tabIndex={-1} className="manual-group-assign" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <div className="manual-group-assign-copy">
          <strong>下拉精确修正</strong>
          <small>拖拽之外，单独修正某支队伍。</small>
        </div>
        <span>{assignedCount}/{props.teams.length} 已分组 · {unassignedCount} 未分组</span>
      </summary>
      {isOpen ? <div className="group-assignment-grid">
        {props.teams.length === 0 ? <div className="drop-placeholder compact">当前届次暂无可分组队伍</div> : null}
        {props.teams.map((team) => {
          const currentGroup = groupByTeamId.get(team.id);
          return (
            <label key={team.id} className="group-assignment-row">
              <span className="group-assignment-team"><span style={{ background: team.color }} /> <strong>{team.name}</strong><small>{currentGroup?.name ?? "未分组"}</small></span>
              <select value={currentGroup?.id ?? ""} onChange={(event) => moveTeam(team.id, event.target.value)} disabled={props.disabled || props.groups.length === 0}>
                <option value="">未分组</option>
                {props.groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.teams.length} 队</option>)}
              </select>
            </label>
          );
        })}
      </div> : null}
    </details>
  );
}

function GroupSummaryMetric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" }) {
  return <div className={`group-summary-card is-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function TeamTray({ id, teams, title, emptyText = "暂无可拖拽队伍", dropId, dropHint, totalCount, onPickTeam, actionLabel }: { id?: string | undefined; teams: TeamBrief[]; title: string; emptyText?: string; dropId?: string; dropHint?: string; totalCount?: number; onPickTeam?: ((teamId: string) => void) | undefined; actionLabel?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: dropId ?? "team-tray-disabled", disabled: !dropId });
  const className = ["team-tray", dropId ? "is-droppable" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ");
  const countText = totalCount !== undefined && totalCount !== teams.length ? `${teams.length}/${totalCount} 队` : `${teams.length} 队`;
  return <div id={id} ref={setNodeRef} tabIndex={id ? -1 : undefined} className={className}><div className="tray-title"><GripVertical size={15} /><span>{title}</span><small>{countText}</small></div>{dropHint ? <div className="tray-drop-hint">{dropHint}</div> : null}<div className="tray-list">{teams.length === 0 ? <div className="drop-placeholder compact">{emptyText}</div> : null}{teams.map((team) => <DraggableTeam key={team.id} team={team} onClick={onPickTeam ? () => onPickTeam(team.id) : undefined} {...(actionLabel ? { actionLabel } : {})} />)}</div></div>;
}

function DraggableTeam({ team, dragId, source, disabled = false, onClick, recommended = false, recommendedLabel = "推荐", actionLabel = "填入", compactAction = false, dragOnlyLabel }: { team: TeamBrief; dragId?: string; source?: TeamDragSource; disabled?: boolean; onClick?: (() => void) | undefined; recommended?: boolean; recommendedLabel?: string | undefined; actionLabel?: string; compactAction?: boolean; dragOnlyLabel?: string }) {
  const dragData: TeamDragData = source
    ? { type: "team", teamId: team.id, label: team.name, color: team.color, source }
    : { type: "team", teamId: team.id, label: team.name, color: team.color };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId ?? `team:${team.id}`, data: dragData, disabled });
  const style: React.CSSProperties | undefined = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const className = ["team-chip", onClick ? "is-click-fill" : "", recommended ? "is-recommended" : "", isDragging ? "is-dragging" : ""].filter(Boolean).join(" ");
  const chipLabel = onClick ? `拖拽或点击${actionLabel} ${team.name}${recommended ? `，${recommendedLabel}` : ""}` : dragOnlyLabel ?? team.name;
  return <button ref={setNodeRef} style={style} className={className} type="button" disabled={disabled} onClick={onClick} title={chipLabel} aria-label={chipLabel} {...listeners} {...attributes}><GripVertical className="team-chip-grip" size={13} aria-hidden="true" /><span className="team-chip-color" style={{ background: team.color }} /><span className="team-chip-name">{team.name}</span>{recommended ? <span className="team-chip-badge">{recommendedLabel}</span> : null}{onClick ? <TeamChipAction label={actionLabel} iconOnly={compactAction || (recommended && actionLabel === "填入")} /> : null}</button>;
}

function DroppableGroup({
  group,
  visibleTeams,
  emptyText = "拖到这里",
  targetSize,
  seriesCount,
  isPairingSelected,
  removeTeamFromGroup,
  updateStageGroupName,
  deleteStageGroup,
  selectGroupForPairing,
}: {
  group: StageGroup;
  visibleTeams?: TeamBrief[];
  emptyText?: string;
  targetSize: number;
  seriesCount: number;
  isPairingSelected: boolean;
  removeTeamFromGroup: (groupId: string, teamId: string) => Promise<void>;
  updateStageGroupName: (groupId: string, name: string) => Promise<void>;
  deleteStageGroup: (group: StageGroup) => Promise<void>;
  selectGroupForPairing: (group: StageGroup) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const displayTeams = visibleTeams ?? group.teams;
  const teamCountText = visibleTeams && visibleTeams.length !== group.teams.length ? `${visibleTeams.length}/${group.teams.length} 队` : `${group.teams.length} 队`;
  useEffect(() => {
    setDraftName(group.name);
  }, [group.name]);
  const { isOver, setNodeRef } = useDroppable({ id: `group:${group.id}` });
  const saveName = () => {
    setIsEditing(false);
    if (draftName.trim() !== group.name) void updateStageGroupName(group.id, draftName);
  };
  const status = group.teams.length < 2
    ? { tone: "warn", label: "至少 2 队" }
    : targetSize > 0 && Math.abs(group.teams.length - targetSize) > 1
      ? { tone: "warn", label: "人数偏差" }
      : { tone: "good", label: "可生成" };
  return (
    <section id={groupColumnElementId(group.id)} ref={setNodeRef} tabIndex={-1} className={["group-column", isOver ? "is-over" : "", isPairingSelected ? "is-pairing-selected" : ""].filter(Boolean).join(" ")}>
      <div className="group-column-head">
        {isEditing ? <input value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={saveName} onKeyDown={(event) => {
          if (event.key === "Enter") saveName();
          if (event.key === "Escape") {
            setDraftName(group.name);
            setIsEditing(false);
          }
        }} autoFocus /> : <strong>{group.name}</strong>}
        <small>{teamCountText} · {seriesCount} 场对阵 · {targetSize > 0 ? `建议 ${targetSize}` : "待分组"}</small>
        <span className={`group-health is-${status.tone}`}>{status.label}</span>
        <div className="group-column-actions">
          <button type="button" className={isPairingSelected ? "is-active" : ""} onClick={() => selectGroupForPairing(group)} disabled={group.teams.length < 2}>{isPairingSelected ? "正在排赛" : "排这个组"}</button>
          {isEditing ? <button type="button" onClick={saveName}>保存</button> : <button type="button" onClick={() => setIsEditing(true)}>重命名</button>}
          <button className="ghost-danger" type="button" onClick={() => void deleteStageGroup(group)}>删除</button>
        </div>
      </div>
      <div className="group-team-list">{displayTeams.length === 0 ? <div className="drop-placeholder">{emptyText}</div> : null}{displayTeams.map((team) => <div key={team.id} className="assigned-team"><DraggableTeam team={team} source={{ kind: "group", groupId: group.id }} /><button type="button" className="assigned-team-remove" onClick={() => void removeTeamFromGroup(group.id, team.id)}>移出</button></div>)}</div>
    </section>
  );
}

function GroupPairingDesk(props: {
  groups: StageGroup[];
  rounds: StageRound[];
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createManualSeries: CreateManualSeriesHandler;
  generateGroupRoundRobin: () => Promise<void>;
  canGenerateRoundRobin: boolean;
  regularSeriesCount: number;
  disabled: boolean;
  isSubmitting: boolean;
  showBulkAssist?: boolean;
  showDirectWriteAssist?: boolean;
}) {
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const [teamFilter, setTeamFilter] = useState("");
  const [assistDrawerOpen, setAssistDrawerOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const selectedGroupId = props.stageForm.manualGroupId || props.groups[0]?.id || "";
  const selectedGroup = props.groups.find((group) => group.id === selectedGroupId) ?? props.groups[0] ?? null;
  const candidateTeams = selectedGroup?.teams ?? [];
  const radiantTeam = candidateTeams.find((team) => team.id === props.stageForm.manualRadiantTeamId) ?? null;
  const direTeam = candidateTeams.find((team) => team.id === props.stageForm.manualDireTeamId) ?? null;
  const selectedIds = new Set([props.stageForm.manualRadiantTeamId, props.stageForm.manualDireTeamId].filter(Boolean));
  const poolTeams = candidateTeams.filter((team) => !selectedIds.has(team.id));
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const visiblePoolTeams = normalizedTeamFilter ? poolTeams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : poolTeams;
  const selectedGroupSeries = props.rounds.flatMap((round) => round.series).filter((series) => series.groupId === selectedGroupId);
  const selectedGroupSeriesCount = selectedGroupSeries.length;
  const regularPairDrafts = buildTeamPairDrafts(candidateTeams);
  const scheduledRegularPairKeys = new Set(selectedGroupSeries.filter((series) => series.seriesKind !== "tiebreaker").map(seriesPairKey));
  const missingRegularPairs = regularPairDrafts.filter((pair) => !scheduledRegularPairKeys.has(teamPairKey(pair.left.id, pair.right.id)));
  const scheduledRegularPairCount = Math.max(regularPairDrafts.length - missingRegularPairs.length, 0);
  const roundRobinTargetCount = props.groups.reduce((total, group) => total + buildTeamPairDrafts(group.teams).length, 0);
  const roundRobinGroupCount = props.groups.filter((group) => group.teams.length >= 2).length;
  const nextRegularPair = missingRegularPairs[0] ?? null;
  const nextGroupPairSuggestion = findNextGroupRegularPairSuggestion(props.groups, props.rounds, selectedGroupId);
  const nextOtherGroupPairSuggestion = nextGroupPairSuggestion?.group.id !== selectedGroupId ? nextGroupPairSuggestion : null;
  const nextRegularPairTeamIds = new Set([nextRegularPair?.left.id, nextRegularPair?.right.id].filter((id): id is string => Boolean(id)));
  const regularProgressLabel = regularPairDrafts.length === 0
    ? "常规待分组"
    : missingRegularPairs.length === 0
      ? "常规已排满"
      : `常规 ${scheduledRegularPairCount}/${regularPairDrafts.length}`;
  const nextRegularPairLabel = nextRegularPair ? `${nextRegularPair.left.name} vs ${nextRegularPair.right.name}` : "当前小组常规对阵已排满";
  const nextOtherGroupPairLabel = nextOtherGroupPairSuggestion ? `${nextOtherGroupPairSuggestion.pair.left.name} vs ${nextOtherGroupPairSuggestion.pair.right.name}` : "";
  const roundLabel = props.stageForm.manualRoundId
    ? props.rounds.find((round) => round.id === props.stageForm.manualRoundId)?.name ?? "已选轮次"
    : props.stageForm.manualRoundName.trim() || "新建轮次";
  const isTiebreakerMode = props.stageForm.manualSeriesKind === "tiebreaker";
  const kindLabel = isTiebreakerMode ? "加赛 · 不计积分" : "常规赛 · 计入积分";
  const timeLabel = formatDate(props.stageForm.manualScheduledAt);
  const duplicateRegularSeries = radiantTeam && direTeam
    ? selectedGroupSeries.find((series) => series.seriesKind !== "tiebreaker" && isSameSeriesPair(series, radiantTeam.id, direTeam.id))
    : undefined;
  const blocksDuplicateRegular = !isTiebreakerMode && duplicateRegularSeries !== undefined;
  const canCreate = !props.disabled && !blocksDuplicateRegular && Boolean(selectedGroupId && radiantTeam && direTeam && radiantTeam.id !== direTeam.id);
  const hasRegularSeries = props.regularSeriesCount > 0;
  const canFillNextRegularPair = !props.disabled && !isTiebreakerMode && nextRegularPair !== null && !radiantTeam && !direTeam;
  const canJumpToNextGroupPair = !props.disabled && !isTiebreakerMode && nextOtherGroupPairSuggestion !== null && !radiantTeam && !direTeam;
  const canGuideNextRegularPairSides = !props.disabled && !isTiebreakerMode && nextRegularPair !== null && (!radiantTeam || radiantTeam.id === nextRegularPair.left.id) && (!direTeam || direTeam.id === nextRegularPair.right.id) && (!radiantTeam || !direTeam);
  const recommendedPairPickTargets = canGuideNextRegularPairSides && nextRegularPair
    ? new Map<string, ManualSeriesTeamSlotTarget>([[nextRegularPair.left.id, "radiant"], [nextRegularPair.right.id, "dire"]])
    : undefined;
  const recommendedPairLabels = canGuideNextRegularPairSides && nextRegularPair
    ? new Map<string, string>([[nextRegularPair.left.id, "推荐"], [nextRegularPair.right.id, "推荐"]])
    : undefined;
  const recommendedRadiantSlotTeam = canGuideNextRegularPairSides && nextRegularPair && !radiantTeam ? nextRegularPair.left : null;
  const recommendedDireSlotTeam = canGuideNextRegularPairSides && nextRegularPair && !direTeam ? nextRegularPair.right : null;
  const selectedGroupRegularDone = !isTiebreakerMode && regularPairDrafts.length > 0 && missingRegularPairs.length === 0;
  const canOfferTiebreakerMode = !props.disabled && selectedGroupRegularDone && !radiantTeam && !direTeam;
  const canStartTiebreakerMode = canOfferTiebreakerMode && !nextOtherGroupPairSuggestion;
  const shouldShowPairingHead = props.groups.length !== 1;
  const selectedSlotCount = [radiantTeam, direTeam].filter(Boolean).length;
  const poolPickActionLabel = getNextSlotActionLabel(radiantTeam, direTeam);
  const canPickPoolTeam = !radiantTeam || !direTeam;
  const hasManualSeriesDetails = Boolean(
    props.stageForm.manualRoundId ||
    props.stageForm.manualRoundName.trim() ||
    props.stageForm.manualScheduledAt.trim() ||
    props.stageForm.manualSeriesKind !== "regular",
  );
  const shouldShowDetailsDrawer = selectedSlotCount > 0 || hasManualSeriesDetails;
  const pairingStatus = !selectedGroup
    ? { tone: "warn", icon: <Plus size={15} />, title: "先创建小组", text: "可以是一组或多组，创建后再拖队伍排赛。" }
    : candidateTeams.length < 2
      ? { tone: "warn", icon: <Users size={15} />, title: "这个小组还不能排赛", text: "至少把 2 支队伍拖入当前小组。" }
      : !radiantTeam && !direTeam
        ? { tone: "info", icon: <MousePointer2 size={15} />, title: "拖入两支队伍", text: "从队伍池拖到左侧和右侧，或直接点击队伍；队伍池会提示先放哪一侧。" }
      : !radiantTeam || !direTeam
        ? { tone: "warn", icon: <MousePointer2 size={15} />, title: "还差一支队伍", text: `再拖或点击一支队伍放到${radiantTeam ? "右侧" : "左侧"}，就可以创建 BO2。` }
        : blocksDuplicateRegular
          ? { tone: "warn", icon: <ShieldCheck size={15} />, title: "这两队已有常规对阵", text: "如果是同分加赛，直接点“改为加赛”；常规赛请编辑已有对阵。" }
          : { tone: "good", icon: <ShieldCheck size={15} />, title: "可以创建对阵", text: `${radiantTeam.name} vs ${direTeam.name} · ${roundLabel}` };
  const selectGroup = (groupId: string) => {
    const group = props.groups.find((item) => item.id === groupId);
    props.setStageForm((current) => ({
      ...current,
      manualGroupId: groupId,
      manualRadiantTeamId: group?.teams.length === 2 ? group.teams[0]?.id ?? "" : "",
      manualDireTeamId: group?.teams.length === 2 ? group.teams[1]?.id ?? "" : "",
    }));
  };
  const fillNextRegularPair = () => {
    if (!nextRegularPair) return;
    props.setStageForm((current) => ({
      ...current,
      manualSeriesKind: "regular",
      manualRadiantTeamId: nextRegularPair.left.id,
      manualDireTeamId: nextRegularPair.right.id,
    }));
    focusElementByIdAfterRender("group-pairing-primary-action");
  };
  const createNextRegularPair = () => {
    if (!nextRegularPair || !selectedGroupId) return;
    void props.createManualSeries({
      manualGroupId: selectedGroupId,
      manualSeriesKind: "regular",
      manualRadiantTeamId: nextRegularPair.left.id,
      manualDireTeamId: nextRegularPair.right.id,
    });
  };
  const createNextRegularPairWithConfirm = () => {
    if (!nextRegularPair) return;
    if (!window.confirm(`跳过左侧 / 右侧检查，直接写入 ${nextRegularPairLabel} 的 BO2 草稿？`)) return;
    createNextRegularPair();
  };
  const pickPoolTeamForPairing = (teamId: string, target?: ManualSeriesTeamSlotTarget) => {
    if (target) {
      moveManualSeriesDraftTeam(target, teamId, props.setStageForm);
      focusElementByIdAfterRender(getManualPickFocusTarget(radiantTeam, direTeam, target, "group-pairing-primary-action", "group-pairing-radiant-slot", "group-pairing-dire-slot"));
      return;
    }
    pickManualSeriesTeam(teamId, props.setStageForm);
    focusElementByIdAfterRender(getManualPickFocusTarget(radiantTeam, direTeam, undefined, "group-pairing-primary-action", "group-pairing-radiant-slot", "group-pairing-dire-slot"));
  };
  const jumpToNextGroupPair = () => {
    if (!nextOtherGroupPairSuggestion) return;
    props.setStageForm((current) => ({
      ...current,
      manualGroupId: nextOtherGroupPairSuggestion.group.id,
      manualSeriesKind: "regular",
      manualRadiantTeamId: nextOtherGroupPairSuggestion.pair.left.id,
      manualDireTeamId: nextOtherGroupPairSuggestion.pair.right.id,
    }));
    setTeamFilter("");
    focusElementByIdAfterRender("group-pairing-primary-action");
  };
  const createNextGroupPair = () => {
    if (!nextOtherGroupPairSuggestion) return;
    void props.createManualSeries({
      manualGroupId: nextOtherGroupPairSuggestion.group.id,
      manualSeriesKind: "regular",
      manualRadiantTeamId: nextOtherGroupPairSuggestion.pair.left.id,
      manualDireTeamId: nextOtherGroupPairSuggestion.pair.right.id,
    });
  };
  const createNextGroupPairWithConfirm = () => {
    if (!nextOtherGroupPairSuggestion) return;
    if (!window.confirm(`跳过左侧 / 右侧检查，直接切到 ${nextOtherGroupPairSuggestion.group.name} 并写入 ${nextOtherGroupPairLabel} 的 BO2 草稿？`)) return;
    createNextGroupPair();
  };
  const startTiebreakerMode = () => {
    props.setStageForm((current) => ({
      ...current,
      manualSeriesKind: "tiebreaker",
      manualRadiantTeamId: "",
      manualDireTeamId: "",
    }));
    setTeamFilter("");
    focusElementByIdAfterRender("group-pairing-desk");
  };
  const returnToRegularMode = () => {
    props.setStageForm((current) => ({
      ...current,
      manualSeriesKind: "regular",
      manualRadiantTeamId: "",
      manualDireTeamId: "",
    }));
    setTeamFilter("");
    focusElementByIdAfterRender("group-pairing-desk");
  };
  const switchCurrentPairToTiebreaker = () => patch({ manualSeriesKind: "tiebreaker" });
  const hasNextPairPreview = canFillNextRegularPair && !radiantTeam && !direTeam;
  const hasNextGroupPairPreview = canJumpToNextGroupPair && !hasNextPairPreview;
  const hasAnyPairPreview = hasNextPairPreview || hasNextGroupPairPreview;
  const slotProgressLabel = `已选 ${selectedSlotCount}/2`;
  const groupContextLabel = selectedGroup ? selectedGroup.name : "当前小组";
  const finalStepLabel = hasNextPairPreview
    ? `${groupContextLabel} · 推荐下一场`
    : hasNextGroupPairPreview && nextOtherGroupPairSuggestion
      ? `${nextOtherGroupPairSuggestion.group.name} · 推荐下一场`
    : canCreate
      ? isTiebreakerMode ? `${groupContextLabel} · 检查后写入加赛` : `${groupContextLabel} · 检查后写入赛程`
      : isTiebreakerMode && selectedSlotCount === 0
        ? `${groupContextLabel} · 加赛模式`
      : isTiebreakerMode && selectedSlotCount === 1
        ? `${groupContextLabel} · 加赛还差一队`
      : selectedGroupRegularDone
        ? `${groupContextLabel} · 常规已排满`
      : `${slotProgressLabel} · ${pairingStatus.title}`;
  const finalPrimaryText = blocksDuplicateRegular
    ? "改为加赛或编辑已有对阵"
    : radiantTeam && direTeam
      ? `${radiantTeam.name} vs ${direTeam.name}`
    : radiantTeam || direTeam
      ? `${radiantTeam?.name ?? "左侧待补"} vs ${direTeam?.name ?? "右侧待补"}`
      : hasNextGroupPairPreview
        ? nextOtherGroupPairLabel
    : hasNextPairPreview
      ? nextRegularPairLabel
      : selectedGroupRegularDone
        ? "当前小组常规对阵已排满，可按需要追加加赛"
      : isTiebreakerMode
        ? "从队伍池选择两支队伍添加加赛"
      : "先选左侧和右侧队伍";
  const finalPrimaryTitle = hasNextPairPreview
    ? `填入推荐对阵：${nextRegularPairLabel}。检查队名后再确认创建`
    : hasNextGroupPairPreview && nextOtherGroupPairSuggestion
      ? `切到 ${nextOtherGroupPairSuggestion.group.name} 并填入推荐对阵：${nextOtherGroupPairLabel}。检查队名后再确认创建`
    : finalPrimaryText;
  const roundRobinAssistLabel = roundRobinTargetCount > 0
    ? hasRegularSeries ? `重新铺满 ${roundRobinTargetCount} 场` : `一键铺满 ${roundRobinTargetCount} 场`
    : "一键铺满单循环";
  const roundRobinButtonLabel = roundRobinTargetCount > 0
    ? hasRegularSeries ? `重新生成 ${roundRobinTargetCount} 场` : `生成 ${roundRobinTargetCount} 场`
    : hasRegularSeries ? "重新生成" : "生成全部";
  const roundRobinAssistHint = roundRobinTargetCount > 0
    ? hasRegularSeries
      ? `已有 ${props.regularSeriesCount} 场常规对阵，将重新生成 ${roundRobinTargetCount} 场，覆盖前会二次确认。`
      : `按当前 ${roundRobinGroupCount} 个小组生成全部 BO2 常规赛，共 ${roundRobinTargetCount} 场。`
    : "至少需要一个有 2 支队伍的小组，才能生成单循环。";
  const roundRobinActionTitle = roundRobinTargetCount > 0
    ? `按当前分组生成 ${roundRobinTargetCount} 场 BO2 单循环`
    : "至少需要 2 支队伍才能生成单循环";
  const hasPairingSlotSuggestionAction = canFillNextRegularPair && !radiantTeam && !direTeam && Boolean(recommendedRadiantSlotTeam || recommendedDireSlotTeam);
  const pairingPoolTeams = hasPairingSlotSuggestionAction
    ? visiblePoolTeams.filter((team) => !nextRegularPairTeamIds.has(team.id))
    : visiblePoolTeams;
  const pairingPoolTotalCount = hasPairingSlotSuggestionAction
    ? Math.max(poolTeams.length - nextRegularPairTeamIds.size, 0)
    : poolTeams.length;
  const pairingPoolTitle = hasPairingSlotSuggestionAction && selectedGroup ? `${selectedGroup.name} 其他队伍` : selectedGroup ? `${selectedGroup.name} 队伍池` : "队伍池";
  const pairingPoolEmptyText = selectedGroup
    ? normalizedTeamFilter
      ? hasPairingSlotSuggestionAction ? "推荐队伍已在左/右槽位，其他队伍无匹配" : "队伍池无匹配队伍"
      : hasPairingSlotSuggestionAction ? "推荐对阵已在左/右槽位" : "所有候选队伍已在左侧或右侧"
    : "先创建并选择小组";
  const finalHintText = blocksDuplicateRegular
    ? "常规赛不能重复创建；加赛不受这个限制。"
    : radiantTeam && direTeam
      ? isTiebreakerMode
        ? "点击确认创建加赛后写入赛程。"
        : "点击确认创建 BO2 后写入赛程。"
    : hasPairingSlotSuggestionAction
        ? "先填入推荐对阵，检查队名后再确认创建。"
    : hasAnyPairPreview
        ? "先填入推荐对阵，检查队名后再确认创建。"
        : isTiebreakerMode
          ? "加赛不计入小组积分，只用于打破同分排序。"
        : selectedGroupRegularDone
          ? "加赛不计入小组积分，只用于打破同分排序。"
        : pairingStatus.text;
  const createActionLabel = props.isSubmitting
    ? "创建中..."
    : canCreate
    ? isTiebreakerMode ? "确认创建加赛" : "确认创建 BO2"
    : selectedGroupRegularDone
      ? "添加加赛"
    : blocksDuplicateRegular
      ? "不能重复创建"
      : radiantTeam || direTeam
        ? isTiebreakerMode ? "再补加赛队" : "再补一队"
        : isTiebreakerMode ? "先选加赛两队" : "先选两队";
  const canPrimaryFillNextPair = canFillNextRegularPair && !radiantTeam && !direTeam;
  const canPrimaryJumpToNextGroupPair = canJumpToNextGroupPair && !canPrimaryFillNextPair;
  const primaryActionLabel = props.isSubmitting ? "创建中..." : canPrimaryFillNextPair ? "填入推荐对阵" : canPrimaryJumpToNextGroupPair ? "切组并填入" : createActionLabel;
  const primaryActionTitle = canPrimaryJumpToNextGroupPair && nextOtherGroupPairSuggestion
    ? `切到 ${nextOtherGroupPairSuggestion.group.name} 并填入推荐对阵：${nextOtherGroupPairLabel}`
    : canStartTiebreakerMode
      ? "切换为加赛模式，然后从队伍池选择两支队伍"
    : canCreate
      ? `${isTiebreakerMode ? "创建 BO2 加赛" : "创建 BO2 对阵"}：${finalPrimaryText}`
    : canPrimaryFillNextPair ? finalPrimaryTitle : primaryActionLabel;
  const primaryActionDisabled = props.isSubmitting || (!canCreate && !canPrimaryFillNextPair && !canPrimaryJumpToNextGroupPair && !canStartTiebreakerMode);
  const primaryActionClass = [
    "primary-button",
    props.isSubmitting ? "is-submitting" : canCreate || canPrimaryFillNextPair || canPrimaryJumpToNextGroupPair ? "is-ready-action" : canStartTiebreakerMode ? "is-next-action pairing-fill-next-action" : "is-waiting",
  ].filter(Boolean).join(" ");
  const runPrimaryPairingAction = () => {
    if (props.isSubmitting) return;
    if (canPrimaryFillNextPair) {
      fillNextRegularPair();
      return;
    }
    if (canPrimaryJumpToNextGroupPair) {
      jumpToNextGroupPair();
      return;
    }
    if (canStartTiebreakerMode) {
      startTiebreakerMode();
      return;
    }
    void props.createManualSeries();
  };
  const primaryPairingActionButton = (
    <button id="group-pairing-primary-action" type="button" className={primaryActionClass} onClick={runPrimaryPairingAction} disabled={primaryActionDisabled} title={primaryActionTitle} aria-label={primaryActionTitle}>{props.isSubmitting ? <Loader2 size={15} className="spin" /> : canStartTiebreakerMode || (canCreate && isTiebreakerMode) ? <ShieldCheck size={15} /> : canPrimaryFillNextPair || canPrimaryJumpToNextGroupPair ? <MousePointer2 size={15} /> : canCreate ? <Check size={15} /> : <Plus size={15} />} {primaryActionLabel}</button>
  );
  const recommendedDirectCreateButton = canPrimaryFillNextPair ? (
    <button type="button" className="secondary-button pairing-direct-create-action" onClick={createNextRegularPairWithConfirm} disabled={props.disabled || props.isSubmitting} title={`跳过左侧 / 右侧检查，直接写入 ${nextRegularPairLabel} 的 BO2 草稿`}><Check size={15} /> 跳过检查写入</button>
  ) : canPrimaryJumpToNextGroupPair ? (
    <button type="button" className="secondary-button pairing-direct-create-action" onClick={createNextGroupPairWithConfirm} disabled={props.disabled || props.isSubmitting} title={`跳过左侧 / 右侧检查，直接切到 ${nextOtherGroupPairSuggestion?.group.name ?? "下一组"} 并写入 ${nextOtherGroupPairLabel} 的 BO2 草稿`}><Check size={15} /> 跳过检查写入</button>
  ) : null;
  const recommendedDirectCreateDrawer = props.showDirectWriteAssist !== false && recommendedDirectCreateButton ? (
    <details className="pairing-assist-drawer pairing-direct-write-drawer">
      <summary><span>高级快捷</span><strong>需要时展开</strong></summary>
      <div className="pairing-direct-write-body">
        <div><span>直接写入草稿</span><small>不放入左侧 / 右侧检查位；点击后仍会二次确认。</small></div>
        {recommendedDirectCreateButton}
      </div>
    </details>
  ) : null;
  const finalBar = (
    <div className={["pairing-desk-final", canCreate ? "is-ready" : "", hasAnyPairPreview ? "has-next-pair" : ""].filter(Boolean).join(" ")}>
      <div className="pairing-final-copy">
        <span>{finalStepLabel}</span>
        <strong title={finalPrimaryTitle}>{finalPrimaryText}</strong>
        {finalHintText ? <small>{finalHintText}</small> : null}
      </div>
      {!hasAnyPairPreview && !selectedGroupRegularDone && !canCreate ? <div className="pairing-final-meta">
        <span className="pairing-meta-fill">已选 {selectedSlotCount}/2</span>
        {selectedGroup ? <span className="pairing-meta-group">{selectedGroup.name}</span> : null}
        <span className="pairing-meta-bo">BO2</span>
        <span className="pairing-meta-kind">{kindLabel}</span>
        <span className="pairing-meta-round">{roundLabel}</span>
        <span className="pairing-meta-time">{timeLabel}</span>
        <span className="pairing-meta-progress">{regularProgressLabel}</span>
        {selectedGroup ? <span className="pairing-meta-count">已有 {selectedGroupSeriesCount} 场</span> : null}
      </div> : null}
      <div className="pairing-final-actions">
        {blocksDuplicateRegular ? <button type="button" className="secondary-button pairing-tiebreaker-action" onClick={switchCurrentPairToTiebreaker} disabled={props.disabled}><ShieldCheck size={15} /> 改为加赛</button> : null}
        {canOfferTiebreakerMode && !canStartTiebreakerMode ? <button type="button" className="secondary-button pairing-tiebreaker-action" onClick={startTiebreakerMode} disabled={props.disabled} title={`在 ${groupContextLabel} 追加一场不计积分的加赛`}><ShieldCheck size={15} /> 本组加赛</button> : null}
        {isTiebreakerMode ? <button type="button" className="secondary-button pairing-regular-action" onClick={returnToRegularMode} disabled={props.disabled || props.isSubmitting} title="退出加赛模式，回到常规排赛推荐"><RotateCcw size={15} /> 回常规赛</button> : null}
        {canPrimaryFillNextPair || canPrimaryJumpToNextGroupPair ? primaryPairingActionButton : null}
        {!canPrimaryFillNextPair && !canPrimaryJumpToNextGroupPair && canCreate ? primaryPairingActionButton : null}
        {radiantTeam && direTeam ? <button type="button" className="secondary-button pairing-swap-action" onClick={() => swapManualSeriesTeams(props.setStageForm)} disabled={props.disabled} title="交换左侧和右侧队伍"><ArrowLeftRight size={15} /> 交换左右</button> : null}
        {!canPrimaryFillNextPair && !canPrimaryJumpToNextGroupPair && !canCreate ? primaryPairingActionButton : null}
      </div>
    </div>
  );

  return (
    <section id="group-pairing-desk" tabIndex={-1} className="group-pairing-desk">
      {shouldShowPairingHead ? <div className="pairing-desk-head">
        <div><strong>小组内手动排赛</strong><small>选一个小组，把两支队伍放到左侧和右侧，创建后会进入下方阶段赛程。</small></div>
        <label>当前小组<select value={selectedGroupId} onChange={(event) => selectGroup(event.target.value)} disabled={props.disabled || props.groups.length === 0}>{props.groups.length === 0 ? <option value="">未创建小组</option> : props.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      </div> : null}
      {finalBar}
      <div className="pairing-desk-dropgrid">
        <PairingSlotStack radiantTeam={radiantTeam} direTeam={direTeam} suggestedRadiantTeam={recommendedRadiantSlotTeam} suggestedDireTeam={recommendedDireSlotTeam} suggestedPairLabel={nextRegularPairLabel} onUseSuggestion={fillNextRegularPair} setStageForm={props.setStageForm} disabled={props.disabled} radiantSlotId="group-pairing-radiant-slot" direSlotId="group-pairing-dire-slot" />
        <ManualSeriesDropZone
          target="pool"
          title={pairingPoolTitle}
          teams={pairingPoolTeams}
          totalCount={pairingPoolTotalCount}
          emptyText={pairingPoolEmptyText}
          onPickTeam={!props.disabled && canPickPoolTeam ? pickPoolTeamForPairing : undefined}
          actionLabel={poolPickActionLabel}
          recommendedTeamIds={canGuideNextRegularPairSides ? nextRegularPairTeamIds : undefined}
          recommendedLabels={recommendedPairLabels}
          pickTargets={recommendedPairPickTargets}
          compactUntargetedActions={selectedSlotCount === 0}
          disabled={props.disabled}
          tools={<PairingPoolSearch value={teamFilter} onChange={setTeamFilter} onClear={() => setTeamFilter("")} disabled={props.disabled || !selectedGroup} resultText={normalizedTeamFilter ? `可拖 ${visiblePoolTeams.length}/${poolTeams.length} 支` : `${poolTeams.length} 支可拖`} />}
        />
      </div>
      {recommendedDirectCreateDrawer}
      {props.showBulkAssist !== false ? <details className="pairing-assist-drawer" onToggle={(event) => setAssistDrawerOpen(event.currentTarget.open)}>
        <summary><span>批量辅助</span><strong>{roundRobinAssistLabel}</strong></summary>
        {assistDrawerOpen ? (
          <div className="pairing-mode-strip is-assist is-single" aria-label="小组排赛批量辅助操作">
            <section className={hasRegularSeries ? "pairing-mode-option is-caution" : "pairing-mode-option is-recommended"}>
              <span>批量辅助</span>
              <strong>{roundRobinAssistLabel}</strong>
              <small>{roundRobinAssistHint}</small>
              <button type="button" onClick={() => void props.generateGroupRoundRobin()} disabled={props.disabled || !props.canGenerateRoundRobin} title={roundRobinActionTitle}>
                <CalendarClock size={15} /> {roundRobinButtonLabel}
              </button>
            </section>
          </div>
        ) : null}
      </details> : null}
      {shouldShowDetailsDrawer ? <details className="pairing-details-drawer" onToggle={(event) => setDetailsDrawerOpen(event.currentTarget.open)}>
        <summary><span>赛程细节</span><strong>{roundLabel} · {kindLabel} · {timeLabel}</strong></summary>
        {detailsDrawerOpen ? (
          <div className="pairing-desk-controls">
            <label>轮次<select value={props.stageForm.manualRoundId} onChange={(event) => patch({ manualRoundId: event.target.value })} disabled={props.disabled}><option value="">新建轮次</option>{props.rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
            {!props.stageForm.manualRoundId ? <label>新轮次名称<input value={props.stageForm.manualRoundName} onChange={(event) => patch({ manualRoundName: event.target.value })} disabled={props.disabled} /></label> : null}
            <label>计划时间<input type="datetime-local" value={props.stageForm.manualScheduledAt} onChange={(event) => patch({ manualScheduledAt: event.target.value })} disabled={props.disabled} /></label>
            <div className="segmented-grid compact"><button type="button" className={props.stageForm.manualSeriesKind === "regular" ? "is-active" : ""} onClick={() => patch({ manualSeriesKind: "regular" })} disabled={props.disabled}>常规赛</button><button type="button" className={props.stageForm.manualSeriesKind === "tiebreaker" ? "is-active" : ""} onClick={() => patch({ manualSeriesKind: "tiebreaker" })} disabled={props.disabled}>加赛</button></div>
          </div>
        ) : null}
      </details> : null}
    </section>
  );
}

function SwissCanvas(props: {
  data: AdminData;
  availableTeams: TeamBrief[];
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createManualSeries: CreateManualSeriesHandler;
  manualSeriesSubmitting: boolean;
  generateSwissPairings: () => Promise<void>;
  confirmSwissRound: (roundId: string, description?: string) => Promise<void>;
  retractSwissRound: (roundId: string, description?: string) => Promise<void>;
}) {
  const [swissStatusOpen, setSwissStatusOpen] = useState(false);
  const rounds = [...props.data.rounds].sort((left, right) => left.roundNumber - right.roundNumber);
  const confirmedRounds = rounds.filter((round) => round.pairingStatus === "confirmed");
  const draftRounds = rounds.filter((round) => round.pairingStatus !== "confirmed");
  const totalSeries = rounds.reduce((sum, round) => sum + round.series.length, 0);
  const isPublished = props.data.schedule?.status === "published";
  const shouldPrioritizePairing = draftRounds.length === 0;
  const isFreshPairingPriority = shouldPrioritizePairing && rounds.length === 0;
  const shouldShowSwissCommandStrip = !isFreshPairingPriority;
  const shouldShowSwissStatusDrawer = !isFreshPairingPriority;
  const swissFocus = draftRounds.length > 0
    ? { tone: "warn", icon: <Check size={16} />, title: "确认待确认轮次", text: "先检查草稿配对。确认后，这轮才会进入正式赛程；填错可以撤回该轮及后续。", actionLabel: "去确认轮次", targetId: "swiss-round-lanes" }
    : rounds.length === 0
      ? { tone: "info", icon: <ListRestart size={16} />, title: "生成第一轮瑞士轮草稿", text: "可以先让系统按战绩生成本轮配对草稿，再按需要手动拖拽微调或补配对。", actionLabel: "生成配对草稿", targetId: "swiss-auto-pairing-assist" }
      : { tone: "good", icon: <ListRestart size={16} />, title: "继续下一轮或维护赛果", text: "已确认轮次可以继续补 match_id / 赛果；需要下一轮时展开自动配对辅助，或继续手动补配对。", actionLabel: "自动配对辅助", targetId: "swiss-auto-pairing-assist" };
  const swissPairingDesk = (
    <SwissPairingDesk
      teams={props.availableTeams}
      standings={props.data.standings}
      rounds={rounds}
      stageForm={props.stageForm}
      setStageForm={props.setStageForm}
      createManualSeries={props.createManualSeries}
      generateSwissPairings={props.generateSwissPairings}
      disabled={isPublished || props.manualSeriesSubmitting}
      isSubmitting={props.manualSeriesSubmitting}
      showDirectWriteAssist={!shouldPrioritizePairing}
      showAutoPairingInline={isFreshPairingPriority}
    />
  );
  return (
    <div id="swiss-workbench" tabIndex={-1} className={["canvas-section", "swiss-workbench", shouldPrioritizePairing ? "is-pairing-priority" : ""].filter(Boolean).join(" ")}>
      {!shouldPrioritizePairing ? <div className="canvas-toolbar">
        <div><strong>瑞士轮确认工作台</strong><small>先检查并确认草稿轮次；填错可以撤回该轮及后续。</small></div>
        <button type="button" className="secondary-button" onClick={() => focusElementById("swiss-pairing-desk")} disabled={isPublished}><MousePointer2 size={15} /> 手动添加配对</button>
      </div> : null}
      {shouldPrioritizePairing ? swissPairingDesk : null}
      {shouldShowSwissCommandStrip ? <div className="swiss-command-strip">
        <div className={`swiss-command-status is-${swissFocus.tone}`}>
          <span>{swissFocus.icon}</span>
          <div>
            <strong>{swissFocus.title}</strong>
            <small>{draftRounds.length > 0 ? `${draftRounds.length} 个草稿待确认` : `${rounds.length} 轮 · ${totalSeries} 场对阵`}</small>
          </div>
        </div>
        <div className="swiss-command-metrics">
          <div><span>已确认</span><strong>{confirmedRounds.length}/{rounds.length}</strong></div>
          <div><span>下一轮</span><strong>第 {props.stageForm.swissRoundNumber} 轮</strong></div>
          <button type="button" onClick={() => focusElementById("swiss-pairing-desk")} disabled={isPublished}><MousePointer2 size={15} /> 手动配对</button>
        </div>
        <div className="swiss-command-actions">
          <div><span>系统辅助</span><strong>{draftRounds.length > 0 ? "先确认草稿" : "可选"}</strong></div>
          <button type="button" onClick={() => focusElementById(swissFocus.targetId)} disabled={isPublished && swissFocus.targetId !== "swiss-round-lanes"}>{swissFocus.actionLabel}</button>
        </div>
      </div> : null}
      {!shouldPrioritizePairing ? swissPairingDesk : null}
      {shouldShowSwissStatusDrawer ? <details className="swiss-status-drawer" onToggle={(event) => setSwissStatusOpen(event.currentTarget.open)}>
        <summary>
          <span>瑞士轮状态</span>
          <strong>{rounds.length} 轮 · {totalSeries} 场 · {draftRounds.length} 个待确认</strong>
        </summary>
        {swissStatusOpen ? (
          <div className="swiss-status-body">
            <div className="swiss-summary-strip">
              <div><span>轮次</span><strong>{rounds.length}</strong></div>
              <div><span>已确认</span><strong>{confirmedRounds.length}</strong></div>
              <div><span>对阵</span><strong>{totalSeries}</strong></div>
              <div><span>下一轮</span><strong>第 {props.stageForm.swissRoundNumber} 轮</strong></div>
            </div>
            <div className={`group-focus-strip swiss-focus-strip is-${swissFocus.tone}`}>
              <span className="group-focus-icon">{swissFocus.icon}</span>
              <div>
                <strong>{swissFocus.title}</strong>
                <small>{swissFocus.text}</small>
              </div>
              <button type="button" onClick={() => focusElementById(swissFocus.targetId)} disabled={isPublished && swissFocus.targetId !== "swiss-round-lanes"}>{swissFocus.actionLabel}</button>
            </div>
          </div>
        ) : null}
      </details> : null}
      {rounds.length === 0 ? (!isFreshPairingPriority ? <EmptyPanel title="还没有瑞士轮配对" text="可以先在手动配对板拖两支队伍创建 BO2；需要系统铺底时，展开自动配对辅助。" /> : null) : (
        <div id="swiss-round-lanes" tabIndex={-1} className="swiss-lanes">
          <SwissRoundLane title="待确认轮次" description="检查对阵无误后确认本轮" rounds={draftRounds} emptyText="没有待确认草稿" confirmSwissRound={props.confirmSwissRound} retractSwissRound={props.retractSwissRound} />
          <SwissRoundLane title="已确认轮次" description="已进入正式赛程，仍可撤回该轮及后续" rounds={confirmedRounds} emptyText="还没有确认轮次" confirmSwissRound={props.confirmSwissRound} retractSwissRound={props.retractSwissRound} />
        </div>
      )}
    </div>
  );
}

function SwissPairingDesk(props: {
  teams: TeamBrief[];
  standings: StandingRow[];
  rounds: StageRound[];
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  createManualSeries: CreateManualSeriesHandler;
  generateSwissPairings: () => Promise<void>;
  disabled: boolean;
  isSubmitting: boolean;
  showDirectWriteAssist?: boolean;
  showAutoPairingInline?: boolean;
}) {
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const [teamFilter, setTeamFilter] = useState("");
  const [assistDrawerOpen, setAssistDrawerOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const orderedTeams = orderTeamsByStanding(props.teams, props.standings);
  const rankingLookup = new Map(props.standings.map((row) => [standingTeamId(row), row]));
  const radiantTeam = props.teams.find((team) => team.id === props.stageForm.manualRadiantTeamId) ?? null;
  const direTeam = props.teams.find((team) => team.id === props.stageForm.manualDireTeamId) ?? null;
  const selectedIds = new Set([props.stageForm.manualRadiantTeamId, props.stageForm.manualDireTeamId].filter(Boolean));
  const poolTeams = orderedTeams.filter((team) => !selectedIds.has(team.id));
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const visiblePoolTeams = normalizedTeamFilter ? poolTeams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : poolTeams;
  const swissSeriesHistory = props.rounds.flatMap((round) => round.series);
  const recommendedSwissPair = findRecommendedPair(poolTeams, swissSeriesHistory);
  const recommendedSwissPairTeamIds = new Set([recommendedSwissPair?.left.id, recommendedSwissPair?.right.id].filter((id): id is string => Boolean(id)));
  const recommendedSwissPairLabel = recommendedSwissPair ? `${recommendedSwissPair.left.name} vs ${recommendedSwissPair.right.name}` : "暂无推荐配对";
  const repeatedSwissSeries = radiantTeam && direTeam
    ? swissSeriesHistory.find((series) => isSameSeriesPair(series, radiantTeam.id, direTeam.id))
    : undefined;
  const blocksRepeatedSwissPair = repeatedSwissSeries !== undefined;
  const canCreate = !props.disabled && !blocksRepeatedSwissPair && Boolean(radiantTeam && direTeam && radiantTeam.id !== direTeam.id);
  const roundLabel = props.stageForm.manualRoundId
    ? props.rounds.find((round) => round.id === props.stageForm.manualRoundId)?.name ?? "已选轮次"
    : props.stageForm.manualRoundName.trim() || "新建轮次";
  const timeLabel = formatDate(props.stageForm.manualScheduledAt);
  const orderLabel = props.standings.length > 0 ? "按当前战绩" : "按参赛名单";
  const affectedRoundCount = props.rounds.filter((round) => round.roundNumber >= props.stageForm.swissRoundNumber).length;
  const canGenerateSwissDraft = !props.disabled && props.teams.length >= 2;
  const swissDraftImpact = formatSwissDraftImpact(props.teams.length);
  const swissDraftSeriesCount = getSwissDraftSeriesCount(props.teams.length);
  const swissDraftAssistLabel = props.teams.length >= 2
    ? `第 ${props.stageForm.swissRoundNumber} 轮 · ${swissDraftImpact}`
    : `第 ${props.stageForm.swissRoundNumber} 轮草稿`;
  const swissDraftButtonLabel = swissDraftSeriesCount > 0 ? `生成 ${swissDraftSeriesCount} 场草稿` : "生成草稿";
  const showAutoPairingInline = props.showAutoPairingInline === true;
  const canFillRecommendedSwissPair = !props.disabled && recommendedSwissPair !== null && !radiantTeam && !direTeam;
  const canGuideRecommendedSwissSides = !props.disabled && recommendedSwissPair !== null && (!radiantTeam || radiantTeam.id === recommendedSwissPair.left.id) && (!direTeam || direTeam.id === recommendedSwissPair.right.id) && (!radiantTeam || !direTeam);
  const recommendedSwissPickTargets = canGuideRecommendedSwissSides && recommendedSwissPair
    ? new Map<string, ManualSeriesTeamSlotTarget>([[recommendedSwissPair.left.id, "radiant"], [recommendedSwissPair.right.id, "dire"]])
    : undefined;
  const recommendedSwissLabels = canGuideRecommendedSwissSides && recommendedSwissPair
    ? new Map<string, string>([[recommendedSwissPair.left.id, "推荐"], [recommendedSwissPair.right.id, "推荐"]])
    : undefined;
  const recommendedSwissRadiantSlotTeam = canGuideRecommendedSwissSides && recommendedSwissPair && !radiantTeam ? recommendedSwissPair.left : null;
  const recommendedSwissDireSlotTeam = canGuideRecommendedSwissSides && recommendedSwissPair && !direTeam ? recommendedSwissPair.right : null;
  const selectedSlotCount = [radiantTeam, direTeam].filter(Boolean).length;
  const poolPickActionLabel = getNextSlotActionLabel(radiantTeam, direTeam);
  const canPickPoolTeam = !radiantTeam || !direTeam;
  const hasManualPairingDetails = Boolean(
    props.stageForm.manualRoundId ||
    props.stageForm.manualRoundName.trim() ||
    props.stageForm.manualScheduledAt.trim(),
  );
  const shouldShowDetailsDrawer = selectedSlotCount > 0 || hasManualPairingDetails;
  const pairingStatus = props.teams.length < 2
    ? { tone: "warn", icon: <Users size={15} />, title: "还不能配对", text: "瑞士轮至少需要 2 支参赛队伍。" }
    : !radiantTeam && !direTeam
      ? { tone: "info", icon: <MousePointer2 size={15} />, title: "拖入两支队伍", text: "从战绩队伍池拖到左侧和右侧，或直接点击队伍；队伍池会提示先放哪一侧。" }
      : !radiantTeam || !direTeam
        ? { tone: "warn", icon: <MousePointer2 size={15} />, title: "还差一支队伍", text: `再拖或点击一支队伍放到${radiantTeam ? "右侧" : "左侧"}，就可以创建 BO2。` }
        : blocksRepeatedSwissPair
          ? { tone: "warn", icon: <ShieldCheck size={15} />, title: "这两队已经交手", text: "瑞士轮默认避免重复交手，请换一组队伍；必要时编辑已有对阵。" }
          : { tone: "good", icon: <ShieldCheck size={15} />, title: "可以创建配对", text: `${radiantTeam.name} vs ${direTeam.name} · ${roundLabel}` };
  const fillRecommendedSwissPair = () => {
    if (!recommendedSwissPair) return;
    props.setStageForm((current) => ({
      ...current,
      manualRadiantTeamId: recommendedSwissPair.left.id,
      manualDireTeamId: recommendedSwissPair.right.id,
    }));
    focusElementByIdAfterRender("swiss-pairing-primary-action");
  };
  const createRecommendedSwissPair = () => {
    if (!recommendedSwissPair) return;
    void props.createManualSeries({
      manualRadiantTeamId: recommendedSwissPair.left.id,
      manualDireTeamId: recommendedSwissPair.right.id,
    });
  };
  const createRecommendedSwissPairWithConfirm = () => {
    if (!recommendedSwissPair) return;
    if (!window.confirm(`跳过左侧 / 右侧检查，直接写入 ${recommendedSwissPairLabel} 的 BO2 草稿？`)) return;
    createRecommendedSwissPair();
  };
  const pickPoolTeamForSwissPairing = (teamId: string, target?: ManualSeriesTeamSlotTarget) => {
    if (target) {
      moveManualSeriesDraftTeam(target, teamId, props.setStageForm);
      focusElementByIdAfterRender(getManualPickFocusTarget(radiantTeam, direTeam, target, "swiss-pairing-primary-action", "swiss-pairing-radiant-slot", "swiss-pairing-dire-slot"));
      return;
    }
    pickManualSeriesTeam(teamId, props.setStageForm);
    focusElementByIdAfterRender(getManualPickFocusTarget(radiantTeam, direTeam, undefined, "swiss-pairing-primary-action", "swiss-pairing-radiant-slot", "swiss-pairing-dire-slot"));
  };
  const hasRecommendedPairPreview = canFillRecommendedSwissPair;
  const slotProgressLabel = `已选 ${selectedSlotCount}/2`;
  const finalStepLabel = hasRecommendedPairPreview
    ? "推荐配对"
    : canCreate
      ? "检查后写入配对"
      : `${slotProgressLabel} · ${pairingStatus.title}`;
  const finalPrimaryText = blocksRepeatedSwissPair
    ? "换一组队伍或编辑已有对阵"
    : radiantTeam && direTeam
      ? `${radiantTeam.name} vs ${direTeam.name}`
      : radiantTeam || direTeam
        ? `${radiantTeam?.name ?? "左侧待补"} vs ${direTeam?.name ?? "右侧待补"}`
        : hasRecommendedPairPreview
          ? recommendedSwissPairLabel
          : "先选左侧和右侧队伍";
  const finalPrimaryTitle = hasRecommendedPairPreview
    ? `填入推荐配对：${recommendedSwissPairLabel}。检查队名后再确认创建`
    : finalPrimaryText;
  const hasSwissSlotSuggestionAction = canFillRecommendedSwissPair && !radiantTeam && !direTeam && Boolean(recommendedSwissRadiantSlotTeam || recommendedSwissDireSlotTeam);
  const swissPoolTeams = hasSwissSlotSuggestionAction
    ? visiblePoolTeams.filter((team) => !recommendedSwissPairTeamIds.has(team.id))
    : visiblePoolTeams;
  const swissPoolTotalCount = hasSwissSlotSuggestionAction
    ? Math.max(poolTeams.length - recommendedSwissPairTeamIds.size, 0)
    : poolTeams.length;
  const swissPoolTitle = hasSwissSlotSuggestionAction ? "其他战绩队伍" : "战绩队伍池";
  const swissPoolEmptyText = props.teams.length === 0
    ? "当前届次暂无队伍"
    : normalizedTeamFilter
      ? hasSwissSlotSuggestionAction ? "推荐配对已在左/右槽位，其他队伍无匹配" : "队伍池无匹配队伍"
      : hasSwissSlotSuggestionAction ? "推荐配对已在左/右槽位" : "候选队伍已在左侧或右侧";
  const finalHintText = blocksRepeatedSwissPair
    ? "瑞士轮默认避免重复交手。"
    : radiantTeam && direTeam
      ? "点击确认创建 BO2 后写入配对。"
    : hasSwissSlotSuggestionAction
        ? "先填入推荐配对，检查队名后再确认创建。"
    : hasRecommendedPairPreview
        ? "先填入推荐配对，检查队名后再确认创建。"
        : pairingStatus.text;
  const createActionLabel = props.isSubmitting
    ? "创建中..."
    : canCreate
    ? "确认创建 BO2"
    : blocksRepeatedSwissPair
      ? "不能重复交手"
      : radiantTeam || direTeam
        ? "再补一队"
        : "先选两队";
  const canPrimaryFillRecommendedPair = canFillRecommendedSwissPair && !radiantTeam && !direTeam;
  const primaryActionLabel = props.isSubmitting ? "创建中..." : canPrimaryFillRecommendedPair ? "填入推荐配对" : createActionLabel;
  const primaryActionDisabled = props.isSubmitting || (!canCreate && !canPrimaryFillRecommendedPair);
  const primaryActionClass = [
    "primary-button",
    props.isSubmitting ? "is-submitting" : canCreate || canPrimaryFillRecommendedPair ? "is-ready-action" : "is-waiting",
  ].filter(Boolean).join(" ");
  const primaryActionTitle = canCreate
    ? `创建 BO2 配对：${finalPrimaryText}`
    : hasRecommendedPairPreview
      ? finalPrimaryTitle
      : primaryActionLabel;
  const runPrimaryPairingAction = () => {
    if (props.isSubmitting) return;
    if (canPrimaryFillRecommendedPair) {
      fillRecommendedSwissPair();
      return;
    }
    void props.createManualSeries();
  };
  const primarySwissPairingActionButton = (
    <button id="swiss-pairing-primary-action" type="button" className={primaryActionClass} onClick={runPrimaryPairingAction} disabled={primaryActionDisabled} title={primaryActionTitle} aria-label={primaryActionTitle}>{props.isSubmitting ? <Loader2 size={15} className="spin" /> : canPrimaryFillRecommendedPair ? <MousePointer2 size={15} /> : canCreate ? <Check size={15} /> : <Plus size={15} />} {primaryActionLabel}</button>
  );
  const recommendedSwissDirectCreateButton = canPrimaryFillRecommendedPair ? (
    <button type="button" className="secondary-button pairing-direct-create-action" onClick={createRecommendedSwissPairWithConfirm} disabled={props.disabled || props.isSubmitting} title={`跳过左侧 / 右侧检查，直接写入 ${recommendedSwissPairLabel} 的 BO2 草稿`}><Check size={15} /> 跳过检查写入</button>
  ) : null;
  const recommendedSwissDirectCreateDrawer = props.showDirectWriteAssist !== false && recommendedSwissDirectCreateButton ? (
    <details className="pairing-assist-drawer pairing-direct-write-drawer">
      <summary><span>高级快捷</span><strong>需要时展开</strong></summary>
      <div className="pairing-direct-write-body">
        <div><span>直接写入草稿</span><small>不放入左侧 / 右侧检查位；点击后仍会二次确认。</small></div>
        {recommendedSwissDirectCreateButton}
      </div>
    </details>
  ) : null;
  const swissAutoPairingAssist = (
    <div className={affectedRoundCount > 0 ? "pairing-fast-action is-caution is-assist" : "pairing-fast-action is-assist"}>
      <div>
        <span>{showAutoPairingInline ? "瑞士轮自动配对" : "自动配对辅助"}</span>
        <strong>{swissDraftAssistLabel}</strong>
        <small>{props.teams.length < 2 ? "至少需要 2 支参赛队伍。" : affectedRoundCount > 0 ? `会覆盖本轮及之后 ${affectedRoundCount} 个轮次，点击后会二次确认。` : "按当前胜平负和重复交手关系配对，生成后仍需确认。"}</small>
      </div>
      <button type="button" onClick={() => void props.generateSwissPairings()} disabled={!canGenerateSwissDraft} title={`预计 ${swissDraftImpact}`}>
        <ListRestart size={15} /> {swissDraftButtonLabel}
      </button>
    </div>
  );
  const swissFinalBar = (
    <div className={["pairing-desk-final", canCreate ? "is-ready" : "", hasRecommendedPairPreview ? "has-next-pair" : ""].filter(Boolean).join(" ")}>
      <div className="pairing-final-copy">
        <span>{finalStepLabel}</span>
        <strong title={finalPrimaryTitle}>{finalPrimaryText}</strong>
        {finalHintText ? <small>{finalHintText}</small> : null}
      </div>
      {!hasRecommendedPairPreview && !canCreate ? <div className="pairing-final-meta">
        <span className="pairing-meta-fill">已选 {selectedSlotCount}/2</span>
        <span className="pairing-meta-bo">BO2</span>
        <span className="pairing-meta-order">{orderLabel}</span>
        <span className="pairing-meta-round">{roundLabel}</span>
      </div> : null}
      <div className="pairing-final-actions">
        {canPrimaryFillRecommendedPair ? primarySwissPairingActionButton : null}
        {!canPrimaryFillRecommendedPair && canCreate ? primarySwissPairingActionButton : null}
        {radiantTeam && direTeam ? <button type="button" className="secondary-button pairing-swap-action" onClick={() => swapManualSeriesTeams(props.setStageForm)} disabled={props.disabled} title="交换左侧和右侧队伍"><ArrowLeftRight size={15} /> 交换左右</button> : null}
        {!canPrimaryFillRecommendedPair && !canCreate ? primarySwissPairingActionButton : null}
      </div>
    </div>
  );

  return (
    <section id="swiss-pairing-desk" tabIndex={-1} className="swiss-pairing-desk">
      <div className="pairing-desk-head">
        <div><strong>瑞士轮手动配对</strong><small>自动配对不合适时，直接从战绩队伍池拖两支队伍补一场 BO2 配对。</small></div>
      </div>
      {swissFinalBar}
      {showAutoPairingInline ? <div id="swiss-auto-pairing-assist" tabIndex={-1} className="swiss-inline-auto-assist">{swissAutoPairingAssist}</div> : null}
      <div className="pairing-desk-dropgrid">
        <PairingSlotStack radiantTeam={radiantTeam} direTeam={direTeam} suggestedRadiantTeam={recommendedSwissRadiantSlotTeam} suggestedDireTeam={recommendedSwissDireSlotTeam} suggestedPairLabel={recommendedSwissPairLabel} onUseSuggestion={fillRecommendedSwissPair} setStageForm={props.setStageForm} disabled={props.disabled} radiantSlotId="swiss-pairing-radiant-slot" direSlotId="swiss-pairing-dire-slot" />
        <SwissManualDropZone
          title={swissPoolTitle}
          teams={swissPoolTeams}
          totalCount={swissPoolTotalCount}
          rankingLookup={rankingLookup}
          emptyText={swissPoolEmptyText}
          onPickTeam={!props.disabled && canPickPoolTeam ? pickPoolTeamForSwissPairing : undefined}
          actionLabel={poolPickActionLabel}
          recommendedTeamIds={canGuideRecommendedSwissSides ? recommendedSwissPairTeamIds : undefined}
          recommendedLabels={recommendedSwissLabels}
          pickTargets={recommendedSwissPickTargets}
          compactUntargetedActions={selectedSlotCount === 0}
          disabled={props.disabled}
          tools={<PairingPoolSearch value={teamFilter} onChange={setTeamFilter} onClear={() => setTeamFilter("")} disabled={props.disabled || props.teams.length === 0} resultText={normalizedTeamFilter ? `可拖 ${visiblePoolTeams.length}/${poolTeams.length} 支` : `${poolTeams.length} 支可拖`} />}
        />
      </div>
      {recommendedSwissDirectCreateDrawer}
      {!showAutoPairingInline ? <details id="swiss-auto-pairing-assist" tabIndex={-1} className="pairing-assist-drawer" onToggle={(event) => setAssistDrawerOpen(event.currentTarget.open)}>
        <summary><span>自动配对辅助</span><strong>{swissDraftAssistLabel}</strong></summary>
        {assistDrawerOpen ? swissAutoPairingAssist : null}
      </details> : null}
      {shouldShowDetailsDrawer ? <details className="pairing-details-drawer" onToggle={(event) => setDetailsDrawerOpen(event.currentTarget.open)}>
        <summary><span>赛程细节</span><strong>{roundLabel} · {timeLabel} · {orderLabel}</strong></summary>
        {detailsDrawerOpen ? (
          <div className="pairing-desk-controls">
            <label>轮次<select value={props.stageForm.manualRoundId} onChange={(event) => patch({ manualRoundId: event.target.value })} disabled={props.disabled}><option value="">新建轮次</option>{props.rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
            {!props.stageForm.manualRoundId ? <label>新轮次名称<input value={props.stageForm.manualRoundName} onChange={(event) => patch({ manualRoundName: event.target.value })} disabled={props.disabled} /></label> : null}
            <label>计划时间<input type="datetime-local" value={props.stageForm.manualScheduledAt} onChange={(event) => patch({ manualScheduledAt: event.target.value })} disabled={props.disabled} /></label>
            <div className="swiss-record-note"><span>候选顺序</span><strong>{orderLabel}</strong></div>
          </div>
        ) : null}
      </details> : null}
    </section>
  );
}

function PairingPoolSearch(props: { value: string; onChange: (value: string) => void; onClear: () => void; disabled: boolean; resultText: string }) {
  const hasQuery = props.value.trim().length > 0;
  return (
    <div className="pairing-pool-search">
      <label><Search size={13} /><input value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder="查找队伍" disabled={props.disabled} /></label>
      {hasQuery ? <strong>{props.resultText}</strong> : null}
      {hasQuery ? <button type="button" onClick={props.onClear}>清除</button> : null}
    </div>
  );
}

function SwissManualDropZone(props: { title: string; teams: TeamBrief[]; rankingLookup: Map<string, StandingRow>; emptyText: string; totalCount?: number; onPickTeam?: ((teamId: string, target?: ManualSeriesTeamSlotTarget) => void) | undefined; actionLabel?: string; tools?: React.ReactNode; recommendedTeamIds?: ReadonlySet<string> | undefined; recommendedLabels?: ReadonlyMap<string, string> | undefined; pickTargets?: ReadonlyMap<string, ManualSeriesTeamSlotTarget> | undefined; compactUntargetedActions?: boolean; disabled?: boolean }) {
  const isDisabled = props.disabled === true;
  const { isOver, setNodeRef } = useDroppable({ id: "manual-series:pool", disabled: isDisabled });
  const countText = props.totalCount !== undefined && props.totalCount !== props.teams.length ? `${props.teams.length}/${props.totalCount} 队` : `${props.teams.length} 队`;
  const actionLabel = props.actionLabel ?? "填入";
  const clickHint = props.pickTargets && props.pickTargets.size > 0 ? "拖队伍，或点 + 放入左/右" : formatPoolClickHint(actionLabel);
  const canDragReplaceFromPool = props.teams.length > 0 && !isDisabled;
  const hint = props.onPickTeam ? `${countText} · ${clickHint}` : formatPassivePoolHint(countText, canDragReplaceFromPool);
  return (
    <section ref={setNodeRef} className={["manual-drop-zone", props.tools ? "has-zone-tools" : "", isDisabled ? "is-locked" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ")}>
      <div className="roster-zone-head"><strong>{props.title}</strong><small>{hint}</small></div>
      {props.tools ? <div className="manual-zone-tools">{props.tools}</div> : null}
      <div className="roster-zone-list">{props.teams.length === 0 ? <div className="drop-placeholder compact">{props.emptyText}</div> : null}{props.teams.map((team) => {
        const target = props.pickTargets?.get(team.id);
        const teamActionLabel = target === "radiant" ? "放左侧" : target === "dire" ? "放右侧" : actionLabel;
        return <DraggableRankedTeam key={team.id} team={team} row={props.rankingLookup.get(team.id) ?? null} recommended={props.recommendedTeamIds?.has(team.id) ?? false} recommendedLabel={props.recommendedLabels?.get(team.id)} actionLabel={teamActionLabel} compactAction={props.compactUntargetedActions === true && !target} disabled={isDisabled} onClick={!isDisabled && props.onPickTeam ? () => { props.onPickTeam?.(team.id, target); } : undefined} {...(canDragReplaceFromPool ? { dragOnlyLabel: formatDragReplaceTeamLabel(team.name) } : {})} />;
      })}</div>
    </section>
  );
}

function SwissRoundLane(props: { title: string; description: string; rounds: StageRound[]; emptyText: string; confirmSwissRound: (roundId: string, description?: string) => Promise<void>; retractSwissRound: (roundId: string, description?: string) => Promise<void> }) {
  return (
    <section className="swiss-lane">
      <div className="swiss-lane-head"><div><strong>{props.title}</strong><small>{props.description}</small></div><span>{props.rounds.length}</span></div>
      <div className="swiss-round-grid">{props.rounds.length === 0 ? <div className="drop-placeholder compact">{props.emptyText}</div> : props.rounds.map((round) => <SwissRoundCard key={round.id} round={round} confirmSwissRound={props.confirmSwissRound} retractSwissRound={props.retractSwissRound} />)}</div>
    </section>
  );
}

function SwissRoundCard(props: { round: StageRound; confirmSwissRound: (roundId: string, description?: string) => Promise<void>; retractSwissRound: (roundId: string, description?: string) => Promise<void> }) {
  const isConfirmed = props.round.pairingStatus === "confirmed";
  const status = props.round.pairingStatus ?? props.round.status;
  const roundDescription = describeSwissRoundForAction(props.round);
  return (
    <article className={isConfirmed ? "swiss-card is-confirmed" : "swiss-card"}>
      <div className="swiss-card-head">
        <div><strong>{props.round.name}</strong><small>{props.round.series.length} 场对阵</small></div>
        <StatusPill tone={toneForStatus(status)}>{labelPairingStatus(status)}</StatusPill>
      </div>
      {props.round.byes && props.round.byes.length > 0 ? <div className="bye-row">{props.round.byes.map((team) => <span key={team.id}>{team.name} 轮空胜</span>)}</div> : null}
      <div className="swiss-series-list">{props.round.series.length === 0 ? <span className="muted">本轮还没有对阵。</span> : props.round.series.map((series) => <div key={series.id} className="swiss-series-line"><span>{series.radiantTeam.name}</span><strong>{series.radiantScore}-{series.direScore}</strong><span>{series.direTeam.name}</span></div>)}</div>
      <div className="swiss-card-actions"><button type="button" onClick={() => void props.confirmSwissRound(props.round.id, roundDescription)} disabled={isConfirmed}><Check size={14} /> 确认本轮</button><button className="ghost-danger" type="button" onClick={() => void props.retractSwissRound(props.round.id, roundDescription)}><RotateCcw size={14} /> 撤回后续</button></div>
    </article>
  );
}

function describeSwissRoundForAction(round: StageRound) {
  const byeCount = round.byes?.length ?? 0;
  const byeText = byeCount > 0 ? `，${byeCount} 个轮空胜` : "";
  return `${round.name}（${round.series.length} 场对阵${byeText}）`;
}

function KnockoutEntryDesk(props: {
  stage: StageSummary;
  data: AdminData;
  officialStages: StageSummary[];
  allSeries: SeriesSummary[];
  availableTeams: TeamBrief[];
  load: (preferredTournamentId?: string, preferredStageId?: string) => Promise<void>;
  stageForm: StageFormState;
  setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>;
  generateBracket: () => Promise<void>;
}) {
  const isPublished = props.data.schedule?.status === "published";
  const knockoutStage = props.officialStages.find(isKnockoutStage);
  const hasBaseConfig = Boolean(props.data.schedule?.rosterLocked && props.data.schedule.preliminaryType && props.data.schedule.knockoutType);
  const entryReadiness = getKnockoutEntryReadiness(props.stage, props.data, props.allSeries, props.availableTeams);
  const patch = (patchValue: Partial<StageFormState>) => props.setStageForm((current) => ({ ...current, ...patchValue }));
  const selectedTeams = orderTeamsByIds(props.availableTeams, props.stageForm.selectedTeamIds);
  const isDoubleElimination = props.stageForm.knockoutMode === "double_elimination";
  const maxLoserTeamCount = Math.floor(props.stageForm.bracketSize / 2);
  const winnerTeamCount = isDoubleElimination
    ? clampInteger(props.stageForm.winnerTeamCount, 2, props.stageForm.bracketSize)
    : selectedTeams.length;
  const loserTeamCount = isDoubleElimination
    ? clampInteger(props.stageForm.loserTeamCount, 0, maxLoserTeamCount)
    : 0;
  const entrantTargetCount = bracketEntrantTargetCount(props.stageForm.knockoutMode, props.stageForm.bracketSize, props.stageForm.winnerTeamCount, props.stageForm.loserTeamCount);
  const missingEntrantCount = Math.max(entrantTargetCount - selectedTeams.length, 0);
  const splitCoveredCount = winnerTeamCount + loserTeamCount;
  const splitGapCount = isDoubleElimination ? Math.max(entrantTargetCount - splitCoveredCount, 0) : 0;
  const splitOverflowCount = isDoubleElimination ? Math.max(splitCoveredCount - entrantTargetCount, 0) : 0;
  const uncoveredTeamCount = isDoubleElimination
    ? Math.max(selectedTeams.length - winnerTeamCount - loserTeamCount, 0)
    : 0;
  const canGenerate = !isPublished && hasBaseConfig && !knockoutStage && selectedTeams.length >= 2 && missingEntrantCount === 0 && uncoveredTeamCount === 0 && splitGapCount === 0 && splitOverflowCount === 0;
  const bracketSizeOptions = isDoubleElimination ? [4, 8, 16] : [4, 6, 8, 16];
  const groupAdvancePreset = props.data.schedule?.knockoutType === "single_elimination" && !isDoubleElimination
    ? getGroupAdvancePreset(props.data.standings, props.availableTeams, 6)
    : null;
  const canApplyGroupAdvanceRecommendation = Boolean(groupAdvancePreset && selectedTeams.length === 0 && !isPublished);
  const applyGroupAdvancePreset = () => {
    if (!groupAdvancePreset) return;
    const willReplaceExisting = props.stageForm.selectedTeamIds.length > 0 && props.stageForm.selectedTeamIds.join("|") !== groupAdvancePreset.teamIds.join("|");
    if (willReplaceExisting && !window.confirm(`确定用${groupAdvancePreset.label}覆盖当前 ${props.stageForm.selectedTeamIds.length} 支入围队伍？`)) return;
    props.setStageForm((current) => ({
      ...current,
      knockoutMode: "single_elimination",
      bracketSize: groupAdvancePreset.targetCount,
      winnerTeamCount: groupAdvancePreset.targetCount,
      loserTeamCount: 0,
      selectedTeamIds: groupAdvancePreset.teamIds,
    }));
    window.setTimeout(() => focusElementById(KNOCKOUT_GENERATE_BUTTON_ID), 60);
  };
  const singleModeNote = props.stageForm.bracketSize === 6
    ? "6 队单败会让 1/2 号种子在半决赛等待"
    : `${props.stageForm.bracketSize} 队单败按种子顺序生成首轮`;
  const bracketStructureHint = isDoubleElimination
    ? `前 ${winnerTeamCount} 支进入胜者组，后 ${loserTeamCount} 支从败者组起步。`
    : props.stageForm.bracketSize === 6
      ? "6 队单败：入围顺序第 1/2 名直接进入半决赛，第 3 vs 第 6、第 4 vs 第 5 先打一轮。"
      : `${props.stageForm.bracketSize} 队单败：按入围顺序作为种子位生成首轮。`;
  const shouldShowStructureHint = isDoubleElimination || props.stageForm.bracketSize === 6;
  const bracketModeLabel = isDoubleElimination ? `双败 ${props.stageForm.bracketSize} 队` : props.stageForm.bracketSize === 6 ? "6 队单败" : `${props.stageForm.bracketSize} 队单败`;
  const commandBracketModeLabel = canApplyGroupAdvanceRecommendation && groupAdvancePreset ? `${groupAdvancePreset.targetCount} 队单败推荐` : bracketModeLabel;
  const entrantProgressLabel = canApplyGroupAdvanceRecommendation && groupAdvancePreset ? `推荐 ${groupAdvancePreset.targetCount} 队入围` : `${selectedTeams.length}/${entrantTargetCount} 入围`;
  const generateButtonLabel = canApplyGroupAdvanceRecommendation && groupAdvancePreset
    ? `填入推荐 ${groupAdvancePreset.targetCount} 队`
    : canGenerate
      ? `生成 ${bracketModeLabel} 对阵图`
      : isPublished
        ? "已发布不可生成"
        : !hasBaseConfig
          ? "先完成名单和赛制"
          : selectedTeams.length < 2 || missingEntrantCount > 0
            ? `还差 ${Math.max(missingEntrantCount, entrantTargetCount - selectedTeams.length)} 队`
            : uncoveredTeamCount > 0 || splitGapCount > 0 || splitOverflowCount > 0
              ? "先调整胜败分流"
              : "暂不可生成";
  const hasGroupAdvanceRecommendation = Boolean(groupAdvancePreset && selectedTeams.length === 0);
  const entrantStatus = canGenerate
    ? { tone: "good", icon: <Brackets size={16} />, title: "可以生成淘汰赛对阵图", text: `${selectedTeams.length} 支入围队伍已就绪` }
    : hasGroupAdvanceRecommendation && groupAdvancePreset
      ? { tone: "info", icon: <ShieldCheck size={16} />, title: "可按小组名次填入入围", text: `${groupAdvancePreset.label}：前 2 种子半决赛等待，点击推荐条后仍可拖拽调整` }
    : uncoveredTeamCount > 0
      ? { tone: "warn", icon: <GitBranch size={16} />, title: "入围队伍多于当前分流", text: `请增加胜者组 / 败者组数量，或移出 ${uncoveredTeamCount} 支入围队伍` }
      : splitGapCount > 0
        ? { tone: "warn", icon: <GitBranch size={16} />, title: "调整胜败组数量", text: `胜者组 + 败者组还差 ${splitGapCount} 支` }
      : splitOverflowCount > 0
        ? { tone: "warn", icon: <GitBranch size={16} />, title: "调整胜败组数量", text: `胜者组 + 败者组多了 ${splitOverflowCount} 支` }
      : selectedTeams.length < 2
        ? { tone: "warn", icon: <GripVertical size={16} />, title: "先拖入入围队伍", text: `至少 2 支队伍；当前 ${selectedTeams.length}/${entrantTargetCount}` }
        : missingEntrantCount > 0
          ? { tone: "warn", icon: <GripVertical size={16} />, title: "继续拖入入围队伍", text: `还差 ${missingEntrantCount} 支；当前 ${selectedTeams.length}/${entrantTargetCount}` }
          : { tone: "info", icon: <GripVertical size={16} />, title: "继续调整入围顺序", text: `${selectedTeams.length}/${entrantTargetCount} 支，顺序会作为初始种子` };
  const generateButtonTitle = canApplyGroupAdvanceRecommendation && groupAdvancePreset
    ? `按小组名次填入入围：${groupAdvancePreset.text}`
    : canGenerate ? `按当前入围顺序生成 ${bracketModeLabel} 对阵图草稿` : entrantStatus.text;
  const knockoutSecondaryAction = !canGenerate && !canApplyGroupAdvanceRecommendation && !isPublished
    ? (uncoveredTeamCount > 0 || splitGapCount > 0 || splitOverflowCount > 0)
      ? { label: "检查分流", targetId: "knockout-entry-settings-drawer" }
      : selectedTeams.length >= entrantTargetCount
        ? { label: "检查排序", targetId: "bracket-entrant-selected" }
        : { label: "去拖队伍", targetId: "bracket-entrant-pool" }
    : null;
  const runKnockoutPrimaryAction = () => {
    if (canApplyGroupAdvanceRecommendation) {
      applyGroupAdvancePreset();
      return;
    }
    void props.generateBracket();
  };
  const openKnockoutStage = async () => {
    if (!knockoutStage) return;
    await props.load(props.data.selectedTournamentId, knockoutStage.id);
    requestBracketNextFocus();
  };
  const updateKnockoutMode = (mode: CompetitionMode) => {
    props.setStageForm((current) => ({
      ...current,
      knockoutMode: mode,
      bracketSize: mode === "double_elimination" && current.bracketSize === 6 ? 8 : current.bracketSize,
    }));
  };
  const updateBracketSize = (nextSize: number) => {
    props.setStageForm((current) => ({
      ...current,
      bracketSize: nextSize,
      selectedTeamIds: current.selectedTeamIds.slice(
        0,
        current.knockoutMode === "double_elimination" ? nextSize + Math.floor(nextSize / 2) : nextSize,
      ),
      winnerTeamCount: Math.min(current.winnerTeamCount, nextSize),
      loserTeamCount: Math.min(current.loserTeamCount, Math.floor(nextSize / 2)),
    }));
  };
  const knockoutModeEditor = (
    <div className="knockout-entry-mode-quick">
      <div className="segmented-grid compact"><button type="button" className={props.stageForm.knockoutMode === "single_elimination" ? "is-active" : ""} onClick={() => updateKnockoutMode("single_elimination")} disabled={isPublished}>单败</button><button type="button" className={props.stageForm.knockoutMode === "double_elimination" ? "is-active" : ""} onClick={() => updateKnockoutMode("double_elimination")} disabled={isPublished}>双败</button></div>
      {isDoubleElimination ? <div className="split-inputs"><label>胜者组<input type="number" min={2} max={props.stageForm.bracketSize} value={props.stageForm.winnerTeamCount} onChange={(event) => patch({ winnerTeamCount: clampInteger(Number(event.target.value), 2, props.stageForm.bracketSize) })} disabled={isPublished} /></label><label>败者组<input type="number" min={0} max={maxLoserTeamCount} value={props.stageForm.loserTeamCount} onChange={(event) => patch({ loserTeamCount: clampInteger(Number(event.target.value), 0, maxLoserTeamCount) })} disabled={isPublished} /></label></div> : <span className="knockout-mode-pill">{singleModeNote}</span>}
    </div>
  );
  const knockoutNameEditor = (
    <label className="knockout-name-setting">阶段名称<input value={props.stageForm.knockoutName} onChange={(event) => patch({ knockoutName: event.target.value })} disabled={isPublished} /></label>
  );

  if (knockoutStage) {
    return (
      <section id="knockout-entry-desk" tabIndex={-1} className="knockout-entry-desk is-complete">
        <div className="knockout-entry-head">
          <div><strong>淘汰赛对阵图已生成</strong><small>切到淘汰赛阶段后，可以继续拖拽槽位并选择胜者。</small></div>
          <div className="knockout-entry-actions">
            <StatusPill tone="good">{knockoutStage.name}</StatusPill>
            <button type="button" className="primary-button" onClick={() => void openKnockoutStage()}><Brackets size={15} /> 打开对阵图</button>
          </div>
        </div>
      </section>
    );
  }

  if (!entryReadiness.ready) {
    const waitMetrics = getKnockoutWaitMetrics(props.stage, props.data, props.allSeries, entryReadiness.step);
    return (
      <section id="knockout-entry-desk" tabIndex={-1} className="knockout-entry-desk is-locked">
        <div className="knockout-entry-head">
          <div>
            <strong>{entryReadiness.step.title}</strong>
            <small>{entryReadiness.step.text}</small>
          </div>
          <div className="knockout-wait-action">
            <span>{entryReadiness.step.metric}</span>
            <button type="button" className="secondary-button" onClick={() => focusElementById(entryReadiness.step.targetId)}><ArrowRight size={15} /> {entryReadiness.step.actionLabel}</button>
          </div>
        </div>
        <div className="knockout-wait-strip">
          {waitMetrics.map((item) => <div key={item.label} className={item.emphasis ? "is-emphasis" : ""}><span>{item.label}</span><strong>{item.value}</strong></div>)}
        </div>
      </section>
    );
  }

  return (
    <section id="knockout-entry-desk" tabIndex={-1} className="knockout-entry-desk">
      <div className="knockout-entry-command is-drag-first">
        <div className={`knockout-entry-status is-${entrantStatus.tone}`}>
          <span>{entrantStatus.icon}</span>
          <div>
            <strong>{entrantStatus.title}</strong>
            <small>{entrantStatus.text}</small>
          </div>
        </div>
        <div className="knockout-entry-setup">
          <label>规模<select value={props.stageForm.bracketSize} onChange={(event) => updateBracketSize(Number(event.target.value))} disabled={isPublished}>{bracketSizeOptions.map((size) => <option key={size} value={size}>{size} 队</option>)}</select></label>
          <div className="knockout-size-quick" aria-label="淘汰赛规模快捷选择">
            {bracketSizeOptions.map((size) => (
              <button key={size} type="button" className={props.stageForm.bracketSize === size ? "is-active" : ""} onClick={() => updateBracketSize(size)} disabled={isPublished}>
                {size === 6 ? "6 队 · 前二半决赛" : `${size} 队`}
              </button>
            ))}
          </div>
          <div className="knockout-generate-action">
            <div><span>{canApplyGroupAdvanceRecommendation ? "推荐路径" : "生成目标"}</span><strong>{commandBracketModeLabel}</strong><small>{entrantProgressLabel}</small></div>
            <div className="knockout-generate-buttons">
              <button id={KNOCKOUT_GENERATE_BUTTON_ID} type="button" className="primary-button" onClick={runKnockoutPrimaryAction} disabled={!canGenerate && !canApplyGroupAdvanceRecommendation} title={generateButtonTitle}>{canApplyGroupAdvanceRecommendation ? <ShieldCheck size={15} /> : <Brackets size={15} />} {generateButtonLabel}</button>
              {knockoutSecondaryAction ? <button type="button" className="secondary-button" onClick={() => focusElementById(knockoutSecondaryAction.targetId)}>{knockoutSecondaryAction.label}</button> : null}
            </div>
          </div>
        </div>
      </div>
      {shouldShowStructureHint ? <div className={props.stageForm.bracketSize === 6 && !isDoubleElimination ? "knockout-structure-hint is-six-team" : "knockout-structure-hint"}>
        <Brackets size={15} />
        <span>{bracketStructureHint}</span>
      </div> : null}
      <BracketEntrantBuilder
        teams={props.availableTeams}
        selectedTeamIds={props.stageForm.selectedTeamIds}
        bracketSize={props.stageForm.bracketSize}
        targetCount={entrantTargetCount}
        isDoubleElimination={isDoubleElimination}
        winnerTeamCount={winnerTeamCount}
        loserTeamCount={loserTeamCount}
        setStageForm={props.setStageForm}
        rankingRows={props.data.standings}
        groupAdvancePreset={groupAdvancePreset}
        onApplyGroupAdvancePreset={groupAdvancePreset && !isPublished ? applyGroupAdvancePreset : undefined}
      />
      <details id="knockout-entry-settings-drawer" tabIndex={-1} className="knockout-entry-settings-drawer" open={isDoubleElimination}>
        <summary><span>赛制和分流设置</span><strong>{props.stageForm.knockoutMode === "double_elimination" ? `双败 · 胜者组 ${winnerTeamCount} / 败者组 ${loserTeamCount}` : `单败 · ${singleModeNote}`}</strong></summary>
        <div className="knockout-settings-grid">
          {knockoutNameEditor}
          {knockoutModeEditor}
        </div>
      </details>
      <details className="knockout-seed-drawer" open={!isDoubleElimination && props.stageForm.bracketSize === 6}>
        <summary><span>对阵图预览</span><strong>{!isDoubleElimination && props.stageForm.bracketSize === 6 ? "前 2 种子半决赛等待" : `${selectedTeams.length}/${props.stageForm.bracketSize} 支入围`}</strong></summary>
        <BracketSeedPreview
          bracketSize={props.stageForm.bracketSize}
          selectedTeams={selectedTeams}
          isDoubleElimination={isDoubleElimination}
          winnerTeamCount={winnerTeamCount}
          loserTeamCount={loserTeamCount}
        />
      </details>
    </section>
  );
}

function BracketCanvas(props: { stage: StageSummary; availableTeams: TeamBrief[]; bracket: BracketNode[]; setBracketSlot: (nodeId: string, slot: BracketSlotName, teamId: string | null) => Promise<void>; advanceBracketNode: (nodeId: string, winnerTeamId: string) => Promise<void> }) {
  const [teamFilter, setTeamFilter] = useState("");
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const grouped = groupBracketNodes(props.bracket);
  const nodeLookup = new Map(props.bracket.map((node) => [node.id, node]));
  const slotSummary = getBracketSlotSummary(props.bracket);
  const placedTeams = props.bracket.flatMap((node) => [node.radiantTeam, node.direTeam].filter((team): team is TeamBrief => team !== null));
  const placedIds = new Set(placedTeams.map((team) => team.id));
  const entrantTeams = getBracketEntrantTeams(props.stage, props.availableTeams, placedTeams);
  const unplacedTeams = entrantTeams.filter((team) => !placedIds.has(team.id));
  const visibleUnplacedTeams = normalizedTeamFilter ? unplacedTeams.filter((team) => matchesTeamQuery(team, normalizedTeamFilter)) : unplacedTeams;
  const readyNodes = props.bracket.filter((node) => node.winnerTeamId === null && node.radiantTeam !== null && node.direTeam !== null);
  const completedNodes = props.bracket.filter((node) => node.winnerTeamId !== null);
  const firstManualOpenSlot = slotSummary.manualOpenSlots[0] ?? null;
  const firstManualOpenSlotTargetId = firstManualOpenSlot ? bracketSlotElementId(firstManualOpenSlot.nodeId, firstManualOpenSlot.slot) : "";
  const firstManualOpenSlotLabel = formatBracketSlotTargetLabel(props.bracket, firstManualOpenSlot);
  const firstManualOpenSlotActionLabel = firstManualOpenSlot ? `填入${formatBracketSlotSideLabel(firstManualOpenSlot.slot)}` : "填入";
  const firstWaitingOpenSlot = slotSummary.waitingOpenSlots[0] ?? null;
  const firstWaitingOpenSlotTargetId = firstWaitingOpenSlot ? bracketSlotElementId(firstWaitingOpenSlot.nodeId, firstWaitingOpenSlot.slot) : "";
  const firstReadyNode = readyNodes[0] ?? null;
  const firstReadyNodeTargetId = firstReadyNode ? bracketNodeElementId(firstReadyNode.id) : "";
  const nextAction = props.bracket.length === 0
    ? { tone: "warn", icon: <Brackets size={16} />, title: "还没有淘汰赛对阵图", text: "回到预赛主画布，从排名区拖入晋级队伍并生成对阵图。", actionLabel: "查看空画布", targetId: "bracket-workbench" }
    : unplacedTeams.length > 0 && firstManualOpenSlot
      ? { tone: "warn", icon: <GripVertical size={16} />, title: "拖拽补齐首轮槽位", text: `把待落位队伍拖进高亮槽位；点击队伍会先填入 ${firstManualOpenSlotLabel}。`, actionLabel: "定位待补槽", targetId: firstManualOpenSlotTargetId }
      : readyNodes.length > 0 && firstReadyNode
        ? { tone: "info", icon: <MousePointer2 size={16} />, title: "选择每场比赛胜者", text: "双方都已落位的节点可以直接点胜者，后端会推进下一轮或掉入败者组。", actionLabel: "定位待判胜", targetId: firstReadyNodeTargetId }
        : slotSummary.waitingOpenSlotCount > 0
          ? { tone: "warn", icon: <Clock3 size={16} />, title: "等待上游比赛产生晋级队伍", text: "这些槽位会在上一轮确认胜者后自动补齐；必要时仍可手动拖拽修正。", actionLabel: "定位等待槽", targetId: firstWaitingOpenSlotTargetId || "bracket-workbench" }
          : { tone: "good", icon: <Trophy size={16} />, title: "淘汰赛当前无待处理动作", text: "对阵图节点已经处理到当前可推进状态，后续继续补 match_id 或等待比赛。", actionLabel: "查看对阵图", targetId: "bracket-workbench" };
  const focusedSlotTargetId = nextAction.targetId.startsWith("bracket-slot-") ? nextAction.targetId : "";
  const pickUnplacedTeam = firstManualOpenSlot
    ? (teamId: string) => {
      void props.setBracketSlot(firstManualOpenSlot.nodeId, firstManualOpenSlot.slot, teamId);
    }
    : undefined;
  const teamTrayHint = firstManualOpenSlot
    ? `点击队伍填入 ${firstManualOpenSlotLabel}；也可拖到任意待补槽`
    : "从槽位拖回这里可取消落位";

  useEffect(() => {
    const handleBracketFocusRequest = () => {
      window.setTimeout(() => focusElementById(nextAction.targetId), 40);
    };
    window.addEventListener(BRACKET_NEXT_FOCUS_EVENT, handleBracketFocusRequest);
    return () => window.removeEventListener(BRACKET_NEXT_FOCUS_EVENT, handleBracketFocusRequest);
  }, [nextAction.targetId]);

  return (
    <div id="bracket-workbench" tabIndex={-1} className="canvas-section bracket-workbench">
      <div className="bracket-command-strip">
        <div className={`bracket-command-status is-${nextAction.tone}`}>
          <span>{nextAction.icon}</span>
          <div>
            <strong>{nextAction.title}</strong>
            <small>{slotSummary.emptySlots > 0 ? `${slotSummary.manualOpenSlotCount} 个待补 · ${slotSummary.waitingOpenSlotCount} 个等上游 · ${readyNodes.length} 场可判胜` : `${readyNodes.length} 场可判胜 · ${completedNodes.length}/${props.bracket.length} 完成`}</small>
          </div>
        </div>
        <div className="group-filter-bar bracket-filter-bar is-command">
          <label><Search size={14} /><span>查找队伍</span><input value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} placeholder="待落位队伍" disabled={unplacedTeams.length === 0} /></label>
          <strong>{normalizedTeamFilter ? `${visibleUnplacedTeams.length}/${unplacedTeams.length}` : `${unplacedTeams.length} 支`}</strong>
          {normalizedTeamFilter ? <button type="button" onClick={() => setTeamFilter("")}>清除</button> : null}
        </div>
        <div className="bracket-command-actions">
          <div><span>{slotSummary.manualOpenSlotCount > 0 ? "需手动" : slotSummary.waitingOpenSlotCount > 0 ? "等上游" : "已落位"}</span><strong>{slotSummary.manualOpenSlotCount > 0 ? slotSummary.manualOpenSlotCount : slotSummary.waitingOpenSlotCount > 0 ? slotSummary.waitingOpenSlotCount : `${slotSummary.filledSlots}/${slotSummary.totalSlots}`}</strong>{firstManualOpenSlotLabel ? <small>下一槽：{firstManualOpenSlotLabel}</small> : null}</div>
          <button type="button" onClick={() => focusElementById(nextAction.targetId)}>{nextAction.actionLabel}</button>
        </div>
      </div>
      <div className="drag-canvas bracket-canvas">
        <TeamTray
          teams={visibleUnplacedTeams}
          totalCount={unplacedTeams.length}
          title="待落位队伍"
          emptyText={normalizedTeamFilter ? "待落位池无匹配队伍" : "所有入围队伍都已在图中"}
          dropId="bracket-pool"
          dropHint={teamTrayHint}
          onPickTeam={pickUnplacedTeam}
          actionLabel={firstManualOpenSlotActionLabel}
        />
        <div className="bracket-board">
          {grouped.length === 0 ? <EmptyPanel title="还没有淘汰赛对阵图" text="回到预赛主画布，从排名区拖入晋级队伍并生成对阵图。" /> : null}
          {grouped.map((column) => {
            const completeCount = column.nodes.filter((node) => node.winnerTeamId !== null).length;
            return (
              <section key={column.key} className="bracket-column">
                <div className="bracket-column-head">
                  <strong>{column.roundName}</strong>
                  <small>{completeCount}/{column.nodes.length} 完成</small>
                </div>
                {column.nodes.map((node) => <BracketNodeCard key={node.id} nodeLookup={nodeLookup} node={node} incomingSlotKeys={slotSummary.incomingSlotKeys} focusNodeId={firstReadyNodeTargetId} focusSlotId={focusedSlotTargetId} setBracketSlot={props.setBracketSlot} advanceBracketNode={props.advanceBracketNode} />)}
              </section>
            );
          })}
        </div>
      </div>
      <details className="bracket-status-drawer">
        <summary>
          <span>对阵图状态</span>
          <strong>{slotSummary.manualOpenSlotCount} 待补 · {slotSummary.waitingOpenSlotCount} 等上游 · {readyNodes.length} 可判胜</strong>
        </summary>
        <div className="bracket-summary-strip">
          <div><span>已落位</span><strong>{slotSummary.filledSlots}/{slotSummary.totalSlots}</strong></div>
          <div><span>待落位队伍</span><strong>{unplacedTeams.length}</strong></div>
          <div><span>可判胜</span><strong>{readyNodes.length}</strong></div>
          <div><span>待手动槽</span><strong>{slotSummary.manualOpenSlotCount}</strong></div>
          <div><span>等上游槽</span><strong>{slotSummary.waitingOpenSlotCount}</strong></div>
        </div>
        <div className={`bracket-next-card is-${nextAction.tone}`}>
          {nextAction.icon}
          <div>
            <strong>{nextAction.title}</strong>
            <small>{nextAction.text}</small>
          </div>
          <button type="button" onClick={() => focusElementById(nextAction.targetId)}>{nextAction.actionLabel}</button>
        </div>
      </details>
    </div>
  );
}

function BracketNodeCard(props: { node: BracketNode; nodeLookup: Map<string, BracketNode>; incomingSlotKeys: Set<string>; focusNodeId: string; focusSlotId: string; setBracketSlot: (nodeId: string, slot: BracketSlotName, teamId: string | null) => Promise<void>; advanceBracketNode: (nodeId: string, winnerTeamId: string) => Promise<void> }) {
  const radiantTeam = props.node.radiantTeam;
  const direTeam = props.node.direTeam;
  const canPick = props.node.winnerTeamId === null && radiantTeam !== null && direTeam !== null;
  const winnerTeam = [radiantTeam, direTeam].find((team) => team?.id === props.node.winnerTeamId) ?? null;
  const radiantWaitsForUpstream = radiantTeam === null && props.incomingSlotKeys.has(bracketSlotKey(props.node.id, "radiant"));
  const direWaitsForUpstream = direTeam === null && props.incomingSlotKeys.has(bracketSlotKey(props.node.id, "dire"));
  const missingManualSlots = [
    props.node.radiantTeam || radiantWaitsForUpstream ? "" : "上位",
    props.node.direTeam || direWaitsForUpstream ? "" : "下位",
  ].filter(Boolean).join("、");
  const waitingSlots = [
    radiantWaitsForUpstream ? "上位" : "",
    direWaitsForUpstream ? "下位" : "",
  ].filter(Boolean).join("、");
  const matchIds = props.node.series?.games.map((game) => game.matchId).filter((matchId): matchId is number => matchId !== null) ?? [];
  const nodeId = bracketNodeElementId(props.node.id);
  const waitsOnlyForUpstream = !winnerTeam && !canPick && !missingManualSlots && Boolean(waitingSlots);
  const nodeStatusLabel = props.node.winnerTeamId ? "已完成" : canPick ? "待选胜者" : waitsOnlyForUpstream ? "等上游" : "待落位";
  const nodeStatusTone: Tone = props.node.winnerTeamId ? "good" : canPick ? "warn" : waitsOnlyForUpstream ? "info" : "neutral";
  const winnerTargetText = formatBracketTarget(props.nodeLookup, props.node.nextNodeId, props.node.nextSlot);
  const loserTargetText = props.node.loserNextNodeId ? formatBracketTarget(props.nodeLookup, props.node.loserNextNodeId, props.node.loserNextSlot) : "淘汰";
  const describeWinnerChoice = (team: TeamBrief, opponent: TeamBrief) => {
    const loserText = loserTargetText === "淘汰" ? `${opponent.name} 淘汰` : `${opponent.name} 进入 ${loserTargetText}`;
    return `${team.name} 获胜：${team.name} 进入 ${winnerTargetText}，${loserText}`;
  };
  const nodeClass = [
    props.node.winnerTeamId ? "bracket-node is-complete" : canPick ? "bracket-node is-ready" : "bracket-node",
    waitsOnlyForUpstream ? "is-waiting-upstream" : "",
    props.focusNodeId === nodeId ? "is-next-target" : "",
  ].filter(Boolean).join(" ");

  return (
    <article id={nodeId} tabIndex={-1} className={nodeClass}>
      <div className="bracket-node-head">
        <span>#{props.node.position}</span>
        <StatusPill tone={nodeStatusTone}>{nodeStatusLabel}</StatusPill>
      </div>
      <div className="bracket-node-meta">
        <span>{props.node.series ? `${props.node.series.boType} · ${formatDate(props.node.series.scheduledAt)}` : "尚未生成对阵记录"}</span>
        <span>{matchIds.length > 0 ? `match ${matchIds.join(" / ")}` : "match_id 可后补"}</span>
      </div>
      <BracketSlot
        node={props.node}
        slot="radiant"
        team={radiantTeam}
        canPick={canPick}
        isWinner={props.node.winnerTeamId === radiantTeam?.id}
        isWaitingForUpstream={radiantWaitsForUpstream}
        focusSlotId={props.focusSlotId}
        setBracketSlot={props.setBracketSlot}
      />
      <BracketSlot
        node={props.node}
        slot="dire"
        team={direTeam}
        canPick={canPick}
        isWinner={props.node.winnerTeamId === direTeam?.id}
        isWaitingForUpstream={direWaitsForUpstream}
        focusSlotId={props.focusSlotId}
        setBracketSlot={props.setBracketSlot}
      />
      {canPick && radiantTeam && direTeam ? (
        <div className="bracket-result-strip">
          <span>选择胜者</span>
          <div className="bracket-result-actions">
            <button type="button" onClick={() => void props.advanceBracketNode(props.node.id, radiantTeam.id)} title={describeWinnerChoice(radiantTeam, direTeam)} aria-label={describeWinnerChoice(radiantTeam, direTeam)}>
              <Check size={13} /><strong>{radiantTeam.name}</strong><small>胜</small>
            </button>
            <button type="button" onClick={() => void props.advanceBracketNode(props.node.id, direTeam.id)} title={describeWinnerChoice(direTeam, radiantTeam)} aria-label={describeWinnerChoice(direTeam, radiantTeam)}>
              <Check size={13} /><strong>{direTeam.name}</strong><small>胜</small>
            </button>
          </div>
        </div>
      ) : null}
      {winnerTeam ? <div className="bracket-winner-line"><Trophy size={14} /><span>{winnerTeam.name} 已晋级</span></div> : null}
      {!winnerTeam && !canPick && missingManualSlots ? <div className="bracket-missing-line">等待 {missingManualSlots} 手动落位</div> : null}
      {!winnerTeam && !canPick && !missingManualSlots && waitingSlots ? <div className="bracket-missing-line is-upstream">等待 {waitingSlots} 上游胜者</div> : null}
      <div className={canPick ? "bracket-flow-row is-action-hint" : "bracket-flow-row"}>
        <span>{canPick ? "点胜者后：胜者 -> " : "胜者 -> "}{winnerTargetText}</span>
        <span>{"负者 -> "}{loserTargetText}</span>
      </div>
    </article>
  );
}

function BracketSlot(props: {
  node: BracketNode;
  slot: BracketSlotName;
  team: TeamBrief | null;
  canPick: boolean;
  isWinner: boolean;
  isWaitingForUpstream: boolean;
  focusSlotId: string;
  setBracketSlot: (nodeId: string, slot: BracketSlotName, teamId: string | null) => Promise<void>;
}) {
  const team = props.team;
  const { isOver, setNodeRef } = useDroppable({ id: `slot:${props.node.id}:${props.slot}`, disabled: props.node.winnerTeamId !== null });
  const isLocked = props.node.winnerTeamId !== null;
  const slotElementId = bracketSlotElementId(props.node.id, props.slot);
  const isNextTarget = props.focusSlotId === slotElementId;
  const sideLabel = formatBracketSlotSideLabel(props.slot);
  const placedTeamDragLabel = team && !isLocked ? `拖拽 ${team.name} 到其它槽位交换，或拖回待落位队伍池移出` : undefined;
  const className = [
    "bracket-slot",
    props.slot === "radiant" ? "is-radiant" : "is-dire",
    isOver ? "is-over" : "",
    isLocked ? "is-locked" : "",
    props.isWaitingForUpstream ? "is-waiting-upstream" : "",
    team ? "has-team" : "is-empty",
    props.canPick ? "can-pick-winner" : "",
    props.isWinner ? "is-winner" : "",
    isNextTarget ? "is-next-target" : "",
  ].filter(Boolean).join(" ");
  const emptyTitle = props.isWaitingForUpstream ? "等待上游胜者" : isNextTarget ? `下一槽 · ${sideLabel}` : "拖入队伍";
  const emptyHint = props.isWaitingForUpstream ? "上一场判胜后自动进入，也可手动修正" : isNextTarget ? "拖队伍到这里，或点待落位队伍填入这里" : "从待落位队伍池拖入";
  return (
    <div id={slotElementId} tabIndex={-1} ref={setNodeRef} className={className} aria-label={`${sideLabel}槽位：${team ? team.name : emptyTitle}`}>
      <div className="bracket-slot-label">
        <span>{sideLabel}</span>
        {props.isWinner ? <strong>胜者</strong> : null}
        {props.isWaitingForUpstream ? <strong>等上游</strong> : null}
        {team && !isLocked && !props.isWinner ? <strong>可调整</strong> : null}
      </div>
      {team ? (
        <div className="bracket-slot-team">
          <DraggableTeam team={team} dragId={`team:${team.id}:slot:${props.node.id}:${props.slot}`} source={{ kind: "bracketSlot", nodeId: props.node.id, slot: props.slot }} disabled={isLocked} {...(placedTeamDragLabel ? { dragOnlyLabel: placedTeamDragLabel } : {})} />
        </div>
      ) : (
        <div className="slot-placeholder">
          <strong className="slot-placeholder-text">{emptyTitle}</strong>
          <small>{emptyHint}</small>
        </div>
      )}
      <div className="bracket-slot-actions">
        {team && !isLocked ? <button type="button" className="slot-clear-button" aria-label={`清空${props.slot === "radiant" ? "上位" : "下位"}队伍`} onClick={() => void props.setBracketSlot(props.node.id, props.slot, null)}><Trash2 size={12} /></button> : null}
        {isLocked && !props.isWinner ? <em>已锁定</em> : null}
      </div>
    </div>
  );
}

function bracketNodeElementId(nodeId: string): string {
  return `bracket-node-${nodeId}`;
}

function bracketSlotElementId(nodeId: string, slot: BracketSlotName): string {
  return `bracket-slot-${nodeId}-${slot}`;
}

function formatBracketSlotSideLabel(slot: BracketSlotName): string {
  return slot === "radiant" ? "上位" : "下位";
}

function formatBracketSlotTargetLabel(nodes: BracketNode[], target: { nodeId: string; slot: BracketSlotName } | null): string {
  if (!target) return "";
  const node = nodes.find((item) => item.id === target.nodeId);
  const sideLabel = formatBracketSlotSideLabel(target.slot);
  if (!node) return sideLabel;
  return `${groupLabel(node.bracketGroup, node.roundName)} #${node.position} ${sideLabel}`;
}

function getBracketEntrantTeams(stage: StageSummary, availableTeams: TeamBrief[], placedTeams: TeamBrief[]): TeamBrief[] {
  const teamLookup = new Map<string, TeamBrief>();
  for (const team of [...availableTeams, ...placedTeams]) {
    teamLookup.set(team.id, team);
  }

  const entrantIds = stageConfigStringList(stage, "teamIds");
  if (entrantIds.length > 0) {
    return entrantIds.map((id) => teamLookup.get(id)).filter((team): team is TeamBrief => team !== undefined);
  }

  return availableTeams;
}

function stageConfigStringList(stage: StageSummary, key: string): string[] {
  const value = stage.config?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function stageConfigPositiveInteger(stage: StageSummary, key: string): number | null {
  const value = stage.config?.[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function StandingsTable({ rows, seriesCount, emptyStep, resetManualRanks }: { rows: StandingRow[]; seriesCount: number; emptyStep?: StageNextStep; resetManualRanks: () => Promise<void> }) {
  const hasSeries = seriesCount > 0;
  const hasManualRank = rows.some((row) => row.manualRank !== null && row.manualRank !== undefined);
  const manualRankCount = rows.filter((row) => row.manualRank !== null && row.manualRank !== undefined).length;
  const recordCounts = rows.reduce((counts, row) => {
    const key = `${row.groupName ?? ""}:${row.points}:${row.seriesWins}:${row.seriesDraws}:${row.seriesLosses}:${row.gameWins}:${row.gameLosses}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const tiedRecordGroupCount = hasSeries ? Array.from(recordCounts.values()).filter((count) => count > 1).length : 0;
  const rankingTitle = rows.length === 0
    ? "暂无排名"
    : !hasSeries
      ? "排赛后再处理排名"
    : hasManualRank
      ? "手动排序已生效"
      : tiedRecordGroupCount > 0
        ? "存在同战绩，可拖动排序"
        : "自动排序中";
  const rankingHint = rows.length === 0
    ? "录入赛果后，后端会生成积分和排名。"
    : !hasSeries
      ? "当前只有名单或分组，还没有对阵赛果；先完成排赛，排名会在赛果录入后用于晋级。"
    : hasManualRank
      ? "绿色名次为管理员手动覆盖；需要回到积分规则时恢复自动排序。"
      : "拖动左侧手柄即可手动覆盖名次，适合同分加赛后的最终排序。";
  const commandTone: Tone = rows.length === 0 || !hasSeries ? "neutral" : hasManualRank ? "warn" : tiedRecordGroupCount > 0 ? "info" : "good";
  return (
    <section className="data-panel">
      <div className="panel-kicker ranking-kicker"><span><Trophy size={15} /> 积分 / 排名</span></div>
      <div className={`ranking-command-strip is-${commandTone}`}>
        <div className="ranking-command-status">
          <span>{hasManualRank ? <GripVertical size={15} /> : <Trophy size={15} />}</span>
          <div><strong>{rankingTitle}</strong><small>{rankingHint}</small></div>
        </div>
        <div className="ranking-command-metrics" aria-label="排名状态">
          <div><span>队伍</span><strong>{rows.length}</strong></div>
          <div><span>对阵</span><strong>{seriesCount}</strong></div>
          <div><span>同战绩</span><strong>{tiedRecordGroupCount}</strong></div>
        </div>
        {hasSeries && rows.length > 0 ? <button type="button" onClick={() => void resetManualRanks()} disabled={!hasManualRank}><RotateCcw size={14} /> 恢复自动排序</button> : null}
      </div>
      {rows.length === 0 ? (
        <div className="ranking-empty-note">
          <CalendarClock size={15} />
          <div><strong>当前阶段暂无排名</strong><span>创建并录入赛果后，后端会生成积分和排名。</span></div>
          {emptyStep ? <button type="button" onClick={() => focusElementById(emptyStep.targetId)}><ArrowRight size={14} /> {emptyStep.actionLabel}</button> : null}
        </div>
      ) : !hasSeries ? (
        <div className="ranking-empty-note">
          <CalendarClock size={15} />
          <div><strong>先完成排赛</strong><span>{rows.length} 支队伍已进入排名池；创建并录入赛果后，这里会变成可拖动排序的积分榜。</span></div>
          {emptyStep ? <button type="button" onClick={() => focusElementById(emptyStep.targetId)}><ArrowRight size={14} /> {emptyStep.actionLabel}</button> : null}
        </div>
      ) : (
        <table className="standings-table">
          <thead><tr><th>拖动</th><th>#</th><th>队伍</th><th>赛果</th><th>小分</th><th>积分</th></tr></thead>
          <SortableContext items={rows.map((row) => `rank:${standingTeamId(row) || row.rank}`)} strategy={verticalListSortingStrategy}>
            <tbody>{rows.map((row) => <SortableStandingRow key={standingTeamId(row) || row.rank} row={row} />)}</tbody>
          </SortableContext>
        </table>
      )}
    </section>
  );
}

function SortableStandingRow({ row }: { row: StandingRow }) {
  const id = standingTeamId(row) || `row-${row.rank}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `rank:${id}` });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? "standing-row is-dragging" : "standing-row"}>
      <td><button type="button" className="rank-drag-handle" {...attributes} {...listeners}><GripVertical size={13} /></button></td>
      <td>{row.manualRank ? <span className="manual-rank-badge">{row.rank}</span> : row.rank}</td>
      <td>{row.team?.name ?? row.teamId}</td>
      <td>{row.seriesWins}-{row.seriesDraws}-{row.seriesLosses}</td>
      <td>{row.gameWins}-{row.gameLosses}</td>
      <td>{row.points}</td>
    </tr>
  );
}

function SeriesList({
  rounds,
  series,
  emptyStep,
  highlightSeriesId,
  editingSeriesId,
  updateSeriesResult,
  updateSeriesScheduledAt,
  updateSeriesGameMatchId,
  deleteSeries,
  startEditSeries,
}: {
  rounds: StageRound[];
  series: SeriesSummary[];
  emptyStep?: StageNextStep;
  highlightSeriesId: string;
  editingSeriesId: string;
  updateSeriesResult: (seriesId: string, radiantScore: number, direScore: number) => Promise<boolean>;
  updateSeriesScheduledAt: (seriesId: string, scheduledAt: string) => Promise<boolean>;
  updateSeriesGameMatchId: (seriesId: string, gameIndex: number, matchId: number | null) => Promise<boolean>;
  deleteSeries: (seriesId: string, description?: string) => Promise<void>;
  startEditSeries: (series: SeriesSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<SeriesFilterMode>("all");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!highlightSeriesId) return;
    setQuery("");
    setFilterMode("all");
  }, [highlightSeriesId]);

  useEffect(() => {
    const handleFocusRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ seriesId: string | null; filterMode?: SeriesFilterMode }>).detail ?? { seriesId: null };
      setQuery("");
      setFilterMode(detail.filterMode ?? "all");
      window.setTimeout(() => {
        focusElementById(detail.seriesId ? seriesRowElementId(detail.seriesId) : "stage-series-list");
      }, 60);
    };
    window.addEventListener(SERIES_FOCUS_EVENT, handleFocusRequest);
    return () => window.removeEventListener(SERIES_FOCUS_EVENT, handleFocusRequest);
  }, []);

  const filterSeries = (items: SeriesSummary[]) => items
    .filter((item) => matchesSeriesQuery(item, normalizedQuery))
    .filter((item) => seriesMatchesFilterMode(item, filterMode))
    .sort(compareSeriesTodoPriority);
  const blocks = rounds
    .map((round) => ({ round, series: filterSeries(round.series) }))
    .filter((block) => block.series.length > 0);
  const knownSeriesIds = new Set(rounds.flatMap((round) => round.series.map((item) => item.id)));
  const looseSeries = filterSeries(series.filter((item) => !knownSeriesIds.has(item.id)));
  const visibleCount = blocks.reduce((sum, block) => sum + block.series.length, 0) + looseSeries.length;
  const completedResultCount = series.filter(seriesHasResult).length;
  const scheduledTimeCount = series.filter((item) => Boolean(item.scheduledAt)).length;
  const pendingResultCount = series.filter(seriesNeedsResult).length;
  const matchSlotCount = series.reduce((sum, item) => sum + item.games.length, 0);
  const linkedMatchCount = series.reduce((sum, item) => sum + item.games.filter((game) => game.matchId !== null && game.matchId !== undefined).length, 0);
  const missingMatchCount = series.reduce((sum, item) => sum + countMissingSeriesMatchIds(item), 0);
  const missingMatchSeriesCount = series.filter((item) => countMissingSeriesMatchIds(item) > 0).length;
  const todoCount = series.filter((item) => seriesNeedsResult(item) || countMissingSeriesMatchIds(item) > 0).length;
  const pendingResultStep = getPendingSeriesResultStep(series);
  const missingMatchStep = getMissingSeriesMatchIdStep(series);
  const firstTodoStep = pendingResultStep ?? missingMatchStep;
  const filterOptions: Array<{ mode: SeriesFilterMode; label: string; count: number }> = [
    { mode: "all", label: "全部", count: series.length },
    { mode: "todo", label: "待办", count: todoCount },
    { mode: "result", label: "待赛果", count: pendingResultCount },
    { mode: "match", label: "缺 ID", count: missingMatchSeriesCount },
  ];
  const hasSeries = series.length > 0;
  const locateFirstTodo = () => {
    const seriesId = firstTodoStep?.seriesId;
    setFilterMode(firstTodoStep?.seriesFilterMode ?? "todo");
    setQuery("");
    if (!seriesId) return;
    window.setTimeout(() => focusElementById(seriesRowElementId(seriesId)), 40);
  };
  const locateTodoLabel = pendingResultStep ? "定位待赛果" : missingMatchStep ? "定位缺 ID" : "定位待处理";
  const commandTone: Tone = !hasSeries ? emptyStep?.tone ?? "neutral" : pendingResultCount > 0 ? "warn" : missingMatchCount > 0 ? "info" : "good";
  const commandTitle = !hasSeries
    ? emptyStep?.title ?? "暂无阶段赛程"
    : pendingResultCount > 0
      ? "先处理待补赛果"
      : missingMatchCount > 0
        ? "继续补 Dota2 match_id"
        : "赛果和 match_id 已处理";
  const commandHint = !hasSeries
    ? emptyStep?.text ?? "创建对阵后，这里会变成赛果处理台。"
    : pendingResultCount > 0
      ? pendingResultStep?.text ?? `${pendingResultCount} 场还没有比分，先点左胜 / 平局 / 右胜，特殊情况再进编辑。`
      : missingMatchCount > 0
        ? missingMatchStep?.text ?? `还有 ${missingMatchCount} 个单局槽位没有 match_id。`
        : "当前阶段没有明显待处理项。";

  return (
    <section className="data-panel">
      <div className="panel-kicker"><Activity size={15} /> 阶段赛程</div>
      <div className={hasSeries ? "series-command-strip" : "series-command-strip is-empty"}>
        <div className={`series-command-status is-${commandTone}`}>
          <span>{!hasSeries ? emptyStep?.icon ?? <CalendarClock size={15} /> : pendingResultCount > 0 ? <ClipboardCheck size={15} /> : missingMatchCount > 0 ? <Link2 size={15} /> : <Check size={15} />}</span>
          <div>
            <strong>{commandTitle}</strong>
            <small>{commandHint}</small>
          </div>
        </div>
        {hasSeries ? (
          <>
            <div className="series-command-metrics" aria-label="阶段赛程处理进度">
              <div><span>赛果</span><strong>{completedResultCount}/{series.length}</strong></div>
              <div><span>时间</span><strong>{scheduledTimeCount}/{series.length}</strong></div>
              <div><span>待补</span><strong>{pendingResultCount}</strong></div>
              <div><span>match_id</span><strong>{linkedMatchCount}/{matchSlotCount}</strong></div>
            </div>
            <div className="series-command-search">
              <label><Search size={14} /><span>查找</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="队伍或 match_id" /></label>
              <strong>{normalizedQuery ? `${visibleCount}/${series.length}` : `${series.length} 场`}</strong>
              {normalizedQuery ? <button type="button" onClick={() => setQuery("")}>清除</button> : null}
              {firstTodoStep ? <button type="button" onClick={locateFirstTodo}>{locateTodoLabel}</button> : null}
            </div>
          </>
        ) : (
          <div className="series-command-empty-action">
            <div><span>下一步</span><strong>{emptyStep?.metric ?? "创建对阵"}</strong></div>
            {emptyStep ? <button type="button" onClick={() => focusElementById(emptyStep.targetId)}><ArrowRight size={15} /> {emptyStep.actionLabel}</button> : null}
          </div>
        )}
      </div>
      {hasSeries ? (
        <div className="series-filter-tabs" role="tablist" aria-label="阶段赛程筛选">
          {filterOptions.map((option) => (
            <button
              key={option.mode}
              type="button"
              className={filterMode === option.mode ? "is-active" : ""}
              onClick={() => setFilterMode(option.mode)}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </div>
      ) : null}
      {hasSeries ? (
        <div className="series-round-list">
          {visibleCount === 0 ? <p className="muted">{filterMode === "all" ? "没有匹配的对阵。" : "当前筛选下没有待处理对阵。"}</p> : null}
          {blocks.map((block) => (
            <section key={block.round.id} className="series-round-block">
              <div className="series-round-head"><strong>{block.round.name}</strong><span>{block.series.length} 场</span></div>
              <div className="series-list">
                {block.series.map((item) => <SeriesRow key={item.id} item={item} allSeries={series} isRecent={item.id === highlightSeriesId} isEditing={item.id === editingSeriesId} expandMatchIds={filterMode === "match"} afterResultFocus={getAfterResultFocusTarget(item, series)} updateSeriesResult={updateSeriesResult} updateSeriesScheduledAt={updateSeriesScheduledAt} updateSeriesGameMatchId={updateSeriesGameMatchId} deleteSeries={deleteSeries} startEditSeries={startEditSeries} />)}
              </div>
            </section>
          ))}
          {looseSeries.length > 0 ? (
            <section className="series-round-block">
              <div className="series-round-head"><strong>未归档轮次</strong><span>{looseSeries.length} 场</span></div>
              <div className="series-list">
                {looseSeries.map((item) => <SeriesRow key={item.id} item={item} allSeries={series} isRecent={item.id === highlightSeriesId} isEditing={item.id === editingSeriesId} expandMatchIds={filterMode === "match"} afterResultFocus={getAfterResultFocusTarget(item, series)} updateSeriesResult={updateSeriesResult} updateSeriesScheduledAt={updateSeriesScheduledAt} updateSeriesGameMatchId={updateSeriesGameMatchId} deleteSeries={deleteSeries} startEditSeries={startEditSeries} />)}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SeriesRow({
  item,
  allSeries,
  isRecent,
  isEditing,
  expandMatchIds,
  afterResultFocus,
  updateSeriesResult,
  updateSeriesScheduledAt,
  updateSeriesGameMatchId,
  deleteSeries,
  startEditSeries,
}: {
  item: SeriesSummary;
  allSeries: SeriesSummary[];
  isRecent: boolean;
  isEditing: boolean;
  expandMatchIds: boolean;
  afterResultFocus: SeriesFocusTarget;
  updateSeriesResult: (seriesId: string, radiantScore: number, direScore: number) => Promise<boolean>;
  updateSeriesScheduledAt: (seriesId: string, scheduledAt: string) => Promise<boolean>;
  updateSeriesGameMatchId: (seriesId: string, gameIndex: number, matchId: number | null) => Promise<boolean>;
  deleteSeries: (seriesId: string, description?: string) => Promise<void>;
  startEditSeries: (series: SeriesSummary) => void;
}) {
  const needsResult = seriesNeedsResult(item);
  const missingMatchIds = countMissingSeriesMatchIds(item);
  const needsTime = !item.scheduledAt;
  const rowClassName = ["series-row", needsResult ? "is-needs-result" : "", missingMatchIds > 0 ? "is-missing-match" : "", needsTime ? "is-missing-time" : "", isRecent ? "is-recent" : "", isEditing ? "is-editing" : ""].filter(Boolean).join(" ");
  const scoreText = needsResult ? "待录" : `${item.radiantScore} - ${item.direScore}`;
  const scoreTitle = needsResult ? "尚未录入管理员赛果" : `当前比分 ${scoreText}`;
  const deleteDescription = `${item.radiantTeam.name} vs ${item.direTeam.name}（${scoreText}，${item.groupName ?? item.boType}）`;
  const quickResults = quickResultOptions(item.boType).map((option) => ({
    ...option,
    label: quickResultLabel(option),
    title: quickResultTitle(item, option),
    tone: quickResultTone(option),
    isCurrent: !needsResult && item.radiantScore === option.radiant && item.direScore === option.dire,
  }));
  const recordQuickResult = async (radiantScore: number, direScore: number) => {
    const ok = await updateSeriesResult(item.id, radiantScore, direScore);
    if (!ok) return;
    requestSeriesListFocus(afterResultFocus.seriesId, afterResultFocus.filterMode);
  };
  return (
    <div id={seriesRowElementId(item.id)} tabIndex={-1} className={rowClassName}>
      <div className="series-team is-left" title={item.radiantTeam.name}><span>左</span><strong>{item.radiantTeam.name}</strong></div>
      <strong className={needsResult ? "series-score is-pending" : "series-score"} title={scoreTitle}>{scoreText}</strong>
      <div className="series-team is-right" title={item.direTeam.name}><strong>{item.direTeam.name}</strong><span>右</span></div>
      <small>{item.groupName ?? item.boType} · {formatDate(item.scheduledAt)} · {labelSeriesStatus(item.status)}</small>
      {isRecent ? <span className="series-recent-badge"><Check size={12} /> 刚创建，下一步补赛果或 match_id</span> : null}
      {isEditing ? <span className="series-editing-badge"><ClipboardCheck size={12} /> 正在编辑这场</span> : null}
      {(needsResult || needsTime || missingMatchIds > 0) ? <div className="series-row-flags">{needsResult ? <span className="is-warn">待补赛果</span> : null}{needsTime ? <span className="is-time">时间待定</span> : null}{missingMatchIds > 0 ? <span className="is-info">缺 {missingMatchIds} 个 match_id</span> : null}</div> : null}
      <SeriesTimeEditor series={item} updateSeriesScheduledAt={updateSeriesScheduledAt} />
      <SeriesGameLinker series={item} allSeries={allSeries} defaultOpen={expandMatchIds && missingMatchIds > 0} updateSeriesGameMatchId={updateSeriesGameMatchId} />
      <div className="series-actions" aria-label="快速录入赛果">
        <span className="series-actions-label">赛果</span>
        {quickResults.map((option) => (
          <button
            key={`${option.radiant}-${option.dire}`}
            type="button"
            className={`series-result-button is-${option.tone}${option.isCurrent ? " is-current-result" : ""}`}
            aria-pressed={option.isCurrent}
            onClick={() => void recordQuickResult(option.radiant, option.dire)}
            title={option.isCurrent ? `${option.title}（当前赛果）` : option.title}
          >
            {option.isCurrent ? <Check size={12} /> : null}{option.label}
          </button>
        ))}
        <span className="series-actions-spacer" />
        <button type="button" className="series-edit-button" onClick={() => startEditSeries(item)} disabled={isEditing} aria-current={isEditing ? "true" : undefined}>{isEditing ? "正在编辑" : "编辑"}</button>
        <button className="ghost-danger" type="button" onClick={() => void deleteSeries(item.id, deleteDescription)} title={`删除 ${deleteDescription}`} aria-label={`删除 ${deleteDescription}`}>删除</button>
      </div>
    </div>
  );
}

function SeriesTimeEditor({ series, updateSeriesScheduledAt }: { series: SeriesSummary; updateSeriesScheduledAt: (seriesId: string, scheduledAt: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(() => toDatetimeLocalInput(series.scheduledAt));
  const [saving, setSaving] = useState(false);
  const currentValue = toDatetimeLocalInput(series.scheduledAt);
  const isDirty = draft !== currentValue;

  useEffect(() => {
    setDraft(toDatetimeLocalInput(series.scheduledAt));
    setSaving(false);
  }, [series.id, series.scheduledAt]);

  const save = async (nextDraft = draft) => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = nextDraft ? serializeDatetimeLocal(nextDraft) : "";
      const ok = await updateSeriesScheduledAt(series.id, payload);
      if (!ok) setSaving(false);
    } catch {
      setSaving(false);
    }
  };

  const clear = () => {
    setDraft("");
    void save("");
  };

  return (
    <div className={series.scheduledAt ? "series-time-editor" : "series-time-editor is-empty"}>
      <label>
        <CalendarClock size={13} aria-hidden="true" />
        <span>对阵时间</span>
        <input
          type="datetime-local"
          value={draft}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`设置对阵时间：${series.radiantTeam.name} vs ${series.direTeam.name}`}
        />
      </label>
      <button type="button" className="series-time-save" onClick={() => void save()} disabled={saving || !isDirty}>
        {saving ? "保存中..." : series.scheduledAt ? "更新时间" : "保存时间"}
      </button>
      {series.scheduledAt ? <button type="button" className="series-time-clear" onClick={clear} disabled={saving}>清空</button> : null}
    </div>
  );
}

function SeriesGameLinker({ series, allSeries, defaultOpen, updateSeriesGameMatchId }: { series: SeriesSummary; allSeries: SeriesSummary[]; defaultOpen: boolean; updateSeriesGameMatchId: (seriesId: string, gameIndex: number, matchId: number | null) => Promise<boolean> }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => seriesGameDrafts(series));
  const [error, setError] = useState("");
  const gameSignature = series.games.map((game) => `${game.gameIndex}:${game.matchId ?? ""}`).join("|");
  const linkedMatchCount = series.games.filter((game) => game.matchId !== null && game.matchId !== undefined).length;
  const missingMatchCount = Math.max(series.games.length - linkedMatchCount, 0);

  useEffect(() => {
    setDrafts(seriesGameDrafts(series));
    setError("");
  }, [series.id, gameSignature]);

  if (series.games.length === 0) {
    return <div className="series-game-strip is-empty"><span>暂无单局槽位</span></div>;
  }

  const saveMatchId = async (gameIndex: number) => {
    const rawValue = drafts[String(gameIndex)]?.trim() ?? "";
    const nextFocus = getAfterMatchIdFocusTarget(series, allSeries, gameIndex, rawValue === "");
    if (rawValue === "") {
      setError("");
      const ok = await updateSeriesGameMatchId(series.id, gameIndex, null);
      if (ok) requestMatchIdFocus(nextFocus);
      return;
    }
    const matchId = Number(rawValue);
    if (!Number.isSafeInteger(matchId) || matchId <= 0) {
      setError("match_id 必须是正整数");
      return;
    }
    setError("");
    const ok = await updateSeriesGameMatchId(series.id, gameIndex, matchId);
    if (ok) requestMatchIdFocus(nextFocus);
  };

  return (
    <details className={missingMatchCount > 0 ? "series-game-strip is-missing" : "series-game-strip"} {...(defaultOpen ? { open: true } : {})}>
      <summary className="game-strip-head">
        <span><Link2 size={13} /> Dota2 match_id</span>
        <strong>{linkedMatchCount}/{series.games.length}</strong>
        <small>{missingMatchCount > 0 ? `缺 ${missingMatchCount} 个，展开补录` : "已关联，可展开修改"}</small>
      </summary>
      <div className="game-link-body">
        <div className="game-link-list">
          {series.games.map((game) => (
            <label key={`${series.id}-${game.gameIndex}`} className="game-link-field">
              <span>G{game.gameIndex}</span>
              <input
                id={matchIdInputElementId(series.id, game.gameIndex)}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="match_id"
                value={drafts[String(game.gameIndex)] ?? ""}
                onChange={(event) => setDrafts((current) => ({ ...current, [String(game.gameIndex)]: event.target.value }))}
              />
              <button type="button" onClick={() => saveMatchId(game.gameIndex)}>
                {game.matchId ? "更新" : "保存"}
              </button>
            </label>
          ))}
        </div>
        <p className="game-link-note">只关联 Dota2 比赛 ID，不改管理员填写的 series 胜负。</p>
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    </details>
  );
}

function TeamManagementView({ data, reload, setNotice }: { data: AdminData; reload: () => Promise<void>; setNotice: React.Dispatch<React.SetStateAction<{ tone: Tone; text: string } | null>> }) {
  const [query, setQuery] = useState("");
  const [createDraft, setCreateDraft] = useState<TeamDraftForm>({ name: "", shortName: "", logoUrl: "", color: "#2f7d57", opendotaTeamId: "" });
  const [editDrafts, setEditDrafts] = useState<Record<string, TeamDraftForm>>({});
  const [memberDrafts, setMemberDrafts] = useState<Record<string, string>>({});
  const [activeTeamId, setActiveTeamId] = useState("");

  useEffect(() => {
    setEditDrafts(Object.fromEntries(data.teams.map((team) => [team.id, teamToDraft(team)])));
    setActiveTeamId((current) => current && data.teams.some((team) => team.id === current) ? current : data.teams[0]?.id ?? "");
  }, [data.teams]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleTeams = data.teams.filter((team) => {
    if (!normalizedQuery) return true;
    return [team.name, team.shortName, ...team.members.map((member) => member.displayName), ...team.members.map((member) => member.steamId64 ?? ""), ...team.members.map((member) => member.accountId?.toString() ?? "")]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const activeTeam = visibleTeams.find((team) => team.id === activeTeamId) ?? visibleTeams[0] ?? data.teams[0] ?? null;

  const runTeamAction = async (label: string, method: RequestMethod, path: string, payload?: Record<string, unknown>) => {
    setNotice({ tone: "info", text: `${label}处理中...` });
    const result = await sendAdminRequest(path, method, payload);
    setNotice({ tone: result.ok ? "good" : "warn", text: `${label}：${result.message}` });
    if (result.ok) await reload();
    return result;
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = createDraft.name.trim();
    if (!name) {
      setNotice({ tone: "warn", text: "战队名称不能为空。" });
      return;
    }
    await runTeamAction("创建战队", "POST", "/teams", {
      tournamentId: data.selectedTournamentId,
      name,
      shortName: createDraft.shortName.trim() || undefined,
      logoUrl: createDraft.logoUrl.trim() || null,
      color: createDraft.color || "#2f7d57",
      opendotaTeamId: numberFromDraft(createDraft.opendotaTeamId),
    });
    setCreateDraft({ name: "", shortName: "", logoUrl: "", color: "#2f7d57", opendotaTeamId: "" });
  };

  const saveTeam = async (team: TournamentTeamListItem) => {
    const draft = editDrafts[team.id] ?? teamToDraft(team);
    if (!draft.name.trim()) {
      setNotice({ tone: "warn", text: "战队名称不能为空。" });
      return;
    }
    await runTeamAction("保存战队资料", "PATCH", `/teams/${encodeURIComponent(team.id)}`, {
      name: draft.name.trim(),
      shortName: draft.shortName.trim() || draft.name.trim(),
      logoUrl: draft.logoUrl.trim() || null,
      color: draft.color || "#64748b",
      opendotaTeamId: numberFromDraft(draft.opendotaTeamId),
    });
  };

  const addMember = async (team: TournamentTeamListItem) => {
    const steamId = memberDrafts[team.id]?.trim() ?? "";
    if (!steamId) {
      setNotice({ tone: "warn", text: "请输入 SteamID64 或 Dota account_id。" });
      return;
    }
    const result = await runTeamAction("添加队员", "POST", `/teams/${encodeURIComponent(team.id)}/members`, { steamId });
    if (result.ok) setMemberDrafts((current) => ({ ...current, [team.id]: "" }));
  };

  const removeMember = async (team: TournamentTeamListItem, player: PlayerBrief) => {
    if (!window.confirm(`确认从“${team.name}”移除 ${player.displayName}？选手档案会保留。`)) return;
    await runTeamAction("移除队员", "DELETE", `/teams/${encodeURIComponent(team.id)}/members/${encodeURIComponent(player.id)}`);
  };

  return (
    <section className="team-admin-workspace">
      <div className="team-admin-hero">
        <div>
          <span>战队与选手</span>
          <h2>先把队伍整理好，再进入赛程编排</h2>
          <p>这里支持提前建队、手动维护 Logo / 颜色，并通过 SteamID64 或 Dota account_id 添加成员；自动资料和手动资料会共存。</p>
        </div>
        <div className="team-admin-metrics">
          <div><strong>{data.teams.length}</strong><span>战队</span></div>
          <div><strong>{data.players.length}</strong><span>选手</span></div>
          <div><strong>{data.teams.reduce((sum, team) => sum + team.memberCount, 0)}</strong><span>成员关系</span></div>
        </div>
      </div>
      <div className="team-admin-layout">
        <section className="team-admin-main">
          <div className="team-toolbar">
            <label className="team-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索战队、队员、SteamID" /></label>
            <span>{visibleTeams.length} / {data.teams.length} 支队伍</span>
          </div>
          <div className="team-card-grid">
            {visibleTeams.length === 0 ? <EmptyPanel title="没有匹配的战队" text="换个关键词，或在右侧创建新战队。" /> : visibleTeams.map((team) => (
              <TeamManagementCard
                key={team.id}
                team={team}
                draft={editDrafts[team.id] ?? teamToDraft(team)}
                memberDraft={memberDrafts[team.id] ?? ""}
                isActive={team.id === activeTeam?.id}
                setDraft={(patch) => setEditDrafts((current) => ({ ...current, [team.id]: { ...(current[team.id] ?? teamToDraft(team)), ...patch } }))}
                setMemberDraft={(value) => setMemberDrafts((current) => ({ ...current, [team.id]: value }))}
                selectTeam={() => setActiveTeamId(team.id)}
                saveTeam={() => void saveTeam(team)}
                addMember={() => void addMember(team)}
                removeMember={(player) => void removeMember(team, player)}
              />
            ))}
          </div>
        </section>
        <aside className="team-admin-side">
          <form className="team-create-panel" onSubmit={(event) => void createTeam(event)}>
            <div className="panel-kicker"><Plus size={15} /> 新建战队</div>
            <label>完整队名<input value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：每日节奏一队" /></label>
            <label>简称<input value={createDraft.shortName} onChange={(event) => setCreateDraft((current) => ({ ...current, shortName: event.target.value }))} placeholder="可留空，系统自动生成" /></label>
            <label>Logo URL<input value={createDraft.logoUrl} onChange={(event) => setCreateDraft((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="可手动粘贴头像链接" /></label>
            <div className="split-inputs"><label>颜色<input type="color" value={createDraft.color} onChange={(event) => setCreateDraft((current) => ({ ...current, color: event.target.value }))} /></label><label>OpenDota 队伍 ID<input inputMode="numeric" value={createDraft.opendotaTeamId} onChange={(event) => setCreateDraft((current) => ({ ...current, opendotaTeamId: event.target.value }))} placeholder="可选" /></label></div>
            <button className="primary-button full" type="submit"><Plus size={15} /> 创建并加入当前届次</button>
          </form>
          <section className="team-focus-panel">
            <div className="panel-kicker"><Users size={15} /> 当前选中</div>
            {activeTeam ? (
              <>
                <TeamIdentity team={activeTeam} size="large" />
                <div className="tool-metrics"><span>成员</span><strong>{activeTeam.memberCount} 人</strong></div>
                <div className="tool-metrics"><span>战绩</span><strong>{activeTeam.stats.seriesWins}-{activeTeam.stats.seriesLosses}</strong></div>
                <div className="tool-metrics"><span>真实比赛</span><strong>{activeTeam.stats.linkedMatches}</strong></div>
              </>
            ) : <p className="muted">还没有战队。</p>}
          </section>
        </aside>
      </div>
    </section>
  );
}

function TeamManagementCard(props: {
  team: TournamentTeamListItem;
  draft: TeamDraftForm;
  memberDraft: string;
  isActive: boolean;
  setDraft: (patch: Partial<TeamDraftForm>) => void;
  setMemberDraft: (value: string) => void;
  selectTeam: () => void;
  saveTeam: () => void;
  addMember: () => void;
  removeMember: (player: PlayerBrief) => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <article className={props.isActive ? "team-admin-card is-active" : "team-admin-card"} onClick={props.selectTeam}>
      <div className="team-card-top">
        <TeamIdentity team={props.team} />
        <div className="team-card-stats"><span>{props.team.memberCount} 人</span><span>胜率 {percentOrDash(props.team.stats.winRate)}</span></div>
      </div>
      <details className="team-profile-drawer" open={profileOpen} onToggle={(event) => setProfileOpen(event.currentTarget.open)} onClick={(event) => event.stopPropagation()}>
        <summary>
          <span>资料编辑</span>
          <strong>{props.draft.shortName || props.team.shortName || "未填简称"}</strong>
          <small>Logo / 颜色 / OpenDota</small>
        </summary>
        {profileOpen ? <div className="team-edit-grid">
          <label>队名<input value={props.draft.name} onChange={(event) => props.setDraft({ name: event.target.value })} /></label>
          <label>简称<input value={props.draft.shortName} onChange={(event) => props.setDraft({ shortName: event.target.value })} /></label>
          <label>Logo<input value={props.draft.logoUrl} onChange={(event) => props.setDraft({ logoUrl: event.target.value })} placeholder="可留空" /></label>
          <label>颜色<input type="color" value={props.draft.color} onChange={(event) => props.setDraft({ color: event.target.value })} /></label>
          <label>OpenDota ID<input inputMode="numeric" value={props.draft.opendotaTeamId} onChange={(event) => props.setDraft({ opendotaTeamId: event.target.value })} placeholder="可选" /></label>
          <button type="button" className="secondary-button save-team-button" onClick={props.saveTeam}><Check size={14} /> 保存资料</button>
        </div> : null}
      </details>
      <div className="member-add-row" onClick={(event) => event.stopPropagation()}>
        <input value={props.memberDraft} onChange={(event) => props.setMemberDraft(event.target.value)} placeholder="输入 SteamID64 或 Dota account_id 添加队员" />
        <button type="button" onClick={props.addMember} title={`用 SteamID 为 ${props.team.name} 添加队员并同步资料`} aria-label={`用 SteamID 为 ${props.team.name} 添加队员并同步资料`}><UserPlus size={14} /> 添加并同步</button>
      </div>
      <div className="member-list">
        {props.team.members.length === 0 ? <span className="muted">还没有成员。</span> : props.team.members.map((member) => (
          <div key={member.id} className="member-chip" onClick={(event) => event.stopPropagation()}>
            <PlayerAvatar player={member} />
            <div><strong>{member.displayName}</strong><small>{member.steamId64 ?? member.accountId ?? "未绑定 ID"}</small></div>
            <button type="button" onClick={() => props.removeMember(member)} title={`从 ${props.team.name} 移除 ${member.displayName}`} aria-label={`从 ${props.team.name} 移除 ${member.displayName}`}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </article>
  );
}

function TeamIdentity({ team, size = "normal" }: { team: TeamBrief; size?: "normal" | "large" }) {
  return (
    <div className={`team-identity team-identity-${size}`}>
      {team.logoUrl ? <img src={team.logoUrl} alt="" /> : <div className="team-avatar" style={{ background: team.color }}>{team.name.slice(0, 1)}</div>}
      <div><strong>{team.name}</strong><small>{team.shortName}</small></div>
    </div>
  );
}

function PlayerAvatar({ player }: { player: PlayerBrief }) {
  return player.avatarUrl ? <img className="player-avatar" src={player.avatarUrl} alt="" /> : <div className="player-avatar is-fallback">{player.displayName.slice(0, 1)}</div>;
}

function SupportView({ activeView, data }: { activeView: Exclude<ViewKey, "teams">; data: AdminData }) {
  if (activeView === "matches") return <div className="support-grid">{data.matches.slice(0, 40).map((match) => <section key={match.matchId} className="support-row"><ClipboardCheck size={18} /><div><strong>{match.radiantTeamName} vs {match.direTeamName}</strong><small>match {match.matchId} · {formatDate(match.startTime)} · {match.parseStatus}</small></div></section>)}</div>;
  return <div className="support-grid">{data.syncTasks.map((task) => <section key={task.id} className="support-row"><RefreshCw size={18} /><div><strong>{task.kind}</strong><small>{task.status} · 尝试 {task.attempts} 次</small></div></section>)}</div>;
}

function Checklist({ items }: { items: Array<{ ok: boolean; text: string }> }) {
  return <div className="checklist">{items.map((item) => <span key={item.text} className={item.ok ? "is-ok" : ""}>{item.ok ? <Check size={13} /> : <MousePointer2 size={13} />}{item.text}</span>)}</div>;
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return <div className="empty-panel"><strong>{title}</strong><span>{text}</span></div>;
}

function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

async function loadStageData(stageId: string): Promise<Pick<AdminData, "rounds" | "standings" | "bracket" | "groups">> {
  if (!stageId) return { rounds: [], standings: [], bracket: [], groups: [] };
  const [rounds, standings, bracket, groups] = await Promise.all([
    getJson<StageRound[]>(`/stages/${encodeURIComponent(stageId)}/rounds`).catch(() => []),
    getJson<StandingRow[]>(`/stages/${encodeURIComponent(stageId)}/standings`).catch(() => []),
    getJson<BracketNode[]>(`/stages/${encodeURIComponent(stageId)}/bracket`).catch(() => []),
    getJson<StageGroup[]>(`/stages/${encodeURIComponent(stageId)}/groups`).catch(() => []),
  ]);
  return { rounds, standings, bracket, groups };
}

function chooseStageId(detail: TournamentDetail, preferredStageId: string): string {
  const officialStages = detail.stages.filter(isOfficialScheduleStage);
  if (officialStages.some((stage) => stage.id === preferredStageId)) return preferredStageId;
  if (detail.currentStage && isOfficialScheduleStage(detail.currentStage)) return detail.currentStage.id;
  if (detail.currentStageId && officialStages.some((stage) => stage.id === detail.currentStageId)) return detail.currentStageId;
  return officialStages[0]?.id ?? "";
}

function isOfficialScheduleStage(stage: StageSummary): boolean {
  return stage.name !== "真实比赛记录" && (stage.type === "group" || stage.type === "swiss" || stage.type === "knockout");
}

function formatDndItemId(id: unknown): string {
  const value = String(id);
  if (value.startsWith("team:")) return "队伍";
  if (value === "group-pool") return "未分组队伍池";
  if (value.startsWith("group:")) return "小组";
  if (value === "manual-series:pool") return "候选队伍池";
  if (value === "manual-series:radiant") return "左侧队伍位";
  if (value === "manual-series:dire") return "右侧队伍位";
  if (value === "bracket-entrant:pool") return "淘汰赛候选池";
  if (value === "bracket-entrant:entrant") return "淘汰赛入围槽位";
  if (value === "bracket-pool") return "待落位队伍池";
  if (value.startsWith("slot:") && value.endsWith(":radiant")) return "对阵图上位槽";
  if (value.startsWith("slot:") && value.endsWith(":dire")) return "对阵图下位槽";
  if (value === "roster:pool") return "当前届次队伍池";
  if (value === "roster:entrant") return "参赛名单";
  if (value === "roster:seeded") return "种子队";
  return "目标区域";
}

function viewFromHash(): ViewKey {
  const value = window.location.hash.replace(/^#/, "");
  return navItems.some((item) => item.key === value) ? (value as ViewKey) : "tournament";
}

function isPreliminaryStage(stage: StageSummary): boolean {
  return stage.type === "group" || stage.type === "swiss";
}

function isKnockoutStage(stage: StageSummary): boolean {
  return stage.type === "knockout";
}

interface ScheduleReadiness {
  hasOfficialStage: boolean;
  hasPreliminaryStage: boolean;
  hasPreliminarySeries: boolean;
  hasKnockoutStage: boolean;
  readyToPublish: boolean;
  publishedAndComplete: boolean;
  publishedButIncomplete: boolean;
}

function getScheduleReadiness(schedule: OfficialScheduleManagement | null, officialStages: StageSummary[], selectedStage: StageSummary | null = null, selectedStageSeries: SeriesSummary[] = []): ScheduleReadiness {
  const preliminaryStage = officialStages.find(isPreliminaryStage) ?? null;
  const preliminaryStageId = preliminaryStage?.id ?? "";
  const hasPreliminaryStage = preliminaryStage !== null;
  const selectedPreliminarySeriesKnown = preliminaryStageId !== "" && selectedStage?.id === preliminaryStageId;
  const hasPreliminarySeries = !hasPreliminaryStage
    ? false
    : selectedPreliminarySeriesKnown
      ? selectedStageSeries.some((series) => series.stageId === preliminaryStageId)
      : true;
  const hasKnockoutStage = officialStages.some(isKnockoutStage);
  const readyToPublish = Boolean(schedule?.rosterLocked && schedule.preliminaryType && schedule.knockoutType && hasPreliminaryStage && hasPreliminarySeries);
  const isPublished = schedule?.status === "published";
  return {
    hasOfficialStage: officialStages.length > 0,
    hasPreliminaryStage,
    hasPreliminarySeries,
    hasKnockoutStage,
    readyToPublish,
    publishedAndComplete: isPublished && readyToPublish,
    publishedButIncomplete: isPublished && !readyToPublish,
  };
}

function missingSchedulePieces(schedule: OfficialScheduleManagement | null, readiness: ScheduleReadiness): string[] {
  const pieces: string[] = [];
  if (!schedule?.rosterLocked) pieces.push("锁定参赛名单");
  if (!schedule?.preliminaryType) pieces.push("选择预赛赛制");
  if (!schedule?.knockoutType) pieces.push("选择淘汰赛赛制");
  if (!readiness.hasPreliminaryStage) pieces.push("创建预赛阶段");
  if (readiness.hasPreliminaryStage && !readiness.hasPreliminarySeries) pieces.push("创建预赛对阵");
  return pieces.length > 0 ? pieces : ["确认发布检查"];
}

function getNextAction(data: AdminData, officialStages: StageSummary[], selectedStage: StageSummary | null = null, selectedStageSeries: SeriesSummary[] = []): { title: string; text: string; tone: Tone } {
  const readiness = getScheduleReadiness(data.schedule, officialStages, selectedStage, selectedStageSeries);
  if (readiness.publishedButIncomplete) {
    return { tone: "warn", title: "发布状态缺少阶段", text: `H5 已处于发布状态，但后台缺少${missingSchedulePieces(data.schedule, readiness).join("、")}。请先撤回发布，再补齐赛程。` };
  }
  if (!data.schedule?.rosterLocked) return { tone: "warn", title: "先锁定参赛名单", text: "把当前届次的队伍拖入参赛名单，需要种子队就拖到种子区，然后点击锁定。" };
  if (!data.schedule.preliminaryType || !data.schedule.knockoutType) return { tone: "warn", title: "选择本届赛制", text: "保存预赛赛制和淘汰赛赛制，后续按钮会按这个选择推荐下一步。" };
  if (!readiness.hasPreliminaryStage && !readiness.hasKnockoutStage) return { tone: "info", title: "先创建预赛草稿", text: `${labelPreliminary(data.schedule.preliminaryType)} + ${labelKnockout(data.schedule.knockoutType)} 已保存。先创建预赛阶段；淘汰赛等预赛结果确定后再生成。` };
  if (!readiness.hasPreliminaryStage) return { tone: "info", title: "创建预赛阶段", text: `${labelPreliminary(data.schedule.preliminaryType)}会成为本届唯一预赛阶段，创建后再编排对阵。` };
  if (!readiness.hasPreliminarySeries) return { tone: "warn", title: "先创建预赛对阵", text: "预赛阶段已经存在，但还没有可展示的对阵。先手动排赛或生成草稿，再发布到 H5。" };
  if (data.schedule.status !== "published") return { tone: "good", title: "检查并发布预赛", text: "预赛阶段已经存在。确认分组和预赛赛程后，可以先发布到 H5；淘汰赛后续再补。" };
  if (!readiness.hasKnockoutStage) return { tone: "info", title: "预赛完成后生成淘汰赛", text: "等小组排名或瑞士轮排名确定后，再选择晋级队伍生成对阵图。" };
  return { tone: "good", title: "官方赛程已发布", text: "H5 赛程页正在展示这些阶段；如需大改，先撤回再调整。" };
}

function getComposerGuidance(data: AdminData, readiness: ScheduleReadiness, preliminaryStage: StageSummary | undefined, knockoutStage: StageSummary | undefined): string {
  if (readiness.publishedButIncomplete) return "当前处于已发布状态，但官方阶段不完整。先在控制台撤回发布，再继续补齐预赛和淘汰赛。";
  if (data.schedule?.status === "published") return "官方赛程已发布。结果类操作可以继续处理；赛制、分组和对阵图结构调整请先撤回。";
  if (!data.schedule?.rosterLocked) return "先把队伍拖入参赛名单并锁定。锁定后才开始生成官方赛程。";
  if (!data.schedule.preliminaryType || !data.schedule.knockoutType) return "先在上方保存预赛和淘汰赛赛制，然后创建对应阶段。";
  if (!preliminaryStage && !knockoutStage) return "先在中间工作面创建预赛草稿。淘汰赛不需要现在生成，等预赛排名出来后再选晋级队伍。";
  if (!preliminaryStage) return "创建预赛阶段后，就可以开始分组或生成瑞士轮配对。";
  if (!knockoutStage) return "预赛阶段已存在。选择入围队伍后，直接生成淘汰赛对阵图。";
  return "阶段已经准备好。检查对阵无误后，点击“发布到 H5”。";
}

function nextRoundNumber(rounds: StageRound[]): number {
  return Math.max(0, ...rounds.map((round) => round.roundNumber)) + 1;
}

function defaultManualRoundName(stage: StageSummary, roundNumber: number): string {
  if (stage.type === "swiss") return `瑞士轮第 ${roundNumber} 轮`;
  if (stage.type === "group") return `小组赛第 ${roundNumber} 轮`;
  return `第 ${roundNumber} 轮`;
}

function defaultGroupName(index: number): string {
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${labels[index] ?? index + 1} 组`;
}

function nextAvailableGroupName(usedNames: Set<string>, index: number): string {
  const baseName = defaultGroupName(index);
  if (!usedNames.has(baseName)) return baseName;
  let suffix = 2;
  while (usedNames.has(`${baseName} ${suffix}`)) suffix += 1;
  return `${baseName} ${suffix}`;
}

function matchesTeamQuery(team: TeamBrief, query: string): boolean {
  const normalized = `${team.name} ${team.shortName}`.toLowerCase();
  return normalized.includes(query);
}

function shuffleTeamIds(teams: TeamBrief[]): string[] {
  const ids = teams.map((team) => team.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    const currentId = ids[index]!;
    const targetId = ids[targetIndex]!;
    ids[index] = targetId;
    ids[targetIndex] = currentId;
  }
  return ids;
}

function filterPlannedGroupAssignments(assignments: Record<string, number>, teamIds: string[], groupCount: number): Record<string, number> {
  const teamIdSet = new Set(teamIds);
  const safeGroupCount = clampInteger(groupCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
  return Object.fromEntries(
    Object.entries(assignments).filter(([teamId, groupIndex]) => teamIdSet.has(teamId) && groupIndex >= 0 && groupIndex < safeGroupCount),
  );
}

function standingTeamId(row: StandingRow): string {
  return row.team?.id ?? row.teamId ?? "";
}

function moveRosterDraftTeam(target: RosterDropTarget, teamId: string, setRosterIds: React.Dispatch<React.SetStateAction<string[]>>, setSeededIds: React.Dispatch<React.SetStateAction<string[]>>) {
  if (target === "pool") {
    setRosterIds((current) => current.filter((id) => id !== teamId));
    setSeededIds((current) => current.filter((id) => id !== teamId));
    return;
  }
  setRosterIds((current) => current.includes(teamId) ? current : [...current, teamId]);
  if (target === "seeded") setSeededIds((current) => current.includes(teamId) ? current : [...current, teamId]);
}

function moveBracketEntrantDraftTeam(target: BracketEntrantDropTarget, teamId: string, setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => {
    if (target === "pool") {
      return { ...current, selectedTeamIds: current.selectedTeamIds.filter((id) => id !== teamId) };
    }
    return current.selectedTeamIds.includes(teamId) ? current : { ...current, selectedTeamIds: [...current.selectedTeamIds, teamId] };
  });
}

function movePlannedGroupTeam(overId: string, teamId: string, setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => {
    const next = { ...current.plannedGroupAssignments };
    if (overId === "pre-group-pool") {
      delete next[teamId];
      return { ...current, plannedGroupAssignments: next };
    }
    const groupIndex = Number(overId.slice("pre-group:".length));
    if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= current.groupCount) return current;
    next[teamId] = groupIndex;
    return { ...current, plannedGroupAssignments: next };
  });
}

function moveManualSeriesDraftTeam(target: ManualSeriesDropTarget, teamId: string, setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => {
    if (target === "pool") {
      return {
        ...current,
        manualRadiantTeamId: current.manualRadiantTeamId === teamId ? "" : current.manualRadiantTeamId,
        manualDireTeamId: current.manualDireTeamId === teamId ? "" : current.manualDireTeamId,
      };
    }
    return {
      ...current,
      manualRadiantTeamId: target === "radiant" ? teamId : current.manualRadiantTeamId === teamId ? "" : current.manualRadiantTeamId,
      manualDireTeamId: target === "dire" ? teamId : current.manualDireTeamId === teamId ? "" : current.manualDireTeamId,
    };
  });
}

function pickManualSeriesTeam(teamId: string, setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => {
    if (current.manualRadiantTeamId === teamId || current.manualDireTeamId === teamId) return current;
    if (!current.manualRadiantTeamId) return { ...current, manualRadiantTeamId: teamId };
    if (!current.manualDireTeamId) return { ...current, manualDireTeamId: teamId };
    return current;
  });
}

function swapManualSeriesTeams(setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => ({
    ...current,
    manualRadiantTeamId: current.manualDireTeamId,
    manualDireTeamId: current.manualRadiantTeamId,
  }));
}

function moveEditSeriesDraftTeam(target: EditSeriesDropTarget, teamId: string, setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => {
    if (target === "pool") {
      return {
        ...current,
        editRadiantTeamId: current.editRadiantTeamId === teamId ? "" : current.editRadiantTeamId,
        editDireTeamId: current.editDireTeamId === teamId ? "" : current.editDireTeamId,
      };
    }
    return {
      ...current,
      editRadiantTeamId: target === "radiant" ? teamId : current.editRadiantTeamId === teamId ? "" : current.editRadiantTeamId,
      editDireTeamId: target === "dire" ? teamId : current.editDireTeamId === teamId ? "" : current.editDireTeamId,
    };
  });
}

function pickEditSeriesTeam(teamId: string, setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => {
    if (current.editRadiantTeamId === teamId || current.editDireTeamId === teamId) return current;
    if (!current.editRadiantTeamId) return { ...current, editRadiantTeamId: teamId };
    if (!current.editDireTeamId) return { ...current, editDireTeamId: teamId };
    return current;
  });
}

function swapEditSeriesTeams(setStageForm: React.Dispatch<React.SetStateAction<StageFormState>>) {
  setStageForm((current) => ({
    ...current,
    editRadiantTeamId: current.editDireTeamId,
    editDireTeamId: current.editRadiantTeamId,
  }));
}

function normalizeTeamDragData(value: unknown, activeId: string, teams: TeamBrief[], availableTeams: TeamBrief[]): { teamId: string; source?: TeamDragSource } {
  if (isTeamDragData(value)) return value.source ? { teamId: value.teamId, source: value.source } : { teamId: value.teamId };
  if (!activeId.startsWith("team:")) return { teamId: "" };
  const parts = activeId.split(":");
  const teamId = parts[1] ?? "";
  const sourceSlot = parts[4];
  let source: BracketSlotSource | undefined;
  if (parts[2] === "slot" && parts[3] && (sourceSlot === "radiant" || sourceSlot === "dire")) {
    source = { kind: "bracketSlot", nodeId: parts[3], slot: sourceSlot };
  }
  if (!teamId || ![...teams, ...availableTeams].some((team) => team.id === teamId)) return { teamId: "" };
  return source ? { teamId, source } : { teamId };
}

function findStageGroupIdForTeam(groups: StageGroup[], teamId: string): string {
  return groups.find((group) => group.teams.some((team) => team.id === teamId))?.id ?? "";
}

function isTeamDragData(value: unknown): value is TeamDragData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TeamDragData>;
  return candidate.type === "team" && typeof candidate.teamId === "string";
}

function orderTeamsByIds<T extends TeamBrief>(teams: T[], ids: string[]): T[] {
  const map = new Map(teams.map((team) => [team.id, team]));
  return ids.flatMap((id) => {
    const team = map.get(id);
    return team ? [team] : [];
  });
}

function getGroupAdvancePreset(rows: StandingRow[], teams: TeamBrief[], targetCount: number): GroupAdvancePreset | null {
  const teamIds = new Set(teams.map((team) => team.id));
  const groupedRows = new Map<string, StandingRow[]>();

  for (const row of rows) {
    const teamId = standingTeamId(row);
    const groupName = row.groupName?.trim();
    if (!teamId || !teamIds.has(teamId) || !groupName) continue;
    const bucket = groupedRows.get(groupName) ?? [];
    bucket.push(row);
    groupedRows.set(groupName, bucket);
  }

  const groups = [...groupedRows.entries()]
    .map(([name, groupRows]) => ({
      name,
      rows: [...groupRows].sort((left, right) => left.rank - right.rank),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN", { numeric: true }));

  if (groups.length < 2 || targetCount % groups.length !== 0) return null;

  const perGroup = targetCount / groups.length;
  if (perGroup < 1 || groups.some((group) => group.rows.length < perGroup)) return null;

  const seededIds: string[] = [];
  for (let rankIndex = 0; rankIndex < perGroup; rankIndex += 1) {
    for (const group of groups) {
      const row = group.rows[rankIndex];
      const teamId = row ? standingTeamId(row) : "";
      if (teamId && !seededIds.includes(teamId)) seededIds.push(teamId);
    }
  }

  if (seededIds.length !== targetCount) return null;

  const label = groups.length === 2 && perGroup === 3 && targetCount === 6 ? "两组前三 · 6 队单败" : `${groups.length} 组前 ${perGroup} · ${targetCount} 队`;
  const text = targetCount === 6
    ? "点击填入两组前三；小组第一成为 1/2 种子等待半决赛，之后仍可拖拽调整。"
    : "点击按组内排名逐档填入种子位，之后仍可拖拽调整。";

  return {
    label,
    text,
    teamIds: seededIds,
    targetCount,
    groupCount: groups.length,
    perGroup,
  };
}

function orderTeamsByStanding<T extends TeamBrief>(teams: T[], rows: StandingRow[]): T[] {
  const rankedIds = rows.map(standingTeamId).filter(Boolean);
  const rankedTeams = orderTeamsByIds(teams, rankedIds);
  const rankedSet = new Set(rankedIds);
  return [...rankedTeams, ...teams.filter((team) => !rankedSet.has(team.id))];
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function getSwissDraftSeriesCount(teamCount: number): number {
  return Math.floor(Math.max(teamCount, 0) / 2);
}

function formatSwissDraftImpact(teamCount: number): string {
  if (teamCount < 2) return "至少 2 支参赛队伍";
  const seriesCount = getSwissDraftSeriesCount(teamCount);
  const byeText = teamCount % 2 === 1 ? " + 1 个轮空胜" : "";
  return `${seriesCount} 场 BO2${byeText}`;
}

function validateBracketEntrants(mode: CompetitionMode, bracketSize: number, entrantCount: number, winnerTeamCount: number, loserTeamCount: number): string | null {
  const targetCount = bracketEntrantTargetCount(mode, bracketSize, winnerTeamCount, loserTeamCount);
  if (entrantCount < 2) return "至少需要 2 支队伍才能生成淘汰赛。";
  if (entrantCount > targetCount) return `入围队伍不能超过 ${targetCount} 支。`;
  if (entrantCount < targetCount) return `还差 ${targetCount - entrantCount} 支入围队伍。`;
  if (mode !== "double_elimination") return null;
  if (bracketSize === 6) return "双败暂不支持 6 队规模，请选择 4、8 或 16 队。";
  const maxLoserTeamCount = Math.floor(bracketSize / 2);
  const winnerCount = clampInteger(winnerTeamCount, 2, bracketSize);
  const loserCount = clampInteger(loserTeamCount, 0, maxLoserTeamCount);
  const splitDelta = winnerCount + loserCount - targetCount;
  if (splitDelta < 0) return `胜者组和败者组数量需要合计 ${targetCount} 支，还差 ${Math.abs(splitDelta)} 支。`;
  if (splitDelta > 0) return `胜者组和败者组数量需要合计 ${targetCount} 支，多了 ${splitDelta} 支。`;
  const uncoveredCount = Math.max(entrantCount - winnerCount - loserCount, 0);
  return uncoveredCount > 0 ? `当前双败分流只覆盖 ${winnerCount + loserCount} 支队伍，请移出 ${uncoveredCount} 支入围队伍，或调高胜者组 / 败者组数量。` : null;
}

function bracketEntrantTargetCount(mode: CompetitionMode, bracketSize: number, winnerTeamCount: number, loserTeamCount: number): number {
  if (mode === "double_elimination") {
    return clampInteger(winnerTeamCount, 2, bracketSize) + clampInteger(loserTeamCount, 0, Math.floor(bracketSize / 2));
  }

  return bracketSize;
}

function getBracketSlotTeam(nodes: BracketNode[], nodeId: string, slot: BracketSlotName): TeamBrief | null {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  return slot === "radiant" ? node.radiantTeam : node.direTeam;
}

function isSameSeriesPair(series: SeriesSummary, leftTeamId: string, rightTeamId: string): boolean {
  return (
    (series.radiantTeam.id === leftTeamId && series.direTeam.id === rightTeamId)
    || (series.radiantTeam.id === rightTeamId && series.direTeam.id === leftTeamId)
  );
}

function buildTeamPairDrafts(teams: TeamBrief[]): Array<{ left: TeamBrief; right: TeamBrief }> {
  const pairs: Array<{ left: TeamBrief; right: TeamBrief }> = [];
  for (let leftIndex = 0; leftIndex < teams.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < teams.length; rightIndex += 1) {
      const left = teams[leftIndex];
      const right = teams[rightIndex];
      if (left && right) pairs.push({ left, right });
    }
  }
  return pairs;
}

function expectedGroupRegularSeriesCount(groups: StageGroup[]): number {
  return groups.reduce((total, group) => total + buildTeamPairDrafts(group.teams).length, 0);
}

function scheduledGroupRegularSeriesCount(series: SeriesSummary[]): number {
  const pairKeys = new Set<string>();
  for (const item of series) {
    if (!item.groupId || item.seriesKind === "tiebreaker") continue;
    pairKeys.add(`${item.groupId}:${seriesPairKey(item)}`);
  }
  return pairKeys.size;
}

function findRecommendedPair(teams: TeamBrief[], history: SeriesSummary[]): { left: TeamBrief; right: TeamBrief } | null {
  const pairs = buildTeamPairDrafts(teams);
  return pairs.find((pair) => !history.some((series) => isSameSeriesPair(series, pair.left.id, pair.right.id))) ?? pairs[0] ?? null;
}

function findNextGroupRegularPair(group: StageGroup | undefined, rounds: StageRound[], groupId: string, extraPairKey?: string): { left: TeamBrief; right: TeamBrief } | null {
  if (!group || !groupId) return null;
  const scheduledPairKeys = new Set(
    rounds
      .flatMap((round) => round.series)
      .filter((series) => series.groupId === groupId && series.seriesKind !== "tiebreaker")
      .map(seriesPairKey),
  );
  if (extraPairKey) scheduledPairKeys.add(extraPairKey);
  return buildTeamPairDrafts(group.teams).find((pair) => !scheduledPairKeys.has(teamPairKey(pair.left.id, pair.right.id))) ?? null;
}

function findNextGroupRegularPairSuggestion(groups: StageGroup[], rounds: StageRound[], preferredGroupId = "", extraPairKey?: string): { group: StageGroup; pair: { left: TeamBrief; right: TeamBrief } } | null {
  const preferredGroup = groups.find((group) => group.id === preferredGroupId);
  const orderedGroups = preferredGroup ? [preferredGroup, ...groups.filter((group) => group.id !== preferredGroupId)] : groups;
  for (const group of orderedGroups) {
    const pair = findNextGroupRegularPair(group, rounds, group.id, extraPairKey);
    if (pair) return { group, pair };
  }
  return null;
}

function findNextSwissPair(teams: TeamBrief[], standings: StandingRow[], rounds: StageRound[], extraPairKey?: string): { left: TeamBrief; right: TeamBrief } | null {
  const playedPairKeys = new Set(rounds.flatMap((round) => round.series).map(seriesPairKey));
  if (extraPairKey) playedPairKeys.add(extraPairKey);
  const orderedTeams = orderTeamsByStanding(teams, standings);
  const pairs = buildTeamPairDrafts(orderedTeams);
  return pairs.find((pair) => !playedPairKeys.has(teamPairKey(pair.left.id, pair.right.id))) ?? pairs[0] ?? null;
}

function buildEntrantSeedRoles(props: { bracketSize: number; targetCount: number; isDoubleElimination: boolean; winnerTeamCount: number; loserTeamCount: number }): EntrantSeedRole[] {
  return Array.from({ length: props.targetCount }, (_, index) => {
    const seed = index + 1;
    if (props.isDoubleElimination) {
      if (index < props.winnerTeamCount) {
        const opponentSeed = getOpeningOpponentSeed(props.bracketSize, seed);
        return {
          badge: `胜者 Seed ${seed}`,
          detail: opponentSeed ? `胜者组 Seed ${seed}，首轮对 Seed ${opponentSeed}` : `胜者组 Seed ${seed}`,
          tone: "winner",
        };
      }
      const loserSeed = index - props.winnerTeamCount + 1;
      return {
        badge: `败者组 ${loserSeed}`,
        detail: `初始败者组第 ${loserSeed} 位，输掉后直接淘汰`,
        tone: "loser",
      };
    }

    if (props.bracketSize === 6) {
      if (seed === 1 || seed === 2) {
        return {
          badge: `Seed ${seed} 半决赛`,
          detail: seed === 1 ? "Seed 1 直接等待 4/5 胜者" : "Seed 2 直接等待 3/6 胜者",
          tone: "wait",
        };
      }
      const opponentSeed = seed === 3 ? 6 : seed === 6 ? 3 : seed === 4 ? 5 : 4;
      return {
        badge: `Seed ${seed} 首轮`,
        detail: `第一轮对 Seed ${opponentSeed}`,
        tone: "play",
      };
    }

    const opponentSeed = getOpeningOpponentSeed(props.bracketSize, seed);
    return {
      badge: `Seed ${seed}`,
      detail: opponentSeed ? `首轮对 Seed ${opponentSeed}` : `Seed ${seed}`,
      tone: "play",
    };
  });
}

function getOpeningOpponentSeed(bracketSize: number, seed: number): number | null {
  const seedOrder = getSeedSlotOrder(bracketSize);
  for (let index = 0; index < seedOrder.length; index += 2) {
    const left = seedOrder[index];
    const right = seedOrder[index + 1];
    if (left === seed) return right ?? null;
    if (right === seed) return left ?? null;
  }
  return null;
}

function teamPairKey(leftTeamId: string, rightTeamId: string): string {
  return [leftTeamId, rightTeamId].sort().join("::");
}

function seriesPairKey(series: SeriesSummary): string {
  return teamPairKey(series.radiantTeam.id, series.direTeam.id);
}

function groupBracketNodes(nodes: BracketNode[]) {
  const map = new Map<string, { key: string; roundName: string; nodes: BracketNode[] }>();
  for (const node of nodes) {
    const key = `${node.bracketGroup}:${node.roundNumber}:${node.roundName}`;
    const item = map.get(key) ?? { key, roundName: groupLabel(node.bracketGroup, node.roundName), nodes: [] };
    item.nodes.push(node);
    map.set(key, item);
  }
  return [...map.values()].map((item) => ({ ...item, nodes: [...item.nodes].sort((left, right) => left.position - right.position) }));
}

function bracketSlotKey(nodeId: string, slot: BracketSlotName): string {
  return `${nodeId}:${slot}`;
}

function getBracketIncomingSlotKeys(nodes: BracketNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.nextNodeId && node.nextSlot) keys.add(bracketSlotKey(node.nextNodeId, node.nextSlot));
    if (node.loserNextNodeId && node.loserNextSlot) keys.add(bracketSlotKey(node.loserNextNodeId, node.loserNextSlot));
  }
  return keys;
}

function getBracketSlotSummary(nodes: BracketNode[]) {
  const incomingSlotKeys = getBracketIncomingSlotKeys(nodes);
  const openSlots = nodes
    .filter((node) => node.winnerTeamId === null)
    .flatMap((node) => [
      node.radiantTeam ? null : { nodeId: node.id, slot: "radiant" as BracketSlotName },
      node.direTeam ? null : { nodeId: node.id, slot: "dire" as BracketSlotName },
    ])
    .filter((slot): slot is { nodeId: string; slot: BracketSlotName } => slot !== null);
  const manualOpenSlots = openSlots.filter((slot) => !incomingSlotKeys.has(bracketSlotKey(slot.nodeId, slot.slot)));
  const waitingOpenSlots = openSlots.filter((slot) => incomingSlotKeys.has(bracketSlotKey(slot.nodeId, slot.slot)));
  const totalSlots = nodes.length * 2;
  const filledSlots = nodes.reduce((sum, node) => sum + (node.radiantTeam ? 1 : 0) + (node.direTeam ? 1 : 0), 0);
  return {
    incomingSlotKeys,
    openSlots,
    manualOpenSlots,
    waitingOpenSlots,
    totalSlots,
    filledSlots,
    emptySlots: openSlots.length,
    manualOpenSlotCount: manualOpenSlots.length,
    waitingOpenSlotCount: waitingOpenSlots.length,
  };
}

function groupLabel(group: string, roundName: string): string {
  if (group === "winner") return `胜者组 · ${roundName}`;
  if (group === "loser") return `败者组 · ${roundName}`;
  if (group === "grand_final") return `总决赛 · ${roundName}`;
  return roundName;
}

function formatBracketTarget(nodes: Map<string, BracketNode>, nodeId: string | null, slot: BracketSlotName | null): string {
  if (!nodeId) return "终点";
  const node = nodes.get(nodeId);
  const slotLabel = slot === "radiant" ? "上位" : slot === "dire" ? "下位" : "待定槽";
  return node ? `${groupLabel(node.bracketGroup, node.roundName)} #${node.position} ${slotLabel}` : `下一节点 ${slotLabel}`;
}

function toneForStatus(status: string | undefined | null): Tone {
  switch (status) {
    case "completed":
    case "locked":
    case "confirmed":
    case "succeeded":
    case "parsed":
    case "published":
      return "good";
    case "running":
    case "scheduled":
    case "queued":
    case "requested":
      return "info";
    case "draft":
    case "upcoming":
    case "postponed":
    case "needs_review":
    case "unconfigured":
      return "warn";
    case "conflict":
    case "cancelled":
    case "failed":
    case "withdrawn":
      return "danger";
    default:
      return "neutral";
  }
}

function scheduleStatusLabel(status: string | undefined | null): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "withdrawn":
      return "已撤回";
    default:
      return "未配置";
  }
}

function labelPreliminary(value: string | null | undefined): string {
  return value === "swiss" ? "瑞士轮" : value === "group" ? "小组赛" : "未选择";
}

function labelKnockout(value: string | null | undefined): string {
  return value === "double_elimination" ? "双败" : value === "single_elimination" ? "单败" : "未选择";
}

function labelStageType(value: string | null | undefined): string {
  if (value === "group") return "小组赛";
  if (value === "swiss") return "瑞士轮";
  if (value === "knockout") return "淘汰赛";
  return value ?? "阶段";
}

function labelStageStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "running":
      return "进行中";
    case "locked":
      return "已锁定";
    case "completed":
      return "已完成";
    default:
      return value ?? "未知";
  }
}

function labelPairingStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "confirmed":
      return "已确认";
    case "running":
      return "进行中";
    case "completed":
      return "已完成";
    default:
      return value ?? "未知";
  }
}

function labelSeriesStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "scheduled":
      return "待开赛";
    case "live":
      return "进行中";
    case "result_pending":
      return "待补赛果";
    case "completed":
      return "已完赛";
    case "conflict":
      return "赛果冲突";
    case "postponed":
      return "延期";
    case "cancelled":
      return "已取消";
    default:
      return value ?? "未知";
  }
}

function seriesGameDrafts(series: SeriesSummary): Record<string, string> {
  return Object.fromEntries(series.games.map((game) => [String(game.gameIndex), game.matchId?.toString() ?? ""]));
}

function matchesSeriesQuery(series: SeriesSummary, query: string): boolean {
  if (!query) return true;
  const searchable = [
    series.radiantTeam.name,
    series.direTeam.name,
    series.groupName ?? "",
    series.boType,
    labelSeriesStatus(series.status),
    ...series.games.map((game) => game.matchId?.toString() ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return searchable.includes(query);
}

function teamToDraft(team: TeamBrief): TeamDraftForm {
  return {
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl ?? "",
    color: team.color || "#64748b",
    opendotaTeamId: "",
  };
}

function numberFromDraft(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function localDateTimeToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function percentOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function quickResultOptions(boType: string): Array<{ radiant: number; dire: number }> {
  if (boType === "BO1") return [{ radiant: 1, dire: 0 }, { radiant: 0, dire: 1 }];
  if (boType === "BO3") return [{ radiant: 2, dire: 0 }, { radiant: 2, dire: 1 }, { radiant: 1, dire: 2 }, { radiant: 0, dire: 2 }];
  if (boType === "BO5") return [{ radiant: 3, dire: 0 }, { radiant: 3, dire: 1 }, { radiant: 3, dire: 2 }, { radiant: 2, dire: 3 }, { radiant: 1, dire: 3 }, { radiant: 0, dire: 3 }];
  return [{ radiant: 2, dire: 0 }, { radiant: 1, dire: 1 }, { radiant: 0, dire: 2 }];
}

function quickResultTone(option: { radiant: number; dire: number }): "left" | "draw" | "right" {
  if (option.radiant > option.dire) return "left";
  if (option.dire > option.radiant) return "right";
  return "draw";
}

function quickResultLabel(option: { radiant: number; dire: number }): string {
  const score = `${option.radiant}-${option.dire}`;
  const tone = quickResultTone(option);
  if (tone === "left") return `左胜 ${score}`;
  if (tone === "right") return `右胜 ${score}`;
  return `平局 ${score}`;
}

function quickResultTitle(series: SeriesSummary, option: { radiant: number; dire: number }): string {
  const score = `${option.radiant}-${option.dire}`;
  const tone = quickResultTone(option);
  if (tone === "left") return `${series.radiantTeam.name} 获胜，比分 ${score}`;
  if (tone === "right") return `${series.direTeam.name} 获胜，比分 ${score}`;
  return `${series.radiantTeam.name} 与 ${series.direTeam.name} 平局，比分 ${score}`;
}

function toDatetimeLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function serializeDatetimeLocal(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "时间待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

const root = document.querySelector<HTMLElement>("#root");
if (root) createRoot(root).render(<App />);
