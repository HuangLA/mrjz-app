import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import {
  ensureTournamentId,
  loadTournamentMatches,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell } from "../../components";
import type { MatchRecord, TournamentOption } from "../../types";
import { formatDate, labelStatus, navigate, switchTab } from "../../utils";

type HomeCache = {
  recentRecordsByTournament: Record<string, MatchRecord[]>;
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedId] = useState("");
  const [recentRecordsByTournament, setRecentRecordsByTournament] = useState<Record<string, MatchRecord[]>>({});

  useDidShow(() => {
    void refresh();
  });

  async function refresh(nextTournamentId?: string) {
    const cacheKey = pageCacheKey("home");
    const cached = nextTournamentId ? null : readPageCache<HomeCache>(cacheKey);

    if (cached) {
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setRecentRecordsByTournament(cached.recentRecordsByTournament);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const allTournaments = await loadTournaments();
      const targetId = nextTournamentId || (await ensureTournamentId(allTournaments)) || "";

      if (targetId.length === 0) {
        setTournaments(allTournaments);
        setSelectedId("");
        setRecentRecordsByTournament({});
        return;
      }

      setSelectedTournamentId(targetId);
      const recentEntries: Array<readonly [string, MatchRecord[]]> = [];

      for (const tournament of allTournaments) {
        try {
          recentEntries.push([tournament.id, await loadTournamentMatches(tournament.id, 3)] as const);
        } catch {
          recentEntries.push([tournament.id, []] as const);
        }
      }
      const snapshot = {
        recentRecordsByTournament: Object.fromEntries(recentEntries),
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setTournaments(snapshot.tournaments);
      setSelectedId(snapshot.selectedTournamentId);
      setRecentRecordsByTournament(snapshot.recentRecordsByTournament);
      writePageCache(cacheKey, snapshot);
    } catch (caught) {
      if (!cached) {
        setError(caught instanceof Error ? caught.message : "赛事数据读取失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function enterTournament(tournamentId: string) {
    setSelectedTournamentId(tournamentId);
    setSelectedId(tournamentId);
    switchTab("/pages/stage/index");
  }

  const recordCount = Object.values(recentRecordsByTournament).reduce((sum, tournamentRecords) => sum + tournamentRecords.length, 0);

  return (
    <PageShell loading={loading} error={error} routeKey="home">
      <View className="home-hero">
        <View className="home-hero-content">
          <View className="home-hero-kicker">
            <Text>MRJZ</Text>
            <View />
            <Text>DOTA 2</Text>
          </View>
          <View className="home-brand-core">
            <Text className="home-brand-season">COMMUNITY LEAGUE</Text>
            <Text className="home-brand-name">每日节奏杯</Text>
            <Text className="home-brand-sub">DRAFT · FIGHT · RECORD</Text>
          </View>
          <View className="home-quick-actions">
            <Button onClick={() => navigate("/pages/stage/index")}>阶段</Button>
            <Button onClick={() => switchTab("/pages/records/index")}>记录</Button>
            <Button onClick={() => switchTab("/pages/players/index")}>选手</Button>
          </View>
        </View>
        <View className="home-hero-stats">
          <View>
            <Text>届次</Text>
            <Text>{String(tournaments.length)}</Text>
          </View>
          <View>
            <Text>比赛</Text>
            <Text>{String(recordCount)}</Text>
          </View>
          <View>
            <Text>战场</Text>
            <Text>DOTA2</Text>
          </View>
        </View>
      </View>

      <View className="tournament-entry-list">
        {tournaments.map((tournament) => (
          <View className={`tournament-entry ${tournament.id === selectedTournamentId ? "active" : ""}`} key={tournament.id}>
            <Button className="tournament-entry-main" onClick={() => enterTournament(tournament.id)}>
              <View>
                <Text className="tournament-entry-title">{tournament.name}</Text>
                <Text className="tournament-entry-meta">
                  {labelStatus(tournament.status)} · {formatDate(tournament.startsAt)}
                </Text>
              </View>
              <View className="tournament-entry-action">
                <Text>{tournament.id === selectedTournamentId ? "当前" : "进入"}</Text>
                <Text>{formatLatestRecord(recentRecordsByTournament[tournament.id]?.[0])}</Text>
              </View>
            </Button>
          </View>
        ))}
      </View>

    </PageShell>
  );
}

function formatLatestRecord(record?: MatchRecord): string {
  if (!record) {
    return "--";
  }

  const score = record.radiantScore === null || record.direScore === null ? "暂无赛果" : `${record.radiantScore}:${record.direScore}`;
  return `${record.radiantTeamName} ${score} ${record.direTeamName}`;
}
