import { useEffect, useState, type ReactNode } from "react";
import type { MobileData } from "../api";
import type { EntityTeamInfo, PlayerDirectoryItem, TeamDirectoryItem } from "../data";
import { cssVars, type StandingTeamMember, standingMemberDisplayId } from "../utils";

export function ImageWithFallback({
  src,
  fallback,
  alt,
  className,
  loading,
}: {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <img
      className={className}
      src={currentSrc}
      alt={alt}
      loading={loading}
      onError={() => {
        if (currentSrc !== fallback) {
          setCurrentSrc(fallback);
        }
      }}
    />
  );
}

export function EmptyState({ text = "暂无" }: { text?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-glyph" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export function DataNotice({ loading }: { loading: boolean }) {
  return loading ? (
    <div className="data-notice" role="status">
      <span className="data-notice-pulse" aria-hidden="true" />
      读取中
    </div>
  ) : null;
}

export function SectionPanel({
  title,
  hint,
  aside,
  className = "",
  children,
}: {
  title?: string;
  hint?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel reveal ${className}`.trim()}>
      {title ? (
        <header className="panel-head">
          <div className="panel-title">
            <h2>{title}</h2>
            {hint ? <p>{hint}</p> : null}
          </div>
          {aside ? <div className="panel-aside">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function TournamentScope({ data, onSwitch }: { data: MobileData; onSwitch: () => void }) {
  const meta = data.selectedTournamentMeta;

  return (
    <div className="tournament-scope">
      <span className="tournament-scope-kicker">当前赛事</span>
      <b>{data.selectedTournamentName}</b>
      <span className="tournament-scope-meta">
        League {meta.leagueId} · {meta.statusText}
      </span>
      <button className="ghost-button" type="button" onClick={onSwitch}>
        切换
      </button>
    </div>
  );
}

export function FilterRow<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  counts?: Map<T, number>;
}) {
  return (
    <div className="filter-row" role="toolbar">
      {options.map((label) => (
        <button
          aria-pressed={label === value}
          className={`filter-chip ${label === value ? "active" : ""}`}
          key={label}
          type="button"
          onClick={() => onChange(label)}
        >
          <span>{label}</span>
          {counts?.has(label) ? <small>{counts.get(label)}</small> : null}
        </button>
      ))}
    </div>
  );
}

export function SteamAvatar({
  player,
  size = "normal",
}: {
  player: Pick<PlayerDirectoryItem, "displayName" | "avatarUrl">;
  size?: "normal" | "large" | "small";
}) {
  const [failed, setFailed] = useState(false);
  const initial = player.displayName.slice(0, 1).toUpperCase();

  useEffect(() => {
    setFailed(false);
  }, [player.avatarUrl]);

  if (!player.avatarUrl || failed) {
    return (
      <span className={`avatar-fallback is-${size}`} aria-hidden="true">
        {initial}
      </span>
    );
  }

  return (
    <span className={`avatar-shell is-${size}`}>
      <img
        src={player.avatarUrl}
        alt={player.displayName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function StandingMemberAvatar({ member }: { member: StandingTeamMember }) {
  const [failed, setFailed] = useState(false);
  const initial = standingMemberDisplayId(member).slice(0, 1).toUpperCase() || "选";

  useEffect(() => {
    setFailed(false);
  }, [member.avatarUrl]);

  if (!member.avatarUrl || failed) {
    return (
      <span className="avatar-fallback is-small" aria-hidden="true">
        {initial}
      </span>
    );
  }

  return (
    <span className="avatar-shell is-small">
      <img src={member.avatarUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

export function PlayerAvatar({
  player,
}: {
  player: Pick<PlayerDirectoryItem, "displayName" | "avatarUrl">;
}) {
  return player.avatarUrl ? (
    <span className="avatar-shell is-small">
      <img src={player.avatarUrl} alt="" loading="lazy" />
    </span>
  ) : (
    <span className="avatar-fallback is-small">{player.displayName.slice(0, 1) || "选"}</span>
  );
}

export function TeamLogoMark({
  team,
  size = "normal",
}: {
  team: Pick<TeamDirectoryItem, "name" | "shortName" | "logoUrl">;
  size?: "normal" | "large" | "small";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [team.logoUrl]);

  if (!team.logoUrl || failed) {
    return (
      <span className={`team-logo-fallback is-${size}`} aria-hidden="true">
        {team.shortName.slice(0, 2).toUpperCase() || team.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <span className={`team-logo-shell is-${size}`}>
      <img src={team.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

export function PlayerTeamBadge({ team }: { team: EntityTeamInfo | null }) {
  if (team === null) {
    return <span className="team-mark empty">暂未归队</span>;
  }

  return (
    <span
      className="team-mark"
      style={cssVars({ "--team": team.color })}
      title={`所属战队：${team.name}`}
    >
      {team.name}
    </span>
  );
}

export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) {
      setDisplay(0);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{display}</>;
}
