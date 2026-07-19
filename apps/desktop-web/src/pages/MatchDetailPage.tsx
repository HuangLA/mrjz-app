import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { MobileData } from "../api";
import type {
  AghanimState,
  DraftStep,
  IconRef,
  MatchAward,
  MatchData,
  PlayerStats,
  TeamSide,
} from "../data";
import { AbilityFallbackGlyph, TalentTreeLegend } from "../components/TalentTree";
import { TrendSection } from "../components/TrendCharts";
import { WardTimeline } from "../components/WardMap";
import { DataNotice, EmptyState, ImageWithFallback, SectionPanel } from "../components/common";
import { clampNumber, cssVars, emptyIcon, getTeam, kdaRatio } from "../utils";

type MatchAwardPopover = { key: string; award: MatchAward; left: number; top: number };

const awardPopoverWidth = 220;
const awardPopoverEstimatedHeight = 72;
const awardPopoverMargin = 12;

function getAwardPopoverPosition(rect: DOMRect): { left: number; top: number } {
  const maxLeft = Math.max(
    awardPopoverMargin,
    window.innerWidth - awardPopoverWidth - awardPopoverMargin,
  );
  const left = clampNumber(
    rect.left + rect.width / 2 - awardPopoverWidth / 2,
    awardPopoverMargin,
    maxLeft,
  );
  const belowTop = rect.bottom + 8;
  const top =
    belowTop + awardPopoverEstimatedHeight > window.innerHeight - awardPopoverMargin
      ? Math.max(awardPopoverMargin, rect.top - awardPopoverEstimatedHeight - 8)
      : belowTop;

  return { left, top };
}

export function MatchDetailPage({
  data,
  loading,
  match,
  expandedPlayers,
  wardScrubberSeconds,
  onPlayerToggle,
  onWardSecondChange,
  embedded = false,
}: {
  data: MobileData;
  loading: boolean;
  match: MatchData;
  expandedPlayers: Set<string>;
  wardScrubberSeconds: Record<string, number>;
  onPlayerToggle: (playerId: string) => void;
  onWardSecondChange: (matchId: string, seconds: number) => void;
  embedded?: boolean;
}) {
  const mvp = match.players.find((player) => player.id === match.mvpPlayerId);
  const radiantPlayers = match.players.filter((player) => player.side === "radiant");
  const direPlayers = match.players.filter((player) => player.side === "dire");
  const [awardPopover, setAwardPopover] = useState<MatchAwardPopover | null>(null);

  const closeAwardPopover = useCallback(() => setAwardPopover(null), []);
  const openAwardPopover = useCallback((award: MatchAward, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const { left, top } = getAwardPopoverPosition(rect);

    setAwardPopover({
      key: `${award.code}:${award.playerId}`,
      award,
      left,
      top,
    });
  }, []);
  const togglePlayerWithPopoverClose = useCallback(
    (playerId: string) => {
      closeAwardPopover();
      onPlayerToggle(playerId);
    },
    [closeAwardPopover, onPlayerToggle],
  );

  useEffect(() => {
    closeAwardPopover();
  }, [closeAwardPopover, match.id]);

  useEffect(() => {
    if (!awardPopover) {
      return undefined;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAwardPopover();
      }
    };

    document.addEventListener("pointerdown", closeAwardPopover);
    window.addEventListener("scroll", closeAwardPopover, true);
    window.addEventListener("resize", closeAwardPopover);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeAwardPopover);
      window.removeEventListener("scroll", closeAwardPopover, true);
      window.removeEventListener("resize", closeAwardPopover);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [awardPopover, closeAwardPopover]);

  const content = (
    <>
      {loading ? <DataNotice loading={loading} /> : null}
      {data.notice ? <div className="data-notice is-warning">{data.notice}</div> : null}
      <MatchSummary match={match} />
      {mvp ? <MvpCard player={mvp} match={match} /> : null}
      <MatchQuickStats match={match} />

      <SectionPanel title="双方数据" hint="点击选手行展开进阶数据与加点序列">
        <div className="team-panel-grid">
          <TeamPanel
            side="radiant"
            players={radiantPlayers}
            match={match}
            expandedPlayers={expandedPlayers}
            activeAwardKey={awardPopover?.key ?? null}
            onAwardOpen={openAwardPopover}
            onPlayerToggle={togglePlayerWithPopoverClose}
          />
          <TeamPanel
            side="dire"
            players={direPlayers}
            match={match}
            expandedPlayers={expandedPlayers}
            activeAwardKey={awardPopover?.key ?? null}
            onAwardOpen={openAwardPopover}
            onPlayerToggle={togglePlayerWithPopoverClose}
          />
        </div>
      </SectionPanel>

      {match.draft.length > 0 ? (
        <SectionPanel title="Ban / Pick 顺序" hint={`${match.draft.length} 手`}>
          <DraftTimeline draft={match.draft} />
        </SectionPanel>
      ) : null}

      <SectionPanel
        title="视野地图"
        aside={<span className="pill">{match.wardTimeline.length} 条</span>}
      >
        {match.wardTimeline.length > 0 ? (
          <WardTimeline
            match={match}
            selectedSecond={wardScrubberSeconds[match.id] ?? 0}
            onChange={(seconds) => onWardSecondChange(match.id, seconds)}
          />
        ) : (
          <EmptyState text="暂无" />
        )}
      </SectionPanel>

      <SectionPanel
        title="战况趋势"
        aside={
          <span className={`status-tag ${match.trends.hasTrends ? "green" : ""}`}>
            {match.trends.hasTrends ? "曲线" : "暂无"}
          </span>
        }
      >
        <TrendSection match={match} />
      </SectionPanel>

      <SectionPanel title="聊天记录" className="chat-section">
        <div className="chat-list">
          {match.chat.length > 0 ? (
            match.chat.map((line, index) => (
              <ChatLineView key={`${line.time}:${line.player}:${index}`} line={line} />
            ))
          ) : (
            <EmptyState text="暂无" />
          )}
        </div>
      </SectionPanel>
      <MatchAwardFloatingPopover popover={awardPopover} />
    </>
  );

  if (embedded) {
    return content;
  }

  return <div className="page-stack match-page">{content}</div>;
}

function MatchSummary({ match }: { match: MatchData }) {
  const winner = match.winner === "radiant" ? match.radiant : match.dire;

  return (
    <section className="match-summary reveal">
      <div className="summary-meta">
        <span>比赛编号 {match.id}</span>
        <span>{match.endedAt}</span>
      </div>
      <p className="victory-label">{winner.name} 胜利</p>
      <div className="scoreboard">
        <div className={`team-side radiant ${match.winner === "radiant" ? "is-winner" : ""}`}>
          <span>{match.radiant.seed}</span>
          <b>{match.radiant.name}</b>
          <small>天辉</small>
        </div>
        <div className="score-core">
          <p>{match.league}</p>
          <strong>
            {match.radiantScore}
            <i>:</i>
            {match.direScore}
          </strong>
          <span>
            {match.duration} · {match.mode}
          </span>
        </div>
        <div className={`team-side dire ${match.winner === "dire" ? "is-winner" : ""}`}>
          <span>{match.dire.seed}</span>
          <b>{match.dire.name}</b>
          <small>夜魇</small>
        </div>
      </div>
    </section>
  );
}

function MatchQuickStats({ match }: { match: MatchData }) {
  const radiantKills = match.players
    .filter((player) => player.side === "radiant")
    .reduce((sum, player) => sum + player.kills, 0);
  const direKills = match.players
    .filter((player) => player.side === "dire")
    .reduce((sum, player) => sum + player.kills, 0);

  return (
    <section className="match-ribbon reveal">
      <span className="match-ribbon-stat duration">
        <b>{match.duration}</b>时长
      </span>
      <span className="match-ribbon-stat kill-score">
        <small>击杀</small>
        <b>
          <i className="radiant-score">{radiantKills}</i>
          <em>:</em>
          <i className="dire-score">{direKills}</i>
        </b>
      </span>
      <span className="match-ribbon-stat">
        <small>模式</small>
        <b>{match.mode}</b>
      </span>
      <span className="match-ribbon-stat">
        <small>解析</small>
        <b>{match.parseStatus}</b>
      </span>
    </section>
  );
}

function MvpCard({ player, match }: { player: PlayerStats; match: MatchData }) {
  const team = getTeam(match, player.side);

  return (
    <section className={`mvp-card reveal ${player.side}`}>
      <div className="mvp-copy">
        <p className="eyebrow">MVP</p>
        <h2>{player.name}</h2>
        <p>
          {player.hero} · {team.name}
        </p>
        <div className="mvp-stats">
          <span>
            <b>
              {player.kills}/{player.deaths}/{player.assists}
            </b>
            KDA
          </span>
          <span>
            <b>{player.participation}</b>参战
          </span>
          <span>
            <b>{player.damageShare}</b>伤害
          </span>
        </div>
        <div className="tag-strip">
          {player.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="mvp-visual">
        <ImageWithFallback
          className="mvp-portrait"
          src={player.portrait}
          fallback="/static/dota/heroes/unknown.svg"
          alt={player.hero}
        />
        <span>MVP</span>
      </div>
    </section>
  );
}

function TeamPanel({
  side,
  players,
  match,
  expandedPlayers,
  activeAwardKey,
  onAwardOpen,
  onPlayerToggle,
}: {
  side: TeamSide;
  players: PlayerStats[];
  match: MatchData;
  expandedPlayers: Set<string>;
  activeAwardKey: string | null;
  onAwardOpen: (award: MatchAward, target: HTMLElement) => void;
  onPlayerToggle: (playerId: string) => void;
}) {
  const team = getTeam(match, side);
  const kills = players.reduce((sum, player) => sum + player.kills, 0);
  const isWinner = match.winner === side;

  return (
    <div className={`team-panel ${side} ${isWinner ? "is-winner" : ""}`}>
      <div className="team-panel-head">
        <div>
          <span>
            {side === "radiant" ? "天辉" : "夜魇"} {isWinner ? "胜利" : "失败"}
          </span>
          <b>{team.name}</b>
        </div>
        <small>杀敌 {kills}</small>
      </div>
      <div className="player-list">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            expanded={expandedPlayers.has(player.id)}
            isMvp={player.id === match.mvpPlayerId}
            awards={match.awards.filter((award) => award.playerId === player.id)}
            activeAwardKey={activeAwardKey}
            onAwardOpen={onAwardOpen}
            onToggle={onPlayerToggle}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  expanded,
  isMvp,
  awards,
  activeAwardKey,
  onAwardOpen,
  onToggle,
}: {
  player: PlayerStats;
  expanded: boolean;
  isMvp: boolean;
  awards: MatchAward[];
  activeAwardKey: string | null;
  onAwardOpen: (award: MatchAward, target: HTMLElement) => void;
  onToggle: (playerId: string) => void;
}) {
  const abilitySteps = player.abilityOrder.filter((ability) => ability.kind === "ability");

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(player.id);
    }
  };

  return (
    <article
      className={`player-row ${player.side} ${expanded ? "expanded" : ""} ${isMvp ? "mvp-player" : ""}`}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onClick={() => onToggle(player.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="player-main">
        {isMvp ? <span className="player-mvp-badge">MVP</span> : null}
        <span className="hero-avatar-shell">
          <ImageWithFallback
            className="hero-avatar"
            src={player.portrait}
            fallback="/static/dota/heroes/unknown.svg"
            alt={player.hero}
          />
          <i>{player.level}</i>
        </span>
        <div className="player-id">
          <b>{player.name}</b>
          <span>{player.hero}</span>
          <div className="player-chips">
            <em>{player.lane}</em>
            <span className="player-mini-metrics">
              <small>参战 {player.participation}</small>
              <small>伤害 {player.damageShare}</small>
            </span>
          </div>
          {awards.length > 0 ? (
            <PlayerAwardBadges
              awards={awards}
              activeAwardKey={activeAwardKey}
              onAwardOpen={onAwardOpen}
            />
          ) : null}
        </div>
        <div className="player-kda">
          <b>
            {player.kills}/{player.deaths}/{player.assists}
          </b>
          <span>KDA {kdaRatio(player)}</span>
        </div>
        <PlayerLoadout player={player} />
      </div>
      {expanded ? (
        <div className="player-expanded">
          <div className="advanced-grid">
            <AdvancedMetric label="GPM" value={String(player.gpm)} />
            <AdvancedMetric label="XPM" value={String(player.xpm)} />
            <AdvancedMetric label="净值" value={player.netWorth} />
            <AdvancedMetric label="正反补" value={`${player.lastHits}/${player.denies}`} />
            <AdvancedMetric label="英雄伤害" value={player.heroDamage} />
            <AdvancedMetric label="建筑" value={player.towerDamage} />
            <AdvancedMetric label="治疗" value={player.healing} />
            <AdvancedMetric label="承伤" value={player.damageTaken} />
          </div>
          <div className="ability-order">
            {abilitySteps.length > 0 ? (
              abilitySteps.map((ability, index) => (
                <AbilityStep
                  key={`${ability.key ?? ability.label}:${index}`}
                  ability={ability}
                  index={index}
                />
              ))
            ) : (
              <EmptyState text="暂无普通技能加点" />
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PlayerAwardBadges({
  awards,
  activeAwardKey,
  onAwardOpen,
}: {
  awards: MatchAward[];
  activeAwardKey: string | null;
  onAwardOpen: (award: MatchAward, target: HTMLElement) => void;
}) {
  return (
    <div
      className="player-awards"
      aria-label="本场称号"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {awards.map((award) => {
        const awardKey = `${award.code}:${award.playerId}`;
        const description = award.description.trim() || "暂无称号说明";
        const isActive = activeAwardKey === awardKey;

        const open = (target: HTMLElement) => onAwardOpen(award, target);

        return (
          <span
            aria-label={`${award.title}：${description}`}
            className={`player-award-title award-${award.code} ${isActive ? "active" : ""}`}
            key={awardKey}
            role="button"
            tabIndex={0}
            aria-expanded={isActive}
            onFocus={(event) => open(event.currentTarget)}
            onMouseEnter={(event) => open(event.currentTarget)}
            onClick={(event) => {
              event.stopPropagation();
              open(event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                open(event.currentTarget);
              }
            }}
          >
            {award.title}
          </span>
        );
      })}
    </div>
  );
}

function MatchAwardFloatingPopover({ popover }: { popover: MatchAwardPopover | null }) {
  if (!popover || typeof document === "undefined") {
    return null;
  }

  const description = popover.award.description.trim() || "暂无称号说明";

  return createPortal(
    <div
      className="player-award-tooltip"
      role="tooltip"
      style={cssVars({
        "--award-popover-left": `${popover.left}px`,
        "--award-popover-top": `${popover.top}px`,
      })}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <b>{popover.award.title}</b>
      <small>{description}</small>
    </div>,
    document.body,
  );
}

function PlayerLoadout({ player }: { player: PlayerStats }) {
  const itemSlots = Array.from({ length: 6 }, (_, index) => player.items[index] ?? emptyIcon);
  const backpackSlots = Array.from(
    { length: 3 },
    (_, index) => player.backpackItems[index] ?? emptyIcon,
  );

  return (
    <div className="player-loadout">
      <div className="inventory-stack">
        <div className="inventory-grid" aria-label="六格物品栏">
          {itemSlots.map((item, index) => (
            <ItemSlot key={index} item={item} slot={index + 1} />
          ))}
        </div>
        <div className="backpack-grid" aria-label="背包物品栏">
          {backpackSlots.map((item, index) => (
            <ItemSlot key={index} item={item} slot="backpack" />
          ))}
        </div>
      </div>
      <ItemSlot item={player.neutralItem} slot="neutral" />
      <div className="agha-status-row">
        <AghanimIcon label="神杖" state={player.scepter} />
        <AghanimIcon label="魔精" state={player.shard} />
      </div>
      <TalentTreeLegend player={player} />
    </div>
  );
}

function AbilityStep({ ability, index }: { ability: IconRef; index: number }) {
  const level = ability.level ?? index + 1;
  const kind = ability.kind ?? "ability";
  const hasImage = Boolean(ability.imageUrl);

  return (
    <span
      className={`ability-step ${kind} ${hasImage ? "" : "fallback"}`}
      title={`${level}. ${ability.label}`}
    >
      {hasImage ? (
        <img
          src={ability.imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add("fallback");
          }}
        />
      ) : (
        <AbilityFallbackGlyph kind={kind} />
      )}
      <b>{level}</b>
    </span>
  );
}

function ItemSlot({ item, slot }: { item: IconRef; slot: number | "neutral" | "backpack" }) {
  const empty = item.label === "-" || item.label === "空";

  return (
    <span
      className={`item-slot ${slot === "neutral" ? "neutral" : ""} ${slot === "backpack" ? "backpack" : ""} ${empty ? "empty" : ""}`}
      title={item.label}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add("empty");
          }}
        />
      ) : null}
    </span>
  );
}

function AdvancedMetric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function AghanimIcon({ label, state }: { label: string; state: AghanimState }) {
  const title = state === "owned" ? "已拥有" : state === "queued" ? "待购买" : "未购买";
  const type = label.includes("晶") || label.includes("精") ? "shard" : "scepter";
  const filename = `${type}${state === "owned" ? "On" : "Off"}.svg`;

  return (
    <img
      className={`agha-icon ${type} ${state}`}
      src={`/static/svg/${filename}`}
      alt={label}
      title={`${label} ${title}`}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

function DraftTimeline({ draft }: { draft: DraftStep[] }) {
  if (draft.length === 0) {
    return <EmptyState text="暂无" />;
  }

  return (
    <div className="draft-timeline">
      {draft
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => (
          <DraftStepCard key={`${step.order}:${step.hero}:${step.type}`} step={step} />
        ))}
    </div>
  );
}

function DraftStepCard({ step }: { step: DraftStep }) {
  const actionText = step.type === "Ban" ? "禁用" : "选择";
  const portrait = step.portrait ?? "/static/dota/heroes/unknown.svg";

  return (
    <div className={`draft-step ${step.side} ${step.type.toLowerCase()}`}>
      <span className="draft-order">{step.order}</span>
      <article className="draft-card">
        <ImageWithFallback
          className="draft-hero"
          src={portrait}
          fallback="/static/dota/heroes/unknown.svg"
          alt={step.hero}
          loading="lazy"
        />
        <div className="draft-copy">
          <div>
            <b>{step.hero}</b>
            <span>{step.actor}</span>
          </div>
          <em>{actionText}</em>
        </div>
      </article>
    </div>
  );
}

function ChatLineView({
  line,
}: {
  line: {
    time: string;
    side: TeamSide;
    player: string;
    hero: string;
    text: string;
  };
}) {
  return (
    <div className={`chat-line ${line.side}`}>
      <span>{line.time}</span>
      <b>{line.player}</b>
      <small>{line.hero}</small>
      <p>{line.text}</p>
    </div>
  );
}
