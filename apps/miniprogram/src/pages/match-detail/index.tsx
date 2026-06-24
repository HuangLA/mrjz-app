import { ScrollView, Slider, Text, View } from "@tarojs/components";
import { formatDotaGameMode } from "@mrjz/shared/dota-game-mode";
import { useDidShow, useRouter } from "@tarojs/taro";
import { useState } from "react";
import { loadMatch } from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { aghanimIcon, dotaAssetUrl } from "../../dota";
import { PageShell, SectionTitle } from "../../components";
import { SmartImage as Image } from "../../SmartImage";
import type { ChatLine, DraftStep, IconRef, MatchAward, MatchDetail, MatchDetailPlayer, TalentTreeNode, TeamSide, WardEvent } from "../../types";
import { formatDateTime, formatInteger } from "../../utils";

export default function MatchDetailPage() {
  const router = useRouter();
  const matchId = String(router.params.matchId ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(() => new Set());
  const [wardSecond, setWardSecond] = useState(0);

  useDidShow(() => {
    void refresh();
  });

  async function refresh() {
    if (!matchId) {
      setError("缺少 match_id");
      setLoading(false);
      return;
    }

    const cacheKey = pageCacheKey("match-detail", matchId);
    const cached = readPageCache<MatchDetail>(cacheKey);

    if (cached) {
      setDetail(cached);
      setExpandedPlayers(defaultExpandedPlayers(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const nextDetail = await loadMatch(matchId);
      setDetail(nextDetail);
      setExpandedPlayers(defaultExpandedPlayers(nextDetail));
      writePageCache(cacheKey, nextDetail);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "比赛详情读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleExpandedPlayer(playerKey: string) {
    setExpandedPlayers((current) => {
      const next = new Set(current);

      if (next.has(playerKey)) {
        next.delete(playerKey);
      } else {
        next.add(playerKey);
      }

      return next;
    });
  }

  return (
    <PageShell loading={loading} error={error} routeKey="records">
      {detail ? (
        <View className="match-detail-page">
          <MatchSummary detail={detail} />
          <MvpCard detail={detail} />
          <MatchQuickStats detail={detail} />

          <View className="section-panel player-section">
            <View className="section-title compact">
              <View>
                <Text className="section-heading">双方数据</Text>
              </View>
            </View>
            <TeamPanel
              expandedPlayers={expandedPlayers}
              isWinner={detail.match.winnerName === detail.score.radiantTeamName}
              mvpPlayerName={detail.mvp?.playerName ?? null}
              awards={detail.awards}
              players={detail.players.radiant}
              side="radiant"
              teamName={detail.score.radiantTeamName}
              onPlayerToggle={toggleExpandedPlayer}
            />
            <TeamPanel
              expandedPlayers={expandedPlayers}
              isWinner={detail.match.winnerName === detail.score.direTeamName}
              mvpPlayerName={detail.mvp?.playerName ?? null}
              awards={detail.awards}
              players={detail.players.dire}
              side="dire"
              teamName={detail.score.direTeamName}
              onPlayerToggle={toggleExpandedPlayer}
            />
          </View>

          <DraftSection drafts={detail.drafts} />
          <VisionSection durationText={detail.match.durationText} selectedSecond={wardSecond} wards={detail.vision.wards} onChange={setWardSecond} />
          <TrendSection detail={detail} />
          <ChatSection chat={detail.chat} />
        </View>
      ) : null}
    </PageShell>
  );
}

function MatchSummary(props: { detail: MatchDetail }) {
  const { detail } = props;
  const gameModeText = formatDotaGameMode(detail.match.gameMode);

  return (
    <View className="match-summary battle-summary">
      <View className="summary-meta">
        <Text>比赛编号 {detail.match.matchId}</Text>
        <Text>{formatFullMatchDateTime(detail.match.endedAt ?? detail.match.startTime)}</Text>
      </View>
      <Text className="victory-label">{detail.match.winnerName} 胜利</Text>
      <View className="scoreboard">
        <View className="team-side radiant">
          <Text>天辉</Text>
          <Text>{detail.score.radiantTeamName}</Text>
          <Text>天辉</Text>
        </View>
        <View className="score-core">
          <Text>{detail.match.tournamentName ?? detail.match.leagueName}</Text>
          <Text className="score-core-value">{detail.score.radiantScore}<Text>:</Text>{detail.score.direScore}</Text>
          <Text>{detail.match.durationText}{gameModeText ? ` · ${gameModeText}` : ""}</Text>
        </View>
        <View className="team-side dire">
          <Text>夜魇</Text>
          <Text>{detail.score.direTeamName}</Text>
          <Text>夜魇</Text>
        </View>
      </View>
    </View>
  );
}

function formatFullMatchDateTime(value?: string | null): string {
  if (!value) {
    return "时间待定";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function MvpCard(props: { detail: MatchDetail }) {
  const mvp = props.detail.mvp;
  const player = mvp ? props.detail.players.all.find((item) => item.name === mvp.playerName) ?? null : null;
  const playerTeamName =
    player?.side === "radiant"
      ? props.detail.score.radiantTeamName
      : player?.side === "dire"
        ? props.detail.score.direTeamName
        : "MRJZ";

  if (!mvp) {
    return null;
  }

  return (
    <View className={`content-panel mvp-card-mini ${player?.side ?? ""}`}>
      <View className="mvp-card-copy">
        <Text className="kicker">MVP</Text>
        <Text className="section-heading">{mvp.playerName}</Text>
        <Text className="muted">{player?.hero ?? mvp.title} · {playerTeamName}</Text>
        <View className="mvp-metric-row">
          <View>
            <Text>{player ? `${player.kills}/${player.deaths}/${player.assists}` : "-"}</Text>
            <Text>KDA</Text>
          </View>
          <View>
            <Text>{formatPercent(player?.killParticipation ?? null)}</Text>
            <Text>参战</Text>
          </View>
          <View>
            <Text>{formatPercent(player?.heroDamageShare ?? null)}</Text>
            <Text>伤害</Text>
          </View>
        </View>
      </View>
      {player ? (
        <View className="mvp-portrait-wrap">
          <Image className="mvp-portrait" mode="aspectFill" src={player.portrait} />
          <Text>MVP</Text>
        </View>
      ) : null}
    </View>
  );
}

function MatchQuickStats(props: { detail: MatchDetail }) {
  const radiantKills = props.detail.players.radiant.reduce((sum, player) => sum + player.kills, 0);
  const direKills = props.detail.players.dire.reduce((sum, player) => sum + player.kills, 0);

  return (
    <View className="match-ribbon">
      <View className="match-ribbon-stat duration">
        <Text>{props.detail.match.durationText}</Text>
        <Text>时长</Text>
      </View>
      <View className="match-ribbon-stat kill-score">
        <Text>击杀</Text>
        <View>
          <Text className="radiant-score">{radiantKills}</Text>
          <Text>:</Text>
          <Text className="dire-score">{direKills}</Text>
        </View>
      </View>
    </View>
  );
}

function TeamPanel(props: {
  side: TeamSide;
  teamName: string;
  players: MatchDetailPlayer[];
  isWinner: boolean;
  mvpPlayerName: string | null;
  awards: MatchAward[];
  expandedPlayers: Set<string>;
  onPlayerToggle: (playerKey: string) => void;
}) {
  const kills = props.players.reduce((sum, player) => sum + player.kills, 0);

  return (
    <View className={`team-panel ${props.side}`}>
      <View className="team-panel-head">
        <View>
          <Text className="team-result-pill">{sideLabel(props.side)} {props.isWinner ? "胜利" : "失败"}</Text>
          <Text className="team-panel-name">{props.teamName}</Text>
        </View>
        <Text className="team-kill-count">杀敌 {kills}</Text>
      </View>
      <View className="player-list">
        {props.players.map((player) => {
          const playerKey = playerRowKey(player);

          return (
            <PlayerDetailRow
              expanded={props.expandedPlayers.has(playerKey)}
              isMvp={props.mvpPlayerName === player.name}
              key={player.playerSlot}
              awards={props.awards.filter((award) => award.playerSlot === player.playerSlot)}
              player={player}
              onToggle={props.onPlayerToggle}
            />
          );
        })}
      </View>
    </View>
  );
}

function PlayerDetailRow(props: { player: MatchDetailPlayer; expanded: boolean; isMvp: boolean; awards: MatchAward[]; onToggle: (playerKey: string) => void }) {
  const { player } = props;
  const abilitySteps = player.abilityOrder.filter((ability) => ability.kind === "ability");
  const playerKey = playerRowKey(player);

  return (
    <View
      className={`match-player-card player-row ${player.side} ${props.expanded ? "expanded" : ""} ${props.isMvp ? "mvp-player" : ""}`}
      onClick={() => props.onToggle(playerKey)}
    >
      <View className="match-player-main">
        {props.isMvp ? <Text className="player-mvp-badge">MVP</Text> : null}
        <View className="hero-avatar-shell">
          <Image className="hero-avatar" mode="aspectFill" src={player.portrait} />
          <Text>{player.level ?? "-"}</Text>
        </View>
        <View className="match-player-copy">
          <Text className="record-title">{player.name}</Text>
          <Text className="history-text">{player.hero}</Text>
          <View className="player-chips">
            <Text className="lane-chip">{player.lane}</Text>
            <View className="player-mini-metrics">
              <Text>参战 {formatPercent(player.killParticipation)}</Text>
              <Text>伤害 {formatPercent(player.heroDamageShare)}</Text>
            </View>
          </View>
          {props.awards.length > 0 ? <PlayerAwardBadges awards={props.awards} /> : null}
        </View>
        <PlayerLoadout player={player} />
        <View className="player-kda">
          <Text>{player.kills}/{player.deaths}/{player.assists}</Text>
          <Text>KDA {kdaRatio(player)}</Text>
        </View>
      </View>

      {props.expanded ? (
        <View className="player-expanded">
          <View className="advanced-grid">
            <AdvancedMetric label="GPM" value={formatNullable(player.goldPerMin)} />
            <AdvancedMetric label="XPM" value={formatNullable(player.xpPerMin)} />
            <AdvancedMetric label="净值" value={formatCompact(player.netWorth)} />
            <AdvancedMetric label="正反补" value={`${player.lastHits ?? "-"} / ${player.denies ?? "-"}`} />
            <AdvancedMetric label="英雄伤害" value={formatCompact(player.heroDamage)} />
            <AdvancedMetric label="建筑" value={formatCompact(player.towerDamage)} />
            <AdvancedMetric label="治疗" value={formatCompact(player.heroHealing)} />
            <AdvancedMetric label="承伤" value={formatCompact(player.damageTaken)} />
          </View>
          <View className="ability-order">
            {abilitySteps.length > 0 ? (
              abilitySteps.map((ability, index) => <AbilityStep key={`${ability.key ?? ability.label}:${index}`} ability={ability} index={index} />)
            ) : (
              <Text className="muted">暂无普通技能加点</Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PlayerAwardBadges(props: { awards: MatchAward[] }) {
  const [activeAwardKey, setActiveAwardKey] = useState("");

  return (
    <View className="player-awards" onClick={(event) => event.stopPropagation()}>
      {props.awards.map((award) => {
        const awardKey = `${award.code}:${award.playerSlot}`;
        const description = award.description.trim() || "暂无称号说明";
        const isActive = activeAwardKey === awardKey;

        return (
          <View
            className={`player-award-title award-${award.code} ${isActive ? "active" : ""}`}
            key={awardKey}
            onClick={(event) => {
              event.stopPropagation();
              setActiveAwardKey((current) => (current === awardKey ? "" : awardKey));
            }}
          >
            <Text>{award.title}</Text>
            {isActive ? (
              <View className="player-award-tooltip">
                <Text className="player-award-tooltip-title">{award.title}</Text>
                <Text className="player-award-tooltip-copy">{description}</Text>
                {award.valueText ? <Text className="player-award-tooltip-copy">{award.valueText}</Text> : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function PlayerLoadout(props: { player: MatchDetailPlayer }) {
  const { player } = props;

  return (
    <View className="player-loadout">
      <View className="inventory-stack">
        <View className="inventory-grid">
          {player.items.map((item, index) => <ItemSlot key={`item-${index}`} item={item} tone="inventory" />)}
        </View>
        <View className="backpack-grid">
          {player.backpackItems.map((item, index) => <ItemSlot key={`backpack-${index}`} item={item} tone="backpack" />)}
        </View>
      </View>
      <ItemSlot item={player.neutralItem} tone="neutral" />
      <View className="agha-status-row">
        <AghanimStateIcon label="神杖" state={player.scepter} />
        <AghanimStateIcon label="魔晶" state={player.shard} />
      </View>
      <TalentTreeLegend nodes={player.talentTree} />
    </View>
  );
}

function ItemSlot(props: { item: IconRef; tone: "inventory" | "backpack" | "neutral" }) {
  const empty = !props.item.imageUrl;

  return (
    <View className={`item-slot ${props.tone} ${empty ? "empty" : ""}`}>
      {props.item.imageUrl ? <Image mode="aspectFit" src={props.item.imageUrl} /> : null}
    </View>
  );
}

function AghanimStateIcon(props: { label: "神杖" | "魔晶"; state: "owned" | "queued" | "none" }) {
  return (
    <View className={`agha-icon ${props.state}`}>
      <Image mode="aspectFit" src={aghanimIcon(props.label, props.state)} />
      <Text>{props.label}</Text>
    </View>
  );
}

function TalentTreeLegend(props: { nodes: TalentTreeNode[] }) {
  const nodes = props.nodes.length > 0 ? props.nodes : defaultTalentTreeNodes();
  const pickedCount = nodes.filter((node) => node.picked).length;

  return (
    <View className="talent-tree-mini">
      <Image mode="aspectFit" svg src={talentTreeSvg(nodes, pickedCount)} />
    </View>
  );
}

function AbilityStep(props: { ability: IconRef; index: number }) {
  const level = props.ability.level ?? props.index + 1;

  return (
    <View className={`ability-step ${props.ability.kind ?? "ability"} ${props.ability.imageUrl ? "" : "fallback"}`}>
      {props.ability.imageUrl ? <Image mode="aspectFill" src={props.ability.imageUrl} /> : <Text>{props.ability.kind === "talent" ? "T" : "+"}</Text>}
      <Text>{level}</Text>
    </View>
  );
}

function DraftSection(props: { drafts: DraftStep[] }) {
  return (
    <>
      <SectionTitle kicker="BP" title="Ban / Pick 顺序" />
      <View className="draft-timeline">
        {props.drafts.length > 0 ? props.drafts.slice().sort((left, right) => left.order - right.order).map((step) => (
          <View className={`draft-step ${step.side} ${step.type.toLowerCase()}`} key={`${step.order}:${step.hero}:${step.type}`}>
            <Text className="draft-order">{step.order}</Text>
            <View className="draft-card">
              <Image className="draft-hero" mode="aspectFill" src={step.portrait} />
              <View className="draft-copy">
                <View>
                  <Text>{step.hero}</Text>
                  <Text>{step.actor}</Text>
                </View>
                <Text>{step.type === "Ban" ? "禁用" : "选择"}</Text>
              </View>
            </View>
          </View>
        )) : <View className="content-panel"><Text className="muted">暂无 Ban / Pick 数据。</Text></View>}
      </View>
    </>
  );
}

function VisionSection(props: { durationText: string; selectedSecond: number; wards: WardEvent[]; onChange: (second: number) => void }) {
  const mapWards = uniqueWardEvents(props.wards.filter((ward) => ward.x !== null && ward.y !== null)).slice(0, 140);
  const maxSecond = getWardTimelineMaxSecond(props.durationText, props.wards);
  const selectedSecond = clamp(props.selectedSecond, 0, maxSecond);
  const activeWards = mapWards.filter((ward) => isWardVisibleAt(ward, selectedSecond));
  const progress = maxSecond > 0 ? (selectedSecond / maxSecond) * 100 : 0;

  return (
    <>
      <SectionTitle kicker="视野" title="眼位地图" actionText={`${props.wards.length} 条`} />
      <View className="vision-timeline">
        <View className="vision-map">
          <Image mode="aspectFill" src={dotaAssetUrl("wards/minimap/minimap_game.png")} />
          {mapWards.map((ward, index) => (
            <WardDot
              key={`${ward.timeSeconds}:${ward.side}:${ward.type}:${ward.x}:${ward.y}:${index}`}
              selectedSecond={selectedSecond}
              ward={ward}
            />
          ))}
          <View className="vision-hud">
            <Text className="vision-chip radiant">天辉 {activeWards.filter((ward) => ward.side === "radiant").length}</Text>
            <Text className="vision-chip dire">夜魇 {activeWards.filter((ward) => ward.side === "dire").length}</Text>
            <Text className="vision-clock">{formatWardClock(selectedSecond)}</Text>
          </View>
        </View>
        <View className="vision-scrubber">
          <Slider
            className="vision-slider"
            activeColor="#74d66c"
            backgroundColor="rgba(255, 255, 255, 0.18)"
            blockColor="#74d66c"
            blockSize={18}
            max={maxSecond}
            min={0}
            step={15}
            value={selectedSecond}
            onChange={(event: { detail: { value: number } }) => props.onChange(event.detail.value)}
            onChanging={(event: { detail: { value: number } }) => props.onChange(event.detail.value)}
          />
          <View className="vision-range-ghost">
            <View style={{ width: `${clamp(progress, 0, 100).toFixed(2)}%` }} />
          </View>
          <View className="vision-scale">
            <Text>0:00</Text>
            <Text>{activeWards.length} 眼位</Text>
            <Text>{formatWardClock(maxSecond)}</Text>
          </View>
        </View>
        {props.wards.length === 0 ? <View className="content-panel"><Text className="muted">暂无视野数据。</Text></View> : null}
      </View>
    </>
  );
}

function WardDot(props: { selectedSecond: number; ward: WardEvent }) {
  const left = clamp(((props.ward.x ?? 128) / 255) * 100, 4, 96);
  const top = clamp(100 - ((props.ward.y ?? 128) / 255) * 100, 4, 96);
  const icon = props.ward.type === "岗哨守卫" ? "sentry" : "observer";
  const isActive = isWardVisibleAt(props.ward, props.selectedSecond);

  return (
    <View
      className={`ward-marker ${props.ward.side} ${icon} ${isActive ? "active" : ""}`}
      style={{ left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` }}
    >
      <View className="ward-radius" />
      <Image mode="aspectFit" svg src={wardIconSvg(icon, props.ward.side)} />
    </View>
  );
}

function TrendSection(props: { detail: MatchDetail }) {
  const { detail } = props;

  return (
    <>
      <SectionTitle kicker="趋势" title="战况趋势" />
      {detail.charts.hasTrends ? (
        <View className="trend-grid">
          <AdvantageTrendGraph detail={detail} />
          <PlayerGoldTrendGraph detail={detail} />
        </View>
      ) : (
        <View className="content-panel"><Text className="muted">暂无趋势数据。</Text></View>
      )}
      <ComparisonBars detail={detail} />
    </>
  );
}

function AdvantageTrendGraph(props: { detail: MatchDetail }) {
  const { detail } = props;
  const gold = sampleTrend(detail.charts.goldAdvantage, 44);
  const xp = sampleTrend(detail.charts.xpAdvantage, 44);
  const lastGold = detail.charts.goldAdvantage[detail.charts.goldAdvantage.length - 1];
  const lastXp = detail.charts.xpAdvantage[detail.charts.xpAdvantage.length - 1];
  const maxAbs = Math.max(1, ...gold.map((point) => Math.abs(point.value)), ...xp.map((point) => Math.abs(point.value)));

  if (gold.length === 0 && xp.length === 0) {
    return (
      <View className="trend-card">
        <Text className="muted">暂无</Text>
      </View>
    );
  }

  return (
    <View className="trend-card trend-card-wide">
      <View className="trend-card-head">
        <Text>经济 / 经验差</Text>
        <Text>经济 {formatTrendValue(lastGold?.value ?? 0)} · 经验 {formatTrendValue(lastXp?.value ?? 0)}</Text>
      </View>
      <Image className="trend-svg" mode="aspectFit" svg src={advantageTrendSvg(gold, xp, maxAbs)} />
      <View className="trend-legend">
        <Text><Text className="trend-dot gold" />经济差</Text>
        <Text><Text className="trend-dot xp" />经验差</Text>
      </View>
      <View className="trend-scale">
        <Text>{`${Math.min(gold[0]?.minute ?? 0, xp[0]?.minute ?? 0)}m`}</Text>
        <Text>{`±${formatCompact(maxAbs)}`}</Text>
        <Text>{`${Math.max(lastGold?.minute ?? 0, lastXp?.minute ?? 0)}m`}</Text>
      </View>
    </View>
  );
}

function PlayerGoldTrendGraph(props: { detail: MatchDetail }) {
  const { detail } = props;
  const trends = detail.charts.playerGold
    .filter((trend) => trend.values.length > 0)
    .slice()
    .sort((left, right) => left.playerSlot - right.playerSlot);
  const maxGold = Math.max(1, ...trends.flatMap((trend) => trend.values));

  if (trends.length === 0) {
    return null;
  }

  return (
    <View className="trend-card trend-card-wide">
      <View className="trend-card-head">
        <Text>选手经济曲线</Text>
        <Text>{trends.length} 名选手</Text>
      </View>
      <Image className="trend-svg player-trend-svg" mode="aspectFit" svg src={playerGoldTrendSvg(trends, maxGold)} />
      <View className="trend-player-legend">
        {trends.map((trend, index) => (
          <View className={trend.side} key={`${trend.playerSlot}:${trend.playerName}`}>
            <Text style={{ background: playerTrendColor(index, trend.side) }} />
            <Text>{playerTrendHeroName(detail, trend)}</Text>
            <Text>{formatCompact(trend.values[trend.values.length - 1] ?? 0)}</Text>
          </View>
        ))}
      </View>
      <View className="trend-scale">
        <Text>0m</Text>
        <Text>{formatCompact(maxGold)}</Text>
        <Text>{`${Math.max(...trends.map((trend) => trend.values.length - 1))}m`}</Text>
      </View>
    </View>
  );
}

function ComparisonBars(props: { detail: MatchDetail }) {
  const { comparisons } = props.detail;

  if (comparisons.length === 0) {
    return null;
  }

  return (
    <View className="comparison-list">
      {comparisons.map((metric) => {
        const share = clamp(metric.radiantShare, 0.08, 0.92);

        return (
          <View className="comparison-row" key={metric.key}>
            <Text>{metric.label}</Text>
            <View>
              <Text className="comparison-fill radiant" style={{ width: `${(share * 100).toFixed(1)}%` }} />
              <Text className="comparison-fill dire" style={{ width: `${((1 - share) * 100).toFixed(1)}%` }} />
            </View>
            <Text>{formatCompact(metric.radiantValue)} / {formatCompact(metric.direValue)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ChatSection(props: { chat: ChatLine[] }) {
  return (
    <>
      <SectionTitle kicker="聊天" title="聊天记录" />
      <View className="chat-section content-panel">
        {props.chat.length > 0 ? (
          <ScrollView className="chat-scroll" scrollY>
            <View className="chat-list">
              {props.chat.slice(0, 60).map((line, index) => (
                <ChatLineItem line={line} key={`${line.time}:${line.player}:${index}`} />
              ))}
            </View>
          </ScrollView>
        ) : <Text className="muted">暂无聊天记录。</Text>}
      </View>
    </>
  );
}

function ChatLineItem(props: { line: ChatLine }) {
  return (
    <View className={`chat-line ${props.line.side}`}>
      <Text>{props.line.time}</Text>
      <Text>{props.line.player}</Text>
      <Text>{props.line.hero}</Text>
      <Text>{props.line.text}</Text>
    </View>
  );
}

function AdvancedMetric(props: { label: string; value: string }) {
  return (
    <View>
      <Text>{props.value}</Text>
      <Text>{props.label}</Text>
    </View>
  );
}

function sideLabel(side: TeamSide): string {
  return side === "radiant" ? "天辉" : "夜魇";
}

function defaultExpandedPlayers(detail: MatchDetail): Set<string> {
  void detail;
  return new Set();
}

function playerRowKey(player: MatchDetailPlayer): string {
  return `${player.side}:${player.playerSlot}`;
}

function kdaRatio(player: MatchDetailPlayer): string {
  const deaths = Math.max(1, player.deaths);

  return ((player.kills + player.assists) / deaths).toFixed(1);
}

function defaultTalentTreeNodes(): TalentTreeNode[] {
  return ([4, 3, 2, 1] as const).flatMap((tier) =>
    (["left", "right"] as const).map((side) => ({
      tier,
      side,
      picked: false,
      label: "天赋",
    })),
  );
}

function talentTreeSvg(nodes: TalentTreeNode[], pickedCount: number): string {
  const branches = [
    ...nodes.filter((node) => !node.picked),
    ...nodes.filter((node) => node.picked),
  ]
    .map((node) => {
      const fill = node.picked ? `url(#copper-${node.side})` : "hsl(0,0%,28%)";
      const opacity = node.picked ? "0.96" : "0.74";
      const filter = node.picked ? "filter=\"url(#glow)\"" : "";

      return `<path fill="${fill}" opacity="${opacity}" ${filter} d="${talentBranchPath(node.tier, node.side)}"/>`;
    })
    .join("");
  const dots = talentArcDots
    .map((path, index) => {
      const fill = index < clamp(Math.round(pickedCount), 0, 7) ? "url(#copper-dot)" : "hsla(0,0%,100%,0.12)";
      return `<path fill="${fill}" d="${path}"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="talent-tree-svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="copper-left" gradientUnits="userSpaceOnUse" x1="4.68" y1="3.66" x2="35.93" y2="57.79"><stop offset="0.0938" stop-color="rgb(231,189,118)"/><stop offset="0.2261" stop-color="rgb(201,108,53)"/><stop offset="0.4401" stop-color="rgb(207,126,65)"/><stop offset="0.5891" stop-color="rgb(215,148,84)"/><stop offset="0.7585" stop-color="rgb(229,185,114)"/><stop offset="1" stop-color="rgb(242,214,139)"/></linearGradient>
    <linearGradient id="copper-right" gradientUnits="userSpaceOnUse" x1="-7.88" y1="3.66" x2="23.37" y2="57.79" gradientTransform="matrix(-1 0 0 1 38.4375 0)"><stop offset="0.0938" stop-color="rgb(231,189,118)"/><stop offset="0.2261" stop-color="rgb(201,108,53)"/><stop offset="0.4401" stop-color="rgb(207,126,65)"/><stop offset="0.5891" stop-color="rgb(215,148,84)"/><stop offset="0.7585" stop-color="rgb(229,185,114)"/><stop offset="1" stop-color="rgb(242,214,139)"/></linearGradient>
    <linearGradient id="copper-dot" gradientUnits="userSpaceOnUse" x1="3" y1="22" x2="27" y2="31"><stop offset="0.1257" stop-color="rgb(231,189,118)"/><stop offset="0.3335" stop-color="rgb(204,117,59)"/><stop offset="0.8908" stop-color="rgb(201,109,52)"/><stop offset="0.9891" stop-color="rgb(229,185,114)"/></linearGradient>
    <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="rgb(229,185,114)" flood-opacity="0.34"/></filter>
  </defs>
  <svg viewBox="0 0 51 63" width="32" height="23" y="4.45" preserveAspectRatio="xMidYMin meet">${branches}</svg>
  ${dots}
  <path fill="hsla(0,0%,100%,0.12)" d="M1.974 21.886a15.733 15.733 0 01-1.307-6.302C.667 6.983 7.537 0 16 0c8.463 0 15.333 6.983 15.333 15.584 0 2.226-.46 4.343-1.288 6.259a3.35 3.35 0 00-.942-.549 14.626 14.626 0 001.152-5.71c0-7.996-6.387-14.488-14.255-14.488-7.867 0-14.255 6.492-14.255 14.488 0 2.042.417 3.986 1.169 5.75a3.36 3.36 0 00-.94.552z"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function talentBranchPath(tier: TalentTreeNode["tier"], side: TalentTreeNode["side"]): string {
  const paths: Record<string, string> = {
    "1-left": "M0.013,44.716c0,0,6.586,6.584,9.823,6.805c3.236,0.224,7.033,0,7.033,0s7.024,1.732,7.024,7.368V63 l3.195-0.014c0,0,0-3.782,0-5.571c0-6.857-10.053-7.567-10.053-7.567S11.957,41.979,0.013,44.716z",
    "1-right": "M51,44.716c0,0-6.586,6.584-9.823,6.805c-3.235,0.224-7.032,0-7.032,0s-7.024,1.732-7.024,7.368V63 l-3.195-0.014c0,0,0-3.782,0-5.571c0-6.857,10.052-7.567,10.052-7.567S39.057,41.979,51,44.716z",
    "2-left": "M0,30.326c0,0,5.744,9.07,9.516,9.495c3.1,0.348,6.542,0.107,8.122,0.262 c3.068,0.301,6.256,1.351,6.256,5.667V63h3.181c0,0,0-17.488,0-18.454c0-0.964-0.006-5.235-7.093-6.584 c-1.207-0.232-3.687-0.281-4.913-0.281C15.068,37.681,10.547,29.951,0,30.326z",
    "2-right": "M51,30.326c0,0-5.745,9.07-9.517,9.495c-3.1,0.348-6.542,0.107-8.12,0.262 c-3.069,0.301-6.257,1.351-6.257,5.667V63h-3.182c0,0,0-17.488,0-18.454c0-0.964,0.006-5.235,7.093-6.584 c1.208-0.232,3.688-0.281,4.913-0.281C35.931,37.681,40.451,29.951,51,30.326z",
    "3-left": "M4.031,16.042c0,0,0.669,3.435,2.899,6.315c2.232,2.878,4.147,4.891,6.489,4.891 c2.344,0,6.208-0.01,7.68,0.868c1.837,1.095,2.803,3.213,2.803,5.373c0,0.976,0,29.511,0,29.511h3.173V33.489 c0,0-0.085-3.859-3.102-6.426c-1.651-1.405-2.911-2.141-5.294-2.141c-0.908,0-2.041-0.019-2.041-0.019s-1.785-4.153-5.188-6.203 C8.046,16.651,4.031,16.042,4.031,16.042z",
    "3-right": "M46.969,16.042c0,0-0.669,3.435-2.898,6.315c-2.232,2.878-4.147,4.891-6.489,4.891 c-2.344,0-6.208-0.01-7.68,0.868c-1.837,1.095-2.803,3.213-2.803,5.373c0,0.976,0,29.511,0,29.511h-3.174V33.489 c0,0,0.086-3.859,3.103-6.426c1.651-1.405,2.911-2.141,5.295-2.141c0.907,0,2.041-0.019,2.041-0.019s1.785-4.153,5.187-6.203 C42.954,16.651,46.969,16.042,46.969,16.042z",
    "4-left": "M11.033,0c0,0-0.802,7.891,2.625,11.654c3.426,3.761,5.55,2.683,7.765,3.097 c1.969,0.369,2.479,1.772,2.479,3.984c0,2.212,0,44.209,0,44.209h3.101c0,0,0.072-43.305,0.072-44.209 c0-0.905-0.019-4.906-3.792-6.115c-1.592-0.509-2.334-0.376-2.918-2.293C19.782,8.408,17.96,1.99,11.033,0z",
    "4-right": "M39.967,0c0,0,0.803,7.891-2.625,11.654c-3.426,3.761-5.551,2.683-7.765,3.097 c-1.969,0.369-2.479,1.772-2.479,3.984c0,2.212,0,44.209,0,44.209h-3.101c0,0-0.073-43.305-0.073-44.209 c0-0.905,0.02-4.906,3.793-6.115c1.592-0.509,2.335-0.376,2.917-2.293C31.218,8.408,33.04,1.99,39.967,0z",
  };

  return paths[`${tier}-${side}`] ?? paths["1-left"]!;
}

const talentArcDots = [
  "M3.258 23.38c.295-.22.624-.303.992-.238.362.057.651.235.868.536.217.3.298.634.243 1.002-.05.376-.225.67-.52.891a1.24 1.24 0 01-1.002.244 1.275 1.275 0 01-.868-.535 1.315 1.315 0 01-.242-1.002c.05-.377.225-.671.529-.898z",
  "M6.244 26.987c.215-.301.503-.482.873-.534.361-.06.69.02.988.24.297.218.474.51.532.878.067.374-.012.708-.227 1.01-.221.31-.51.491-.88.544a1.263 1.263 0 01-.987-.24 1.302 1.302 0 01-.533-.879 1.291 1.291 0 01.234-1.019z",
  "M10.17 29.492c.114-.355.333-.617.669-.783a1.26 1.26 0 011.012-.082c.349.115.607.338.773.669.177.335.204.677.091 1.032a1.27 1.27 0 01-.671.793 1.26 1.26 0 01-1.012.082 1.284 1.284 0 01-.774-.669 1.294 1.294 0 01-.087-1.042z",
  "M14.684 30.638c0-.373.129-.69.398-.954.258-.264.57-.396.938-.396.366 0 .68.13.938.393.27.262.4.58.4.953.002.383-.127.701-.397.965a1.268 1.268 0 01-.937.396c-.367 0-.68-.13-.939-.393-.27-.263-.4-.58-.4-.964z",
  "M19.302 30.322a1.287 1.287 0 01.09-1.032c.165-.331.423-.555.771-.67a1.26 1.26 0 011.013.08c.336.166.556.428.67.782.116.365.09.708-.087 1.043a1.284 1.284 0 01-.772.67 1.26 1.26 0 01-1.013-.08 1.27 1.27 0 01-.672-.793z",
  "M23.614 28.564a1.284 1.284 0 01-.23-1.01c.058-.367.234-.66.53-.88.297-.219.626-.3.988-.241.37.051.659.231.874.532.223.31.302.645.236 1.019-.057.367-.234.66-.53.88-.297.219-.626.3-.988.241a1.252 1.252 0 01-.88-.541z",
  "M27.184 25.537a1.272 1.272 0 01-.523-.89 1.316 1.316 0 01.24-1.002c.215-.302.504-.48.866-.538.368-.067.697.015.993.234.305.226.481.52.531.896.057.368-.023.702-.239 1.003-.216.301-.505.48-.866.538a1.24 1.24 0 01-1.002-.241z",
];

function getWardTimelineMaxSecond(durationText: string, wards: WardEvent[]): number {
  const durationSeconds = parseClockText(durationText);
  const lastWardSecond = Math.max(0, ...wards.map((ward) => ward.timeSeconds));

  return Math.max(600, durationSeconds, lastWardSecond + 120);
}

function isWardVisibleAt(ward: WardEvent, selectedSecond: number): boolean {
  return ward.timeSeconds <= selectedSecond && selectedSecond <= wardExpiresAt(ward);
}

function wardExpiresAt(ward: WardEvent): number {
  const lifetime = ward.type === "岗哨守卫" ? 420 : 360;

  return ward.removedAt !== null && ward.removedAt > ward.timeSeconds ? ward.removedAt : ward.timeSeconds + lifetime;
}

function uniqueWardEvents(wards: WardEvent[]): WardEvent[] {
  const seen = new Set<string>();

  return wards.filter((ward) => {
    const key = `${ward.timeSeconds}:${ward.side}:${ward.type}:${ward.x}:${ward.y}:${ward.note}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function wardIconSvg(icon: "observer" | "sentry", side: TeamSide): string {
  const color = side === "radiant" ? "#74d66c" : "#ef6467";
  const body =
    icon === "observer"
      ? `<circle cx="50" cy="58" r="18" fill="none" stroke="${color}" stroke-width="10"/>
      <path fill="none" stroke="${color}" stroke-width="10" stroke-linejoin="miter" stroke-miterlimit="25" d="M 10,50 C 35,12 65,12 90,50 C 65,88 35,88 10,50 Z"/>`
      : `<path fill="none" stroke="${color}" stroke-width="15" stroke-linejoin="miter" stroke-miterlimit="20" d="M 12,50 C 35,10 65,10 88,50 C 65,90 35,90 12,50 Z"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="scale(1,-1) translate(0,-100)">${body}</g>
</svg>`;

  return svgDataUrl(svg);
}

function parseClockText(value: string | null | undefined): number {
  const parts = String(value ?? "")
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 60 + parts[1]!);
  }

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return Math.max(0, parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  }

  return 0;
}

function formatWardClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sampleTrend(points: MatchDetail["charts"]["goldAdvantage"], targetCount: number): MatchDetail["charts"]["goldAdvantage"] {
  if (points.length <= targetCount) {
    return points;
  }

  const step = (points.length - 1) / (targetCount - 1);

  return Array.from({ length: targetCount }, (_, index) => points[Math.round(index * step)]).filter(
    (point): point is MatchDetail["charts"]["goldAdvantage"][number] => point !== undefined,
  );
}

function advantageTrendSvg(
  gold: MatchDetail["charts"]["goldAdvantage"],
  xp: MatchDetail["charts"]["xpAdvantage"],
  maxAbs: number,
): string {
  const width = 280;
  const height = 112;
  const goldPoints = gold.length > 0 ? `<polyline points="${trendPolyline(gold, { maxAbs, width, height })}" class="trend-poly gold"/>` : "";
  const xpPoints = xp.length > 0 ? `<polyline points="${trendPolyline(xp, { maxAbs, width, height })}" class="trend-poly xp"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>${trendGraphStyles()}</defs>
  ${trendGridLines(width, height)}
  <line x1="10" y1="56" x2="270" y2="56" class="trend-axis"/>
  ${goldPoints}
  ${xpPoints}
</svg>`;

  return svgDataUrl(svg);
}

function playerGoldTrendSvg(trends: MatchDetail["charts"]["playerGold"], maxGold: number): string {
  const width = 280;
  const height = 128;
  const lines = trends
    .map((trend, index) => {
      const color = playerTrendColor(index, trend.side);
      return `<polyline points="${playerTrendPolyline(trend.values, maxGold, width, height)}" fill="none" stroke="${color}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>${trendGraphStyles()}</defs>
  ${trendGridLines(width, height)}
  ${lines}
</svg>`;

  return svgDataUrl(svg);
}

function trendGraphStyles(): string {
  return `<style>
    .trend-axis{stroke:rgba(255,255,255,.18);stroke-width:1}
    .trend-grid-line{stroke:rgba(255,255,255,.08);stroke-width:1}
    .trend-grid-line.muted{stroke:rgba(255,255,255,.05)}
    .trend-poly{fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .trend-poly.gold{stroke:#74d66c}
    .trend-poly.xp{stroke:#65b5ff}
  </style>`;
}

function trendGridLines(width: number, height: number): string {
  const top = 10;
  const middle = height / 2;
  const bottom = height - 10;

  return `<line x1="10" y1="${top}" x2="${width - 10}" y2="${top}" class="trend-grid-line"/>
  <line x1="10" y1="${middle}" x2="${width - 10}" y2="${middle}" class="trend-grid-line muted"/>
  <line x1="10" y1="${bottom}" x2="${width - 10}" y2="${bottom}" class="trend-grid-line"/>`;
}

function trendPolyline(
  points: MatchDetail["charts"]["goldAdvantage"],
  options: { maxAbs: number; width: number; height: number },
): string {
  const { maxAbs, width, height } = options;
  const padding = 8;
  const denominator = Math.max(1, points.length - 1);

  return points
    .map((point, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height / 2 - (point.value / maxAbs) * (height / 2 - padding);

      return `${x.toFixed(1)},${clamp(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

function playerTrendPolyline(values: number[], maxValue: number, width: number, height: number): string {
  const padding = 8;
  const denominator = Math.max(1, values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height - padding - (value / maxValue) * (height - padding * 2);

      return `${x.toFixed(1)},${clamp(y, padding, height - padding).toFixed(1)}`;
    })
    .join(" ");
}

function playerTrendHeroName(detail: MatchDetail, trend: MatchDetail["charts"]["playerGold"][number]): string {
  return detail.players.radiant.concat(detail.players.dire).find((player) => player.playerSlot === trend.playerSlot)?.hero ?? trend.playerName;
}

function playerTrendColor(index: number, side: TeamSide): string {
  const radiantColors = ["#75e06c", "#9fe870", "#45d1a4", "#54c7ff", "#d6f06b"];
  const direColors = ["#ff646d", "#ff9b5f", "#d96bff", "#ff5fb7", "#f0c36a"];
  const palette = side === "radiant" ? radiantColors : direColors;

  return palette[index % palette.length]!;
}

function formatTrendValue(value: number): string {
  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${formatCompact(value)}`;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function formatNullable(value: number | null): string {
  return value === null ? "-" : String(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

function formatCompact(value: number | null): string {
  if (value === null) {
    return "-";
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return formatInteger(value);
}

function formatSigned(value: number): string {
  const compact = formatCompact(Math.abs(value));
  if (value > 0) {
    return `天辉 +${compact}`;
  }
  if (value < 0) {
    return `夜魇 +${compact}`;
  }
  return "0";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
