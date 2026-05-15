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
  method: "POST" | "PATCH";
  path: string;
  payload: Record<string, unknown>;
};

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
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>战队管理</h2>
          <p>队伍是当前届次下的运营对象；绑定比赛后这里会出现 series 胜率、局胜负和常用英雄。</p>
        </div>
        ${badge(`${state.teams.length} 支队伍`, "info")}
      </div>
      <div class="team-grid">
        ${state.teams.length === 0 ? emptyState("还没有战队。先创建战队，再到比赛结果库补对阵。") : state.teams.map(renderTeamCard).join("")}
      </div>
    </section>

    <section class="panel form-grid">
      <form class="admin-form" data-action="create-team">
        <h2>创建战队</h2>
        <input name="tournamentId" value="${escapeHtml(state.selectedTournamentId)}" readonly />
        <label>队伍名<input name="name" placeholder="队伍名" required /></label>
        <label>简称<input name="shortName" placeholder="可留空，默认取队伍名" /></label>
        <label>颜色<input name="color" placeholder="#22c55e" /></label>
        <label>OpenDota team_id<input name="opendotaTeamId" inputmode="numeric" placeholder="可选，赛后可按名称补全" /></label>
        <button class="primary-button" type="submit">创建并加入当前届次</button>
      </form>

      <form class="admin-form" data-action="add-team-member">
        <h2>添加队员</h2>
        <label>战队<select name="teamId" required>${teamOptions()}</select></label>
        <label>选手<select name="playerId" required>${playerOptions()}</select></label>
        <label>角色<input name="role" placeholder="player / captain" /></label>
        <button class="secondary-button" type="submit">加入战队</button>
      </form>
    </section>
  `;
}

function renderTeamCard(team: TournamentTeamListItem): string {
  const stat = team.stats;
  const members = team.members.map((member) => member.displayName).join("、") || "暂无成员";
  const heroes = stat.topHeroes.length === 0 ? "暂无英雄数据" : stat.topHeroes.map((hero) => `#${hero.heroId} ${hero.picks} pick`).join(" · ");

  return `
    <article class="team-card">
      <div class="team-card-head">
        <span style="background:${escapeHtml(team.color)}"></span>
        <div>
          <strong>${escapeHtml(team.name)}</strong>
          <small>${escapeHtml(team.shortName)} · seed ${escapeHtml(team.seed ?? "-")}</small>
        </div>
        ${badge(team.status, toneForStatus(team.status))}
      </div>
      <div class="stat-line">
        <span>Series</span><strong>${escapeHtml(stat.seriesWins)}-${escapeHtml(stat.seriesLosses)}</strong>
        <span>Game</span><strong>${escapeHtml(stat.gameWins)}-${escapeHtml(stat.gameLosses)}</strong>
        <span>胜率</span><strong>${escapeHtml(stat.winRate === null ? "-" : `${stat.winRate}%`)}</strong>
      </div>
      <p>${escapeHtml(members)}</p>
      <small>${escapeHtml(stat.linkedMatches)} 场已绑定比赛 · ${escapeHtml(heroes)}</small>
      <form class="team-member-form" data-action="add-team-member">
        <input type="hidden" name="teamId" value="${escapeHtml(team.id)}" />
        <select name="playerId" aria-label="选择选手" required>
          <option value="">添加已有选手</option>${playerOptions()}
        </select>
        <input name="role" placeholder="角色" />
        <button class="secondary-button" type="submit" ${state.players.length === 0 ? "disabled" : ""}>添加</button>
      </form>
    </article>
  `;
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
        <thead><tr><th>选手</th><th>account_id</th><th>当前战队</th><th>历史归属</th></tr></thead>
        <tbody>
          ${state.players
            .map(
              (player) => `
                <tr>
                  <td><strong>${escapeHtml(player.displayName)}</strong><small>${escapeHtml(player.id)}</small></td>
                  <td>${escapeHtml(player.accountId ?? "-")}</td>
                  <td>${escapeHtml(player.currentTeam?.name ?? "未设置")}</td>
                  <td>${escapeHtml(player.teams.map((team) => team.shortName || team.name).join(" / ") || "-")}</td>
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
    <div class="bracket-list">
      ${state.bracket.length === 0 ? `<span class="muted-copy">当前阶段暂无 bracket 数据。</span>` : state.bracket.map((node) => `<span>${escapeHtml(node.roundName)} #${escapeHtml(node.position)} · ${escapeHtml(node.status)}</span>`).join("")}
    </div>
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

function payloadFromForm(form: HTMLFormElement): Record<string, FormDataEntryValue> {
  return Object.fromEntries(new FormData(form).entries());
}

async function submitAction(action: string, payload: Record<string, FormDataEntryValue>): Promise<void> {
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

function buildAdminRequests(action: string, payload: Record<string, FormDataEntryValue>): AdminWriteRequest[] {
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
            currentTeamId: payloadString(payload, "currentTeamId") || undefined,
            avatarUrl: payloadString(payload, "avatarUrl") || undefined,
          }),
        },
      ];
    case "add-team-member":
      if (!payloadString(payload, "teamId") || !payloadString(payload, "playerId")) {
        return [];
      }

      return [
        {
          method: "POST",
          path: `/teams/${encodeURIComponent(payloadString(payload, "teamId"))}/members`,
          payload: compactPayload({
            playerId: payloadString(payload, "playerId"),
            role: payloadString(payload, "role") || undefined,
          }),
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

function buildResultRequests(payload: Record<string, FormDataEntryValue>): AdminWriteRequest[] {
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

function buildSyncTaskPayload(payload: Record<string, FormDataEntryValue>): Record<string, unknown> {
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

function payloadString(payload: Record<string, FormDataEntryValue>, fieldName: string, fallback = ""): string {
  const value = payload[fieldName];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function payloadNumber(payload: Record<string, FormDataEntryValue>, fieldName: string): number | undefined {
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
