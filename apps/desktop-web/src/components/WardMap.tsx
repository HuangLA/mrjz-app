import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { mapDotaMapCoordinatesToPercent } from "@mrjz/shared/dota-map";
import type { MatchData } from "../data";
import {
  clampNumber,
  cssVars,
  formatWardClock,
  getWardTimelineMaxSecond,
  isWardVisibleAt,
  uniqueWardEvents,
  wardDisplayType,
} from "../utils";

export function WardTimeline({
  match,
  selectedSecond,
  onChange,
}: {
  match: MatchData;
  selectedSecond: number;
  onChange: (seconds: number) => void;
}) {
  const rangeRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const mapEvents = useMemo(
    () =>
      match.wardTimeline
        .filter((event) => event.x !== null && event.y !== null)
        .slice()
        .sort((a, b) => a.timeSeconds - b.timeSeconds),
    [match.wardTimeline],
  );
  const maxSecond = getWardTimelineMaxSecond(match);
  const safeSelectedSecond = clampNumber(selectedSecond, 0, maxSecond);
  const selectedProgress = maxSecond > 0 ? (safeSelectedSecond / maxSecond) * 100 : 0;
  const activeEvents = mapEvents.filter((event) => isWardVisibleAt(event, safeSelectedSecond));
  const markerEvents = uniqueWardEvents(mapEvents);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const range = rangeRef.current;

      if (!range) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : clampNumber((clientX - rect.left) / rect.width, 0, 1);
      const stepped = Math.round((ratio * maxSecond) / 15) * 15;
      onChange(clampNumber(stepped, 0, maxSecond));
    },
    [maxSecond, onChange],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      event.preventDefault();
      updateFromClientX(event.clientX);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragging(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 60 : 15;
    let nextSecond: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextSecond = safeSelectedSecond + step;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextSecond = safeSelectedSecond - step;
    } else if (event.key === "Home") {
      nextSecond = 0;
    } else if (event.key === "End") {
      nextSecond = maxSecond;
    }

    if (nextSecond !== null) {
      event.preventDefault();
      onChange(clampNumber(nextSecond, 0, maxSecond));
    }
  };

  return (
    <div className="vision-timeline">
      <div className="vision-board">
        <div className="vision-map" aria-label="眼位小地图时间轴">
          <img src="/static/dota/wards/minimap/minimap_game.png" alt="" loading="lazy" />
          {markerEvents.map((event, index) => (
            <WardMapDot
              key={`${event.timeSeconds}:${event.side}:${event.type}:${event.x}:${event.y}:${index}`}
              event={event}
              selectedSecond={safeSelectedSecond}
            />
          ))}
          <div className="vision-hud">
            <span className="vision-chip radiant">
              天辉 {activeEvents.filter((event) => event.side === "radiant").length}
            </span>
            <span className="vision-clock">{formatWardClock(safeSelectedSecond)}</span>
            <span className="vision-chip dire">
              夜魇 {activeEvents.filter((event) => event.side === "dire").length}
            </span>
          </div>
        </div>
        <div className="vision-side">
          <h3>视野回放</h3>
          <p className="vision-side-clock">{formatWardClock(safeSelectedSecond)}</p>
          <p className="vision-side-count">
            当前在岗 <b>{activeEvents.length}</b> / 累计 {markerEvents.length} 眼位
          </p>
          <p className="vision-side-hint">
            拖动时间轴或使用 ← → 键逐 15 秒回放，Shift 加速为 60 秒。
          </p>
          <div className="vision-legend">
            <span>
              <i className="vision-legend-dot observer radiant" /> 天辉假眼
            </span>
            <span>
              <i className="vision-legend-dot sentry radiant" /> 天辉真眼
            </span>
            <span>
              <i className="vision-legend-dot observer dire" /> 夜魇假眼
            </span>
            <span>
              <i className="vision-legend-dot sentry dire" /> 夜魇真眼
            </span>
          </div>
        </div>
      </div>
      <div className="vision-scrubber">
        <div
          className="vision-range"
          role="slider"
          tabIndex={0}
          ref={rangeRef}
          style={cssVars({
            "--ward-progress": `${clampNumber(selectedProgress, 0, 100).toFixed(2)}%`,
          })}
          aria-valuemin={0}
          aria-valuemax={maxSecond}
          aria-valuenow={safeSelectedSecond}
          aria-valuetext={formatWardClock(safeSelectedSecond)}
          aria-label="选择眼位时间点"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={handleKeyDown}
        />
        <div className="vision-scale">
          <span>0:00</span>
          <b>{activeEvents.length} 眼位</b>
          <span>{formatWardClock(maxSecond)}</span>
        </div>
      </div>
    </div>
  );
}

function WardMapDot({
  event,
  selectedSecond,
}: {
  event: MatchData["wardTimeline"][number];
  selectedSecond: number;
}) {
  const position = mapDotaMapCoordinatesToPercent(event.x, event.y);
  const left = clampNumber(position.left, 4, 96);
  const top = clampNumber(position.top, 4, 96);
  const isActive = isWardVisibleAt(event, selectedSecond);
  const icon = event.type === "岗哨守卫" ? "sentry" : "observer";
  const displayType = wardDisplayType(event);

  return (
    <span
      role="img"
      className={`ward-marker ${event.side} ${icon} ${isActive ? "active" : ""}`}
      style={{ left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` }}
      title={`${event.time} ${displayType} ${event.note}`}
      aria-label={`${event.time} ${event.side === "radiant" ? "天辉" : "夜魇"} ${displayType}`}
    />
  );
}
