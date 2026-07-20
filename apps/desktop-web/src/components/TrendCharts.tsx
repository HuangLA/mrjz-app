import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MatchData, PlayerTrend } from "../data";
import {
  clampNumber,
  compactNumber,
  cssVars,
  formatTrendValue,
  playerTrendColor,
  playerTrendHeroName,
  playerTrendPolyline,
  sampleTrend,
  trendPolyline,
} from "../utils";
import { EmptyState, ImageWithFallback } from "./common";

const CHART_WIDTH = 720;
const ADVANTAGE_HEIGHT = 240;
const PLAYER_HEIGHT = 300;

type HoverState = { index: number; ratio: number } | null;

function useChartHover(pointCount: number) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState>(null);

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;

    if (!frame || pointCount <= 0) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    const ratio = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
    const index = Math.round(ratio * (pointCount - 1));

    setHover((current) => (current?.index === index ? current : { index, ratio: index / (pointCount - 1) }));
  };

  const handleLeave = () => setHover(null);

  return { frameRef, hover, handleMove, handleLeave };
}

function formatThousands(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function TrendSection({ match }: { match: MatchData }) {
  if (!match.trends.hasTrends) {
    return <EmptyState text="暂无" />;
  }

  return (
    <>
      <div className="trend-stack">
        <AdvantageTrendGraph match={match} />
        <PlayerGoldTrendGraph match={match} />
      </div>
      <ComparisonBars match={match} />
    </>
  );
}

function AdvantageTrendGraph({ match }: { match: MatchData }) {
  const gold = sampleTrend(match.trends.goldAdvantage, 90);
  const xp = sampleTrend(match.trends.xpAdvantage, 90);
  const pointCount = Math.max(gold.length, xp.length);
  const { frameRef, hover, handleMove, handleLeave } = useChartHover(pointCount);
  const lastGold = match.trends.goldAdvantage[match.trends.goldAdvantage.length - 1];
  const lastXp = match.trends.xpAdvantage[match.trends.xpAdvantage.length - 1];
  const maxAbs = Math.max(1, ...gold.map((point) => Math.abs(point.value)), ...xp.map((point) => Math.abs(point.value)));

  const hoverGold = hover ? gold[hover.index] : undefined;
  const hoverXp = hover ? xp[hover.index] : undefined;
  const hoverMinute = hover ? (hoverGold?.minute ?? hoverXp?.minute ?? 0) : 0;

  if (gold.length === 0 && xp.length === 0) {
    return (
      <div className="trend-card">
        <EmptyState text="暂无" />
      </div>
    );
  }

  return (
    <div className="trend-card trend-card-large">
      <div className="trend-card-head">
        <b>经济 / 经验差</b>
        <span>
          终值 经济 {formatTrendValue(lastGold?.value ?? 0)} · 经验 {formatTrendValue(lastXp?.value ?? 0)}
        </span>
      </div>
      <div
        className="trend-frame"
        ref={frameRef}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        role="img"
        aria-label="经济和经验差曲线,移动指针查看每分钟数值"
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${ADVANTAGE_HEIGHT}`} preserveAspectRatio="none">
          <TrendGridLines width={CHART_WIDTH} height={ADVANTAGE_HEIGHT} />
          <line x1="10" y1={ADVANTAGE_HEIGHT / 2} x2={CHART_WIDTH - 10} y2={ADVANTAGE_HEIGHT / 2} className="trend-axis" />
          {gold.length > 0 ? (
            <polyline
              points={trendPolyline(gold, { maxAbs, width: CHART_WIDTH, height: ADVANTAGE_HEIGHT })}
              className="trend-poly gold"
            />
          ) : null}
          {xp.length > 0 ? (
            <polyline
              points={trendPolyline(xp, { maxAbs, width: CHART_WIDTH, height: ADVANTAGE_HEIGHT })}
              className="trend-poly xp"
            />
          ) : null}
          {hover ? (
            <line
              x1={8 + hover.ratio * (CHART_WIDTH - 16)}
              y1="6"
              x2={8 + hover.ratio * (CHART_WIDTH - 16)}
              y2={ADVANTAGE_HEIGHT - 6}
              className="trend-crosshair"
            />
          ) : null}
        </svg>
        <span className="trend-side-tag is-top">{match.radiant.name} 优势区</span>
        <span className="trend-side-tag is-bottom">{match.dire.name} 优势区</span>
        {hover ? (
          <>
            <span className="trend-time-badge" style={cssVars({ "--hover-x": `${hover.ratio * 100}%` })}>
              {hoverMinute}:00
            </span>
            <div className="trend-tooltip is-advantage" style={cssVars({ "--hover-x": `${hover.ratio * 100}%` })}>
              <TrendDiffRow label="经济差" value={hoverGold?.value ?? 0} kind="gold" />
              <TrendDiffRow label="经验差" value={hoverXp?.value ?? 0} kind="xp" />
            </div>
          </>
        ) : null}
      </div>
      <div className="trend-legend">
        <span>
          <i className="trend-dot gold" />
          经济差
        </span>
        <span>
          <i className="trend-dot xp" />
          经验差
        </span>
      </div>
      <div className="trend-scale">
        <span>{`${Math.min(gold[0]?.minute ?? 0, xp[0]?.minute ?? 0)}m`}</span>
        <span>{`±${compactNumber(maxAbs)}`}</span>
        <span>{`${Math.max(lastGold?.minute ?? 0, lastXp?.minute ?? 0)}m`}</span>
      </div>
    </div>
  );
}

function TrendDiffRow({ label, value, kind }: { label: string; value: number; kind: "gold" | "xp" }) {
  const signClass = value > 0 ? "is-positive" : value < 0 ? "is-negative" : "";

  return (
    <div className="trend-tooltip-row">
      <i className={`trend-dot ${kind}`} />
      <span>{label}</span>
      <b className={signClass}>
        {value > 0 ? "+" : ""}
        {formatThousands(value)}
      </b>
    </div>
  );
}

function PlayerGoldTrendGraph({ match }: { match: MatchData }) {
  const trends = useMemo(
    () =>
      match.trends.playerGold
        .filter((trend) => trend.values.length > 0)
        .slice()
        .sort((left, right) => left.playerSlot - right.playerSlot),
    [match.trends.playerGold],
  );
  const pointCount = Math.max(0, ...trends.map((trend) => trend.values.length));
  const { frameRef, hover, handleMove, handleLeave } = useChartHover(pointCount);
  const maxGold = Math.max(1, ...trends.flatMap((trend) => trend.values));
  const portraitBySlot = useMemo(() => {
    const map = new Map<string, { portrait: string; hero: string }>();

    for (const player of match.players) {
      map.set(player.id, { portrait: player.portrait, hero: player.hero });
    }

    return map;
  }, [match.players]);

  const rankedAtHover = useMemo(() => {
    if (!hover) {
      return [];
    }

    return trends
      .map((trend, index) => ({
        trend,
        color: playerTrendColor(index, trend.side),
        value: trend.values[hover.index] ?? trend.values[trend.values.length - 1] ?? 0,
      }))
      .sort((left, right) => right.value - left.value);
  }, [hover, trends]);

  if (trends.length === 0) {
    return null;
  }

  return (
    <div className="trend-card trend-card-large">
      <div className="trend-card-head">
        <b>选手经济曲线</b>
        <span>{trends.length} 名选手 · 峰值 {compactNumber(maxGold)}</span>
      </div>
      <div
        className="trend-frame"
        ref={frameRef}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        role="img"
        aria-label="所有选手经济曲线,移动指针查看每分钟排名"
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${PLAYER_HEIGHT}`} preserveAspectRatio="none">
          <TrendGridLines width={CHART_WIDTH} height={PLAYER_HEIGHT} />
          {trends.map((trend, index) => (
            <polyline
              key={`${trend.playerSlot}:${trend.playerName}`}
              points={playerTrendPolyline(trend.values, maxGold, CHART_WIDTH, PLAYER_HEIGHT)}
              className="player-trend-line"
              style={cssVars({ "--trend-color": playerTrendColor(index, trend.side) })}
            />
          ))}
          {hover ? (
            <line
              x1={8 + hover.ratio * (CHART_WIDTH - 16)}
              y1="6"
              x2={8 + hover.ratio * (CHART_WIDTH - 16)}
              y2={PLAYER_HEIGHT - 6}
              className="trend-crosshair"
            />
          ) : null}
        </svg>
        {hover ? (
          <>
            <span className="trend-time-badge" style={cssVars({ "--hover-x": `${hover.ratio * 100}%` })}>
              {hover.index}:00
            </span>
            <div className="trend-tooltip is-ranking" style={cssVars({ "--hover-x": `${hover.ratio * 100}%` })}>
              {rankedAtHover.map(({ trend, color, value }, rank) => {
                const meta = portraitBySlot.get(String(trend.playerSlot));

                return (
                  <div className="trend-tooltip-row is-player" key={`${trend.playerSlot}:${trend.playerName}`}>
                    <span className="trend-rank">{rank + 1}</span>
                    <i className="trend-color-strip" style={{ background: color }} />
                    {meta ? (
                      <ImageWithFallback src={meta.portrait} fallback="/static/dota/heroes/unknown.svg" alt="" loading="lazy" />
                    ) : null}
                    <span className="trend-player-name">{playerTrendHeroName(match, trend)}</span>
                    <b>{formatThousands(value)}</b>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      <div className="trend-player-legend">
        {trends.map((trend, index) => (
          <span className={trend.side} key={`${trend.playerSlot}:${trend.playerName}`}>
            <i style={{ background: playerTrendColor(index, trend.side) }} />
            <b>{playerTrendHeroName(match, trend)}</b>
            <small>{compactNumber(trend.values[trend.values.length - 1] ?? 0)}</small>
          </span>
        ))}
      </div>
      <div className="trend-scale">
        <span>0m</span>
        <span>{compactNumber(maxGold)}</span>
        <span>{`${Math.max(...trends.map((trend) => trend.values.length - 1))}m`}</span>
      </div>
    </div>
  );
}

function TrendGridLines({ width, height }: { width: number; height: number }) {
  const top = 10;
  const middle = height / 2;
  const bottom = height - 10;

  return (
    <>
      <line x1="10" y1={top} x2={width - 10} y2={top} className="trend-grid-line" />
      <line x1="10" y1={middle} x2={width - 10} y2={middle} className="trend-grid-line muted" />
      <line x1="10" y1={bottom} x2={width - 10} y2={bottom} className="trend-grid-line" />
    </>
  );
}

function ComparisonBars({ match }: { match: MatchData }) {
  if (match.comparisons.length === 0) {
    return null;
  }

  return (
    <div className="comparison-list">
      {match.comparisons.map((metric) => {
        const share = clampNumber(metric.radiantShare, 0.08, 0.92);

        return (
          <div className="comparison-row" key={metric.key}>
            <span>{metric.label}</span>
            <div className="comparison-track">
              <i className="comparison-fill radiant" style={{ width: `${(share * 100).toFixed(1)}%` }} />
              <i className="comparison-fill dire" style={{ width: `${((1 - share) * 100).toFixed(1)}%` }} />
            </div>
            <small>
              {compactNumber(metric.radiantValue)} / {compactNumber(metric.direValue)}
            </small>
          </div>
        );
      })}
    </div>
  );
}

export type { PlayerTrend };
