import { Button, Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow, usePullDownRefresh, useRouter } from "@tarojs/taro";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  getLocalLikedTagIds,
  getStoredAuthSession,
  likePlayerTag,
  loadPlayerProfile,
  loadPlayerTags,
  loadTournamentPlayers,
  loadTournaments,
  normalizePlayerProfile,
  setLocalLikedTagIds,
  submitPlayerTag,
  unlikePlayerTag,
} from "../../api";
import { isPageCacheFresh, pageCacheKey, readPageCache, writePageCache } from "../../cache";
import {
  MatchRecordCard,
  PageShell,
  PlayerTeamMark,
  SectionTitle,
  SteamAvatar,
  TournamentScope,
} from "../../components";
import { heroIcon, heroLabel, heroPortrait } from "../../dota";
import { miniProgramSharePath, useMiniProgramShare } from "../../share";
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
import {
  formatDate,
  formatDecimal,
  formatInteger,
  formatPercent,
  navigate,
  showToast,
} from "../../utils";

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
  const tournamentId = decodeRouteParam(router.params.tournamentId);
  const playerId = decodeRouteParam(router.params.playerId);
  const fromTeamId = decodeRouteParam(router.params.fromTeamId);
  const accountId = parseAccountId(router.params.accountId);
  const [initialCache] = useState(() =>
    tournamentId && playerId
      ? sanitizePlayerDetailCache(
          readPageCache<PlayerDetailCache>(pageCacheKey("player-detail", tournamentId, playerId)),
        )
      : null,
  );
  const [loading, setLoading] = useState(initialCache === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(() => initialCache?.profile ?? null);
  const [tags, setTags] = useState<PlayerTag[]>(() => initialCache?.tags ?? []);
  const [tournaments, setTournaments] = useState<TournamentOption[]>(
    () => initialCache?.tournaments ?? [],
  );
  const [draftTag, setDraftTag] = useState("");
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(
    () => new Set(initialCache?.profile ? [initialCache.profile.tournamentId] : []),
  );
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [likedTagIds, setLikedTagIds] = useState<Set<string>>(() => {
    const storedSession = getStoredAuthSession();
    return storedSession ? getLocalLikedTagIds(storedSession.user.id) : new Set();
  });

  useMiniProgramShare(() => ({
    title: playerDetailShareTitle(profile),
    path: miniProgramSharePath("/pages/player-detail/index", {
      tournamentId,
      playerId,
      accountId,
    }),
  }));

  useDidShow(() => {
    setSession(getStoredAuthSession());
    void refresh();
  });

  usePullDownRefresh(() => {
    void refresh({ force: true }).finally(() => {
      void Taro.stopPullDownRefresh();
    });
  });

  async function refresh(options?: { force?: boolean }) {
    if (!tournamentId || !playerId) {
      setError("缺少选手参数");
      setLoading(false);
      return;
    }

    const cacheKey = pageCacheKey("player-detail", tournamentId, playerId);
    const cached = sanitizePlayerDetailCache(readPageCache<PlayerDetailCache>(cacheKey));

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

    if (!options?.force && cached && isPageCacheFresh(cacheKey)) {
      return;
    }

    try {
      const [nextProfile, nextTournaments] = await Promise.all([
        loadPlayerProfileWithFallback(tournamentId, playerId, accountId),
        loadTournaments(),
      ]);
      const nextTags = await loadSafePlayerTags(tournamentId, nextProfile.id || playerId);

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

  async function handleSubmitTag() {
    const activeSession = getStoredAuthSession();

    if (!activeSession) {
      showToast("请先到我的页面登录", "error");
      return;
    }

    setSession(activeSession);

    const text = draftTag.trim();

    if (text.length === 0) {
      showToast("请输入标签");
      return;
    }

    setSaving(true);
    try {
      const activePlayerId = profile?.id || playerId;
      const created = await submitPlayerTag(tournamentId, activePlayerId, text);
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
    const activeSession = getStoredAuthSession();

    if (!activeSession) {
      showToast("请先到我的页面登录", "error");
      return;
    }

    setSession(activeSession);

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

  function writePlayerDetailCache(
    nextProfile: PlayerProfile | null,
    nextTags: PlayerTag[],
    nextTournaments: TournamentOption[],
  ): void {
    if (!nextProfile) {
      return;
    }

    writePageCache(pageCacheKey("player-detail", tournamentId, playerId), {
      profile: nextProfile,
      tags: nextTags,
      tournaments: nextTournaments,
    });
  }

  const team = profile ? primaryPlayerTeam(profile) : null;
  const backTournamentId = profile?.tournamentId || tournamentId;
  const backTeamId = profile ? resolveBackTeamId(profile, fromTeamId) : fromTeamId;

  return (
    <PageShell
      backUrl={
        backTeamId
          ? `/pages/team-detail/index?tournamentId=${encodeURIComponent(backTournamentId)}&teamId=${encodeURIComponent(backTeamId)}`
          : undefined
      }
      loading={loading}
      error={error}
      routeKey="players"
    >
      {profile ? (
        <>
          <TournamentScope
            tournament={tournaments.find((tournament) => tournament.id === tournamentId)}
          />

          <View
            className="profile-hero player-profile"
            style={profileAccentStyle(team?.color ?? "#5eead4")}
          >
            <View className="profile-hero-main">
              <SteamAvatar player={profile} size="large" />
              <View>
                <View className="profile-name-row">
                  <Text className="brand-title">{profile.displayName}</Text>
                  <PlayerTeamMark team={team} />
                </View>
                <Text className="brand-subtitle">
                  {team?.name ?? "暂未归队"} · Account {profile.accountId ?? "-"}
                </Text>
              </View>
            </View>
            <View className="profile-winrate">
              <Text>本届胜率</Text>
              <Text>{formatPercent(profile.stats.winRate)}</Text>
              <Text>
                {profile.stats.wins}W / {profile.stats.losses}L
              </Text>
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
                {tags.map((tag, index) => {
                  const liked = likedTagIds.has(tag.id);
                  const sizeLevel = tagSizeLevel(tag.sizeLevel);
                  const layoutIndex = tagLayoutIndex(tag, index);

                  return (
                    <Button
                      key={tag.id}
                      className={`tag-pill tag-pill-level-${sizeLevel} tag-pill-layout-${layoutIndex} ${
                        liked ? "tag-pill-liked" : ""
                      }`}
                      disabled={saving}
                      onClick={() => void handleToggleLike(tag)}
                    >
                      <Text className="tag-pill-text">{tag.text}</Text>
                    </Button>
                  );
                })}
              </View>
            ) : (
              <View className="profile-tag-empty">
                <Text className="muted">暂无已审核标签，提交后需管理员通过才会公开展示。</Text>
              </View>
            )}
            <View className="tag-editor-inline">
              <Text className="muted">
                {session
                  ? `当前登录：${session.user.nickname}`
                  : "想给选手贴标签或点赞？请先到“我的”页面完成登录。"}
              </Text>
              {session ? (
                <View className="tag-input-row">
                  <Input
                    className="tag-input"
                    value={draftTag}
                    maxlength={24}
                    placeholder="输入 2-24 字标签"
                    onInput={(event) => setDraftTag(String(event.detail.value))}
                  />
                  <Button
                    className="primary-button"
                    loading={saving}
                    onClick={() => void handleSubmitTag()}
                  >
                    提交
                  </Button>
                </View>
              ) : null}
            </View>
          </View>

          <ProfileStatGrid
            items={[
              { label: "场次", value: formatInteger(profile.stats.totalMatches) },
              { label: "胜率", value: formatPercent(profile.stats.winRate) },
              { label: "KDA", value: formatDecimal(profile.stats.kda, 2) },
              {
                label: "场均K/D/A",
                value: `${formatDecimal(profile.stats.avgKills)}/${formatDecimal(profile.stats.avgDeaths)}/${formatDecimal(profile.stats.avgAssists)}`,
              },
              { label: "GPM", value: formatDecimal(profile.stats.avgGpm, 0) },
              { label: "XPM", value: formatDecimal(profile.stats.avgXpm, 0) },
              { label: "场均经济", value: formatCompact(profile.stats.avgNetWorth) },
              { label: "场均伤害", value: formatCompact(profile.stats.avgHeroDamage) },
              { label: "建筑伤害", value: formatCompact(profile.stats.avgTowerDamage) },
              { label: "场均承伤", value: formatCompact(profile.stats.avgDamageTaken) },
            ]}
          />

          <SignatureHeroes heroes={profile.stats.topHeroes} />

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

function playerDetailShareTitle(profile: PlayerProfile | null): string {
  return profile?.displayName
    ? `${profile.displayName}｜每日节奏杯选手主页`
    : "每日节奏杯选手主页";
}

function primaryPlayerTeam(profile: PlayerProfile) {
  const teams = Array.isArray(profile.teams) ? profile.teams : [];

  return profile.currentTeam ?? teams[0] ?? null;
}

async function loadPlayerProfileWithFallback(
  tournamentId: string,
  playerId: string,
  accountId: number | null,
): Promise<PlayerProfile> {
  try {
    return await loadPlayerProfile(tournamentId, playerId);
  } catch (caught) {
    if (accountId === null) {
      throw caught;
    }

    const players = await loadTournamentPlayers(tournamentId);
    const resolved = players.find((player) => player.accountId === accountId);

    if (!resolved) {
      throw caught;
    }

    return loadPlayerProfile(tournamentId, resolved.id);
  }
}

async function loadSafePlayerTags(tournamentId: string, playerId: string): Promise<PlayerTag[]> {
  try {
    return await loadPlayerTags(tournamentId, playerId);
  } catch {
    return [];
  }
}

function resolveBackTeamId(profile: PlayerProfile, fromTeamId: string): string {
  const teams = Array.isArray(profile.teams) ? profile.teams : [];

  if (fromTeamId && teams.some((team) => team.id === fromTeamId)) {
    return fromTeamId;
  }

  return profile.currentTeam?.id ?? teams[0]?.id ?? fromTeamId;
}

function parseAccountId(value: unknown): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const accountId = Number(String(rawValue ?? "").trim());

  return Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null;
}

function decodeRouteParam(value: unknown): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const text = String(rawValue ?? "").trim();

  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
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
                <Text>
                  {hero.picks} 场 · {hero.wins} 胜 · {formatHeroWinRate(hero.wins, hero.picks)}
                </Text>
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
  const totalMatches =
    props.profile.tournamentHistory.reduce((sum, entry) => sum + entry.matches.length, 0) ||
    props.profile.matches.length;

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
              <View
                className={`season-details ${isOpen ? "is-open" : ""}`}
                key={entry.tournamentId}
              >
                <Button
                  className="season-toggle"
                  onClick={() => props.onToggleHistory(entry.tournamentId)}
                >
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

function ProfileMatchCards(props: {
  matches: ProfileMatchSummary[];
  tournamentId: string;
  tournamentName: string;
}) {
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

function profileMatchToRecord(
  match: ProfileMatchSummary,
  tournamentId: string,
  tournamentName: string,
): MatchRecord {
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

function profileMatchHeroLineups(
  match: ProfileMatchSummary,
): NonNullable<MatchRecord["heroLineups"]> {
  const heroLineups = {
    radiant: normalizeProfileHeroLineup(match.heroLineups?.radiant),
    dire: normalizeProfileHeroLineup(match.heroLineups?.dire),
  };

  if (
    heroLineups.radiant.length > 0 ||
    heroLineups.dire.length > 0 ||
    match.heroId === null ||
    match.side === null
  ) {
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

function normalizeProfileHeroLineup(
  lineup: ProfileHeroLineupItem[] | undefined,
): MatchRecordHero[] {
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

function tagSizeLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function tagLayoutIndex(tag: PlayerTag, index: number): number {
  const seed = `${tag.id}:${tag.text}:${index}`;
  let hash = 0;

  for (let charIndex = 0; charIndex < seed.length; charIndex += 1) {
    hash = (hash * 31 + seed.charCodeAt(charIndex)) % 9973;
  }

  return (hash % 8) + 1;
}

function profileAccentStyle(accent: string): CSSProperties {
  return {
    borderColor: hexToRgba(accent, 0.42),
    background: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)}, rgba(12, 17, 26, 0.74)), rgba(17, 24, 37, 0.92)`,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.trim().replace(/^#/, "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
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
  const next = tags.some((tag) => tag.id === updated.id)
    ? tags.map((tag) => (tag.id === updated.id ? updated : tag))
    : [updated, ...tags];
  return next
    .filter((tag) => tag.status === "approved")
    .sort(
      (left, right) =>
        right.likeCount - left.likeCount || left.createdAt.localeCompare(right.createdAt),
    );
}

function sanitizePlayerDetailCache(
  cache: PlayerDetailCache | null,
): PlayerDetailCache | null {
  if (!cache?.profile) {
    return null;
  }

  return {
    profile: normalizePlayerProfile(cache.profile),
    tags: Array.isArray(cache.tags) ? cache.tags : [],
    tournaments: Array.isArray(cache.tournaments) ? cache.tournaments : [],
  };
}
