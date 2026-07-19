import { useMemo } from "react";
import type { MobileData } from "../api";
import type { AppRoute, MatchRecord } from "../data";
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
                    {record.radiantTeamName} vs {record.direTeamName}
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
                <span className="dash-sponsor" key={sponsor.id}>
                  {sponsor.imageUrl !== null ? (
                    <img src={sponsor.imageUrl} alt={sponsor.displayName} loading="lazy" />
                  ) : null}
                  <span>{sponsor.displayName}</span>
                </span>
              ))}
              {community.length > 0 ? (
                <span className="dash-sponsor">
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
                </span>
              ) : null}
            </div>
          </section>
        ) : null}
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
