import type { StageSummary, StageType, Tone, TournamentStatus } from "../api";

export function labelTournamentStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft": return "草稿";
    case "upcoming": return "未开始";
    case "running": return "进行中";
    case "completed": return "已完成";
    case "archived": return "已归档";
    default: return value ?? "未知";
  }
}

export function labelStageType(value: StageType | null | undefined): string {
  if (value === "group") return "小组赛";
  if (value === "swiss") return "瑞士轮";
  if (value === "knockout") return "淘汰赛";
  return value ?? "阶段";
}

export function labelStageStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft": return "草稿";
    case "published": return "已发布";
    case "running": return "进行中";
    case "locked": return "已锁定";
    case "completed": return "已完成";
    default: return value ?? "未知";
  }
}

export function labelSeriesStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft": return "草稿";
    case "scheduled": return "待开赛";
    case "live": return "进行中";
    case "result_pending": return "待补赛果";
    case "completed": return "已完赛";
    case "conflict": return "赛果冲突";
    case "postponed": return "延期";
    case "cancelled": return "已取消";
    default: return value ?? "未知";
  }
}

export function labelPairingStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft": return "草稿";
    case "published": return "已发布";
    case "confirmed": return "已确认";
    case "running": return "进行中";
    case "completed": return "已完成";
    default: return value ?? "未知";
  }
}

export function labelScheduleStatus(value: string | null | undefined): string {
  switch (value) {
    case "draft": return "草稿";
    case "published": return "已发布";
    case "withdrawn": return "已撤回";
    default: return "未配置";
  }
}

export function labelPreliminary(value: string | null | undefined): string {
  return value === "swiss" ? "瑞士轮" : value === "group" ? "小组赛" : "未选择";
}

export function labelKnockout(value: string | null | undefined): string {
  return value === "double_elimination" ? "双败" : value === "single_elimination" ? "单败" : "未选择";
}

export function labelTagStatus(value: string): string {
  switch (value) {
    case "pending_review": return "待审核";
    case "approved": return "已通过";
    case "rejected": return "已拒绝";
    case "hidden": return "已隐藏";
    default: return value;
  }
}

export function toneForStatus(status: string | undefined | null): Tone {
  switch (status) {
    case "completed":
    case "locked":
    case "confirmed":
    case "succeeded":
    case "parsed":
    case "published":
    case "approved":
      return "good";
    case "running":
    case "scheduled":
    case "queued":
    case "requested":
      return "info";
    case "draft":
    case "upcoming":
    case "postponed":
    case "pending_review":
    case "unconfigured":
      return "warn";
    case "conflict":
    case "cancelled":
    case "failed":
    case "withdrawn":
    case "rejected":
    case "hidden":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "时间待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatFullDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function toDatetimeLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function serializeDatetimeLocal(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function isOfficialScheduleStage(stage: StageSummary): boolean {
  const config = stage.config ?? {};
  const hasExplicitFlag = Object.prototype.hasOwnProperty.call(config, "officialSchedule")
    || Object.prototype.hasOwnProperty.call(config, "scheduleManagement");

  if (hasExplicitFlag) {
    return config.officialSchedule === true || config.scheduleManagement === true;
  }

  return stage.name !== "真实比赛记录" && (stage.type === "group" || stage.type === "swiss" || stage.type === "knockout");
}

export function isPreliminaryStage(stage: StageSummary): boolean {
  return stage.type === "group" || stage.type === "swiss";
}

export function isKnockoutStage(stage: StageSummary): boolean {
  return stage.type === "knockout";
}

export function stageConfigStringList(stage: StageSummary, key: string): string[] {
  const value = stage.config?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

export function stageConfigPositiveInteger(stage: StageSummary, key: string): number | null {
  const value = stage.config?.[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function percentOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

export type { Tone, TournamentStatus };
