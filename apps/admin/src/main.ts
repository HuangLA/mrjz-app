import "./styles.css";
import {
  apiBaseUrl,
  getJson,
  sendAdminRequest,
  type ApiSource,
  type BracketNode,
  type OpenDotaMatchListItem,
  type OfficialScheduleManagement,
  type StageGroup,
  type StageRound,
  type StageSummary,
  type StandingRow,
  type SyncTask,
  type Tone,
  type TournamentDetail,
  type TournamentListItem,
  type TournamentPlayerListItem,
  type TournamentTeamListItem,
} from "./api";

type ViewKey = "overview" | "editions" | "teams" | "players" | "matches" | "stages" | "sync";

type AdminWriteRequest = {
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  payload?: Record<string, unknown>;
};

type AdminFormValue = FormDataEntryValue | FormDataEntryValue[];
type AdminFormPayload = Record<string, AdminFormValue>;
type CompetitionMode = "group" | "swiss" | "single_elimination" | "double_elimination";
type SeriesBoType = "BO1" | "BO2" | "BO3" | "BO5";
type PlanRoundKind = "group" | "swiss" | "single" | "winner" | "loser" | "grand_final";

interface LoadState {
  source: ApiSource;
  loading: boolean;
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
  scheduleManagement: OfficialScheduleManagement | null;
  syncRows: SyncRow[];
  writeNotice: {
    tone: Tone;
    text: string;
  } | null;
}

interface SyncRow {
  id: string;
  kind: string;
  target: string;
  status: string;
  detail: string;
  attempts: number;
  tone: Tone;
}

interface ComposerState {
  mode: CompetitionMode;
  stageName: string;
  boType: SeriesBoType;
  scheduledAt: string;
  groupCount: number;
  groupLoops: number;
  advancePerGroup: number;
  swissRounds: number;
  bracketSize: number;
  winnerTeamCount: number;
  loserTeamCount: number;
  selectedTeamIds: string[];
}

interface PlanTeam {
  id: string;
  name: string;
  shortName: string;
  color: string;
  seed: number | null;
}

interface PlanSeries {
  label: string;
  position: number;
  radiant: PlanTeam;
  dire: PlanTeam;
  groupName?: string;
  note?: string;
}

interface PlanRound {
  name: string;
  roundNumber: number;
  kind: PlanRoundKind;
  series: PlanSeries[];
  placeholderCount: number;
}

interface PlanBye {
  team: PlanTeam;
  label: string;
}

interface PlanGroup {
  name: string;
  teams: PlanTeam[];
}

interface BracketColumn {
  title: string;
  tone: Tone;
  nodes: Array<{
    label: string;
    top: string;
    bottom: string;
    meta: string;
  }>;
}

interface CompetitionPlan {
  mode: CompetitionMode;
  stageType: "group" | "swiss" | "knockout";
  stageName: string;
  boType: SeriesBoType;
  advancementRule: string;
  teams: PlanTeam[];
  groups: PlanGroup[];
  rounds: PlanRound[];
  byes: PlanBye[];
  bracketColumns: BracketColumn[];
  warnings: string[];
}

const root = document.querySelector<HTMLElement>("#root");

const views: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: "overview", label: "运营总览", hint: "当前届次、缺口和最近结果" },
  { key: "editions", label: "届次 / 联赛", hint: "创建联赛、生命周期" },
  { key: "teams", label: "战队管理", hint: "队伍、成员、胜率英雄" },
  { key: "players", label: "选手管理", hint: "Dota 账号、归属战队" },
  { key: "matches", label: "比赛结果库", hint: "OpenDota 结果和手动补对阵" },
  { key: "stages", label: "阶段赛程", hint: "阶段、轮次、赛程赛果" },
  { key: "sync", label: "同步任务", hint: "发现、解析、重试" },
];

let activeView: ViewKey = "overview";
let draggedStageTeamId = "";
let composerState: ComposerState = {
  mode: "single_elimination",
  stageName: "",
  boType: "BO3",
  scheduledAt: "",
  groupCount: 2,
  groupLoops: 1,
  advancePerGroup: 2,
  swissRounds: 5,
  bracketSize: 8,
  winnerTeamCount: 8,
  loserTeamCount: 0,
  selectedTeamIds: [],
};
let state: LoadState = {
  source: "unavailable",
  loading: true,
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
  scheduleManagement: null,
  syncRows: [],
  writeNotice: null,
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function badge(text: string, tone: Tone = "neutral"): string {
  return `<span class="badge badge-${tone}">${escapeHtml(text)}</span>`;
}

function toneForStatus(status: string | undefined): Tone {
  switch (status) {
    case "completed":
    case "locked":
    case "confirmed":
    case "succeeded":
    case "parsed":
    case "active":
      return "good";
    case "running":
    case "published":
    case "result_pending":
    case "scheduled":
    case "queued":
    case "requested":
      return "info";
    case "draft":
    case "upcoming":
    case "postponed":
    case "needs_review":
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

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "未设置";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  return date.toISOString().slice(0, 16);
}

function currentStage(): StageSummary | null {
  return state.detail?.stages.find((stage) => stage.id === state.selectedStageId) ?? state.detail?.stages[0] ?? null;
}

function allSeries(): StageRound["series"] {
  return state.rounds.flatMap((round) => round.series);
}

function linkedMatchCount(): number {
  return state.matches.filter((match) => match.linkedSeries !== null).length;
}

function sortedTeams(): PlanTeam[] {
  return [...state.teams]
    .sort((left, right) => {
      const leftSeed = left.seed ?? Number.MAX_SAFE_INTEGER;
      const rightSeed = right.seed ?? Number.MAX_SAFE_INTEGER;

      if (leftSeed !== rightSeed) {
        return leftSeed - rightSeed;
      }

      return left.name.localeCompare(right.name, "zh-Hans-CN");
    })
    .map((team, index) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      color: team.color || "#6bd26f",
      seed: team.seed ?? index + 1,
    }));
}

function selectedPlanTeams(config: ComposerState = composerState): PlanTeam[] {
  const teams = sortedTeams();
  const defaultIds = isEliminationMode(config.mode)
    ? teams.slice(0, config.bracketSize).map((team) => team.id)
    : teams.map((team) => team.id);
  const selectedIds = new Set(config.selectedTeamIds.length === 0 ? defaultIds : config.selectedTeamIds);

  return teams.filter((team) => selectedIds.has(team.id));
}

function isEliminationMode(mode: CompetitionMode): boolean {
  return mode === "single_elimination" || mode === "double_elimination";
}

function defaultStageName(mode: CompetitionMode): string {
  switch (mode) {
    case "group":
      return "小组赛";
    case "swiss":
      return "瑞士轮";
    case "single_elimination":
      return "单败淘汰赛";
    case "double_elimination":
      return "双败淘汰赛";
  }
}

function modeLabel(mode: CompetitionMode): string {
  switch (mode) {
    case "group":
      return "小组赛联赛";
    case "swiss":
      return "瑞士轮";
    case "single_elimination":
      return "单败淘汰赛";
    case "double_elimination":
      return "双败淘汰赛";
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nextPowerOfTwo(value: number): number {
  let size = 1;

  while (size < value) {
    size *= 2;
  }

  return size;
}

function normalizeBoType(value: string): SeriesBoType {
  return value === "BO1" || value === "BO2" || value === "BO3" || value === "BO5" ? value : "BO3";
}

function normalizeCompetitionMode(value: string): CompetitionMode {
  return value === "group" || value === "swiss" || value === "single_elimination" || value === "double_elimination"
    ? value
    : "swiss";
}

function composerStateFromPayload(payload: AdminFormPayload): ComposerState {
  return {
    mode: normalizeCompetitionMode(payloadString(payload, "mode", composerState.mode)),
    stageName: payloadString(payload, "stageName"),
    boType: normalizeBoType(payloadString(payload, "boType", composerState.boType)),
    scheduledAt: payloadString(payload, "scheduledAt"),
    groupCount: clampNumber(payloadNumber(payload, "groupCount") ?? composerState.groupCount, 1, 8),
    groupLoops: clampNumber(payloadNumber(payload, "groupLoops") ?? composerState.groupLoops, 1, 2),
    advancePerGroup: clampNumber(payloadNumber(payload, "advancePerGroup") ?? composerState.advancePerGroup, 1, 8),
    swissRounds: clampNumber(payloadNumber(payload, "swissRounds") ?? composerState.swissRounds, 1, 9),
    bracketSize: clampNumber(payloadNumber(payload, "bracketSize") ?? composerState.bracketSize, 4, 16),
    winnerTeamCount: clampNumber(payloadNumber(payload, "winnerTeamCount") ?? composerState.winnerTeamCount, 2, 16),
    loserTeamCount: clampNumber(payloadNumber(payload, "loserTeamCount") ?? composerState.loserTeamCount, 0, 16),
    selectedTeamIds: payloadStrings(payload, "teamIds"),
  };
}

function buildCompetitionPlan(config: ComposerState = composerState): CompetitionPlan {
  const teams = selectedPlanTeams(config);
  const mode = config.mode;
  const stageName = config.stageName || defaultStageName(mode);
  const warnings: string[] = [];

  if (teams.length < 2) {
    warnings.push("至少需要 2 支队伍才能生成对阵。");
  }

  if (mode === "group") {
    return buildGroupPlan(config, stageName, teams, warnings);
  }

  if (mode === "single_elimination") {
    return buildSingleEliminationPlan(config, stageName, teams, warnings);
  }

  if (mode === "double_elimination") {
    return buildDoubleEliminationPlan(config, stageName, teams, warnings);
  }

  return buildSwissPlan(config, stageName, teams, warnings);
}

function buildGroupPlan(config: ComposerState, stageName: string, teams: PlanTeam[], warnings: string[]): CompetitionPlan {
  const groupCount = clampNumber(config.groupCount, 1, Math.max(1, Math.min(teams.length, 8)));
  const groups = splitIntoGroups(teams, groupCount);
  const groupedRounds = groups.map((group) => ({
    group,
    rounds: buildRoundRobinSeries(group.teams, group.name, config.groupLoops),
  }));
  const maxRoundCount = Math.max(0, ...groupedRounds.map((group) => group.rounds.length));
  const rounds: PlanRound[] = [];
  const byes: PlanBye[] = [];

  for (let roundIndex = 0; roundIndex < maxRoundCount; roundIndex += 1) {
    const series = groupedRounds.flatMap(({ rounds: groupRounds }) => groupRounds[roundIndex]?.series ?? []);

    byes.push(...groupedRounds.flatMap(({ rounds: groupRounds }) => groupRounds[roundIndex]?.byes ?? []));
    rounds.push({
      name: `小组赛第 ${roundIndex + 1} 轮`,
      roundNumber: roundIndex + 1,
      kind: "group",
      series,
      placeholderCount: Math.max(1, series.length),
    });
  }

  if (groups.some((group) => group.teams.length < 3)) {
    warnings.push("存在少于 3 支队伍的小组，建议调整分组数或补齐参赛队。");
  }

  return {
    mode: "group",
    stageType: "group",
    stageName,
    boType: config.boType,
    advancementRule: `小组赛 · ${groupCount} 组 · ${config.groupLoops === 2 ? "双循环" : "单循环"} · 每组前 ${config.advancePerGroup} 晋级 · ${config.boType}`,
    teams,
    groups,
    rounds,
    byes,
    bracketColumns: [],
    warnings,
  };
}

function splitIntoGroups(teams: PlanTeam[], groupCount: number): PlanGroup[] {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    name: `${String.fromCharCode(65 + index)} 组`,
    teams: [] as PlanTeam[],
  }));

  teams.forEach((team, index) => {
    const row = Math.floor(index / groupCount);
    const offset = index % groupCount;
    const groupIndex = row % 2 === 0 ? offset : groupCount - 1 - offset;

    groups[groupIndex]?.teams.push(team);
  });

  return groups;
}

function buildRoundRobinSeries(
  groupTeams: PlanTeam[],
  groupName: string,
  loopCount: number,
): Array<{ series: PlanSeries[]; byes: PlanBye[] }> {
  if (groupTeams.length < 2) {
    return [];
  }

  const slots: Array<PlanTeam | null> = groupTeams.length % 2 === 0 ? [...groupTeams] : [...groupTeams, null];
  const rounds: Array<{ series: PlanSeries[]; byes: PlanBye[] }> = [];

  for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
    let rotation = [...slots];
    const roundCount = rotation.length - 1;

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      const series: PlanSeries[] = [];
      const byes: PlanBye[] = [];

      for (let pairIndex = 0; pairIndex < rotation.length / 2; pairIndex += 1) {
        const left = rotation[pairIndex];
        const right = rotation[rotation.length - 1 - pairIndex];

        if (left == null || right == null) {
          const byeTeam = left ?? right;

          if (byeTeam) {
            byes.push({ team: byeTeam, label: `${groupName} 第 ${roundIndex + 1} 轮轮空` });
          }

          continue;
        }

        const shouldSwap = (roundIndex + loopIndex) % 2 === 1;
        const radiant = shouldSwap ? right : left;
        const dire = shouldSwap ? left : right;

        const draftSeries: PlanSeries = {
          label: `${groupName}-${series.length + 1}`,
          position: series.length + 1,
          radiant,
          dire,
          groupName,
        };

        if (loopIndex === 1) {
          draftSeries.note = "复循环";
        }

        series.push(draftSeries);
      }

      rounds.push({ series, byes });
      rotation = [rotation[0] ?? null, rotation[rotation.length - 1] ?? null, ...rotation.slice(1, rotation.length - 1)];
    }
  }

  return rounds;
}

function buildSwissPlan(config: ComposerState, stageName: string, teams: PlanTeam[], warnings: string[]): CompetitionPlan {
  const sorted = [...teams];
  const series: PlanSeries[] = [];
  const byes: PlanBye[] = [];
  let left = 0;
  let right = sorted.length - 1;

  while (left < right) {
    const radiant = sorted[left];
    const dire = sorted[right];

    if (!radiant || !dire) {
      break;
    }

    series.push({
      label: `R1-${series.length + 1}`,
      position: series.length + 1,
      radiant,
      dire,
      note: "首轮按种子高低配对",
    });
    left += 1;
    right -= 1;
  }

  const byeTeam = left === right ? sorted[left] : undefined;

  if (byeTeam) {
    byes.push({ team: byeTeam, label: "瑞士轮第 1 轮 BYE" });
    warnings.push(`${byeTeam.name} 将在第 1 轮轮空，后续轮次需由后端按战绩重新生成草稿。`);
  }

  if (teams.length < 4) {
    warnings.push("瑞士轮建议至少 4 支队伍；队伍过少时小组赛或直接淘汰更清晰。");
  }

  const rounds: PlanRound[] = [
    {
      name: "瑞士轮第 1 轮",
      roundNumber: 1,
      kind: "swiss",
      series,
      placeholderCount: Math.max(1, series.length),
    },
  ];

  return {
    mode: "swiss",
    stageType: "swiss",
    stageName,
    boType: config.boType,
    advancementRule: `瑞士轮 · ${config.swissRounds} 轮 · 避免重复交手 · 奇数队 BYE · ${config.boType}`,
    teams,
    groups: [],
    rounds,
    byes,
    bracketColumns: [],
    warnings,
  };
}

function buildSingleEliminationPlan(
  config: ComposerState,
  stageName: string,
  teams: PlanTeam[],
  warnings: string[],
): CompetitionPlan {
  const requestedSize = config.bracketSize <= 4 ? 4 : config.bracketSize <= 8 ? 8 : 16;
  const bracketSize = Math.max(requestedSize, clampNumber(nextPowerOfTwo(Math.max(teams.length, 2)), 4, 16));
  const seedOrder = seedSlotOrder(bracketSize);
  const slots = seedOrder.map((seed) => teams[seed - 1] ?? null);
  const firstRoundSeries: PlanSeries[] = [];
  const byes: PlanBye[] = [];

  for (let index = 0; index < slots.length; index += 2) {
    const left = slots[index];
    const right = slots[index + 1];

    if (left && right) {
      firstRoundSeries.push({
        label: `SE-${firstRoundSeries.length + 1}`,
        position: firstRoundSeries.length + 1,
        radiant: left,
        dire: right,
        note: "胜者自动进入下一轮",
      });
    } else if (left ?? right) {
      byes.push({ team: (left ?? right) as PlanTeam, label: "首轮 BYE" });
    }
  }

  const roundCount = Math.log2(bracketSize);
  const rounds: PlanRound[] = [
    {
      name: "淘汰赛第 1 轮",
      roundNumber: 1,
      kind: "single",
      series: firstRoundSeries,
      placeholderCount: Math.max(1, bracketSize / 2),
    },
  ];

  for (let roundIndex = 2; roundIndex <= roundCount; roundIndex += 1) {
    rounds.push({
      name: roundIndex === roundCount ? "决赛" : roundIndex === roundCount - 1 ? "半决赛" : `淘汰赛第 ${roundIndex} 轮`,
      roundNumber: roundIndex,
      kind: "single",
      series: [],
      placeholderCount: Math.max(1, bracketSize / 2 ** roundIndex),
    });
  }

  if (teams.length < bracketSize) {
    warnings.push(`当前 ${teams.length} 队会进入 ${bracketSize} 队单败表，首轮含 ${bracketSize - teams.length} 个空种子 / BYE。`);
  }

  const plan: CompetitionPlan = {
    mode: "single_elimination",
    stageType: "knockout",
    stageName,
    boType: config.boType,
    advancementRule: `单败淘汰 · ${bracketSize} 队表 · 选择胜者后自动推进 · ${config.boType}`,
    teams,
    groups: [],
    rounds,
    byes,
    bracketColumns: [],
    warnings,
  };

  plan.bracketColumns = bracketColumnsFromPlan(plan);

  return plan;
}

function buildDoubleEliminationPlan(
  config: ComposerState,
  stageName: string,
  teams: PlanTeam[],
  warnings: string[],
): CompetitionPlan {
  const requestedSize = config.bracketSize <= 4 ? 4 : config.bracketSize <= 8 ? 8 : 16;
  const bracketSize = Math.max(requestedSize, clampNumber(nextPowerOfTwo(Math.max(teams.length, 2)), 4, 16));
  const seedOrder = seedSlotOrder(bracketSize);
  const winnerTeamCount = clampNumber(config.winnerTeamCount, 2, Math.min(bracketSize, Math.max(2, teams.length)));
  const loserTeamCount = clampNumber(config.loserTeamCount, 0, Math.min(Math.floor(bracketSize / 2), Math.max(0, teams.length - winnerTeamCount)));
  const winnerTeams = teams.slice(0, winnerTeamCount);
  const loserTeams = teams.slice(winnerTeamCount, winnerTeamCount + loserTeamCount);
  const slots = seedOrder.map((seed) => winnerTeams[seed - 1] ?? null);
  const loserOpeningSlots = Array.from({ length: Math.floor(bracketSize / 2) }, (_, index) => loserTeams[index] ?? null);
  const firstRoundSeries: PlanSeries[] = [];
  const loserFirstRoundSeries: PlanSeries[] = [];
  const byes: PlanBye[] = [];

  for (let index = 0; index < slots.length; index += 2) {
    const left = slots[index];
    const right = slots[index + 1];

    if (left && right) {
      firstRoundSeries.push({
        label: `WB-${firstRoundSeries.length + 1}`,
        position: firstRoundSeries.length + 1,
        radiant: left,
        dire: right,
        note: "胜者进入胜者组下一轮，败者落入败者组",
      });
    } else if (left ?? right) {
      byes.push({ team: (left ?? right) as PlanTeam, label: "胜者组首轮 BYE" });
    }
  }

  for (let index = 0; index < loserOpeningSlots.length; index += 2) {
    const left = loserOpeningSlots[index];
    const right = loserOpeningSlots[index + 1];

    if (left && right) {
      loserFirstRoundSeries.push({
        label: `LB-${loserFirstRoundSeries.length + 1}`,
        position: loserFirstRoundSeries.length + 1,
        radiant: left,
        dire: right,
        note: "败者组初始对阵，失败即淘汰",
      });
    } else if (left ?? right) {
      byes.push({ team: (left ?? right) as PlanTeam, label: "败者组首轮 BYE" });
    }
  }

  const winnerRoundCount = Math.log2(bracketSize);
  const rounds: PlanRound[] = [
    {
      name: "胜者组第 1 轮",
      roundNumber: 1,
      kind: "winner",
      series: firstRoundSeries,
      placeholderCount: Math.max(1, bracketSize / 2),
    },
  ];

  for (let roundIndex = 2; roundIndex <= winnerRoundCount; roundIndex += 1) {
    rounds.push({
      name: roundIndex === winnerRoundCount ? "胜者组决赛" : `胜者组第 ${roundIndex} 轮`,
      roundNumber: rounds.length + 1,
      kind: "winner",
      series: [],
      placeholderCount: Math.max(1, bracketSize / 2 ** roundIndex),
    });
  }

  const loserRoundCount = Math.max(1, (winnerRoundCount - 1) * 2);

  for (let roundIndex = 1; roundIndex <= loserRoundCount; roundIndex += 1) {
    rounds.push({
      name: roundIndex === loserRoundCount ? "败者组决赛" : `败者组第 ${roundIndex} 轮`,
      roundNumber: rounds.length + 1,
      kind: "loser",
      series: roundIndex === 1 ? loserFirstRoundSeries : [],
      placeholderCount: Math.max(1, Math.floor(bracketSize / 2 ** Math.ceil((roundIndex + 2) / 2))),
    });
  }

  rounds.push({
    name: "总决赛",
    roundNumber: rounds.length + 1,
    kind: "grand_final",
    series: [],
    placeholderCount: 1,
  });

  if (teams.length < bracketSize) {
    warnings.push(`当前 ${teams.length} 队会进入 ${bracketSize} 队双败表，首轮含 ${bracketSize - teams.length} 个空种子 / BYE。`);
  }

  if (loserTeamCount > 0) {
    warnings.push(`前 ${winnerTeamCount} 支进入胜者组，后 ${loserTeamCount} 支直接进入败者组；生成后可在对阵图上拖拽换位置。`);
  }

  if (teams.length > 16) {
    warnings.push("双败制当前对阵图最多按 16 队生成，更多队伍建议先经过瑞士轮或小组赛晋级。");
  }

  const plan: CompetitionPlan = {
    mode: "double_elimination",
    stageType: "knockout",
    stageName,
    boType: config.boType,
    advancementRule: `双败淘汰 · 胜者组 ${winnerTeamCount} 队 / 败者组 ${loserTeamCount} 队 · ${config.boType}`,
    teams,
    groups: [],
    rounds,
    byes,
    bracketColumns: [],
    warnings,
  };

  plan.bracketColumns = bracketColumnsFromPlan(plan);

  return plan;
}

function seedSlotOrder(size: number): number[] {
  if (size === 4) {
    return [1, 4, 2, 3];
  }

  if (size === 8) {
    return [1, 8, 4, 5, 2, 7, 3, 6];
  }

  return [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
}

function bracketColumnsFromPlan(plan: Pick<CompetitionPlan, "rounds">): BracketColumn[] {
  return plan.rounds.map((round) => ({
    title: round.name,
    tone: round.kind === "winner" || round.kind === "single" ? "good" : round.kind === "loser" ? "warn" : "info",
    nodes:
      round.series.length > 0
        ? round.series.map((series) => ({
            label: series.label,
            top: series.radiant.name,
            bottom: series.dire.name,
            meta: series.note ?? "草稿对阵",
          }))
        : Array.from({ length: round.placeholderCount }, (_, index) => ({
            label: `${round.name}-${index + 1}`,
            top: "待定",
            bottom: "待定",
            meta: round.kind === "grand_final" ? "由胜者组 / 败者组决出" : "等待上一轮推进",
          })),
  }));
}

function shell(content: string): string {
  const selected = state.detail;
  const stage = currentStage();
  const sourceTone: Tone = state.source === "api" ? "good" : "danger";

  return `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <span>MR</span>
          <div>
            <strong>MRJZ Admin</strong>
            <small>Dota 2 社区赛运营后台</small>
          </div>
        </div>

        <div class="scope-block">
          <div class="side-label">当前届次</div>
          <select class="side-select" data-tournament-select aria-label="选择届次">
            ${state.tournaments
              .map(
                (item) =>
                  `<option value="${escapeHtml(item.id)}" ${item.id === state.selectedTournamentId ? "selected" : ""}>${escapeHtml(item.name)}</option>`,
              )
              .join("")}
          </select>
          <div class="scope-meta">
            <span>league_id</span>
            <strong>${escapeHtml(selected?.league?.opendotaLeagueId ?? "未配置")}</strong>
          </div>
        </div>

        <nav>
          ${views
            .map(
              (view) => `
                <button class="nav-item ${view.key === activeView ? "is-active" : ""}" data-view="${view.key}" type="button">
                  <strong>${view.label}</strong>
                  <small>${view.hint}</small>
                </button>
              `,
            )
            .join("")}
        </nav>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div>
            <p>${escapeHtml(selected?.season?.name ?? "未选择届次")} / ${escapeHtml(stage?.name ?? "未选择阶段")}</p>
            <h1>${escapeHtml(selected?.name ?? "MRJZ 赛事后台")}</h1>
            <span>${escapeHtml(selected?.status ?? "no status")} · ${escapeHtml(state.teams.length)} 支队伍 · ${escapeHtml(state.matches.length)} 场数据库比赛</span>
          </div>
          <div class="topbar-actions">
            ${badge(state.source === "api" ? "API 在线" : "API 不可用", sourceTone)}
            <button class="secondary-button" data-reload type="button">刷新</button>
          </div>
        </header>

        <section class="status-strip">
          <span>API Base: <code>${escapeHtml(apiBaseUrl)}</code></span>
          <strong>${escapeHtml(state.loading ? "加载中" : state.notice)}</strong>
        </section>
        ${state.writeNotice ? `<div class="toast toast-${state.writeNotice.tone}">${escapeHtml(state.writeNotice.text)}</div>` : ""}
        ${content}
      </main>
    </div>
  `;
}

function renderOverview(): string {
  const pendingMatches = state.matches.filter((match) => match.linkedSeries === null);
  const recentMatches = state.matches.slice(0, 8);

  return `
    ${renderScheduleManagementConsole()}

    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>当前届次工作面</h2>
          <p>所有数据按左侧选中的届次隔离；队伍、选手、赛程和 OpenDota 比赛结果都落在这个范围内。</p>
        </div>
        ${badge(state.detail?.status ?? "未选择", toneForStatus(state.detail?.status))}
      </div>
      <div class="metrics-grid">
        ${metric("战队", state.teams.length, "已加入当前届次")}
        ${metric("选手", state.players.length, "手动创建或由已绑定比赛发现")}
        ${metric("数据库比赛", state.matches.length, "OpenDota raw_json")}
        ${metric("已绑定对阵", linkedMatchCount(), `${pendingMatches.length} 场待补双方`)}
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>待补对阵</h2>
          <p>这些比赛已经在数据库里，但还没有平台 series；补上双方后会自动关联赛果、选手和战队统计。</p>
        </div>
        <button class="secondary-button" data-view="matches" type="button">进入比赛库</button>
      </div>
      ${pendingMatches.length === 0 ? emptyState("当前没有待补对阵的 OpenDota 比赛。") : matchLinkList(pendingMatches.slice(0, 6))}
    </section>

    <section class="panel">
      <div class="section-heading compact">
        <div>
          <h2>最近比赛结果</h2>
          <p>直接读取 opendota_matches，不依赖是否已经创建平台赛程。</p>
        </div>
      </div>
      ${matchResultTable(recentMatches, false)}
    </section>
  `;
}

function renderEditions(): string {
  const selected = state.detail;

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>各届赛事</h2>
          <p>切换届次只改变当前管理范围，不混用其它届次的队伍、赛程或 OpenDota 结果。</p>
        </div>
        ${badge(`${state.tournaments.length} 届`, "info")}
      </div>
      <div class="edition-grid">
        ${state.tournaments
          .map(
            (item) => `
              <button class="edition-card ${item.id === state.selectedTournamentId ? "is-active" : ""}" data-tournament-id="${escapeHtml(item.id)}" type="button">
                <span>${escapeHtml(item.season?.name ?? "未命名赛季")}</span>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${badge(item.status, toneForStatus(item.status))} league_id ${escapeHtml(item.league?.opendotaLeagueId ?? "未配置")} · ${escapeHtml(item.teamCount ?? 0)} 队</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="panel form-grid">
      <form class="admin-form" data-action="create-tournament">
        <h2>添加新届次 / 联赛</h2>
        <label>赛事名称<input name="name" placeholder="例如 每日节奏第四届社区赛" required /></label>
        <label>赛季名称<input name="seasonName" placeholder="默认同赛事名称" /></label>
        <label>OpenDota league_id<input name="opendotaLeagueId" inputmode="numeric" placeholder="例如 19483" required /></label>
        <label>开始时间<input name="startsAt" type="datetime-local" /></label>
        <label>初始状态<select name="status"><option value="upcoming">即将开始</option><option value="running">正在进行</option><option value="draft">草稿</option></select></label>
        <button class="primary-button" type="submit">创建届次</button>
      </form>

      <form class="admin-form" data-action="update-lifecycle">
        <h2>当前届次状态</h2>
        <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
        <label>状态<select name="status">
          ${[
            ["upcoming", "即将开始"],
            ["running", "正在进行"],
            ["completed", "已结束"],
            ["archived", "已归档"],
          ]
            .map(([value, label]) => `<option value="${value}" ${selected?.status === value ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select></label>
        <label>开始时间<input name="startsAt" type="datetime-local" value="${escapeHtml(dateTimeLocalValue(selected?.startsAt))}" /></label>
        <label>结束时间<input name="endsAt" type="datetime-local" value="${escapeHtml(dateTimeLocalValue(selected?.endsAt))}" /></label>
        <button class="secondary-button" type="submit">保存生命周期</button>
      </form>
    </section>
  `;
}

function renderTeams(): string {
  return `
    <section class="panel team-ops-panel">
      <div class="section-heading">
        <div>
          <h2>战队管理</h2>
          <p>先建队也可以直接按 SteamID 加人；后端会补全可获取的 Steam / OpenDota 资料。</p>
        </div>
        ${badge(`${state.teams.length} 支队伍`, "info")}
      </div>
      <div class="team-command-grid">
        <form class="admin-form" data-action="create-team">
        <h2>创建战队</h2>
        <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
        <label>队伍名<input name="name" placeholder="队伍名" required /></label>
        <label>简称<input name="shortName" placeholder="可留空，默认取队伍名" /></label>
        <label>队伍头像 URL<input name="logoUrl" placeholder="可留空，后续手动维护" /></label>
        <label>颜色<input name="color" placeholder="#22c55e" /></label>
        <label>OpenDota team_id<input name="opendotaTeamId" inputmode="numeric" placeholder="可选，赛后可按名称补全" /></label>
        <button class="primary-button" type="submit">创建并加入当前届次</button>
        </form>

        <form class="admin-form" data-action="add-team-member">
          <h2>按 SteamID 添加队员</h2>
          <label>战队<select name="teamId" required>${teamOptions()}</select></label>
          <label>SteamID64 / Dota account_id<input name="steamId" inputmode="numeric" placeholder="例如 7656... 或 account_id" required /></label>
          <label>角色<input name="role" placeholder="player / captain" /></label>
          <label>昵称覆盖<input name="displayName" placeholder="可留空，自动读取" /></label>
          <label>头像覆盖 URL<input name="avatarUrl" placeholder="可留空，自动读取" /></label>
          <button class="secondary-button" type="submit" ${state.teams.length === 0 ? "disabled" : ""}>添加并同步资料</button>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading compact">
        <div>
          <h2>当前战队</h2>
          <p>队伍头像、颜色和成员都可以直接在卡片内维护；移除成员不会删除选手档案。</p>
        </div>
      </div>
      <div class="team-grid">
        ${state.teams.length === 0 ? emptyState("还没有战队。先创建战队，再按 SteamID 添加队员。") : state.teams.map(renderTeamCard).join("")}
      </div>
    </section>
  `;
}

function renderTeamCard(team: TournamentTeamListItem): string {
  const stat = team.stats;
  const heroes = stat.topHeroes.length === 0 ? "暂无英雄数据" : stat.topHeroes.map((hero) => `#${hero.heroId} ${hero.picks} pick`).join(" · ");

  return `
    <article class="team-card">
      <div class="team-card-head">
        ${teamLogo(team)}
        <div>
          <strong>${escapeHtml(team.name)}</strong>
          <small>seed ${escapeHtml(team.seed ?? "-")} · ${escapeHtml(team.memberCount)} 名成员</small>
        </div>
        ${badge(team.status, toneForStatus(team.status))}
      </div>
      <div class="stat-line">
        <span>Series</span><strong>${escapeHtml(stat.seriesWins)}-${escapeHtml(stat.seriesLosses)}</strong>
        <span>Game</span><strong>${escapeHtml(stat.gameWins)}-${escapeHtml(stat.gameLosses)}</strong>
        <span>胜率</span><strong>${escapeHtml(stat.winRate === null ? "-" : `${stat.winRate}%`)}</strong>
      </div>
      <div class="member-list">
        <strong>成员</strong>
        ${team.members.length === 0 ? `<span class="muted-copy">暂无成员，可以在下方输入 SteamID 添加。</span>` : team.members.map((member) => renderTeamMemberRow(team, member)).join("")}
      </div>
      <small>${escapeHtml(stat.linkedMatches)} 场已绑定比赛 · ${escapeHtml(heroes)}</small>

      <form class="team-edit-form" data-action="update-team">
        <input type="hidden" name="teamId" value="${escapeHtml(team.id)}" />
        <label>队伍名<input name="name" value="${escapeHtml(team.name)}" /></label>
        <label>头像 URL<input name="logoUrl" value="${escapeHtml(team.logoUrl ?? "")}" placeholder="手动头像 URL" /></label>
        <label>颜色<input name="color" value="${escapeHtml(team.color)}" /></label>
        <button class="secondary-button" type="submit">保存资料</button>
      </form>

      <form class="team-member-form" data-action="add-team-member">
        <input type="hidden" name="teamId" value="${escapeHtml(team.id)}" />
        <input name="steamId" inputmode="numeric" placeholder="SteamID64 / account_id" required />
        <input name="role" placeholder="角色" />
        <button class="secondary-button" type="submit">添加队员</button>
      </form>
    </article>
  `;
}

function teamLogo(team: TournamentTeamListItem): string {
  if (team.logoUrl) {
    return `<img class="team-logo" src="${escapeHtml(team.logoUrl)}" alt="" />`;
  }

  return `<span class="team-logo-fallback" style="background:${escapeHtml(team.color)}">${escapeHtml(team.name.slice(0, 2))}</span>`;
}

function renderTeamMemberRow(team: TournamentTeamListItem, member: TournamentTeamListItem["members"][number]): string {
  return `
    <form class="member-row" data-action="remove-team-member">
      <input type="hidden" name="teamId" value="${escapeHtml(team.id)}" />
      <input type="hidden" name="playerId" value="${escapeHtml(member.id)}" />
      ${playerAvatar(member)}
      <div>
        <strong>${escapeHtml(member.displayName)}</strong>
        <small>${escapeHtml(member.steamId64 ?? (member.accountId === null ? "未绑定 SteamID" : `account_id ${member.accountId}`))}</small>
      </div>
      <button class="link-button danger-link" type="submit">移除</button>
    </form>
  `;
}

function playerAvatar(member: TournamentTeamListItem["members"][number]): string {
  if (member.avatarUrl) {
    return `<img class="member-avatar" src="${escapeHtml(member.avatarUrl)}" alt="" />`;
  }

  return `<span class="member-avatar member-avatar-fallback">${escapeHtml(member.displayName.slice(0, 1).toUpperCase())}</span>`;
}

function renderPlayers(): string {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>选手管理</h2>
          <p>手动创建选手，或在 OpenDota 比赛绑定后由玩家 account_id 自动沉淀到这里。</p>
        </div>
        ${badge(`${state.players.length} 名选手`, "info")}
      </div>
      ${playersTable()}
    </section>

    <section class="panel">
      <form class="admin-form inline-form" data-action="create-player">
        <h2>创建选手</h2>
        <label>昵称<input name="displayName" placeholder="展示昵称" required /></label>
        <label>Dota account_id<input name="accountId" inputmode="numeric" placeholder="可留空" /></label>
        <label>SteamID64<input name="steamId64" inputmode="numeric" placeholder="可留空" /></label>
        <label>当前战队<select name="currentTeamId"><option value="">未选择</option>${teamOptions()}</select></label>
        <label>头像 URL<input name="avatarUrl" placeholder="可选" /></label>
        <button class="primary-button" type="submit">保存选手</button>
      </form>
    </section>
  `;
}

function playersTable(): string {
  if (state.players.length === 0) {
    return emptyState("暂无选手。绑定一场 OpenDota 比赛后会自动导入有 account_id 的玩家。");
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>选手</th><th>Steam / account_id</th><th>当前战队</th><th>历史归属</th></tr></thead>
        <tbody>
          ${state.players
            .map(
              (player) => `
                <tr>
                  <td><strong>${escapeHtml(player.displayName)}</strong><small>${escapeHtml(player.id)}</small></td>
                  <td>${escapeHtml(player.steamId64 ?? "-")}<small>${escapeHtml(player.accountId === null ? "" : `account_id ${player.accountId}`)}</small></td>
                  <td>${escapeHtml(player.currentTeam?.name ?? "未设置")}</td>
                  <td>${escapeHtml(player.teams.map((team) => team.name).join(" / ") || "-")}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMatches(): string {
  const pending = state.matches.filter((match) => match.linkedSeries === null);
  const linked = state.matches.filter((match) => match.linkedSeries !== null);

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>数据库比赛结果</h2>
          <p>这里展示当前届次 league_id 下已经落库的 OpenDota 比赛；不再靠前端猜测对阵双方。</p>
        </div>
        <div class="toolbar">${badge(`${pending.length} 未绑定`, pending.length > 0 ? "warn" : "good")}${badge(`${linked.length} 已绑定`, "info")}</div>
      </div>
      ${state.teams.length < 2 ? emptyState("至少创建两支战队后，才能给 OpenDota 比赛补对阵双方。") : ""}
      ${pending.length === 0 ? emptyState("当前没有待绑定比赛。") : matchLinkList(pending)}
    </section>

    <section class="panel">
      <div class="section-heading compact">
        <div>
          <h2>全部 OpenDota 结果</h2>
          <p>已绑定比赛会显示平台内的队名，未绑定比赛仍显示 OpenDota 原始天辉 / 夜魇名称。</p>
        </div>
      </div>
      ${matchResultTable(state.matches, true)}
    </section>
  `;
}

function matchLinkList(matches: OpenDotaMatchListItem[]): string {
  return `
    <div class="match-link-list">
      ${matches
        .map(
          (match) => `
            <form class="match-link-row" data-action="link-match">
              <input type="hidden" name="matchId" value="${escapeHtml(match.matchId)}" />
              <div>
                <strong>${escapeHtml(match.matchId)}</strong>
                <small>${escapeHtml(formatDate(match.startTime))} · ${escapeHtml(match.radiantScore ?? "-")} : ${escapeHtml(match.direScore ?? "-")} · ${escapeHtml(match.durationText ?? "-")}</small>
              </div>
              <div>
                <span>OpenDota</span>
                <small>${escapeHtml(match.radiantTeamName)} vs ${escapeHtml(match.direTeamName)}</small>
              </div>
              <select name="radiantTeamId" aria-label="选择天辉战队" required>
                <option value="">天辉战队</option>${teamOptions()}
              </select>
              <select name="direTeamId" aria-label="选择夜魇战队" required>
                <option value="">夜魇战队</option>${teamOptions()}
              </select>
              <button class="primary-button" type="submit" ${state.teams.length < 2 ? "disabled" : ""}>绑定对阵</button>
            </form>
          `,
        )
        .join("")}
    </div>
  `;
}

function matchResultTable(matches: OpenDotaMatchListItem[], includeLink: boolean): string {
  if (matches.length === 0) {
    return emptyState("当前届次还没有 OpenDota 比赛结果。");
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>match_id</th>
            <th>时间</th>
            <th>比分</th>
            <th>对阵</th>
            <th>数据</th>
            ${includeLink ? "<th>平台关联</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${matches
            .map((match) => {
              const linked = match.linkedSeries;
              const radiant = linked?.radiantTeam.name ?? match.radiantTeamName;
              const dire = linked?.direTeam.name ?? match.direTeamName;
              const winner = match.radiantWin === null ? "未知胜方" : match.radiantWin ? "天辉胜" : "夜魇胜";

              return `
                <tr>
                  <td><code>${escapeHtml(match.matchId)}</code><small>${escapeHtml(match.leagueName)}</small></td>
                  <td>${escapeHtml(formatDate(match.startTime))}<small>${escapeHtml(match.durationText ?? "-")}</small></td>
                  <td><strong>${escapeHtml(match.radiantScore ?? "-")} : ${escapeHtml(match.direScore ?? "-")}</strong><small>${escapeHtml(winner)}</small></td>
                  <td>${escapeHtml(radiant)} vs ${escapeHtml(dire)}<small>${linked ? "平台队伍" : "OpenDota 原始名称"}</small></td>
                  <td>${badge(match.parseStatus, toneForStatus(match.parseStatus))}<small>${escapeHtml(match.playerCount)} 玩家 · BP ${match.hasDraft ? "有" : "无"}</small></td>
                  ${includeLink ? `<td>${linked ? badge(`series ${linked.seriesId}`, "good") : badge("未绑定", "warn")}</td>` : ""}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCompetitionComposer(): string {
  const plan = buildCompetitionPlan({
    ...composerState,
    mode: isEliminationMode(composerState.mode) ? composerState.mode : "single_elimination",
  });
  const selectedIds = new Set(plan.teams.map((team) => team.id));

  return `
    <section class="panel composer-panel">
      <div class="section-heading">
        <div>
          <h2>淘汰赛对阵图生成</h2>
          <p>选择进入淘汰赛的队伍后直接生成单败或双败对阵图；后续每场只需要点选胜者。</p>
        </div>
        <div class="toolbar">${badge(modeLabel(plan.mode), "info")}${badge(`${plan.teams.length} 支队伍`, plan.teams.length >= 2 ? "good" : "warn")}</div>
      </div>
      <div class="composer-layout">
        <form class="admin-form composer-form" data-action="generate-stage-plan">
          <h2>生成淘汰赛阶段</h2>
          <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
          <div class="mode-segment" role="radiogroup" aria-label="赛制">
            ${[
              ["single_elimination", "单败制"],
              ["double_elimination", "双败制"],
            ]
              .map(
                ([value, label]) => `
                  <label>
                    <input name="mode" value="${value}" type="radio" data-composer-field ${composerState.mode === value ? "checked" : ""} />
                    <span>${label}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
          <label>阶段名称<input name="stageName" data-composer-field value="${escapeHtml(composerState.stageName)}" placeholder="${escapeHtml(defaultStageName(composerState.mode))}" /></label>
          <label>默认 BO
            <select name="boType" data-composer-field>
              ${["BO1", "BO2", "BO3", "BO5"].map((bo) => `<option value="${bo}" ${composerState.boType === bo ? "selected" : ""}>${bo}</option>`).join("")}
            </select>
          </label>
          <label>计划起始时间<input name="scheduledAt" data-composer-field type="datetime-local" value="${escapeHtml(composerState.scheduledAt)}" /></label>
          ${renderModeFields()}
          <div class="team-picker">
            <div>
              <strong>进入淘汰赛的队伍</strong>
              <small>默认按 seed 选前 N 支，也可以手动勾选。这里显示完整队伍名称。</small>
            </div>
            <div class="team-pick-grid">
              ${sortedTeams()
                .map(
                  (team) => `
                    <label class="team-pick">
                      <input name="teamIds" value="${escapeHtml(team.id)}" type="checkbox" data-composer-field ${selectedIds.has(team.id) ? "checked" : ""} />
                      <span style="background:${escapeHtml(team.color)}"></span>
                      <strong>${escapeHtml(team.name)}</strong>
                      <small>seed ${escapeHtml(team.seed ?? "-")}</small>
                    </label>
                  `,
                )
                .join("")}
            </div>
          </div>
          <button class="primary-button" type="submit" ${plan.teams.length < 2 ? "disabled" : ""}>生成对阵图</button>
        </form>
        <div class="plan-preview">
          ${renderPlanPreview(plan)}
        </div>
      </div>
    </section>
  `;
}

function renderModeFields(): string {
  if (composerState.mode === "group") {
    return `
      <div class="mode-field-grid">
        <label>分组数<input name="groupCount" data-composer-field inputmode="numeric" value="${escapeHtml(composerState.groupCount)}" /></label>
        <label>循环次数<select name="groupLoops" data-composer-field>
          <option value="1" ${composerState.groupLoops === 1 ? "selected" : ""}>单循环</option>
          <option value="2" ${composerState.groupLoops === 2 ? "selected" : ""}>双循环</option>
        </select></label>
        <label>每组晋级<input name="advancePerGroup" data-composer-field inputmode="numeric" value="${escapeHtml(composerState.advancePerGroup)}" /></label>
      </div>
    `;
  }

  if (isEliminationMode(composerState.mode)) {
    return `
      <div class="mode-field-grid">
        <label>对阵图规模<select name="bracketSize" data-composer-field>
          ${[4, 8, 16].map((size) => `<option value="${size}" ${composerState.bracketSize === size ? "selected" : ""}>${size} 支队伍</option>`).join("")}
        </select></label>
        <label>晋级规则<input value="${composerState.mode === "double_elimination" ? "胜者组 / 败者组 / 总决赛" : "胜者直接进入下一轮"}" readonly /></label>
        ${
          composerState.mode === "double_elimination"
            ? `
              <label>胜者组初始队伍<input name="winnerTeamCount" data-composer-field inputmode="numeric" value="${escapeHtml(composerState.winnerTeamCount)}" /></label>
              <label>败者组初始队伍<input name="loserTeamCount" data-composer-field inputmode="numeric" value="${escapeHtml(composerState.loserTeamCount)}" /></label>
            `
            : ""
        }
      </div>
    `;
  }

  return `
    <div class="mode-field-grid">
      <label>总轮数<input name="swissRounds" data-composer-field inputmode="numeric" value="${escapeHtml(composerState.swissRounds)}" /></label>
      <label>配对策略<input value="首轮种子高低配，后续同分优先" readonly /></label>
    </div>
  `;
}

function renderPlanPreview(plan: CompetitionPlan): string {
  return `
    <div class="plan-summary">
      <div>
        <span>阶段</span>
        <strong>${escapeHtml(plan.stageName)}</strong>
        <small>${escapeHtml(plan.advancementRule)}</small>
      </div>
      <div>
        <span>写入内容</span>
        <strong>${escapeHtml(plan.rounds.length)} 轮 / ${escapeHtml(plan.rounds.reduce((count, round) => count + round.series.length, 0))} 场</strong>
        <small>series 会以 draft 状态创建，等待管理员发布</small>
      </div>
      <div>
        <span>轮空</span>
        <strong>${escapeHtml(plan.byes.length)}</strong>
        <small>${escapeHtml(plan.byes.map((bye) => bye.team.name).join("、") || "无")}</small>
      </div>
    </div>
    ${plan.warnings.length > 0 ? `<div class="warning-list">${plan.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}</div>` : ""}
    ${plan.groups.length > 0 ? renderGroupPreview(plan.groups) : ""}
    ${plan.bracketColumns.length > 0 ? renderBracketColumns(plan.bracketColumns) : renderRoundPreview(plan.rounds)}
  `;
}

function renderGroupPreview(groups: PlanGroup[]): string {
  return `
    <div class="group-preview">
      ${groups
        .map(
          (group) => `
            <div>
              <strong>${escapeHtml(group.name)}</strong>
              <small>${escapeHtml(group.teams.map((team) => team.name).join(" / ") || "暂无队伍")}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderRoundPreview(rounds: PlanRound[]): string {
  return `
    <div class="round-preview">
      ${rounds
        .slice(0, 8)
        .map(
          (round) => `
            <div class="round-preview-row">
              <strong>${escapeHtml(round.name)}</strong>
              <small>${escapeHtml(round.series.map((series) => `${series.radiant.name} vs ${series.dire.name}`).join(" · ") || "待生成对阵")}</small>
            </div>
          `,
        )
        .join("")}
      ${rounds.length > 8 ? `<div class="muted-copy">还有 ${escapeHtml(rounds.length - 8)} 轮会随草稿写入。</div>` : ""}
    </div>
  `;
}

function renderBracketColumns(columns: BracketColumn[]): string {
  return `
    <div class="bracket-board">
      ${columns
        .map(
          (column) => `
            <div class="bracket-column bracket-column-${column.tone}">
              <strong>${escapeHtml(column.title)}</strong>
              <div>
                ${column.nodes
                  .map(
                    (node) => `
                      <div class="bracket-node">
                        <span>${escapeHtml(node.label)}</span>
                        <b>${escapeHtml(node.top)}</b>
                        <b>${escapeHtml(node.bottom)}</b>
                        <small>${escapeHtml(node.meta)}</small>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function existingBracketColumns(): BracketColumn[] {
  if (state.bracket.length > 0) {
    const grouped = new Map<string, BracketColumn>();

    for (const node of state.bracket) {
      const key = `${node.roundNumber}-${node.roundName}`;
      const column =
        grouped.get(key) ??
        ({
          title: node.roundName,
          tone: "info",
          nodes: [],
        } satisfies BracketColumn);

      column.nodes.push({
        label: `#${node.position}`,
        top: bracketNodeRadiantTeam(node)?.name || "待定",
        bottom: bracketNodeDireTeam(node)?.name || "待定",
        meta: node.winnerTeamId ? `胜者 ${bracketNodeWinnerName(node)}` : node.status,
      });
      grouped.set(key, column);
    }

    return [...grouped.values()];
  }

  const stage = currentStage();

  if (stage?.type !== "knockout" || state.rounds.length === 0) {
    return [];
  }

  return state.rounds.map((round) => ({
    title: round.name,
    tone: round.name.includes("胜者") ? "good" : round.name.includes("败者") ? "warn" : "info",
    nodes:
      round.series.length > 0
        ? round.series.map((series, index) => ({
            label: `${round.roundNumber}-${index + 1}`,
            top: series.radiantTeam.name,
            bottom: series.direTeam.name,
            meta: series.status,
          }))
        : [
            {
              label: `${round.roundNumber}-待定`,
              top: "待定",
              bottom: "待定",
              meta: round.pairingStatus ?? round.status,
            },
          ],
  }));
}

function bracketNodeRadiantTeam(node: BracketNode): BracketNode["radiantTeam"] {
  return node.radiantTeam ?? node.series?.radiantTeam ?? null;
}

function bracketNodeDireTeam(node: BracketNode): BracketNode["direTeam"] {
  return node.direTeam ?? node.series?.direTeam ?? null;
}

function bracketNodeWinnerName(node: BracketNode): string {
  const winnerId = node.winnerTeamId;

  if (!winnerId) {
    return "待定";
  }

  return bracketNodeRadiantTeam(node)?.id === winnerId
    ? bracketNodeRadiantTeam(node)?.name ?? "待定"
    : bracketNodeDireTeam(node)?.id === winnerId
      ? bracketNodeDireTeam(node)?.name ?? "待定"
      : "待定";
}

function renderKnockoutManager(): string {
  const stage = currentStage();

  if (stage?.type !== "knockout") {
    return "";
  }

  if (state.bracket.length === 0) {
    return `
      <section class="panel knockout-manager">
        <div class="section-heading">
          <div>
            <h2>淘汰赛对阵图</h2>
            <p>先用上方编排器选择入围队伍并生成对阵图。</p>
          </div>
          ${badge("尚未生成", "warn")}
        </div>
        ${emptyState("当前淘汰赛阶段还没有 bracket 节点。")}
      </section>
    `;
  }

  const pendingPickCount = state.bracket.filter((node) => {
    const radiant = bracketNodeRadiantTeam(node);
    const dire = bracketNodeDireTeam(node);
    return node.winnerTeamId === null && radiant !== null && dire !== null;
  }).length;

  return `
    <section class="panel knockout-manager">
      <div class="section-heading">
        <div>
          <h2>淘汰赛对阵图</h2>
          <p>每个节点只需要点选胜者；后端会更新 series 并把胜者推进到下一轮。</p>
        </div>
        <div class="toolbar">${badge(`${state.bracket.length} 个节点`, "info")}${badge(`${pendingPickCount} 场待选胜者`, pendingPickCount > 0 ? "warn" : "good")}</div>
      </div>
      ${renderBracketSeedDock()}
      ${renderLiveBracketBoard()}
    </section>
  `;
}

function renderBracketSeedDock(): string {
  const teams = sortedTeams();

  if (teams.length === 0) {
    return "";
  }

  return `
    <div class="bracket-seed-dock">
      <div>
        <strong>拖拽调整队伍位置</strong>
        <small>把队伍拖到任意上位/下位槽；已有真实胜者后会锁定位置。</small>
      </div>
      <div>
        ${teams
          .map(
            (team) => `
              <span class="bracket-seed-chip" draggable="true" data-drag-team="${escapeHtml(team.id)}">
                <i style="background:${escapeHtml(team.color)}"></i>
                <b>${escapeHtml(team.name)}</b>
              </span>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderLiveBracketBoard(): string {
  const grouped = new Map<string, BracketNode[]>();

  for (const node of state.bracket) {
    const key = `${node.roundNumber}-${node.roundName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), node]);
  }

  return `
    <div class="live-bracket-board">
      ${[...grouped.entries()]
        .map(([key, nodes]) => {
          const roundName = key.replace(/^\d+-/, "");
          const tone = nodes.some((node) => node.bracketGroup === "loser")
            ? "warn"
            : nodes.some((node) => node.bracketGroup === "winner" || node.bracketGroup === "single")
              ? "good"
              : "info";

          return `
            <div class="live-bracket-column bracket-column-${tone}">
              <strong>${escapeHtml(roundName)}</strong>
              <div>
                ${nodes.map(renderLiveBracketNode).join("")}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderLiveBracketNode(node: BracketNode): string {
  const radiant = bracketNodeRadiantTeam(node);
  const dire = bracketNodeDireTeam(node);
  const canPickWinner = node.winnerTeamId === null && radiant !== null && dire !== null;
  const winnerName = bracketNodeWinnerName(node);

  return `
    <div class="live-bracket-node ${node.winnerTeamId ? "is-completed" : ""}">
      <div class="node-head">
        <span>#${escapeHtml(node.position)}</span>
        ${badge(node.winnerTeamId ? "已完成" : canPickWinner ? "等待选择" : "等待晋级", node.winnerTeamId ? "good" : canPickWinner ? "warn" : "neutral")}
      </div>
      ${renderBracketTeamLine(node, radiant, "radiant")}
      ${renderBracketTeamLine(node, dire, "dire")}
      ${
        node.winnerTeamId
          ? `<div class="winner-chip">胜者：${escapeHtml(winnerName)}</div>`
          : canPickWinner
            ? `
              <div class="winner-actions">
                ${renderWinnerForm(node.id, radiant)}
                ${renderWinnerForm(node.id, dire)}
              </div>
            `
            : `<small class="muted-copy">上一轮结束后自动落位</small>`
      }
    </div>
  `;
}

function renderBracketTeamLine(node: BracketNode, team: BracketNode["radiantTeam"], slot: "radiant" | "dire"): string {
  const winner = team !== null && node.winnerTeamId === team.id;

  return `
    <div class="bracket-team-line ${winner ? "is-winner" : ""}" data-bracket-slot-drop="${escapeHtml(node.id)}:${escapeHtml(slot)}">
      <span>${slot === "radiant" ? "上位" : "下位"}</span>
      <strong>${escapeHtml(team?.name ?? "待定")}</strong>
      ${
        team === null || node.winnerTeamId
          ? ""
          : `
            <form data-action="set-bracket-slot">
              <input type="hidden" name="nodeId" value="${escapeHtml(node.id)}" />
              <input type="hidden" name="slot" value="${escapeHtml(slot)}" />
              <input type="hidden" name="teamId" value="" />
              <button class="link-button danger-link" type="submit" title="清空槽位">清空</button>
            </form>
          `
      }
    </div>
  `;
}

function renderWinnerForm(nodeId: string, team: BracketNode["radiantTeam"]): string {
  if (team === null) {
    return "";
  }

  return `
    <form data-action="advance-bracket-node">
      <input type="hidden" name="nodeId" value="${escapeHtml(nodeId)}" />
      <input type="hidden" name="winnerTeamId" value="${escapeHtml(team.id)}" />
      <button class="secondary-button winner-button" type="submit">${escapeHtml(team.name)} 胜</button>
    </form>
  `;
}

function renderManualStageTools(): string {
  const stage = currentStage();

  if (stage === null || stage.type === "knockout") {
    return "";
  }

  return `
    <section class="panel manual-stage-panel">
      <div class="section-heading">
        <div>
          <h2>${escapeHtml(stage.type === "group" ? "小组赛手动管理" : "瑞士轮手动管理")}</h2>
          <p>${escapeHtml(stage.type === "group" ? "先建任意数量的小组，再把队伍手动加入小组；对阵和结果都由管理员维护。" : "设置轮次后手动添加每轮对阵；胜负平会按 1-2-1 这种格式同步到 H5。")}</p>
        </div>
        ${badge("胜 3 / 平 1 / 负 0", "info")}
      </div>
      ${stage.type === "group" ? renderGroupManager(stage) : ""}
      ${stage.type === "swiss" ? renderSwissManager(stage) : ""}
      ${renderManualSeriesManager(stage)}
    </section>
  `;
}

function renderSwissManager(stage: StageSummary): string {
  const nextRoundNumber = Math.max(1, ...state.rounds.map((round) => round.roundNumber + 1));

  return `
    <div class="swiss-manager">
      <form class="admin-form inline-form swiss-generate-form" data-action="generate-swiss-pairings">
        <h2>自动生成瑞士轮配对</h2>
        <input type="hidden" name="stageId" value="${escapeHtml(stage.id)}" />
        <label>轮次<input name="roundNumber" inputmode="numeric" value="${escapeHtml(nextRoundNumber)}" /></label>
        <label>BO<select name="boType">${boOptions("BO2")}</select></label>
        <button class="primary-button" type="submit" ${state.teams.length < 2 ? "disabled" : ""}>生成配对草稿</button>
      </form>
      <div class="swiss-round-list">
        ${
          state.rounds.length === 0
            ? emptyState("还没有瑞士轮。生成第 1 轮后，管理员确认配对再录入结果。")
            : state.rounds.map(renderSwissRoundCard).join("")
        }
      </div>
    </div>
  `;
}

function renderSwissRoundCard(round: StageRound): string {
  const byes = round.byes ?? [];

  return `
    <article class="swiss-round-card">
      <div>
        <strong>${escapeHtml(round.name)}</strong>
        <small>${escapeHtml(round.series.length)} 场${byes.length > 0 ? ` · ${escapeHtml(byes.length)} 支轮空` : ""} · ${escapeHtml(round.pairingStatus ?? "draft")}</small>
        ${
          byes.length === 0
            ? ""
            : `<div class="swiss-bye-list">${byes
                .map((team) => `<span>${escapeHtml(team.name)} 轮空胜</span>`)
                .join("")}</div>`
        }
      </div>
      <div class="toolbar">
        ${badge(round.pairingStatus === "confirmed" ? "已确认" : "草稿", round.pairingStatus === "confirmed" ? "good" : "warn")}
        <form data-action="confirm-swiss-round">
          <input type="hidden" name="roundId" value="${escapeHtml(round.id)}" />
          <button class="secondary-button" type="submit" ${round.pairingStatus === "confirmed" ? "disabled" : ""}>确认本轮</button>
        </form>
        <form data-action="retract-swiss-round">
          <input type="hidden" name="roundId" value="${escapeHtml(round.id)}" />
          <button class="link-button danger-link" type="submit">撤回并清空后续</button>
        </form>
      </div>
    </article>
  `;
}

function renderGroupManager(stage: StageSummary): string {
  const lockedRoster = state.scheduleManagement?.teams ?? [];

  return `
    <div class="manual-grid">
      <div class="stack">
        <form class="admin-form" data-action="randomize-stage-groups">
          <h2>随机分组</h2>
          <input type="hidden" name="stageId" value="${escapeHtml(stage.id)}" />
          <label>小组数量<input name="groupCount" inputmode="numeric" placeholder="例如 2" /></label>
          <label>每组队伍数<input name="groupSize" inputmode="numeric" placeholder="也可填每组人数" /></label>
          <div class="seed-pick-list">
            ${
              lockedRoster.length === 0
                ? `<span class="muted-copy">未锁定官方名单时会使用当前届次全部战队。</span>`
                : lockedRoster
                    .map(
                      (item) => `
                        <label>
                          <input type="checkbox" name="seededTeamIds" value="${escapeHtml(item.team.id)}" ${item.isSeeded ? "checked" : ""} />
                          ${escapeHtml(item.team.name)}
                        </label>
                      `,
                    )
                    .join("")
            }
          </div>
          <button class="secondary-button" type="submit" ${state.teams.length < 2 ? "disabled" : ""}>随机生成小组</button>
        </form>
        <form class="admin-form" data-action="generate-group-round-robin">
          <h2>生成 BO2 单循环</h2>
          <input type="hidden" name="stageId" value="${escapeHtml(stage.id)}" />
          <label>BO<select name="boType">${boOptions("BO2")}</select></label>
          <label class="checkbox-line"><input type="checkbox" name="replaceExisting" value="true" checked /> 替换已有积分赛对阵</label>
          <button class="primary-button" type="submit" ${state.groups.length === 0 ? "disabled" : ""}>生成小组赛程</button>
        </form>
        <form class="admin-form" data-action="create-stage-group">
          <h2>创建小组</h2>
          <input type="hidden" name="stageId" value="${escapeHtml(stage.id)}" />
          <label>小组名称<input name="name" placeholder="例如 A 组" required /></label>
          <label>排序<input name="sortOrder" inputmode="numeric" placeholder="可留空" /></label>
          <button class="primary-button" type="submit">添加小组</button>
        </form>
        <form class="admin-form" data-action="add-stage-group-team">
          <h2>把队伍加入小组</h2>
          <label>小组<select name="groupId" required>${groupOptions()}</select></label>
          <label>队伍<select name="teamId" required><option value="">选择完整队伍名称</option>${teamOptions()}</select></label>
          <label>组内 seed<input name="seed" inputmode="numeric" placeholder="可留空" /></label>
          <button class="secondary-button" type="submit" ${state.groups.length === 0 || state.teams.length === 0 ? "disabled" : ""}>加入小组</button>
        </form>
      </div>
      <div class="group-admin-list">
        ${
          state.groups.length === 0
            ? emptyState("还没有小组。先创建 A 组、B 组等，再手动加入队伍。")
            : state.groups.map(renderStageGroupCard).join("")
        }
      </div>
    </div>
  `;
}

function renderStageGroupCard(group: StageGroup): string {
  return `
    <article class="group-admin-card" data-group-drop="${escapeHtml(group.id)}">
      <form class="group-head-form" data-action="update-stage-group">
        <input type="hidden" name="groupId" value="${escapeHtml(group.id)}" />
        <label>小组名称<input name="name" value="${escapeHtml(group.name)}" required /></label>
        <label>排序<input name="sortOrder" inputmode="numeric" value="${escapeHtml(group.sortOrder)}" /></label>
        <button class="secondary-button" type="submit">保存</button>
      </form>
      <div class="group-team-list">
        ${
          group.teams.length === 0
            ? `<span class="muted-copy">这个小组还没有队伍。</span>`
            : group.teams
                .map(
                  (team) => `
                    <form class="group-team-chip" data-action="remove-stage-group-team" draggable="true" data-drag-team="${escapeHtml(team.id)}">
                      <input type="hidden" name="groupId" value="${escapeHtml(group.id)}" />
                      <input type="hidden" name="teamId" value="${escapeHtml(team.id)}" />
                      <strong>${escapeHtml(team.name)}</strong>
                      <button class="link-button danger-link" type="submit">移除</button>
                    </form>
                  `,
                )
                .join("")
        }
      </div>
      <form data-action="delete-stage-group">
        <input type="hidden" name="groupId" value="${escapeHtml(group.id)}" />
        <button class="link-button danger-link" type="submit">删除这个小组</button>
      </form>
    </article>
  `;
}

function renderManualSeriesManager(stage: StageSummary): string {
  return `
    <div class="manual-series-panel">
      <form class="admin-form inline-form manual-series-form" data-action="create-manual-series">
        <h2>手动添加对阵</h2>
        <input type="hidden" name="stageId" value="${escapeHtml(stage.id)}" />
        <label>轮次<select name="roundId" required>${roundOptions()}</select></label>
        ${
          stage.type === "group"
            ? `<label>小组<select name="groupId"><option value="">不指定小组</option>${groupOptions()}</select></label>`
            : `<input type="hidden" name="groupId" value="" />`
        }
        <label>队伍 1<select name="radiantTeamId" required><option value="">选择完整队伍名称</option>${teamOptions()}</select></label>
        <label>队伍 2<select name="direTeamId" required><option value="">选择完整队伍名称</option>${teamOptions()}</select></label>
        <label>类型<select name="seriesKind"><option value="regular">积分赛</option><option value="tiebreaker">加赛</option></select></label>
        <label>BO<select name="boType">${boOptions("BO2")}</select></label>
        <label>开赛时间<input name="scheduledAt" type="datetime-local" /></label>
        <button class="primary-button" type="submit" ${state.rounds.length === 0 || state.teams.length < 2 ? "disabled" : ""}>添加对阵</button>
      </form>
    </div>
  `;
}

function renderStages(): string {
  const stages = state.detail?.stages ?? [];
  const stage = currentStage();

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>阶段配置</h2>
          <p>先创建小组赛 / 瑞士轮 / 淘汰赛阶段，再由管理员手动维护小组、轮次、对阵和赛果。</p>
        </div>
        ${badge("后端计算排名与晋级", "info")}
      </div>
      <div class="stage-grid">
        ${stages
          .map(
            (item) => `
              <button class="stage-card ${item.id === state.selectedStageId ? "is-active" : ""}" data-stage-id="${escapeHtml(item.id)}" type="button">
                <small>${escapeHtml(item.type)}</small>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${badge(item.status, toneForStatus(item.status))} · 顺序 ${escapeHtml(item.sortOrder)}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>

    ${renderCompetitionComposer()}

    ${renderManualStageTools()}

    ${renderKnockoutManager()}

    <section class="panel split-panel">
      <div>
        <div class="section-heading compact">
          <div>
            <h2>积分榜 / Bracket</h2>
            <p>${escapeHtml(stage?.name ?? "当前阶段")} 的排名、轮次和 bracket 快照。</p>
          </div>
        </div>
        ${standingsTable()}
      </div>
      <div class="stack">
        <form class="admin-form" data-action="create-stage">
          <h2>创建阶段</h2>
          <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
          <label>名称<input name="name" placeholder="例如 小组赛 / 瑞士轮预赛" required /></label>
          <label>赛制<select name="type"><option value="group">普通小组赛</option><option value="swiss">瑞士轮</option><option value="knockout">淘汰赛</option></select></label>
          <label>默认 BO<input name="boType" placeholder="例如 BO3" /></label>
          <label>瑞士轮轮数<input name="swissRounds" inputmode="numeric" placeholder="瑞士轮可填，例如 5" /></label>
          <button class="primary-button" type="submit">提交阶段</button>
        </form>
        <form class="admin-form" data-action="create-round">
          <h2>创建轮次</h2>
          <label>阶段<select name="stageId" required>${stageOptions()}</select></label>
          <label>轮次名称<input name="name" placeholder="例如 第 1 轮" required /></label>
          <label>轮次数字<input name="roundNumber" inputmode="numeric" placeholder="可留空" /></label>
          <button class="secondary-button" type="submit">提交轮次</button>
        </form>
        <form class="admin-form" data-action="clear-match-records">
          <h2>清空比赛记录</h2>
          <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
          <p class="muted-copy">会删除当前届次已有 rounds / series / bracket / standings 和 OpenDota 缓存比赛记录，保留队伍、阶段和小组配置。</p>
          <button class="secondary-button danger-link" type="submit">清空当前届比赛记录</button>
        </form>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>赛程赛果</h2>
          <p>这里显示平台 series；OpenDota 真实比赛可在“比赛结果库”中一键补成 BO1 series。</p>
        </div>
      </div>
      ${scheduleTable()}
    </section>
  `;
}

function scheduleTable(): string {
  const rows = allSeries();

  if (rows.length === 0) {
    return emptyState("当前阶段还没有平台赛程。可以先到比赛结果库把真实 match 绑定为 series。");
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>时间</th><th>阶段 / 轮次</th><th>对阵</th><th>BO</th><th>状态</th><th>match_id</th><th>管理</th></tr></thead>
        <tbody>
          ${rows
            .map((row) => {
              const round = state.rounds.find((item) => item.id === row.roundId);

              return `
                <tr>
                  <td>${escapeHtml(formatDate(row.scheduledAt))}</td>
                  <td>${escapeHtml(currentStage()?.name ?? row.stageId)}<small>${escapeHtml([row.groupName, round?.name ?? row.roundId].filter(Boolean).join(" · "))}</small></td>
                  <td>${escapeHtml(row.radiantTeam.name)} vs ${escapeHtml(row.direTeam.name)}<small>${escapeHtml(row.seriesKind === "tiebreaker" ? "加赛" : "积分赛")} · ${escapeHtml(row.radiantScore)} : ${escapeHtml(row.direScore)}</small></td>
                  <td>${escapeHtml(row.boType)}</td>
                  <td>${badge(row.status, toneForStatus(row.status))}</td>
                  <td>${escapeHtml(row.games.map((game) => game.matchId ?? "待关联").join(" / "))}</td>
                  <td>${renderSeriesAdminForms(row)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSeriesAdminForms(row: StageRound["series"][number]): string {
  return `
    <div class="series-admin-actions">
      <form data-action="update-series-result">
        <input type="hidden" name="seriesId" value="${escapeHtml(row.id)}" />
        <input name="radiantScore" inputmode="numeric" value="${escapeHtml(row.radiantScore)}" aria-label="${escapeHtml(row.radiantTeam.name)} 比分" />
        <input name="direScore" inputmode="numeric" value="${escapeHtml(row.direScore)}" aria-label="${escapeHtml(row.direTeam.name)} 比分" />
        <button class="secondary-button" type="submit">保存比分</button>
      </form>
      <form data-action="update-series">
        <input type="hidden" name="seriesId" value="${escapeHtml(row.id)}" />
        <select name="roundId" aria-label="轮次">${roundOptions(row.roundId)}</select>
        <select name="groupId" aria-label="小组"><option value="">无小组</option>${groupOptions(row.groupId ?? "")}</select>
        <select name="seriesKind" aria-label="类型"><option value="regular" ${row.seriesKind === "regular" ? "selected" : ""}>积分赛</option><option value="tiebreaker" ${row.seriesKind === "tiebreaker" ? "selected" : ""}>加赛</option></select>
        <select name="radiantTeamId" aria-label="队伍 1">${teamOptions(row.radiantTeam.id)}</select>
        <select name="direTeamId" aria-label="队伍 2">${teamOptions(row.direTeam.id)}</select>
        <select name="boType" aria-label="BO">${boOptions(row.boType as SeriesBoType)}</select>
        <input name="scheduledAt" type="datetime-local" value="${escapeHtml(dateTimeLocalValue(row.scheduledAt))}" aria-label="开赛时间" />
        <button class="secondary-button" type="submit">修改</button>
      </form>
      <form data-action="delete-series">
        <input type="hidden" name="seriesId" value="${escapeHtml(row.id)}" />
        <button class="link-button danger-link" type="submit">删除对阵</button>
      </form>
    </div>
  `;
}

function renderScheduleManagementConsole(): string {
  const schedule = state.scheduleManagement;
  const status = schedule?.status ?? "unconfigured";
  const rosterIds = new Set(schedule?.teams.map((item) => item.team.id) ?? []);
  const seededIds = new Set(schedule?.teams.filter((item) => item.isSeeded).map((item) => item.team.id) ?? []);
  const checks = officialScheduleChecks();

  return `
    <section class="panel schedule-console">
      <div class="section-heading">
        <div>
          <h2>官方赛程管理</h2>
          <p>这里管理 H5 赛程页会展示的官方赛程；比赛列表、比赛记录和战报仍然读取 OpenDota 数据。</p>
        </div>
        <div class="toolbar">
          ${badge(scheduleStatusLabel(status), toneForStatus(status))}
          ${badge(schedule?.rosterLocked ? "名单已锁定" : "名单未锁定", schedule?.rosterLocked ? "good" : "warn")}
        </div>
      </div>

      <div class="schedule-console-grid">
        <div class="schedule-step">
          <div class="step-head">
            <span>1</span>
            <div>
              <strong>参赛名单</strong>
              <small>从当前届次已有战队里勾选。名单锁定后才进入赛制配置。</small>
            </div>
          </div>
          ${
            schedule?.rosterLocked
              ? renderLockedRoster(schedule)
              : renderRosterLockForm(rosterIds, seededIds)
          }
        </div>

        <div class="schedule-step">
          <div class="step-head">
            <span>2</span>
            <div>
              <strong>赛制选择</strong>
              <small>一届比赛固定一个预赛和一个淘汰赛。这里只保存选择，具体编排在下方完成。</small>
            </div>
          </div>
          ${renderScheduleConfigForm(schedule)}
        </div>

        <div class="schedule-step">
          <div class="step-head">
            <span>3</span>
            <div>
              <strong>发布检查</strong>
              <small>发布后 H5 赛程页才会显示官方赛程；撤回后显示“赛程暂未发布”。</small>
            </div>
          </div>
          <div class="check-list">
            ${checks.map((check) => `<span class="${check.ok ? "is-ok" : "is-missing"}">${escapeHtml(check.text)}</span>`).join("")}
          </div>
          <div class="publish-actions">
            <form data-action="publish-official-schedule">
              <button class="primary-button" type="submit" ${schedule?.rosterLocked ? "" : "disabled"}>发布到 H5 赛程页</button>
            </form>
            <form data-action="withdraw-official-schedule">
              <button class="secondary-button danger-link" type="submit" ${status === "published" ? "" : "disabled"}>撤回发布</button>
            </form>
          </div>
        </div>
      </div>

      ${renderScheduleLogList(schedule)}
    </section>
  `;
}

function renderLockedRoster(schedule: OfficialScheduleManagement): string {
  return `
    <div class="locked-roster">
      <div class="roster-chip-list">
        ${
          schedule.teams.length === 0
            ? `<span class="muted-copy">名单已锁定，但没有参赛队伍，请解锁后重新选择。</span>`
            : schedule.teams
                .map(
                  (item) => `
                    <span class="roster-chip ${item.isSeeded ? "is-seeded" : ""}">
                      <strong>${escapeHtml(item.team.name)}</strong>
                      <small>${escapeHtml(item.isSeeded ? "种子队" : `Seed ${item.seed ?? "-"}`)}</small>
                    </span>
                  `,
                )
                .join("")
        }
      </div>
      <form data-action="unlock-official-roster">
        <button class="secondary-button danger-link" type="submit">解锁名单并清空官方赛程草稿</button>
      </form>
    </div>
  `;
}

function renderRosterLockForm(rosterIds: Set<string>, seededIds: Set<string>): string {
  if (state.teams.length === 0) {
    return emptyState("当前届次还没有战队。先到战队管理添加战队，再回来锁定参赛名单。");
  }

  return `
    <form class="roster-lock-form" data-action="lock-official-roster">
      <div class="roster-pick-list">
        ${state.teams
          .map(
            (team, index) => `
              <label class="roster-pick-row">
                <input type="checkbox" name="teamIds" value="${escapeHtml(team.id)}" ${rosterIds.size === 0 || rosterIds.has(team.id) ? "checked" : ""} />
                <span>
                  <strong>${escapeHtml(team.name)}</strong>
                  <small>${escapeHtml(team.members.length)} 名队员 · seed ${escapeHtml(team.seed ?? index + 1)}</small>
                </span>
                <em>
                  <input type="checkbox" name="seededTeamIds" value="${escapeHtml(team.id)}" ${seededIds.has(team.id) ? "checked" : ""} />
                  种子
                </em>
              </label>
            `,
          )
          .join("")}
      </div>
      <button class="primary-button" type="submit">锁定参赛名单</button>
    </form>
  `;
}

function renderScheduleConfigForm(schedule: OfficialScheduleManagement | null): string {
  return `
    <form class="schedule-config-form" data-action="update-official-schedule-config">
      <label>预赛赛制
        <select name="preliminaryType">
          <option value="group" ${schedule?.preliminaryType === "group" ? "selected" : ""}>小组赛</option>
          <option value="swiss" ${schedule?.preliminaryType === "swiss" ? "selected" : ""}>瑞士轮</option>
        </select>
      </label>
      <label>淘汰赛赛制
        <select name="knockoutType">
          <option value="single_elimination" ${schedule?.knockoutType === "single_elimination" ? "selected" : ""}>单败淘汰</option>
          <option value="double_elimination" ${schedule?.knockoutType === "double_elimination" ? "selected" : ""}>双败淘汰</option>
        </select>
      </label>
      <button class="secondary-button" type="submit">保存赛制选择</button>
    </form>
  `;
}

function renderScheduleLogList(schedule: OfficialScheduleManagement | null): string {
  const logs = schedule?.logs ?? [];

  return `
    <div class="schedule-log-list">
      <div class="section-heading compact">
        <div>
          <h2>操作日志</h2>
          <p>先记录后台动作，后续接管理员登录后再写入真实账号。</p>
        </div>
        ${badge(`${logs.length} 条`, "info")}
      </div>
      ${
        logs.length === 0
          ? emptyState("暂无赛程管理操作记录。")
          : logs
              .map(
                (log) => `
                  <div class="log-row">
                    <strong>${escapeHtml(scheduleLogLabel(log.action))}</strong>
                    <span>${escapeHtml(log.actor)} · ${escapeHtml(formatDate(log.createdAt))}</span>
                  </div>
                `,
              )
              .join("")
      }
    </div>
  `;
}

function officialScheduleChecks(): Array<{ ok: boolean; text: string }> {
  const schedule = state.scheduleManagement;
  const hasOfficialStage = (state.detail?.stages ?? []).some((stage) => {
    return stage.name !== "真实比赛记录" && ["group", "swiss", "knockout"].includes(stage.type);
  });

  return [
    { ok: Boolean(schedule?.rosterLocked), text: "参赛名单已锁定" },
    { ok: Boolean(schedule?.preliminaryType), text: "已选择预赛赛制" },
    { ok: Boolean(schedule?.knockoutType), text: "已选择淘汰赛赛制" },
    { ok: hasOfficialStage, text: "已创建至少一个官方赛程阶段" },
  ];
}

function scheduleStatusLabel(status: string): string {
  switch (status) {
    case "unconfigured":
      return "未配置";
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "withdrawn":
      return "已撤回";
    default:
      return status;
  }
}

function scheduleLogLabel(action: string): string {
  switch (action) {
    case "schedule_config_updated":
      return "赛制选择已更新";
    case "roster_locked":
      return "参赛名单已锁定";
    case "roster_unlocked":
      return "参赛名单已解锁";
    case "schedule_published":
      return "官方赛程已发布";
    case "schedule_withdrawn":
      return "官方赛程已撤回";
    default:
      return action;
  }
}

function renderSync(): string {
  const leagueId = state.detail?.league?.opendotaLeagueId ?? "";

  return `
    <section class="panel form-grid">
      <form class="admin-form" data-action="enqueue-sync">
        <h2>触发同步</h2>
        <label>OpenDota league_id<input name="leagueId" value="${escapeHtml(leagueId)}" placeholder="league_id" required /></label>
        <label>任务<select name="kind"><option value="discover_match">发现联赛比赛</option><option value="refresh_match">同步单场比赛</option><option value="request_parse">请求解析</option></select></label>
        <label>match_id<input name="matchId" placeholder="单场任务必填" /></label>
        <button class="primary-button" type="submit">加入队列</button>
      </form>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>同步任务队列</h2>
          <p>失败原因和重试次数可追踪，外部接口失败不影响用户端已有缓存。</p>
        </div>
        ${badge("读取 /sync-tasks", "info")}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>任务</th><th>类型</th><th>目标</th><th>状态</th><th>进度 / 失败原因</th><th>操作</th></tr></thead>
          <tbody>
            ${
              state.syncRows.length === 0
                ? `<tr><td colspan="6">${emptyState("暂无同步任务。")}</td></tr>`
                : state.syncRows
                    .map(
                      (row) => `
                        <tr>
                          <td>${escapeHtml(row.id)}</td>
                          <td><code>${escapeHtml(row.kind)}</code></td>
                          <td>${escapeHtml(row.target)}</td>
                          <td>${badge(row.status, row.tone)}</td>
                          <td>${escapeHtml(row.detail)}</td>
                          <td><button class="link-button" data-action-button="enqueue-sync" data-kind="${escapeHtml(row.kind)}" type="button">重试 ${escapeHtml(row.attempts)}</button></td>
                        </tr>
                      `,
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function standingsTable(): string {
  const standings = state.standings;
  const bracketColumns = existingBracketColumns();

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>小组</th><th>队伍</th><th>赛果</th><th>小分</th><th>积分</th><th>状态</th></tr></thead>
        <tbody>
          ${
            standings.length === 0
              ? `<tr><td colspan="7"><span class="muted-copy">当前阶段暂无积分榜。</span></td></tr>`
              : standings
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.rank)}</td>
                        <td>${escapeHtml(row.groupName ?? "-")}</td>
                        <td>${escapeHtml(row.team?.name ?? row.teamId ?? "未知队伍")}</td>
                        <td>${escapeHtml(row.seriesWins)}-${escapeHtml(row.seriesDraws)}-${escapeHtml(row.seriesLosses)}</td>
                        <td>${escapeHtml(row.gameWins)}-${escapeHtml(row.gameLosses)}</td>
                        <td><strong>${escapeHtml(row.points)}</strong></td>
                        <td>${badge(row.status ?? "safe", toneForStatus(row.status))}</td>
                      </tr>
                    `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
    ${standings.length === 0 ? "" : renderManualRankForm(standings)}
    ${bracketColumns.length === 0 ? `<div class="bracket-list"><span class="muted-copy">当前阶段暂无 bracket 数据。</span></div>` : renderBracketColumns(bracketColumns)}
  `;
}

function renderManualRankForm(standings: StandingRow[]): string {
  return `
    <form class="manual-rank-form" data-action="update-manual-ranks">
      <input type="hidden" name="stageId" value="${escapeHtml(state.selectedStageId)}" />
      <strong>手动排序</strong>
      <div>
        ${standings
          .map(
            (row) => `
              <label>
                <span>${escapeHtml(row.team?.name ?? row.teamId ?? "未知队伍")}</span>
                <input name="rank:${escapeHtml(row.team?.id ?? row.teamId ?? "")}" inputmode="numeric" value="${escapeHtml(row.manualRank ?? row.rank)}" />
              </label>
            `,
          )
          .join("")}
      </div>
      <button class="secondary-button" type="submit">保存手动排名</button>
    </form>
  `;
}

function currentView(): string {
  const renderers: Record<ViewKey, () => string> = {
    overview: renderOverview,
    editions: renderEditions,
    teams: renderTeams,
    players: renderPlayers,
    matches: renderMatches,
    stages: renderStages,
    sync: renderSync,
  };

  return renderers[activeView]();
}

function render(): void {
  if (!root) {
    return;
  }

  root.innerHTML = shell(currentView());
}

async function loadDashboard(preferredTournamentId = state.selectedTournamentId, preferredStageId = state.selectedStageId): Promise<void> {
  state = { ...state, loading: true, notice: "正在连接 API...", writeNotice: null };
  render();

  try {
    const apiTournaments = await getJson<TournamentListItem[]>("/tournaments");
    const selectedTournamentId = apiTournaments.some((item) => item.id === preferredTournamentId)
      ? preferredTournamentId
      : apiTournaments[0]?.id ?? "";
    const apiSyncTasks = await getJson<SyncTask[]>("/sync-tasks").catch(() => []);

    if (!selectedTournamentId) {
      state = {
        ...state,
        source: "api",
        loading: false,
        notice: "API 在线，但数据库暂无真实赛事数据。",
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
        scheduleManagement: null,
        syncRows: apiSyncTasks.map(syncTaskToRow),
      };
      render();
      return;
    }

    const detail = await loadTournamentDetail(selectedTournamentId);
    const selectedStageId = detail.stages.some((stage) => stage.id === preferredStageId)
      ? preferredStageId
      : detail.currentStageId ?? detail.currentStage?.id ?? detail.stages[0]?.id ?? "";
    const [stageData, teams, players, matches, scheduleManagement] = await Promise.all([
      loadStageData(selectedStageId),
      getJson<TournamentTeamListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/teams`).catch(() => []),
      getJson<TournamentPlayerListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/players`).catch(() => []),
      getJson<OpenDotaMatchListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/matches?limit=300`).catch(() => []),
      getJson<OfficialScheduleManagement>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/schedule-management`).catch(() => null),
    ]);

    state = {
      ...state,
      source: "api",
      loading: false,
      notice: "真实数据已从 API 刷新。",
      tournaments: apiTournaments,
      selectedTournamentId,
      selectedStageId,
      detail,
      teams,
      players,
      matches,
      scheduleManagement,
      syncRows: apiSyncTasks.map(syncTaskToRow),
      ...stageData,
    };
  } catch (error) {
    state = {
      ...state,
      source: "unavailable",
      loading: false,
      notice: `API 不可用，无法读取真实数据：${error instanceof Error ? error.message : String(error)}`,
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
      scheduleManagement: null,
      syncRows: [],
    };
  }

  render();
}

async function loadTournamentDetail(id: string): Promise<TournamentDetail> {
  return getJson<TournamentDetail>(`/tournaments/${encodeURIComponent(id)}`);
}

async function loadStageData(stageId: string): Promise<Pick<LoadState, "rounds" | "standings" | "bracket" | "groups">> {
  if (!stageId) {
    return { rounds: [], standings: [], bracket: [], groups: [] };
  }

  const [rounds, standings, bracket, groups] = await Promise.all([
    getJson<StageRound[]>(`/stages/${encodeURIComponent(stageId)}/rounds`).catch(() => []),
    getJson<StandingRow[]>(`/stages/${encodeURIComponent(stageId)}/standings`).catch(() => []),
    getJson<BracketNode[]>(`/stages/${encodeURIComponent(stageId)}/bracket`).catch(() => []),
    getJson<StageGroup[]>(`/stages/${encodeURIComponent(stageId)}/groups`).catch(() => []),
  ]);

  return { rounds, standings, bracket, groups };
}

function syncTaskToRow(task: SyncTask): SyncRow {
  return {
    id: task.id,
    kind: task.kind,
    target: [task.targetType ?? "target", task.targetId ?? task.leagueId ?? "未指定"].join(": "),
    status: task.status,
    detail: task.lastError ?? (task.nextRunAt ? `下次运行 ${formatDate(task.nextRunAt)}` : `updated ${formatDate(task.updatedAt)}`),
    attempts: task.attempts,
    tone: toneForStatus(task.status),
  };
}

function payloadFromForm(form: HTMLFormElement): AdminFormPayload {
  const payload: AdminFormPayload = {};

  for (const [key, value] of new FormData(form).entries()) {
    const existing = payload[key];

    if (existing === undefined) {
      payload[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      payload[key] = [existing, value];
    }
  }

  return payload;
}

async function submitAction(action: string, payload: AdminFormPayload): Promise<void> {
  if (action === "generate-stage-plan") {
    await submitGeneratedStagePlan(payload);
    return;
  }

  const requests = buildAdminRequests(action, payload);

  if (requests.length === 0) {
    state = { ...state, writeNotice: { tone: "warn", text: "请先填写必要字段后再提交。" } };
    render();
    return;
  }

  state = { ...state, writeNotice: { tone: "info", text: "正在提交请求..." } };
  render();

  const results = [];

  for (const request of requests) {
    results.push({
      request,
      result: await sendAdminRequest(request.path, request.method, request.payload),
    });
  }

  const failed = results.find((item) => !item.result.ok);
  const summary = failed ?? results.at(-1);
  const writeNotice = {
    tone: failed ? "warn" : "good",
    text: summary
      ? `${requests.length > 1 ? `${requests.length} 个请求，` : ""}${summary.request.method} ${summary.request.path}：${summary.result.message}`
      : "请求已提交。",
  } satisfies LoadState["writeNotice"];

  state = {
    ...state,
    writeNotice,
  };
  render();

  if (!failed) {
    await loadDashboard(state.selectedTournamentId, state.selectedStageId);
    state = { ...state, writeNotice };
    render();
  }
}

async function submitGeneratedStagePlan(payload: AdminFormPayload): Promise<void> {
  composerState = composerStateFromPayload(payload);
  const plan = buildCompetitionPlan(composerState);

  if (plan.teams.length < 2) {
    state = { ...state, writeNotice: { tone: "warn", text: "至少选择 2 支队伍后才能生成赛制草稿。" } };
    render();
    return;
  }

  state = { ...state, writeNotice: { tone: "info", text: `正在创建 ${plan.stageName} 草稿...` } };
  render();

  if (isEliminationMode(plan.mode)) {
    const createdBracket = await sendAdminRequest(
      `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/knockout-bracket`,
      "POST",
      {
        name: plan.stageName,
        bracketType: plan.mode,
        bracketSize: composerState.bracketSize,
        winnerTeamCount: plan.mode === "double_elimination" ? composerState.winnerTeamCount : undefined,
        loserTeamCount: plan.mode === "double_elimination" ? composerState.loserTeamCount : undefined,
        boType: plan.boType,
        scheduledAt: normalizeDateTimeLocal(composerState.scheduledAt),
        teamIds: plan.teams.map((team) => team.id),
      },
    );

    if (!createdBracket.ok || !isKnockoutBracketResult(createdBracket.data)) {
      state = {
        ...state,
        writeNotice: { tone: "warn", text: `生成淘汰赛对阵图失败：${createdBracket.message}` },
      };
      render();
      return;
    }

    const writeNotice = {
      tone: "good",
      text: `已生成 ${plan.stageName} 对阵图：${plan.teams.length} 支队伍，管理员现在只需要选择每场胜者。`,
    } satisfies LoadState["writeNotice"];

    await loadDashboard(state.selectedTournamentId, createdBracket.data.stage.id);
    state = { ...state, writeNotice };
    render();
    return;
  }

  const createdStage = await sendAdminRequest("/stages", "POST", {
    tournamentId: state.selectedTournamentId,
    type: plan.stageType,
    name: plan.stageName,
    advancementRule: plan.advancementRule,
    config: {
      officialSchedule: true,
      mode: plan.mode,
      boType: plan.boType,
    },
  });
  const stageData = createdStage.data;

  if (!createdStage.ok || !isStageSummary(stageData)) {
    state = {
      ...state,
      writeNotice: { tone: "warn", text: `创建阶段失败：${createdStage.message}` },
    };
    render();
    return;
  }

  let createdRoundCount = 0;
  let createdSeriesCount = 0;

  for (const round of plan.rounds) {
    const createdRound = await sendAdminRequest("/rounds", "POST", {
      stageId: stageData.id,
      name: round.name,
      roundNumber: round.roundNumber,
      status: "draft",
      pairingStatus: "draft",
    });
    const roundData = createdRound.data;

    if (!createdRound.ok || !isStageRound(roundData)) {
      state = {
        ...state,
        writeNotice: { tone: "warn", text: `创建轮次 ${round.name} 失败：${createdRound.message}` },
      };
      render();
      return;
    }

    createdRoundCount += 1;

    for (const series of round.series) {
      const createdSeries = await sendAdminRequest("/series", "POST", {
        stageId: stageData.id,
        roundId: roundData.id,
        boType: plan.boType,
        status: "draft",
        scheduledAt: normalizeDateTimeLocal(composerState.scheduledAt),
        radiantTeamId: series.radiant.id,
        direTeamId: series.dire.id,
      });

      if (!createdSeries.ok) {
        state = {
          ...state,
          writeNotice: { tone: "warn", text: `创建 ${series.radiant.name} vs ${series.dire.name} 失败：${createdSeries.message}` },
        };
        render();
        return;
      }

      createdSeriesCount += 1;
    }
  }

  const writeNotice = {
    tone: "good",
    text: `已创建 ${plan.stageName}：${createdRoundCount} 个轮次、${createdSeriesCount} 场 draft 对阵。`,
  } satisfies LoadState["writeNotice"];

  await loadDashboard(state.selectedTournamentId, stageData.id);
  state = { ...state, writeNotice };
  render();
}

function isStageSummary(value: unknown): value is StageSummary {
  return typeof value === "object" && value !== null && typeof (value as StageSummary).id === "string";
}

function isStageRound(value: unknown): value is StageRound {
  return typeof value === "object" && value !== null && typeof (value as StageRound).id === "string";
}

function isKnockoutBracketResult(value: unknown): value is { stage: StageSummary; rounds: StageRound[]; bracket: BracketNode[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    isStageSummary((value as { stage?: unknown }).stage) &&
    Array.isArray((value as { rounds?: unknown }).rounds) &&
    Array.isArray((value as { bracket?: unknown }).bracket)
  );
}

function buildAdminRequests(action: string, payload: AdminFormPayload): AdminWriteRequest[] {
  switch (action) {
    case "create-tournament":
      return [
        {
          method: "POST",
          path: "/tournaments",
          payload: compactPayload({
            name: payloadString(payload, "name"),
            seasonName: payloadString(payload, "seasonName") || undefined,
            opendotaLeagueId: payloadNumber(payload, "opendotaLeagueId"),
            startsAt: normalizeDateTimeLocal(payloadString(payload, "startsAt")),
            status: payloadString(payload, "status", "upcoming"),
          }),
        },
      ];
    case "update-lifecycle":
      return [
        {
          method: "PATCH",
          path: `/tournaments/${encodeURIComponent(payloadString(payload, "tournamentId", state.selectedTournamentId))}/lifecycle`,
          payload: compactPayload({
            status: payloadString(payload, "status", "upcoming"),
            startsAt: normalizeDateTimeLocal(payloadString(payload, "startsAt")),
            endsAt: normalizeDateTimeLocal(payloadString(payload, "endsAt")),
          }),
        },
      ];
    case "update-official-schedule-config":
      return [
        {
          method: "PATCH",
          path: `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/schedule-management`,
          payload: compactPayload({
            preliminaryType: payloadString(payload, "preliminaryType"),
            knockoutType: payloadString(payload, "knockoutType"),
            actor: "admin",
          }),
        },
      ];
    case "lock-official-roster":
      return [
        {
          method: "POST",
          path: `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/schedule-management/lock-roster`,
          payload: {
            teamIds: payloadStrings(payload, "teamIds"),
            seededTeamIds: payloadStrings(payload, "seededTeamIds"),
            actor: "admin",
          },
        },
      ];
    case "unlock-official-roster":
      return [
        {
          method: "POST",
          path: `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/schedule-management/unlock-roster`,
          payload: { actor: "admin" },
        },
      ];
    case "publish-official-schedule":
      return [
        {
          method: "POST",
          path: `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/schedule-management/publish`,
          payload: { actor: "admin" },
        },
      ];
    case "withdraw-official-schedule":
      return [
        {
          method: "POST",
          path: `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/schedule-management/withdraw`,
          payload: { actor: "admin" },
        },
      ];
    case "create-team":
      return [
        {
          method: "POST",
          path: "/teams",
          payload: compactPayload({
            tournamentId: payloadString(payload, "tournamentId", state.selectedTournamentId),
            name: payloadString(payload, "name"),
            shortName: payloadString(payload, "shortName"),
            logoUrl: payloadString(payload, "logoUrl") || undefined,
            color: payloadString(payload, "color") || undefined,
            opendotaTeamId: payloadNumber(payload, "opendotaTeamId"),
          }),
        },
      ];
    case "update-team":
      if (!payloadString(payload, "teamId")) {
        return [];
      }

      return [
        {
          method: "PATCH",
          path: `/teams/${encodeURIComponent(payloadString(payload, "teamId"))}`,
          payload: compactPayload({
            name: payloadString(payload, "name") || undefined,
            shortName: payloadString(payload, "shortName") || undefined,
            logoUrl: payloadString(payload, "logoUrl") || null,
            color: payloadString(payload, "color") || undefined,
            opendotaTeamId: payloadNumber(payload, "opendotaTeamId"),
          }),
        },
      ];
    case "create-player":
      return [
        {
          method: "POST",
          path: "/players",
          payload: compactPayload({
            displayName: payloadString(payload, "displayName"),
            accountId: payloadNumber(payload, "accountId"),
            steamId64: payloadString(payload, "steamId64") || undefined,
            currentTeamId: payloadString(payload, "currentTeamId") || undefined,
            avatarUrl: payloadString(payload, "avatarUrl") || undefined,
          }),
        },
      ];
    case "add-team-member":
      if (!payloadString(payload, "teamId") || (!payloadString(payload, "steamId") && !payloadString(payload, "playerId"))) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/teams/${encodeURIComponent(payloadString(payload, "teamId"))}/members`,
          payload: compactPayload({
            playerId: payloadString(payload, "playerId") || undefined,
            steamId: payloadString(payload, "steamId") || undefined,
            displayName: payloadString(payload, "displayName") || undefined,
            avatarUrl: payloadString(payload, "avatarUrl") || undefined,
            role: payloadString(payload, "role") || undefined,
          }),
        },
      ];
    case "remove-team-member":
      if (!payloadString(payload, "teamId") || !payloadString(payload, "playerId")) {
        return [];
      }

      return [
        {
          method: "DELETE",
          path: `/teams/${encodeURIComponent(payloadString(payload, "teamId"))}/members/${encodeURIComponent(payloadString(payload, "playerId"))}`,
        },
      ];
    case "link-match":
      if (!payloadString(payload, "matchId") || !payloadString(payload, "radiantTeamId") || !payloadString(payload, "direTeamId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/tournaments/${encodeURIComponent(state.selectedTournamentId)}/opendota-matches/${encodeURIComponent(payloadString(payload, "matchId"))}/link-series`,
          payload: compactPayload({
            stageId: state.selectedStageId || undefined,
            roundName: "OpenDota 比赛记录",
            boType: "BO1",
            radiantTeamId: payloadString(payload, "radiantTeamId"),
            direTeamId: payloadString(payload, "direTeamId"),
          }),
        },
      ];
    case "create-stage":
      return [
        {
          method: "POST",
          path: "/stages",
          payload: compactPayload({
            tournamentId: payloadString(payload, "tournamentId", state.selectedTournamentId),
            name: payloadString(payload, "name"),
            type: payloadString(payload, "type"),
            advancementRule: payloadString(payload, "boType") ? `默认 ${payloadString(payload, "boType")}` : undefined,
            config: compactPayload({
              officialSchedule: true,
              boType: payloadString(payload, "boType") || undefined,
              swissRounds: payloadNumber(payload, "swissRounds"),
            }),
          }),
        },
      ];
    case "create-stage-group":
      return [
        {
          method: "POST",
          path: `/stages/${encodeURIComponent(payloadString(payload, "stageId", state.selectedStageId))}/groups`,
          payload: compactPayload({
            name: payloadString(payload, "name"),
            sortOrder: payloadNumber(payload, "sortOrder"),
          }),
        },
      ];
    case "randomize-stage-groups":
      return [
        {
          method: "POST",
          path: `/stages/${encodeURIComponent(payloadString(payload, "stageId", state.selectedStageId))}/groups/randomize`,
          payload: compactPayload({
            groupCount: payloadNumber(payload, "groupCount"),
            groupSize: payloadNumber(payload, "groupSize"),
            seededTeamIds: payloadStrings(payload, "seededTeamIds"),
            actor: "admin",
          }),
        },
      ];
    case "generate-group-round-robin":
      return [
        {
          method: "POST",
          path: `/stages/${encodeURIComponent(payloadString(payload, "stageId", state.selectedStageId))}/group-round-robin`,
          payload: compactPayload({
            boType: normalizeBoType(payloadString(payload, "boType", "BO2")),
            replaceExisting: payloadString(payload, "replaceExisting") === "true",
            actor: "admin",
          }),
        },
      ];
    case "generate-swiss-pairings":
      return [
        {
          method: "POST",
          path: `/stages/${encodeURIComponent(payloadString(payload, "stageId", state.selectedStageId))}/swiss-pairings`,
          payload: compactPayload({
            roundNumber: payloadNumber(payload, "roundNumber"),
            boType: normalizeBoType(payloadString(payload, "boType", "BO2")),
            actor: "admin",
          }),
        },
      ];
    case "confirm-swiss-round":
      if (!payloadString(payload, "roundId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/rounds/${encodeURIComponent(payloadString(payload, "roundId"))}/confirm-swiss`,
          payload: { actor: "admin" },
        },
      ];
    case "retract-swiss-round":
      if (!payloadString(payload, "roundId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/rounds/${encodeURIComponent(payloadString(payload, "roundId"))}/retract-swiss`,
          payload: { actor: "admin" },
        },
      ];
    case "update-manual-ranks":
      return [
        {
          method: "PATCH",
          path: `/stages/${encodeURIComponent(payloadString(payload, "stageId", state.selectedStageId))}/manual-ranks`,
          payload: {
            ranks: manualRankPayload(payload),
            actor: "admin",
          },
        },
      ];
    case "update-stage-group":
      if (!payloadString(payload, "groupId")) {
        return [];
      }

      return [
        {
          method: "PATCH",
          path: `/stage-groups/${encodeURIComponent(payloadString(payload, "groupId"))}`,
          payload: compactPayload({
            name: payloadString(payload, "name") || undefined,
            sortOrder: payloadNumber(payload, "sortOrder"),
          }),
        },
      ];
    case "delete-stage-group":
      if (!payloadString(payload, "groupId")) {
        return [];
      }

      return [
        {
          method: "DELETE",
          path: `/stage-groups/${encodeURIComponent(payloadString(payload, "groupId"))}`,
        },
      ];
    case "add-stage-group-team":
      if (!payloadString(payload, "groupId") || !payloadString(payload, "teamId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/stage-groups/${encodeURIComponent(payloadString(payload, "groupId"))}/teams`,
          payload: compactPayload({
            teamId: payloadString(payload, "teamId"),
            seed: payloadNumber(payload, "seed"),
          }),
        },
      ];
    case "remove-stage-group-team":
      if (!payloadString(payload, "groupId") || !payloadString(payload, "teamId")) {
        return [];
      }

      return [
        {
          method: "DELETE",
          path: `/stage-groups/${encodeURIComponent(payloadString(payload, "groupId"))}/teams/${encodeURIComponent(payloadString(payload, "teamId"))}`,
        },
      ];
    case "create-round":
      return [
        {
          method: "POST",
          path: "/rounds",
          payload: compactPayload({
            stageId: payloadString(payload, "stageId", state.selectedStageId),
            name: payloadString(payload, "name"),
            roundNumber: payloadNumber(payload, "roundNumber"),
            status: "draft",
            pairingStatus: "draft",
          }),
        },
      ];
    case "create-manual-series":
      if (!payloadString(payload, "roundId") || !payloadString(payload, "radiantTeamId") || !payloadString(payload, "direTeamId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: "/series",
          payload: compactPayload({
            stageId: payloadString(payload, "stageId", state.selectedStageId),
            roundId: payloadString(payload, "roundId"),
            groupId: payloadString(payload, "groupId") || null,
            seriesKind: payloadString(payload, "seriesKind", "regular"),
            boType: normalizeBoType(payloadString(payload, "boType", "BO2")),
            status: "scheduled",
            scheduledAt: normalizeDateTimeLocal(payloadString(payload, "scheduledAt")),
            radiantTeamId: payloadString(payload, "radiantTeamId"),
            direTeamId: payloadString(payload, "direTeamId"),
          }),
        },
      ];
    case "update-series":
      if (!payloadString(payload, "seriesId")) {
        return [];
      }

      return [
        {
          method: "PATCH",
          path: `/series/${encodeURIComponent(payloadString(payload, "seriesId"))}`,
          payload: compactPayload({
            roundId: payloadString(payload, "roundId") || undefined,
            groupId: payloadString(payload, "groupId") || null,
            seriesKind: payloadString(payload, "seriesKind", "regular"),
            boType: normalizeBoType(payloadString(payload, "boType", "BO2")),
            scheduledAt: normalizeDateTimeLocal(payloadString(payload, "scheduledAt")),
            radiantTeamId: payloadString(payload, "radiantTeamId") || undefined,
            direTeamId: payloadString(payload, "direTeamId") || undefined,
          }),
        },
      ];
    case "update-series-result":
      if (!payloadString(payload, "seriesId")) {
        return [];
      }

      return [
        {
          method: "PATCH",
          path: `/series/${encodeURIComponent(payloadString(payload, "seriesId"))}/result`,
          payload: {
            radiantScore: payloadNumber(payload, "radiantScore") ?? 0,
            direScore: payloadNumber(payload, "direScore") ?? 0,
          },
        },
      ];
    case "delete-series":
      if (!payloadString(payload, "seriesId")) {
        return [];
      }

      return [
        {
          method: "DELETE",
          path: `/series/${encodeURIComponent(payloadString(payload, "seriesId"))}`,
        },
      ];
    case "clear-match-records":
      return [
        {
          method: "DELETE",
          path: `/tournaments/${encodeURIComponent(payloadString(payload, "tournamentId", state.selectedTournamentId))}/match-records`,
        },
      ];
    case "submit-result":
      return buildResultRequests(payload);
    case "advance-bracket-node":
      if (!payloadString(payload, "nodeId") || !payloadString(payload, "winnerTeamId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/bracket-nodes/${encodeURIComponent(payloadString(payload, "nodeId"))}/winner`,
          payload: {
            winnerTeamId: payloadString(payload, "winnerTeamId"),
          },
        },
      ];
    case "set-bracket-slot":
      if (!payloadString(payload, "nodeId") || !payloadString(payload, "slot")) {
        return [];
      }

      return [
        {
          method: "PATCH",
          path: `/bracket-nodes/${encodeURIComponent(payloadString(payload, "nodeId"))}/slot`,
          payload: {
            slot: payloadString(payload, "slot"),
            teamId: payloadString(payload, "teamId") || null,
            actor: "admin",
          },
        },
      ];
    case "enqueue-sync":
      return [
        {
          method: "POST",
          path: "/sync-tasks",
          payload: buildSyncTaskPayload(payload),
        },
      ];
    default:
      return [];
  }
}

function buildResultRequests(payload: AdminFormPayload): AdminWriteRequest[] {
  const seriesId = payloadString(payload, "seriesId");

  if (!seriesId) {
    return [];
  }

  return [1, 2, 3].flatMap((gameIndex) => {
    const matchId = payloadNumber(payload, `game${gameIndex}MatchId`);
    const winnerTeamId = payloadString(payload, `game${gameIndex}WinnerTeamId`);

    if (matchId === undefined && !winnerTeamId) {
      return [];
    }

    return [
      {
        method: "POST",
        path: `/series/${encodeURIComponent(seriesId)}/games/${gameIndex}/result`,
        payload: compactPayload({
          matchId,
          winnerTeamId: winnerTeamId || undefined,
        }),
      },
    ];
  });
}

function buildSyncTaskPayload(payload: AdminFormPayload): Record<string, unknown> {
  const leagueId = payloadNumber(payload, "leagueId") ?? state.detail?.league?.opendotaLeagueId;
  const matchId = payloadString(payload, "matchId");
  const targetType = matchId ? "match" : "league";

  return compactPayload({
    kind: normalizeSyncKind(payloadString(payload, "kind")),
    leagueId,
    targetType,
    targetId: matchId || (leagueId === undefined ? undefined : String(leagueId)),
    payload: {
      source: "admin",
      tournamentId: state.selectedTournamentId,
    },
  });
}

function manualRankPayload(payload: AdminFormPayload): Array<{ teamId: string; manualRank: number | null }> {
  return Object.entries(payload).flatMap(([key, value]) => {
    if (!key.startsWith("rank:")) {
      return [];
    }

    const teamId = key.slice("rank:".length);
    const firstValue = Array.isArray(value) ? value[0] : value;
    const manualRank = typeof firstValue === "string" && firstValue.trim().length > 0 ? Number(firstValue) : null;

    if (!teamId) {
      return [];
    }

    return [
      {
        teamId,
        manualRank: Number.isSafeInteger(manualRank) ? manualRank : null,
      },
    ];
  });
}

function normalizeSyncKind(value: string): string {
  switch (value) {
    case "league-discovery":
    case "discover_match":
      return "discover_match";
    case "parse-request":
    case "request_parse":
      return "request_parse";
    case "match-sync":
    case "refresh_match":
      return "refresh_match";
    case "schedule-linker":
    case "schedule_link":
      return "schedule_link";
    default:
      return "discover_match";
  }
}

function payloadString(payload: AdminFormPayload, fieldName: string, fallback = ""): string {
  const value = payload[fieldName];
  const firstValue = Array.isArray(value) ? value[0] : value;

  return typeof firstValue === "string" && firstValue.trim().length > 0 ? firstValue.trim() : fallback;
}

function payloadStrings(payload: AdminFormPayload, fieldName: string): string[] {
  const value = payload[fieldName];
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];

  return values.flatMap((item) => (typeof item === "string" && item.trim().length > 0 ? [item.trim()] : []));
}

function payloadNumber(payload: AdminFormPayload, fieldName: string): number | undefined {
  const value = payloadString(payload, fieldName);
  const numberValue = Number(value);

  return Number.isSafeInteger(numberValue) ? numberValue : undefined;
}

function normalizeDateTimeLocal(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function compactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""));
}

function metric(label: string, value: number, hint: string): string {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function emptyState(text: string): string {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function teamOptions(selectedTeamId = ""): string {
  return state.teams
    .map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === selectedTeamId ? "selected" : ""}>${escapeHtml(team.name)}</option>`)
    .join("");
}

function playerOptions(): string {
  return state.players.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</option>`).join("");
}

function stageOptions(): string {
  return (state.detail?.stages ?? [])
    .map((stage) => `<option value="${escapeHtml(stage.id)}" ${stage.id === state.selectedStageId ? "selected" : ""}>${escapeHtml(stage.name)}</option>`)
    .join("");
}

function roundOptions(selectedRoundId = ""): string {
  return state.rounds
    .map((round) => `<option value="${escapeHtml(round.id)}" ${round.id === selectedRoundId ? "selected" : ""}>${escapeHtml(round.name)}</option>`)
    .join("");
}

function groupOptions(selectedGroupId = ""): string {
  return state.groups
    .map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`)
    .join("");
}

function boOptions(selectedBo: SeriesBoType): string {
  return ["BO1", "BO2", "BO3", "BO5"]
    .map((bo) => `<option value="${bo}" ${bo === selectedBo ? "selected" : ""}>${bo}</option>`)
    .join("");
}

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const view = target.closest<HTMLElement>("[data-view]")?.dataset.view as ViewKey | undefined;

  if (view && views.some((item) => item.key === view)) {
    activeView = view;
    render();
    return;
  }

  const tournamentId = target.closest<HTMLElement>("[data-tournament-id]")?.dataset.tournamentId;

  if (tournamentId) {
    void loadDashboard(tournamentId, "");
    return;
  }

  const stageId = target.closest<HTMLElement>("[data-stage-id]")?.dataset.stageId;

  if (stageId) {
    state = { ...state, selectedStageId: stageId, rounds: [], standings: [], bracket: [], groups: [] };
    void loadStageData(stageId).then((stageData) => {
      state = { ...state, ...stageData };
      render();
    });
    render();
    return;
  }

  if (target.closest("[data-reload]")) {
    void loadDashboard();
    return;
  }

  const actionButton = target.closest<HTMLElement>("[data-action-button]");

  if (actionButton?.dataset.actionButton) {
    void submitAction(actionButton.dataset.actionButton, {
      kind: actionButton.dataset.kind ?? "discover_match",
      leagueId: String(state.detail?.league?.opendotaLeagueId ?? ""),
    });
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;

  if (target instanceof HTMLSelectElement && target.matches("[data-tournament-select]")) {
    void loadDashboard(target.value, "");
    return;
  }

  if (target instanceof HTMLElement && target.matches("[data-composer-field]")) {
    const form = target.closest<HTMLFormElement>('[data-action="generate-stage-plan"]');

    if (form) {
      composerState = composerStateFromPayload(payloadFromForm(form));

      if (
        target instanceof HTMLSelectElement &&
        target.name === "bracketSize" &&
        isEliminationMode(composerState.mode)
      ) {
        composerState = {
          ...composerState,
          selectedTeamIds: sortedTeams()
            .slice(0, composerState.bracketSize)
            .map((team) => team.id),
          winnerTeamCount: composerState.mode === "double_elimination" ? composerState.bracketSize : composerState.winnerTeamCount,
          loserTeamCount: composerState.mode === "double_elimination" ? 0 : composerState.loserTeamCount,
        };
      }

      if (target instanceof HTMLInputElement && target.name === "mode" && isEliminationMode(composerState.mode)) {
        composerState = {
          ...composerState,
          selectedTeamIds: sortedTeams()
            .slice(0, composerState.bracketSize)
            .map((team) => team.id),
          winnerTeamCount: composerState.mode === "double_elimination" ? composerState.bracketSize : composerState.winnerTeamCount,
          loserTeamCount: composerState.mode === "double_elimination" ? 0 : composerState.loserTeamCount,
        };
      }

      render();
    }
  }
});

document.addEventListener("dragstart", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const teamId = target.closest<HTMLElement>("[data-drag-team]")?.dataset.dragTeam;

  if (!teamId) {
    return;
  }

  draggedStageTeamId = teamId;
  event.dataTransfer?.setData("text/plain", teamId);
  event.dataTransfer?.setDragImage(target, 12, 12);
});

document.addEventListener("dragover", (event) => {
  const target = event.target;

  if (target instanceof HTMLElement && (target.closest("[data-group-drop]") || target.closest("[data-bracket-slot-drop]"))) {
    event.preventDefault();
  }
});

document.addEventListener("drop", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const bracketSlot = target.closest<HTMLElement>("[data-bracket-slot-drop]")?.dataset.bracketSlotDrop;
  const groupId = target.closest<HTMLElement>("[data-group-drop]")?.dataset.groupDrop;
  const teamId = event.dataTransfer?.getData("text/plain") || draggedStageTeamId;

  if (bracketSlot && teamId) {
    const [nodeId, slot] = bracketSlot.split(":");

    if (nodeId && (slot === "radiant" || slot === "dire")) {
      event.preventDefault();
      draggedStageTeamId = "";
      void submitAction("set-bracket-slot", {
        nodeId,
        slot,
        teamId,
      });
      return;
    }
  }

  if (!groupId || !teamId) {
    return;
  }

  event.preventDefault();
  draggedStageTeamId = "";
  void submitAction("add-stage-group-team", {
    groupId,
    teamId,
  });
});

document.addEventListener("submit", (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const action = form.dataset.action;

  if (!action) {
    return;
  }

  event.preventDefault();

  if (!confirmSensitiveAction(action)) {
    return;
  }

  void submitAction(action, payloadFromForm(form));
});

void loadDashboard();

function confirmSensitiveAction(action: string): boolean {
  switch (action) {
    case "unlock-official-roster":
      return window.confirm("解锁名单会清空官方赛程草稿。确认继续？");
    case "withdraw-official-schedule":
      return window.confirm("撤回后 H5 赛程页会显示赛程暂未发布。确认撤回？");
    case "publish-official-schedule":
      return window.confirm("发布后 H5 赛程页将展示官方赛程。确认发布？");
    case "generate-swiss-pairings":
      return window.confirm("生成瑞士轮配对会覆盖所选轮次及后续轮次草稿。确认继续？");
    case "retract-swiss-round":
      return window.confirm("撤回本轮会清空该轮及后续瑞士轮配对。确认继续？");
    case "clear-match-records":
      return window.confirm("这会清空当前届比赛记录和 OpenDota 缓存。确认继续？");
    default:
      return true;
  }
}
