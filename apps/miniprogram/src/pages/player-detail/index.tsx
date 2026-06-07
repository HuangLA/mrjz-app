import { Button, Input, Text, View } from "@tarojs/components";
import { useDidShow, useRouter } from "@tarojs/taro";
import { useMemo, useState } from "react";
import {
  getLocalLikedTagIds,
  getStoredAuthSession,
  likePlayerTag,
  loadPlayerProfile,
  loadPlayerTags,
  loginWithWeChat,
  setLocalLikedTagIds,
  submitPlayerTag,
  unlikePlayerTag,
} from "../../api";
import { PageShell, PlayerAvatar, SectionTitle, StatGrid } from "../../components";
import type { AuthSession, PlayerProfile, PlayerTag } from "../../types";
import { formatDate, formatDecimal, formatInteger, formatPercent, navigate, showToast } from "../../utils";

export default function PlayerDetailPage() {
  const router = useRouter();
  const tournamentId = String(router.params.tournamentId ?? "");
  const playerId = String(router.params.playerId ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [tags, setTags] = useState<PlayerTag[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [likedTagIds, setLikedTagIds] = useState<Set<string>>(() => {
    const storedSession = getStoredAuthSession();
    return storedSession ? getLocalLikedTagIds(storedSession.user.id) : new Set();
  });

  useDidShow(() => {
    setSession(getStoredAuthSession());
    void refresh();
  });

  async function refresh() {
    if (!tournamentId || !playerId) {
      setError("缺少选手参数");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [nextProfile, nextTags] = await Promise.all([loadPlayerProfile(tournamentId, playerId), loadPlayerTags(tournamentId, playerId)]);
      setProfile(nextProfile);
      setTags(nextTags);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "选手主页读取失败");
    } finally {
      setLoading(false);
    }
  }

  async function ensureLogin(): Promise<AuthSession | null> {
    const existing = getStoredAuthSession();
    if (existing) {
      setSession(existing);
      return existing;
    }

    try {
      const nextSession = await loginWithWeChat();
      setSession(nextSession);
      setLikedTagIds(getLocalLikedTagIds(nextSession.user.id));
      showToast("已登录", "success");
      return nextSession;
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "登录失败", "error");
      return null;
    }
  }

  async function handleSubmitTag() {
    const text = draftTag.trim();

    if (text.length === 0) {
      showToast("请输入标签");
      return;
    }

    const activeSession = await ensureLogin();
    if (!activeSession) return;

    setSaving(true);
    try {
      const created = await submitPlayerTag(tournamentId, playerId, text);
      setDraftTag("");
      if (created.status === "approved") {
        setTags((current) => mergeTag(current, created));
      }
      showToast(created.status === "approved" ? "标签已发布" : "标签已提交审核", "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "提交失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLike(tag: PlayerTag) {
    const activeSession = await ensureLogin();
    if (!activeSession) return;

    const isLiked = likedTagIds.has(tag.id);
    setSaving(true);
    try {
      const updated = isLiked ? await unlikePlayerTag(tag.id) : await likePlayerTag(tag.id);
      const nextLiked = new Set(likedTagIds);
      if (isLiked) {
        nextLiked.delete(tag.id);
      } else {
        nextLiked.add(tag.id);
      }
      setLocalLikedTagIds(activeSession.user.id, nextLiked);
      setLikedTagIds(nextLiked);
      setTags((current) => mergeTag(current, updated));
      showToast(isLiked ? "已取消点赞" : "点赞 +1", "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "操作失败", "error");
    } finally {
      setSaving(false);
    }
  }

  const currentHistory = useMemo(() => profile?.tournamentHistory?.find((item) => item.isCurrent), [profile]);

  return (
    <PageShell loading={loading} error={error} routeKey="players">
      {profile ? (
        <>
          <View className="hero-panel">
            <View className="profile-head">
              <PlayerAvatar player={profile} size="large" />
              <View className="player-main">
                <Text className="brand-title">{profile.displayName}</Text>
                <Text className="brand-subtitle">{profile.currentTeam?.name ?? "暂未归队"} · {profile.accountId ?? "未绑定 account_id"}</Text>
              </View>
            </View>
          </View>

          <StatGrid
            items={[
              { label: "场次", value: formatInteger(profile.stats.totalMatches), hint: `${profile.stats.wins} 胜 ${profile.stats.losses} 负` },
              { label: "胜率", value: formatPercent(profile.stats.winRate), hint: "当前届次" },
              { label: "KDA", value: formatDecimal(profile.stats.kda), hint: `${formatDecimal(profile.stats.avgKills)}/${formatDecimal(profile.stats.avgDeaths)}/${formatDecimal(profile.stats.avgAssists)}` },
              { label: "GPM", value: formatDecimal(profile.stats.avgGpm, 0), hint: "场均" },
              { label: "XPM", value: formatDecimal(profile.stats.avgXpm, 0), hint: "场均" },
              { label: "伤害", value: formatDecimal(profile.stats.avgHeroDamage, 0), hint: "英雄伤害" },
            ]}
          />

          <SectionTitle kicker="应援标签" title="给选手贴标签" />
          <View className="tag-editor">
            <Text className="muted">{session ? `当前登录：${session.user.nickname}` : "登录微信小程序后可提交标签和真实点赞。"}</Text>
            <View className="tag-input-row">
              <Input className="tag-input" value={draftTag} maxlength={16} placeholder="输入 2-16 字短标签" onInput={(event) => setDraftTag(String(event.detail.value))} />
              <Button className="primary-button" loading={saving} onClick={session ? handleSubmitTag : () => void ensureLogin()}>
                {session ? "提交" : "登录"}
              </Button>
            </View>
          </View>

          <View className="tag-cloud">
            {tags.map((tag) => {
              const liked = likedTagIds.has(tag.id);
              return (
                <Button
                  key={tag.id}
                  className={`tag-pill ${liked ? "tag-pill-liked" : ""}`}
                  disabled={saving}
                  onClick={() => void handleToggleLike(tag)}
                >
                  {tag.text} +{tag.likeCount}
                </Button>
              );
            })}
          </View>
          {tags.length === 0 ? <View className="content-panel"><Text className="muted">暂无已审核标签，提交后需管理员通过才会公开展示。</Text></View> : null}

          <SectionTitle kicker="当前届次" title="近期比赛" />
          {(currentHistory?.matches ?? profile.matches).slice(0, 8).map((match) => (
            <View className="content-panel history-item" key={match.matchId} onClick={() => navigate(`/pages/match-detail/index?matchId=${match.matchId}`)}>
              <View>
                <Text className="record-title">{match.radiantTeamName} vs {match.direTeamName}</Text>
                <Text className="history-text">{formatDate(match.startTime)} · KDA {match.kills ?? "-"}/{match.deaths ?? "-"}/{match.assists ?? "-"}</Text>
              </View>
              <Text className="status-text">{match.result === "win" ? "胜" : match.result === "loss" ? "负" : "未知"}</Text>
            </View>
          ))}

          <SectionTitle kicker="跨届" title="参赛历史" />
          {profile.tournamentHistory.map((entry) => (
            <View className="content-panel history-item" key={entry.tournamentId}>
              <View>
                <Text className="record-title">{entry.tournamentName}</Text>
                <Text className="history-text">{formatDate(entry.startsAt)} · {entry.stats.totalMatches} 场 · 胜率 {formatPercent(entry.stats.winRate)}</Text>
              </View>
              <Text className="badge">{entry.isCurrent ? "当前" : "往届"}</Text>
            </View>
          ))}
        </>
      ) : null}
    </PageShell>
  );
}

function mergeTag(tags: PlayerTag[], updated: PlayerTag): PlayerTag[] {
  const next = tags.some((tag) => tag.id === updated.id) ? tags.map((tag) => (tag.id === updated.id ? updated : tag)) : [updated, ...tags];
  return next
    .filter((tag) => tag.status === "approved")
    .sort((left, right) => right.likeCount - left.likeCount || left.createdAt.localeCompare(right.createdAt));
}
