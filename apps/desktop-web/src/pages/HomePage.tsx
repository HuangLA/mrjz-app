import type { MobileData } from "../api";
import type { AcknowledgementItem, MatchRecord, TeamSide } from "../data";
import { CountUp, EmptyState, ImageWithFallback } from "../components/common";
import { cssVars, lifecycleLabel } from "../utils";
import { useEffect, useState } from "react";

const homeHeroPortraitRows: Record<TeamSide, string[]> = {
  radiant: [
    "/static/dota/heroes/pudge.png",
    "/static/dota/heroes/windrunner.png",
    "/static/dota/heroes/juggernaut.png",
    "/static/dota/heroes/invoker.png",
    "/static/dota/heroes/phantom_assassin.png",
    "/static/dota/heroes/earthshaker.png",
    "/static/dota/heroes/lina.png",
    "/static/dota/heroes/nevermore.png",
    "/static/dota/heroes/queenofpain.png",
    "/static/dota/heroes/axe.png",
    "/static/dota/heroes/mirana.png",
    "/static/dota/heroes/ember_spirit.png",
    "/static/dota/heroes/mars.png",
    "/static/dota/heroes/snapfire.png",
  ],
  dire: [
    "/static/dota/heroes/templar_assassin.png",
    "/static/dota/heroes/void_spirit.png",
    "/static/dota/heroes/drow_ranger.png",
    "/static/dota/heroes/sven.png",
    "/static/dota/heroes/tiny.png",
    "/static/dota/heroes/rubick.png",
    "/static/dota/heroes/slark.png",
    "/static/dota/heroes/tidehunter.png",
    "/static/dota/heroes/morphling.png",
    "/static/dota/heroes/ursa.png",
    "/static/dota/heroes/puck.png",
    "/static/dota/heroes/sniper.png",
    "/static/dota/heroes/chaos_knight.png",
    "/static/dota/heroes/muerta.png",
  ],
};

const homeHeroRailCardWidth = 168;
const homeHeroRailGap = 14;

export function HomePage({
  data,
  onSelectTournament,
}: {
  data: MobileData;
  onSelectTournament: (tournamentId: string) => void;
}) {
  const recordTotal = data.tournamentOptions.reduce((sum, option) => sum + option.matchCount, 0);

  return (
    <div className="page-stack home-page">
      <HomeHero
        tournamentCount={data.tournamentOptions.length}
        recordCount={recordTotal}
        acknowledgements={data.acknowledgements}
      />
      <section className="panel reveal tournament-gateway">
        <header className="panel-head">
          <div className="panel-title">
            <h2>赛事入口</h2>
            <p>选择一届赛事进入阶段、赛程与战报</p>
          </div>
          <span className="pill">{data.tournamentOptions.length} 届</span>
        </header>
        <div className="tournament-entry-grid">
          {data.tournamentOptions.length > 0 ? (
            data.tournamentOptions.map((option, index) => (
              <TournamentEntry
                key={option.id}
                option={option}
                active={data.selectedTournamentId === option.id}
                records={data.tournamentRecentRecords[option.id] ?? []}
                index={index}
                onSelect={onSelectTournament}
              />
            ))
          ) : (
            <EmptyState text="暂无可查看赛事" />
          )}
        </div>
      </section>
    </div>
  );
}

function HomeHero({
  tournamentCount,
  recordCount,
  acknowledgements = [],
}: {
  tournamentCount: number;
  recordCount: number;
  acknowledgements?: AcknowledgementItem[];
}) {
  const sponsorAcknowledgements = acknowledgements.filter((item) => item.category === "sponsor");
  const communityAcknowledgements = acknowledgements.filter(
    (item) => item.category === "community",
  );
  const hasAcknowledgements =
    sponsorAcknowledgements.length > 0 || communityAcknowledgements.length > 0;

  return (
    <section className="home-hero">
      <HomeHeroRail side="radiant" />
      <HomeHeroRail side="dire" />
      <div className="home-hero-orbs" aria-hidden="true">
        <i className="orb orb-a" />
        <i className="orb orb-b" />
        <i className="orb orb-c" />
      </div>
      <div className="home-hero-content">
        <div className="home-brand-core">
          <span className="home-brand-season">COMMUNITY LEAGUE</span>
          <strong>每日节奏杯</strong>
          <span className="home-brand-sub">DRAFT · FIGHT · RECORD</span>
        </div>
        <div className="home-hero-stats">
          <HomeHeroStat label="届次" value={tournamentCount} />
          <HomeHeroStat label="比赛" value={recordCount} />
          <span className="home-hero-stat">
            <small>战场</small>
            <b>DOTA2</b>
          </span>
        </div>
        {hasAcknowledgements ? (
          <div className="home-sponsor-panel" aria-label="鸣谢名单">
            <div className="home-sponsor-heading">
              <span>鸣谢名单</span>
            </div>
            {sponsorAcknowledgements.length > 0 ? (
              <div className="home-sponsor-section">
                <div className="home-sponsor-section-title">
                  <span>赞助商</span>
                  <small>SPONSORS</small>
                </div>
                <div
                  className={`home-major-sponsors ${sponsorAcknowledgements.length > 4 ? "is-compact" : ""}`}
                >
                  {sponsorAcknowledgements.map((sponsor) => (
                    <div className="home-major-sponsor" key={sponsor.id}>
                      {sponsor.imageUrl !== null ? (
                        <img src={sponsor.imageUrl} alt={sponsor.displayName} loading="eager" />
                      ) : null}
                      <span>{sponsor.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {communityAcknowledgements.length > 0 ? (
              <div className="home-sponsor-section">
                <div className="home-sponsor-section-title">
                  <span>社区支持</span>
                  <small>COMMUNITY</small>
                </div>
                <div className="home-community-supporters" aria-label="社区支持">
                  {communityAcknowledgements.map((supporter) => (
                    <div className="home-community-supporter" key={supporter.id}>
                      <AcknowledgementAvatar item={supporter} />
                      <span>{supporter.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HomeHeroStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="home-hero-stat">
      <small>{label}</small>
      <b>
        <CountUp value={value} />
      </b>
    </span>
  );
}

function AcknowledgementAvatar({ item }: { item: AcknowledgementItem }) {
  const [failed, setFailed] = useState(false);
  const initial = item.displayName.slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    setFailed(false);
  }, [item.imageUrl]);

  if (!item.imageUrl || failed) {
    return <span className="home-community-avatar fallback">{initial}</span>;
  }

  return (
    <span className="home-community-avatar">
      <img
        src={item.imageUrl}
        alt={item.displayName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function HomeHeroRail({ side }: { side: TeamSide }) {
  const rowHeroes = homeHeroPortraitRows[side];
  const visibleHeroes = [...rowHeroes, ...rowHeroes, ...rowHeroes];
  const railDistance = rowHeroes.length * (homeHeroRailCardWidth + homeHeroRailGap);

  return (
    <div className={`home-hero-rail ${side}`} aria-hidden="true">
      <div
        className="home-hero-track"
        style={cssVars({
          "--hero-rail-distance": `${railDistance}px`,
          "--hero-rail-offset": `-${railDistance}px`,
        })}
      >
        {visibleHeroes.map((src, index) => (
          <span key={`${src}:${index}`}>
            <ImageWithFallback
              src={src}
              fallback="/static/dota/heroes/unknown.svg"
              alt=""
              loading="eager"
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function TournamentEntry({
  option,
  active,
  records,
  index,
  onSelect,
}: {
  option: MobileData["tournamentOptions"][number];
  active: boolean;
  records: MatchRecord[];
  index: number;
  onSelect: (tournamentId: string) => void;
}) {
  const latest = records[0];
  const score =
    latest === undefined || latest.radiantScore === null || latest.direScore === null
      ? "暂无赛果"
      : `${latest.radiantScore}:${latest.direScore}`;
  const latestText =
    latest === undefined ? "--" : `${latest.radiantTeamName} ${score} ${latest.direTeamName}`;

  return (
    <article
      className={`tournament-entry reveal ${active ? "active" : ""}`}
      style={cssVars({ "--reveal-delay": `${index * 70}ms` })}
    >
      <button className="tournament-entry-main" type="button" onClick={() => onSelect(option.id)}>
        <span className="tournament-entry-index">{String(index + 1).padStart(2, "0")}</span>
        <div className="tournament-entry-body">
          <h3>{option.name}</h3>
          <span>
            {lifecycleLabel(option.status)} · {option.startsAt}
          </span>
          <small className="tournament-entry-latest">{latestText}</small>
        </div>
        <div className="tournament-entry-action">
          <strong>{active ? "当前" : "进入"}</strong>
          <span className="tournament-entry-count">{option.matchCount} 场</span>
        </div>
      </button>
    </article>
  );
}
