import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { OpenDotaMatchListItem } from "../api";
import { formatFullDateTime, toneForStatus } from "../app/format";
import { EmptyPanel, FilterTabs, SearchInput, SectionCard, StatusPill } from "../components/ui";
import type { AdminData } from "../app/store";

type ParseFilter = "all" | "parsed" | "requested" | "failed";
type LinkFilter = "all" | "linked" | "unlinked";

export function MatchesView({ data }: { data: AdminData }) {
  const [query, setQuery] = useState("");
  const [parseFilter, setParseFilter] = useState<ParseFilter>("all");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [limit, setLimit] = useState(100);

  const stats = useMemo(() => {
    const total = data.matches.length;
    const parsed = data.matches.filter((match) => match.parseStatus === "parsed").length;
    const requested = data.matches.filter((match) => match.parseStatus === "requested").length;
    const failed = data.matches.filter((match) => match.parseStatus === "failed").length;
    const linked = data.matches.filter((match) => match.linkedSeries !== null).length;
    return { total, parsed, requested, failed, linked };
  }, [data.matches]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = data.matches.filter((match) => {
    if (parseFilter !== "all" && match.parseStatus !== parseFilter) return false;
    if (linkFilter === "linked" && match.linkedSeries === null) return false;
    if (linkFilter === "unlinked" && match.linkedSeries !== null) return false;
    if (!normalizedQuery) return true;
    return [
      String(match.matchId),
      match.radiantTeamName,
      match.direTeamName,
      match.leagueName,
      match.linkedSeries ? `${match.linkedSeries.radiantTeam.name} ${match.linkedSeries.direTeam.name}` : "",
    ].join(" ").toLowerCase().includes(normalizedQuery);
  });
  const visible = filtered.slice(0, limit);
  const leagueId = data.detail?.league?.opendotaLeagueId ?? null;

  return (
    <div className="view-stack">
      <SectionCard
        title="比赛结果库"
        desc={leagueId ? `league_id ${leagueId} · OpenDota 同步的真实比赛记录` : "当前届次未配置 league_id，无法自动同步比赛记录。"}
        aside={
          <div className="tournament-metrics">
            <div><span>总数</span><strong>{stats.total}</strong></div>
            <div><span>已解析</span><strong>{stats.parsed}</strong></div>
            <div><span>待解析</span><strong>{stats.requested}</strong></div>
            <div><span>解析失败</span><strong>{stats.failed}</strong></div>
            <div><span>已关联对阵</span><strong>{stats.linked}</strong></div>
          </div>
        }
      >
        <div className="series-board-bar">
          <FilterTabs
            ariaLabel="解析状态筛选"
            value={parseFilter}
            onChange={(value) => setParseFilter(value as ParseFilter)}
            options={[
              { value: "all", label: "全部", count: stats.total },
              { value: "parsed", label: "已解析", count: stats.parsed },
              { value: "requested", label: "待解析", count: stats.requested },
              { value: "failed", label: "失败", count: stats.failed },
            ]}
          />
          <FilterTabs
            ariaLabel="关联状态筛选"
            value={linkFilter}
            onChange={(value) => setLinkFilter(value as LinkFilter)}
            options={[
              { value: "all", label: "全部关联", count: stats.total },
              { value: "linked", label: "已关联", count: stats.linked },
              { value: "unlinked", label: "未关联", count: stats.total - stats.linked },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="match_id 或队伍名" />
        </div>

        {visible.length === 0 ? (
          <EmptyPanel title="没有匹配的比赛记录" text={data.matches.length === 0 ? "同步 OpenDota 后，这里会展示真实比赛记录。" : "调整筛选条件后再查看。"} />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>match_id</th>
                  <th>时间</th>
                  <th>对阵</th>
                  <th>比分</th>
                  <th>时长</th>
                  <th>解析</th>
                  <th>关联对阵</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((match) => <MatchRow key={match.matchId} match={match} />)}
              </tbody>
            </table>
            {filtered.length > limit ? (
              <div className="table-more">
                <span className="muted">显示 {visible.length}/{filtered.length} 场</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit((current) => current + 200)}>再显示 200 场</button>
              </div>
            ) : null}
          </>
        )}
      </SectionCard>
    </div>
  );
}

function MatchRow({ match }: { match: OpenDotaMatchListItem }) {
  const scoreKnown = match.radiantScore !== null && match.direScore !== null;
  const winnerSide = match.radiantWin === null ? null : match.radiantWin ? "radiant" : "dire";
  return (
    <tr>
      <td>
        <a className="match-id-link" href={`https://www.opendota.com/matches/${match.matchId}`} target="_blank" rel="noreferrer" title="在 OpenDota 查看">
          {match.matchId} <ExternalLink size={11} />
        </a>
      </td>
      <td>{formatFullDateTime(match.startTime)}</td>
      <td>
        <span className={winnerSide === "radiant" ? "match-team is-winner" : "match-team"}>{match.radiantTeamName}</span>
        <span className="match-vs">vs</span>
        <span className={winnerSide === "dire" ? "match-team is-winner" : "match-team"}>{match.direTeamName}</span>
      </td>
      <td>{scoreKnown ? `${match.radiantScore} - ${match.direScore}` : "-"}</td>
      <td>{match.durationText ?? "-"}</td>
      <td><StatusPill tone={toneForStatus(match.parseStatus)}>{match.parseStatus === "parsed" ? "已解析" : match.parseStatus === "requested" ? "待解析" : "失败"}</StatusPill></td>
      <td>
        {match.linkedSeries ? (
          <span className="match-linked" title={`G${match.linkedSeries.gameIndex} · ${match.linkedSeries.status}`}>
            {match.linkedSeries.radiantTeam.name} vs {match.linkedSeries.direTeam.name}
          </span>
        ) : (
          <span className="muted">未关联</span>
        )}
      </td>
    </tr>
  );
}
