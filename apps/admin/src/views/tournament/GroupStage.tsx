import { useState } from "react";
import { CalendarClock, Dices, Plus, Trash2 } from "lucide-react";
import type { StageGroup } from "../../api";
import { buildTeamPairDrafts, expectedGroupRegularSeriesCount, findNextGroupRegularPairSuggestion, scheduledGroupRegularSeriesCount } from "../../app/domain";
import { clampInteger } from "../../app/format";
import { SearchInput } from "../../components/ui";
import { TeamChip, matchesTeamQuery } from "../../components/TeamChip";
import type { TournamentCtx } from "./context";
import { SeriesEditorPanel } from "./SeriesEditor";

const MIN_GROUP_COUNT = 1;
const MAX_GROUP_COUNT = 16;

export function GroupStage({ ctx }: { ctx: TournamentCtx }) {
  const groups = ctx.data.stageData.groups;
  const rounds = ctx.data.stageData.rounds;
  const [teamFilter, setTeamFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(true);
  const normalizedFilter = teamFilter.trim().toLowerCase();

  const assignedIds = new Set(groups.flatMap((group) => group.teams.map((team) => team.id)));
  const unassigned = ctx.availableTeams.filter((team) => !assignedIds.has(team.id));
  const visibleUnassigned = normalizedFilter ? unassigned.filter((team) => matchesTeamQuery(team, normalizedFilter)) : unassigned;
  const assignedCount = ctx.availableTeams.length - unassigned.length;
  const allSeries = rounds.flatMap((round) => round.series);
  const regularSeriesCount = scheduledGroupRegularSeriesCount(allSeries);
  const expectedRegularCount = expectedGroupRegularSeriesCount(groups);
  const groupsReady = groups.length > 0 && groups.every((group) => group.teams.length >= 2);
  const suggestion = findNextGroupRegularPairSuggestion(groups, rounds);

  const addTeamToGroup = async (groupId: string, teamId: string) => {
    await ctx.runAction("移动队伍", "POST", `/stage-groups/${encodeURIComponent(groupId)}/teams`, { teamId });
  };

  const removeTeamFromGroup = async (groupId: string, teamId: string) => {
    await ctx.runAction("移出队伍", "DELETE", `/stage-groups/${encodeURIComponent(groupId)}/teams/${encodeURIComponent(teamId)}`);
  };

  const createGroup = async () => {
    if (!ctx.stage) return;
    const usedNames = new Set(groups.map((group) => group.name.trim()));
    const name = nextAvailableGroupName(usedNames, groups.length);
    await ctx.runAction("添加小组", "POST", `/stages/${encodeURIComponent(ctx.stage.id)}/groups`, { name, sortOrder: groups.length + 1 });
  };

  const deleteGroup = async (group: StageGroup) => {
    const message = group.teams.length > 0
      ? `“${group.name}”里还有 ${group.teams.length} 支队伍，删除后它们会回到未分组。确认删除？`
      : `确认删除“${group.name}”？`;
    if (!window.confirm(message)) return;
    await ctx.runAction("删除小组", "DELETE", `/stage-groups/${encodeURIComponent(group.id)}`);
  };

  const renameGroup = async (group: StageGroup, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) return;
    await ctx.runAction("重命名小组", "PATCH", `/stage-groups/${encodeURIComponent(group.id)}`, { name: trimmed });
  };

  const randomizeGroups = async (groupCount: number) => {
    if (!ctx.stage) return;
    const safeCount = clampInteger(groupCount, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
    const regularCount = allSeries.filter((series) => series.groupId && series.seriesKind !== "tiebreaker").length;
    const seriesWarning = regularCount > 0 ? `\n当前还有 ${regularCount} 场小组常规对阵；随机分组不会自动重排这些对阵。` : "";
    if (!window.confirm(`确认按 ${safeCount} 个小组随机分配 ${ctx.availableTeams.length} 支队伍？${seriesWarning}`)) return;
    await ctx.runAction("随机分组", "POST", `/stages/${encodeURIComponent(ctx.stage.id)}/groups/randomize`, { groupCount: safeCount, actor: "admin" });
  };

  const generateRoundRobin = async () => {
    if (!ctx.stage) return;
    const targetCount = groups.reduce((total, group) => total + buildTeamPairDrafts(group.teams).length, 0);
    if (regularSeriesCount > 0 && !window.confirm(`当前已有 ${regularSeriesCount} 场常规对阵。重新生成 ${targetCount} 场 BO2 单循环会覆盖这些常规对阵（加赛保留）。确认继续？`)) return;
    await ctx.runAction("生成小组赛程", "POST", `/stages/${encodeURIComponent(ctx.stage.id)}/group-round-robin`, { boType: "BO2", replaceExisting: true, actor: "admin" });
  };

  return (
    <div className="stage-stack">
      <div className="stage-block">
        <div className="stage-block-head">
          <div>
            <h3>分组</h3>
            <p className="muted">{assignedCount}/{ctx.availableTeams.length} 队已分组 · {groups.length} 个小组 · 常规对阵 {regularSeriesCount}/{expectedRegularCount}</p>
          </div>
          <div className="stage-block-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void createGroup()}><Plus size={14} /> 添加小组</button>
            <RandomizeControl groups={groups.length} onRandomize={randomizeGroups} disabled={ctx.availableTeams.length < 2} />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void generateRoundRobin()}
              disabled={!groupsReady || expectedRegularCount === 0}
              title={groupsReady ? `按当前分组生成 ${expectedRegularCount} 场 BO2 单循环` : "每个小组至少需要 2 支队伍"}
            >
              <CalendarClock size={14} /> {regularSeriesCount > 0 ? `重新生成 ${expectedRegularCount} 场` : `生成 ${expectedRegularCount} 场单循环`}
            </button>
          </div>
        </div>

        <div className="group-board">
          <div className="group-pool">
            <div className="group-pool-head">
              <strong>未分组（{unassigned.length}）</strong>
              <SearchInput value={teamFilter} onChange={setTeamFilter} placeholder="搜索队伍" />
            </div>
            <div className="group-pool-list">
              {visibleUnassigned.length === 0 ? <span className="muted">{unassigned.length === 0 ? "所有队伍都已分组。" : "无匹配队伍。"}</span> : null}
              {visibleUnassigned.map((team) => (
                <div key={team.id} className="group-team-row">
                  <TeamChip team={team} size="small" />
                  <select value="" onChange={(event) => { if (event.target.value) void addTeamToGroup(event.target.value, team.id); }} disabled={groups.length === 0} aria-label={`把 ${team.name} 加入小组`}>
                    <option value="">加入…</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="group-columns">
            {groups.length === 0 ? <p className="muted">还没有小组。点击“添加小组”或“随机分组”。</p> : null}
            {groups.map((group) => (
              <GroupColumn
                key={group.id}
                group={group}
                filter={normalizedFilter}
                onRename={renameGroup}
                onDelete={deleteGroup}
                onRemoveTeam={removeTeamFromGroup}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="stage-block">
        <div className="stage-block-head">
          <div>
            <h3>手动排赛</h3>
            <p className="muted">逐场创建 BO2；推荐下一场来自当前分组内未交手组合。</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditorOpen((current) => !current)}>{editorOpen ? "收起" : "展开"}</button>
        </div>
        {editorOpen ? (
          <SeriesEditorPanel
            ctx={ctx}
            stage={ctx.stage!}
            groups={groups}
            rounds={rounds}
            editingSeries={null}
            suggestion={suggestion ? { pair: suggestion.pair, groupId: suggestion.group.id, label: `${suggestion.group.name} · ${suggestion.pair.left.name} vs ${suggestion.pair.right.name}` } : null}
            onDone={() => undefined}
          />
        ) : suggestion ? (
          <div className="suggestion-strip">
            <span>下一场推荐：<strong>{suggestion.group.name} · {suggestion.pair.left.name} vs {suggestion.pair.right.name}</strong></span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorOpen(true)}>去创建</button>
          </div>
        ) : (
          <div className="suggestion-strip">
            <span>{expectedRegularCount > 0 && regularSeriesCount >= expectedRegularCount ? "常规对阵已排满，可继续添加加赛。" : "暂无推荐对阵。"}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorOpen(true)}>展开创建</button>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupColumn({ group, filter, onRename, onDelete, onRemoveTeam }: {
  group: StageGroup;
  filter: string;
  onRename: (group: StageGroup, name: string) => Promise<void>;
  onDelete: (group: StageGroup) => Promise<void>;
  onRemoveTeam: (groupId: string, teamId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const visibleTeams = filter ? group.teams.filter((team) => matchesTeamQuery(team, filter)) : group.teams;
  const healthy = group.teams.length >= 2;

  const save = () => {
    setEditing(false);
    void onRename(group, name);
  };

  return (
    <section className="group-column">
      <header className="group-column-head">
        {editing ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") {
                setName(group.name);
                setEditing(false);
              }
            }}
            autoFocus
          />
        ) : (
          <strong onDoubleClick={() => { setName(group.name); setEditing(true); }}>{group.name}</strong>
        )}
        <span className={healthy ? "group-health is-good" : "group-health is-warn"}>{group.teams.length} 队{healthy ? "" : " · 至少 2 队"}</span>
        <div className="group-column-actions">
          {editing ? null : <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setName(group.name); setEditing(true); }}>重命名</button>}
          <button type="button" className="btn btn-ghost-danger btn-xs" onClick={() => void onDelete(group)} aria-label={`删除 ${group.name}`}><Trash2 size={12} /></button>
        </div>
      </header>
      <div className="group-team-list">
        {visibleTeams.length === 0 ? <span className="muted">{filter ? "无匹配队伍" : "空小组"}</span> : null}
        {visibleTeams.map((team) => (
          <div key={team.id} className="group-team-row">
            <TeamChip team={team} size="small" />
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => void onRemoveTeam(group.id, team.id)}>移出</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function RandomizeControl({ groups, onRandomize, disabled }: { groups: number; onRandomize: (count: number) => Promise<void>; disabled: boolean }) {
  const [count, setCount] = useState(Math.max(groups, 2));
  return (
    <span className="randomize-control" title="随机分组">
      <input type="number" min={MIN_GROUP_COUNT} max={MAX_GROUP_COUNT} value={count} onChange={(event) => setCount(clampInteger(Number(event.target.value), MIN_GROUP_COUNT, MAX_GROUP_COUNT))} aria-label="随机分组小组数" />
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onRandomize(count)} disabled={disabled}><Dices size={14} /> 随机分组</button>
    </span>
  );
}

function nextAvailableGroupName(usedNames: Set<string>, index: number): string {
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const baseName = `${labels[index] ?? index + 1} 组`;
  if (!usedNames.has(baseName)) return baseName;
  let suffix = 2;
  while (usedNames.has(`${baseName} ${suffix}`)) suffix += 1;
  return `${baseName} ${suffix}`;
}
