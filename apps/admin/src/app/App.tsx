import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brackets,
  ClipboardCheck,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import {
  adminLogin,
  adminLogout,
  apiBaseUrl,
  clearStoredAdminSession,
  getAdminMe,
  getStoredAdminSession,
  sendAdminRequest,
  type AdminAuthSession,
  type Tone,
} from "../api";
import { initialAdminData, loadAdminData, type AdminData } from "./store";
import { labelTournamentStatus, toneForStatus } from "./format";
import { StatusPill } from "../components/ui";
import { TournamentView } from "../views/tournament/TournamentView";
import { TeamsView } from "../views/TeamsView";
import { AcknowledgementsView } from "../views/AcknowledgementsView";
import { MatchesView } from "../views/MatchesView";
import { TagsView } from "../views/TagsView";
import { SyncView } from "../views/SyncView";

export type ViewKey = "tournament" | "teams" | "acknowledgements" | "matches" | "tags" | "sync";
type AdminAuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface Notice {
  tone: Tone;
  text: string;
}

const navItems: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "tournament", label: "赛事管理", icon: Brackets },
  { key: "teams", label: "战队与选手", icon: Users },
  { key: "matches", label: "比赛结果库", icon: ClipboardCheck },
  { key: "tags", label: "标签审核", icon: ShieldCheck },
  { key: "acknowledgements", label: "鸣谢名单", icon: Trophy },
  { key: "sync", label: "同步任务", icon: RefreshCw },
];

function viewFromHash(): ViewKey {
  const value = window.location.hash.replace(/^#/, "");
  return navItems.some((item) => item.key === value) ? (value as ViewKey) : "tournament";
}

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>(() => viewFromHash());
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>("checking");
  const [adminSession, setAdminSession] = useState<AdminAuthSession | null>(() => getStoredAdminSession());
  const [data, setData] = useState<AdminData>(initialAdminData);
  const [notice, setNotice] = useState<Notice | null>(null);

  const notify = useCallback((tone: Tone, text: string) => setNotice({ tone, text }), []);

  const load = useCallback(async (preferredTournamentId?: string, preferredStageId?: string) => {
    setData((current) => ({ ...current, loading: true }));
    try {
      const next = await loadAdminData(
        preferredTournamentId ?? data.selectedTournamentId,
        preferredStageId ?? data.selectedStageId,
      );
      setData(next);
    } catch (error) {
      setData((current) => ({
        ...current,
        loading: false,
        source: "unavailable",
        notice: `API 不可用：${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }, [data.selectedTournamentId, data.selectedStageId]);

  const runAction = useCallback(async (
    label: string,
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    payload?: Record<string, unknown>,
    options?: { nextStageId?: string; silent?: boolean },
  ) => {
    if (!options?.silent) notify("info", `${label}处理中...`);
    const result = await sendAdminRequest(path, method, payload);
    notify(result.ok ? "good" : "warn", `${label}：${result.message}`);
    if (result.ok) await load(data.selectedTournamentId, options?.nextStageId ?? data.selectedStageId);
    return result;
  }, [data.selectedTournamentId, data.selectedStageId, load, notify]);

  useEffect(() => {
    let cancelled = false;

    async function verifyAdminSession() {
      const stored = getStoredAdminSession();
      if (stored === null) {
        if (!cancelled) {
          setAdminSession(null);
          setAuthStatus("unauthenticated");
        }
        return;
      }
      try {
        const admin = await getAdminMe();
        if (!cancelled) {
          setAdminSession({ ...stored, admin });
          setAuthStatus("authenticated");
        }
      } catch {
        clearStoredAdminSession();
        if (!cancelled) {
          setAdminSession(null);
          setAuthStatus("unauthenticated");
        }
      }
    }

    void verifyAdminSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAdminSession(null);
      setAuthStatus("unauthenticated");
      setData({ ...initialAdminData, loading: false, notice: "Admin 登录已过期，请重新登录。" });
    };
    window.addEventListener("mrjz:admin-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("mrjz:admin-unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setActiveView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const switchView = (key: ViewKey) => {
    setActiveView(key);
    if (window.location.hash !== `#${key}`) window.history.replaceState(null, "", `#${key}`);
  };

  const handleAdminLogin = async (username: string, password: string) => {
    const session = await adminLogin(username, password);
    setAdminSession(session);
    setAuthStatus("authenticated");
  };

  const handleAdminLogout = async () => {
    await adminLogout();
    setAdminSession(null);
    setAuthStatus("unauthenticated");
    setData({ ...initialAdminData, loading: false, notice: "已退出 Admin。" });
    setNotice(null);
  };

  const pendingTagCount = useMemo(
    () => data.tagPlayers.reduce((sum, player) => sum + player.tagCounts.pending_review, 0),
    [data.tagPlayers],
  );

  if (authStatus !== "authenticated") {
    return <LoginScreen status={authStatus} onLogin={handleAdminLogin} />;
  }

  const activeNav = navItems.find((item) => item.key === activeView) ?? navItems[0]!;
  const reload = () => load(data.selectedTournamentId, data.selectedStageId);

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">MR</div>
          <div><strong>MRJZ Admin</strong><span>赛事运营台</span></div>
        </div>
        <label className="sidebar-tournament">
          <span>当前届次</span>
          <select
            value={data.selectedTournamentId}
            onChange={(event) => void load(event.target.value, "")}
            disabled={data.loading || data.tournaments.length === 0}
          >
            {data.tournaments.length === 0 ? <option value="">暂无届次</option> : null}
            {data.tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {data.detail ? (
          <div className="sidebar-tournament-meta">
            <StatusPill tone={toneForStatus(data.detail.status)}>{labelTournamentStatus(data.detail.status)}</StatusPill>
            <span>league_id：{data.detail.league?.opendotaLeagueId ?? "未配置"}</span>
          </div>
        ) : null}
        <nav className="nav-stack">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className={activeView === item.key ? "nav-row is-active" : "nav-row"} onClick={() => switchView(item.key)}>
                <Icon size={17} />
                <span>{item.label}</span>
                {item.key === "tags" && pendingTagCount > 0 ? <b className="nav-alert-count">{pendingTagCount}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-session-chip" title={adminSession?.admin.roles.join(" / ") || "admin"}>
            <ShieldCheck size={14} />
            <span>{adminSession?.admin.displayName ?? "Admin"}</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => void handleAdminLogout()} title="退出 Admin" aria-label="退出 Admin"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="main-topbar">
          <div className="main-topbar-title">
            <h1>{activeNav.label}</h1>
            <span>{data.notice}</span>
          </div>
          <div className="main-topbar-actions">
            <StatusPill tone={data.source === "api" ? "good" : "danger"}>{data.source === "api" ? "API 在线" : "API 不可用"}</StatusPill>
            <span className="api-chip" title={apiBaseUrl}>{apiBaseUrl.replace(/^https?:\/\//, "")}</span>
            <button type="button" className="icon-btn" onClick={() => void reload()} title="刷新数据" aria-label="刷新数据">
              {data.loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            </button>
          </div>
        </header>

        {notice ? <div className={`notice-bar notice-${notice.tone}`} role="status">{notice.text}</div> : null}

        <div className="main-content">
          {activeView === "tournament" ? (
            <TournamentView data={data} load={load} runAction={runAction} notify={notify} />
          ) : activeView === "teams" ? (
            <TeamsView data={data} reload={reload} runAction={runAction} notify={notify} />
          ) : activeView === "acknowledgements" ? (
            <AcknowledgementsView data={data} reload={reload} runAction={runAction} notify={notify} />
          ) : activeView === "matches" ? (
            <MatchesView data={data} />
          ) : activeView === "tags" ? (
            <TagsView data={data} reload={reload} notify={notify} />
          ) : (
            <SyncView data={data} />
          )}
        </div>
      </main>
    </div>
  );
}

function LoginScreen({ status, onLogin }: { status: AdminAuthStatus; onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("请输入 Admin 账号继续。");
  const [submitting, setSubmitting] = useState(false);
  const checking = status === "checking";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("正在登录...");
    try {
      await onLogin(username, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={(event) => void submit(event)}>
        <div className="brand-lockup">
          <div className="brand-mark">MR</div>
          <div><strong>MRJZ Admin</strong><span>赛事运营台</span></div>
        </div>
        <div className="login-heading">
          <Lock size={18} />
          <div>
            <h1>Admin 登录</h1>
            <p>{checking ? "正在检查登录状态..." : message}</p>
          </div>
        </div>
        <label className="field">
          <span className="field-label">用户名</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" disabled={checking || submitting} />
        </label>
        <label className="field">
          <span className="field-label">密码</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={checking || submitting} />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={checking || submitting || !username.trim() || !password.trim()}>
          {checking || submitting ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
          {checking ? "检查中" : submitting ? "登录中" : "登录"}
        </button>
        <span className="api-chip">{apiBaseUrl}</span>
      </form>
    </main>
  );
}

export function CreateButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="btn btn-primary" onClick={onClick}><Plus size={15} /> {label}</button>;
}
