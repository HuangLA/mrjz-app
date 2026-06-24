import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { ensureTournamentId, getSelectedTournamentId, loadHeroLeaderboards, loadTournaments, setSelectedTournamentId } from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell, SteamAvatar, TournamentScope } from "../../components";
import type { HeroLeaderboardCandidate, HeroLeaderboardItem, HeroLeaderboardsView, TournamentOption } from "../../types";
import { formatDecimal, formatInteger, navigate } from "../../utils";

type HeroLeaderboardCache = {
  leaderboards: HeroLeaderboardsView;
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

export default function HeroLeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [leaderboards, setLeaderboards] = useState<HeroLeaderboardsView>(emptyHeroLeaderboards());

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    const cacheKey = pageCacheKey("hero-leaderboard", nextTournamentId ?? (getSelectedTournamentId() || "auto"));
    const cached = readPageCache<HeroLeaderboardCache>(cacheKey);

    if (cached) {
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setLeaderboards(cached.leaderboards);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId(allTournaments)) || "";
      const nextLeaderboards = targetId ? await loadHeroLeaderboards(targetId) : emptyHeroLeaderboards();

      if (targetId) {
        setSelectedTournamentId(targetId);
      }

      const snapshot = {
        leaderboards: nextLeaderboards,
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setLeaderboards(snapshot.leaderboards);
      writePageCache(pageCacheKey("hero-leaderboard", targetId || "auto"), snapshot);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "英雄榜读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleBoard(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  return (
    <PageShell loading={loading} error={error} routeKey="leaderboard">
      <TournamentScope tournament={tournaments.find((tournament) => tournament.id === selectedTournamentId)} />
      <View className="section-panel hero-leaderboard-panel">
        <View className="section-title compact">
          <View>
            <Text className="section-heading">英雄榜</Text>
            <Text className="section-subtitle">只统计 {leaderboards.minMatches} 场以上选手 · 按称号口径排名</Text>
          </View>
          <Text className="sync-pill">{leaderboards.leaderboards.length} 榜</Text>
        </View>
        <View className="hero-leaderboard-list">
          {leaderboards.leaderboards.map((board) => (
            <HeroLeaderboardCard
              board={board}
              expanded={expandedKeys.has(board.key)}
              key={board.key}
              onOpenPlayer={(playerId) => navigate(`/pages/player-detail/index?tournamentId=${selectedTournamentId}&playerId=${playerId}`)}
              onToggle={() => toggleBoard(board.key)}
            />
          ))}
        </View>
        {leaderboards.leaderboards.length === 0 ? (
          <View className="content-panel">
            <Text className="muted">暂无满足 5 场门槛的英雄榜数据</Text>
          </View>
        ) : null}
      </View>
    </PageShell>
  );
}

function HeroLeaderboardCard(props: {
  board: HeroLeaderboardItem;
  expanded: boolean;
  onOpenPlayer: (playerId: string) => void;
  onToggle: () => void;
}) {
  const winner = props.board.winner;

  return (
    <View className={`hero-leaderboard-card ${props.expanded ? "expanded" : ""}`}>
      <Button className="hero-leaderboard-main" onClick={props.onToggle}>
        <View className="hero-leaderboard-main-top">
          <View className="hero-leaderboard-title">
            <Text>{props.board.title}</Text>
            <Text>{props.board.description}</Text>
          </View>
          <View className="hero-leaderboard-actions">
            <View className="hero-leaderboard-value">
              <Text>{winner ? formatLeaderboardValue(winner.average, props.board) : "-"}</Text>
              <Text>{props.board.metricLabel}</Text>
            </View>
            <View className="hero-leaderboard-toggle">
              <Text>{props.expanded ? "收起" : "前五"}</Text>
              <Text className={`hero-leaderboard-toggle-icon ${props.expanded ? "expanded" : ""}`} />
            </View>
          </View>
        </View>
        {winner ? (
          <View className="hero-leaderboard-winner">
            <SteamAvatar player={winner.player} size="small" />
            <View className="hero-leaderboard-identity">
              <Text className="hero-leaderboard-player-name">{winner.player.displayName}</Text>
              <Text className="hero-leaderboard-team-name">{leaderboardTeamName(winner)}</Text>
            </View>
          </View>
        ) : (
          <Text className="hero-leaderboard-empty">暂无获得者</Text>
        )}
      </Button>
      {props.expanded ? (
        <View className="hero-leaderboard-candidates">
          {props.board.candidates.map((candidate) => (
            <Button
              className="hero-leaderboard-row"
              key={`${props.board.key}-${candidate.player.id}`}
              onClick={() => props.onOpenPlayer(candidate.player.id)}
            >
              <Text className="hero-leaderboard-rank">#{candidate.rank}</Text>
              <SteamAvatar player={candidate.player} size="small" />
              <View className="hero-leaderboard-name">
                <Text className="hero-leaderboard-player-name">{candidate.player.displayName}</Text>
                <Text className="hero-leaderboard-team-name">{leaderboardTeamName(candidate)} · {formatInteger(candidate.matches)} 场</Text>
              </View>
              <View className="hero-leaderboard-row-value">
                <Text>{formatLeaderboardValue(candidate.average, props.board)}</Text>
                <Text>总计 {formatLeaderboardTotal(candidate.total, props.board)}</Text>
              </View>
            </Button>
          ))}
          {props.board.candidates.length === 0 ? (
            <View className="content-panel">
              <Text className="muted">暂无满足 {props.board.minMatches} 场门槛的数据</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function leaderboardTeamName(candidate: HeroLeaderboardCandidate): string {
  const team = candidate.player.currentTeam ?? candidate.player.teams[0] ?? candidate.teams[0] ?? null;

  return team?.name || team?.shortName || "自由人";
}

function formatLeaderboardValue(value: number, board: Pick<HeroLeaderboardItem, "precision" | "unit">): string {
  const normalized = Math.abs(value) >= 1000 ? compactNumber(value) : formatDecimal(value, board.precision).replace(/\.0$/, "");

  return board.unit ? `${normalized}${board.unit}` : normalized;
}

function formatLeaderboardTotal(value: number, board: Pick<HeroLeaderboardItem, "precision" | "unit">): string {
  const normalized = Math.abs(value) >= 1000 ? compactNumber(value) : formatDecimal(value, Math.min(board.precision, 1)).replace(/\.0$/, "");

  return board.unit ? `${normalized}${board.unit}` : normalized;
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1000) {
    return `${(value / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  }

  return formatInteger(value);
}

function emptyHeroLeaderboards(): HeroLeaderboardsView {
  return {
    tournamentId: "",
    tournamentName: "",
    basis: "per_match",
    minMatches: 5,
    leaderboards: [],
  };
}
