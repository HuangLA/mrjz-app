import { useState } from "react";
import { Check, ListRestart, RotateCcw } from "lucide-react";
import type { StageRound } from "../../api";
import { findNextSwissPair } from "../../app/domain";
import { labelPairingStatus, toneForStatus } from "../../app/format";
import { ConfirmButton, StatusPill } from "../../components/ui";
import type { TournamentCtx } from "./context";
import { SeriesEditorPanel } from "./SeriesEditor";

export function SwissStage({ ctx }: { ctx: TournamentCtx }) {
  const rounds = [...ctx.data.stageData.rounds].sort((left, right) => left.roundNumber - right.roundNumber);
  const [editorOpen, setEditorOpen] = useState(false);
  const confirmedRounds = rounds.filter((round) => round.pairingStatus === "confirmed");
  const draftRounds = rounds.filter((round) => round.pairingStatus !== "confirmed");
  const nextRoundNumber = Math.max(1, ...rounds.map((round) => round.roundNumber + 1));
  const expectedRounds = typeof ctx.stage?.config?.swissRounds === "number" ? ctx.stage.config.swissRounds : null;
  const suggestion = findNextSwissPair(ctx.availableTeams, ctx.data.stageData.standings, rounds);
  const swissDraftSeriesCount = Math.floor(ctx.availableTeams.length / 2);
  const byeText = ctx.availableTeams.length % 2 === 1 ? " + 1 轮空" : "";

  const generatePairings = async () => {
    if (!ctx.stage) return;
    const affectedRoundCount = rounds.filter((round) => round.roundNumber >= nextRoundNumber).length;
    if (affectedRoundCount > 0 && !window.confirm(`生成第 ${nextRoundNumber} 轮草稿会覆盖第 ${nextRoundNumber} 轮及之后的 ${affectedRoundCount} 个轮次。确认继续？`)) return;
    await ctx.runAction("生成瑞士轮配对", "POST", `/stages/${encodeURIComponent(ctx.stage.id)}/swiss-pairings`, { roundNumber: nextRoundNumber, boType: "BO2", actor: "admin" });
  };

  const confirmRound = async (round: StageRound) => {
    const visibilityText = ctx.published ? "当前赛程已发布，确认后 H5 会同步展示这一轮。" : "确认后这一轮进入正式赛程，发布后对用户可见。";
    if (!window.confirm(`确认 ${describeRound(round)}？\n${visibilityText}`)) return;
    await ctx.runAction("确认瑞士轮", "POST", `/rounds/${encodeURIComponent(round.id)}/confirm-swiss`, { actor: "admin" });
  };

  const retractRound = async (round: StageRound) => {
    await ctx.runAction("撤回瑞士轮", "POST", `/rounds/${encodeURIComponent(round.id)}/retract-swiss`, { actor: "admin" });
  };

  return (
    <div className="stage-stack">
      <div className="stage-block">
        <div className="stage-block-head">
          <div>
            <h3>配对</h3>
            <p className="muted">
              {confirmedRounds.length} 轮已确认{expectedRounds !== null ? ` / 计划 ${expectedRounds} 轮` : ""} · {draftRounds.length} 个草稿待确认
            </p>
          </div>
          <div className="stage-block-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditorOpen((current) => !current)}>{editorOpen ? "收起手动配对" : "手动配对"}</button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void generatePairings()}
              disabled={ctx.availableTeams.length < 2}
              title={`按当前战绩自动生成第 ${nextRoundNumber} 轮配对草稿（${swissDraftSeriesCount} 场 BO2${byeText}），生成后仍需确认`}
            >
              <ListRestart size={14} /> 生成第 {nextRoundNumber} 轮草稿（{swissDraftSeriesCount} 场{byeText}）
            </button>
          </div>
        </div>
        {editorOpen ? (
          <SeriesEditorPanel
            ctx={ctx}
            stage={ctx.stage!}
            groups={[]}
            rounds={rounds}
            editingSeries={null}
            suggestion={suggestion ? { pair: suggestion, label: `${suggestion.left.name} vs ${suggestion.right.name}` } : null}
            onDone={() => undefined}
          />
        ) : null}
      </div>

      <div className="stage-block">
        <div className="stage-block-head">
          <div>
            <h3>轮次</h3>
            <p className="muted">先检查草稿配对并确认；确认后可录赛果。填错可撤回该轮及后续。</p>
          </div>
        </div>
        {rounds.length === 0 ? <p className="muted">还没有瑞士轮。生成第 1 轮草稿，或手动配对。</p> : (
          <div className="swiss-round-grid">
            {rounds.map((round) => {
              const confirmed = round.pairingStatus === "confirmed";
              return (
                <article key={round.id} className={confirmed ? "swiss-round-card is-confirmed" : "swiss-round-card"}>
                  <header className="swiss-round-head">
                    <div><strong>{round.name}</strong><small>{round.series.length} 场对阵</small></div>
                    <StatusPill tone={toneForStatus(round.pairingStatus ?? round.status)}>{labelPairingStatus(round.pairingStatus ?? round.status)}</StatusPill>
                  </header>
                  {round.byes && round.byes.length > 0 ? (
                    <div className="swiss-byes">{round.byes.map((team) => <span key={team.id}>{team.name} 轮空胜</span>)}</div>
                  ) : null}
                  <div className="swiss-round-series">
                    {round.series.length === 0 ? <span className="muted">本轮还没有对阵。</span> : round.series.map((series) => (
                      <div key={series.id} className="swiss-series-line">
                        <span>{series.radiantTeam.name}</span>
                        <strong>{series.radiantScore}-{series.direScore}</strong>
                        <span>{series.direTeam.name}</span>
                      </div>
                    ))}
                  </div>
                  <footer className="swiss-round-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void confirmRound(round)} disabled={confirmed}><Check size={13} /> 确认本轮</button>
                    <ConfirmButton className="btn btn-ghost-danger btn-sm" confirmText={`确认撤回 ${describeRound(round)} 及后续瑞士轮？该操作会清空这些轮次的配对。`} onConfirm={() => retractRound(round)}>
                      <RotateCcw size={13} /> 撤回后续
                    </ConfirmButton>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function describeRound(round: StageRound): string {
  const byeCount = round.byes?.length ?? 0;
  return `${round.name}（${round.series.length} 场对阵${byeCount > 0 ? `，${byeCount} 个轮空胜` : ""}）`;
}
