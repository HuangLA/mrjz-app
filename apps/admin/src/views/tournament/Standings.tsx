import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw } from "lucide-react";
import type { StandingRow } from "../../api";
import { standingTeamId } from "../../app/domain";
import { FilterTabs } from "../../components/ui";
import type { TournamentCtx } from "./context";

const ungroupedKey = "__all__";

export function Standings({ ctx, rows }: { ctx: TournamentCtx; rows: StandingRow[] }) {
  const groups = useMemo(() => groupStandingRows(rows), [rows]);
  const [activeGroupKey, setActiveGroupKey] = useState("");
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? groups[0] ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const nextKey = activeGroup?.key ?? "";
    if (activeGroupKey !== nextKey) setActiveGroupKey(nextKey);
  }, [activeGroup?.key, activeGroupKey]);

  if (rows.length === 0) {
    return <p className="muted">录入赛果后，后端会生成积分和排名。</p>;
  }

  const visibleRows = activeGroup?.rows ?? [];
  const hasManualRank = visibleRows.some((row) => row.manualRank !== null && row.manualRank !== undefined);

  const saveManualRanks = async (orderedIds: string[]) => {
    if (!ctx.stage) return;
    await ctx.runAction("保存手动排名", "PATCH", `/stages/${encodeURIComponent(ctx.stage.id)}/manual-ranks`, {
      actor: "admin",
      ranks: orderedIds.map((teamId, index) => ({ teamId, manualRank: index + 1 })),
    });
  };

  const resetManualRanks = async () => {
    if (!ctx.stage) return;
    await ctx.runAction("恢复自动排序", "PATCH", `/stages/${encodeURIComponent(ctx.stage.id)}/manual-ranks`, {
      actor: "admin",
      ranks: rows.map((row) => ({ teamId: standingTeamId(row), manualRank: null })).filter((rank) => rank.teamId),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : "";
    if (!activeId.startsWith("rank:") || !overId.startsWith("rank:") || activeId === overId) return;
    const activeTeamId = activeId.slice("rank:".length);
    const overTeamId = overId.slice("rank:".length);
    const orderedIds = visibleRows.map(standingTeamId).filter(Boolean);
    const activeIndex = orderedIds.indexOf(activeTeamId);
    const overIndex = orderedIds.indexOf(overTeamId);
    if (activeIndex === -1 || overIndex === -1) return;
    void saveManualRanks(arrayMove(orderedIds, activeIndex, overIndex));
  };

  return (
    <div className="standings">
      {groups.length > 1 ? (
        <FilterTabs
          ariaLabel="积分榜小组切换"
          value={activeGroup?.key ?? ""}
          onChange={setActiveGroupKey}
          options={groups.map((group) => ({ value: group.key, label: group.label, count: group.rows.length }))}
        />
      ) : null}
      <div className="standings-note">
        <span className="muted">拖动行可手动覆盖名次；{hasManualRank ? "手动排序已生效。" : "当前为自动排序。"}</span>
        {hasManualRank ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void resetManualRanks()}><RotateCcw size={13} /> 恢复自动排序</button> : null}
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <table className="standings-table">
          <thead>
            <tr><th></th><th>#</th><th>队伍</th><th>赛果</th><th>小分</th><th>积分</th></tr>
          </thead>
          <SortableContext items={visibleRows.map((row) => `rank:${standingTeamId(row)}`)} strategy={verticalListSortingStrategy}>
            <tbody>
              {visibleRows.map((row) => <SortableStandingRow key={`rank:${standingTeamId(row)}`} row={row} />)}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );
}

function SortableStandingRow({ row }: { row: StandingRow }) {
  const id = `rank:${standingTeamId(row)}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? "is-dragging" : ""}>
      <td className="standings-drag"><button type="button" className="rank-drag-handle" aria-label={`拖动调整 ${row.team?.name ?? row.teamId} 名次`} {...attributes} {...listeners}><GripVertical size={13} /></button></td>
      <td>{row.manualRank ? <span className="manual-rank-badge" title="手动覆盖名次">{row.rank}</span> : row.rank}</td>
      <td>{row.team?.name ?? row.teamId}</td>
      <td>{row.seriesWins}-{row.seriesDraws}-{row.seriesLosses}</td>
      <td>{row.gameWins}-{row.gameLosses}</td>
      <td>{row.points}</td>
    </tr>
  );
}

function groupStandingRows(rows: StandingRow[]): Array<{ key: string; label: string; rows: StandingRow[] }> {
  const groups = new Map<string, { key: string; label: string; rows: StandingRow[] }>();

  for (const row of rows) {
    const key = row.groupName?.trim() || ungroupedKey;
    const group = groups.get(key) ?? { key, label: key === ungroupedKey ? "总榜" : key, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: [...group.rows].sort((left, right) => left.rank - right.rank),
  }));
}
