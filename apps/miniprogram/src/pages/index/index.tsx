import { Button, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import {
  ensureTournamentId,
  loadAcknowledgements,
  loadTournamentMatches,
  loadTournaments,
  setSelectedTournamentId,
} from "../../api";
import { pageCacheKey, readPageCache, writePageCache } from "../../cache";
import { PageShell } from "../../components";
import { SmartImage as Image } from "../../SmartImage";
import type { AcknowledgementItem, MatchRecord, TournamentOption } from "../../types";
import { formatDate, labelStatus, switchTab } from "../../utils";

type HomeCache = {
  acknowledgements: AcknowledgementItem[];
  recentRecordsByTournament: Record<string, MatchRecord[]>;
  selectedTournamentId: string;
  tournaments: TournamentOption[];
};

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acknowledgements, setAcknowledgements] = useState<AcknowledgementItem[]>([]);
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
      setAcknowledgements(cached.acknowledgements ?? []);
      setTournaments(cached.tournaments);
      setSelectedId(cached.selectedTournamentId);
      setRecentRecordsByTournament(cached.recentRecordsByTournament);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [allTournaments, acknowledgementItems] = await Promise.all([
        loadTournaments(),
        loadAcknowledgements().catch(() => []),
      ]);
      const targetId = nextTournamentId || (await ensureTournamentId(allTournaments)) || "";

      if (targetId.length === 0) {
        setAcknowledgements(acknowledgementItems);
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
        acknowledgements: acknowledgementItems,
        recentRecordsByTournament: Object.fromEntries(recentEntries),
        selectedTournamentId: targetId,
        tournaments: allTournaments,
      };

      setAcknowledgements(snapshot.acknowledgements);
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
          <View className="home-brand-core">
            <Text className="home-brand-season">COMMUNITY LEAGUE</Text>
            <Text className="home-brand-name">每日节奏杯</Text>
            <Text className="home-brand-sub">DRAFT · FIGHT · RECORD</Text>
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
          <AcknowledgementsPanel items={acknowledgements} />
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

function AcknowledgementsPanel({ items = [] }: { items?: AcknowledgementItem[] }) {
  const sponsors = items.filter((item) => item.category === "sponsor");
  const supporters = items.filter((item) => item.category === "community");
  const sponsorGridClassName = sponsors.length >= 3 ? "home-major-sponsors is-compact" : "home-major-sponsors";

  if (sponsors.length === 0 && supporters.length === 0) {
    return null;
  }

  return (
    <View className="home-sponsor-panel">
      <View className="home-sponsor-heading">
        <Text>鸣谢名单</Text>
      </View>
      {sponsors.length > 0 ? (
        <View className="home-sponsor-section">
          <View className="home-sponsor-section-title">
            <Text>赞助商</Text>
            <Text>SPONSORS</Text>
          </View>
          <View className={sponsorGridClassName}>
            {sponsors.map((sponsor) => (
              <View className="home-major-sponsor" key={sponsor.id}>
                {sponsor.imageUrl ? <Image src={sponsor.imageUrl} mode="aspectFit" /> : null}
                <Text>{sponsor.displayName}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {supporters.length > 0 ? (
        <View className="home-sponsor-section">
          <View className="home-sponsor-section-title">
            <Text>社区支持</Text>
            <Text>COMMUNITY</Text>
          </View>
          <View className="home-community-supporters">
            {supporters.map((supporter) => (
              <View className="home-community-supporter" key={supporter.id}>
                {supporter.imageUrl ? (
                  <View className="home-community-avatar">
                    <Image className="home-community-avatar-image" src={supporter.imageUrl} mode="aspectFill" />
                  </View>
                ) : (
                  <View className="home-community-avatar fallback">
                    <Text>{supporter.displayName.slice(0, 1).toUpperCase() || "?"}</Text>
                  </View>
                )}
                <Text>{supporter.displayName}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatLatestRecord(record?: MatchRecord): string {
  if (!record) {
    return "--";
  }

  const score = record.radiantScore === null || record.direScore === null ? "暂无赛果" : `${record.radiantScore}:${record.direScore}`;
  return `${record.radiantTeamName} ${score} ${record.direTeamName}`;
}
