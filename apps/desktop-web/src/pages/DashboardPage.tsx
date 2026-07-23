import { useEffect, useMemo, useRef, useState } from "react";
import type { MobileData } from "../api";
import type { AcknowledgementItem, AppRoute, MatchRecord } from "../data";
import {
  CountUp,
  EmptyState,
  ImageWithFallback,
  PlayerAvatar,
  TeamLogoMark,
} from "../components/common";
import {
  formatLeaderboardValue,
  lifecycleLabel,
  officialStageOptions,
  statusClass,
} from "../utils";

export function DashboardPage({
  data,
  onNavigate,
  onOpenMatch,
  onSelectTournament,
}: {
  data: MobileData;
  onNavigate: (route: AppRoute) => void;
  onOpenMatch: (matchId: string) => void;
  onSelectTournament: (tournamentId: string) => void;
}) {
  const [communityOpen, setCommunityOpen] = useState(false);
  const meta = data.selectedTournamentMeta;
  const recordTotal = data.tournamentOptions.reduce((sum, option) => sum + option.matchCount, 0);
  const stageKey = officialStageOptions(data)[0]?.key ?? "group";
  const standings = data.stageViews[stageKey].standings.slice(0, 6);
  const latestRecords = data.matchRecords.slice(0, 6);
  const upcoming = useMemo(
    () =>
      data.scheduleGroups
        .flatMap((group) => group.matches.map((match) => ({ date: group.date, match })))
        .filter((entry) => entry.match.status === "未开始")
        .slice(0, 6),
    [data.scheduleGroups],
  );
  const boards = data.heroLeaderboards.leaderboards.filter((board) => board.winner).slice(0, 4);
  const topPlayers = useMemo(
    () => [...data.players].sort((a, b) => b.stats.totalMatches - a.stats.totalMatches).slice(0, 5),
    [data.players],
  );
  const topTeams = useMemo(
    () => [...data.teams].sort((a, b) => b.stats.seriesPlayed - a.stats.seriesPlayed).slice(0, 4),
    [data.teams],
  );
  const sponsors = data.acknowledgements.filter((item) => item.category === "sponsor");
  const community = data.acknowledgements.filter((item) => item.category === "community");

  return (
    <div className="page-stack">
      <section className="dash-hero reveal">
        <div>
          <span className="kicker">MRJZ CONSOLE · 每日节奏杯</span>
          <h1>{data.selectedTournamentName}</h1>
          <p className="dash-hero-meta">
            League {meta.leagueId} · {meta.statusText} · {meta.startsAt}
          </p>
        </div>
        <div className="dash-hero-stats">
          <span className="dash-hero-stat">
            <small>届次</small>
            <b>
              <CountUp value={data.tournamentOptions.length} />
            </b>
          </span>
          <span className="dash-hero-stat">
            <small>总比赛</small>
            <b>
              <CountUp value={recordTotal} />
            </b>
          </span>
          <span className="dash-hero-stat">
            <small>本届入库</small>
            <b>
              <CountUp value={data.matchRecords.length} />
            </b>
          </span>
        </div>
      </section>

      <div className="dash-grid">
        <section
          className="panel dash-col-4 reveal"
          style={{ "--reveal-delay": "40ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>积分榜</h2>
              <p>{data.stageViews[stageKey].name}</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => onNavigate("stage")}>
              全部
            </button>
          </header>
          <div className="dash-list">
            {standings.length > 0 ? (
              standings.map((row) => (
                <button
                  className="dash-list-row"
                  key={`${row.teamId}:${row.rank}`}
                  type="button"
                  onClick={() => onNavigate("stage")}
                >
                  <span className={`dl-rank ${row.rank <= 3 ? "is-top" : ""}`}>{row.rank}</span>
                  <span className="dl-main">{row.team}</span>
                  <span className="dl-score">{row.score}</span>
                  <span className="dl-sub">{row.points}</span>
                </button>
              ))
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </section>

        <section
          className="panel dash-col-8 reveal"
          style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>最新战报</h2>
              <p>OpenDota 实时入库</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => onNavigate("records")}>
              工作台
            </button>
          </header>
          <div className="dash-list">
            {latestRecords.length > 0 ? (
              latestRecords.map((record) => (
                <button
                  className="dash-list-row"
                  key={record.matchId}
                  type="button"
                  onClick={() => onOpenMatch(record.matchId)}
                >
                  <span className="dl-main">
                    <span className={record.radiantWin === true ? "dl-winner is-radiant" : record.radiantWin === false ? "dl-loser" : ""}>
                      {record.radiantTeamName}
                    </span>
                    {" vs "}
                    <span className={record.radiantWin === false ? "dl-winner is-dire" : record.radiantWin === true ? "dl-loser" : ""}>
                      {record.direTeamName}
                    </span>
                  </span>
                  <span className="dl-score">
                    {record.radiantScore === null || record.direScore === null
                      ? "-:-"
                      : `${record.radiantScore}:${record.direScore}`}
                  </span>
                  <span className="dl-sub">{record.startTime}</span>
                </button>
              ))
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </section>

        <section
          className="panel dash-col-4 reveal"
          style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>即将开赛</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => onNavigate("schedule")}>
              赛程
            </button>
          </header>
          <div className="dash-list">
            {upcoming.length > 0 ? (
              upcoming.map(({ date, match }) => (
                <button
                  className="dash-list-row"
                  key={`${date}:${match.time}:${match.teamA}:${match.teamB}`}
                  type="button"
                  onClick={() => onNavigate("schedule")}
                >
                  <span className="dl-sub">{match.time}</span>
                  <span className="dl-main">
                    {match.teamA} vs {match.teamB}
                  </span>
                  <span className={`status-tag ${statusClass(match.status)}`}>{match.status}</span>
                </button>
              ))
            ) : (
              <EmptyState text="暂无待开赛" />
            )}
          </div>
        </section>

        <section
          className="panel dash-col-4 reveal"
          style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>英雄榜</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => onNavigate("leaderboard")}
            >
              全部
            </button>
          </header>
          <div className="dash-list">
            {boards.length > 0 ? (
              boards.map((board) => (
                <button
                  className="dash-list-row"
                  key={board.key}
                  type="button"
                  onClick={() => onNavigate("leaderboard")}
                >
                  <span className="dl-sub">{board.title}</span>
                  <span className="dl-main">{board.winner!.player.displayName}</span>
                  <span className="dl-score">
                    {formatLeaderboardValue(board.winner!.average, board)}
                  </span>
                </button>
              ))
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </section>

        <section
          className="panel dash-col-4 reveal"
          style={{ "--reveal-delay": "200ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>选手榜</h2>
              <p>按场次</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => onNavigate("players")}>
              数据榜
            </button>
          </header>
          <div className="dash-list">
            {topPlayers.length > 0 ? (
              topPlayers.map((player, index) => (
                <button
                  className="dash-list-row"
                  key={player.id}
                  type="button"
                  onClick={() => onNavigate("players")}
                >
                  <span className={`dl-rank ${index < 3 ? "is-top" : ""}`}>{index + 1}</span>
                  <PlayerAvatar player={player} />
                  <span className="dl-main">{player.displayName}</span>
                  <span className="dl-score">{player.stats.winRate}</span>
                  <span className="dl-sub">{player.stats.totalMatches} 场</span>
                </button>
              ))
            ) : (
              <EmptyState text="读取中" />
            )}
          </div>
        </section>

        <section
          className="panel dash-col-6 reveal"
          style={{ "--reveal-delay": "240ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>战队</h2>
              <p>按参赛场次</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => onNavigate("teams")}>
              全部
            </button>
          </header>
          <div className="dash-list">
            {topTeams.length > 0 ? (
              topTeams.map((team) => (
                <button
                  className="dash-list-row"
                  key={team.id}
                  type="button"
                  onClick={() => onNavigate("teams")}
                >
                  <TeamLogoMark team={team} size="small" />
                  <span className="dl-main">{team.name}</span>
                  <span className="dl-score">{team.stats.winRate}</span>
                  <span className="dl-sub">
                    {team.stats.seriesWins}胜 {team.stats.seriesLosses}负
                  </span>
                </button>
              ))
            ) : (
              <EmptyState text="读取中" />
            )}
          </div>
        </section>

        <section
          className="panel dash-col-6 reveal"
          style={{ "--reveal-delay": "280ms" } as React.CSSProperties}
        >
          <header className="panel-head">
            <div className="panel-title">
              <h2>历届赛事</h2>
            </div>
          </header>
          <div className="dash-list">
            {data.tournamentOptions.map((option) => (
              <TournamentRow
                key={option.id}
                option={option}
                active={data.selectedTournamentId === option.id}
                records={data.tournamentRecentRecords[option.id] ?? []}
                onSelect={onSelectTournament}
              />
            ))}
          </div>
        </section>

        {sponsors.length > 0 || community.length > 0 ? (
          <section
            className="panel dash-col-12 reveal"
            style={{ "--reveal-delay": "320ms" } as React.CSSProperties}
          >
            <div className="dash-sponsors">
              <span className="kicker">鸣谢</span>
              {sponsors.map((sponsor) => (
                <span className="dash-sponsor" key={sponsor.id} title={sponsor.displayName}>
                  {sponsor.imageUrl !== null ? (
                    <img src={sponsor.imageUrl} alt={sponsor.displayName} loading="lazy" />
                  ) : null}
                </span>
              ))}
              {community.length > 0 ? (
                <button
                  className="dash-sponsor dash-community-trigger"
                  type="button"
                  onClick={() => setCommunityOpen(true)}
                >
                  <span className="dash-community">
                    {community.slice(0, 10).map((supporter) => (
                      <span
                        className="dash-community-avatar"
                        key={supporter.id}
                        title={supporter.displayName}
                      >
                        {supporter.imageUrl ? (
                          <ImageWithFallback
                            src={supporter.imageUrl}
                            fallback=""
                            alt={supporter.displayName}
                            loading="lazy"
                          />
                        ) : (
                          supporter.displayName.slice(0, 1)
                        )}
                      </span>
                    ))}
                  </span>
                  <span>社区支持 {community.length} 人</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
      {communityOpen ? (
        <CommunitySupportersModal supporters={community} onClose={() => setCommunityOpen(false)} />
      ) : null}
    </div>
  );
}

function CommunitySupportersModal({
  supporters,
  onClose,
}: {
  supporters: AcknowledgementItem[];
  onClose: () => void;
}) {
  const [huangClicks, setHuangClicks] = useState(0);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [bursts, setBursts] = useState<
    Array<{ id: number; x: number; y: number; color: string; drift: number }>
  >([]);
  const burstSequenceRef = useRef(0);
  const burstTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(
    () => () => {
      for (const timer of burstTimersRef.current) {
        window.clearTimeout(timer);
      }
      burstTimersRef.current = [];
    },
    [],
  );

  const handleHuangShenClick = (event: React.MouseEvent<HTMLElement>) => {
    const nextClicks = huangClicks + 1;
    setHuangClicks(nextClicks);

    const rect = event.currentTarget.getBoundingClientRect();
    const color = huangShenPalette[nextClicks % huangShenPalette.length]!;
    const burst = {
      id: ++burstSequenceRef.current,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      color,
      drift: ((burstSequenceRef.current * 37) % 41) - 20,
    };
    setBursts((current) => [...current.slice(-7), burst]);
    const timer = window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== burst.id));
    }, 720);
    burstTimersRef.current.push(timer);

    if (nextClicks >= HUANGSHEN_CLICKS_REQUIRED) {
      setRewardOpen(true);
    }
  };

  const huangColor =
    huangClicks === 0 ? null : huangShenPalette[huangClicks % huangShenPalette.length]!;

  return (
    <div className="palette-overlay" onPointerDown={onClose}>
      <div
        className="palette community-modal"
        role="dialog"
        aria-label="社区支持名单"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <span className="kicker">社区支持 · 感谢有你</span>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <p className="community-modal-thanks">
          感谢以下 {supporters.length} 位社区伙伴对每日节奏杯的支持，正是因为你们，比赛才能一届届办下去。
        </p>
        <div className="community-modal-grid">
          {supporters.map((supporter) => {
            const isHuangShen = supporter.displayName.includes("黄神");

            if (isHuangShen) {
              return (
                <div
                  className="community-modal-item huangshen-item"
                  key={supporter.id}
                  style={
                    huangColor === null
                      ? undefined
                      : ({ "--hs-color": huangColor } as React.CSSProperties)
                  }
                  onClick={handleHuangShenClick}
                >
                  {supporter.imageUrl ? (
                    <ImageWithFallback
                      src={supporter.imageUrl}
                      fallback=""
                      alt={supporter.displayName}
                      loading="lazy"
                    />
                  ) : (
                    <span className="community-modal-fallback">
                      {supporter.displayName.slice(0, 1)}
                    </span>
                  )}
                  <span
                    className={`huangshen-name${huangClicks > 0 ? " hs-animated" : ""}`}
                    key={huangClicks}
                  >
                    {supporter.displayName}
                  </span>
                  {bursts.map((burst) => (
                    <span
                      key={burst.id}
                      className="huangshen-burst"
                      style={
                        {
                          left: burst.x,
                          top: burst.y,
                          color: burst.color,
                          "--hs-drift": `${burst.drift}px`,
                        } as React.CSSProperties
                      }
                      aria-hidden="true"
                    >
                    ✦
                  </span>
                  ))}
                </div>
              );
            }

            return (
              <div className="community-modal-item" key={supporter.id}>
                {supporter.imageUrl ? (
                  <ImageWithFallback
                    src={supporter.imageUrl}
                    fallback=""
                    alt={supporter.displayName}
                    loading="lazy"
                  />
                ) : (
                  <span className="community-modal-fallback">
                    {supporter.displayName.slice(0, 1)}
                  </span>
                )}
                <span>{supporter.displayName}</span>
              </div>
            );
          })}
        </div>
      </div>
      {rewardOpen ? (
        <HuangShenRewardModal
          imageUrl={
            supporters.find((supporter) => supporter.displayName.includes("黄神"))?.imageUrl ??
            null
          }
          onClose={() => setRewardOpen(false)}
        />
      ) : null}
    </div>
  );
}

const HUANGSHEN_CLICKS_REQUIRED = 10;

const huangShenPalette = [
  "#19c8b9",
  "#f8a6b2",
  "#b77dee",
  "#889df0",
  "#f7cd67",
  "#e59266",
  "#8ac68a",
  "#fc736d",
  "#d1da49",
  "#e18c6f",
];

function HuangShenRewardModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="huangshen-reward-overlay"
      onPointerDown={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <clipPath id="animal-modal-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.501,0.005 L0.501,0.005 L0.523,0.005 L0.549,0.006 C0.704,0.01,0.796,0.017,0.825,0.027 L0.827,0.028 C0.872,0.045,0.939,0.044,0.978,0.17 C1,0.254,1,0.365,0.99,0.505 L0.988,0.513 C0.979,0.558,0.971,0.598,0.965,0.633 C0.956,0.689,0.979,0.77,0.964,0.865 C0.953,0.928,0.921,0.966,0.869,0.979 C0.821,0.986,0.773,0.992,0.726,0.995 L0.712,0.996 L0.694,0.997 C0.648,1,0.586,1,0.507,1 L0.501,1 L0.464,1 C0.385,1,0.325,0.998,0.283,0.995 C0.234,0.992,0.184,0.987,0.133,0.979 C0.081,0.966,0.05,0.928,0.039,0.865 C0.023,0.77,0.047,0.689,0.037,0.633 C0.031,0.595,0.023,0.552,0.013,0.505 C-0.006,0.365,-0.002,0.254,0.024,0.17 C0.064,0.045,0.13,0.045,0.174,0.028 L0.175,0.028 C0.204,0.017,0.303,0.009,0.474,0.005 L0.501,0.005" />
          </clipPath>
        </defs>
      </svg>
      <div
        className="huangshen-reward"
        role="dialog"
        aria-label="伟大的黄神彩蛋"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {imageUrl ? (
          <img className="huangshen-reward-avatar" src={imageUrl} alt="伟大的黄神" />
        ) : (
          <span className="huangshen-reward-bag" aria-hidden="true" />
        )}
        <h3 className="huangshen-reward-title">伟大的黄神已现身！</h3>
        <p className="huangshen-reward-text">
          恭喜你，寻找到了伟大的黄神，请立即联系黄神领取他赐予你的奖励
        </p>
        <button className="huangshen-reward-btn" type="button" onClick={onClose}>
          太棒了！
        </button>
      </div>
    </div>
  );
}

function TournamentRow({
  option,
  active,
  records,
  onSelect,
}: {
  option: MobileData["tournamentOptions"][number];
  active: boolean;
  records: MatchRecord[];
  onSelect: (tournamentId: string) => void;
}) {
  const latest = records[0];
  const latestText =
    latest === undefined
      ? "--"
      : `${latest.radiantTeamName} ${
          latest.radiantScore === null || latest.direScore === null
            ? "-"
            : `${latest.radiantScore}:${latest.direScore}`
        } ${latest.direTeamName}`;

  return (
    <button className="dash-list-row" type="button" onClick={() => onSelect(option.id)}>
      <span className="dl-main">{option.name}</span>
      <span className="dl-sub">
        {lifecycleLabel(option.status)} · {option.matchCount} 场
      </span>
      <span className="dl-sub">{latestText}</span>
      {active ? <span className="status-tag green">当前</span> : null}
    </button>
  );
}
