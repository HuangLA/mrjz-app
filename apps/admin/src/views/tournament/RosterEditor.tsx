import { useMemo, useState } from "react";
import { Check, Lock, Unlock } from "lucide-react";
import type { TournamentTeamListItem } from "../../api";
import { ConfirmButton, SearchInput, Spinner } from "../../components/ui";
import { TeamChip, matchesTeamQuery, orderTeamsByIds } from "../../components/TeamChip";
import type { TournamentCtx } from "./context";

export function RosterEditor({ ctx }: { ctx: TournamentCtx }) {
  const schedule = ctx.data.schedule;
  const locked = Boolean(schedule?.rosterLocked);
  const lockedTeams = useMemo(() => schedule?.teams ?? [], [schedule]);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [seededIds, setSeededIds] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rosterIds = selectedIds ?? (locked ? lockedTeams.map((item) => item.team.id) : ctx.data.teams.map((team) => team.id));
  const seedIds = seededIds ?? lockedTeams.filter((item) => item.isSeeded).map((item) => item.team.id);
  const rosterSet = new Set(rosterIds);
  const seedSet = new Set(seedIds);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTeams = ctx.data.teams.filter((team) => !normalizedQuery || matchesTeamQuery(team, normalizedQuery));
  const dirty = selectedIds !== null || seededIds !== null;

  const toggleTeam = (teamId: string) => {
    const base = selectedIds ?? rosterIds;
    const next = base.includes(teamId) ? base.filter((id) => id !== teamId) : [...base, teamId];
    setSelectedIds(next);
    if (!next.includes(teamId)) setSeededIds((current) => (current ?? seedIds).filter((id) => id !== teamId));
  };

  const toggleSeed = (teamId: string) => {
    const base = seededIds ?? seedIds;
    const next = base.includes(teamId) ? base.filter((id) => id !== teamId) : [...base, teamId];
    setSeededIds(next);
    if (!base.includes(teamId)) {
      const rosterBase = selectedIds ?? rosterIds;
      if (!rosterBase.includes(teamId)) setSelectedIds([...rosterBase, teamId]);
    }
  };

  const lockRoster = async () => {
    if (!window.confirm(`确认锁定 ${rosterIds.length} 支参赛队伍${seedIds.length > 0 ? `（含 ${seedIds.length} 支种子队）` : ""}？`)) return;
    setSubmitting(true);
    try {
      const result = await ctx.runAction("锁定参赛名单", "POST", `/tournaments/${encodeURIComponent(ctx.data.selectedTournamentId)}/schedule-management/lock-roster`, {
        teamIds: rosterIds,
        seededTeamIds: seedIds,
        actor: "admin",
      });
      if (result.ok) {
        setSelectedIds(null);
        setSeededIds(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const unlockRoster = async () => {
    setSubmitting(true);
    try {
      const result = await ctx.runAction("解锁名单", "POST", `/tournaments/${encodeURIComponent(ctx.data.selectedTournamentId)}/schedule-management/unlock-roster`, { actor: "admin" });
      if (result.ok) {
        setSelectedIds(null);
        setSeededIds(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (locked) {
    return (
      <div className="roster-locked">
        <div className="roster-locked-list">
          {lockedTeams.length === 0 ? <span className="muted">名单为空。</span> : lockedTeams.map((item, index) => (
            <TeamChip key={item.team.id} team={item.team} badge={item.isSeeded ? <em className="chip-badge is-seed">种子</em> : <em className="chip-badge">{index + 1}</em>} />
          ))}
        </div>
        <ConfirmButton
          className="btn btn-ghost-danger"
          confirmText={`解锁名单会清空已创建的官方阶段（小组 / 瑞士轮 / 淘汰赛）草稿，确定继续？`}
          onConfirm={unlockRoster}
          disabled={submitting}
        >
          {submitting ? <Spinner size={14} /> : <Unlock size={14} />} 解锁并清空阶段
        </ConfirmButton>
      </div>
    );
  }

  return (
    <div className="roster-editor">
      <div className="roster-editor-bar">
        <SearchInput value={query} onChange={setQuery} placeholder="搜索队名或缩写" disabled={ctx.data.teams.length === 0} />
        <span className="muted">已选 {rosterIds.length} 队{seedIds.length > 0 ? ` · ${seedIds.length} 种子` : ""}{dirty ? " · 有未保存修改" : ""}</span>
      </div>
      {ctx.data.teams.length === 0 ? (
        <p className="muted">当前届次暂无队伍。请先在“战队与选手”创建队伍，或同步 OpenDota 比赛记录。</p>
      ) : (
        <div className="roster-grid" role="list">
          {visibleTeams.map((team) => (
            <RosterTeamRow
              key={team.id}
              team={team}
              inRoster={rosterSet.has(team.id)}
              isSeed={seedSet.has(team.id)}
              onToggleTeam={() => toggleTeam(team.id)}
              onToggleSeed={() => toggleSeed(team.id)}
            />
          ))}
          {visibleTeams.length === 0 ? <p className="muted">没有匹配的队伍。</p> : null}
        </div>
      )}
      <div className="roster-editor-actions">
        <button type="button" className="btn btn-ghost" onClick={() => { setSelectedIds(ctx.data.teams.map((team) => team.id)); }} disabled={ctx.data.teams.length === 0}>全选</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setSelectedIds([]); setSeededIds([]); }} disabled={rosterIds.length === 0}>清空</button>
        <button type="button" className="btn btn-primary" onClick={() => void lockRoster()} disabled={rosterIds.length < 2 || submitting}>
          {submitting ? <Spinner size={14} /> : <Lock size={14} />} 锁定 {rosterIds.length} 队名单
        </button>
      </div>
      <p className="muted">至少 2 支队伍才能锁定。标记种子队仅用于展示，不影响后续编排顺序。</p>
    </div>
  );
}

function RosterTeamRow({ team, inRoster, isSeed, onToggleTeam, onToggleSeed }: {
  team: TournamentTeamListItem;
  inRoster: boolean;
  isSeed: boolean;
  onToggleTeam: () => void;
  onToggleSeed: () => void;
}) {
  return (
    <div className={inRoster ? "roster-team-row is-in" : "roster-team-row"} role="listitem">
      <label className="roster-team-main">
        <input type="checkbox" checked={inRoster} onChange={onToggleTeam} />
        <TeamChip team={team} />
        <small>{team.memberCount} 人</small>
      </label>
      <button type="button" className={isSeed ? "chip-toggle is-active" : "chip-toggle"} onClick={onToggleSeed} title="标记为种子队">
        <Check size={12} /> 种子
      </button>
    </div>
  );
}

export function orderRosterTeams(teams: TournamentTeamListItem[], ids: string[]) {
  return orderTeamsByIds(teams, ids);
}
