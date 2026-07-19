import type { MatchRecord, TeamSide } from "../data";
import { cssVars } from "../utils";
import { ImageWithFallback } from "./common";

export function MatchRecordCard({
  record,
  index = 0,
  onOpenMatch,
}: {
  record: MatchRecord;
  index?: number;
  onOpenMatch: (matchId: string) => void;
}) {
  const score =
    record.radiantScore === null || record.direScore === null
      ? "- : -"
      : `${record.radiantScore} : ${record.direScore}`;
  const winnerClass =
    record.radiantWin === null ? "" : record.radiantWin ? "radiant-win" : "dire-win";
  const heroCount = record.heroLineups.radiant.length + record.heroLineups.dire.length;

  return (
    <article
      className={`record-card reveal ${winnerClass}`}
      style={cssVars({ "--reveal-delay": `${Math.min(index * 30, 450)}ms` })}
    >
      <button className="record-main" type="button" onClick={() => onOpenMatch(record.matchId)}>
        <div className="record-head">
          <span>#{record.matchId}</span>
          <b>{record.startTime}</b>
        </div>
        <div className="record-score">
          <span className="record-team is-radiant">{record.radiantTeamName}</span>
          <strong>{score}</strong>
          <span className="record-team is-dire">{record.direTeamName}</span>
        </div>
        <RecordHeroMatchup record={record} />
        <div className="record-meta">
          <span>{record.duration}</span>
          <span>{record.parseStatus}</span>
          <span>{record.playerCount} 人</span>
        </div>
        <div className="record-flags">
          <RecordFlag label={`英雄 ${heroCount || "-"}`} active={heroCount > 0} />
          <RecordFlag label="BP" active={record.hasDraft} />
          <RecordFlag label="眼位" active={record.hasVision} />
          <RecordFlag label="聊天" active={record.hasChat} />
        </div>
      </button>
    </article>
  );
}

function RecordHeroMatchup({ record }: { record: MatchRecord }) {
  const hasLineup = record.heroLineups.radiant.length > 0 || record.heroLineups.dire.length > 0;

  if (!hasLineup) {
    return (
      <div className="record-lineup empty">
        <span>英雄阵容待同步</span>
      </div>
    );
  }

  return (
    <div className="record-lineup" aria-label="双方英雄对阵">
      <RecordHeroStrip side="radiant" heroes={record.heroLineups.radiant} />
      <span className="record-versus" aria-hidden="true">
        <i />
        <b>VS</b>
        <i />
      </span>
      <RecordHeroStrip side="dire" heroes={record.heroLineups.dire} />
    </div>
  );
}

function RecordHeroStrip({
  side,
  heroes,
}: {
  side: TeamSide;
  heroes: MatchRecord["heroLineups"][TeamSide];
}) {
  return (
    <span className={`record-hero-strip ${side}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <RecordHero side={side} hero={heroes[index]} index={index} key={`${side}:${index}`} />
      ))}
    </span>
  );
}

function RecordHero({
  side,
  hero,
  index,
}: {
  side: TeamSide;
  hero: MatchRecord["heroLineups"][TeamSide][number] | undefined;
  index: number;
}) {
  if (!hero) {
    return (
      <span className="record-hero empty" style={cssVars({ "--hero-delay": `${index * 40}ms` })}>
        <i />
      </span>
    );
  }

  const title = `${side === "radiant" ? "天辉" : "夜魇"} · ${hero.playerName} · ${hero.hero}`;

  return (
    <span
      className="record-hero"
      style={cssVars({ "--hero-delay": `${index * 40}ms` })}
      title={title}
    >
      <ImageWithFallback src={hero.portrait} fallback={hero.icon} alt={hero.hero} loading="lazy" />
    </span>
  );
}

function RecordFlag({ label, active }: { label: string; active: boolean }) {
  return <span className={active ? "active" : ""}>{label}</span>;
}
