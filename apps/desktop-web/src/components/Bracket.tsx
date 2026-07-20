import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { StageView } from "../data";
import {
  bracketConnectorPath,
  bracketGroupSortValue,
  bracketTrackHeight,
  bracketTrackWidth,
  buildUnifiedStageBracketLayout,
  formatBracketTarget,
  measureStageFinalConnectorOverlay,
  type StageFinalConnectorOverlay,
  type UnifiedStageBracketColumn,
} from "../utils";

type BracketNode = StageView["bracket"][number];

export function StageBracketPreview({ nodes }: { nodes: StageView["bracket"] }) {
  const [finalConnectorOverlay, setFinalConnectorOverlay] =
    useState<StageFinalConnectorOverlay | null>(null);
  const unifiedMapRef = useRef<HTMLDivElement | null>(null);
  const grouped = new Map<
    string,
    {
      label: string;
      rounds: Map<string, { roundNumber: number; roundName: string; nodes: StageView["bracket"] }>;
    }
  >();
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const linkedNodeIds = new Set<string>();

  for (const node of nodes) {
    const roundKey = `${node.bracketGroup}:${node.roundNumber}:${node.roundName}`;
    const groupKey = node.bracketGroup || "single";
    const group = grouped.get(groupKey) ?? {
      label: node.groupName,
      rounds: new Map<
        string,
        { roundNumber: number; roundName: string; nodes: StageView["bracket"] }
      >(),
    };
    const round = group.rounds.get(roundKey) ?? {
      roundNumber: node.roundNumber,
      roundName: node.roundName,
      nodes: [],
    };
    group.rounds.set(roundKey, { ...round, nodes: [...round.nodes, node] });
    grouped.set(groupKey, group);

    if (node.nextNodeId) linkedNodeIds.add(node.nextNodeId);
    if (node.loserNextNodeId) linkedNodeIds.add(node.loserNextNodeId);
  }

  const groups = [...grouped.entries()]
    .sort(
      ([groupA], [groupB]) =>
        bracketGroupSortValue(groupA) - bracketGroupSortValue(groupB) ||
        groupA.localeCompare(groupB),
    )
    .map(([key, group]) => ({ key, ...group }));
  const isUnifiedDoubleElimination = groups.some(
    (group) => group.key === "winner" || group.key === "loser" || group.key === "grand_final",
  );
  const unifiedLayout = isUnifiedDoubleElimination
    ? buildUnifiedStageBracketLayout(groups, nodes)
    : null;
  const extraGroups = groups.filter(
    (group) => group.key !== "winner" && group.key !== "loser" && group.key !== "grand_final",
  );

  const renderNodeCard = (
    node: BracketNode,
    columnIndex: number,
    gridRowStart: number,
    rowSpan: number,
  ) => {
    const topWinner = node.winnerTeamId !== null && node.winnerTeamId === node.topTeamId;
    const bottomWinner = node.winnerTeamId !== null && node.winnerTeamId === node.bottomTeamId;
    const hasOutgoing = Boolean(node.nextNodeId || node.loserNextNodeId);
    const hasIncoming = columnIndex > 0 || linkedNodeIds.has(node.id);
    const winnerTarget = formatBracketTarget(nodeLookup, node.nextNodeId, node.nextSlot, "冠军");
    const loserTarget = node.loserNextNodeId
      ? formatBracketTarget(nodeLookup, node.loserNextNodeId, node.loserNextSlot, "淘汰")
      : "淘汰";
    const nodeClass = [
      "bracket-node",
      node.status === "已完赛"
        ? "is-completed"
        : node.status === "待开赛"
          ? "is-ready"
          : "is-pending",
      hasIncoming ? "has-incoming" : "",
      hasOutgoing ? "has-outgoing" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <article
        className={nodeClass}
        key={node.id}
        data-bracket-node-id={node.id}
        style={{ gridRow: `${gridRowStart} / span ${rowSpan}` }}
      >
        <div className="bracket-node-topline">
          <span className="bracket-node-kicker">#{node.position}</span>
          <span className="bracket-node-state">{node.status}</span>
        </div>
        <div className={`bracket-team ${topWinner ? "is-winner" : ""}`}>
          <span>上</span>
          <b>{node.topTeam}</b>
          {topWinner ? <em>胜</em> : null}
        </div>
        <div className={`bracket-team ${bottomWinner ? "is-winner" : ""}`}>
          <span>下</span>
          <b>{node.bottomTeam}</b>
          {bottomWinner ? <em>胜</em> : null}
        </div>
        <small className="bracket-node-footer">
          {node.winner === "待定" ? "胜者待定" : `胜者 ${node.winner}`}
        </small>
        <div className="bracket-flow-row">
          <span>胜者 -&gt; {winnerTarget}</span>
          <span>负者 -&gt; {loserTarget}</span>
        </div>
      </article>
    );
  };

  const renderGroupLane = (group: (typeof groups)[number], extraClass = "") => {
    const columns = [...group.rounds.entries()]
      .sort(
        ([, roundA], [, roundB]) =>
          roundA.roundNumber - roundB.roundNumber ||
          roundA.roundName.localeCompare(roundB.roundName),
      )
      .map(([roundKey, round]) => ({
        key: roundKey,
        roundName: round.roundName,
        nodes: round.nodes.slice().sort((a, b) => a.position - b.position),
      }));
    const rowCount = Math.max(1, ...columns.map((column) => column.nodes.length));
    const columnBodyStyle = { "--bracket-row-count": rowCount } as CSSProperties &
      Record<"--bracket-row-count", number>;
    const columnLayouts = columns.map((column, columnIndex) => ({
      ...column,
      nodes: column.nodes.map((node, nodeIndex) => {
        const rowSpan = Math.max(1, Math.floor(rowCount / Math.max(1, column.nodes.length)));
        const gridRowStart = nodeIndex * rowSpan + 1;
        return { node, columnIndex, gridRowStart, rowSpan };
      }),
    }));
    const nodeLayouts = new Map(
      columnLayouts.flatMap((column) => column.nodes.map((layout) => [layout.node.id, layout])),
    );
    const connectors = columnLayouts.flatMap((column) =>
      column.nodes.flatMap((source) => {
        const targets = [
          { id: source.node.nextNodeId, kind: "winner" },
          { id: source.node.loserNextNodeId, kind: "loser" },
        ].filter(
          (target): target is { id: string; kind: "winner" | "loser" } => target.id !== null,
        );
        return targets
          .map((target) => {
            const targetLayout = nodeLayouts.get(target.id);
            return targetLayout && targetLayout.columnIndex > source.columnIndex
              ? {
                  id: `${source.node.id}:${target.id}:${target.kind}`,
                  kind: target.kind,
                  path: bracketConnectorPath(source, targetLayout),
                }
              : null;
          })
          .filter(
            (connector): connector is { id: string; kind: "winner" | "loser"; path: string } =>
              connector !== null,
          );
      }),
    );
    const trackWidth = bracketTrackWidth(columns.length);
    const trackHeight = bracketTrackHeight(rowCount);

    return (
      <div className={`bracket-group-lane is-${group.key} ${extraClass}`.trim()} key={group.key}>
        <strong className="bracket-group-title">{group.label}</strong>
        <div className="bracket-round-track">
          {connectors.length > 0 ? (
            <svg
              className="bracket-connector-layer"
              width={trackWidth}
              height={trackHeight}
              viewBox={`0 0 ${trackWidth} ${trackHeight}`}
              aria-hidden="true"
            >
              {connectors.map((connector) => (
                <path
                  key={connector.id}
                  className={`bracket-connector-path is-${connector.kind}`}
                  d={connector.path}
                />
              ))}
            </svg>
          ) : null}
          {columnLayouts.map((column) => (
            <div className="bracket-column" key={column.key}>
              <strong>{column.roundName}</strong>
              <div className="bracket-column-body" style={columnBodyStyle}>
                {column.nodes.map(({ node, columnIndex, gridRowStart, rowSpan }) =>
                  renderNodeCard(node, columnIndex, gridRowStart, rowSpan),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUnifiedColumn = (column: UnifiedStageBracketColumn) => {
    const columnBodyStyle = { "--bracket-row-count": column.rowCount } as CSSProperties &
      Record<"--bracket-row-count", number>;
    const style = {
      gridColumn: column.displayColumn + 1,
      gridRow: column.key.startsWith("grand_final")
        ? "1 / span 2"
        : column.key.startsWith("winner")
          ? 1
          : 2,
    } as CSSProperties;
    const rowSpan = Math.max(1, Math.floor(column.rowCount / Math.max(1, column.nodes.length)));

    return (
      <div
        className={`bracket-column bracket-unified-column is-${column.groupKey}`}
        key={column.key}
        style={style}
      >
        <strong>{column.roundName}</strong>
        <div className="bracket-column-body" style={columnBodyStyle}>
          {column.nodes.map((node, nodeIndex) =>
            renderNodeCard(node, column.displayColumn, nodeIndex * rowSpan + 1, rowSpan),
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!unifiedLayout) {
      setFinalConnectorOverlay(null);
      return;
    }

    let frame = 0;
    const updateOverlay = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setFinalConnectorOverlay(measureStageFinalConnectorOverlay(unifiedMapRef.current, nodes));
      });
    };

    updateOverlay();
    window.addEventListener("resize", updateOverlay);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateOverlay);
    if (unifiedMapRef.current) observer?.observe(unifiedMapRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateOverlay);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, Boolean(unifiedLayout)]);

  return (
    <div className={`bracket-board ${unifiedLayout ? "is-unified" : ""}`}>
      {unifiedLayout ? (
        <div
          ref={unifiedMapRef}
          className="bracket-unified-map is-combined"
          style={
            { "--bracket-column-count": unifiedLayout.columnCount } as CSSProperties &
              Record<"--bracket-column-count", number>
          }
        >
          {finalConnectorOverlay ? (
            <svg
              className="bracket-final-connector-overlay"
              width={finalConnectorOverlay.width}
              height={finalConnectorOverlay.height}
              viewBox={`0 0 ${finalConnectorOverlay.width} ${finalConnectorOverlay.height}`}
              aria-hidden="true"
            >
              {finalConnectorOverlay.paths.map((path) => (
                <path
                  key={path.id}
                  className={`bracket-final-connector-path is-${path.kind}`}
                  d={path.d}
                />
              ))}
            </svg>
          ) : null}
          <span className="bracket-unified-lane-label is-winner">胜者组</span>
          <span className="bracket-unified-lane-label is-loser">败者组</span>
          {unifiedLayout.columns.map((column) => renderUnifiedColumn(column))}
          {extraGroups.map((group) => (
            <div key={group.key} className="bracket-unified-extra">
              {renderGroupLane(group)}
            </div>
          ))}
        </div>
      ) : (
        groups.map((group) => renderGroupLane(group))
      )}
    </div>
  );
}
