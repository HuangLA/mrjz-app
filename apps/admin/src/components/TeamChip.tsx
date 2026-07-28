import { apiBaseUrl, type PlayerBrief, type TeamBrief } from "../api";

export function resolveAdminAssetUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || imageUrl.trim().length === 0) return null;
  const trimmed = imageUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${apiBaseUrl.replace(/\/api\/?$/i, "")}${trimmed}`;
  return trimmed;
}

export function TeamChip({ team, size = "normal", onRemove, onClick, active, badge }: {
  team: TeamBrief;
  size?: "small" | "normal";
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  badge?: React.ReactNode;
}) {
  const logoUrl = resolveAdminAssetUrl(team.logoUrl ?? null);
  const inner = (
    <>
      {logoUrl
        ? <img className="team-chip-logo" src={logoUrl} alt="" />
        : <i className="team-chip-dot" style={{ background: team.color }} />}
      <span className="team-chip-name">{team.name}</span>
      {badge}
      {onRemove ? <b className="team-chip-remove" onClick={(event) => { event.stopPropagation(); onRemove(); }}>×</b> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`team-chip team-chip-${size} is-clickable${active ? " is-active" : ""}`} onClick={onClick} title={team.name}>
        {inner}
      </button>
    );
  }

  return <span className={`team-chip team-chip-${size}${active ? " is-active" : ""}`} title={team.name}>{inner}</span>;
}

export function TeamIdentity({ team, size = "normal" }: { team: TeamBrief; size?: "normal" | "large" }) {
  const logoUrl = resolveAdminAssetUrl(team.logoUrl ?? null);

  return (
    <div className={`team-identity team-identity-${size}`}>
      {logoUrl ? <img src={logoUrl} alt="" /> : <div className="team-avatar" style={{ background: team.color }}>{team.name.slice(0, 1)}</div>}
      <div><strong>{team.name}</strong><small>{team.shortName}</small></div>
    </div>
  );
}

export function PlayerAvatar({ player }: { player: PlayerBrief }) {
  return player.avatarUrl
    ? <img className="player-avatar" src={player.avatarUrl} alt="" />
    : <div className="player-avatar is-fallback">{player.displayName.slice(0, 1)}</div>;
}

export function orderTeamsByIds<T extends TeamBrief>(teams: T[], ids: string[]): T[] {
  const map = new Map(teams.map((team) => [team.id, team]));
  return ids.flatMap((id) => {
    const team = map.get(id);
    return team ? [team] : [];
  });
}

export function matchesTeamQuery(team: TeamBrief, query: string): boolean {
  return `${team.name} ${team.shortName}`.toLowerCase().includes(query);
}
