import "./styles.css";

type ViewKey = "stages" | "schedule" | "sync" | "tags";
type Tone = "neutral" | "good" | "warn" | "danger" | "info";

interface StageCard {
  name: string;
  type: string;
  status: string;
  bo: string;
  draft: string;
  publish: string;
  action: string;
  details: string[];
  tone: Tone;
}

interface ScheduleRow {
  time: string;
  stage: string;
  round: string;
  teams: string;
  bo: string;
  status: string;
  matchId: string;
  openDota: string;
  tone: Tone;
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

interface TagRow {
  targetType: "选手" | "队伍";
  targetName: string;
  tag: string;
  likes: number;
  reports: number;
  status: string;
  tone: Tone;
  reason: string;
}

const root = document.querySelector<HTMLElement>("#root");

const views: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: "stages", label: "赛事阶段", hint: "小组赛 / 瑞士轮 / 淘汰赛" },
  { key: "schedule", label: "赛程赛果", hint: "BO 单局、match_id、冲突" },
  { key: "sync", label: "自动同步", hint: "league_id、发现、解析、重试" },
  { key: "tags", label: "标签审核", hint: "选手 / 队伍互动标签" },
];

const stages: StageCard[] = [
  {
    name: "普通小组赛",
    type: "group",
    status: "进行中",
    bo: "BO2",
    draft: "C 组补赛 2 场仍为草稿",
    publish: "A/B 组第 4 轮已发布",
    action: "进入积分榜",
    details: ["四组单循环", "每组前 2 晋级", "后端重算组内排名"],
    tone: "good",
  },
  {
    name: "瑞士轮",
    type: "swiss",
    status: "待发布",
    bo: "BO3",
    draft: "第 3 轮配对草稿已生成",
    publish: "第 1-2 轮公开，总榜公开",
    action: "生成下一轮",
    details: ["总 5 轮", "避免重复交手", "BYE 进入审计记录"],
    tone: "warn",
  },
  {
    name: "淘汰赛",
    type: "knockout",
    status: "草稿",
    bo: "BO3 / 决赛 BO5",
    draft: "8 队单败 bracket 已按种子位生成",
    publish: "等待上一阶段结果锁定",
    action: "Bracket 管理",
    details: ["8 队单败", "三四名决赛开启", "冲突时不推进节点"],
    tone: "neutral",
  },
];

const schedules: ScheduleRow[] = [
  {
    time: "05-13 19:30",
    stage: "小组赛 A 组",
    round: "第 4 轮",
    teams: "Roshan Club vs Lotus Stack",
    bo: "BO2",
    status: "待补录",
    matchId: "1/2 已关联",
    openDota: "无冲突",
    tone: "warn",
  },
  {
    time: "05-13 20:00",
    stage: "瑞士轮",
    round: "第 3 轮",
    teams: "North Ward vs Stack 404",
    bo: "BO3",
    status: "冲突",
    matchId: "7829142219",
    openDota: "人工胜方与 OpenDota 胜方冲突",
    tone: "danger",
  },
  {
    time: "05-14 19:00",
    stage: "淘汰赛",
    round: "1/4 决赛",
    teams: "Seed 1 vs Seed 8",
    bo: "BO3",
    status: "未开始",
    matchId: "等待赛后发现",
    openDota: "待自动关联",
    tone: "neutral",
  },
];

const syncRows: SyncRow[] = [
  {
    id: "SYNC-9182",
    kind: "discover_match",
    target: "league_id 16972",
    status: "运行中",
    detail: "已发现 6 个候选 match，2 个等待自动关联",
    attempts: 1,
    tone: "info",
  },
  {
    id: "SYNC-9179",
    kind: "request_parse",
    target: "match_id 7829142219",
    status: "失败可重试",
    detail: "OpenDota parse pending 超时，未覆盖已确认赛果",
    attempts: 3,
    tone: "danger",
  },
  {
    id: "SYNC-9175",
    kind: "schedule_link",
    target: "瑞士轮第 3 轮",
    status: "待人工确认",
    detail: "候选双方匹配，但 BO 第 3 局胜方冲突",
    attempts: 1,
    tone: "warn",
  },
];

const tagRows: TagRow[] = [
  {
    targetType: "选手",
    targetName: "中路请喝水",
    tag: "稳定控盾",
    likes: 48,
    reports: 0,
    status: "公开",
    tone: "good",
    reason: "无",
  },
  {
    targetType: "队伍",
    targetName: "Stack 404",
    tag: "暂停战术",
    likes: 7,
    reports: 5,
    status: "待审核",
    tone: "warn",
    reason: "多名用户举报为嘲讽",
  },
  {
    targetType: "选手",
    targetName: "KunkkaOnly",
    tag: "违规昵称梗",
    likes: 2,
    reports: 8,
    status: "已隐藏",
    tone: "danger",
    reason: "包含人身攻击",
  },
];

let activeView: ViewKey = "stages";

function badge(text: string, tone: Tone = "neutral"): string {
  return `<span class="badge badge-${tone}">${text}</span>`;
}

function shell(content: string): string {
  const active = views.find((view) => view.key === activeView) ?? views[0];

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
            <p>MRJZ S8 / league_id 16972</p>
            <h1>${active?.label ?? "赛事阶段"}</h1>
            <span>${active?.hint ?? "小组赛 / 瑞士轮 / 淘汰赛"}</span>
          </div>
          <button class="primary-button" type="button">新建运营操作</button>
        </header>
        ${content}
      </main>
    </div>
  `;
}

function renderStages(): string {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>阶段配置与发布状态</h2>
          <p>自动生成内容先进入草稿，管理员确认后才对用户端公开。</p>
        </div>
        ${badge("后端计算排名与晋级", "info")}
      </div>
      <div class="stage-grid">
        ${stages
          .map(
            (stage) => `
              <article class="stage-card">
                <div class="stage-head">
                  <div>
                    <small>${stage.type}</small>
                    <h3>${stage.name}</h3>
                  </div>
                  ${badge(stage.status, stage.tone)}
                </div>
                <dl>
                  <div><dt>BO</dt><dd>${stage.bo}</dd></div>
                  <div><dt>草稿生成</dt><dd>${stage.draft}</dd></div>
                  <div><dt>发布状态</dt><dd>${stage.publish}</dd></div>
                </dl>
                <ul>${stage.details.map((item) => `<li>${item}</li>`).join("")}</ul>
                <button class="secondary-button" type="button">${stage.action}</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>积分榜 / Bracket 入口</h2>
          <p>小组赛和瑞士轮进入积分榜管理，淘汰赛进入 bracket 节点管理。</p>
        </div>
      </div>
      <div class="entry-grid">
        <button type="button">小组赛积分榜</button>
        <button type="button">瑞士轮总榜与 BYE</button>
        <button type="button">淘汰赛 Bracket 管理</button>
      </div>
    </section>
  `;
}

function renderSchedule(): string {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>赛程赛果</h2>
          <p>Series 归属赛事阶段；每个 BO 单局独立关联 OpenDota match_id。</p>
        </div>
        <button class="primary-button" type="button">创建 BO series</button>
      </div>
      <div class="filters">
        <select><option>全部阶段</option><option>普通小组赛</option><option>瑞士轮</option><option>淘汰赛</option></select>
        <select><option>待处理优先</option><option>待补录</option><option>冲突</option><option>已完赛</option></select>
        <input value="match_id / 队伍搜索" aria-label="赛程搜索" />
      </div>
      ${scheduleTable()}
    </section>

    <section class="panel two-column">
      <div>
        <h2>BO 单局结果录入</h2>
        <div class="game-row"><strong>G1</strong><input value="7829136788" /><input value="North Ward 胜" />${badge("已确认", "good")}</div>
        <div class="game-row"><strong>G2</strong><input value="7829140088" /><input value="Stack 404 胜" />${badge("待确认", "warn")}</div>
        <div class="game-row"><strong>G3</strong><input value="7829142219" /><input value="人工录 North Ward 胜" />${badge("冲突", "danger")}</div>
      </div>
      <div class="conflict-box">
        <h2>OpenDota 冲突</h2>
        <p>人工胜方与 OpenDota 胜方冲突时进入待确认，不自动推进排名、瑞士配对或 bracket。</p>
        <textarea placeholder="填写处理原因，写入审计日志"></textarea>
      </div>
    </section>
  `;
}

function scheduleTable(): string {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>阶段 / 轮次</th>
            <th>对阵</th>
            <th>BO</th>
            <th>状态</th>
            <th>match_id</th>
            <th>OpenDota</th>
          </tr>
        </thead>
        <tbody>
          ${schedules
            .map(
              (row) => `
                <tr>
                  <td>${row.time}</td>
                  <td>${row.stage}<small>${row.round}</small></td>
                  <td>${row.teams}</td>
                  <td>${row.bo}</td>
                  <td>${badge(row.status, row.tone)}</td>
                  <td>${row.matchId}</td>
                  <td>${row.openDota}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSync(): string {
  return `
    <section class="panel two-column">
      <div>
        <div class="section-heading">
          <div>
            <h2>league_id 配置</h2>
            <p>自动发现 match、请求解析、关联失败进人工队列。</p>
          </div>
          ${badge("启用中", "good")}
        </div>
        <div class="settings">
          <label>OpenDota league_id<input value="16972" /></label>
          <label>同步频率<select><option>每 10 分钟</option><option>手动</option></select></label>
          <label class="check"><input type="checkbox" checked /> 自动请求解析</label>
        </div>
      </div>
      <div class="sync-summary">
        <div><span>发现 match</span><strong>42</strong></div>
        <div><span>请求解析</span><strong>31</strong></div>
        <div><span>失败重试</span><strong>4</strong></div>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>同步任务队列</h2>
          <p>失败原因和重试次数可追踪，外部接口失败不影响用户端已有缓存。</p>
        </div>
        <button class="secondary-button" type="button">仅看失败</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>任务</th>
              <th>类型</th>
              <th>目标</th>
              <th>状态</th>
              <th>进度 / 失败原因</th>
              <th>重试</th>
            </tr>
          </thead>
          <tbody>
            ${syncRows
              .map(
                (row) => `
                  <tr>
                    <td>${row.id}</td>
                    <td><code>${row.kind}</code></td>
                    <td>${row.target}</td>
                    <td>${badge(row.status, row.tone)}</td>
                    <td>${row.detail}</td>
                    <td><button class="link-button" type="button">重试 ${row.attempts}</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTags(): string {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>互动标签审核</h2>
          <p>普通用户可以给选手和队伍添加标签并点赞；后台只处理举报、隐藏和恢复。</p>
        </div>
        ${badge("按举报优先", "warn")}
      </div>
      <div class="filters">
        <select><option>全部目标</option><option>选手</option><option>队伍</option></select>
        <select><option>待审核优先</option><option>公开</option><option>已隐藏</option></select>
        <input value="标签 / 目标搜索" aria-label="标签搜索" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>目标</th>
              <th>标签</th>
              <th>点赞</th>
              <th>举报</th>
              <th>状态</th>
              <th>原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${tagRows
              .map(
                (row) => `
                  <tr>
                    <td>${row.targetType}<small>${row.targetName}</small></td>
                    <td><strong>${row.tag}</strong></td>
                    <td>${row.likes}</td>
                    <td>${row.reports}</td>
                    <td>${badge(row.status, row.tone)}</td>
                    <td>${row.reason}</td>
                    <td><button class="link-button" type="button">${row.status === "已隐藏" ? "恢复" : "隐藏"}</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel two-column">
      <div>
        <h2>隐藏原因</h2>
        <p class="muted-copy">隐藏标签必须写入原因和审计记录，用户端不展示已隐藏标签。</p>
        <textarea placeholder="例如：包含人身攻击，隐藏并写入审计日志"></textarea>
      </div>
      <div class="tag-policy">
        <h2>标签展示规则</h2>
        <ul>
          <li>同一用户对同一标签只允许点赞一次。</li>
          <li>点赞越多字号越大，但需要设置最大字号上限。</li>
          <li>被隐藏标签保留记录，用于追踪重复违规。</li>
        </ul>
      </div>
    </section>
  `;
}

function currentView(): string {
  const renderers: Record<ViewKey, () => string> = {
    stages: renderStages,
    schedule: renderSchedule,
    sync: renderSync,
    tags: renderTags,
  };

  return renderers[activeView]();
}

function render(): void {
  if (!root) {
    return;
  }

  root.innerHTML = shell(currentView());
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
  }
});

render();
