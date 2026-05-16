import "./styles.css";
import {
  apiBaseUrl,
  getJson,
  sendAdminRequest,
  type ApiSource,
  type BracketNode,
  type OpenDotaMatchListItem,
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
type CompetitionMode = "group" | "swiss" | "double_elimination";
type SeriesBoType = "BO1" | "BO2" | "BO3" | "BO5";
type PlanRoundKind = "group" | "swiss" | "winner" | "loser" | "grand_final";

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
let composerState: ComposerState = {
  mode: "swiss",
  stageName: "",
  boType: "BO3",
  scheduledAt: "",
  groupCount: 2,
  groupLoops: 1,
  advancePerGroup: 2,
  swissRounds: 5,
  bracketSize: 8,
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
  const selectedIds = new Set(config.selectedTeamIds.length === 0 ? teams.map((team) => team.id) : config.selectedTeamIds);

  return teams.filter((team) => selectedIds.has(team.id));
}

function defaultStageName(mode: CompetitionMode): string {
  switch (mode) {
    case "group":
      return "小组赛";
    case "swiss":
      return "瑞士轮";
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
  return value === "group" || value === "swiss" || value === "double_elimination" ? value : "swiss";
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

function buildDoubleEliminationPlan(
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
      series: [],
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
  rounds.push({
    name: "总决赛重置（必要时）",
    roundNumber: rounds.length + 1,
    kind: "grand_final",
    series: [],
    placeholderCount: 1,
  });

  if (teams.length < bracketSize) {
    warnings.push(`当前 ${teams.length} 队会进入 ${bracketSize} 队双败表，首轮含 ${bracketSize - teams.length} 个空种子 / BYE。`);
  }

  if (teams.length > 16) {
    warnings.push("双败制当前对阵图最多按 16 队生成，更多队伍建议先经过瑞士轮或小组赛晋级。");
  }

  const plan: CompetitionPlan = {
    mode: "double_elimination",
    stageType: "knockout",
    stageName,
    boType: config.boType,
    advancementRule: `双败淘汰 · ${bracketSize} 队表 · 胜者组 / 败者组 / 总决赛重置 · ${config.boType}`,
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
    tone: round.kind === "winner" ? "good" : round.kind === "loser" ? "warn" : "info",
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
  const plan = buildCompetitionPlan();
  const selectedIds = new Set(plan.teams.map((team) => team.id));

  return `
    <section class="panel composer-panel">
      <div class="section-heading">
        <div>
          <h2>赛制编排器</h2>
          <p>基于当前届次已有队伍生成小组赛、瑞士轮或双败淘汰赛草稿；写入后仍由管理员确认发布。</p>
        </div>
        <div class="toolbar">${badge(modeLabel(plan.mode), "info")}${badge(`${plan.teams.length} 队`, plan.teams.length >= 2 ? "good" : "warn")}</div>
      </div>
      <div class="composer-layout">
        <form class="admin-form composer-form" data-action="generate-stage-plan">
          <h2>创建赛制草稿</h2>
          <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
          <div class="mode-segment" role="radiogroup" aria-label="赛制">
            ${[
              ["swiss", "瑞士轮"],
              ["group", "小组赛"],
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
              <strong>参赛队伍</strong>
              <small>默认按 seed 排序；取消勾选可临时排除退赛或未确认队伍。</small>
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
          <button class="primary-button" type="submit" ${plan.teams.length < 2 ? "disabled" : ""}>生成并写入草稿</button>
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

  if (composerState.mode === "double_elimination") {
    return `
      <div class="mode-field-grid">
        <label>对阵图规模<select name="bracketSize" data-composer-field>
          ${[4, 8, 16].map((size) => `<option value="${size}" ${composerState.bracketSize === size ? "selected" : ""}>${size} 队双败表</option>`).join("")}
        </select></label>
        <label>晋级规则<input value="胜者组 / 败者组 / 总决赛重置" readonly /></label>
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
        top: node.series?.radiantTeam.name || "待定",
        bottom: node.series?.direTeam.name || "待定",
        meta: node.status,
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

function renderStages(): string {
  const stages = state.detail?.stages ?? [];
  const stage = currentStage();

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>阶段配置</h2>
          <p>阶段、轮次和 series 仍然归后端管理；后台只提交配置和人工确认。</p>
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
          <label>名称<input name="name" placeholder="例如 瑞士轮" required /></label>
          <label>赛制<select name="type"><option value="group">普通小组赛</option><option value="swiss">瑞士轮</option><option value="knockout">淘汰赛</option></select></label>
          <label>默认 BO<input name="boType" placeholder="例如 BO3" /></label>
          <button class="primary-button" type="submit">提交阶段</button>
        </form>
        <form class="admin-form" data-action="create-round">
          <h2>创建轮次</h2>
          <label>阶段<select name="stageId" required>${stageOptions()}</select></label>
          <label>轮次名称<input name="name" placeholder="例如 第 1 轮" required /></label>
          <label>轮次数字<input name="roundNumber" inputmode="numeric" placeholder="可留空" /></label>
          <button class="secondary-button" type="submit">提交轮次</button>
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
        <thead><tr><th>时间</th><th>阶段 / 轮次</th><th>对阵</th><th>BO</th><th>状态</th><th>match_id</th></tr></thead>
        <tbody>
          ${rows
            .map((row) => {
              const round = state.rounds.find((item) => item.id === row.roundId);

              return `
                <tr>
                  <td>${escapeHtml(formatDate(row.scheduledAt))}</td>
                  <td>${escapeHtml(currentStage()?.name ?? row.stageId)}<small>${escapeHtml(round?.name ?? row.roundId)}</small></td>
                  <td>${escapeHtml(row.radiantTeam.name)} vs ${escapeHtml(row.direTeam.name)}<small>${escapeHtml(row.radiantScore)} : ${escapeHtml(row.direScore)}</small></td>
                  <td>${escapeHtml(row.boType)}</td>
                  <td>${badge(row.status, toneForStatus(row.status))}</td>
                  <td>${escapeHtml(row.games.map((game) => game.matchId ?? "待关联").join(" / "))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
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
        <thead><tr><th>#</th><th>队伍</th><th>赛果</th><th>小分</th><th>积分</th><th>状态</th></tr></thead>
        <tbody>
          ${
            standings.length === 0
              ? `<tr><td colspan="6"><span class="muted-copy">当前阶段暂无积分榜。</span></td></tr>`
              : standings
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.rank)}</td>
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
    ${bracketColumns.length === 0 ? `<div class="bracket-list"><span class="muted-copy">当前阶段暂无 bracket 数据。</span></div>` : renderBracketColumns(bracketColumns)}
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
        syncRows: apiSyncTasks.map(syncTaskToRow),
      };
      render();
      return;
    }

    const detail = await loadTournamentDetail(selectedTournamentId);
    const selectedStageId = detail.stages.some((stage) => stage.id === preferredStageId)
      ? preferredStageId
      : detail.currentStageId ?? detail.currentStage?.id ?? detail.stages[0]?.id ?? "";
    const [stageData, teams, players, matches] = await Promise.all([
      loadStageData(selectedStageId),
      getJson<TournamentTeamListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/teams`).catch(() => []),
      getJson<TournamentPlayerListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/players`).catch(() => []),
      getJson<OpenDotaMatchListItem[]>(`/tournaments/${encodeURIComponent(selectedTournamentId)}/matches?limit=300`).catch(() => []),
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
      syncRows: [],
    };
  }

  render();
}

async function loadTournamentDetail(id: string): Promise<TournamentDetail> {
  return getJson<TournamentDetail>(`/tournaments/${encodeURIComponent(id)}`);
}

async function loadStageData(stageId: string): Promise<Pick<LoadState, "rounds" | "standings" | "bracket">> {
  if (!stageId) {
    return { rounds: [], standings: [], bracket: [] };
  }

  const [rounds, standings, bracket] = await Promise.all([
    getJson<StageRound[]>(`/stages/${encodeURIComponent(stageId)}/rounds`).catch(() => []),
    getJson<StandingRow[]>(`/stages/${encodeURIComponent(stageId)}/standings`).catch(() => []),
    getJson<BracketNode[]>(`/stages/${encodeURIComponent(stageId)}/bracket`).catch(() => []),
  ]);

  return { rounds, standings, bracket };
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

  const createdStage = await sendAdminRequest("/stages", "POST", {
    tournamentId: state.selectedTournamentId,
    type: plan.stageType,
    name: plan.stageName,
    advancementRule: plan.advancementRule,
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
          }),
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
    case "submit-result":
      return buildResultRequests(payload);
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

function teamOptions(): string {
  return state.teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("");
}

function playerOptions(): string {
  return state.players.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.displayName)}</option>`).join("");
}

function stageOptions(): string {
  return (state.detail?.stages ?? [])
    .map((stage) => `<option value="${escapeHtml(stage.id)}" ${stage.id === state.selectedStageId ? "selected" : ""}>${escapeHtml(stage.name)}</option>`)
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
    state = { ...state, selectedStageId: stageId, rounds: [], standings: [], bracket: [] };
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
      render();
    }
  }
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
  void submitAction(action, payloadFromForm(form));
});

void loadDashboard();
