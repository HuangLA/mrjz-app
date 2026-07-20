import { useEffect, useMemo, useRef, useState } from "react";
import type { MobileData } from "../api";
import type { AppRoute } from "../data";

export type PaletteTarget =
  | { kind: "route"; route: AppRoute }
  | { kind: "tournament"; tournamentId: string }
  | { kind: "player"; playerId: string }
  | { kind: "team"; teamId: string }
  | { kind: "match"; matchId: string };

type PaletteItem = {
  id: string;
  group: string;
  kindLabel: string;
  title: string;
  sub: string;
  target: PaletteTarget;
};

export function CommandPalette({
  data,
  onSelect,
  onClose,
}: {
  data: MobileData;
  onSelect: (target: PaletteTarget) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      {
        id: "route:home",
        group: "导航",
        kindLabel: "页面",
        title: "驾驶舱",
        sub: "总览 Dashboard",
        target: { kind: "route", route: "home" },
      },
      {
        id: "route:stage",
        group: "导航",
        kindLabel: "页面",
        title: "赛事阶段",
        sub: "积分榜与对阵图",
        target: { kind: "route", route: "stage" },
      },
      {
        id: "route:schedule",
        group: "导航",
        kindLabel: "页面",
        title: "赛程",
        sub: "时间线视图",
        target: { kind: "route", route: "schedule" },
      },
      {
        id: "route:records",
        group: "导航",
        kindLabel: "页面",
        title: "战报工作台",
        sub: "比赛记录与详情",
        target: { kind: "route", route: "records" },
      },
      {
        id: "route:leaderboard",
        group: "导航",
        kindLabel: "页面",
        title: "英雄榜",
        sub: "趣味称号排名",
        target: { kind: "route", route: "leaderboard" },
      },
      {
        id: "route:players",
        group: "导航",
        kindLabel: "页面",
        title: "选手",
        sub: "数据榜",
        target: { kind: "route", route: "players" },
      },
      {
        id: "route:teams",
        group: "导航",
        kindLabel: "页面",
        title: "队伍",
        sub: "战队名录",
        target: { kind: "route", route: "teams" },
      },
    ];

    for (const option of data.tournamentOptions) {
      list.push({
        id: `tournament:${option.id}`,
        group: "赛事",
        kindLabel: "赛事",
        title: option.name,
        sub: `League ${option.leagueId} · ${option.matchCount} 场`,
        target: { kind: "tournament", tournamentId: option.id },
      });
    }

    for (const player of data.players) {
      list.push({
        id: `player:${player.id}`,
        group: "选手",
        kindLabel: "选手",
        title: player.displayName,
        sub: player.currentTeam?.name ?? player.teams[0]?.name ?? "自由人",
        target: { kind: "player", playerId: player.id },
      });
    }

    for (const team of data.teams) {
      list.push({
        id: `team:${team.id}`,
        group: "队伍",
        kindLabel: "队伍",
        title: team.name,
        sub: `${team.memberCount} 名成员 · ${team.stats.seriesPlayed} 场`,
        target: { kind: "team", teamId: team.id },
      });
    }

    for (const record of data.matchRecords) {
      list.push({
        id: `match:${record.matchId}`,
        group: "比赛",
        kindLabel: "战报",
        title: `${record.radiantTeamName} vs ${record.direTeamName}`,
        sub: `#${record.matchId} · ${record.startTime}`,
        target: { kind: "match", matchId: record.matchId },
      });
    }

    return list;
  }, [data]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items.slice(0, 60);
    }

    return items
      .filter((item) =>
        `${item.title} ${item.sub} ${item.kindLabel}`.toLowerCase().includes(keyword),
      )
      .slice(0, 60);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => {
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const next = (current + delta + filtered.length) % Math.max(1, filtered.length);
          return next;
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          onSelect(item.target);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, activeIndex, onClose, onSelect]);

  const groups = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  let runningIndex = -1;

  return (
    <div className="palette-overlay" onPointerDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="命令面板"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="palette-input-row">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="搜索页面、赛事、选手、队伍、战报…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">没有匹配的结果</div>
          ) : (
            groups.map(([group, groupItems]) => (
              <div key={group}>
                <div className="palette-group-label">{group}</div>
                {groupItems.map((item) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`palette-item ${index === activeIndex ? "is-active" : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => onSelect(item.target)}
                    >
                      <span className="pi-kind">{item.kindLabel}</span>
                      <span className="pi-main">
                        <b>{item.title}</b>
                        <small>{item.sub}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-foot">
          <span>
            <kbd>↑↓</kbd>移动
          </span>
          <span>
            <kbd>Enter</kbd>打开
          </span>
          <span>
            <kbd>Esc</kbd>关闭
          </span>
        </div>
      </div>
    </div>
  );
}
