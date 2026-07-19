import { useEffect, useMemo, useRef, useState } from "react";
import type { MobileData } from "../api";
import { MatchRecordCard } from "../components/MatchRecordCard";
import { DataNotice, EmptyState, SectionPanel, TournamentScope } from "../components/common";
import { allRecordTeamFilter, buildRecordTeamFilterOptions, matchRecordHasTeam } from "../utils";
import type { NavigateFn } from "./StagePage";

export function RecordsPage({
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
  const [teamFilter, setTeamFilter] = useState<string>(allRecordTeamFilter);
  const teamFilterOptions = useMemo(
    () => buildRecordTeamFilterOptions(data.matchRecords),
    [data.matchRecords],
  );
  const teamFilters = useMemo(
    () => teamFilterOptions.map((option) => option.label),
    [teamFilterOptions],
  );
  const visibleRecords = useMemo(
    () =>
      teamFilter === allRecordTeamFilter
        ? data.matchRecords
        : data.matchRecords.filter((record) => matchRecordHasTeam(record, teamFilter)),
    [data.matchRecords, teamFilter],
  );

  useEffect(() => {
    if (!teamFilters.includes(teamFilter)) {
      setTeamFilter(allRecordTeamFilter);
    }
  }, [teamFilter, teamFilters]);

  return (
    <div className="page-stack">
      <DataNotice loading={loading} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="比赛记录"
        hint="OpenDota 真实入库战报，点击卡片查看完整复盘"
        aside={
          <span className="pill">
            {visibleRecords.length}
            {visibleRecords.length === data.matchRecords.length
              ? ""
              : `/${data.matchRecords.length}`}{" "}
            场
          </span>
        }
      >
        <RecordTeamFilterRail
          options={teamFilterOptions}
          value={teamFilter}
          onChange={setTeamFilter}
        />
        <div className="records-grid" id="filtered-match-records">
          {visibleRecords.length > 0 ? (
            visibleRecords.map((record, index) => (
              <MatchRecordCard
                key={record.matchId}
                record={record}
                index={index}
                onOpenMatch={onOpenMatch}
              />
            ))
          ) : (
            <EmptyState text={data.matchRecords.length === 0 ? "暂无" : "暂无该队伍比赛记录"} />
          )}
        </div>
      </SectionPanel>
    </div>
  );
}

function RecordTeamFilterRail({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; count: number }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeItem = railRef.current?.querySelector<HTMLElement>("[aria-selected='true']");
    activeItem?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [value]);

  return (
    <div className="record-filter">
      <div className="record-filter-frame">
        <div
          aria-label="按战队筛选比赛记录"
          className="record-filter-rail"
          ref={railRef}
          role="tablist"
        >
          {options.map((option) => {
            const isActive = option.label === value;

            return (
              <button
                aria-controls="filtered-match-records"
                aria-label={`${option.label}，${option.count} 场比赛`}
                aria-selected={isActive}
                className={`record-filter-item ${isActive ? "active" : ""}`}
                key={option.label}
                role="tab"
                type="button"
                onClick={(event) => {
                  onChange(option.label);
                  event.currentTarget.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "center",
                  });
                }}
              >
                <span>{option.label}</span>
                <small>{option.count}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
