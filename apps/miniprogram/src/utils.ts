import Taro from "@tarojs/taro";
import type { SeriesSummary, StageSummary, TeamBrief } from "./types";

export function navigate(url: string): void {
  void Taro.navigateTo({ url });
}

export function switchTab(url: string): void {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  const currentRoute = Taro.getCurrentPages().at(-1)?.route;

  if (currentRoute && normalizedUrl === `/${currentRoute}`) {
    return;
  }

  void Taro.redirectTo({ url: normalizedUrl });
}

export function showToast(title: string, icon: "success" | "error" | "none" = "none"): void {
  void Taro.showToast({ title, icon, duration: 1800 });
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "时间待定";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "日期待定";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatPercent(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "-";
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

export function formatInteger(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toString() : "-";
}

export function formatScore(series: Pick<SeriesSummary, "radiantScore" | "direScore">): string {
  const left = series.radiantScore ?? "-";
  const right = series.direScore ?? "-";

  return `${left} : ${right}`;
}

export function labelStageType(value: StageSummary["type"] | string | undefined): string {
  if (value === "group") return "小组赛";
  if (value === "swiss") return "瑞士轮";
  if (value === "knockout") return "淘汰赛";
  return "赛事阶段";
}

export function labelStatus(value?: string | null): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "upcoming":
      return "未开始";
    case "running":
      return "进行中";
    case "completed":
      return "已结束";
    case "archived":
      return "已归档";
    case "published":
      return "已发布";
    case "withdrawn":
      return "已撤回";
    case "scheduled":
      return "已排期";
    case "result_pending":
      return "待补赛果";
    case "postponed":
      return "延期";
    case "cancelled":
      return "取消";
    default:
      return value ?? "未知";
  }
}

export function teamName(team?: TeamBrief | null): string {
  return team?.name || team?.shortName || "待定队伍";
}

export function seriesTitle(series: SeriesSummary): string {
  return `${teamName(series.radiantTeam)} vs ${teamName(series.direTeam)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
