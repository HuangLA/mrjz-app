import { Text, View } from "@tarojs/components";
import { useDidShow, useRouter } from "@tarojs/taro";
import { useState } from "react";
import { loadTeamProfile } from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, PlayerHeroStrip, SectionTitle, StatGrid, SteamAvatar } from "../../components";
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

    const cacheKey = pageCacheKey("team-detail", tournamentId, teamId);
    const cached = readPageCache<TeamProfile>(cacheKey);

    if (cached) {
      setProfile(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const nextProfile = await loadTeamProfile(tournamentId, teamId);
      setProfile(nextProfile);
      writePageCache(cacheKey, nextProfile);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "队伍主页读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell loading={loading} error={error} routeKey="teams">
      {profile ? (
        <>
          <View className="profile-hero team-profile">
            <View className="profile-hero-main">
              <View className="profile-avatar-fallback team large">{(profile.shortName ?? profile.name).slice(0, 2).toUpperCase()}</View>
              <View>
                <Text className="brand-title">{profile.name}</Text>
                <Text className="brand-subtitle">{profile.memberCount} 名成员 · {profile.status} · {profile.stats.linkedMatches} 场</Text>
              </View>
            </View>
            <View className="profile-winrate">
              <Text>本届胜率</Text>
              <Text>{formatPercent(profile.stats.winRate)}</Text>
              <Text>{profile.stats.gameWins}W / {profile.stats.gameLosses}L</Text>
            </View>
          </View>
          <StatGrid
            items={[
              { label: "系列赛", value: formatInteger(profile.stats.seriesPlayed), hint: `${profile.stats.seriesWins} 胜 ${profile.stats.seriesLosses} 负` },
              { label: "胜率", value: formatPercent(profile.stats.winRate), hint: "系列赛" },
              { label: "单局", value: `${profile.stats.gameWins}-${profile.stats.gameLosses}`, hint: "胜负" },
            ]}
          />

          <View className="section-panel">
            <View className="section-title compact">
              <View>
                <Text className="section-heading">常用英雄</Text>
              </View>
            </View>
            <PlayerHeroStrip heroes={profile.stats.topHeroes} />
          </View>

          <SectionTitle kicker="成员" title="当前名单" />
          {profile.members.map((member) => (
            <View
              className="content-panel roster-item"
              key={member.id}
              onClick={() => navigate(
                `/pages/player-detail/index?tournamentId=${encodeURIComponent(tournamentId)}&playerId=${encodeURIComponent(member.id)}&fromTeamId=${encodeURIComponent(teamId)}`,
              )}
            >
              <SteamAvatar player={member} size="small" />
              <Text className="record-title">{member.displayName}</Text>
              <Text className="muted">ID {member.accountId ?? member.id}</Text>
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
