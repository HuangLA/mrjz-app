import { Button, Input, Text, View } from "@tarojs/components";
import { useDidShow, useRouter } from "@tarojs/taro";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  getLocalLikedTagIds,
  getStoredAuthSession,
  likePlayerTag,
  loadPlayerProfile,
  loadPlayerTags,
  loadTournaments,
  loginWithWeChat,
  setLocalLikedTagIds,
  submitPlayerTag,
  unlikePlayerTag,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { MatchRecordCard, PageShell, PlayerTeamMark, SectionTitle, SteamAvatar, TournamentScope } from "../../components";
import { heroIcon, heroLabel, heroPortrait } from "../../dota";
import { SmartImage as Image } from "../../SmartImage";
import type {
  AuthSession,
  MatchRecord,
  MatchRecordHero,
  PlayerProfile,
  PlayerTag,
  PlayerTournamentHistoryEntry,
  ProfileMatchSummary,
  TournamentOption,
} from "../../types";
import { formatDate, formatDecimal, formatInteger, formatPercent, navigate, showToast } from "../../utils";

type ProfileHeroLineupItem = Partial<MatchRecordHero> & {
  heroId?: number;
  playerName?: string | null;
  playerSlot?: number;
};

type PlayerDetailCache = {
  profile: PlayerProfile;
  tags: PlayerTag[];
  tournaments: TournamentOption[];
};

export default function PlayerDetailPage() {
  const router = useRouter();
  const tournamentId = String(router.params.tournamentId ?? "");
  const playerId = String(router.params.playerId ?? "");
  const fromTeamId = String(router.params.fromTeamId ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [tags, setTags] = useState<PlayerTag[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(() => new Set());
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

    const cacheKey = pageCacheKey("player-detail", tournamentId, playerId);
    const cached = readPageCache<PlayerDetailCache>(cacheKey);

    if (cached) {
      setProfile(cached.profile);
      setTags(cached.tags);
      setTournaments(cached.tournaments);
      setExpandedHistoryIds(new Set([cached.profile.tournamentId]));
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    if (cached && isPageCacheFresh(cacheKey)) {
      return;
    }

    try {
      const [nextProfile, nextTags, nextTournaments] = await Promise.all([
        loadPlayerProfile(tournamentId, playerId),
        loadPlayerTags(tournamentId, playerId),
        loadTournaments(),
      ]);
      setProfile(nextProfile);
      setTags(nextTags);
      setTournaments(nextTournaments);
      writePlayerDetailCache(nextProfile, nextTags, nextTournaments);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "选手主页读取失败");
      }
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
        setTags((current) => {
          const nextTags = mergeTag(current, created);

          writePlayerDetailCache(profile, nextTags, tournaments);
          return nextTags;
        });
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
      setTags((current) => {
        const nextTags = mergeTag(current, updated);

        writePlayerDetailCache(profile, nextTags, tournaments);
        return nextTags;
      });
      showToast(isLiked ? "已取消点赞" : "点赞 +1", "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "操作失败", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleHistory(tournamentHistoryId: string) {
    setExpandedHistoryIds((current) => {
      const next = new Set(current);

      if (next.has(tournamentHistoryId)) {
        next.delete(tournamentHistoryId);
      } else {
        next.add(tournamentHistoryId);
      }

      return next;
    });
  }

  function writePlayerDetailCache(nextProfile: PlayerProfile | null, nextTags: PlayerTag[], nextTournaments: TournamentOption[]): void {
    if (!nextProfile) {
      return;
    }

    writePageCache(pageCacheKey("player-detail", tournamentId, playerId), {
      profile: nextProfile,
      tags: nextTags,
      tournaments: nextTournaments,
    });
  }

  return (
    <PageShell
      backUrl={fromTeamId ? `/pages/team-detail/index?tournamentId=${encodeURIComponent(tournamentId)}&teamId=${encodeURIComponent(fromTeamId)}` : undefined}
      loading={loading}
      error={error}
      routeKey="players"
    >
      {profile ? (
        <>
          <TournamentScope tournament={tournaments.find((tournament) => tournament.id === tournamentId)} />

          <View className="profile-hero player-profile" style={profileAccentStyle(profile.currentTeam?.color ?? profile.teams[0]?.color ?? "#5eead4")}>
            <View className="profile-hero-main">
              <SteamAvatar player={profile} size="large" />
              <View>
                <View className="profile-name-row">
                  <Text className="brand-title">{profile.displayName}</Text>
                  <PlayerTeamMark team={profile.currentTeam ?? profile.teams[0] ?? null} />
                </View>
                <Text className="brand-subtitle">{profile.currentTeam?.name ?? "暂未归队"} · Account {profile.accountId ?? "-"}</Text>
              </View>
            </View>
            <View className="profile-winrate">
              <Text>本届胜率</Text>
              <Text>{formatPercent(profile.stats.winRate)}</Text>
              <Text>{profile.stats.wins}W / {profile.stats.losses}L</Text>
            </View>
          </View>

          <View className="section-panel profile-tag-panel-mini">
            <View className="section-title compact">
              <View>
                <Text className="section-heading">选手应援标签</Text>
              </View>
            </View>
            {tags.length > 0 ? (
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
                      {tag.text}
                    </Button>
                  );
                })}
              </View>
            ) : (
              <View className="profile-tag-empty">
                <Text className="muted">暂无已审核标签，提交后需管理员通过才会公开展示。</Text>
              </View>
            )}
          </View>

          <ProfileStatGrid
            items={[
              { label: "场次", value: formatInteger(profile.stats.totalMatches) },
              { label: "胜率", value: formatPercent(profile.stats.winRate) },
              { label: "KDA", value: formatDecimal(profile.stats.kda, 2) },
              { label: "场均K/D/A", value: `${formatDecimal(profile.stats.avgKills)}/${formatDecimal(profile.stats.avgDeaths)}/${formatDecimal(profile.stats.avgAssists)}` },
              { label: "GPM", value: formatDecimal(profile.stats.avgGpm, 0) },
              { label: "XPM", value: formatDecimal(profile.stats.avgXpm, 0) },
              { label: "场均经济", value: formatCompact(profile.stats.avgNetWorth) },
              { label: "场均伤害", value: formatCompact(profile.stats.avgHeroDamage) },
              { label: "建筑伤害", value: formatCompact(profile.stats.avgTowerDamage) },
              { label: "场均承伤", value: formatCompact(profile.stats.avgDamageTaken) },
            ]}
          />

          <SignatureHeroes heroes={profile.stats.topHeroes} />

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

          <PlayerTournamentHistory
            expandedHistoryIds={expandedHistoryIds}
            onToggleHistory={handleToggleHistory}
            profile={profile}
          />
        </>
      ) : null}
    </PageShell>
  );
}

function ProfileStatGrid(props: { items: Array<{ label: string; value: string }> }) {
  return (
    <View className="profile-stat-grid">
      {props.items.map((item) => (
        <View key={item.label}>
          <Text>{item.label}</Text>
          <Text>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SignatureHeroes(props: { heroes: PlayerProfile["stats"]["topHeroes"] }) {
  return (
    <View className="section-panel">
      <View className="section-title compact">
        <View>
          <Text className="section-heading">常用英雄</Text>
        </View>
      </View>
      <View className="signature-heroes">
        {props.heroes.length > 0 ? (
          props.heroes.map((hero) => (
            <View className="signature-hero" key={hero.heroId}>
              <Image mode="aspectFill" src={heroPortrait(hero.heroId)} />
              <View>
                <Text>{heroLabel(hero.heroId)}</Text>
                <Text>{hero.picks} 场 · {hero.wins} 胜 · {formatHeroWinRate(hero.wins, hero.picks)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View className="state-inline">
            <Text>暂无</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PlayerTournamentHistory(props: {
  expandedHistoryIds: Set<string>;
  onToggleHistory: (tournamentHistoryId: string) => void;
  profile: PlayerProfile;
}) {
  const currentEntry =
    props.profile.tournamentHistory.find((entry) => entry.isCurrent) ??
    ({
      tournamentId: props.profile.tournamentId,
      tournamentName: "本届赛事",
      startsAt: null,
      status: "",
      isCurrent: true,
      stats: props.profile.stats,
      matches: props.profile.matches,
    } satisfies PlayerTournamentHistoryEntry);
  const previousEntries = props.profile.tournamentHistory.filter((entry) => !entry.isCurrent);
  const totalMatches = props.profile.tournamentHistory.reduce((sum, entry) => sum + entry.matches.length, 0) || props.profile.matches.length;

  return (
    <View className="section-panel player-history-panel">
      <View className="section-title compact">
        <View>
          <Text className="section-heading">参赛记录</Text>
        </View>
        <Text className="sync-pill">{totalMatches} 场</Text>
      </View>

      <View className="player-season-current">
        <SeasonRecordHeader entry={currentEntry} label="本届" />
        <ProfileMatchCards
          matches={currentEntry.matches}
          tournamentId={currentEntry.tournamentId}
          tournamentName={currentEntry.tournamentName}
        />
      </View>

      {previousEntries.length > 0 ? (
        <View className="player-season-archive">
          <View className="season-archive-title">
            <Text>往届参赛</Text>
            <Text>{previousEntries.length} 届</Text>
          </View>
          {previousEntries.map((entry) => {
            const isOpen = props.expandedHistoryIds.has(entry.tournamentId);

            return (
              <View className={`season-details ${isOpen ? "is-open" : ""}`} key={entry.tournamentId}>
                <Button className="season-toggle" onClick={() => props.onToggleHistory(entry.tournamentId)}>
                  <SeasonRecordHeader entry={entry} />
                  <Text className="season-toggle-label">{isOpen ? "收起" : "展开"}</Text>
                </Button>
                {isOpen ? (
                  <View className="season-match-list">
                    <ProfileMatchCards
                      matches={entry.matches}
                      tournamentId={entry.tournamentId}
                      tournamentName={entry.tournamentName}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SeasonRecordHeader(props: { entry: PlayerTournamentHistoryEntry; label?: string }) {
  return (
    <View className="season-record-header">
      <View>
        <Text>{props.entry.tournamentName}</Text>
        <Text>{props.label ?? formatDate(props.entry.startsAt)}</Text>
      </View>
      <View className="season-record-metrics">
        <Text>{props.entry.matches.length} 场</Text>
        <Text>{formatPercent(props.entry.stats.winRate)}</Text>
      </View>
    </View>
  );
}

function ProfileMatchCards(props: { matches: ProfileMatchSummary[]; tournamentId: string; tournamentName: string }) {
  return (
    <View className="profile-record-list">
      {props.matches.length > 0 ? (
        props.matches.map((match, index) => (
          <MatchRecordCard
            index={index}
            key={match.matchId}
            onOpen={(matchId) => navigate(`/pages/match-detail/index?matchId=${matchId}`)}
            record={profileMatchToRecord(match, props.tournamentId, props.tournamentName)}
          />
        ))
      ) : (
        <View className="state-inline">
          <Text>暂无</Text>
        </View>
      )}
    </View>
  );
}

function profileMatchToRecord(match: ProfileMatchSummary, tournamentId: string, tournamentName: string): MatchRecord {
  const heroLineups = profileMatchHeroLineups(match);
  const playerCount = match.playerCount ?? heroLineups.radiant.length + heroLineups.dire.length;

  return {
    matchId: match.matchId,
    leagueName: "",
    tournamentId,
    tournamentName,
    parseStatus: "比赛记录",
    startTime: match.startTime,
    durationText: match.durationText ?? "--:--",
    radiantWin: deriveRadiantWin(match),
    radiantScore: match.radiantScore,
    direScore: match.direScore,
    radiantTeamName: match.radiantTeamName,
    direTeamName: match.direTeamName,
    playerCount,
    heroLineups,
    hasDraft: Boolean(match.hasDraft),
    hasVision: Boolean(match.hasVision),
    hasChat: Boolean(match.hasChat),
  };
}

function profileMatchHeroLineups(match: ProfileMatchSummary): NonNullable<MatchRecord["heroLineups"]> {
  const heroLineups = {
    radiant: normalizeProfileHeroLineup(match.heroLineups?.radiant),
    dire: normalizeProfileHeroLineup(match.heroLineups?.dire),
  };

  if (heroLineups.radiant.length > 0 || heroLineups.dire.length > 0 || match.heroId === null || match.side === null) {
    return heroLineups;
  }

  const profileHero = {
    playerSlot: match.side === "radiant" ? 0 : 128,
    heroId: match.heroId,
    hero: heroLabel(match.heroId),
    icon: heroIcon(match.heroId),
    portrait: heroPortrait(match.heroId),
    playerName: "该选手",
  };

  return {
    ...heroLineups,
    [match.side]: [profileHero],
  };
}

function normalizeProfileHeroLineup(lineup: ProfileHeroLineupItem[] | undefined): MatchRecordHero[] {
  return (lineup ?? [])
    .map((hero) => {
      if (typeof hero.heroId !== "number" || hero.heroId <= 0) {
        return null;
      }

      const name = heroLabel(hero.heroId);

      return {
        playerSlot: hero.playerSlot ?? 0,
        heroId: hero.heroId,
        hero: hero.hero || name,
        icon: hero.icon || heroIcon(hero.heroId),
        portrait: hero.portrait || heroPortrait(hero.heroId),
        playerName: hero.playerName?.trim() || name,
      };
    })
    .filter((hero): hero is MatchRecordHero => hero !== null)
    .sort((left, right) => left.playerSlot - right.playerSlot)
    .slice(0, 5);
}

function deriveRadiantWin(match: ProfileMatchSummary): boolean | null {
  if (match.radiantWin !== null) {
    return match.radiantWin;
  }

  if (match.side === null || match.result === "unknown") {
    return null;
  }

  return match.side === "radiant" ? match.result === "win" : match.result === "loss";
}

function formatHeroWinRate(wins: number, picks: number): string {
  if (!Number.isFinite(wins) || !Number.isFinite(picks) || picks <= 0) {
    return "-";
  }

  return `${((wins / picks) * 100).toFixed(0)}%`;
}

function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

function profileAccentStyle(accent: string): CSSProperties {
  return {
    borderColor: hexToRgba(accent, 0.42),
    background: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)}, rgba(12, 17, 26, 0.74)), rgba(17, 24, 37, 0.92)`,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.trim().replace(/^#/, "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  if (!/^[\da-fA-F]{6}$/.test(full)) {
    return `rgba(94, 234, 212, ${alpha})`;
  }

  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mergeTag(tags: PlayerTag[], updated: PlayerTag): PlayerTag[] {
  const next = tags.some((tag) => tag.id === updated.id) ? tags.map((tag) => (tag.id === updated.id ? updated : tag)) : [updated, ...tags];
  return next
    .filter((tag) => tag.status === "approved")
    .sort((left, right) => right.likeCount - left.likeCount || left.createdAt.localeCompare(right.createdAt));
}
