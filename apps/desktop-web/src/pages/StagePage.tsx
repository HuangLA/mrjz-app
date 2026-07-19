import { useCallback, useEffect, useMemo, useState } from "react";
import type { MobileData } from "../api";
import type { AppRoute, StageKey, StageView } from "../data";
import { StageBracketPreview } from "../components/Bracket";
import { ScheduleCard } from "../components/ScheduleCard";
import {
  DataNotice,
  EmptyState,
  SectionPanel,
  StandingMemberAvatar,
  TournamentScope,
} from "../components/common";
import {
  buildStandingTeamMemberLookup,
  groupStandingRows,
  officialScheduleStatusText,
  officialStageOptions,
  standingMemberDisplayId,
  standingMembersForRow,
  standingRowKey,
  type StandingTeamMember,
  type StandingTeamMemberLookup,
} from "../utils";

export type NavigateFn = (route: AppRoute, options?: { profileId?: string }) => void;

export function StagePage({
  data,
  loading,
  stage,
  onStageChange,
  onNavigate,
  onOpenMatch,
}: {
  data: MobileData;
  loading: boolean;
  stage: StageKey;
  onStageChange: (stage: StageKey) => void;
  onNavigate: NavigateFn;
  onOpenMatch: (matchId: string) => void;
}) {
  const availableStageOptions = useMemo(() => officialStageOptions(data), [data]);
  const activeStageKey = availableStageOptions.some((option) => option.key === stage)
    ? stage
    : (availableStageOptions[0]?.key ?? "group");
  const currentStage = data.stageViews[activeStageKey];
  const standingGroups = useMemo(
    () => groupStandingRows(currentStage.standings),
    [currentStage.standings],
  );
  const [activeStandingGroupKey, setActiveStandingGroupKey] = useState("");
  const [expandedStandingTeamKeys, setExpandedStandingTeamKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const activeStandingGroup =
    standingGroups.find((group) => group.key === activeStandingGroupKey) ??
    standingGroups[0] ??
    null;
  const standingTeamMembers = useMemo(
    () => buildStandingTeamMemberLookup(data),
    [data.players, data.teams],
  );

  useEffect(() => {
    if (data.officialSchedule.isPublished && activeStageKey !== stage) {
      onStageChange(activeStageKey);
    }
  }, [activeStageKey, data.officialSchedule.isPublished, onStageChange, stage]);

  useEffect(() => {
    const nextKey = activeStandingGroup?.key ?? "";

    if (activeStandingGroupKey !== nextKey) {
      setActiveStandingGroupKey(nextKey);
    }
  }, [activeStandingGroup?.key, activeStandingGroupKey]);

  useEffect(() => {
    setExpandedStandingTeamKeys(new Set());
  }, [activeStageKey, data.selectedTournamentId]);

  const toggleStandingTeam = useCallback((teamKey: string) => {
    setExpandedStandingTeamKeys((current) => {
      const next = new Set(current);

      if (next.has(teamKey)) {
        next.delete(teamKey);
      } else {
        next.add(teamKey);
      }

      return next;
    });
  }, []);

  if (!data.officialSchedule.isPublished) {
    return (
      <div className="page-stack">
        <DataNotice loading={loading} />
        <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
        <SectionPanel
          title="赛事阶段暂未发布"
          hint="管理员发布官方赛程后，这里会展示小组赛、瑞士轮或淘汰赛阶段。"
        >
          <span className="pill">{officialScheduleStatusText(data.officialSchedule.status)}</span>
        </SectionPanel>
      </div>
    );
  }

  if (availableStageOptions.length === 0) {
    return (
      <div className="page-stack">
        <DataNotice loading={loading} />
        <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
        <SectionPanel title="暂无官方阶段" hint="管理员发布官方赛程后，这里只展示已启用的阶段。">
          <span className="pill">{officialScheduleStatusText(data.officialSchedule.status)}</span>
        </SectionPanel>
      </div>
    );
  }

  const isGroupStage = activeStageKey === "group";
  const isKnockoutStage = activeStageKey === "knockout";
  const stageMatches = isGroupStage
    ? []
    : data.scheduleGroups
        .flatMap((group) => group.matches)
        .filter((match) => match.stage === currentStage.name);

  return (
    <div className="page-stack">
      <DataNotice loading={loading} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="赛事阶段"
        aside={
          <div className="segmented" role="tablist" aria-label="阶段切换">
            {availableStageOptions.map((option) => (
              <button
                role="tab"
                aria-selected={option.key === activeStageKey}
                className={option.key === activeStageKey ? "active" : ""}
                type="button"
                key={option.key}
                onClick={() => onStageChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="stage-head">
          <h3>
            {isGroupStage
              ? currentStage.name
              : `${currentStage.name} · ${currentStage.currentRound}`}
          </h3>
          <span className={`status-tag ${currentStage.status === "已完赛" ? "green" : "blue"}`}>
            {currentStage.status}
          </span>
        </div>
      </SectionPanel>

      {!isKnockoutStage ? (
        <SectionPanel
          title="积分榜"
          aside={
            standingGroups.length > 1 ? (
              <div className="segmented is-compact" role="tablist" aria-label="积分榜小组切换">
                {standingGroups.map((group) => (
                  <button
                    role="tab"
                    aria-selected={group.key === activeStandingGroup?.key}
                    className={group.key === activeStandingGroup?.key ? "active" : ""}
                    type="button"
                    key={group.key}
                    onClick={() => setActiveStandingGroupKey(group.key)}
                  >
                    {group.label}
                    <small>{group.rows.length} 队</small>
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          <div className="standing-table">
            <div className="standing-table-head" aria-hidden="true">
              <span>排名</span>
              <span>队伍</span>
              <span>战绩</span>
              <span>积分</span>
              <span />
            </div>
            {activeStandingGroup && activeStandingGroup.rows.length > 0 ? (
              activeStandingGroup.rows.map((row) => {
                const rowKey = standingRowKey(row);

                return (
                  <StandingRow
                    key={`${row.groupName ?? "all"}:${rowKey}:${row.rank}`}
                    row={row}
                    members={standingMembersForRow(row, standingTeamMembers)}
                    expanded={expandedStandingTeamKeys.has(rowKey)}
                    onToggle={() => toggleStandingTeam(rowKey)}
                    onOpenPlayer={(playerId) => onNavigate("player", { profileId: playerId })}
                  />
                );
              })
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </SectionPanel>
      ) : null}

      {!isGroupStage ? (
        <SectionPanel
          title="当前轮"
          aside={<span className="status-tag blue">{currentStage.currentRound}</span>}
        >
          <div className="schedule-grid">
            {stageMatches.length > 0 ? (
              stageMatches
                .slice(0, 6)
                .map((match) => (
                  <ScheduleCard
                    key={`${match.stage}:${match.round}:${match.teamA}:${match.teamB}:${match.time}`}
                    match={match}
                    onOpenMatch={onOpenMatch}
                  />
                ))
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </SectionPanel>
      ) : null}

      {isKnockoutStage ? (
        <SectionPanel title="淘汰赛对阵图" hint="完整对阵一览，横向可滚动">
          {currentStage.bracket.length > 0 ? (
            <div className="bracket-scroll">
              <StageBracketPreview nodes={currentStage.bracket} />
            </div>
          ) : (
            <EmptyState text="暂无" />
          )}
        </SectionPanel>
      ) : null}
    </div>
  );
}

function StandingRow({
  row,
  members,
  expanded,
  onToggle,
  onOpenPlayer,
}: {
  row: StageView["standings"][number];
  members: StandingTeamMember[];
  expanded: boolean;
  onToggle: () => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  return (
    <div className={`standing-row-card ${expanded ? "is-expanded" : ""}`}>
      <button className="standing-row" type="button" aria-expanded={expanded} onClick={onToggle}>
        <span className="rank">{row.rank}</span>
        <b>{row.team}</b>
        <span>{row.score}</span>
        <span>{row.points}</span>
        <span className={`chevron ${expanded ? "is-expanded" : ""}`} aria-hidden="true" />
      </button>
      {expanded ? (
        members.length > 0 ? (
          <div className="standing-members" aria-label={`${row.team} 队员`}>
            {members.slice(0, 8).map((member) => (
              <button
                className="standing-member"
                key={member.id || member.displayName}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenPlayer(member.id);
                }}
                aria-label={`查看 ${standingMemberDisplayId(member)} 选手主页`}
              >
                <StandingMemberAvatar member={member} />
                <span className="standing-member-id">{standingMemberDisplayId(member)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="standing-members empty">暂无队员</div>
        )
      ) : null}
    </div>
  );
}

export type { StandingTeamMemberLookup };
