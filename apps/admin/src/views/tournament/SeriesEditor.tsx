import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, Plus, X } from "lucide-react";
import type { RoundBrief, SeriesSummary, StageGroup, StageRound, StageSummary, TeamBrief } from "../../api";
import { serializeDatetimeLocal, toDatetimeLocalInput } from "../../app/format";
import { Field, Spinner } from "../../components/ui";
import { TeamChip } from "../../components/TeamChip";
import type { TournamentCtx } from "./context";
import type { TeamPair } from "../../app/domain";

export interface SeriesDraftValue {
  radiantTeamId: string;
  direTeamId: string;
  roundId: string;
  roundName: string;
  groupId: string;
  seriesKind: "regular" | "tiebreaker";
  scheduledAt: string;
}

export const emptySeriesDraft: SeriesDraftValue = {
  radiantTeamId: "",
  direTeamId: "",
  roundId: "",
  roundName: "",
  groupId: "",
  seriesKind: "regular",
  scheduledAt: "",
};

export function TeamSelect({ teams, value, excludeId, onChange, placeholder, disabled }: {
  teams: TeamBrief[];
  value: string;
  excludeId?: string;
  onChange: (teamId: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id} disabled={team.id === excludeId}>{team.name}</option>
      ))}
    </select>
  );
}

export function SeriesEditorPanel({ ctx, stage, groups, rounds, editingSeries, suggestion, onDone }: {
  ctx: TournamentCtx;
  stage: StageSummary;
  groups: StageGroup[];
  rounds: StageRound[];
  editingSeries: SeriesSummary | null;
  suggestion: { pair: TeamPair; groupId?: string; label: string } | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<SeriesDraftValue>(emptySeriesDraft);
  const [submitting, setSubmitting] = useState(false);
  const isGroupStage = stage.type === "group";
  const isEdit = editingSeries !== null;

  useEffect(() => {
    if (editingSeries) {
      setDraft({
        radiantTeamId: editingSeries.radiantTeam.id,
        direTeamId: editingSeries.direTeam.id,
        roundId: editingSeries.roundId,
        roundName: "",
        groupId: editingSeries.groupId ?? "",
        seriesKind: editingSeries.seriesKind === "tiebreaker" ? "tiebreaker" : "regular",
        scheduledAt: toDatetimeLocalInput(editingSeries.scheduledAt),
      });
      return;
    }
    setDraft((current) => ({
      ...emptySeriesDraft,
      groupId: current.groupId || groups[0]?.id || "",
      roundId: current.roundId,
    }));
  }, [editingSeries, groups]);

  const selectedGroupId = isGroupStage ? draft.groupId || groups[0]?.id || "" : "";
  const groupTeams = useMemo(
    () => (selectedGroupId ? groups.find((group) => group.id === selectedGroupId)?.teams ?? [] : []),
    [groups, selectedGroupId],
  );
  const candidateTeams = isGroupStage && selectedGroupId ? groupTeams : ctx.availableTeams;
  const radiantTeam = candidateTeams.find((team) => team.id === draft.radiantTeamId)
    ?? ctx.availableTeams.find((team) => team.id === draft.radiantTeamId)
    ?? null;
  const direTeam = candidateTeams.find((team) => team.id === draft.direTeamId)
    ?? ctx.availableTeams.find((team) => team.id === draft.direTeamId)
    ?? null;

  const patch = (value: Partial<SeriesDraftValue>) => setDraft((current) => ({ ...current, ...value }));

  const applySuggestion = () => {
    if (!suggestion) return;
    patch({
      radiantTeamId: suggestion.pair.left.id,
      direTeamId: suggestion.pair.right.id,
      groupId: suggestion.groupId ?? draft.groupId,
      seriesKind: "regular",
    });
  };

  const swap = () => patch({ radiantTeamId: draft.direTeamId, direTeamId: draft.radiantTeamId });

  const canSubmit = Boolean(draft.radiantTeamId && draft.direTeamId && draft.radiantTeamId !== draft.direTeamId && (isEdit ? draft.roundId : true)) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEdit && editingSeries) {
        const result = await ctx.runAction("保存对阵修改", "PATCH", `/series/${encodeURIComponent(editingSeries.id)}`, {
          roundId: draft.roundId,
          groupId: isGroupStage ? selectedGroupId || null : null,
          seriesKind: isGroupStage ? draft.seriesKind : "regular",
          scheduledAt: draft.scheduledAt ? serializeDatetimeLocal(draft.scheduledAt) : "",
          radiantTeamId: draft.radiantTeamId,
          direTeamId: draft.direTeamId,
        });
        if (result.ok) onDone();
        return;
      }

      let roundId = draft.roundId;
      if (!roundId) {
        const roundResult = await ctx.runAction("创建轮次", "POST", "/rounds", {
          stageId: stage.id,
          name: draft.roundName.trim() || defaultRoundName(stage, rounds.length + 1),
          roundNumber: Math.max(0, ...rounds.map((round) => round.roundNumber)) + 1,
          status: "draft",
          pairingStatus: stage.type === "swiss" ? "draft" : undefined,
        }, { silent: true });
        if (!roundResult.ok) {
          ctx.notify("warn", `创建轮次：${roundResult.message}`);
          return;
        }
        roundId = (roundResult.data as RoundBrief | undefined)?.id ?? "";
      }
      if (!roundId) {
        ctx.notify("warn", "轮次创建失败，无法继续创建对阵。");
        return;
      }

      const result = await ctx.runAction("创建对阵", "POST", "/series", {
        stageId: stage.id,
        roundId,
        groupId: isGroupStage ? selectedGroupId || null : null,
        seriesKind: isGroupStage ? draft.seriesKind : "regular",
        boType: "BO2",
        status: "draft",
        scheduledAt: draft.scheduledAt ? serializeDatetimeLocal(draft.scheduledAt) : "",
        radiantTeamId: draft.radiantTeamId,
        direTeamId: draft.direTeamId,
      });
      if (result.ok) {
        setDraft((current) => ({ ...emptySeriesDraft, groupId: current.groupId }));
        onDone();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="series-editor">
      <div className="series-editor-main">
        {isGroupStage ? (
          <Field label="小组">
            <select value={selectedGroupId} onChange={(event) => patch({ groupId: event.target.value, radiantTeamId: "", direTeamId: "" })} disabled={submitting}>
              {groups.length === 0 ? <option value="">未创建小组</option> : groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </Field>
        ) : null}
        <div className="series-editor-teams">
          <TeamSelect teams={candidateTeams} value={draft.radiantTeamId} excludeId={draft.direTeamId} onChange={(teamId) => patch({ radiantTeamId: teamId })} placeholder="选择左侧队伍" disabled={submitting} />
          <button type="button" className="icon-btn" onClick={swap} disabled={submitting || (!radiantTeam && !direTeam)} title="交换左右" aria-label="交换左右"><ArrowLeftRight size={15} /></button>
          <TeamSelect teams={candidateTeams} value={draft.direTeamId} excludeId={draft.radiantTeamId} onChange={(teamId) => patch({ direTeamId: teamId })} placeholder="选择右侧队伍" disabled={submitting} />
        </div>
        <div className="series-editor-preview">
          {radiantTeam ? <TeamChip team={radiantTeam} /> : <span className="muted">左侧待选</span>}
          <b>VS</b>
          {direTeam ? <TeamChip team={direTeam} /> : <span className="muted">右侧待选</span>}
        </div>
        <div className="form-row">
          <Field label="轮次">
            <select value={draft.roundId} onChange={(event) => patch({ roundId: event.target.value })} disabled={submitting}>
              {isEdit ? null : <option value="">新建轮次</option>}
              {rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}
            </select>
          </Field>
          {!isEdit && !draft.roundId ? (
            <Field label="新轮次名称">
              <input value={draft.roundName} onChange={(event) => patch({ roundName: event.target.value })} placeholder={defaultRoundName(stage, rounds.length + 1)} disabled={submitting} />
            </Field>
          ) : null}
          <Field label="计划时间">
            <input type="datetime-local" value={draft.scheduledAt} onChange={(event) => patch({ scheduledAt: event.target.value })} disabled={submitting} />
          </Field>
          {isGroupStage ? (
            <Field label="类型">
              <select value={draft.seriesKind} onChange={(event) => patch({ seriesKind: event.target.value as "regular" | "tiebreaker" })} disabled={submitting}>
                <option value="regular">常规赛（计积分）</option>
                <option value="tiebreaker">加赛（不计积分）</option>
              </select>
            </Field>
          ) : null}
        </div>
      </div>
      <div className="series-editor-actions">
        {!isEdit && suggestion ? (
          <button type="button" className="btn btn-ghost" onClick={applySuggestion} disabled={submitting} title={`填入：${suggestion.label}`}>
            填入推荐：{suggestion.label}
          </button>
        ) : null}
        <span className="series-editor-spacer" />
        {isEdit ? <button type="button" className="btn btn-ghost" onClick={onDone} disabled={submitting}><X size={14} /> 取消</button> : null}
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={!canSubmit}>
          {submitting ? <Spinner size={14} /> : isEdit ? <Check size={14} /> : <Plus size={14} />}
          {isEdit ? "保存修改" : "创建 BO2 对阵"}
        </button>
      </div>
    </div>
  );
}

function defaultRoundName(stage: StageSummary, roundNumber: number): string {
  if (stage.type === "swiss") return `瑞士轮第 ${roundNumber} 轮`;
  if (stage.type === "group") return `小组赛第 ${roundNumber} 轮`;
  return `第 ${roundNumber} 轮`;
}
