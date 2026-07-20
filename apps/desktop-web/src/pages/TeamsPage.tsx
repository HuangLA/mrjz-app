import { useMemo } from "react";
import type { MobileData } from "../api";
import type { TeamDirectoryItem } from "../data";
import {
  DataNotice,
  EmptyState,
  SectionPanel,
  TeamLogoMark,
  TournamentScope,
} from "../components/common";
import { cssVars } from "../utils";
import type { NavigateFn } from "./StagePage";

export function TeamsPage({
  data,
  loading,
  profileLoading,
  profileErrors,
  onNavigate,
}: {
  data: MobileData;
  loading: boolean;
  profileLoading: Record<string, boolean>;
  profileErrors: Record<string, string>;
  onNavigate: NavigateFn;
}) {
  const topTeams = useMemo(
    () => [...data.teams].sort((left, right) => right.stats.seriesPlayed - left.stats.seriesPlayed),
    [data.teams],
  );
  const error = profileErrors.teams;

  return (
    <div className="page-stack">
      <DataNotice loading={loading} />
      <TournamentScope data={data} onSwitch={() => onNavigate("home")} />
      <SectionPanel
        title="队伍主页"
        hint="按参赛场次排序"
        aside={<span className="pill">{topTeams.length} 支</span>}
      >
        <div className="team-grid">
          {topTeams.length > 0 ? (
            topTeams.map((team, index) => (
              <TeamDirectoryCard key={team.id} team={team} index={index} onNavigate={onNavigate} />
            ))
          ) : (
            <EmptyState text={error ?? (profileLoading.teams ? "读取中" : "暂无")} />
          )}
        </div>
      </SectionPanel>
    </div>
  );
}

function TeamDirectoryCard({
  team,
  index,
  onNavigate,
}: {
  team: TeamDirectoryItem;
  index: number;
  onNavigate: NavigateFn;
}) {
  return (
    <article
      className="team-card reveal"
      style={cssVars({
        "--accent": team.color,
        "--reveal-delay": `${Math.min(index * 50, 400)}ms`,
      })}
    >
      <button type="button" onClick={() => onNavigate("team", { profileId: team.id })}>
        <span className="team-card-rank">{String(index + 1).padStart(2, "0")}</span>
        <TeamLogoMark team={team} />
        <div className="team-card-body">
          <b>{team.name}</b>
          <small>
            {team.memberCount} 名成员 · {team.stats.seriesPlayed} 场 · 胜率 {team.stats.winRate}
          </small>
          <span>
            {team.stats.gameWins} 胜 / {team.stats.gameLosses} 负 · 入库 {team.stats.linkedMatches}{" "}
            场
          </span>
        </div>
        <strong className="team-card-enter">进入</strong>
      </button>
    </article>
  );
}
