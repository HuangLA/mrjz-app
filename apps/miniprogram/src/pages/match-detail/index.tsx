import { Image, Text, View } from "@tarojs/components";
import { useDidShow, useRouter } from "@tarojs/taro";
import { useState } from "react";
import { loadMatch } from "../../api";
import { aghanimIcon, dotaAssetUrl } from "../../dota";
import { PageShell, SectionTitle, StatGrid } from "../../components";
import type { ChatLine, DraftStep, IconRef, MatchDetail, MatchDetailPlayer, TalentTreeNode, TeamSide, WardEvent } from "../../types";
import { formatDateTime, formatInteger } from "../../utils";

export default function MatchDetailPage() {
  const router = useRouter();
  const matchId = String(router.params.matchId ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<MatchDetail | null>(null);

  useDidShow(() => {
    void refresh();
  });

  async function refresh() {
    if (!matchId) {
      setError("缺少 match_id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      setDetail(await loadMatch(matchId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "比赛详情读取失败");
    } finally {
      setLoading(false);
    }
  }

  const radiantKills = detail?.players.radiant.reduce((sum, player) => sum + player.kills, 0) ?? 0;
  const direKills = detail?.players.dire.reduce((sum, player) => sum + player.kills, 0) ?? 0;

  return (
    <PageShell loading={loading} error={error} routeKey="records">
      {detail ? (
        <>
          <MatchSummary detail={detail} />
          <StatGrid
            items={[
              { label: "比分", value: detail.score.scoreText, hint: "官方战报" },
              { label: "击杀", value: `${radiantKills}:${direKills}`, hint: "双方总击杀" },
              { label: "解析", value: detail.parseStatus, hint: "OpenDota" },
            ]}
          />
          {detail.mvp ? (
            <View className="content-panel mvp-card-mini">
              <Text className="kicker">MVP</Text>
              <Text className="section-heading">{detail.mvp.playerName}</Text>
              <Text className="muted">{detail.mvp.title} · 评分 {detail.mvp.score}</Text>
            </View>
          ) : null}

          <SectionTitle kicker="双方数据" title="天辉" />
          <TeamPanel side="radiant" players={detail.players.radiant} />
          <SectionTitle kicker="双方数据" title="夜魇" />
          <TeamPanel side="dire" players={detail.players.dire} />

          <DraftSection drafts={detail.drafts} />
          <VisionSection wards={detail.vision.wards} />
          <TrendSection detail={detail} />
          <ChatSection chat={detail.chat} />
        </>
      ) : null}
    </PageShell>
  );
}

function MatchSummary(props: { detail: MatchDetail }) {
  const { detail } = props;

  return (
    <View className="match-summary battle-summary">
      <View className="summary-meta">
        <Text>比赛编号 {detail.match.matchId}</Text>
        <Text>{formatDateTime(detail.match.startTime)}</Text>
      </View>
      <Text className="victory-label">{detail.match.winnerName} 胜利</Text>
      <View className="scoreboard">
        <View className="team-side radiant">
          <Text>天辉</Text>
          <Text>{detail.score.radiantTeamName}</Text>
        </View>
        <View className="score-core">
          <Text>{detail.match.tournamentName ?? detail.match.leagueName}</Text>
          <Text className="score-core-value">{detail.score.radiantScore}<Text>:</Text>{detail.score.direScore}</Text>
          <Text>{detail.match.durationText}</Text>
        </View>
        <View className="team-side dire">
          <Text>夜魇</Text>
          <Text>{detail.score.direTeamName}</Text>
        </View>
      </View>
    </View>
  );
}

function TeamPanel(props: { side: TeamSide; players: MatchDetailPlayer[] }) {
  const kills = props.players.reduce((sum, player) => sum + player.kills, 0);

  return (
    <View className={`team-panel ${props.side}`}>
      <View className="team-panel-head">
        <View>
          <Text>{sideLabel(props.side)}</Text>
          <Text>{props.players.length} 名选手</Text>
        </View>
        <Text>杀敌 {kills}</Text>
      </View>
      {props.players.map((player) => (
        <PlayerDetailRow key={player.playerSlot} player={player} />
      ))}
    </View>
  );
}

function PlayerDetailRow(props: { player: MatchDetailPlayer }) {
  const { player } = props;
  const abilitySteps = player.abilityOrder.filter((ability) => ability.kind === "ability");

  return (
    <View className={`match-player-card ${player.side}`}>
      <View className="match-player-main">
        <View className="hero-avatar-shell">
          <Image className="hero-avatar" mode="aspectFill" src={player.portrait} />
          <Text>{player.level ?? "-"}</Text>
        </View>
        <View className="match-player-copy">
          <Text className="record-title">{player.name}</Text>
          <Text className="history-text">{player.hero} · {player.lane}</Text>
          <View className="player-chips">
            <Text>KDA {player.kdaText}</Text>
            <Text>参战 {formatPercent(player.killParticipation)}</Text>
            <Text>伤害 {formatPercent(player.heroDamageShare)}</Text>
          </View>
        </View>
        <View className="player-kda">
          <Text>{player.kills}/{player.deaths}/{player.assists}</Text>
          <Text>GPM {player.goldPerMin ?? "-"}</Text>
        </View>
      </View>

      <PlayerLoadout player={player} />

      <View className="advanced-grid">
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
      <View className="talent-tree-grid">
        {nodes.map((node) => (
          <View className={`talent-node ${node.side} ${node.picked ? "picked" : ""}`} key={`${node.tier}:${node.side}`}>
            <Text>{node.picked ? talentTierLabel(node.tier) : ""}</Text>
          </View>
        ))}
      </View>
      <Text>天赋 {pickedCount}/8</Text>
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
                <Text>{step.hero}</Text>
                <Text>{step.actor} · {step.type === "Ban" ? "禁用" : "选择"}</Text>
              </View>
            </View>
          </View>
        )) : <View className="content-panel"><Text className="muted">暂无 Ban / Pick 数据。</Text></View>}
      </View>
    </>
  );
}

function VisionSection(props: { wards: WardEvent[] }) {
  const mapWards = props.wards.filter((ward) => ward.x !== null && ward.y !== null).slice(0, 80);

  return (
    <>
      <SectionTitle kicker="视野" title="眼位地图" actionText={`${props.wards.length} 条`} />
      <View className="vision-board">
        <View className="vision-map">
          <Image mode="aspectFill" src={dotaAssetUrl("wards/minimap/minimap_game.png")} />
          {mapWards.map((ward, index) => <WardDot key={`${ward.timeSeconds}:${ward.side}:${ward.x}:${ward.y}:${index}`} ward={ward} />)}
        </View>
        <View className="vision-event-list">
          {props.wards.slice(0, 12).map((ward, index) => (
            <View className={`ward-event ${ward.side}`} key={`${ward.time}:${ward.note}:${index}`}>
              <Text>{ward.time}</Text>
              <Text>{sideLabel(ward.side)} · {ward.type}</Text>
              <Text>{ward.note}</Text>
            </View>
          ))}
          {props.wards.length === 0 ? <Text className="muted">暂无视野数据。</Text> : null}
        </View>
      </View>
    </>
  );
}

function WardDot(props: { ward: WardEvent }) {
  const left = clamp(((props.ward.x ?? 128) / 255) * 100, 4, 96);
  const top = clamp(100 - ((props.ward.y ?? 128) / 255) * 100, 4, 96);

  return (
    <View
      className={`ward-marker ${props.ward.side} ${props.ward.type === "岗哨守卫" ? "sentry" : "observer"}`}
      style={{ left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` }}
    />
  );
}

function TrendSection(props: { detail: MatchDetail }) {
  const { detail } = props;
  const gold = detail.charts.goldAdvantage;
  const xp = detail.charts.xpAdvantage;
  const lastGold = gold[gold.length - 1]?.value ?? 0;
  const lastXp = xp[xp.length - 1]?.value ?? 0;

  return (
    <>
      <SectionTitle kicker="趋势" title="战况趋势" />
      <View className="trend-grid">
        <TrendCard label="经济差" value={formatSigned(lastGold)} points={gold} />
        <TrendCard label="经验差" value={formatSigned(lastXp)} points={xp} />
      </View>
      <View className="comparison-bars">
        {detail.comparisons.slice(0, 6).map((metric) => (
          <View className="comparison-row" key={metric.key}>
            <View className="comparison-head">
              <Text>{metric.label}</Text>
              <Text>{formatCompact(metric.radiantValue)} / {formatCompact(metric.direValue)}</Text>
            </View>
            <View className="comparison-track">
              <View style={{ width: `${clamp(metric.radiantShare * 100, 0, 100).toFixed(1)}%` }} />
            </View>
          </View>
        ))}
        {!detail.charts.hasTrends && detail.comparisons.length === 0 ? <View className="content-panel"><Text className="muted">暂无趋势数据。</Text></View> : null}
      </View>
    </>
  );
}

function TrendCard(props: { label: string; value: string; points: Array<{ minute: number; value: number }> }) {
  const sampled = props.points.slice(-18);
  const maxAbs = Math.max(1, ...sampled.map((point) => Math.abs(point.value)));

  return (
    <View className="trend-card">
      <View className="trend-card-head">
        <Text>{props.label}</Text>
        <Text>{props.value}</Text>
      </View>
      <View className="trend-bars">
        {sampled.length > 0 ? sampled.map((point) => (
          <View
            className={point.value >= 0 ? "radiant" : "dire"}
            key={`${props.label}:${point.minute}`}
            style={{ height: `${Math.max(8, (Math.abs(point.value) / maxAbs) * 44).toFixed(1)}px` }}
          />
        )) : <Text className="muted">暂无</Text>}
      </View>
    </View>
  );
}

function ChatSection(props: { chat: ChatLine[] }) {
  return (
    <>
      <SectionTitle kicker="聊天" title="聊天记录" />
      <View className="chat-list">
        {props.chat.length > 0 ? props.chat.slice(0, 60).map((line, index) => (
          <ChatLineItem line={line} key={`${line.time}:${line.player}:${index}`} />
        )) : <View className="content-panel"><Text className="muted">暂无聊天记录。</Text></View>}
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

function talentTierLabel(tier: TalentTreeNode["tier"]): string {
  const labels: Record<TalentTreeNode["tier"], string> = { 1: "10", 2: "15", 3: "20", 4: "25" };
  return labels[tier];
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
