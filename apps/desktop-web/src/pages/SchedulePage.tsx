import { useMemo, useState } from "react";
import type { MobileData } from "../api";
import type { ScheduleItem } from "../data";
import { ScheduleCard } from "../components/ScheduleCard";
import {
  DataNotice,
  EmptyState,
  FilterRow,
  SectionPanel,
  TournamentScope,
} from "../components/common";
import { officialScheduleStatusText, sortScheduleGroups, type SortDirection } from "../utils";
import type { NavigateFn } from "./StagePage";

type ScheduleStatusFilter = "全部" | ScheduleItem["status"];
const scheduleFilters: ScheduleStatusFilter[] = ["全部", "未开始", "待补录", "已完赛", "延期"];

export function SchedulePage({
  data,
  loading,
  onNavigate,
  onOpenMatch,
}: {
  data: MobileData;
  loading: boolean;
  onNavigate: NavigateFn;
  onOpenMatch: (matchId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>("全部");
  const [scheduleOrder, setScheduleOrder] = useState<SortDirection>("desc");
  const totalMatches = data.scheduleGroups.reduce((sum, group) => sum + group.matches.length, 0);
  const statusCounts = useMemo(() => {
    const counts = new Map<ScheduleStatusFilter, number>();
    counts.set("全部", totalMatches);
    for (const group of data.scheduleGroups) {
      for (const match of group.matches) {
        counts.set(match.status, (counts.get(match.status) ?? 0) + 1);
      }
    }
    return counts;
  }, [data.scheduleGroups, totalMatches]);
  const filteredScheduleGroups = useMemo(() => {
    const groups = data.scheduleGroups
      .map((group) => ({
        ...group,
        matches:
          statusFilter === "全部"
            ? group.matches
            : group.matches.filter((match) => match.status === statusFilter),
      }))
      .filter((group) => group.matches.length > 0);

    return sortScheduleGroups(groups, scheduleOrder);
  }, [data.scheduleGroups, scheduleOrder, statusFilter]);
  const filteredMatchCount = filteredScheduleGroups.reduce(
    (sum, group) => sum + group.matches.length,
    0,
  );

  if (!data.officialSchedule.isPublished) {
    return (
      <div className="page-stack">
        <DataNotice loading={loading} />
        <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
        <SectionPanel
          title="赛程暂未发布"
          aside={
            <span className="pill">{officialScheduleStatusText(data.officialSchedule.status)}</span>
          }
        >
          <EmptyState text="等待管理员发布官方赛程" />
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <DataNotice loading={loading} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="赛程列表"
        hint={`当前显示 ${filteredMatchCount}/${totalMatches} 场 · 已定时间优先 · ${scheduleOrder === "desc" ? "由晚到早" : "由早到晚"}`}
        aside={
          <div className="toolbar-cluster">
            <FilterRow
              options={scheduleFilters}
              value={statusFilter}
              onChange={setStatusFilter}
              counts={statusCounts}
            />
            <button
              aria-pressed={scheduleOrder === "desc"}
              className="ghost-button"
              type="button"
              onClick={() => setScheduleOrder((current) => (current === "desc" ? "asc" : "desc"))}
            >
              {scheduleOrder === "desc" ? "倒序 ↓" : "正序 ↑"}
            </button>
          </div>
        }
      >
        {filteredScheduleGroups.length === 0 ? (
          <EmptyState text={data.scheduleGroups.length === 0 ? "暂无" : "暂无符合条件的赛程"} />
        ) : (
          <div className="schedule-groups">
            {filteredScheduleGroups.map((group) => (
              <div className="schedule-group" key={`${group.date}:${group.label}`}>
                <div className="date-row">
                  <b>{group.date}</b>
                  <span>{group.label}</span>
                  <i aria-hidden="true" />
                </div>
                <div className="schedule-grid">
                  {group.matches.map((match) => (
                    <ScheduleCard
                      key={`${group.date}:${match.time}:${match.teamA}:${match.teamB}`}
                      match={match}
                      onOpenMatch={onOpenMatch}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
