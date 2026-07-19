import type { MatchData } from "../data";
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
import { EmptyState } from "./common";

export function TrendSection({ match }: { match: MatchData }) {
  if (!match.trends.hasTrends) {
    return <EmptyState text="暂无" />;
  }

  return (
    <>
      <div className="trend-grid">
        <AdvantageTrendGraph match={match} />
        <PlayerGoldTrendGraph match={match} />
      </div>
      <ComparisonBars match={match} />
    </>
  );
}

function AdvantageTrendGraph({ match }: { match: MatchData }) {
  const gold = sampleTrend(match.trends.goldAdvantage, 44);
  const xp = sampleTrend(match.trends.xpAdvantage, 44);
  const lastGold = match.trends.goldAdvantage[match.trends.goldAdvantage.length - 1];
  const lastXp = match.trends.xpAdvantage[match.trends.xpAdvantage.length - 1];
  const maxAbs = Math.max(
    1,
    ...gold.map((point) => Math.abs(point.value)),
    ...xp.map((point) => Math.abs(point.value)),
  );

  if (gold.length === 0 && xp.length === 0) {
    return (
      <div className="trend-card">
        <EmptyState text="暂无" />
      </div>
    );
  }

  return (
    <div className="trend-card trend-card-wide">
      <div className="trend-card-head">
        <b>经济 / 经验差</b>
        <span>
          经济 {formatTrendValue(lastGold?.value ?? 0)} · 经验{" "}
          {formatTrendValue(lastXp?.value ?? 0)}
        </span>
      </div>
      <svg viewBox="0 0 280 112" role="img" aria-label="经济和经验差曲线">
        <TrendGridLines width={280} height={112} />
        <line x1="10" y1="56" x2="270" y2="56" className="trend-axis" />
        {gold.length > 0 ? (
          <polyline
            points={trendPolyline(gold, { maxAbs, width: 280, height: 112 })}
            className="trend-poly gold"
          />
        ) : null}
        {xp.length > 0 ? (
          <polyline
            points={trendPolyline(xp, { maxAbs, width: 280, height: 112 })}
            className="trend-poly xp"
          />
        ) : null}
      </svg>
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

function PlayerGoldTrendGraph({ match }: { match: MatchData }) {
  const trends = match.trends.playerGold
    .filter((trend) => trend.values.length > 0)
    .slice()
    .sort((left, right) => left.playerSlot - right.playerSlot);
  const maxGold = Math.max(1, ...trends.flatMap((trend) => trend.values));

  if (trends.length === 0) {
    return null;
  }

  return (
    <div className="trend-card trend-card-wide">
      <div className="trend-card-head">
        <b>选手经济曲线</b>
        <span>{trends.length} 名选手</span>
      </div>
      <svg viewBox="0 0 280 128" role="img" aria-label="所有选手经济曲线">
        <TrendGridLines width={280} height={128} />
        {trends.map((trend, index) => (
          <polyline
            key={`${trend.playerSlot}:${trend.playerName}`}
            points={playerTrendPolyline(trend.values, maxGold, 280, 128)}
            className="player-trend-line"
            style={cssVars({ "--trend-color": playerTrendColor(index, trend.side) })}
          />
        ))}
      </svg>
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
              <i
                className="comparison-fill radiant"
                style={{ width: `${(share * 100).toFixed(1)}%` }}
              />
              <i
                className="comparison-fill dire"
                style={{ width: `${((1 - share) * 100).toFixed(1)}%` }}
              />
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
