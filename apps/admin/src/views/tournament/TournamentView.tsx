import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, GitBranch, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { sendAdminRequest, type SeriesSummary, type StageSummary, type TournamentDetail } from "../../api";
import {
  isKnockoutStage,
  isOfficialScheduleStage,
  isPreliminaryStage,
  labelKnockout,
  labelPreliminary,
  labelScheduleStatus,
  labelStageType,
  labelStageStatus,
  labelTournamentStatus,
  toneForStatus,
} from "../../app/format";
import { ConfirmButton, EmptyPanel, SectionCard, StatusPill } from "../../components/ui";
import type { AdminData } from "../../app/store";
import type { TournamentCtx } from "./context";
import { CreateTournamentModal } from "./CreateTournamentModal";
import { RosterEditor } from "./RosterEditor";
import { SeriesEditorPanel } from "./SeriesEditor";
import { SeriesBoard } from "./SeriesBoard";
import { Standings } from "./Standings";
import { GroupStage } from "./GroupStage";
import { SwissStage } from "./SwissStage";
import { KnockoutStage, KnockoutEntrantSetup } from "./KnockoutStage";

export function TournamentView({ data, load, runAction, notify }: {
  data: AdminData;
  load: (preferredTournamentId?: string, preferredStageId?: string) => Promise<void>;
  runAction: TournamentCtx["runAction"];
  notify: TournamentCtx["notify"];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const officialStages = useMemo(() => data.detail?.stages.filter(isOfficialScheduleStage) ?? [], [data.detail]);
  const selectedStage = useMemo(
    () => officialStages.find((stage) => stage.id === data.selectedStageId) ?? officialStages[0] ?? null,
    [officialStages, data.selectedStageId],
  );
  const schedule = data.schedule;
  const published = schedule?.status === "published";
  const availableTeams = useMemo(
    () => (schedule?.rosterLocked && schedule.teams.length > 0 ? schedule.teams.map((item) => item.team) : data.teams),
    [schedule, data.teams],
  );

  const ctx: TournamentCtx = {
    data,
    stage: selectedStage,
    officialStages,
    availableTeams,
    published,
    load,
    runAction,
    notify,
  };

  const runningTournaments = data.tournaments.filter((item) => item.status === "running");

  const handleCreated = async (created: TournamentDetail | null, syncOpenDota: boolean) => {
    setCreateOpen(false);
    const createdId = created?.id ?? "";
    if (created && created.status === "running") {
      for (const running of runningTournaments) {
        await sendAdminRequest(`/tournaments/${encodeURIComponent(running.id)}/lifecycle`, "PATCH", { status: "completed" });
      }
    }
    await load(createdId, "");
    if (syncOpenDota && createdId) {
      notify("info", "新联赛已创建，正在从 OpenDota 拉取比赛记录...");
      const result = await sendAdminRequest(`/tournaments/${encodeURIComponent(createdId)}/sync-opendota?limit=300`, "POST");
      notify(result.ok ? "good" : "warn", result.ok ? "OpenDota 比赛记录同步完成。" : `OpenDota 同步未完成：${result.message}`);
      if (result.ok) await load(createdId, "");
    } else {
      notify("good", "届次已创建。");
    }
  };

  if (!data.detail) {
    return (
      <div className="view-stack">
        <EmptyPanel
          title={data.loading ? "正在加载..." : "还没有届次"}
          text={data.loading ? undefined : "先创建第一届大联赛，再搭建官方赛程。"}
          action={!data.loading ? <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> 新建届次</button> : undefined}
        />
        {createOpen ? <CreateTournamentModal runningNames={runningTournaments.map((item) => item.name)} onClose={() => setCreateOpen(false)} onCreated={handleCreated} /> : null}
      </div>
    );
  }

  return (
    <div className="view-stack">
      <TournamentHeader data={data} ctx={ctx} onOpenCreate={() => setCreateOpen(true)} />
      {published ? (
        <div className="published-banner" role="note">
          <StatusPill tone="good">已发布</StatusPill>
          <span>H5 正在展示当前官方赛程。所有修改（赛果、分组、对阵图）都会立即生效并同步到 H5，无需撤回。</span>
          <ConfirmButton className="btn btn-ghost btn-sm" confirmText="撤回后 H5 赛程页会显示“赛程暂未发布”。确认撤回？" onConfirm={() => runAction("撤回发布", "POST", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/schedule-management/withdraw`, { actor: "admin" })}>
            <RotateCcw size={13} /> 撤回发布
          </ConfirmButton>
        </div>
      ) : null}
      <ScheduleSetup ctx={ctx} />
      <StageWorkspace ctx={ctx} />
      {createOpen ? <CreateTournamentModal runningNames={runningTournaments.map((item) => item.name)} onClose={() => setCreateOpen(false)} onCreated={handleCreated} /> : null}
    </div>
  );
}

function TournamentHeader({ data, ctx, onOpenCreate }: { data: AdminData; ctx: TournamentCtx; onOpenCreate: () => void }) {
  const detail = data.detail!;
  const runningTournaments = data.tournaments.filter((item) => item.id !== data.selectedTournamentId && item.status === "running");

  const setStatus = async (nextStatus: "running" | "completed") => {
    if (nextStatus === "running") {
      const message = runningTournaments.length > 0
        ? `确认把“${detail.name}”设为进行中？“${runningTournaments.map((item) => item.name).join("、")}”会自动改为已完成。`
        : `确认把“${detail.name}”设为进行中？`;
      if (!window.confirm(message)) return;
      for (const running of runningTournaments) {
        const result = await sendAdminRequest(`/tournaments/${encodeURIComponent(running.id)}/lifecycle`, "PATCH", { status: "completed" });
        if (!result.ok) {
          ctx.notify("warn", `结束“${running.name}”失败：${result.message}`);
          return;
        }
      }
      await ctx.runAction("设为进行中", "PATCH", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/lifecycle`, { status: "running" });
      return;
    }
    if (!window.confirm(`确认结束“${detail.name}”？该届次会标记为已完成。`)) return;
    await ctx.runAction("结束届次", "PATCH", `/tournaments/${encodeURIComponent(data.selectedTournamentId)}/lifecycle`, { status: "completed" });
  };

  return (
    <SectionCard
      title={<span className="tournament-title">{detail.name} <StatusPill tone={toneForStatus(detail.status)}>{labelTournamentStatus(detail.status)}</StatusPill></span>}
      desc={`赛季：${detail.season?.name ?? "-"} · league_id：${detail.league?.opendotaLeagueId ?? "未配置"}${detail.league?.opendotaLeagueId ? "" : "（无 league_id 时不能自动同步比赛记录）"}`}
      aside={
        <div className="row-actions">
          {detail.status !== "running" ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setStatus("running")}><Play size={13} /> 设为进行中</button> : null}
          {detail.status !== "completed" ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setStatus("completed")}><Check size={13} /> 结束届次</button> : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenCreate}><Plus size={13} /> 新建届次</button>
        </div>
      }
    >
      <div className="tournament-metrics">
        <div><span>参赛队</span><strong>{detail.teamCount ?? data.teams.length}</strong></div>
        <div><span>比赛记录</span><strong>{detail.matchCount ?? data.matches.length}</strong></div>
        <div><span>官方阶段</span><strong>{ctx.officialStages.length}</strong></div>
        <div><span>赛程状态</span><strong>{labelScheduleStatus(data.schedule?.status)}</strong></div>
      </div>
    </SectionCard>
  );
}

function ScheduleSetup({ ctx }: { ctx: TournamentCtx }) {
  const schedule = ctx.data.schedule;
  const configured = Boolean(schedule?.rosterLocked && schedule.preliminaryType && schedule.knockoutType);
  const [open, setOpen] = useState(!configured);

  useEffect(() => {
    if (!configured) setOpen(true);
  }, [configured]);

  return (
    <SectionCard
      title="基础设置"
      desc={`名单 ${schedule?.rosterLocked ? `${schedule.teams.length} 队已锁定` : "未锁定"} · 赛制 ${labelPreliminary(schedule?.preliminaryType)} + ${labelKnockout(schedule?.knockoutType)}`}
      aside={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((current) => !current)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "收起" : "展开"}
        </button>
      }
    >
      {open ? (
        <div className="setup-grid">
          <section className="setup-block">
            <h3><GitBranch size={15} /> 参赛名单</h3>
            <RosterEditor ctx={ctx} />
          </section>
          <section className="setup-block">
            <h3><GitBranch size={15} /> 赛制与发布</h3>
            <FormatAndPublish ctx={ctx} />
          </section>
        </div>
      ) : null}
    </SectionCard>
  );
}

function FormatAndPublish({ ctx }: { ctx: TournamentCtx }) {
  const schedule = ctx.data.schedule;
  const [preliminaryType, setPreliminaryType] = useState<"group" | "swiss">(schedule?.preliminaryType === "swiss" ? "swiss" : "group");
  const [knockoutType, setKnockoutType] = useState<"single_elimination" | "double_elimination">(schedule?.knockoutType === "double_elimination" ? "double_elimination" : "single_elimination");
  const [swissRounds, setSwissRounds] = useState(5);
  const [groupCount, setGroupCount] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPreliminaryType(schedule?.preliminaryType === "swiss" ? "swiss" : "group");
    setKnockoutType(schedule?.knockoutType === "double_elimination" ? "double_elimination" : "single_elimination");
  }, [schedule?.preliminaryType, schedule?.knockoutType]);

  const dirty = preliminaryType !== (schedule?.preliminaryType ?? "") || knockoutType !== (schedule?.knockoutType ?? "");
  const preliminaryStage = ctx.officialStages.find(isPreliminaryStage);
  const knockoutStage = ctx.officialStages.find(isKnockoutStage);
  const changeBlocked = preliminaryStage && preliminaryType !== (schedule?.preliminaryType ?? "")
    ? `预赛阶段“${preliminaryStage.name}”已创建，不能直接改预赛赛制；如需更换请先重置官方赛程。`
    : knockoutStage && knockoutType !== (schedule?.knockoutType ?? "")
      ? `淘汰赛阶段“${knockoutStage.name}”已创建，不能直接改淘汰赛赛制；如需更换请先重置官方赛程。`
      : "";

  const readiness = getPublishReadiness(ctx);
  const missingPieces: string[] = [];
  if (!schedule?.rosterLocked) missingPieces.push("锁定参赛名单");
  if (!schedule?.preliminaryType) missingPieces.push("选择预赛赛制");
  if (!schedule?.knockoutType) missingPieces.push("选择淘汰赛赛制");
  if (schedule?.rosterLocked && schedule.preliminaryType && schedule.knockoutType && !readiness.hasPreliminaryStage) missingPieces.push("创建预赛阶段");
  if (readiness.hasPreliminaryStage && !readiness.hasPreliminarySeries) missingPieces.push("创建预赛对阵");
  const readyToPublish = missingPieces.length === 0;

  const saveFormat = async () => {
    setSubmitting(true);
    try {
      await ctx.runAction("保存赛制", "PATCH", `/tournaments/${encodeURIComponent(ctx.data.selectedTournamentId)}/schedule-management`, { preliminaryType, knockoutType, actor: "admin" });
    } finally {
      setSubmitting(false);
    }
  };

  const createPreliminary = async () => {
    if (!schedule?.rosterLocked || !schedule.preliminaryType || !schedule.knockoutType) {
      ctx.notify("warn", "请先锁定参赛名单并保存赛制。");
      return;
    }
    const type = schedule.preliminaryType === "swiss" ? "swiss" : "group";
    const label = type === "swiss" ? "瑞士轮" : "小组赛";
    const stageResult = await ctx.runAction("创建预赛阶段", "POST", "/stages", {
      tournamentId: ctx.data.selectedTournamentId,
      name: `${label}预赛`,
      type,
      advancementRule: type === "swiss" ? `瑞士轮 ${swissRounds} 轮 · BO2` : "小组赛 · BO2",
      config: { officialSchedule: true, boType: "BO2", swissRounds: type === "swiss" ? swissRounds : undefined },
    }, { silent: true });
    if (!stageResult.ok) {
      ctx.notify("warn", `创建预赛阶段：${stageResult.message}`);
      return;
    }
    const createdStage = stageResult.data as StageSummary | undefined;

    if (type === "group" && createdStage?.id) {
      const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let index = 0; index < groupCount; index += 1) {
        const groupResult = await sendAdminRequest(`/stages/${encodeURIComponent(createdStage.id)}/groups`, "POST", {
          name: `${labels[index] ?? index + 1} 组`,
          sortOrder: index + 1,
        });
        if (!groupResult.ok) {
          ctx.notify("warn", `创建小组：${groupResult.message}`);
          await ctx.load(ctx.data.selectedTournamentId, createdStage.id);
          return;
        }
      }
    }

    ctx.notify("good", type === "group" ? `预赛阶段和 ${groupCount} 个空小组已创建。` : "瑞士轮预赛阶段已创建。");
    await ctx.load(ctx.data.selectedTournamentId, createdStage?.id ?? ctx.data.selectedStageId);
  };

  const publish = async () => {
    if (!window.confirm("发布后 H5 赛程页将展示官方赛程。确认发布？")) return;
    await ctx.runAction("发布官方赛程", "POST", `/tournaments/${encodeURIComponent(ctx.data.selectedTournamentId)}/schedule-management/publish`, { actor: "admin" });
  };

  const resetSchedule = async () => {
    await ctx.runAction("重置官方赛程", "DELETE", `/tournaments/${encodeURIComponent(ctx.data.selectedTournamentId)}/schedule-records`, undefined, { nextStageId: "" });
  };

  const hasAnySetup = ctx.officialStages.length > 0 || Boolean(schedule?.rosterLocked) || (schedule?.status && schedule.status !== "unconfigured");

  return (
    <div className="format-publish">
      <div className="form-row">
        <label className="field">
          <span className="field-label">预赛赛制</span>
          <select value={preliminaryType} onChange={(event) => setPreliminaryType(event.target.value as "group" | "swiss")} disabled={!schedule?.rosterLocked}>
            <option value="group">小组赛</option>
            <option value="swiss">瑞士轮</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">淘汰赛赛制</span>
          <select value={knockoutType} onChange={(event) => setKnockoutType(event.target.value as "single_elimination" | "double_elimination")} disabled={!schedule?.rosterLocked}>
            <option value="single_elimination">单败</option>
            <option value="double_elimination">双败</option>
          </select>
        </label>
        {preliminaryType === "swiss" ? (
          <label className="field">
            <span className="field-label">瑞士轮轮数</span>
            <input type="number" min={1} max={9} value={swissRounds} onChange={(event) => setSwissRounds(Math.max(1, Math.min(9, Math.floor(Number(event.target.value) || 1))))} />
          </label>
        ) : (
          <label className="field">
            <span className="field-label">初始小组数</span>
            <input type="number" min={1} max={16} value={groupCount} onChange={(event) => setGroupCount(Math.max(1, Math.min(16, Math.floor(Number(event.target.value) || 1))))} />
          </label>
        )}
        <div className="field field-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void saveFormat()} disabled={!dirty || Boolean(changeBlocked) || !schedule?.rosterLocked || submitting}>
            <Check size={14} /> {dirty ? "保存赛制" : "赛制已保存"}
          </button>
        </div>
      </div>
      {changeBlocked ? <p className="inline-warn">{changeBlocked}</p> : null}
      {!schedule?.rosterLocked ? <p className="muted">先在左侧锁定参赛名单，再保存赛制。</p> : null}

      {schedule?.rosterLocked && schedule.preliminaryType && schedule.knockoutType && !readiness.hasPreliminaryStage ? (
        <div className="setup-next">
          <span>下一步：创建{labelPreliminary(schedule.preliminaryType)}预赛阶段</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void createPreliminary()}>
            <Plus size={14} /> 创建{labelPreliminary(schedule.preliminaryType)}预赛{schedule.preliminaryType === "group" ? `（含 ${groupCount} 个空小组）` : `（${swissRounds} 轮）`}
          </button>
        </div>
      ) : null}

      <div className="publish-bar">
        <div className="publish-bar-status">
          <StatusPill tone={ctx.published ? "good" : readyToPublish ? "info" : "warn"}>{labelScheduleStatus(schedule?.status)}</StatusPill>
          <span className="muted">{ctx.published ? "H5 正在展示；修改即时生效。" : readyToPublish ? "发布检查通过，可以发布到 H5。" : `发布前还差：${missingPieces.join("、")}`}</span>
        </div>
        <div className="row-actions">
          {!ctx.published ? <button type="button" className="btn btn-primary btn-sm" onClick={() => void publish()} disabled={!readyToPublish}><Play size={13} /> 发布到 H5</button> : null}
          {hasAnySetup ? (
            <ConfirmButton className="btn btn-ghost-danger btn-sm" confirmText="确认重置本届官方赛程？这会删除已锁参赛名单、赛制配置、小组 / 瑞士轮 / 淘汰赛阶段、对阵、赛果和对阵图；OpenDota 比赛记录保留。" onConfirm={resetSchedule}>
              <Trash2 size={13} /> 重置官方赛程
            </ConfirmButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getPublishReadiness(ctx: TournamentCtx): { hasPreliminaryStage: boolean; hasPreliminarySeries: boolean } {
  const preliminaryStage = ctx.officialStages.find(isPreliminaryStage) ?? null;
  const hasPreliminaryStage = preliminaryStage !== null;
  const viewingPreliminary = hasPreliminaryStage && ctx.stage?.id === preliminaryStage.id;
  const hasPreliminarySeries = !hasPreliminaryStage
    ? false
    : viewingPreliminary
      ? ctx.data.stageData.rounds.flatMap((round) => round.series).some((series) => series.stageId === preliminaryStage.id)
      : true;
  return { hasPreliminaryStage, hasPreliminarySeries };
}

function StageWorkspace({ ctx }: { ctx: TournamentCtx }) {
  const [editingSeries, setEditingSeries] = useState<SeriesSummary | null>(null);
  const stage = ctx.stage;
  const knockoutStage = ctx.officialStages.find(isKnockoutStage);
  const preliminaryStage = ctx.officialStages.find(isPreliminaryStage);

  useEffect(() => {
    setEditingSeries(null);
  }, [stage?.id]);

  if (ctx.officialStages.length === 0) {
    return (
      <SectionCard title="官方阶段" desc="完成基础设置后，在这里搭建预赛和淘汰赛。">
        <EmptyPanel title="还没有官方阶段" text="先在上方“基础设置”锁定名单、保存赛制并创建预赛阶段。" />
      </SectionCard>
    );
  }

  if (!stage) return null;

  const isKnockout = stage.type === "knockout";
  const stageSeries = ctx.data.stageData.rounds.flatMap((round) => round.series);

  return (
    <>
      <SectionCard
        title="官方阶段"
        desc="小组赛 / 瑞士轮的结果决定排名；排名决定淘汰赛入围。"
        aside={
          <div className="stage-tabs" role="tablist" aria-label="官方阶段切换">
            {ctx.officialStages.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === stage.id}
                className={item.id === stage.id ? "is-active" : ""}
                onClick={() => void ctx.load(ctx.data.selectedTournamentId, item.id)}
              >
                <span>{labelStageType(item.type)}</span>
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        }
      >
        <div className="stage-head-line">
          <StatusPill tone={toneForStatus(stage.status)}>{labelStageStatus(stage.status)}</StatusPill>
          <span className="muted">{stage.advancementRule ?? ""}</span>
        </div>
        {stage.type === "group" ? <GroupStage ctx={ctx} /> : null}
        {stage.type === "swiss" ? <SwissStage ctx={ctx} /> : null}
        {isKnockout ? <KnockoutStage ctx={ctx} /> : null}
        {!isKnockout && !knockoutStage ? <KnockoutEntrantSetup ctx={ctx} /> : null}
        {!isKnockout && knockoutStage ? (
          <div className="setup-next">
            <span>淘汰赛阶段“{knockoutStage.name}”已生成</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void ctx.load(ctx.data.selectedTournamentId, knockoutStage.id)}>打开对阵图</button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="阶段赛程" desc={`共 ${stageSeries.length} 场 · 点比分按钮直接录入赛果`}>
        {editingSeries ? (
          <div className="stage-block is-editing-block">
            <div className="stage-block-head">
              <div><h3>修改对阵：{editingSeries.radiantTeam.name} vs {editingSeries.direTeam.name}</h3></div>
            </div>
            <SeriesEditorPanel
              ctx={ctx}
              stage={stage}
              groups={ctx.data.stageData.groups}
              rounds={ctx.data.stageData.rounds}
              editingSeries={editingSeries}
              suggestion={null}
              onDone={() => setEditingSeries(null)}
            />
          </div>
        ) : null}
        <SeriesBoard ctx={ctx} rounds={ctx.data.stageData.rounds} onEditSeries={setEditingSeries} editingSeriesId={editingSeries?.id ?? ""} />
      </SectionCard>

      {!isKnockout ? (
        <SectionCard title="积分 / 排名" desc="拖动行可手动覆盖名次。">
          <Standings ctx={ctx} rows={ctx.data.stageData.standings} />
        </SectionCard>
      ) : null}
      {isKnockout && preliminaryStage ? (
        <SectionCard title="预赛排名参考" desc="淘汰赛期间仍可查看预赛排名。">
          <StandingsReadonlyHint stage={preliminaryStage} ctx={ctx} />
        </SectionCard>
      ) : null}
    </>
  );
}

function StandingsReadonlyHint({ stage, ctx }: { stage: StageSummary; ctx: TournamentCtx }) {
  return (
    <div className="setup-next">
      <span>排名数据在预赛阶段“{stage.name}”维护</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void ctx.load(ctx.data.selectedTournamentId, stage.id)}>去预赛阶段</button>
    </div>
  );
}
