import "./styles.css";
import {
  loadMatchData,
  loadMobileData,
  loadPlayerProfile,
  loadTeamProfile,
  loadTournamentPlayers,
  loadTournamentTeams,
  type MobileData,
} from "./api";
import {
  type AghanimState,
  type AppRoute,
  type DraftStep,
  type EntityTeamInfo,
  type MatchRecord,
  type MatchData,
  type PlayerDirectoryItem,
  type PlayerProfile,
  type PlayerStats,
  type ProfileMatchSummary,
  type StageKey,
  type StageView,
  type TeamProfile,
  type TeamSide,
} from "./data";

const root = document.querySelector<HTMLDivElement>("#root");
let activeWardScrubber: HTMLElement | null = null;
let activeWardPointerId: number | null = null;
let wardScrubberScrollY: number | null = null;
let wardScrubberScrollLockUntil = 0;
let wardScrubberSuppressNativeEventsUntil = 0;
let lastFloatingNavScrollY = 0;
let floatingNavScrollTicking = false;

const routeOptions: Array<{ key: AppRoute; label: string; kicker: string }> = [
  { key: "home", label: "首页", kicker: "入口" },
  { key: "stage", label: "赛事阶段", kicker: "阶段" },
  { key: "schedule", label: "赛程", kicker: "时间" },
  { key: "records", label: "比赛记录", kicker: "记录" },
  { key: "match", label: "比赛详情", kicker: "战报" },
  { key: "players", label: "选手", kicker: "数据" },
  { key: "teams", label: "队伍", kicker: "战队" },
];

const primaryNavRoutes = routeOptions.filter((route) => route.key !== "match");

const stageOptions: Array<{ key: StageKey; label: string }> = [
  { key: "group", label: "小组赛" },
  { key: "swiss", label: "瑞士轮" },
  { key: "knockout", label: "淘汰赛" },
];

type PlayerSortKey =
  | "displayName"
  | "totalMatches"
  | "winRate"
  | "kda"
  | "avgKills"
  | "avgGpm"
  | "avgXpm"
  | "avgHeroDamage"
  | "avgTowerDamage"
  | "avgDamageTaken";

type SortDirection = "asc" | "desc";

const playerSortOptions: Array<{ key: PlayerSortKey; label: string; defaultDirection: SortDirection }> = [
  { key: "totalMatches", label: "场次", defaultDirection: "desc" },
  { key: "winRate", label: "胜率", defaultDirection: "desc" },
  { key: "kda", label: "KDA", defaultDirection: "desc" },
  { key: "avgKills", label: "击杀", defaultDirection: "desc" },
  { key: "avgGpm", label: "GPM", defaultDirection: "desc" },
  { key: "avgXpm", label: "XPM", defaultDirection: "desc" },
  { key: "avgHeroDamage", label: "伤害", defaultDirection: "desc" },
  { key: "avgTowerDamage", label: "建筑", defaultDirection: "desc" },
  { key: "avgDamageTaken", label: "承伤", defaultDirection: "desc" },
  { key: "displayName", label: "名字", defaultDirection: "asc" },
];

const playerSortKeySet = new Set<PlayerSortKey>(playerSortOptions.map((option) => option.key));

const routeSet = new Set<AppRoute>([...routeOptions.map((route) => route.key), "player", "team"]);
const stageSet = new Set<StageKey>(stageOptions.map((stage) => stage.key));

const appState: {
  route: AppRoute;
  stage: StageKey;
  expandedPlayers: Set<string>;
  wardScrubberSeconds: Record<string, number>;
  data: MobileData | null;
  loading: boolean;
  selectedTournamentId: string | null;
  playerSortKey: PlayerSortKey;
  playerSortDirection: SortDirection;
  profileId: string | null;
  playerProfiles: Record<string, PlayerProfile>;
  teamProfiles: Record<string, TeamProfile>;
  profileLoading: Record<string, boolean>;
  profileErrors: Record<string, string>;
  routeHistory: AppRoute[];
  floatingNavHidden: boolean;
} = {
  route: readRouteFromHash(),
  stage: "group",
  expandedPlayers: new Set(["r2"]),
  wardScrubberSeconds: {},
  data: null,
  loading: true,
  selectedTournamentId: null,
  playerSortKey: "totalMatches",
  playerSortDirection: "desc",
  profileId: readProfileIdFromHash(),
  playerProfiles: {},
  teamProfiles: {},
  profileLoading: {},
  profileErrors: {},
  routeHistory: [],
  floatingNavHidden: false,
};

if (!root) {
  throw new Error("Missing #root element for mobile web app.");
}

render();
void refreshData();

window.addEventListener("hashchange", () => {
  appState.route = readRouteFromHash();
  appState.profileId = readProfileIdFromHash();
  render();
});

root.addEventListener("click", (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const backButton = target?.closest<HTMLElement>("[data-back]");
  const routeButton = target?.closest<HTMLElement>("[data-route]");
  const stageButton = target?.closest<HTMLElement>("[data-stage]");
  const playerButton = target?.closest<HTMLElement>("[data-player]");
  const profilePlayerButton = target?.closest<HTMLElement>("[data-profile-player]");
  const profileTeamButton = target?.closest<HTMLElement>("[data-profile-team]");
  const playerSortButton = target?.closest<HTMLElement>("[data-player-sort]");
  const retryProfileButton = target?.closest<HTMLElement>("[data-retry-profile]");
  const topButton = target?.closest<HTMLElement>("[data-top]");
  const tournamentButton = target?.closest<HTMLElement>("[data-tournament]");
  const matchButton = target?.closest<HTMLElement>("[data-match-id]");

  if (backButton) {
    goBack();
    return;
  }

  if (tournamentButton) {
    const tournamentId = tournamentButton.dataset.tournament;
    const targetRoute = tournamentButton.dataset.targetRoute;
    if (tournamentId) {
      appState.selectedTournamentId = tournamentId;
      appState.loading = true;
      if (isRoute(targetRoute)) {
        navigateTo(targetRoute);
      }
      render();
      void refreshData(tournamentId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  if (matchButton) {
    const matchId = matchButton.dataset.matchId;
    if (matchId && appState.data) {
      appState.loading = true;
      navigateTo("match");
      render();
      loadMatchData(appState.data.apiBaseUrl, matchId)
        .then((match) => {
          if (appState.data) {
            appState.data.featuredMatch = match;
            appState.data.notice = null;
          }
        })
        .catch(() => {
          if (appState.data) {
            appState.data.notice = `match ${matchId} 暂无真实详情或尚未入库。`;
          }
        })
        .finally(() => {
          appState.loading = false;
          render();
        });
    }
    return;
  }

  if (profilePlayerButton) {
    const playerId = profilePlayerButton.dataset.profilePlayer;

    if (playerId) {
      navigateTo("player", { profileId: playerId });
    }
    return;
  }

  if (profileTeamButton) {
    const teamId = profileTeamButton.dataset.profileTeam;

    if (teamId) {
      navigateTo("team", { profileId: teamId });
    }
    return;
  }

  if (playerSortButton) {
    const sortKey = playerSortButton.dataset.playerSort;
    if (isPlayerSortKey(sortKey)) {
      if (appState.playerSortKey === sortKey) {
        appState.playerSortDirection = appState.playerSortDirection === "desc" ? "asc" : "desc";
      } else {
        appState.playerSortKey = sortKey;
        appState.playerSortDirection =
          playerSortOptions.find((option) => option.key === sortKey)?.defaultDirection ?? "desc";
      }
      render();
    }
    return;
  }

  if (retryProfileButton) {
    const profileType = retryProfileButton.dataset.retryProfile;
    const profileId = retryProfileButton.dataset.profileId;

    if (profileType && profileId) {
      delete appState.profileErrors[`${profileType}:${profileId}`];
      if (profileType === "player") {
        void ensurePlayerProfileLoaded(profileId);
      } else if (profileType === "team") {
        void ensureTeamProfileLoaded(profileId);
      }
      render();
    }
    return;
  }

  if (routeButton) {
    const nextRoute = routeButton.dataset.route;
    if (isRoute(nextRoute)) {
      navigateTo(nextRoute);
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

root.addEventListener("input", handleWardScrubberEvent);
root.addEventListener("change", handleWardScrubberEvent);
root.addEventListener("pointerdown", handleWardScrubberPointerDown);
root.addEventListener("pointermove", handleWardScrubberPointerMove);
root.addEventListener("mousedown", handleWardScrubberMouseDown);
root.addEventListener("touchstart", handleWardScrubberTouchStart, { passive: false });
root.addEventListener("touchmove", handleWardScrubberTouchMove, { passive: false });
window.addEventListener("pointerup", handleWardScrubberPointerEnd);
window.addEventListener("pointercancel", handleWardScrubberPointerEnd);
window.addEventListener("mousemove", handleWardScrubberMouseMove);
window.addEventListener("mouseup", handleWardScrubberMouseEnd);
window.addEventListener("touchend", handleWardScrubberTouchEnd);
window.addEventListener("touchcancel", handleWardScrubberTouchEnd);
window.addEventListener("scroll", handleWardScrubberScroll, { passive: true });
window.addEventListener("scroll", handleFloatingNavScroll, { passive: true });

function handleWardScrubberEvent(event: Event): void {
  const target = event.target instanceof HTMLElement ? event.target : null;

  if (target?.matches("[data-ward-scrubber]")) {
    if (target === activeWardScrubber || performance.now() < wardScrubberSuppressNativeEventsUntil) {
      event.preventDefault();
      return;
    }

    const seconds = Number(target.dataset.value);

    if (Number.isFinite(seconds)) {
      setWardScrubberSecond(target, seconds);
    }
  }
}

function handleWardScrubberPointerDown(event: PointerEvent): void {
  const scrubber = getWardScrubber(event.target);

  if (!scrubber) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  activeWardPointerId = event.pointerId;
  startWardScrubberDrag(scrubber);
  updateWardScrubberFromClientX(scrubber, event.clientX);
  scrubber.setPointerCapture(event.pointerId);
}

function handleWardScrubberPointerMove(event: PointerEvent): void {
  if (!activeWardScrubber || activeWardPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  extendWardScrubberScrollLock();
  updateWardScrubberFromClientX(activeWardScrubber, event.clientX);
  keepWardScrubberScrollLocked();
}

function handleWardScrubberMouseDown(event: MouseEvent): void {
  if (window.PointerEvent) {
    return;
  }

  const scrubber = getWardScrubber(event.target);

  if (scrubber) {
    event.preventDefault();
    event.stopPropagation();
    startWardScrubberDrag(scrubber);
    updateWardScrubberFromClientX(scrubber, event.clientX);
  }
}

function handleWardScrubberMouseMove(event: MouseEvent): void {
  if (window.PointerEvent) {
    return;
  }

  if (!activeWardScrubber || event.buttons === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  extendWardScrubberScrollLock();
  updateWardScrubberFromClientX(activeWardScrubber, event.clientX);
  keepWardScrubberScrollLocked();
}

function handleWardScrubberTouchStart(event: TouchEvent): void {
  if (window.PointerEvent) {
    return;
  }

  const scrubber = getWardScrubber(event.target);
  const touch = event.touches[0];

  if (scrubber) {
    event.preventDefault();
    event.stopPropagation();
    startWardScrubberDrag(scrubber);

    if (touch) {
      updateWardScrubberFromClientX(scrubber, touch.clientX);
    }
  }
}

function handleWardScrubberPointerEnd(event: PointerEvent): void {
  if (!activeWardScrubber || activeWardPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (activeWardScrubber.hasPointerCapture(event.pointerId)) {
    activeWardScrubber.releasePointerCapture(event.pointerId);
  }

  finishWardScrubberDrag();
}

function handleWardScrubberMouseEnd(event: MouseEvent): void {
  if (window.PointerEvent) {
    return;
  }

  if (activeWardScrubber) {
    event.preventDefault();
    event.stopPropagation();
    finishWardScrubberDrag();
  }
}

function handleWardScrubberTouchMove(event: TouchEvent): void {
  if (window.PointerEvent) {
    return;
  }

  if (!activeWardScrubber && !getWardScrubber(event.target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const touch = event.touches[0];

  if (activeWardScrubber && touch) {
    extendWardScrubberScrollLock();
    updateWardScrubberFromClientX(activeWardScrubber, touch.clientX);
  }
  keepWardScrubberScrollLocked();

}

function handleWardScrubberTouchEnd(event: TouchEvent): void {
  if (window.PointerEvent) {
    return;
  }

  if (activeWardScrubber) {
    event.preventDefault();
    event.stopPropagation();
    finishWardScrubberDrag();
  }
}

function startWardScrubberDrag(scrubber: HTMLElement): void {
  if (activeWardScrubber === scrubber) {
    return;
  }

  activeWardScrubber = scrubber;
  wardScrubberScrollY = window.scrollY;
  wardScrubberScrollLockUntil = performance.now() + 650;
}

function updateWardScrubberFromClientX(scrubber: HTMLElement, clientX: number): void {
  const bounds = scrubber.getBoundingClientRect();

  if (bounds.width <= 0) {
    return;
  }

  const min = scrubberNumber(scrubber, "min", 0);
  const max = scrubberNumber(scrubber, "max", min);
  const rawStep = scrubberNumber(scrubber, "step", 1);
  const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 1;
  const ratio = clampNumber((clientX - bounds.left) / bounds.width, 0, 1);
  const rawValue = min + ratio * (max - min);
  const steppedValue = min + Math.round((rawValue - min) / step) * step;

  setWardScrubberSecond(scrubber, steppedValue);
}

function setWardScrubberSecond(scrubber: HTMLElement, seconds: number): void {
  const matchId = scrubber.dataset.matchId;

  if (!matchId || !Number.isFinite(seconds)) {
    return;
  }

  const min = scrubberNumber(scrubber, "min", 0);
  const max = scrubberNumber(scrubber, "max", min);
  const selectedSecond = Math.round(clampNumber(seconds, min, max));
  const selectedSecondText = String(selectedSecond);

  if (appState.wardScrubberSeconds[matchId] === selectedSecond && scrubber.dataset.visionSecond === selectedSecondText) {
    scrubber.dataset.value = selectedSecondText;
    updateWardScrubberProgress(scrubber, selectedSecond);

    return;
  }

  scrubber.dataset.value = selectedSecondText;
  updateWardScrubberProgress(scrubber, selectedSecond);
  appState.wardScrubberSeconds[matchId] = selectedSecond;
  updateWardTimelineView(scrubber, selectedSecond);
  scrubber.dataset.visionSecond = selectedSecondText;
}

function finishWardScrubberDrag(): void {
  const lockedScrollY = wardScrubberScrollY;

  activeWardScrubber = null;
  activeWardPointerId = null;
  wardScrubberScrollLockUntil = performance.now() + 420;
  wardScrubberSuppressNativeEventsUntil = performance.now() + 520;

  if (lockedScrollY !== null) {
    keepWardScrubberScrollLocked(lockedScrollY);
  }

  window.setTimeout(() => {
    if (performance.now() >= wardScrubberScrollLockUntil) {
      wardScrubberScrollY = null;
    }
  }, 460);
}

function getWardScrubber(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const scrubber = target.closest<HTMLElement>("[data-ward-scrubber]");
  return scrubber instanceof HTMLElement ? scrubber : null;
}

function handleWardScrubberScroll(): void {
  if (wardScrubberScrollY === null || performance.now() >= wardScrubberScrollLockUntil) {
    return;
  }

  requestAnimationFrame(() => keepWardScrubberScrollLocked());
}

function handleFloatingNavScroll(): void {
  if (floatingNavScrollTicking) {
    return;
  }

  floatingNavScrollTicking = true;
  requestAnimationFrame(() => {
    const nextScrollY = Math.max(0, window.scrollY);
    const delta = nextScrollY - lastFloatingNavScrollY;

    if (nextScrollY < 24 || delta < -8) {
      setFloatingNavHidden(false);
    } else if (delta > 10 && nextScrollY > 80) {
      setFloatingNavHidden(true);
    }

    lastFloatingNavScrollY = nextScrollY;
    floatingNavScrollTicking = false;
  });
}

function setFloatingNavHidden(hidden: boolean): void {
  if (appState.floatingNavHidden === hidden) {
    return;
  }

  appState.floatingNavHidden = hidden;
  root?.querySelector<HTMLElement>(".floating-route-nav")?.classList.toggle("hidden", hidden);
}

function extendWardScrubberScrollLock(): void {
  wardScrubberScrollLockUntil = Math.max(wardScrubberScrollLockUntil, performance.now() + 180);
}

function keepWardScrubberScrollLocked(forcedScrollY = wardScrubberScrollY): void {
  if (forcedScrollY === null || Math.abs(window.scrollY - forcedScrollY) <= 1) {
    return;
  }

  window.scrollTo({ top: forcedScrollY, behavior: "auto" });
}

function updateWardScrubberProgress(scrubber: HTMLElement, selectedSecond: number): void {
  const min = scrubberNumber(scrubber, "min", 0);
  const max = scrubberNumber(scrubber, "max", min);
  const progress = max > min ? ((selectedSecond - min) / (max - min)) * 100 : 0;

  scrubber.style.setProperty("--ward-progress", `${clampNumber(progress, 0, 100).toFixed(2)}%`);
  scrubber.setAttribute("aria-valuenow", String(selectedSecond));
  scrubber.setAttribute("aria-valuetext", formatWardClock(selectedSecond));
}

function scrubberNumber(scrubber: HTMLElement, key: "min" | "max" | "step", fallback: number): number {
  const value = Number(scrubber.dataset[key]);
  return Number.isFinite(value) ? value : fallback;
}

function updateWardTimelineView(range: HTMLElement, selectedSecond: number): void {
  const timeline = range.closest<HTMLElement>("[data-vision-timeline]");

  if (!timeline) {
    return;
  }

  let radiantCount = 0;
  let direCount = 0;

  timeline.querySelectorAll<HTMLElement>("[data-ward-marker]").forEach((marker) => {
    const start = Number(marker.dataset.start);
    const end = Number(marker.dataset.end);
    const active = Number.isFinite(start) && Number.isFinite(end) && start <= selectedSecond && selectedSecond <= end;
    const activeText = active ? "true" : "false";

    if (marker.dataset.active !== activeText) {
      marker.dataset.active = activeText;
      marker.classList.toggle("active", active);
    }

    if (active && marker.dataset.side === "radiant") {
      radiantCount += 1;
    }

    if (active && marker.dataset.side === "dire") {
      direCount += 1;
    }
  });

  const totalCount = radiantCount + direCount;
  const radiantCounter = timeline.querySelector<HTMLElement>("[data-vision-radiant-count]");
  const direCounter = timeline.querySelector<HTMLElement>("[data-vision-dire-count]");
  const clock = timeline.querySelector<HTMLElement>("[data-vision-clock]");
  const totalCounter = timeline.querySelector<HTMLElement>("[data-vision-total-count]");

  if (radiantCounter) {
    radiantCounter.textContent = `天辉 ${radiantCount}`;
  }

  if (direCounter) {
    direCounter.textContent = `夜魇 ${direCount}`;
  }

  if (clock) {
    clock.textContent = formatWardClock(selectedSecond);
  }

  if (totalCounter) {
    totalCounter.textContent = `${totalCount} 个有效眼位`;
  }
}

function render(): void {
  document.title = `MRJZ H5 - ${routeLabel(appState.route)}`;
  const isHome = appState.route === "home";

  root!.innerHTML = `
    <div class="app-shell ${isHome ? "route-home" : "route-secondary"}">
      ${renderAppBar()}
      <main class="view" aria-live="polite">
        ${renderCurrentRoute()}
      </main>
      ${isHome ? "" : renderFloatingRouteNav()}
      ${isHome ? "" : `<button class="back-top" type="button" data-top aria-label="回到顶部">↑</button>`}
    </div>
  `;
}

function navigateTo(route: AppRoute, options: { replace?: boolean; scroll?: boolean; profileId?: string } = {}): void {
  const nextProfileId = options.profileId ?? (route === "player" || route === "team" ? appState.profileId : null);
  const nextHash = route === "player" || route === "team" ? `#${route}/${encodeURIComponent(nextProfileId ?? "")}` : `#${route}`;

  if (route === appState.route) {
    appState.profileId = nextProfileId;
    appState.floatingNavHidden = false;
    if (options.replace) {
      window.history.replaceState(null, "", nextHash);
    } else if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
    render();
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  if (!options.replace) {
    appState.routeHistory.push(appState.route);
  }

  appState.route = route;
  appState.profileId = nextProfileId;
  appState.floatingNavHidden = false;

  if (options.replace) {
    window.history.replaceState(null, "", nextHash);
  } else {
    window.history.pushState(null, "", nextHash);
  }

  render();

  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goBack(): void {
  const previousRoute = appState.routeHistory.pop();

  if (previousRoute) {
    navigateTo(previousRoute, { replace: true });
    return;
  }

  if (appState.route === "player") {
    navigateTo("players", { replace: true });
    return;
  }

  if (appState.route === "team") {
    navigateTo("teams", { replace: true });
    return;
  }

  if (appState.route !== "home") {
    navigateTo("home", { replace: true });
  }
}

async function refreshData(tournamentId = appState.selectedTournamentId ?? undefined): Promise<void> {
  try {
    appState.data = await loadMobileData(tournamentId);
    appState.selectedTournamentId = appState.data.selectedTournamentId;
    appState.playerProfiles = {};
    appState.teamProfiles = {};
    appState.profileLoading = {};
    appState.profileErrors = {};
  } catch (error) {
    console.error(error);
  } finally {
    appState.loading = false;
    render();
  }
}

function renderCurrentRoute(): string {
  switch (appState.route) {
    case "home":
      return renderHome();
    case "stage":
      return renderStagePage();
    case "schedule":
      return renderSchedulePage();
    case "records":
      return renderRecordsPage();
    case "match":
      return renderMatchDetail(currentData().featuredMatch);
    case "players":
      return renderPlayersPage();
    case "teams":
      return renderTeamsPage();
    case "player":
      return renderPlayerProfilePage();
    case "team":
      return renderTeamProfilePage();
  }
}

function renderAppBar(): string {
  return `
    <header class="app-bar">
      <div class="title-line top-only">
        <button class="icon-button" type="button" data-back aria-label="返回上一页">‹</button>
      </div>
    </header>
  `;
}

function renderFloatingRouteNav(): string {
  const navRoute = activePrimaryNavRoute(appState.route);

  return `
    <nav class="floating-route-nav ${appState.floatingNavHidden ? "hidden" : ""}" aria-label="主导航">
      <div class="route-tabs">
        ${primaryNavRoutes
          .map(
            (route) => `
              <button
                class="route-tab ${route.key === navRoute ? "active" : ""}"
                type="button"
                data-route="${route.key}"
              >
                ${escapeHtml(route.label)}
              </button>
            `,
          )
          .join("")}
      </div>
    </nav>
  `;
}

function activePrimaryNavRoute(route: AppRoute): AppRoute {
  if (route === "player") {
    return "players";
  }

  if (route === "team") {
    return "teams";
  }

  return route;
}

function renderHome(): string {
  const data = currentData();

  return `
    ${renderDataNotice()}
    <section class="section-panel tournament-gateway">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">MRJZ Dota 2 Community</p>
          <h2>选择赛事</h2>
        </div>
        <span class="sync-pill">${escapeHtml(data.tournamentOptions.length)} 届</span>
      </div>
      <p class="gateway-lead">先选定要查看的届数，再进入阶段、赛程、比赛记录、选手和队伍数据。</p>
      <div class="tournament-entry-list">
        ${data.tournamentOptions.length > 0 ? data.tournamentOptions.map((option) => renderTournamentEntry(option, data.tournamentRecentRecords[option.id] ?? [])).join("") : renderEmptyState("暂无可查看赛事")}
      </div>
    </section>
  `;
}

function renderTournamentScope(): string {
  const data = currentData();
  const meta = data.selectedTournamentMeta;

  return `
    <section class="tournament-scope">
      <div>
        <p class="eyebrow">当前赛事</p>
        <b>${escapeHtml(data.selectedTournamentName)}</b>
        <span>League ${escapeHtml(meta.leagueId)} · ${escapeHtml(meta.statusText)}</span>
      </div>
      <button class="link-button" type="button" data-route="home">切换</button>
    </section>
  `;
}

function renderStagePage(): string {
  const currentStage = currentData().stageViews[appState.stage];
  const stageMatches = currentData().scheduleGroups
    .flatMap((group) => group.matches)
    .filter((match) => match.stage === currentStage.name);

  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
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
        ${currentStage.standings.length > 0 ? currentStage.standings.map(renderStandingRow).join("") : renderEmptyState("该阶段暂无后端积分榜")}
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
      <div class="schedule-list">
        ${stageMatches.length > 0 ? stageMatches.slice(0, 6).map(renderScheduleCard).join("") : renderEmptyState("暂无管理员录入的真实轮次赛程")}
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Bracket</p>
          <h2>淘汰赛缩略图</h2>
        </div>
        <span class="tiny-meta">真实节点</span>
      </div>
      ${currentStage.bracket.length > 0 ? renderStageBracketPreview(currentStage.bracket) : renderEmptyState("暂无管理员录入的真实淘汰赛节点")}
    </section>
  `;
}

function renderStageBracketPreview(nodes: StageView["bracket"]): string {
  const grouped = new Map<string, StageView["bracket"]>();

  for (const node of nodes) {
    grouped.set(node.roundName, [...(grouped.get(node.roundName) ?? []), node]);
  }

  return `
    <div class="bracket-mini-board">
      ${[...grouped.entries()]
        .map(
          ([roundName, roundNodes]) => `
            <div class="bracket-column">
              <strong>${escapeHtml(roundName)}</strong>
              ${roundNodes.map(renderStageBracketNode).join("")}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderStageBracketNode(node: StageView["bracket"][number]): string {
  return `
    <article class="bracket-node">
      <span>${escapeHtml(node.groupName)} · #${escapeHtml(node.position)}</span>
      <b>${escapeHtml(node.topTeam)}</b>
      <b>${escapeHtml(node.bottomTeam)}</b>
      <small>${escapeHtml(node.winner === "待定" ? node.status : `胜者 ${node.winner}`)}</small>
    </article>
  `;
}

function renderSchedulePage(): string {
  const groups = currentData().scheduleGroups;
  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
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
    ${groups
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

function renderRecordsPage(): string {
  const records = currentData().matchRecords;

  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">OpenDota Archive</p>
          <h2>比赛记录</h2>
        </div>
        <span class="sync-pill">${records.length} 场</span>
      </div>
      <div class="filter-row">
        <span class="filter active">全部</span>
        <span class="filter">已解析</span>
        <span class="filter">BP</span>
        <span class="filter">眼位</span>
        <span class="filter">聊天</span>
      </div>
    </section>
    <section class="records-list">
      ${records.length > 0 ? records.map(renderMatchRecordCard).join("") : renderEmptyState("暂无已同步比赛记录")}
    </section>
  `;
}

function renderMatchDetail(match: MatchData): string {
  const mvp = match.players.find((player) => player.id === match.mvpPlayerId);
  const radiantPlayers = match.players.filter((player) => player.side === "radiant");
  const direPlayers = match.players.filter((player) => player.side === "dire");

  return `
    ${renderDataNotice()}
    ${renderMatchSummary(match)}
    ${mvp ? renderMvpCard(mvp, match) : ""}
    ${renderMatchQuickStats(match)}

    <section class="section-panel player-section">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Players</p>
          <h2>双方数据</h2>
        </div>
        <span class="tiny-meta">装备 / 技能 / KDA</span>
      </div>
      ${renderTeamPanel("radiant", radiantPlayers, match)}
      ${renderTeamPanel("dire", direPlayers, match)}
    </section>

    ${match.draft.length > 0 ? renderDraftSection(match) : ""}

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Vision</p>
          <h2>视野地图</h2>
        </div>
        <span class="tiny-meta">${match.wardTimeline.length} 条</span>
      </div>
      ${match.wardTimeline.length > 0 ? renderWardTimeline(match) : renderEmptyState("该比赛暂无眼位时间轴")}
    </section>

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Trend</p>
          <h2>战况趋势</h2>
        </div>
        <span class="status-tag ${match.trends.hasTrends ? "green" : ""}">
          ${match.trends.hasTrends ? "真实曲线" : "暂无数据"}
        </span>
      </div>
      ${renderTrendSection(match)}
    </section>

    <section class="section-panel chat-section">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Chat</p>
          <h2>聊天记录</h2>
        </div>
        <span class="tiny-meta">公开聊天</span>
      </div>
      <div class="chat-list">
        ${match.chat.length > 0 ? match.chat.map(renderChatLine).join("") : renderEmptyState("该比赛暂无公开聊天")}
      </div>
    </section>
  `;
}

function renderMatchQuickStats(match: MatchData): string {
  const radiantKills = match.players
    .filter((player) => player.side === "radiant")
    .reduce((sum, player) => sum + player.kills, 0);
  const direKills = match.players
    .filter((player) => player.side === "dire")
    .reduce((sum, player) => sum + player.kills, 0);

  return `
    <section class="match-ribbon">
      <span class="match-ribbon-stat duration"><b>${escapeHtml(match.duration)}</b>时长</span>
      <span class="match-ribbon-stat kill-score">
        <small>击杀</small>
        <b>
          <i class="radiant-score">${radiantKills}</i>
          <em>:</em>
          <i class="dire-score">${direKills}</i>
        </b>
      </span>
    </section>
  `;
}

function renderPlayersPage(): string {
  const data = currentData();
  const topPlayers = sortTournamentPlayers(data.players);
  const error = appState.profileErrors.players;

  if (topPlayers.length === 0) {
    void ensurePlayersLoaded();
  }

  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
    <section class="section-panel player-board-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Players</p>
          <h2>选手数据榜</h2>
        </div>
        <span class="sync-pill">${topPlayers.length} 名</span>
      </div>
      ${renderPlayerSortBar()}
      <div class="player-stat-list">
        ${
          topPlayers.length > 0
            ? topPlayers.map(renderPlayerDirectoryCard).join("")
            : renderEmptyState(error ?? (appState.profileLoading.players ? "正在读取选手数据" : "暂无选手数据"))
        }
      </div>
    </section>
  `;
}

function renderTeamsPage(): string {
  const data = currentData();
  const topTeams = [...data.teams].sort((left, right) => right.stats.seriesPlayed - left.stats.seriesPlayed);
  const error = appState.profileErrors.teams;

  if (topTeams.length === 0) {
    void ensureTeamsLoaded();
  }

  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Teams</p>
          <h2>队伍主页</h2>
        </div>
        <span class="sync-pill">${topTeams.length} 支</span>
      </div>
      <div class="profile-card-list">
        ${
          topTeams.length > 0
            ? topTeams.map(renderTeamDirectoryCard).join("")
            : renderEmptyState(error ?? (appState.profileLoading.teams ? "正在读取队伍数据" : "暂无队伍数据"))
        }
      </div>
    </section>
  `;
}

function renderPlayerDirectoryCard(player: MobileData["players"][number]): string {
  const team = player.currentTeam ?? player.teams[0] ?? null;
  const heroStrip = renderPlayerHeroStrip(player.stats.topHeroes);
  const winRateValue = Math.max(0, Math.min(100, numericStatValue(player, "winRate") ?? 0));

  return `
    <article class="player-stat-card" style="--accent:${escapeHtml(team?.color ?? "#5eead4")}">
      <button class="player-stat-card-main" type="button" data-profile-player="${escapeHtml(player.id)}">
        <div class="player-stat-head">
          ${renderSteamAvatar(player)}
          <div class="player-stat-identity">
            <div class="player-stat-name-row">
              <b>${escapeHtml(player.displayName)}</b>
              ${renderPlayerTeamBadge(team)}
            </div>
            <small>
              <span class="profile-id-link">ID ${escapeHtml(player.accountId ?? player.id)}</span>
              <span>${player.stats.wins}W / ${player.stats.losses}L</span>
            </small>
          </div>
          <div class="player-stat-primary">
            <span>胜率 <b>${escapeHtml(player.stats.winRate)}</b></span>
            <i style="--rate:${winRateValue}%"></i>
            <strong>${escapeHtml(player.stats.kda)}</strong>
            <em>KDA</em>
          </div>
        </div>
        <div class="player-stat-grid">
          ${renderPlayerStatTile("场次", String(player.stats.totalMatches))}
          ${renderPlayerStatTile("GPM", player.stats.avgGpm)}
          ${renderPlayerStatTile("XPM", player.stats.avgXpm)}
          ${renderPlayerStatTile("击/亡/助", `${player.stats.avgKills}/${player.stats.avgDeaths}/${player.stats.avgAssists}`)}
          ${renderPlayerStatTile("场均经济", player.stats.avgNetWorth)}
          ${renderPlayerStatTile("英雄伤害", player.stats.avgHeroDamage)}
          ${renderPlayerStatTile("建筑伤害", player.stats.avgTowerDamage)}
          ${renderPlayerStatTile("承伤", player.stats.avgDamageTaken)}
        </div>
        ${heroStrip}
      </button>
    </article>
  `;
}

function renderPlayerSortBar(): string {
  const activeOption =
    playerSortOptions.find((option) => option.key === appState.playerSortKey) ?? playerSortOptions[0]!;

  return `
    <div class="player-sort-meta">
      <span>排序</span>
      <b>${escapeHtml(activeOption.label)} ${appState.playerSortDirection === "desc" ? "↓" : "↑"}</b>
    </div>
    <div class="player-sort-bar" role="toolbar" aria-label="选手排序">
      ${playerSortOptions
        .map((option) => {
          const active = option.key === appState.playerSortKey;
          const direction = active ? appState.playerSortDirection : option.defaultDirection;

          return `
            <button
              class="${active ? "active" : ""}"
              type="button"
              data-player-sort="${option.key}"
              aria-pressed="${active ? "true" : "false"}"
            >
              ${escapeHtml(option.label)}
              <span>${direction === "desc" ? "↓" : "↑"}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPlayerTeamBadge(team: EntityTeamInfo | null): string {
  if (team === null) {
    return `<span class="team-mark empty">暂未归队</span>`;
  }

  return `
    <span
      class="team-mark"
      style="--team:${escapeHtml(team.color)}"
      title="所属战队：${escapeHtml(team.name)}"
      aria-label="所属战队：${escapeHtml(team.name)}"
    >
      ${escapeHtml(team.name)}
    </span>
  `;
}

function renderPlayerStatTile(label: string, value: string): string {
  return `
    <span>
      <small>${escapeHtml(label)}</small>
      <b>${escapeHtml(value)}</b>
    </span>
  `;
}

function renderPlayerHeroStrip(heroes: PlayerDirectoryItem["stats"]["topHeroes"]): string {
  if (heroes.length === 0) {
    return `<div class="player-hero-strip empty">暂无常用英雄</div>`;
  }

  return `
    <div class="player-hero-strip">
      ${heroes
        .slice(0, 3)
        .map(
          (hero) => `
            <span>
              <img src="${escapeHtml(hero.icon)}" alt="${escapeHtml(hero.hero)}" loading="lazy" onerror="this.onerror=null; this.src='${escapeHtml(hero.portrait)}';">
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSteamAvatar(player: Pick<PlayerDirectoryItem, "displayName" | "avatarUrl">, size: "normal" | "large" | "small" = "normal"): string {
  const className = `steam-avatar ${size}`;
  const fallback = `<span class="profile-avatar-fallback ${size === "large" ? "large" : ""}" aria-hidden="true">${escapeHtml(player.displayName.slice(0, 1).toUpperCase())}</span>`;

  if (player.avatarUrl) {
    return `
      <span class="steam-avatar-shell ${size}">
        <img class="${className}" src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.displayName)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('avatar-failed'); this.remove();">
        ${fallback}
      </span>
    `;
  }

  return fallback;
}

function renderTeamDirectoryCard(team: MobileData["teams"][number]): string {
  return `
    <article class="profile-list-card team-card" style="--accent:${escapeHtml(team.color)}">
      <button type="button" data-profile-team="${escapeHtml(team.id)}">
        <span class="profile-avatar-fallback team">${escapeHtml(team.shortName.slice(0, 2).toUpperCase())}</span>
        <div>
          <b>${escapeHtml(team.name)}</b>
          <small>${team.memberCount} 名成员 · ${team.stats.seriesPlayed} 场 · 胜率 ${escapeHtml(team.stats.winRate)}</small>
          <span>${team.stats.gameWins} 胜 / ${team.stats.gameLosses} 负 · 入库 ${team.stats.linkedMatches} 场</span>
        </div>
        <strong>进入</strong>
      </button>
    </article>
  `;
}

function renderPlayerProfilePage(): string {
  const data = currentData();
  const playerId = appState.profileId ?? data.players[0]?.id ?? null;

  if (playerId === null) {
    return renderEmptyState("暂无选手数据");
  }

  const profile = appState.playerProfiles[playerId];
  const error = appState.profileErrors[`player:${playerId}`];

  if (error) {
    return renderProfileError("选手主页读取失败", error, "player", playerId);
  }

  if (!profile) {
    void ensurePlayerProfileLoaded(playerId);
    return renderProfileLoading("正在读取选手主页");
  }

  const team = profile.currentTeam ?? profile.teams[0] ?? null;

  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
    <section class="profile-hero player-profile" style="--accent:${escapeHtml(team?.color ?? "#5eead4")}">
      <div class="profile-hero-main">
        ${renderSteamAvatar(profile, "large")}
        <div>
          <p class="eyebrow">Player Profile</p>
          <div class="profile-name-row">
            <h2>${escapeHtml(profile.displayName)}</h2>
            ${renderPlayerTeamBadge(team)}
          </div>
          <p>${escapeHtml(team?.name ?? "暂未归队")} · Account ${escapeHtml(profile.accountId ?? "-")}</p>
        </div>
      </div>
      <div class="profile-winrate">
        <span>本届胜率</span>
        <b>${escapeHtml(profile.stats.winRate)}</b>
        <small>${profile.stats.wins}W / ${profile.stats.losses}L</small>
      </div>
    </section>

    ${renderProfileStatGrid([
      ["场次", String(profile.stats.totalMatches)],
      ["胜率", profile.stats.winRate],
      ["KDA", profile.stats.kda],
      ["场均K/D/A", `${profile.stats.avgKills}/${profile.stats.avgDeaths}/${profile.stats.avgAssists}`],
      ["GPM", profile.stats.avgGpm],
      ["XPM", profile.stats.avgXpm],
      ["场均经济", profile.stats.avgNetWorth],
      ["场均伤害", profile.stats.avgHeroDamage],
      ["建筑伤害", profile.stats.avgTowerDamage],
      ["场均承伤", profile.stats.avgDamageTaken],
    ])}

    ${renderSignatureHeroes(profile.stats.topHeroes)}
    ${renderProfileMatches(profile.matches, "参赛记录")}
    ${renderProfileTagsPlaceholder("player")}
  `;
}

function renderTeamProfilePage(): string {
  const data = currentData();
  const teamId = appState.profileId ?? data.teams[0]?.id ?? null;

  if (teamId === null) {
    return renderEmptyState("暂无队伍数据");
  }

  const profile = appState.teamProfiles[teamId];
  const error = appState.profileErrors[`team:${teamId}`];

  if (error) {
    return renderProfileError("队伍主页读取失败", error, "team", teamId);
  }

  if (!profile) {
    void ensureTeamProfileLoaded(teamId);
    return renderProfileLoading("正在读取队伍主页");
  }

  return `
    ${renderDataNotice()}
    ${renderTournamentScope()}
    <section class="profile-hero team-profile" style="--accent:${escapeHtml(profile.color)}">
      <div class="profile-hero-main">
        <span class="profile-avatar-fallback large team">${escapeHtml(profile.shortName.slice(0, 2).toUpperCase())}</span>
        <div>
          <p class="eyebrow">Team Profile</p>
          <h2>${escapeHtml(profile.name)}</h2>
          <p>${profile.memberCount} 名成员 · ${escapeHtml(profile.status)} · ${profile.stats.linkedMatches} 场真实比赛</p>
        </div>
      </div>
      <div class="profile-winrate">
        <span>本届胜率</span>
        <b>${escapeHtml(profile.stats.winRate)}</b>
        <small>${profile.stats.gameWins}W / ${profile.stats.gameLosses}L</small>
      </div>
    </section>

    ${renderProfileStatGrid([
      ["比赛", String(profile.stats.seriesPlayed)],
      ["胜场", String(profile.stats.seriesWins)],
      ["负场", String(profile.stats.seriesLosses)],
      ["成员", String(profile.memberCount)],
      ["入库比赛", String(profile.stats.linkedMatches)],
      ["状态", profile.status],
    ])}

    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Roster</p>
          <h2>成员名单</h2>
        </div>
      </div>
      <div class="roster-list">
        ${
          profile.members.length > 0
            ? profile.members
                .map(
                  (player) => `
                    <button type="button" data-profile-player="${escapeHtml(player.id)}">
                      ${renderSteamAvatar(player, "small")}
                      <b>${escapeHtml(player.displayName)}</b>
                      <span>ID ${escapeHtml(player.accountId ?? player.id)}</span>
                    </button>
                  `,
                )
                .join("")
            : renderEmptyState("暂无成员")
        }
      </div>
    </section>

    ${renderSignatureHeroes(profile.stats.topHeroes)}
    ${renderProfileMatches(profile.matches, "队伍比赛")}
    ${renderProfileTagsPlaceholder("team")}
  `;
}

function renderProfileLoading(text: string): string {
  return `
    <section class="section-panel profile-loading">
      <p class="eyebrow">Loading</p>
      <h2>${escapeHtml(text)}</h2>
    </section>
  `;
}

function renderProfileError(title: string, message: string, type: "player" | "team", profileId: string): string {
  return `
    <section class="section-panel profile-loading profile-error">
      <p class="eyebrow">Error</p>
      <h2>${escapeHtml(title)}</h2>
      <small>${escapeHtml(message)}</small>
      <button type="button" data-retry-profile="${type}" data-profile-id="${escapeHtml(profileId)}">再试一次</button>
    </section>
  `;
}

function renderProfileStatGrid(stats: Array<[string, string]>): string {
  return `
    <section class="profile-stat-grid">
      ${stats.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></article>`).join("")}
    </section>
  `;
}

function renderSignatureHeroes(heroes: Array<{ hero: string; portrait: string; picks: number; wins: number }>): string {
  return `
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Heroes</p>
          <h2>常用英雄</h2>
        </div>
      </div>
      <div class="signature-heroes">
        ${
          heroes.length > 0
            ? heroes
                .map(
                  (hero) => `
                    <article>
                      <img src="${escapeHtml(hero.portrait)}" alt="${escapeHtml(hero.hero)}" loading="lazy" onerror="${heroImageFallbackHandler()}">
                      <div>
                        <b>${escapeHtml(hero.hero)}</b>
                        <span>${hero.picks} 场 · ${hero.wins} 胜 · ${formatHeroWinRate(hero.wins, hero.picks)}</span>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : renderEmptyState("暂无英雄统计")
        }
      </div>
    </section>
  `;
}

function renderProfileMatches(matches: ProfileMatchSummary[], title: string): string {
  const recordsByMatchId = new Map(currentData().matchRecords.map((record) => [record.matchId, record]));

  return `
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Matches</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <span class="sync-pill">${matches.length} 场</span>
      </div>
      <div class="profile-record-list">
        ${
          matches.length > 0
            ? matches.map((match, index) => renderProfileMatchRecordCard(match, recordsByMatchId, index)).join("")
            : renderEmptyState("暂无比赛记录")
        }
      </div>
    </section>
  `;
}

function renderProfileMatchRecordCard(
  match: ProfileMatchSummary,
  recordsByMatchId: Map<string, MatchRecord>,
  index: number,
): string {
  return renderMatchRecordCard(recordsByMatchId.get(match.matchId) ?? profileMatchToRecord(match), index);
}

function profileMatchToRecord(match: ProfileMatchSummary): MatchRecord {
  const [radiantScore, direScore] = parseProfileScore(match.score);
  const radiantWin =
    match.side === null || match.result === "unknown"
      ? null
      : match.side === "radiant"
        ? match.result === "win"
        : match.result === "loss";

  return {
    matchId: match.matchId,
    leagueName: "",
    tournamentName: "",
    startTime: match.startTime,
    duration: match.duration,
    radiantTeamName: match.radiantTeamName,
    direTeamName: match.direTeamName,
    radiantScore,
    direScore,
    radiantWin,
    parseStatus: "比赛记录",
    playerCount: 0,
    heroLineups: { radiant: [], dire: [] },
    hasDraft: false,
    hasVision: false,
    hasChat: false,
  };
}

function parseProfileScore(score: string): [number | null, number | null] {
  const parts = score.split(":");
  const left = Number(parts[0]?.trim() ?? "");
  const right = Number(parts[1]?.trim() ?? "");

  return [Number.isFinite(left) ? left : null, Number.isFinite(right) ? right : null];
}

function renderProfileTagsPlaceholder(type: "player" | "team"): string {
  return `
    <section class="section-panel tag-entry">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Community Tags</p>
          <h2>${type === "player" ? "选手标签" : "队伍标签"}</h2>
        </div>
      </div>
      ${renderEmptyState("标签添加和点赞接口接入后，这里展示用户互动产生的标签云。")}
    </section>
  `;
}

function sortTournamentPlayers(players: PlayerDirectoryItem[]): PlayerDirectoryItem[] {
  return [...players].sort((left, right) => comparePlayers(left, right, appState.playerSortKey, appState.playerSortDirection));
}

function comparePlayers(
  left: PlayerDirectoryItem,
  right: PlayerDirectoryItem,
  key: PlayerSortKey,
  direction: SortDirection,
): number {
  if (key === "displayName") {
    const result = left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
    return direction === "asc" ? result : -result;
  }

  const leftValue = numericStatValue(left, key);
  const rightValue = numericStatValue(right, key);

  if (leftValue === null && rightValue === null) {
    return left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  const result = leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
  const normalized = direction === "asc" ? result : -result;

  return normalized || left.displayName.localeCompare(right.displayName, "zh-CN") || left.id.localeCompare(right.id);
}

function numericStatValue(player: PlayerDirectoryItem, key: PlayerSortKey): number | null {
  switch (key) {
    case "totalMatches":
      return player.stats.totalMatches;
    case "winRate":
      return parseStatNumber(player.stats.winRate);
    case "kda":
      return parseStatNumber(player.stats.kda);
    case "avgKills":
      return parseStatNumber(player.stats.avgKills);
    case "avgGpm":
      return parseStatNumber(player.stats.avgGpm);
    case "avgXpm":
      return parseStatNumber(player.stats.avgXpm);
    case "avgHeroDamage":
      return parseStatNumber(player.stats.avgHeroDamage);
    case "avgTowerDamage":
      return parseStatNumber(player.stats.avgTowerDamage);
    case "avgDamageTaken":
      return parseStatNumber(player.stats.avgDamageTaken);
    case "displayName":
      return null;
  }
}

function parseStatNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0 || normalized === "-") {
    return null;
  }

  const multiplier = normalized.endsWith("k") ? 1000 : 1;
  const parsed = Number.parseFloat(normalized.replace(/[%k,]/g, ""));

  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function formatHeroWinRate(wins: number, picks: number): string {
  if (picks <= 0) {
    return "-";
  }

  return `${Math.round((wins / picks) * 100)}%`;
}

function heroImageFallbackHandler(): string {
  return "this.onerror=null; this.src='/static/dota/heroes/unknown.svg';";
}

async function ensurePlayersLoaded(): Promise<void> {
  const data = appState.data;
  const key = "players";

  if (!data || data.players.length > 0 || appState.profileLoading[key]) {
    return;
  }

  appState.profileLoading[key] = true;
  delete appState.profileErrors[key];

  try {
    data.players = await loadTournamentPlayers(data.apiBaseUrl, data.selectedTournamentId);
  } catch (error) {
    console.error(error);
    appState.profileErrors[key] = "读取选手数据失败，请确认后端服务仍在运行。";
  } finally {
    delete appState.profileLoading[key];
    render();
  }
}

async function ensureTeamsLoaded(): Promise<void> {
  const data = appState.data;
  const key = "teams";

  if (!data || data.teams.length > 0 || appState.profileLoading[key]) {
    return;
  }

  appState.profileLoading[key] = true;
  delete appState.profileErrors[key];

  try {
    data.teams = await loadTournamentTeams(data.apiBaseUrl, data.selectedTournamentId);
  } catch (error) {
    console.error(error);
    appState.profileErrors[key] = "读取队伍数据失败，请确认后端服务仍在运行。";
  } finally {
    delete appState.profileLoading[key];
    render();
  }
}

async function ensurePlayerProfileLoaded(playerId: string): Promise<void> {
  const data = appState.data;
  const key = `player:${playerId}`;

  if (!data || appState.playerProfiles[playerId] || appState.profileLoading[key]) {
    return;
  }

  appState.profileLoading[key] = true;
  delete appState.profileErrors[key];

  try {
    appState.playerProfiles[playerId] = await loadPlayerProfile(data.apiBaseUrl, data.selectedTournamentId, playerId);
  } catch (error) {
    console.error(error);
    appState.profileErrors[key] = "这个选手主页暂时没有读到，请稍后重试或重新同步实体数据。";
  } finally {
    delete appState.profileLoading[key];
    render();
  }
}

async function ensureTeamProfileLoaded(teamId: string): Promise<void> {
  const data = appState.data;
  const key = `team:${teamId}`;

  if (!data || appState.teamProfiles[teamId] || appState.profileLoading[key]) {
    return;
  }

  appState.profileLoading[key] = true;
  delete appState.profileErrors[key];

  try {
    appState.teamProfiles[teamId] = await loadTeamProfile(data.apiBaseUrl, data.selectedTournamentId, teamId);
  } catch (error) {
    console.error(error);
    appState.profileErrors[key] = "这个队伍主页暂时没有读到，请稍后重试或重新同步实体数据。";
  } finally {
    delete appState.profileLoading[key];
    render();
  }
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

function renderTournamentEntry(option: MobileData["tournamentOptions"][number], records: MatchRecord[]): string {
  const active = currentData().selectedTournamentId === option.id;
  const latest = records[0];
  const score =
    latest === undefined || latest.radiantScore === null || latest.direScore === null
      ? "暂无赛果"
      : `${latest.radiantScore}:${latest.direScore}`;
  const latestText =
    latest === undefined
      ? "暂无比赛记录"
      : `${latest.radiantTeamName} ${score} ${latest.direTeamName}`;

  return `
    <article class="tournament-entry ${active ? "active" : ""}">
      <button class="tournament-entry-main" type="button" data-tournament="${escapeHtml(option.id)}" data-target-route="stage">
        <div>
          <p class="eyebrow">League ${escapeHtml(option.leagueId)}</p>
          <h3>${escapeHtml(option.name)}</h3>
          <span>${escapeHtml(lifecycleLabel(option.status))} · ${escapeHtml(option.startsAt)}</span>
        </div>
        <div class="tournament-entry-action">
          <strong>${active ? "当前" : "进入"}</strong>
          <span>${escapeHtml(latestText)}</span>
        </div>
      </button>
    </article>
  `;
}

function renderLifecycleStep(step: "upcoming" | "running" | "completed", label: string, activeStatus: string): string {
  const order = ["upcoming", "running", "completed"];
  const activeIndex = order.indexOf(activeStatus);
  const stepIndex = order.indexOf(step);
  const active = activeStatus === step;
  const done = activeIndex > stepIndex || activeStatus === "completed";

  return `<span class="${active ? "active" : done ? "done" : ""}">${escapeHtml(label)}</span>`;
}

function renderDataNotice(): string {
  const data = currentData();
  const loadingText = appState.loading ? "正在读取公开 API..." : "";
  const text = loadingText || data.notice;

  return text ? `<section class="api-notice">${escapeHtml(text)}</section>` : "";
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
  const matchAction = match.matchId
    ? `<button class="link-button" type="button" data-match-id="${escapeHtml(match.matchId)}">打开战报</button>`
    : `<small>等待后台确认</small>`;
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
        ${matchAction}
      </div>
    </article>
  `;
}

function renderMatchRecordCard(record: MatchRecord, index = 0): string {
  const score =
    record.radiantScore === null || record.direScore === null ? "- : -" : `${record.radiantScore} : ${record.direScore}`;
  const winnerClass = record.radiantWin === null ? "" : record.radiantWin ? "radiant-win" : "dire-win";
  const heroCount = record.heroLineups.radiant.length + record.heroLineups.dire.length;

  return `
    <article class="record-card ${winnerClass}" style="--record-delay:${Math.min(index * 28, 420)}ms">
      <button class="record-main" type="button" data-match-id="${escapeHtml(record.matchId)}">
        <div class="record-head">
          <span>#${escapeHtml(record.matchId)}</span>
          <b>${escapeHtml(record.startTime)}</b>
        </div>
        <div class="record-score">
          <span>${escapeHtml(record.radiantTeamName)}</span>
          <strong>${escapeHtml(score)}</strong>
          <span>${escapeHtml(record.direTeamName)}</span>
        </div>
        ${renderRecordHeroMatchup(record)}
        <div class="record-meta">
          <span>${escapeHtml(record.duration)}</span>
          <span>${escapeHtml(record.parseStatus)}</span>
          <span>${record.playerCount} 人</span>
        </div>
        <div class="record-flags">
          ${renderRecordFlag(`英雄 ${heroCount || "-"}`, heroCount > 0)}
          ${renderRecordFlag("BP", record.hasDraft)}
          ${renderRecordFlag("眼位", record.hasVision)}
          ${renderRecordFlag("聊天", record.hasChat)}
        </div>
      </button>
    </article>
  `;
}

function renderRecordHeroMatchup(record: MatchRecord): string {
  const hasLineup = record.heroLineups.radiant.length > 0 || record.heroLineups.dire.length > 0;

  if (!hasLineup) {
    return `
      <div class="record-lineup empty">
        <span>英雄阵容待同步</span>
      </div>
    `;
  }

  return `
    <div class="record-lineup" aria-label="双方英雄对阵">
      ${renderRecordHeroStrip("radiant", record.heroLineups.radiant)}
      <span class="record-versus" aria-hidden="true"><i></i><b>VS</b><i></i></span>
      ${renderRecordHeroStrip("dire", record.heroLineups.dire)}
    </div>
  `;
}

function renderRecordHeroStrip(side: TeamSide, heroes: MatchRecord["heroLineups"][TeamSide]): string {
  return `
    <span class="record-hero-strip ${side}">
      ${Array.from({ length: 5 }, (_, index) => renderRecordHero(side, heroes[index], index)).join("")}
    </span>
  `;
}

function renderRecordHero(side: TeamSide, hero: MatchRecord["heroLineups"][TeamSide][number] | undefined, index: number): string {
  if (hero === undefined) {
    return `<span class="record-hero empty" style="--hero-delay:${index * 30}ms"><i></i></span>`;
  }

  const title = `${side === "radiant" ? "天辉" : "夜魇"} · ${hero.playerName} · ${hero.hero}`;

  return `
    <span class="record-hero" style="--hero-delay:${index * 30}ms" title="${escapeHtml(title)}">
      <img src="${escapeHtml(hero.icon)}" alt="${escapeHtml(hero.hero)}" loading="lazy" onerror="this.onerror=null; this.src='${escapeHtml(hero.portrait)}';">
    </span>
  `;
}

function renderRecordFlag(label: string, active: boolean): string {
  return `<span class="${active ? "active" : ""}">${escapeHtml(label)}</span>`;
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

function renderMatchSummary(match: MatchData): string {
  const winner = match.winner === "radiant" ? match.radiant : match.dire;
  return `
    <section class="match-summary battle-summary">
      <div class="summary-meta">
        <span>比赛编号 ${escapeHtml(match.id)}</span>
        <span>${escapeHtml(match.endedAt)}</span>
      </div>
      <p class="victory-label">${escapeHtml(winner.name)} 胜利</p>
      <div class="scoreboard">
        <div class="team-side radiant">
          <span>${escapeHtml(match.radiant.seed)}</span>
          <b>${escapeHtml(match.radiant.name)}</b>
          <small>天辉</small>
        </div>
        <div class="score-core">
          <p>${escapeHtml(match.league)}</p>
          <strong>${match.radiantScore}<i>:</i>${match.direScore}</strong>
          <span>${escapeHtml(match.duration)} · ${escapeHtml(match.mode)}</span>
        </div>
        <div class="team-side dire">
          <span>${escapeHtml(match.dire.seed)}</span>
          <b>${escapeHtml(match.dire.name)}</b>
          <small>夜魇</small>
        </div>
      </div>
    </section>
  `;
}

function renderMvpCard(player: PlayerStats, match: MatchData): string {
  const team = getTeam(match, player.side);
  return `
    <section class="mvp-card ${player.side}">
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
      <div class="mvp-visual">
        <img class="mvp-portrait" src="${escapeHtml(player.portrait)}" alt="${escapeHtml(player.hero)}" onerror="${heroImageFallbackHandler()}" />
        <span>MVP</span>
      </div>
    </section>
  `;
}

function renderTeamPanel(side: TeamSide, players: PlayerStats[], match: MatchData): string {
  const team = getTeam(match, side);
  const kills = players.reduce((sum, player) => sum + player.kills, 0);
  const isWinner = match.winner === side;
  return `
    <div class="team-panel ${side}">
      <div class="team-panel-head">
        <div>
          <span>${side === "radiant" ? "天辉" : "夜魇"} ${isWinner ? "胜利" : "失败"}</span>
          <b>${escapeHtml(team.name)}</b>
        </div>
        <small>杀敌 ${kills}</small>
      </div>
      <div class="player-list">
        ${players.map((player) => renderPlayerRow(player, match.mvpPlayerId)).join("")}
      </div>
    </div>
  `;
}

function renderPlayerRow(player: PlayerStats, mvpPlayerId?: string): string {
  const expanded = appState.expandedPlayers.has(player.id);
  const abilitySteps = player.abilityOrder.filter((ability) => ability.kind === "ability");
  const isMvp = player.id === mvpPlayerId;

  return `
    <article class="player-row ${player.side} ${expanded ? "expanded" : ""} ${isMvp ? "mvp-player" : ""}" data-player="${escapeHtml(player.id)}" role="button" aria-expanded="${expanded ? "true" : "false"}" tabindex="0">
      <div class="player-main">
        ${isMvp ? `<span class="player-mvp-badge">MVP</span>` : ""}
        <span class="hero-avatar-shell">
          <img class="hero-avatar" src="${escapeHtml(player.portrait)}" alt="${escapeHtml(player.hero)}" onerror="${heroImageFallbackHandler()}" />
          <i>${player.level}</i>
        </span>
        <div class="player-id">
          <b>${escapeHtml(player.name)}</b>
          <span>${escapeHtml(player.hero)}</span>
          <div class="player-chips">
            <em>${escapeHtml(player.lane)}</em>
            <span class="player-mini-metrics">
              <small>参战 ${escapeHtml(player.participation)}</small>
              <small>伤害 ${escapeHtml(player.damageShare)}</small>
            </span>
          </div>
        </div>
        <div class="player-kda">
          <b>${player.kills}/${player.deaths}/${player.assists}</b>
          <span>KDA ${escapeHtml(kdaRatio(player))}</span>
        </div>
        ${renderPlayerLoadout(player)}
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
                ${abilitySteps.length > 0 ? abilitySteps.map((ability, index) => renderAbilityStep(ability, index)).join("") : renderEmptyState("暂无普通技能加点")}
              </div>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderPlayerLoadout(player: PlayerStats): string {
  const itemSlots = Array.from({ length: 6 }, (_, index) => player.items[index] ?? { label: "-", imageUrl: "" });
  const backpackSlots = Array.from(
    { length: 3 },
    (_, index) => player.backpackItems[index] ?? { label: "-", imageUrl: "" },
  );

  return `
    <div class="player-loadout">
      <div class="inventory-stack">
        <div class="inventory-grid" aria-label="六格物品栏">
          ${itemSlots.map((item, index) => renderItemSlot(item, index + 1)).join("")}
        </div>
        <div class="backpack-grid" aria-label="背包物品栏">
          ${backpackSlots.map((item) => renderItemSlot(item, "backpack")).join("")}
        </div>
      </div>
      ${renderItemSlot(player.neutralItem, "neutral")}
      <div class="agha-status-row">
        ${renderAghanimIcon("神杖", player.scepter)}
        ${renderAghanimIcon("魔精", player.shard)}
      </div>
      ${renderTalentTreeLegend(player)}
    </div>
  `;
}

function renderAbilityStep(ability: PlayerStats["abilityOrder"][number], index: number): string {
  const level = ability.level ?? index + 1;
  const kind = ability.kind ?? "ability";
  const image = ability.imageUrl
    ? `<img src="${escapeHtml(ability.imageUrl)}" alt="" loading="lazy" onerror="this.onerror=null; this.parentElement.classList.add('fallback'); this.remove();" />`
    : "";
  const fallback = image ? "" : renderAbilityFallbackGlyph(kind);

  return `<span class="ability-step ${kind} ${image ? "" : "fallback"}" title="${escapeHtml(`${level}. ${ability.label}`)}">${image}${fallback}<b>${level}</b></span>`;
}

function renderItemSlot(item: PlayerStats["items"][number], slot: number | "neutral" | "backpack"): string {
  const empty = item.label === "-" || item.label === "空";
  const image = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" onerror="this.onerror=null; this.parentElement.classList.add('empty'); this.remove();" />`
    : "";

  return `
    <span class="item-slot ${slot === "neutral" ? "neutral" : ""} ${slot === "backpack" ? "backpack" : ""} ${empty ? "empty" : ""}" title="${escapeHtml(item.label)}">
      ${image}
    </span>
  `;
}

function renderAdvancedMetric(label: string, value: string): string {
  return `
    <span>
      <small>${escapeHtml(label)}</small>
      <b>${escapeHtml(value)}</b>
    </span>
  `;
}

function renderAghanimIcon(label: string, state: AghanimState): string {
  const title = state === "owned" ? "已拥有" : state === "queued" ? "待购买" : "未购买";
  const type = label.includes("晶") || label.includes("精") ? "shard" : "scepter";
  const filename = `${type}${state === "owned" ? "On" : "Off"}.svg`;

  return `<img class="agha-icon ${type} ${state}" src="/static/svg/${filename}" alt="${escapeHtml(label)}" title="${escapeHtml(`${label} ${title}`)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden';" />`;
}

function kdaRatio(player: PlayerStats): string {
  if (player.deaths === 0) {
    return String(player.kills + player.assists);
  }

  return ((player.kills + player.assists) / player.deaths).toFixed(1);
}

function renderTalentTreeLegend(player: PlayerStats): string {
  const pickedCount = player.talentTree.filter((node) => node.picked).length;
  const title = pickedCount > 0 ? `天赋树 已选择 ${pickedCount}/8` : "天赋树 暂无可识别选择";

  return `
    <span class="talent-tree-mini" title="${escapeHtml(title)}">
      ${renderTalentTreeSvg(player)}
    </span>
  `;
}

function renderTalentTreeSvg(player: PlayerStats): string {
  const prefix = `talent-${String(player.id).replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`;
  const nodes = player.talentTree.length > 0 ? player.talentTree : defaultTalentTreeNodes();
  const inactiveBranches = nodes.filter((node) => !node.picked).map((node) => renderTalentBranchPath(node, prefix)).join("");
  const activeBranches = nodes.filter((node) => node.picked).map((node) => renderTalentBranchPath(node, prefix)).join("");
  const pickedCount = nodes.filter((node) => node.picked).length;

  return `
    <svg class="talent-tree-svg" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="${prefix}-copper-left" gradientUnits="userSpaceOnUse" x1="4.68" y1="3.66" x2="35.93" y2="57.79">
          <stop offset="0.0938" stop-color="rgb(231, 189, 118)"></stop>
          <stop offset="0.2261" stop-color="rgb(201, 108, 53)"></stop>
          <stop offset="0.4401" stop-color="rgb(207, 126, 65)"></stop>
          <stop offset="0.5891" stop-color="rgb(215, 148, 84)"></stop>
          <stop offset="0.7585" stop-color="rgb(229, 185, 114)"></stop>
          <stop offset="1" stop-color="rgb(242, 214, 139)"></stop>
        </linearGradient>
        <linearGradient id="${prefix}-copper-right" gradientUnits="userSpaceOnUse" x1="-7.88" y1="3.66" x2="23.37" y2="57.79" gradientTransform="matrix(-1 0 0 1 38.4375 0)">
          <stop offset="0.0938" stop-color="rgb(231, 189, 118)"></stop>
          <stop offset="0.2261" stop-color="rgb(201, 108, 53)"></stop>
          <stop offset="0.4401" stop-color="rgb(207, 126, 65)"></stop>
          <stop offset="0.5891" stop-color="rgb(215, 148, 84)"></stop>
          <stop offset="0.7585" stop-color="rgb(229, 185, 114)"></stop>
          <stop offset="1" stop-color="rgb(242, 214, 139)"></stop>
        </linearGradient>
        <linearGradient id="${prefix}-copper-dot" gradientUnits="userSpaceOnUse" x1="3" y1="22" x2="27" y2="31">
          <stop offset="0.1257" stop-color="rgb(231, 189, 118)"></stop>
          <stop offset="0.3335" stop-color="rgb(204, 117, 59)"></stop>
          <stop offset="0.8908" stop-color="rgb(201, 109, 52)"></stop>
          <stop offset="0.9891" stop-color="rgb(229, 185, 114)"></stop>
        </linearGradient>
      </defs>
      <svg viewBox="0 0 51 63" height="23" y="4.45" class="talent-branch-copy" preserveAspectRatio="xMidYMin meet">
        ${inactiveBranches}
        ${activeBranches}
      </svg>
      ${renderTalentTreeArc(prefix, pickedCount)}
    </svg>
  `;
}

function renderTalentBranchPath(node: PlayerStats["talentTree"][number], prefix: string): string {
  const path = talentBranchPath(node.tier, node.side);
  const title = `${node.tier === 1 ? "10" : node.tier === 2 ? "15" : node.tier === 3 ? "20" : "25"}级天赋${
    node.picked ? " 已选择" : ""
  }`;
  const fill = node.picked ? `url(#${prefix}-copper-${node.side})` : "hsl(0,0%,28%)";

  return `<path class="talent-branch ${node.picked ? "picked" : "off"}" fill="${fill}" d="${path}"><title>${escapeHtml(title)}</title></path>`;
}

function talentBranchPath(
  tier: PlayerStats["talentTree"][number]["tier"],
  side: PlayerStats["talentTree"][number]["side"],
): string {
  const paths: Record<string, string> = {
    "1-left":
      "M0.013,44.716c0,0,6.586,6.584,9.823,6.805c3.236,0.224,7.033,0,7.033,0s7.024,1.732,7.024,7.368V63 l3.195-0.014c0,0,0-3.782,0-5.571c0-6.857-10.053-7.567-10.053-7.567S11.957,41.979,0.013,44.716z",
    "1-right":
      "M51,44.716c0,0-6.586,6.584-9.823,6.805c-3.235,0.224-7.032,0-7.032,0s-7.024,1.732-7.024,7.368V63 l-3.195-0.014c0,0,0-3.782,0-5.571c0-6.857,10.052-7.567,10.052-7.567S39.057,41.979,51,44.716z",
    "2-left":
      "M0,30.326c0,0,5.744,9.07,9.516,9.495c3.1,0.348,6.542,0.107,8.122,0.262 c3.068,0.301,6.256,1.351,6.256,5.667V63h3.181c0,0,0-17.488,0-18.454c0-0.964-0.006-5.235-7.093-6.584 c-1.207-0.232-3.687-0.281-4.913-0.281C15.068,37.681,10.547,29.951,0,30.326z",
    "2-right":
      "M51,30.326c0,0-5.745,9.07-9.517,9.495c-3.1,0.348-6.542,0.107-8.12,0.262 c-3.069,0.301-6.257,1.351-6.257,5.667V63h-3.182c0,0,0-17.488,0-18.454c0-0.964,0.006-5.235,7.093-6.584 c1.208-0.232,3.688-0.281,4.913-0.281C35.931,37.681,40.451,29.951,51,30.326z",
    "3-left":
      "M4.031,16.042c0,0,0.669,3.435,2.899,6.315c2.232,2.878,4.147,4.891,6.489,4.891 c2.344,0,6.208-0.01,7.68,0.868c1.837,1.095,2.803,3.213,2.803,5.373c0,0.976,0,29.511,0,29.511h3.173V33.489 c0,0-0.085-3.859-3.102-6.426c-1.651-1.405-2.911-2.141-5.294-2.141c-0.908,0-2.041-0.019-2.041-0.019s-1.785-4.153-5.188-6.203 C8.046,16.651,4.031,16.042,4.031,16.042z",
    "3-right":
      "M46.969,16.042c0,0-0.669,3.435-2.898,6.315c-2.232,2.878-4.147,4.891-6.489,4.891 c-2.344,0-6.208-0.01-7.68,0.868c-1.837,1.095-2.803,3.213-2.803,5.373c0,0.976,0,29.511,0,29.511h-3.174V33.489 c0,0,0.086-3.859,3.103-6.426c1.651-1.405,2.911-2.141,5.295-2.141c0.907,0,2.041-0.019,2.041-0.019s1.785-4.153,5.187-6.203 C42.954,16.651,46.969,16.042,46.969,16.042z",
    "4-left":
      "M11.033,0c0,0-0.802,7.891,2.625,11.654c3.426,3.761,5.55,2.683,7.765,3.097 c1.969,0.369,2.479,1.772,2.479,3.984c0,2.212,0,44.209,0,44.209h3.101c0,0,0.072-43.305,0.072-44.209 c0-0.905-0.019-4.906-3.792-6.115c-1.592-0.509-2.334-0.376-2.918-2.293C19.782,8.408,17.96,1.99,11.033,0z",
    "4-right":
      "M39.967,0c0,0,0.803,7.891-2.625,11.654c-3.426,3.761-5.551,2.683-7.765,3.097 c-1.969,0.369-2.479,1.772-2.479,3.984c0,2.212,0,44.209,0,44.209h-3.101c0,0-0.073-43.305-0.073-44.209 c0-0.905,0.02-4.906,3.793-6.115c1.592-0.509,2.335-0.376,2.917-2.293C31.218,8.408,33.04,1.99,39.967,0z",
  };

  return paths[`${tier}-${side}`] ?? paths["1-left"]!;
}

function renderTalentTreeArc(prefix: string, pickedCount: number): string {
  const activeDots = Math.min(7, Math.max(0, pickedCount));
  const dots = [
    "M3.258 23.38c.295-.22.624-.303.992-.238.362.057.651.235.868.536.217.3.298.634.243 1.002-.05.376-.225.67-.52.891a1.24 1.24 0 01-1.002.244 1.275 1.275 0 01-.868-.535 1.315 1.315 0 01-.242-1.002c.05-.377.225-.671.529-.898z",
    "M6.244 26.987c.215-.301.503-.482.873-.534.361-.06.69.02.988.24.297.218.474.51.532.878.067.374-.012.708-.227 1.01-.221.31-.51.491-.88.544a1.263 1.263 0 01-.987-.24 1.302 1.302 0 01-.533-.879 1.291 1.291 0 01.234-1.019z",
    "M10.17 29.492c.114-.355.333-.617.669-.783a1.26 1.26 0 011.012-.082c.349.115.607.338.773.669.177.335.204.677.091 1.032a1.27 1.27 0 01-.671.793 1.26 1.26 0 01-1.012.082 1.284 1.284 0 01-.774-.669 1.294 1.294 0 01-.087-1.042z",
    "M14.684 30.638c0-.373.129-.69.398-.954.258-.264.57-.396.938-.396.366 0 .68.13.938.393.27.262.4.58.4.953.002.383-.127.701-.397.965a1.268 1.268 0 01-.937.396c-.367 0-.68-.13-.939-.393-.27-.263-.4-.58-.4-.964z",
    "M19.302 30.322a1.287 1.287 0 01.09-1.032c.165-.331.423-.555.771-.67a1.26 1.26 0 011.013.08c.336.166.556.428.67.782.116.365.09.708-.087 1.043a1.284 1.284 0 01-.772.67 1.26 1.26 0 01-1.013-.08 1.27 1.27 0 01-.672-.793z",
    "M23.614 28.564a1.284 1.284 0 01-.23-1.01c.058-.367.234-.66.53-.88.297-.219.626-.3.988-.241.37.051.659.231.874.532.223.31.302.645.236 1.019-.057.367-.234.66-.53.88-.297.219-.626.3-.988.241a1.252 1.252 0 01-.88-.541z",
    "M27.184 25.537a1.272 1.272 0 01-.523-.89 1.316 1.316 0 01.24-1.002c.215-.302.504-.48.866-.538.368-.067.697.015.993.234.305.226.481.52.531.896.057.368-.023.702-.239 1.003-.216.301-.505.48-.866.538a1.24 1.24 0 01-1.002-.241z",
  ];

  return `
    ${dots
      .map(
        (path, index) =>
          `<path class="talent-arc-dot ${index < activeDots ? "picked" : ""}" fill="${
            index < activeDots ? `url(#${prefix}-copper-dot)` : "hsla(0,0%,100%,0.12)"
          }" d="${path}"></path>`,
      )
      .join("")}
    <path class="talent-arc" d="M1.974 21.886a15.733 15.733 0 01-1.307-6.302C.667 6.983 7.537 0 16 0c8.463 0 15.333 6.983 15.333 15.584 0 2.226-.46 4.343-1.288 6.259a3.35 3.35 0 00-.942-.549 14.626 14.626 0 001.152-5.71c0-7.996-6.387-14.488-14.255-14.488-7.867 0-14.255 6.492-14.255 14.488 0 2.042.417 3.986 1.169 5.75a3.36 3.36 0 00-.94.552z"></path>
  `;
}

function defaultTalentTreeNodes(): PlayerStats["talentTree"] {
  return ([4, 3, 2, 1] as const).flatMap((tier) =>
    (["left", "right"] as const).map((side) => ({
      tier,
      side,
      picked: false,
      label: "天赋",
    })),
  );
}

function renderAbilityFallbackGlyph(kind: PlayerStats["abilityOrder"][number]["kind"]): string {
  if (kind === "attribute") {
    return `
      <svg class="ability-fallback-svg attribute-glyph" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12"></circle>
        <circle cx="16" cy="5" r="2"></circle>
        <circle cx="24" cy="9" r="2"></circle>
        <circle cx="27" cy="18" r="2"></circle>
        <circle cx="20" cy="26" r="2"></circle>
        <circle cx="10" cy="26" r="2"></circle>
        <circle cx="5" cy="17" r="2"></circle>
        <circle cx="8" cy="9" r="2"></circle>
      </svg>
    `;
  }

  return `
    <svg class="ability-fallback-svg talent-glyph" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 29V7"></path>
      <path d="M16 21C11 21 8 18 6 14"></path>
      <path d="M16 18c5 0 8-3 10-8"></path>
      <path d="M16 12c-3 0-5-2-6-6"></path>
      <path d="M16 10c3 0 5-2 6-6"></path>
      <circle cx="16" cy="7" r="2.2"></circle>
      <circle cx="6" cy="14" r="2"></circle>
      <circle cx="26" cy="10" r="2"></circle>
      <circle cx="16" cy="29" r="2"></circle>
    </svg>
  `;
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
        .map(renderDraftStep)
        .join("")}
    </div>
  `;
}

function renderDraftStep(step: DraftStep): string {
  const actionText = step.type === "Ban" ? "禁用" : "选择";
  const portrait = step.portrait ?? "/static/dota/heroes/unknown.svg";

  return `
    <div class="draft-step ${step.side} ${step.type.toLowerCase()}">
      <span class="draft-order">${step.order}</span>
      <article class="draft-card">
        <img class="draft-hero" src="${escapeHtml(portrait)}" alt="${escapeHtml(step.hero)}" loading="lazy" onerror="${heroImageFallbackHandler()}">
        <div class="draft-copy">
          <div>
            <b>${escapeHtml(step.hero)}</b>
            <span>${escapeHtml(step.actor)}</span>
          </div>
          <em>${escapeHtml(actionText)}</em>
        </div>
      </article>
    </div>
  `;
}

function renderDraftSection(match: MatchData): string {
  return `
    <section class="section-panel">
      <div class="section-title compact">
        <div>
          <p class="eyebrow">Draft</p>
          <h2>Ban / Pick 顺序</h2>
        </div>
      </div>
      ${renderDraftTimeline(match.draft)}
    </section>
  `;
}

function renderWardTimeline(match: MatchData): string {
  const mapEvents = match.wardTimeline
    .filter((event) => event.x !== null && event.y !== null)
    .slice()
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
  const maxSecond = getWardTimelineMaxSecond(match);
  const selectedSecond = getWardScrubberSecond(match, maxSecond);
  const selectedProgress = maxSecond > 0 ? (selectedSecond / maxSecond) * 100 : 0;
  const activeEvents = mapEvents.filter((event) => isWardVisibleAt(event, selectedSecond));
  const markerEvents = uniqueWardEvents(mapEvents);

  return `
    <div class="vision-timeline" data-vision-timeline>
      <div class="vision-board">
        <div class="vision-map" aria-label="眼位小地图时间轴">
          <img src="/static/dota/wards/minimap/minimap_game.png" alt="" loading="lazy">
          ${markerEvents.map((event) => renderWardMapDot(event, selectedSecond)).join("")}
        </div>
        <div class="vision-hud">
          <span class="vision-chip radiant" data-vision-radiant-count>天辉 ${activeEvents.filter((event) => event.side === "radiant").length}</span>
          <span class="vision-chip dire" data-vision-dire-count>夜魇 ${activeEvents.filter((event) => event.side === "dire").length}</span>
          <span class="vision-clock" data-vision-clock>${escapeHtml(formatWardClock(selectedSecond))}</span>
        </div>
      </div>
      <div class="vision-scrubber">
        <div
          class="vision-range"
          role="slider"
          tabindex="0"
          data-ward-scrubber
          data-match-id="${escapeHtml(match.id)}"
          data-min="0"
          data-max="${maxSecond}"
          data-step="15"
          data-value="${selectedSecond}"
          data-vision-second="${selectedSecond}"
          style="--ward-progress: ${clampNumber(selectedProgress, 0, 100).toFixed(2)}%"
          aria-valuemin="0"
          aria-valuemax="${maxSecond}"
          aria-valuenow="${selectedSecond}"
          aria-valuetext="${escapeHtml(formatWardClock(selectedSecond))}"
          aria-label="选择眼位时间点"
        ></div>
        <div class="vision-scale">
          <span>0:00</span>
          <b data-vision-total-count>${activeEvents.length} 个有效眼位</b>
          <span>${escapeHtml(formatWardClock(maxSecond))}</span>
        </div>
        <div class="vision-note">只显示当前时间点已插下且未过期的眼位 · 假眼 6:00 · 真眼 7:00</div>
      </div>
    </div>
  `;
}

function renderWardMapDot(event: MatchData["wardTimeline"][number], selectedSecond: number): string {
  const x = event.x ?? 128;
  const y = event.y ?? 128;
  const left = clampNumber((x / 255) * 100, 4, 96);
  const top = clampNumber(100 - (y / 255) * 100, 4, 96);
  const isActive = isWardVisibleAt(event, selectedSecond);
  const expiresAt = wardExpiresAt(event);
  const icon = event.type === "岗哨守卫" ? "sentry" : "observer";
  const displayType = wardDisplayType(event);

  return `
    <span
      role="img"
      class="ward-marker ${event.side} ${icon} ${isActive ? "active" : ""}"
      data-ward-marker
      data-side="${event.side}"
      data-start="${event.timeSeconds}"
      data-end="${expiresAt}"
      data-active="${isActive ? "true" : "false"}"
      style="left: ${left.toFixed(1)}%; top: ${top.toFixed(1)}%"
      title="${escapeHtml(`${event.time} ${displayType} ${event.note}`)}"
      aria-label="${escapeHtml(`${event.time} ${event.side === "radiant" ? "天辉" : "夜魇"} ${displayType}`)}"
    ></span>
  `;
}

function getWardTimelineMaxSecond(match: MatchData): number {
  const durationSeconds = parseClockText(match.duration);
  const lastWardSecond = Math.max(0, ...match.wardTimeline.map((event) => event.timeSeconds));

  return Math.max(600, durationSeconds, lastWardSecond + 120);
}

function getWardScrubberSecond(match: MatchData, maxSecond: number): number {
  const storedSecond = appState.wardScrubberSeconds[match.id];

  if (storedSecond !== undefined) {
    return Math.round(clampNumber(storedSecond, 0, maxSecond));
  }

  return 0;
}

function isWardVisibleAt(event: MatchData["wardTimeline"][number], selectedSecond: number): boolean {
  return event.timeSeconds <= selectedSecond && selectedSecond <= wardExpiresAt(event);
}

function wardExpiresAt(event: MatchData["wardTimeline"][number]): number {
  const lifetime = event.type === "岗哨守卫" ? 420 : 360;

  return event.removedAt !== null && event.removedAt > event.timeSeconds ? event.removedAt : event.timeSeconds + lifetime;
}

function wardDisplayType(event: MatchData["wardTimeline"][number]): string {
  return event.type === "岗哨守卫" ? "真眼" : "假眼";
}

function uniqueWardEvents(events: MatchData["wardTimeline"]): MatchData["wardTimeline"] {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = `${event.timeSeconds}:${event.side}:${event.type}:${event.x}:${event.y}:${event.note}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseClockText(value: string | null | undefined): number {
  const parts = String(value ?? "")
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 60 + parts[1]!);
  }

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  }

  return 0;
}

function formatWardClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderTrendSection(match: MatchData): string {
  if (!match.trends.hasTrends) {
    return renderEmptyState("该比赛暂无经济/经验趋势数据");
  }

  return `
    <div class="trend-grid">
      ${renderAdvantageTrendGraph(match)}
      ${renderPlayerGoldTrendGraph(match)}
    </div>
    ${renderComparisonBars(match)}
  `;
}

function renderAdvantageTrendGraph(match: MatchData): string {
  const gold = sampleTrend(match.trends.goldAdvantage, 44);
  const xp = sampleTrend(match.trends.xpAdvantage, 44);
  const lastGold = match.trends.goldAdvantage[match.trends.goldAdvantage.length - 1];
  const lastXp = match.trends.xpAdvantage[match.trends.xpAdvantage.length - 1];
  const maxAbs = Math.max(1, ...gold.map((point) => Math.abs(point.value)), ...xp.map((point) => Math.abs(point.value)));

  if (gold.length === 0 && xp.length === 0) {
    return `<div class="trend-card">${renderEmptyState("经济/经验差暂无数据")}</div>`;
  }

  return `
    <div class="trend-card trend-card-wide">
      <div class="trend-card-head">
        <b>经济 / 经验差</b>
        <span>经济 ${escapeHtml(formatTrendValue(lastGold?.value ?? 0))} · 经验 ${escapeHtml(formatTrendValue(lastXp?.value ?? 0))}</span>
      </div>
      <svg viewBox="0 0 280 112" role="img" aria-label="经济和经验差曲线">
        ${renderTrendGridLines(280, 112)}
        <line x1="10" y1="56" x2="270" y2="56" class="trend-axis"></line>
        ${gold.length > 0 ? `<polyline points="${trendPolyline(gold, { maxAbs, width: 280, height: 112 })}" class="trend-poly gold"></polyline>` : ""}
        ${xp.length > 0 ? `<polyline points="${trendPolyline(xp, { maxAbs, width: 280, height: 112 })}" class="trend-poly xp"></polyline>` : ""}
      </svg>
      <div class="trend-legend">
        <span><i class="trend-dot gold"></i>经济差</span>
        <span><i class="trend-dot xp"></i>经验差</span>
      </div>
      <div class="trend-scale">
        <span>${escapeHtml(`${Math.min(gold[0]?.minute ?? 0, xp[0]?.minute ?? 0)}m`)}</span>
        <span>${escapeHtml(`±${compactNumber(maxAbs)}`)}</span>
        <span>${escapeHtml(`${Math.max(lastGold?.minute ?? 0, lastXp?.minute ?? 0)}m`)}</span>
      </div>
    </div>
  `;
}

function renderPlayerGoldTrendGraph(match: MatchData): string {
  const trends = match.trends.playerGold
    .filter((trend) => trend.values.length > 0)
    .slice()
    .sort((left, right) => left.playerSlot - right.playerSlot);
  const maxGold = Math.max(1, ...trends.flatMap((trend) => trend.values));

  if (trends.length === 0) {
    return "";
  }

  return `
    <div class="trend-card trend-card-wide">
      <div class="trend-card-head">
        <b>选手经济曲线</b>
        <span>${trends.length} 名选手</span>
      </div>
      <svg viewBox="0 0 280 128" role="img" aria-label="所有选手经济曲线">
        ${renderTrendGridLines(280, 128)}
        ${trends
          .map((trend, index) => {
            const points = playerTrendPolyline(trend.values, maxGold, 280, 128);

            return `<polyline points="${points}" class="player-trend-line" style="--trend-color: ${playerTrendColor(index, trend.side)}"></polyline>`;
          })
          .join("")}
      </svg>
      <div class="trend-player-legend">
        ${trends
          .map(
            (trend, index) => `
              <span class="${trend.side}">
                <i style="background: ${playerTrendColor(index, trend.side)}"></i>
                <b>${escapeHtml(playerTrendHeroName(match, trend))}</b>
                <small>${escapeHtml(compactNumber(trend.values[trend.values.length - 1] ?? 0))}</small>
              </span>
            `,
          )
          .join("")}
      </div>
      <div class="trend-scale">
        <span>0m</span>
        <span>${escapeHtml(compactNumber(maxGold))}</span>
        <span>${escapeHtml(`${Math.max(...trends.map((trend) => trend.values.length - 1))}m`)}</span>
      </div>
    </div>
  `;
}

function playerTrendHeroName(match: MatchData, trend: MatchData["trends"]["playerGold"][number]): string {
  return match.players.find((player) => player.id === String(trend.playerSlot))?.hero ?? trend.playerName;
}

function renderComparisonBars(match: MatchData): string {
  if (match.comparisons.length === 0) {
    return "";
  }

  return `
    <div class="comparison-list">
      ${match.comparisons
        .map((metric) => {
          const share = clampNumber(metric.radiantShare, 0.08, 0.92);

          return `
            <div class="comparison-row">
              <span>${escapeHtml(metric.label)}</span>
              <div>
                <i class="comparison-fill radiant" style="width: ${(share * 100).toFixed(1)}%"></i>
                <i class="comparison-fill dire" style="width: ${((1 - share) * 100).toFixed(1)}%"></i>
              </div>
              <small>${escapeHtml(compactNumber(metric.radiantValue))} / ${escapeHtml(compactNumber(metric.direValue))}</small>
            </div>
          `;
        })
        .join("")}
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

function renderProfilePreview(id: string, name: string, type: string, team: string, stat: string, tags: string[]): string {
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
      <span class="status-tag blue">${escapeHtml(id.startsWith("team:") ? "真实队伍" : "真实选手")}</span>
    </article>
  `;
}

function renderEmptyState(text: string): string {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function getTeam(match: MatchData, side: TeamSide) {
  return side === "radiant" ? match.radiant : match.dire;
}

function currentData(): MobileData {
  return (
    appState.data ?? {
      apiBaseUrl: "http://127.0.0.1:3001/api",
      source: "unavailable",
      selectedTournamentId: "",
      selectedTournamentName: "正在读取真实数据",
      selectedTournamentMeta: {
        status: "unknown",
        statusText: "正在读取公开 API",
        startsAt: "时间待定",
        endsAt: "时间待定",
        leagueId: "-",
      },
      tournamentOptions: [],
      tournamentStats: [],
      stageViews: emptyStageViews(),
      scheduleGroups: [],
      matchRecords: [],
      tournamentRecentRecords: {},
      players: [],
      teams: [],
      featuredMatch: emptyMatchData(),
      notice: "正在读取公开 API，稍后自动刷新。",
    }
  );
}

function emptyStageViews(): MobileData["stageViews"] {
  return {
    group: {
      key: "group",
      name: "小组赛",
      status: "暂无真实阶段数据",
      currentRound: "暂无轮次",
      note: "管理员尚未录入真实小组赛。",
      standings: [],
      bracket: [],
    },
    swiss: {
      key: "swiss",
      name: "瑞士轮",
      status: "暂无真实阶段数据",
      currentRound: "暂无轮次",
      note: "管理员尚未录入真实瑞士轮。",
      standings: [],
      bracket: [],
    },
    knockout: {
      key: "knockout",
      name: "淘汰赛",
      status: "暂无真实阶段数据",
      currentRound: "暂无轮次",
      note: "管理员尚未录入真实淘汰赛。",
      standings: [],
      bracket: [],
    },
  };
}

function emptyMatchData(): MatchData {
  return {
    id: "-",
    league: "暂无真实比赛详情",
    series: "",
    mode: "未知模式",
    endedAt: "时间待定",
    duration: "--:--",
    radiantScore: 0,
    direScore: 0,
    winner: "radiant",
    radiant: { side: "radiant", name: "天辉", shortName: "天辉", seed: "天辉", color: "#78d66c" },
    dire: { side: "dire", name: "夜魇", shortName: "夜魇", seed: "夜魇", color: "#ef6467" },
    mvpPlayerId: "",
    parseStatus: "暂无数据",
    players: [],
    draft: [],
    wardTimeline: [],
    trends: {
      hasTrends: false,
      goldAdvantage: [],
      xpAdvantage: [],
      playerGold: [],
      playerXp: [],
    },
    comparisons: [],
    chat: [],
  };
}

function routeLabel(route: AppRoute): string {
  if (route === "player") {
    return "选手主页";
  }

  if (route === "team") {
    return "队伍主页";
  }

  return routeOptions.find((option) => option.key === route)?.label ?? "MRJZ";
}

function statusClass(status: string): string {
  if (status === "已完赛" || status === "晋级区" || status === "completed") {
    return "green";
  }
  if (status === "延期" || status === "淘汰区" || status === "archived") {
    return "red";
  }
  if (status === "待补录" || status === "running") {
    return "blue";
  }
  return "";
}

function lifecycleLabel(status: string): string {
  const text: Record<string, string> = {
    draft: "草稿",
    upcoming: "未开赛",
    running: "进行中",
    completed: "已结束",
    archived: "归档",
    unknown: "未知",
  };

  return text[status] ?? status;
}

function readRouteFromHash(): AppRoute {
  const rawRoute = window.location.hash.replace("#", "").split("/")[0];
  if (rawRoute === "tags") {
    return "players";
  }
  return isRoute(rawRoute) ? rawRoute : "home";
}

function readProfileIdFromHash(): string | null {
  const [, profileId] = window.location.hash.replace("#", "").split("/");

  return profileId ? decodeURIComponent(profileId) : null;
}

function isRoute(value: string | undefined): value is AppRoute {
  return Boolean(value && routeSet.has(value as AppRoute));
}

function isStage(value: string | undefined): value is StageKey {
  return Boolean(value && stageSet.has(value as StageKey));
}

function isPlayerSortKey(value: string | undefined): value is PlayerSortKey {
  return Boolean(value && playerSortKeySet.has(value as PlayerSortKey));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sampleTrend(points: MatchData["trends"]["goldAdvantage"], targetCount: number) {
  if (points.length <= targetCount) {
    return points;
  }

  const step = (points.length - 1) / (targetCount - 1);

  return Array.from({ length: targetCount }, (_, index) => points[Math.round(index * step)]).filter(
    (point): point is MatchData["trends"]["goldAdvantage"][number] => point !== undefined,
  );
}

function trendPolyline(
  points: MatchData["trends"]["goldAdvantage"],
  options: { maxAbs: number; width: number; height: number },
): string {
  const { maxAbs, width, height } = options;
  const padding = 8;
  const denominator = Math.max(1, points.length - 1);

  return points
    .map((point, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height / 2 - (point.value / maxAbs) * (height / 2 - padding);

      return `${x.toFixed(1)},${clampNumber(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

function playerTrendPolyline(values: number[], maxValue: number, width: number, height: number): string {
  const padding = 8;
  const denominator = Math.max(1, values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height - padding - (value / maxValue) * (height - padding * 2);

      return `${x.toFixed(1)},${clampNumber(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

function renderTrendGridLines(width: number, height: number): string {
  const top = 10;
  const middle = height / 2;
  const bottom = height - 10;

  return `
    <line x1="10" y1="${top}" x2="${width - 10}" y2="${top}" class="trend-grid-line"></line>
    <line x1="10" y1="${middle}" x2="${width - 10}" y2="${middle}" class="trend-grid-line muted"></line>
    <line x1="10" y1="${bottom}" x2="${width - 10}" y2="${bottom}" class="trend-grid-line"></line>
  `;
}

function playerTrendColor(index: number, side: TeamSide): string {
  const radiantColors = ["#75e06c", "#9fe870", "#45d1a4", "#54c7ff", "#d6f06b"];
  const direColors = ["#ff646d", "#ff9b5f", "#d96bff", "#ff5fb7", "#f0c36a"];
  const palette = side === "radiant" ? radiantColors : direColors;

  return palette[index % palette.length]!;
}

function formatTrendValue(value: number): string {
  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${compactNumber(value)}`;
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1000) {
    return `${(value / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  }

  return String(Math.round(value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
