import { Text, View } from "@tarojs/components";
import { useDidShow, useRouter } from "@tarojs/taro";
import { useState } from "react";
import { loadMatch } from "../../api";
import { PageShell, SectionTitle, StatGrid } from "../../components";
import type { MatchDetail } from "../../types";
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

  return (
    <PageShell loading={loading} error={error}>
      {detail ? (
        <>
          <View className="hero-panel">
            <Text className="kicker">match {detail.match.matchId}</Text>
            <Text className="brand-title">{detail.score.radiantTeamName} vs {detail.score.direTeamName}</Text>
            <Text className="brand-subtitle">{formatDateTime(detail.match.startTime)} · {detail.match.durationText} · 胜者 {detail.match.winnerName}</Text>
          </View>
          <StatGrid
            items={[
              { label: "比分", value: detail.score.scoreText, hint: "官方战报" },
              { label: "解析", value: detail.parseStatus, hint: "OpenDota" },
              { label: "聊天", value: formatInteger(detail.chat.length), hint: "条" },
            ]}
          />
          {detail.mvp ? (
            <View className="content-panel">
              <Text className="kicker">MVP</Text>
              <Text className="section-heading">{detail.mvp.playerName}</Text>
              <Text className="muted">{detail.mvp.title} · 评分 {detail.mvp.score}</Text>
            </View>
          ) : null}

          <SectionTitle kicker="阵容" title="天辉" />
          {detail.players.radiant.map((player) => <PlayerStatRow key={player.playerSlot} player={player} />)}
          <SectionTitle kicker="阵容" title="夜魇" />
          {detail.players.dire.map((player) => <PlayerStatRow key={player.playerSlot} player={player} />)}

          <SectionTitle kicker="高级数据" title="可用模块" />
          <View className="record-flags">
            {detail.dataAvailability.hasDraft ? <Text className="record-flag">Ban/Pick {detail.drafts.length}</Text> : null}
            {detail.dataAvailability.hasVision ? <Text className="record-flag">视野 {detail.vision.wards.length}</Text> : null}
            {detail.dataAvailability.hasTrends ? <Text className="record-flag">趋势</Text> : null}
            {detail.dataAvailability.hasAbilityBuilds ? <Text className="record-flag">加点</Text> : null}
          </View>
        </>
      ) : null}
    </PageShell>
  );
}

function PlayerStatRow({ player }: { player: MatchDetail["players"]["all"][number] }) {
  return (
    <View className="content-panel match-player-row">
      <View>
        <Text className="record-title">{player.name}</Text>
        <Text className="history-text">英雄 #{player.heroId} · 等级 {player.level ?? "-"}</Text>
      </View>
      <View>
        <Text className="status-text">{player.kills}/{player.deaths}/{player.assists}</Text>
        <Text className="muted">GPM {player.goldPerMin ?? "-"} · XPM {player.xpPerMin ?? "-"}</Text>
      </View>
    </View>
  );
}
