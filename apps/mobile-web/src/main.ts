import "./styles.css";
import {
  featuredMatch,
  playerTags,
  scheduleGroups,
  stageViews,
  teamTags,
  tournamentStats,
  type AghanimState,
  type AppRoute,
  type DraftStep,
  type MatchData,
  type PlayerStats,
  type StageKey,
  type TeamSide,
} from "./data";

const root = document.querySelector<HTMLDivElement>("#root");

const routeOptions: Array<{ key: AppRoute; label: string; kicker: string }> = [
  { key: "home", label: "首页", kicker: "总览" },
  { key: "stage", label: "赛事阶段", kicker: "阶段" },
  { key: "schedule", label: "赛程", kicker: "时间" },
  { key: "match", label: "比赛详情", kicker: "战报" },
  { key: "tags", label: "标签预览", kicker: "社区" },
];

const stageOptions: Array<{ key: StageKey; label: string }> = [
  { key: "group", label: "小组赛" },
  { key: "swiss", label: "瑞士轮" },
  { key: "knockout", label: "淘汰赛" },
];

const routeSet = new Set<AppRoute>(routeOptions.map((route) => route.key));
const stageSet = new Set<StageKey>(stageOptions.map((stage) => stage.key));

const appState: {
  route: AppRoute;
  stage: StageKey;
  expandedPlayers: Set<string>;
} = {
  route: readRouteFromHash(),
  stage: "group",
  expandedPlayers: new Set(["r2"]),
};

if (!root) {
  throw new Error("Missing #root element for mobile web app.");
}

render();

window.addEventListener("hashchange", () => {
  appState.route = readRouteFromHash();
  render();
});

root.addEventListener("click", (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const routeButton = target?.closest<HTMLElement>("[data-route]");
  const stageButton = target?.closest<HTMLElement>("[data-stage]");
  const playerButton = target?.closest<HTMLElement>("[data-player]");
  const topButton = target?.closest<HTMLElement>("[data-top]");

  if (routeButton) {
    const nextRoute = routeButton.dataset.route;
    if (isRoute(nextRoute)) {
      appState.route = nextRoute;
      window.history.replaceState(null, "", `#${nextRoute}`);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  if (stageButton) {
    const nextStage = stageButton.dataset.stage;
    if (isStage(nextStage)) {
      appState.stage = nextStage;
      render();
    }
    return;
  }

  if (playerButton) {
    const playerId = playerButton.dataset.player;
    if (playerId) {
      if (appState.expandedPlayers.has(playerId)) {
        appState.expandedPlayers.delete(playerId);
      } else {
        appState.expandedPlayers.add(playerId);
      }
      render();
    }
    return;
  }

  if (topButton) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

function render(): void {
  document.title = `MRJZ H5 - ${routeLabel(appState.route)}`;
  root!.innerHTML = `
    <div class="app-shell">
      ${renderAppBar()}
      <main class="view" aria-live="polite">
        ${renderCurrentRoute()}
      </main>
      ${renderBottomNav()}
      <button class="back-top" type="button" data-top aria-label="回到顶部">↑</button>
    </div>
  `;
}

function renderCurrentRoute(): string {
  switch (appState.route) {
    case "home":
      return renderHome();
    case "stage":
      return renderStagePage();
    case "schedule":
      return renderSchedulePage();
    case "match":
      return renderMatchDetail(featuredMatch);
    case "tags":
      return renderTagsPage();
  }
}

function renderAppBar(): string {
  return `
    <header class="app-bar">
      <div class="status-line">
        <span>MRJZ Mobile Web</span>
        <span>公开分享原型</span>
      </div>
      <div class="title-line">
        <button class="icon-button" type="button" data-route="home" aria-label="返回首页">‹</button>
        <div>
          <p class="eyebrow">${escapeHtml(activeRoute().kicker)}</p>
          <h1>${escapeHtml(routeLabel(appState.route))}</h1>
        </div>
        <button class="icon-button share-button" type="button" data-route="match" aria-label="分享战报">↗</button>
      </div>
      <nav class="route-tabs" aria-label="主导航">
        ${routeOptions
          .map(
            (route) => `
              <button
                class="route-tab ${route.key === appState.route ? "active" : ""}"
                type="button"
                data-route="${route.key}"
              >
                ${escapeHtml(route.label)}
              </button>
            `,
          )
          .join("")}
      </nav>
    </header>
  `;
}

function renderBottomNav(): string {
  return `
    <nav class="bottom-nav" aria-label="底部导航">
      ${routeOptions
        .filter((route) => route.key !== "home")
        .map(
          (route) => `
            <button
              type="button"
              class="${route.key === appState.route ? "active" : ""}"
              data-route="${route.key}"
            >
              <span>${escapeHtml(route.kicker)}</span>
              <b>${escapeHtml(route.label.replace("比赛", ""))}</b>
            </button>
          `,
        )
        .join("")}
    </nav>
  `;
}

function renderHome(): string {
  const nextMatch = scheduleGroups[0]?.matches[0];
  const recentMatch = scheduleGroups[1]?.matches[0];

  return `
    <section class="hero-card dense-section">
      <div>
        <p class="eyebrow">MRJZ 春季杯 S1</p>
        <h2>公开赛程与长战报 H5</h2>
        <p class="muted">手机浏览器、微信、QQ 分享链接都能落地查看，复杂写入仍交给 Web Admin。</p>
      </div>
      <div class="hero-score">
        <span>${featuredMatch.radiant.shortName}</span>
        <b>${featuredMatch.radiantScore}:${featuredMatch.direScore}</b>
        <span>${featuredMatch.dire.shortName}</span>
      </div>
    </section>

    <section class="metric-grid" aria-label="赛事概览">
      ${tournamentStats.map(renderMetric).join("")}
    </section>

    <section class="section-panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Next</p>
          <h2>下一场赛程</h2>
        </div>
        <button class="link-button" type="button" data-route="schedule">查看赛程</button>
      </div>
      ${nextMatch ? renderScheduleCard(nextMatch) : renderEmptyState("暂无下一场赛程")}
    </section>

    <section class="section-panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">Latest</p>
          <h2>最新赛果</h2>
        </div>
        <button class="link-button" type="button" data-route="match">打开战报</button>
      </div>
      ${recentMatch ? renderScheduleCard(recentMatch) : renderEmptyState("暂无已完赛比赛")}
    </section>

    <section class="quick-grid">
      ${renderQuickEntry("stage", "赛事地图", "积分榜、轮次、Bracket 缩略图")}
      ${renderQuickEntry("match", "长战报", "10 名玩家、BP、眼位、聊天")}
      ${renderQuickEntry("tags", "标签云", "选手与队伍社区印象")}
      ${renderQuickEntry("schedule", "时间表", "日期分组与状态筛选")}
    </section>
  `;
}

function renderStagePage(): string {
  const currentStage = stageViews[appState.stage];

  return `
    <section class="stage-switch section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Tournament Map</p>
          <h2>阶段切换概念</h2>
        </div>
        <span class="sync-pill">后端权威排名</span>
      </div>
      <div class="segmented" role="tablist" aria-label="阶段切换">
        ${stageOptions
          .map(
            (stage) => `
              <button
                role="tab"
                aria-selected="${stage.key === appState.stage ? "true" : "false"}"
                class="${stage.key === appState.stage ? "active" : ""}"
                type="button"
                data-stage="${stage.key}"
              >
                ${escapeHtml(stage.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="stage-head">
        <div>
          <p class="eyebrow">${escapeHtml(currentStage.status)}</p>
          <h2>${escapeHtml(currentStage.name)} · ${escapeHtml(currentStage.currentRound)}</h2>
          <p class="muted">${escapeHtml(currentStage.note)}</p>
        </div>
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Standings</p>
          <h2>积分榜</h2>
        </div>
        <span class="tiny-meta">不在前端计算晋级</span>
      </div>
      <div class="standing-list">
        ${currentStage.standings.map(renderStandingRow).join("")}
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Current Round</p>
          <h2>当前轮</h2>
        </div>
        <span class="status-tag blue">${escapeHtml(currentStage.currentRound)}</span>
      </div>
      <div class="round-board">
        <div>
          <span>20:30</span>
          <b>死亡之拳 vs 天辉老中医</b>
          <small>BO3 · 配对草稿</small>
        </div>
        <div>
          <span>22:00</span>
          <b>Roshan Snack vs 高地不掉队</b>
          <small>BO2 · 待补录赛果</small>
        </div>
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Bracket</p>
          <h2>淘汰赛缩略图</h2>
        </div>
        <span class="tiny-meta">移动端纵向预览</span>
      </div>
      ${renderBracketMini(appState.stage)}
    </section>
  `;
}

function renderSchedulePage(): string {
  return `
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Schedule</p>
          <h2>赛程列表</h2>
        </div>
        <span class="sync-pill">只读公开</span>
      </div>
      <div class="filter-row">
        <span class="filter active">全部</span>
        <span class="filter">未开始</span>
        <span class="filter">待补录</span>
        <span class="filter">已完赛</span>
        <span class="filter">延期</span>
      </div>
    </section>
    ${scheduleGroups
      .map(
        (group) => `
          <section class="section-panel schedule-group">
            <div class="date-row">
              <b>${escapeHtml(group.date)}</b>
              <span>${escapeHtml(group.label)}</span>
            </div>
            <div class="schedule-list">
              ${group.matches.map(renderScheduleCard).join("")}
            </div>
          </section>
        `,
      )
      .join("")}
  `;
}

function renderMatchDetail(match: MatchData): string {
  const mvp = match.players.find((player) => player.id === match.mvpPlayerId);
  const radiantPlayers = match.players.filter((player) => player.side === "radiant");
  const direPlayers = match.players.filter((player) => player.side === "dire");

  return `
    ${renderMatchSummary(match)}
    ${mvp ? renderMvpCard(mvp, match) : ""}

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Players</p>
          <h2>双方选手数据</h2>
        </div>
        <span class="tiny-meta">点选展开加点与高级数据</span>
      </div>
      ${renderTeamPanel("radiant", radiantPlayers, match)}
      ${renderTeamPanel("dire", direPlayers, match)}
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Aghanim</p>
          <h2>神杖与魔晶状态</h2>
        </div>
        <span class="tiny-meta">图示占位</span>
      </div>
      <div class="agha-board">
        ${match.players.map(renderAghanimStatus).join("")}
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Draft</p>
          <h2>Ban / Pick 顺序</h2>
        </div>
        <span class="tiny-meta">按 order 升序</span>
      </div>
      ${renderDraftTimeline(match.draft)}
      <div class="empty-state subtle">无 BP 降级态：该比赛暂未解析 Ban/Pick 时，本模块保留位置并显示空状态。</div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Vision</p>
          <h2>眼位时间轴</h2>
        </div>
        <span class="tiny-meta">MVP 先做关键节点</span>
      </div>
      ${renderWardTimeline(match)}
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Trend</p>
          <h2>经济 / 经验趋势</h2>
        </div>
        <span class="status-tag green">占位图</span>
      </div>
      ${renderTrendPlaceholder()}
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Chat</p>
          <h2>全局聊天记录</h2>
        </div>
        <span class="tiny-meta">公开聊天</span>
      </div>
      <div class="chat-list">
        ${match.chat.map(renderChatLine).join("")}
      </div>
    </section>

    <section class="section-panel tag-entry">
      <div>
        <p class="eyebrow">Community Tags</p>
        <h2>标签云入口</h2>
        <p class="muted">战报读完后进入选手与队伍标签预览，只读展示点赞热度。</p>
      </div>
      <button class="primary-button" type="button" data-route="tags">查看标签</button>
    </section>
  `;
}

function renderTagsPage(): string {
  return `
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Players</p>
          <h2>选手标签预览</h2>
        </div>
        <span class="sync-pill">只读</span>
      </div>
      <div class="tag-cloud">
        ${playerTags.map((tag) => renderTag(tag.label, tag.votes, tag.target)).join("")}
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Teams</p>
          <h2>队伍标签预览</h2>
        </div>
        <span class="sync-pill">社区印象</span>
      </div>
      <div class="tag-cloud">
        ${teamTags.map((tag) => renderTag(tag.label, tag.votes, tag.target)).join("")}
      </div>
    </section>

    <section class="profile-preview-grid">
      ${renderProfilePreview("River.Mid", "风行者", "死亡之拳", "88% 参战率 · 48.7k 输出", playerTags.slice(0, 3).map((tag) => tag.label))}
      ${renderProfilePreview("死亡之拳", "战队", "A 组 3-0", "控盾 4 次 · 场均 34.7 击杀", teamTags.slice(0, 2).map((tag) => tag.label))}
    </section>
  `;
}

function renderMetric(metric: { label: string; value: string; hint: string }): string {
  return `
    <article class="metric-card">
      <span>${escapeHtml(metric.label)}</span>
      <b>${escapeHtml(metric.value)}</b>
      <small>${escapeHtml(metric.hint)}</small>
    </article>
  `;
}

function renderQuickEntry(route: AppRoute, title: string, note: string): string {
  return `
    <button class="quick-entry" type="button" data-route="${route}">
      <b>${escapeHtml(title)}</b>
      <span>${escapeHtml(note)}</span>
    </button>
  `;
}

function renderScheduleCard(match: {
  time: string;
  stage: string;
  round: string;
  teamA: string;
  teamB: string;
  bo: string;
  status: string;
  score?: string;
  matchId?: string;
}): string {
  const isFinished = match.status === "已完赛";
  return `
    <article class="schedule-card ${isFinished ? "finished" : ""}">
      <div class="schedule-time">
        <b>${escapeHtml(match.time)}</b>
        <span>${escapeHtml(match.stage)} · ${escapeHtml(match.round)}</span>
      </div>
      <div class="schedule-vs">
        <span>${escapeHtml(match.teamA)}</span>
        <strong>${escapeHtml(match.score ?? match.bo)}</strong>
        <span>${escapeHtml(match.teamB)}</span>
      </div>
      <div class="schedule-meta">
        <span class="status-tag ${statusClass(match.status)}">${escapeHtml(match.status)}</span>
        <small>${escapeHtml(match.matchId ? `match ${match.matchId}` : "等待后台确认")}</small>
      </div>
    </article>
  `;
}

function renderStandingRow(row: {
  rank: number;
  team: string;
  score: string;
  points: string;
  streak: string;
  status: string;
}): string {
  return `
    <div class="standing-row">
      <span class="rank">${row.rank}</span>
      <b>${escapeHtml(row.team)}</b>
      <span>${escapeHtml(row.score)}</span>
      <span>${escapeHtml(row.points)}</span>
      <span class="status-tag ${row.status === "晋级区" ? "green" : row.status === "淘汰区" ? "red" : "blue"}">
        ${escapeHtml(row.streak)}
      </span>
    </div>
  `;
}

function renderBracketMini(stage: StageKey): string {
  const finalName = stage === "knockout" ? "总决赛" : "Final Seed";
  return `
    <div class="bracket-mini">
      <div class="bracket-column">
        ${renderBracketNode("死亡之拳", "Upper Seed 1")}
        ${renderBracketNode("夜魇补刀学院", "Lower R1")}
      </div>
      <div class="bracket-rail">
        <span></span>
        <span></span>
      </div>
      <div class="bracket-column">
        ${renderBracketNode("天辉老中医", "Upper Seed 2")}
        ${renderBracketNode("肉山研究所", finalName)}
      </div>
    </div>
  `;
}

function renderBracketNode(team: string, note: string): string {
  return `
    <div class="bracket-node">
      <b>${escapeHtml(team)}</b>
      <span>${escapeHtml(note)}</span>
    </div>
  `;
}

function renderMatchSummary(match: MatchData): string {
  const winner = match.winner === "radiant" ? match.radiant : match.dire;
  return `
    <section class="match-summary">
      <div class="summary-meta">
        <span>${escapeHtml(match.league)}</span>
        <span>${escapeHtml(match.series)}</span>
      </div>
      <div class="scoreboard">
        <div class="team-side radiant">
          <span>${escapeHtml(match.radiant.seed)}</span>
          <b>${escapeHtml(match.radiant.name)}</b>
          <small>天辉</small>
        </div>
        <div class="score-core">
          <p>${escapeHtml(winner.name)} 胜利</p>
          <strong>${match.radiantScore}<i>:</i>${match.direScore}</strong>
          <span>${escapeHtml(match.duration)} · ${escapeHtml(match.mode)}</span>
        </div>
        <div class="team-side dire">
          <span>${escapeHtml(match.dire.seed)}</span>
          <b>${escapeHtml(match.dire.name)}</b>
          <small>夜魇</small>
        </div>
      </div>
      <div class="match-meta-grid">
        <span>match_id <b>${escapeHtml(match.id)}</b></span>
        <span>结束 <b>${escapeHtml(match.endedAt)}</b></span>
        <span>解析 <b>${escapeHtml(match.parseStatus)}</b></span>
      </div>
    </section>
  `;
}

function renderMvpCard(player: PlayerStats, match: MatchData): string {
  const team = getTeam(match, player.side);
  return `
    <section class="mvp-card">
      <div class="mvp-copy">
        <p class="eyebrow">MVP</p>
        <h2>${escapeHtml(player.name)}</h2>
        <p>${escapeHtml(player.hero)} · ${escapeHtml(team.name)}</p>
        <div class="mvp-stats">
          <span><b>${player.kills}/${player.deaths}/${player.assists}</b>KDA</span>
          <span><b>${escapeHtml(player.participation)}</b>参战</span>
          <span><b>${escapeHtml(player.damageShare)}</b>伤害</span>
        </div>
        <div class="tag-strip">
          ${player.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <img class="mvp-portrait" src="${escapeHtml(player.portrait)}" alt="${escapeHtml(player.hero)}" />
    </section>
  `;
}

function renderTeamPanel(side: TeamSide, players: PlayerStats[], match: MatchData): string {
  const team = getTeam(match, side);
  return `
    <div class="team-panel ${side}">
      <div class="team-panel-head">
        <span>${side === "radiant" ? "天辉" : "夜魇"}</span>
        <b>${escapeHtml(team.name)}</b>
        <small>${escapeHtml(team.seed)}</small>
      </div>
      <div class="player-list">
        ${players.map(renderPlayerRow).join("")}
      </div>
    </div>
  `;
}

function renderPlayerRow(player: PlayerStats): string {
  const expanded = appState.expandedPlayers.has(player.id);
  return `
    <article class="player-row ${player.side} ${expanded ? "expanded" : ""}">
      <button type="button" class="player-main" data-player="${escapeHtml(player.id)}" aria-expanded="${expanded ? "true" : "false"}">
        <img class="hero-avatar" src="${escapeHtml(player.portrait)}" alt="${escapeHtml(player.hero)}" />
        <div class="player-id">
          <div>
            <b>${escapeHtml(player.name)}</b>
            <span>Lv.${player.level} · ${escapeHtml(player.hero)} · ${escapeHtml(player.role)}</span>
          </div>
          <div class="ability-mini" aria-label="技能加点顺序预览">
            ${player.abilityOrder
              .slice(0, 8)
              .map((ability, index) => `<span title="${escapeHtml(ability)}">${index + 1}</span>`)
              .join("")}
          </div>
        </div>
        <div class="player-kda">
          <b>${player.kills}/${player.deaths}/${player.assists}</b>
          <span>${escapeHtml(player.participation)}</span>
        </div>
      </button>
      <div class="player-tools">
        <div class="item-grid">
          ${player.items.map(renderItemChip).join("")}
        </div>
        <div class="agha-icons">
          ${renderAghanimIcon("杖", player.scepter)}
          ${renderAghanimIcon("晶", player.shard)}
        </div>
      </div>
      ${
        expanded
          ? `
            <div class="player-expanded">
              <div class="advanced-grid">
                ${renderAdvancedMetric("GPM", String(player.gpm))}
                ${renderAdvancedMetric("XPM", String(player.xpm))}
                ${renderAdvancedMetric("净值", player.netWorth)}
                ${renderAdvancedMetric("正反补", `${player.lastHits}/${player.denies}`)}
                ${renderAdvancedMetric("英雄伤害", player.heroDamage)}
                ${renderAdvancedMetric("建筑", player.towerDamage)}
                ${renderAdvancedMetric("治疗", player.healing)}
                ${renderAdvancedMetric("承伤", player.damageTaken)}
              </div>
              <div class="ability-order">
                ${player.abilityOrder
                  .map((ability, index) => `<span><b>${index + 1}</b>${escapeHtml(ability)}</span>`)
                  .join("")}
              </div>
              <p class="tiny-meta">分路 ${escapeHtml(player.lane)} · 中立 ${escapeHtml(player.neutralItem)}</p>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderItemChip(item: string): string {
  return `<span class="item-chip" title="${escapeHtml(item)}">${escapeHtml(item.slice(0, 2))}</span>`;
}

function renderAdvancedMetric(label: string, value: string): string {
  return `
    <span>
      <small>${escapeHtml(label)}</small>
      <b>${escapeHtml(value)}</b>
    </span>
  `;
}

function renderAghanimStatus(player: PlayerStats): string {
  return `
    <div class="agha-row ${player.side}">
      <span>${escapeHtml(player.heroShort)}</span>
      <b>${escapeHtml(player.name)}</b>
      <div>
        ${renderAghanimIcon("神杖", player.scepter)}
        ${renderAghanimIcon("魔晶", player.shard)}
      </div>
    </div>
  `;
}

function renderAghanimIcon(label: string, state: AghanimState): string {
  const title = state === "owned" ? "已拥有" : state === "queued" ? "待购买" : "未购买";
  return `<span class="agha-icon ${state}" title="${escapeHtml(label)} ${title}">${escapeHtml(label)}</span>`;
}

function renderDraftTimeline(draft: DraftStep[]): string {
  if (draft.length === 0) {
    return renderEmptyState("该比赛暂未解析 Ban/Pick");
  }

  return `
    <div class="draft-timeline">
      ${draft
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(
          (step) => `
            <div class="draft-step ${step.side} ${step.type.toLowerCase()}">
              <span class="draft-order">${step.order}</span>
              <div>
                <b>${escapeHtml(step.type)} · ${escapeHtml(step.hero)}</b>
                <small>${escapeHtml(step.actor)}</small>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWardTimeline(match: MatchData): string {
  return `
    <div class="vision-map" aria-label="关键眼位小地图占位">
      <span class="map-dot radiant" style="left: 28%; top: 34%"></span>
      <span class="map-dot dire" style="left: 63%; top: 28%"></span>
      <span class="map-dot radiant" style="left: 49%; top: 48%"></span>
      <span class="map-dot dire" style="left: 68%; top: 66%"></span>
      <span class="map-dot radiant" style="left: 40%; top: 72%"></span>
    </div>
    <div class="ward-list">
      ${match.wardTimeline
        .map(
          (event) => `
            <div class="ward-row ${event.side}">
              <span>${escapeHtml(event.time)}</span>
              <b>${escapeHtml(event.type)}</b>
              <small>${escapeHtml(event.lane)} · ${escapeHtml(event.note)}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTrendPlaceholder(): string {
  return `
    <div class="trend-tabs">
      <span class="active">总经济差</span>
      <span>总经验差</span>
      <span>个人经济</span>
    </div>
    <div class="trend-graph" aria-label="经济经验趋势占位">
      <div class="zero-line"></div>
      <span class="trend-line radiant-line"></span>
      <span class="trend-line dire-line"></span>
      <span class="trend-point p1"></span>
      <span class="trend-point p2"></span>
      <span class="trend-point p3"></span>
      <span class="trend-point p4"></span>
    </div>
    <div class="trend-legend">
      <span><i class="radiant-dot"></i>天辉经济</span>
      <span><i class="dire-dot"></i>夜魇经验</span>
      <span>真实版本接 ECharts 或轻量 canvas</span>
    </div>
  `;
}

function renderChatLine(line: {
  time: string;
  side: TeamSide;
  player: string;
  hero: string;
  text: string;
}): string {
  return `
    <div class="chat-line ${line.side}">
      <span>${escapeHtml(line.time)}</span>
      <b>${escapeHtml(line.player)}</b>
      <small>${escapeHtml(line.hero)}</small>
      <p>${escapeHtml(line.text)}</p>
    </div>
  `;
}

function renderTag(label: string, votes: number, target: string): string {
  const size = votes > 70 ? "large" : votes > 40 ? "medium" : "small";
  return `
    <span class="cloud-tag ${size}">
      <b>${escapeHtml(label)}</b>
      <small>${votes} · ${escapeHtml(target)}</small>
    </span>
  `;
}

function renderProfilePreview(name: string, type: string, team: string, stat: string, tags: string[]): string {
  return `
    <article class="profile-preview">
      <div class="profile-avatar">${escapeHtml(name.slice(0, 2))}</div>
      <div>
        <p class="eyebrow">${escapeHtml(type)}</p>
        <h2>${escapeHtml(name)}</h2>
        <p class="muted">${escapeHtml(team)} · ${escapeHtml(stat)}</p>
        <div class="tag-strip">
          ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderEmptyState(text: string): string {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function getTeam(match: MatchData, side: TeamSide) {
  return side === "radiant" ? match.radiant : match.dire;
}

function activeRoute() {
  return routeOptions.find((route) => route.key === appState.route) ?? routeOptions[0]!;
}

function routeLabel(route: AppRoute): string {
  return routeOptions.find((option) => option.key === route)?.label ?? "MRJZ";
}

function statusClass(status: string): string {
  if (status === "已完赛" || status === "晋级区") {
    return "green";
  }
  if (status === "延期" || status === "淘汰区") {
    return "red";
  }
  if (status === "待补录") {
    return "blue";
  }
  return "";
}

function readRouteFromHash(): AppRoute {
  const rawRoute = window.location.hash.replace("#", "");
  return isRoute(rawRoute) ? rawRoute : "match";
}

function isRoute(value: string | undefined): value is AppRoute {
  return Boolean(value && routeSet.has(value as AppRoute));
}

function isStage(value: string | undefined): value is StageKey {
  return Boolean(value && stageSet.has(value as StageKey));
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
