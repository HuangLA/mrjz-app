import { useEffect, useMemo, useState } from "react";
import { Check, Link2, Pencil, Trash2 } from "lucide-react";
import type { SeriesSummary, StageRound } from "../../api";
import { formatDateTime, labelSeriesStatus, toneForStatus } from "../../app/format";
import {
  compareSeriesTodoPriority,
  countMissingSeriesMatchIds,
  matchesSeriesQuery,
  quickResultOptions,
  seriesHasResult,
  seriesMatchesFilterMode,
  seriesNeedsResult,
  type SeriesFilterMode,
} from "../../app/domain";
import { ConfirmButton, FilterTabs, SearchInput, StatusPill } from "../../components/ui";
import type { TournamentCtx } from "./context";

export function SeriesBoard({ ctx, rounds, onEditSeries, editingSeriesId }: {
  ctx: TournamentCtx;
  rounds: StageRound[];
  onEditSeries: (series: SeriesSummary) => void;
  editingSeriesId: string;
}) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<SeriesFilterMode>("all");
  const allSeries = useMemo(() => rounds.flatMap((round) => round.series), [rounds]);
  const normalizedQuery = query.trim().toLowerCase();

  const pendingResultCount = allSeries.filter(seriesNeedsResult).length;
  const missingMatchSeriesCount = allSeries.filter((item) => countMissingSeriesMatchIds(item) > 0).length;
  const todoCount = allSeries.filter((item) => seriesNeedsResult(item) || countMissingSeriesMatchIds(item) > 0).length;

  const filterSeries = (items: SeriesSummary[]) => items
    .filter((item) => matchesSeriesQuery(item, normalizedQuery, labelSeriesStatus))
    .filter((item) => seriesMatchesFilterMode(item, filterMode))
    .sort(compareSeriesTodoPriority);

  const blocks = rounds
    .map((round) => ({ round, series: filterSeries(round.series) }))
    .filter((block) => block.series.length > 0);
  const visibleCount = blocks.reduce((sum, block) => sum + block.series.length, 0);

  if (allSeries.length === 0) {
    return <p className="muted">当前阶段还没有对阵。使用上方编辑器创建第一场 BO2。</p>;
  }

  return (
    <div className="series-board">
      <div className="series-board-bar">
        <FilterTabs
          ariaLabel="赛程筛选"
          value={filterMode}
          onChange={setFilterMode}
          options={[
            { value: "all", label: "全部", count: allSeries.length },
            { value: "todo", label: "待办", count: todoCount },
            { value: "result", label: "待赛果", count: pendingResultCount },
            { value: "match", label: "缺 match_id", count: missingMatchSeriesCount },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="队伍或 match_id" />
      </div>
      {visibleCount === 0 ? <p className="muted">{filterMode === "all" ? "没有匹配的对阵。" : "当前筛选下没有待处理对阵。"}</p> : null}
      {blocks.map((block) => (
        <section key={block.round.id} className="series-round-block">
          <header className="series-round-head">
            <strong>{block.round.name}</strong>
            <span>{block.series.length} 场</span>
          </header>
          <div className="series-list">
            {block.series.map((item) => (
              <SeriesRow
                key={item.id}
                item={item}
                ctx={ctx}
                isEditing={item.id === editingSeriesId}
                expandMatchIds={filterMode === "match"}
                onEdit={() => onEditSeries(item)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SeriesRow({ item, ctx, isEditing, expandMatchIds, onEdit }: {
  item: SeriesSummary;
  ctx: TournamentCtx;
  isEditing: boolean;
  expandMatchIds: boolean;
  onEdit: () => void;
}) {
  const needsResult = seriesNeedsResult(item);
  const missingMatchIds = countMissingSeriesMatchIds(item);
  const scoreText = needsResult ? "待录" : `${item.radiantScore} - ${item.direScore}`;
  const description = `${item.radiantTeam.name} vs ${item.direTeam.name}（${scoreText}，${item.groupName ?? item.boType}）`;

  const recordResult = async (radiantScore: number, direScore: number) => {
    await ctx.runAction("录入赛果", "PATCH", `/series/${encodeURIComponent(item.id)}/result`, { radiantScore, direScore });
  };

  return (
    <article className={["series-row", needsResult ? "is-needs-result" : "", isEditing ? "is-editing" : ""].filter(Boolean).join(" ")}>
      <div className="series-row-main">
        <div className="series-row-teams">
          <span className="series-team is-left" title={item.radiantTeam.name}>{item.radiantTeam.name}</span>
          <strong className={needsResult ? "series-score is-pending" : "series-score"} title={needsResult ? "尚未录入赛果" : `当前比分 ${scoreText}`}>{scoreText}</strong>
          <span className="series-team is-right" title={item.direTeam.name}>{item.direTeam.name}</span>
        </div>
        <div className="series-row-meta">
          <span>{item.groupName ?? item.boType}</span>
          {item.seriesKind === "tiebreaker" ? <StatusPill tone="info">加赛</StatusPill> : null}
          <span>{formatDateTime(item.scheduledAt)}</span>
          <StatusPill tone={toneForStatus(item.status)}>{labelSeriesStatus(item.status)}</StatusPill>
          {needsResult ? <StatusPill tone="warn">待补赛果</StatusPill> : null}
          {missingMatchIds > 0 ? <StatusPill tone="info">缺 {missingMatchIds} 个 match_id</StatusPill> : null}
        </div>
      </div>
      <div className="series-row-actions">
        <div className="series-result-buttons" role="group" aria-label="快速录入赛果">
          {quickResultOptions(item.boType).map((option) => {
            const isCurrent = !needsResult && item.radiantScore === option.radiant && item.direScore === option.dire;
            const tone = option.radiant > option.dire ? "left" : option.dire > option.radiant ? "right" : "draw";
            return (
              <button
                key={`${option.radiant}-${option.dire}`}
                type="button"
                className={`result-btn is-${tone}${isCurrent ? " is-current" : ""}`}
                aria-pressed={isCurrent}
                onClick={() => void recordResult(option.radiant, option.dire)}
                title={option.radiant > option.dire ? `${item.radiantTeam.name} 胜 ${option.radiant}-${option.dire}` : option.dire > option.radiant ? `${item.direTeam.name} 胜 ${option.radiant}-${option.dire}` : `平局 ${option.radiant}-${option.dire}`}
              >
                {isCurrent ? <Check size={11} /> : null}{option.radiant}-{option.dire}
              </button>
            );
          })}
        </div>
        <SeriesTimeEditor series={item} ctx={ctx} />
        <SeriesMatchIdEditor series={item} ctx={ctx} defaultOpen={expandMatchIds && missingMatchIds > 0} />
        <div className="series-row-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} disabled={isEditing}><Pencil size={13} /> {isEditing ? "编辑中" : "编辑"}</button>
          <ConfirmButton
            className="btn btn-ghost-danger btn-sm"
            confirmText={`确认删除 ${description}？删除后积分、排名和阶段赛程会按后端规则重算。`}
            onConfirm={() => ctx.runAction("删除对阵", "DELETE", `/series/${encodeURIComponent(item.id)}`)}
          >
            <Trash2 size={13} /> 删除
          </ConfirmButton>
        </div>
      </div>
    </article>
  );
}

function SeriesTimeEditor({ series, ctx }: { series: SeriesSummary; ctx: TournamentCtx }) {
  const [draft, setDraft] = useState(() => toInputValue(series.scheduledAt));
  const [saving, setSaving] = useState(false);
  const currentValue = toInputValue(series.scheduledAt);
  const dirty = draft !== currentValue;

  useEffect(() => {
    setDraft(toInputValue(series.scheduledAt));
    setSaving(false);
  }, [series.id, series.scheduledAt]);

  const save = async (nextDraft: string) => {
    if (saving) return;
    setSaving(true);
    const payload = nextDraft ? new Date(nextDraft).toISOString() : "";
    const result = await ctx.runAction(nextDraft ? "保存对阵时间" : "清空对阵时间", "PATCH", `/series/${encodeURIComponent(series.id)}`, { scheduledAt: payload }, { silent: true });
    ctx.notify(result.ok ? "good" : "warn", `对阵时间：${result.message}`);
    if (!result.ok) setSaving(false);
  };

  return (
    <div className="series-time" title="对阵时间">
      <input
        type="datetime-local"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (dirty) void save(draft); }}
        aria-label={`设置对阵时间：${series.radiantTeam.name} vs ${series.direTeam.name}`}
      />
    </div>
  );
}

function SeriesMatchIdEditor({ series, ctx, defaultOpen }: { series: SeriesSummary; ctx: TournamentCtx; defaultOpen: boolean }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => gameDrafts(series));
  const [error, setError] = useState("");
  const signature = series.games.map((game) => `${game.gameIndex}:${game.matchId ?? ""}`).join("|");
  const linkedCount = series.games.filter((game) => game.matchId !== null && game.matchId !== undefined).length;
  const missingCount = Math.max(series.games.length - linkedCount, 0);

  useEffect(() => {
    setDrafts(gameDrafts(series));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id, signature]);

  if (series.games.length === 0) {
    return <span className="muted series-match-strip">无单局槽位</span>;
  }

  const save = async (gameIndex: number) => {
    const rawValue = drafts[String(gameIndex)]?.trim() ?? "";
    if (rawValue === "") {
      const result = await ctx.runAction("解绑 match_id", "POST", `/series/${encodeURIComponent(series.id)}/games/${encodeURIComponent(String(gameIndex))}/result`, { matchId: null }, { silent: true });
      ctx.notify(result.ok ? "good" : "warn", `match_id：${result.message}`);
      return;
    }
    const matchId = Number(rawValue);
    if (!Number.isSafeInteger(matchId) || matchId <= 0) {
      setError("match_id 必须是正整数");
      return;
    }
    setError("");
    const result = await ctx.runAction("保存 match_id", "POST", `/series/${encodeURIComponent(series.id)}/games/${encodeURIComponent(String(gameIndex))}/result`, { matchId }, { silent: true });
    ctx.notify(result.ok ? "good" : "warn", `match_id：${result.message}`);
  };

  return (
    <details className={missingCount > 0 ? "series-match-strip is-missing" : "series-match-strip"} {...(defaultOpen ? { open: true } : {})}>
      <summary title="展开维护 Dota2 match_id">
        <Link2 size={12} /> match_id {linkedCount}/{series.games.length}
      </summary>
      <div className="series-match-fields">
        {series.games.map((game) => (
          <label key={`${series.id}-${game.gameIndex}`}>
            <span>G{game.gameIndex}</span>
            <input
              inputMode="numeric"
              placeholder="match_id"
              value={drafts[String(game.gameIndex)] ?? ""}
              onChange={(event) => setDrafts((current) => ({ ...current, [String(game.gameIndex)]: event.target.value }))}
              onKeyDown={(event) => { if (event.key === "Enter") void save(game.gameIndex); }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void save(game.gameIndex)}>{game.matchId ? "更新" : "保存"}</button>
          </label>
        ))}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </details>
  );
}

function gameDrafts(series: SeriesSummary): Record<string, string> {
  return Object.fromEntries(series.games.map((game) => [String(game.gameIndex), game.matchId?.toString() ?? ""]));
}

function toInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export { seriesHasResult };
