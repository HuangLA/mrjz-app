import { Text, View } from "@tarojs/components";
import { useDidShow, useRouter } from "@tarojs/taro";
import { useState } from "react";
import { loadTeamProfile } from "../../api";
import { PageShell, SectionTitle, StatGrid, TeamBadge } from "../../components";
import type { TeamProfile } from "../../types";
import { formatDate, formatInteger, formatPercent, navigate } from "../../utils";

export default function TeamDetailPage() {
  const router = useRouter();
  const tournamentId = String(router.params.tournamentId ?? "");
  const teamId = String(router.params.teamId ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<TeamProfile | null>(null);

  useDidShow(() => {
    void refresh();
  });

  async function refresh() {
    if (!tournamentId || !teamId) {
      setError("缺少队伍参数");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      setProfile(await loadTeamProfile(tournamentId, teamId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "队伍主页读取失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell loading={loading} error={error} routeKey="teams">
      {profile ? (
        <>
          <View className="hero-panel">
            <TeamBadge team={profile} />
            <Text className="brand-subtitle">成员 {profile.memberCount} 人 · {profile.status}</Text>
          </View>
          <StatGrid
            items={[
              { label: "系列赛", value: formatInteger(profile.stats.seriesPlayed), hint: `${profile.stats.seriesWins} 胜 ${profile.stats.seriesLosses} 负` },
              { label: "胜率", value: formatPercent(profile.stats.winRate), hint: "系列赛" },
              { label: "单局", value: `${profile.stats.gameWins}-${profile.stats.gameLosses}`, hint: "胜负" },
            ]}
          />

          <SectionTitle kicker="成员" title="当前名单" />
          {profile.members.map((member) => (
            <View className="content-panel player-line" key={member.id} onClick={() => navigate(`/pages/player-detail/index?tournamentId=${tournamentId}&playerId=${member.id}`)}>
              <Text className="record-title">{member.displayName}</Text>
              <Text className="muted">{member.accountId ?? "未绑定"}</Text>
            </View>
          ))}

          <SectionTitle kicker="比赛" title="近期记录" />
          {profile.matches.slice(0, 10).map((match) => (
            <View className="content-panel history-item" key={match.matchId} onClick={() => navigate(`/pages/match-detail/index?matchId=${match.matchId}`)}>
              <View>
                <Text className="record-title">{match.radiantTeamName} vs {match.direTeamName}</Text>
                <Text className="history-text">{formatDate(match.startTime)} · {match.durationText ?? "时长待同步"}</Text>
              </View>
              <Text className="status-text">{match.result === "win" ? "胜" : match.result === "loss" ? "负" : "未知"}</Text>
            </View>
          ))}
        </>
      ) : null}
    </PageShell>
  );
}
