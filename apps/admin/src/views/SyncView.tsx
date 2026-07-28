import { useMemo, useState } from "react";
import type { SyncTask } from "../api";
import { formatFullDateTime, toneForStatus } from "../app/format";
import { EmptyPanel, FilterTabs, SearchInput, SectionCard, StatusPill } from "../components/ui";
import type { AdminData } from "../app/store";

export function SyncView({ data }: { data: AdminData }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");

  const kinds = useMemo(() => {
    const set = new Set(data.syncTasks.map((task) => task.kind));
    return [...set].sort();
  }, [data.syncTasks]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    data.syncTasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));
    return counts;
  }, [data.syncTasks]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = data.syncTasks.filter((task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (kindFilter !== "all" && task.kind !== kindFilter) return false;
    if (!normalizedQuery) return true;
    return [task.kind, task.status, task.leagueId?.toString() ?? "", task.targetType ?? "", task.targetId ?? "", task.lastError ?? ""]
      .join(" ").toLowerCase().includes(normalizedQuery);
  });

  const statusOptions = ["all", ...[...statusCounts.keys()].sort()];

  return (
    <div className="view-stack">
      <SectionCard
        title="同步任务"
        desc={`OpenDota 发现、解析与重试任务（最近 ${data.syncTasks.length} 条）`}
        aside={
          <div className="tournament-metrics">
            {["queued", "running", "failed", "succeeded"].map((status) => (
              <div key={status}><span>{labelStatus(status)}</span><strong>{statusCounts.get(status) ?? 0}</strong></div>
            ))}
          </div>
        }
      >
        <div className="series-board-bar">
          <FilterTabs
            ariaLabel="任务状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions.map((status) => ({
              value: status,
              label: status === "all" ? "全部" : labelStatus(status),
              count: status === "all" ? data.syncTasks.length : statusCounts.get(status) ?? 0,
            }))}
          />
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} aria-label="任务类型筛选" className="inline-select">
            <option value="all">全部类型</option>
            {kinds.map((kind) => <option key={kind} value={kind}>{labelKind(kind)}</option>)}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder="类型、league_id、目标或错误" />
        </div>

        {filtered.length === 0 ? (
          <EmptyPanel title="没有匹配的同步任务" text={data.syncTasks.length === 0 ? "触发 OpenDota 同步后，这里会展示任务队列。" : "调整筛选条件后再查看。"} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>状态</th>
                <th>league_id</th>
                <th>目标</th>
                <th>尝试</th>
                <th>最近错误</th>
                <th>下次执行</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => <SyncTaskRow key={task.id} task={task} />)}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

function SyncTaskRow({ task }: { task: SyncTask }) {
  return (
    <tr className={task.status === "failed" ? "is-row-danger" : ""}>
      <td>{labelKind(task.kind)}</td>
      <td><StatusPill tone={toneForStatus(task.status)}>{labelStatus(task.status)}</StatusPill></td>
      <td>{task.leagueId ?? "-"}</td>
      <td>{task.targetType ? `${task.targetType}${task.targetId ? ` · ${truncate(task.targetId, 18)}` : ""}` : "-"}</td>
      <td>{task.attempts}</td>
      <td className="cell-error" title={task.lastError ?? undefined}>{task.lastError ? truncate(task.lastError, 40) : "-"}</td>
      <td>{task.nextRunAt ? formatFullDateTime(task.nextRunAt) : "-"}</td>
      <td>{task.updatedAt ? formatFullDateTime(task.updatedAt) : "-"}</td>
    </tr>
  );
}

function labelKind(kind: string): string {
  switch (kind) {
    case "discover_match": return "发现比赛";
    case "refresh_match": return "刷新比赛";
    case "request_parse": return "请求解析";
    case "parse_match": return "解析比赛";
    case "sync_player_profile": return "同步选手资料";
    case "sync_team_profile": return "同步战队资料";
    default: return kind;
  }
}

function labelStatus(status: string): string {
  switch (status) {
    case "queued": return "排队中";
    case "running": return "执行中";
    case "succeeded": return "成功";
    case "failed": return "失败";
    default: return status;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
