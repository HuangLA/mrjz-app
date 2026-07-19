import { useMemo } from "react";
import type { MobileData } from "../api";
import type {
  AppRoute,
  MatchRecord,
  PlayerProfile,
  PlayerTournamentHistoryEntry,
  ProfileMatchSummary,
  TeamProfile,
} from "../data";
import { MatchRecordCard } from "../components/MatchRecordCard";
import { PlayerTagCloud } from "../components/TagCloud";
import {
  EmptyState,
  ImageWithFallback,
  PlayerTeamBadge,
  SteamAvatar,
  TeamLogoMark,
} from "../components/common";
import { cssVars, formatHeroWinRate, profileMatchToRecord } from "../utils";

type NavigateFn = (route: AppRoute, options?: { profileId?: string }) => void;

export function PlayerProfileContent({
  data,
  profileId,
  profiles,
  profileErrors,
  onOpenMatch,
  onRetry,
}: {
  data: MobileData;
  profileId: string;
  profiles: Record<string, PlayerProfile>;
  profileErrors: Record<string, string>;
  onOpenMatch: (matchId: string) => void;
  onRetry: (type: "player" | "team", id: string) => void;
}) {
  const error = profileErrors[`player:${profileId}`];

  if (error) {
    return (
      <ProfileError
        title="读取失败"
        message={error}
        type="player"
        profileId={profileId}
        onRetry={onRetry}
      />
    );
  }

  const profile = profiles[profileId];

  if (!profile) {
    return <ProfileLoading text="档案读取中" />;
  }

  const team = profile.currentTeam ?? profile.teams[0] ?? null;

  return (
    <>
      <section className="profile-hero" style={cssVars({ "--accent": team?.color ?? "#d4af6e" })}>
        <div className="profile-hero-main">
          <SteamAvatar player={profile} size="large" />
          <div>
            <div className="profile-name-row">
              <h2>{profile.displayName}</h2>
              <PlayerTeamBadge team={team} />
            </div>
            <p>
              {team?.name ?? "暂未归队"} · Account {profile.accountId ?? "-"}
            </p>
          </div>
        </div>
        <div className="profile-winrate">
          <span>本届胜率</span>
          <b>{profile.stats.winRate}</b>
          <small>
            {profile.stats.wins}W / {profile.stats.losses}L
          </small>
        </div>
      </section>

      <PlayerTagCloud tags={profile.tags} />

      <section className="panel">
        <header className="panel-head">
          <div className="panel-title">
            <h2>本届数据</h2>
          </div>
        </header>
        <div className="panel-body">
          <div className="profile-stat-grid">
            {(
              [
                ["场次", String(profile.stats.totalMatches)],
                ["胜率", profile.stats.winRate],
                ["KDA", profile.stats.kda],
                [
                  "场均K/D/A",
                  `${profile.stats.avgKills}/${profile.stats.avgDeaths}/${profile.stats.avgAssists}`,
                ],
                ["GPM", profile.stats.avgGpm],
                ["XPM", profile.stats.avgXpm],
                ["场均经济", profile.stats.avgNetWorth],
                ["场均伤害", profile.stats.avgHeroDamage],
                ["建筑伤害", profile.stats.avgTowerDamage],
                ["场均承伤", profile.stats.avgDamageTaken],
              ] as Array<[string, string]>
            ).map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SignatureHeroes heroes={profile.stats.topHeroes} />
      <PlayerTournamentHistory
        profile={profile}
        records={data.matchRecords}
        onOpenMatch={onOpenMatch}
      />
    </>
  );
}

export function TeamProfileContent({
  data,
  profileId,
  profiles,
  profileErrors,
  onNavigate,
  onOpenMatch,
  onRetry,
}: {
  data: MobileData;
  profileId: string;
  profiles: Record<string, TeamProfile>;
  profileErrors: Record<string, string>;
  onNavigate: NavigateFn;
  onOpenMatch: (matchId: string) => void;
  onRetry: (type: "player" | "team", id: string) => void;
}) {
  const error = profileErrors[`team:${profileId}`];

  if (error) {
    return (
      <ProfileError
        title="读取失败"
        message={error}
        type="team"
        profileId={profileId}
        onRetry={onRetry}
      />
    );
  }

  const profile = profiles[profileId];

  if (!profile) {
    return <ProfileLoading text="档案读取中" />;
  }

  return (
    <>
      <section className="profile-hero" style={cssVars({ "--accent": profile.color })}>
        <div className="profile-hero-main">
          <TeamLogoMark team={profile} size="large" />
          <div>
            <h2>{profile.name}</h2>
            <p>
              {profile.memberCount} 名成员 · {profile.status} · {profile.stats.linkedMatches} 场
            </p>
          </div>
        </div>
        <div className="profile-winrate">
          <span>本届胜率</span>
          <b>{profile.stats.winRate}</b>
          <small>
            {profile.stats.gameWins}W / {profile.stats.gameLosses}L
          </small>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div className="panel-title">
            <h2>本届数据</h2>
          </div>
        </header>
        <div className="panel-body">
          <div className="profile-stat-grid">
            {(
              [
                ["比赛", String(profile.stats.seriesPlayed)],
                ["胜场", String(profile.stats.seriesWins)],
                ["负场", String(profile.stats.seriesLosses)],
                ["成员", String(profile.memberCount)],
                ["入库比赛", String(profile.stats.linkedMatches)],
                ["状态", profile.status],
              ] as Array<[string, string]>
            ).map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div className="panel-title">
            <h2>成员名单</h2>
          </div>
          <span className="pill">{profile.members.length} 人</span>
        </header>
        <div className="panel-body">
          <div className="roster-grid">
            {profile.members.length > 0 ? (
              profile.members.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onNavigate("player", { profileId: player.id })}
                >
                  <SteamAvatar player={player} size="small" />
                  <b>{player.displayName}</b>
                  <span>ID {player.accountId ?? player.id}</span>
                </button>
              ))
            ) : (
              <EmptyState text="暂无" />
            )}
          </div>
        </div>
      </section>

      <SignatureHeroes heroes={profile.stats.topHeroes} />
      <ProfileMatches
        matches={profile.matches}
        title="队伍比赛"
        records={data.matchRecords}
        onOpenMatch={onOpenMatch}
      />
    </>
  );
}

function ProfileLoading({ text }: { text: string }) {
  return (
    <section className="panel profile-loading">
      <span className="data-notice-pulse" aria-hidden="true" />
      <h2>{text}</h2>
    </section>
  );
}

function ProfileError({
  title,
  message,
  type,
  profileId,
  onRetry,
}: {
  title: string;
  message: string;
  type: "player" | "team";
  profileId: string;
  onRetry: (type: "player" | "team", id: string) => void;
}) {
  return (
    <section className="panel profile-loading profile-error">
      <h2>{title}</h2>
      <small>{message}</small>
      <button type="button" className="ghost-button" onClick={() => onRetry(type, profileId)}>
        再试一次
      </button>
    </section>
  );
}

function SignatureHeroes({
  heroes,
}: {
  heroes: Array<{ hero: string; portrait: string; picks: number; wins: number }>;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title">
          <h2>常用英雄</h2>
        </div>
      </header>
      <div className="panel-body">
        <div className="signature-heroes">
          {heroes.length > 0 ? (
            heroes.map((hero) => (
              <article key={hero.hero}>
                <ImageWithFallback
                  src={hero.portrait}
                  fallback="/static/dota/heroes/unknown.svg"
                  alt={hero.hero}
                  loading="lazy"
                />
                <div>
                  <b>{hero.hero}</b>
                  <span>
                    {hero.picks} 场 · {hero.wins} 胜 · {formatHeroWinRate(hero.wins, hero.picks)}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <EmptyState text="暂无" />
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileMatches({
  matches,
  title,
  records,
  onOpenMatch,
}: {
  matches: ProfileMatchSummary[];
  title: string;
  records: MatchRecord[];
  onOpenMatch: (matchId: string) => void;
}) {
  const recordsByMatchId = useMemo(
    () => new Map(records.map((record) => [record.matchId, record])),
    [records],
  );

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title">
          <h2>{title}</h2>
        </div>
        <span className="pill">{matches.length} 场</span>
      </header>
      <div className="panel-body">
        <div className="records-grid">
          {matches.length > 0 ? (
            matches.map((match, index) => (
              <MatchRecordCard
                key={match.matchId}
                record={recordsByMatchId.get(match.matchId) ?? profileMatchToRecord(match)}
                index={index}
                onOpenMatch={onOpenMatch}
              />
            ))
          ) : (
            <EmptyState text="暂无" />
          )}
        </div>
      </div>
    </section>
  );
}

function PlayerTournamentHistory({
  profile,
  records,
  onOpenMatch,
}: {
  profile: PlayerProfile;
  records: MatchRecord[];
  onOpenMatch: (matchId: string) => void;
}) {
  const recordsByMatchId = useMemo(
    () => new Map(records.map((record) => [record.matchId, record])),
    [records],
  );
  const currentEntry =
    profile.tournamentHistory.find((entry) => entry.isCurrent) ??
    ({
      tournamentId: profile.tournamentId,
      tournamentName: "本届赛事",
      startsAt: "时间待定",
      status: "",
      isCurrent: true,
      stats: profile.stats,
      matches: profile.matches,
    } satisfies PlayerTournamentHistoryEntry);
  const previousEntries = profile.tournamentHistory.filter((entry) => !entry.isCurrent);
  const totalMatches =
    profile.tournamentHistory.reduce((sum, entry) => sum + entry.matches.length, 0) ||
    profile.matches.length;

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title">
          <h2>参赛记录</h2>
        </div>
        <span className="pill">{totalMatches} 场</span>
      </header>
      <div className="panel-body">
        <div className="player-season-current">
          <SeasonRecordHeader entry={currentEntry} label="本届" />
          <ProfileMatchCards
            matches={currentEntry.matches}
            recordsByMatchId={recordsByMatchId}
            tournamentName={currentEntry.tournamentName}
            onOpenMatch={onOpenMatch}
          />
        </div>

        {previousEntries.length > 0 ? (
          <div className="player-season-archive">
            <div className="season-archive-title">
              <span>往届参赛</span>
              <small>{previousEntries.length} 届</small>
            </div>
            {previousEntries.map((entry) => (
              <details className="season-details" key={entry.tournamentId}>
                <summary>
                  <SeasonRecordHeader entry={entry} />
                </summary>
                <ProfileMatchCards
                  matches={entry.matches}
                  recordsByMatchId={recordsByMatchId}
                  tournamentName={entry.tournamentName}
                  onOpenMatch={onOpenMatch}
                />
              </details>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SeasonRecordHeader({
  entry,
  label,
}: {
  entry: PlayerTournamentHistoryEntry;
  label?: string;
}) {
  return (
    <div className="season-record-header">
      <div>
        <h3>{entry.tournamentName}</h3>
        <span>{label ?? entry.startsAt}</span>
      </div>
      <div className="season-record-metrics">
        <b>{entry.matches.length} 场</b>
        <small>{entry.stats.winRate}</small>
      </div>
    </div>
  );
}

function ProfileMatchCards({
  matches,
  recordsByMatchId,
  tournamentName,
  onOpenMatch,
}: {
  matches: ProfileMatchSummary[];
  recordsByMatchId: Map<string, MatchRecord>;
  tournamentName: string;
  onOpenMatch: (matchId: string) => void;
}) {
  return (
    <div className="records-grid">
      {matches.length > 0 ? (
        matches.map((match, index) => (
          <MatchRecordCard
            key={match.matchId}
            record={
              recordsByMatchId.get(match.matchId) ?? profileMatchToRecord(match, tournamentName)
            }
            index={index}
            onOpenMatch={onOpenMatch}
          />
        ))
      ) : (
        <EmptyState text="暂无" />
      )}
    </div>
  );
}
