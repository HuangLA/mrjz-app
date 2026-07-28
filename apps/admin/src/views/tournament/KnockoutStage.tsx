import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Brackets, Check, RotateCcw, Trash2, Trophy, X } from "lucide-react";
import { getSeedSlotOrder } from "@mrjz/shared/bracket-seeding";
import type { BracketNode, StandingRow, TeamBrief } from "../../api";
import {
  bracketGroupLaneLabel,
  formatBracketTarget,
  getBracketSlotSummary,
  groupBracketNodes,
  standingTeamId,
} from "../../app/domain";
import { clampInteger, stageConfigStringList } from "../../app/format";
import { ConfirmButton, StatusPill } from "../../components/ui";
import { TeamChip, orderTeamsByIds } from "../../components/TeamChip";
import type { TournamentCtx } from "./context";

type CompetitionMode = "single_elimination" | "double_elimination";
type BracketSlotName = "radiant" | "dire";

const doubleEliminationPresets = [
  { label: "4 队", title: "4 支都从胜者组开始", bracketSize: 4, winnerTeamCount: 4, loserTeamCount: 0 },
  { label: "6 队 · 4/2", title: "4 支胜者组，2 支初始败者组", bracketSize: 4, winnerTeamCount: 4, loserTeamCount: 2 },
  { label: "8 队 · 4/4", title: "4 支胜者组，4 支初始败者组", bracketSize: 8, winnerTeamCount: 4, loserTeamCount: 4 },
  { label: "8 队 · 全胜者", title: "8 支都从胜者组首轮开始", bracketSize: 8, winnerTeamCount: 8, loserTeamCount: 0 },
  { label: "16 队", title: "16 支都从胜者组首轮开始", bracketSize: 16, winnerTeamCount: 16, loserTeamCount: 0 },
];

export function KnockoutStage({ ctx }: { ctx: TournamentCtx }) {
  const knockoutStageExists = Boolean(ctx.stage);
  const bracket = ctx.data.stageData.bracket;

  return (
    <div className="stage-stack">
      {!knockoutStageExists ? <KnockoutEntrantSetup ctx={ctx} /> : null}
      {knockoutStageExists ? <BracketBoard ctx={ctx} bracket={bracket} /> : null}
    </div>
  );
}

export function KnockoutEntrantSetup({ ctx, onGenerated }: { ctx: TournamentCtx; onGenerated?: () => void }) {
  const schedule = ctx.data.schedule;
  const standings = ctx.data.stageData.standings;
  const preliminaryComplete = useMemo(() => {
    const allSeries = ctx.data.stageData.rounds.flatMap((round) => round.series);
    return allSeries.length > 0 && standings.length >= 2;
  }, [ctx.data.stageData.rounds, standings]);

  const configuredMode: CompetitionMode = schedule?.knockoutType === "double_elimination" ? "double_elimination" : "single_elimination";
  const [mode, setMode] = useState<CompetitionMode>(configuredMode);
  const [bracketSize, setBracketSize] = useState(configuredMode === "double_elimination" ? 4 : 8);
  const [winnerTeamCount, setWinnerTeamCount] = useState(4);
  const [loserTeamCount, setLoserTeamCount] = useState(0);
  const [knockoutName, setKnockoutName] = useState("淘汰赛");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isDouble = mode === "double_elimination";
  const maxLoserTeamCount = winnerTeamCount <= 4 ? Math.min(4, Math.floor(bracketSize / 2)) : 0;
  const targetCount = isDouble ? winnerTeamCount + Math.min(loserTeamCount, maxLoserTeamCount) : bracketSize;
  const selectedTeams = orderTeamsByIds(ctx.availableTeams, selectedIds);
  const rankedIds = standings.map(standingTeamId).filter(Boolean);
  const rankedTeams = orderTeamsByIds(ctx.availableTeams, rankedIds);
  const rankedSet = new Set(rankedTeams.map((team) => team.id));
  const poolTeams = [...rankedTeams, ...ctx.availableTeams.filter((team) => !rankedSet.has(team.id))].filter((team) => !selectedIds.includes(team.id));

  const groupAdvancePreset = !isDouble ? getGroupAdvancePreset(standings, ctx.availableTeams, 6) : null;
  const splitError = isDouble ? validateDoubleSplit(bracketSize, winnerTeamCount, loserTeamCount) : null;
  const entrantError = selectedIds.length < 2
    ? `至少需要 2 支队伍（当前 ${selectedIds.length}/${targetCount}）`
    : selectedIds.length > targetCount
      ? `入围队伍不能超过 ${targetCount} 支`
      : selectedIds.length < targetCount
        ? `还差 ${targetCount - selectedIds.length} 支入围队伍`
        : null;
  const canGenerate = Boolean(ctx.data.selectedTournamentId) && !submitting && entrantError === null && splitError === null;

  const updateMode = (nextMode: CompetitionMode) => {
    setMode(nextMode);
    if (nextMode === "double_elimination") {
      setBracketSize((current) => (current === 6 ? 4 : current));
      setLoserTeamCount(0);
    } else {
      setLoserTeamCount(0);
    }
  };

  const applyPreset = (preset: (typeof doubleEliminationPresets)[number]) => {
    setMode("double_elimination");
    setBracketSize(preset.bracketSize);
    setWinnerTeamCount(preset.winnerTeamCount);
    setLoserTeamCount(preset.loserTeamCount);
    setSelectedIds((current) => current.slice(0, preset.winnerTeamCount + preset.loserTeamCount));
  };

  const applyGroupAdvancePreset = () => {
    if (!groupAdvancePreset) return;
    if (selectedIds.length > 0 && selectedIds.join("|") !== groupAdvancePreset.teamIds.join("|") && !window.confirm(`确定用${groupAdvancePreset.label}覆盖当前 ${selectedIds.length} 支入围队伍？`)) return;
    setMode("single_elimination");
    setBracketSize(groupAdvancePreset.targetCount);
    setSelectedIds(groupAdvancePreset.teamIds);
  };

  const fillByRank = () => {
    const ids = [...rankedIds, ...ctx.availableTeams.filter((team) => !rankedSet.has(team.id)).map((team) => team.id)].slice(0, targetCount);
    if (selectedIds.length > 0 && selectedIds.join("|") !== ids.join("|") && !window.confirm(`确定用当前排名前 ${targetCount} 名覆盖入围名单？`)) return;
    setSelectedIds(ids);
  };

  const move = (teamId: string, direction: -1 | 1) => {
    setSelectedIds((current) => {
      const index = current.indexOf(teamId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) return current;
      const next = [...current];
      next.splice(index, 1);
      next.splice(target, 0, teamId);
      return next;
    });
  };

  const generate = async () => {
    if (!canGenerate) return;
    setSubmitting(true);
    try {
      const result = await ctx.runAction("生成淘汰赛对阵图", "POST", `/tournaments/${encodeURIComponent(ctx.data.selectedTournamentId)}/knockout-bracket`, {
        name: knockoutName.trim() || "淘汰赛",
        bracketType: mode,
        bracketSize,
        winnerTeamCount: isDouble ? winnerTeamCount : undefined,
        loserTeamCount: isDouble ? loserTeamCount : undefined,
        boType: "BO3",
        teamIds: selectedIds,
      });
      const payload = result.data as { stage?: { id?: string } } | undefined;
      if (result.ok && payload?.stage?.id) {
        await ctx.load(ctx.data.selectedTournamentId, payload.stage.id);
        onGenerated?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const seedRoles = buildSeedRoles({ bracketSize, targetCount, isDouble, winnerTeamCount, loserTeamCount });
  const structureHint = isDouble
    ? `共 ${targetCount} 支：前 ${winnerTeamCount} 支进入胜者组，后 ${Math.min(loserTeamCount, maxLoserTeamCount)} 支从败者组起步。`
    : bracketSize === 6
      ? "6 队单败：入围顺序第 1/2 名直接进入半决赛，第 3 vs 第 6、第 4 vs 第 5 先打一轮。"
      : `${bracketSize} 队单败：按入围顺序作为种子位生成首轮。`;

  return (
    <div className="stage-block">
      <div className="stage-block-head">
        <div>
          <h3>淘汰赛入围</h3>
          <p className="muted">按预赛排名把晋级队伍加入入围名单，顺序即初始种子。</p>
        </div>
      </div>

      {!preliminaryComplete ? (
        <p className="inline-warn">预赛赛果或排名还不完整。后端会在生成时再次校验；建议先补齐预赛再生成对阵图。</p>
      ) : null}

      <div className="knockout-setup-grid">
        <div className="knockout-setup-controls">
          <div className="form-row">
            <label className="field">
              <span className="field-label">赛制</span>
              <select value={mode} onChange={(event) => updateMode(event.target.value as CompetitionMode)}>
                <option value="single_elimination">单败</option>
                <option value="double_elimination">双败</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">{isDouble ? "胜者组容量" : "规模"}</span>
              <select value={bracketSize} onChange={(event) => setBracketSize(Number(event.target.value))}>
                {(isDouble ? [4, 8, 16] : [4, 6, 8, 16]).map((size) => <option key={size} value={size}>{isDouble ? `胜者组 ${size}` : size === 6 ? "6 队（前二进半决赛）" : `${size} 队`}</option>)}
              </select>
            </label>
            {isDouble ? (
              <>
                <label className="field">
                  <span className="field-label">胜者组</span>
                  <input type="number" min={2} max={bracketSize} value={winnerTeamCount} onChange={(event) => {
                    const next = clampInteger(Number(event.target.value), 2, bracketSize);
                    setWinnerTeamCount(next);
                    const nextMax = next <= 4 ? Math.min(4, Math.floor(bracketSize / 2)) : 0;
                    setLoserTeamCount((current) => Math.min(current, nextMax));
                  }} />
                </label>
                <label className="field">
                  <span className="field-label">初始败者组</span>
                  <input type="number" min={0} max={maxLoserTeamCount} value={loserTeamCount} onChange={(event) => setLoserTeamCount(clampInteger(Number(event.target.value), 0, maxLoserTeamCount))} disabled={maxLoserTeamCount === 0} />
                </label>
              </>
            ) : null}
            <label className="field">
              <span className="field-label">阶段名称</span>
              <input value={knockoutName} onChange={(event) => setKnockoutName(event.target.value)} />
            </label>
          </div>
          {isDouble ? (
            <div className="preset-row">
              {doubleEliminationPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={bracketSize === preset.bracketSize && winnerTeamCount === preset.winnerTeamCount && loserTeamCount === preset.loserTeamCount ? "chip-toggle is-active" : "chip-toggle"}
                  onClick={() => applyPreset(preset)}
                  title={preset.title}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <p className="muted">{structureHint}</p>
          {groupAdvancePreset ? (
            <button type="button" className="suggestion-strip is-clickable" onClick={applyGroupAdvancePreset} title={groupAdvancePreset.text}>
              推荐入围：<strong>{groupAdvancePreset.label}</strong>（{groupAdvancePreset.text}）
            </button>
          ) : null}
        </div>

        <div className="knockout-entrants">
          <div className="knockout-entrants-head">
            <strong>入围名单（{selectedIds.length}/{targetCount}）</strong>
            <div>
              <button type="button" className="btn btn-ghost btn-xs" onClick={fillByRank} disabled={poolTeams.length === 0 && selectedIds.length >= targetCount}>按排名填满</button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>清空</button>
            </div>
          </div>
          <ol className="entrant-list">
            {selectedTeams.map((team, index) => (
              <li key={team.id} className="entrant-row">
                <span className="entrant-seed" title={seedRoles[index]?.detail ?? `Seed ${index + 1}`}>{index + 1}</span>
                <TeamChip team={team} size="small" badge={seedRoles[index] ? <em className={`chip-badge is-${seedRoles[index]!.tone}`}>{seedRoles[index]!.badge}</em> : undefined} />
                <span className="entrant-actions">
                  <button type="button" className="icon-btn" onClick={() => move(team.id, -1)} disabled={index === 0} aria-label={`上移 ${team.name}`}><ArrowUp size={13} /></button>
                  <button type="button" className="icon-btn" onClick={() => move(team.id, 1)} disabled={index === selectedTeams.length - 1} aria-label={`下移 ${team.name}`}><ArrowDown size={13} /></button>
                  <button type="button" className="icon-btn" onClick={() => setSelectedIds((current) => current.filter((id) => id !== team.id))} aria-label={`移出 ${team.name}`}><X size={13} /></button>
                </span>
              </li>
            ))}
            {selectedTeams.length === 0 ? <li className="muted">从下方候选池加入晋级队伍。</li> : null}
          </ol>
          <div className="knockout-pool">
            <strong className="knockout-pool-title">候选池（按预赛排名）</strong>
            <div className="knockout-pool-list">
              {poolTeams.length === 0 ? <span className="muted">没有剩余可选队伍。</span> : poolTeams.map((team) => {
                const row = standings.find((item) => standingTeamId(item) === team.id);
                return (
                  <button key={team.id} type="button" className="pool-team-btn" onClick={() => setSelectedIds((current) => current.length >= targetCount || current.includes(team.id) ? current : [...current, team.id])} disabled={selectedIds.length >= targetCount} title={row ? `排名 ${row.rank} · ${row.seriesWins}-${row.seriesDraws}-${row.seriesLosses} · ${row.points} 分` : team.name}>
                    <TeamChip team={team} size="small" badge={row ? <em className="chip-badge">#{row.rank}</em> : undefined} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="stage-block-footer">
        <span className={entrantError || splitError ? "inline-warn" : "muted"}>{splitError ?? entrantError ?? `${selectedIds.length} 支入围队伍已就绪`}</span>
        <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={!canGenerate}>
          <Brackets size={15} /> 生成{isDouble ? `双败 ${targetCount} 队` : bracketSize === 6 ? "6 队单败" : `${bracketSize} 队单败`}对阵图
        </button>
      </div>
    </div>
  );
}

function BracketBoard({ ctx, bracket }: { ctx: TournamentCtx; bracket: BracketNode[] }) {
  const nodeLookup = useMemo(() => new Map(bracket.map((node) => [node.id, node])), [bracket]);
  const slotSummary = getBracketSlotSummary(bracket);
  const placedIds = new Set(bracket.flatMap((node) => [node.radiantTeam?.id, node.direTeam?.id].filter((id): id is string => Boolean(id))));
  const entrantIds = ctx.stage ? stageConfigStringList(ctx.stage, "teamIds") : [];
  const entrantPool = (entrantIds.length > 0 ? orderTeamsByIds(ctx.availableTeams, entrantIds) : ctx.availableTeams)
    .filter((team) => !placedIds.has(team.id));
  const readyCount = bracket.filter((node) => node.winnerTeamId === null && node.radiantTeam !== null && node.direTeam !== null).length;
  const completedCount = bracket.filter((node) => node.winnerTeamId !== null).length;

  if (bracket.length === 0) {
    return <p className="muted">对阵图还没有节点。如果从零开始，请回到预赛阶段生成对阵图。</p>;
  }

  return (
    <div className="stage-block">
      <div className="stage-block-head">
        <div>
          <h3>对阵图</h3>
          <p className="muted">
            {slotSummary.filledSlots}/{slotSummary.totalSlots} 槽位已落位 · {readyCount} 场待判胜 · {completedCount}/{bracket.length} 完成
          </p>
        </div>
      </div>
      <div className="bracket-groups">
        {groupBracketNodes(bracket).map((group) => (
          <section key={group.key} className={`bracket-group is-${group.bracketGroup}`}>
            <header className="bracket-group-head">
              <strong>{bracketGroupLaneLabel(group.bracketGroup)}</strong>
              <span className="muted">{group.columns.length} 轮</span>
            </header>
            <div className="bracket-columns">
              {group.columns.map((column) => (
                <div key={column.key} className="bracket-column">
                  <header className="bracket-column-head"><strong>{column.roundName}</strong></header>
                  {column.nodes.map((node) => (
                    <BracketNodeCard key={node.id} node={node} nodeLookup={nodeLookup} slotSummary={slotSummary} entrantPool={entrantPool} ctx={ctx} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function BracketNodeCard({ node, nodeLookup, slotSummary, entrantPool, ctx }: {
  node: BracketNode;
  nodeLookup: Map<string, BracketNode>;
  slotSummary: ReturnType<typeof getBracketSlotSummary>;
  entrantPool: TeamBrief[];
  ctx: TournamentCtx;
}) {
  const radiantTeam = node.radiantTeam;
  const direTeam = node.direTeam;
  const canPick = node.winnerTeamId === null && radiantTeam !== null && direTeam !== null;
  const winnerTeam = [radiantTeam, direTeam].find((team) => team?.id === node.winnerTeamId) ?? null;
  const winnerTarget = formatBracketTarget(nodeLookup, node.nextNodeId, node.nextSlot);
  const loserTarget = node.loserNextNodeId ? formatBracketTarget(nodeLookup, node.loserNextNodeId, node.loserNextSlot) : "淘汰";

  const advance = async (winnerTeamId: string, winnerName: string) => {
    if (!window.confirm(`确认 ${winnerName} 获胜？胜者进入 ${winnerTarget}，负者${loserTarget === "淘汰" ? "淘汰" : `进入 ${loserTarget}`}。`)) return;
    await ctx.runAction("选择胜者", "POST", `/bracket-nodes/${encodeURIComponent(node.id)}/winner`, { winnerTeamId, actor: "admin" });
  };

  return (
    <article className={["bracket-node", node.winnerTeamId ? "is-complete" : "", canPick ? "is-ready" : ""].filter(Boolean).join(" ")}>
      <header className="bracket-node-head">
        <span>#{node.position}</span>
        <span className="muted">{node.series ? `${node.series.boType}` : ""}</span>
      </header>
      <BracketSlotRow node={node} slot="radiant" team={radiantTeam} isWinner={node.winnerTeamId === radiantTeam?.id} locked={node.winnerTeamId !== null} waiting={!radiantTeam && slotSummary.incomingSlotKeys.has(`${node.id}:radiant`)} entrantPool={entrantPool} ctx={ctx} />
      <BracketSlotRow node={node} slot="dire" team={direTeam} isWinner={node.winnerTeamId === direTeam?.id} locked={node.winnerTeamId !== null} waiting={!direTeam && slotSummary.incomingSlotKeys.has(`${node.id}:dire`)} entrantPool={entrantPool} ctx={ctx} />
      {canPick && radiantTeam && direTeam ? (
        <div className="bracket-pick">
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => void advance(radiantTeam.id, radiantTeam.name)} title={`${radiantTeam.name} 获胜`}><Check size={12} /> {radiantTeam.name} 胜</button>
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => void advance(direTeam.id, direTeam.name)} title={`${direTeam.name} 获胜`}><Check size={12} /> {direTeam.name} 胜</button>
        </div>
      ) : null}
      {winnerTeam ? (
        <div className="bracket-winner">
          <Trophy size={13} />
          <span>{winnerTeam.name} 晋级</span>
          <ConfirmButton className="btn btn-ghost-danger btn-xs" confirmText={`确认撤销 ${winnerTeam.name} 的晋级结果？后续由该结果推进的槽位、赛果会同步回退。`} onConfirm={() => ctx.runAction("撤销胜者", "DELETE", `/bracket-nodes/${encodeURIComponent(node.id)}/winner`, { actor: "admin" })}>
            <RotateCcw size={12} /> 撤销
          </ConfirmButton>
        </div>
      ) : null}
      <footer className="bracket-flow">
        <span>胜者 → {winnerTarget}</span>
        <span>负者 → {loserTarget}</span>
      </footer>
    </article>
  );
}

function BracketSlotRow({ node, slot, team, isWinner, locked, waiting, entrantPool, ctx }: {
  node: BracketNode;
  slot: BracketSlotName;
  team: TeamBrief | null;
  isWinner: boolean;
  locked: boolean;
  waiting: boolean;
  entrantPool: TeamBrief[];
  ctx: TournamentCtx;
}) {
  const setSlot = async (teamId: string | null) => {
    await ctx.runAction("调整槽位", "PATCH", `/bracket-nodes/${encodeURIComponent(node.id)}/slot`, { slot, teamId, actor: "admin" });
  };

  return (
    <div className={["bracket-slot", slot === "radiant" ? "is-radiant" : "is-dire", isWinner ? "is-winner" : "", team ? "has-team" : ""].filter(Boolean).join(" ")}>
      <span className="bracket-slot-side">{slot === "radiant" ? "上" : "下"}</span>
      {team ? (
        <>
          <TeamChip team={team} size="small" badge={isWinner ? <em className="chip-badge is-seed">胜者</em> : undefined} />
          {!locked ? (
            <button type="button" className="icon-btn" onClick={() => void setSlot(null)} aria-label={`清空${slot === "radiant" ? "上位" : "下位"}槽位`} title="清空槽位"><Trash2 size={12} /></button>
          ) : null}
        </>
      ) : waiting ? (
        <span className="muted">等上游胜者</span>
      ) : (
        <select value="" onChange={(event) => { if (event.target.value) void setSlot(event.target.value); }} disabled={locked || entrantPool.length === 0} aria-label={`填入${slot === "radiant" ? "上位" : "下位"}槽位`}>
          <option value="">{locked ? "已锁定" : entrantPool.length === 0 ? "无候选" : "填入…"}</option>
          {entrantPool.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      )}
    </div>
  );
}

function buildSeedRoles(props: { bracketSize: number; targetCount: number; isDouble: boolean; winnerTeamCount: number; loserTeamCount: number }) {
  const winnerSeedSize = props.isDouble && props.loserTeamCount > 0 && props.winnerTeamCount <= 4 ? 4 : props.bracketSize;
  const seedOrder = getSeedSlotOrder(winnerSeedSize);
  const opponentOf = (seed: number): number | null => {
    for (let index = 0; index < seedOrder.length; index += 2) {
      const left = seedOrder[index];
      const right = seedOrder[index + 1];
      if (left === seed) return right ?? null;
      if (right === seed) return left ?? null;
    }
    return null;
  };

  return Array.from({ length: props.targetCount }, (_, index) => {
    const seed = index + 1;
    if (props.isDouble) {
      if (index < props.winnerTeamCount) {
        const opponent = opponentOf(seed);
        return { badge: `胜者S${seed}`, detail: opponent ? `胜者组 Seed ${seed}，首轮对 Seed ${opponent}` : `胜者组 Seed ${seed}`, tone: "winner" as const };
      }
      const loserSeed = index - props.winnerTeamCount + 1;
      return { badge: `败者${loserSeed}`, detail: `初始败者组第 ${loserSeed} 位，输后即淘汰`, tone: "loser" as const };
    }
    if (props.bracketSize === 6) {
      if (seed === 1 || seed === 2) return { badge: `S${seed} 半决赛`, detail: seed === 1 ? "Seed 1 直接等待 4/5 胜者" : "Seed 2 直接等待 3/6 胜者", tone: "wait" as const };
      const opponent = seed === 3 ? 6 : seed === 6 ? 3 : seed === 4 ? 5 : 4;
      return { badge: `S${seed} 首轮`, detail: `第一轮对 Seed ${opponent}`, tone: "play" as const };
    }
    const opponent = opponentOf(seed);
    return { badge: `S${seed}`, detail: opponent ? `首轮对 Seed ${opponent}` : `Seed ${seed}`, tone: "play" as const };
  });
}

function validateDoubleSplit(bracketSize: number, winnerTeamCount: number, loserTeamCount: number): string | null {
  if (loserTeamCount === 0) return null;
  if (winnerTeamCount <= 4 && loserTeamCount <= 4) return null;
  return `当前初始败者组只支持胜者组最多 4 支、败者组最多 ${Math.min(4, Math.floor(bracketSize / 2))} 支；需要完整 ${bracketSize} 队双败时请把败者组设为 0。`;
}

function getGroupAdvancePreset(rows: StandingRow[], teams: TeamBrief[], targetCount: number): { label: string; text: string; teamIds: string[]; targetCount: number } | null {
  const teamIds = new Set(teams.map((team) => team.id));
  const groupedRows = new Map<string, StandingRow[]>();

  for (const row of rows) {
    const teamId = standingTeamId(row);
    const groupName = row.groupName?.trim();
    if (!teamId || !teamIds.has(teamId) || !groupName) continue;
    const bucket = groupedRows.get(groupName) ?? [];
    bucket.push(row);
    groupedRows.set(groupName, bucket);
  }

  const groups = [...groupedRows.entries()]
    .map(([name, groupRows]) => ({ name, rows: [...groupRows].sort((left, right) => left.rank - right.rank) }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN", { numeric: true }));

  if (groups.length < 2 || targetCount % groups.length !== 0) return null;
  const perGroup = targetCount / groups.length;
  if (perGroup < 1 || groups.some((group) => group.rows.length < perGroup)) return null;

  const seededIds: string[] = [];
  for (let rankIndex = 0; rankIndex < perGroup; rankIndex += 1) {
    for (const group of groups) {
      const row = group.rows[rankIndex];
      const teamId = row ? standingTeamId(row) : "";
      if (teamId && !seededIds.includes(teamId)) seededIds.push(teamId);
    }
  }

  if (seededIds.length !== targetCount) return null;

  return {
    label: groups.length === 2 && perGroup === 3 && targetCount === 6 ? "两组前三 · 6 队单败" : `${groups.length} 组前 ${perGroup} · ${targetCount} 队`,
    text: "按组内排名逐档填入种子位",
    teamIds: seededIds,
    targetCount,
  };
}
