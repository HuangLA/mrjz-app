import { useEffect, useMemo, useRef, useState } from "react";
import type { MobileData } from "../api";
import type { MatchData, MatchRecord } from "../data";
import { MatchDetailPage } from "./MatchDetailPage";
import { EmptyState, ImageWithFallback } from "../components/common";
import { allRecordTeamFilter, buildRecordTeamFilterOptions, matchRecordHasTeam } from "../utils";

export function RecordsWorkspace({
  data,
  loading,
  selectedMatchId,
  matchCache,
  profileErrors,
  profileLoading,
  expandedPlayers,
  wardScrubberSeconds,
  onSelectMatch,
  onEnsureMatch,
  onPlayerToggle,
  onWardSecondChange,
  onRetryMatch,
}: {
  data: MobileData;
  loading: boolean;
  selectedMatchId: string | null;
  matchCache: Record<string, MatchData>;
  profileErrors: Record<string, string>;
  profileLoading: Record<string, boolean>;
  expandedPlayers: Set<string>;
  wardScrubberSeconds: Record<string, number>;
  onSelectMatch: (matchId: string) => void;
  onEnsureMatch: (matchId: string) => void;
  onPlayerToggle: (playerId: string) => void;
  onWardSecondChange: (matchId: string, seconds: number) => void;
  onRetryMatch: (matchId: string) => void;
}) {
  const [teamFilter, setTeamFilter] = useState<string>(allRecordTeamFilter);
  const [keyword, setKeyword] = useState("");
  const teamFilterOptions = useMemo(
    () => buildRecordTeamFilterOptions(data.matchRecords),
    [data.matchRecords],
  );
  const teamFilters = useMemo(
    () => teamFilterOptions.map((option) => option.label),
    [teamFilterOptions],
  );

  const visibleRecords = useMemo(() => {
    let records =
      teamFilter === allRecordTeamFilter
        ? data.matchRecords
        : data.matchRecords.filter((record) => matchRecordHasTeam(record, teamFilter));

    const query = keyword.trim().toLowerCase();
    if (query) {
      records = records.filter((record) =>
        `${record.radiantTeamName} ${record.direTeamName} ${record.matchId} ${record.startTime}`
          .toLowerCase()
          .includes(query),
      );
    }

    return records;
  }, [data.matchRecords, teamFilter, keyword]);

  useEffect(() => {
    if (!teamFilters.includes(teamFilter)) {
      setTeamFilter(allRecordTeamFilter);
    }
  }, [teamFilter, teamFilters]);

  const resolvedSelectedId =
    selectedMatchId && visibleRecords.some((record) => record.matchId === selectedMatchId)
      ? selectedMatchId
      : (visibleRecords[0]?.matchId ?? null);

  useEffect(() => {
    if (resolvedSelectedId) {
      onEnsureMatch(resolvedSelectedId);
    }
  }, [resolvedSelectedId, onEnsureMatch]);

  const activeMatch = resolvedSelectedId ? (matchCache[resolvedSelectedId] ?? null) : null;
  const matchError = resolvedSelectedId
    ? (profileErrors[`match:${resolvedSelectedId}`] ?? null)
    : null;
  const matchLoading = resolvedSelectedId
    ? Boolean(profileLoading[`match:${resolvedSelectedId}`])
    : false;

  const rowsRef = useRef<HTMLDivElement>(null);

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    const currentIndex = visibleRecords.findIndex(
      (record) => record.matchId === resolvedSelectedId,
    );
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next =
      visibleRecords[Math.min(visibleRecords.length - 1, Math.max(0, currentIndex + delta))];

    if (next && next.matchId !== resolvedSelectedId) {
      onSelectMatch(next.matchId);
    }
  };

  return (
    <div className="md-split">
      <div className="md-list" onKeyDown={handleListKeyDown}>
        <div className="md-list-head">
          <div className="md-search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              placeholder="搜索队伍或比赛编号…"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="md-filter-scroll" role="tablist" aria-label="按战队筛选">
            {teamFilterOptions.map((option) => (
              <button
                key={option.label}
                role="tab"
                aria-selected={option.label === teamFilter}
                className={`filter-chip ${option.label === teamFilter ? "active" : ""}`}
                type="button"
                onClick={() => setTeamFilter(option.label)}
              >
                <span>{option.label}</span>
                <small>{option.count}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="md-rows" ref={rowsRef} tabIndex={0} aria-label="比赛列表,方向键切换">
          {visibleRecords.length > 0 ? (
            visibleRecords.map((record) => (
              <MatchListRow
                key={record.matchId}
                record={record}
                selected={record.matchId === resolvedSelectedId}
                onSelect={onSelectMatch}
              />
            ))
          ) : (
            <EmptyState
              text={loading || data.matchRecords.length === 0 ? "读取中" : "暂无符合条件的比赛"}
            />
          )}
        </div>
      </div>
      <div className="md-detail">
        {activeMatch ? (
          <div className="md-detail-inner" key={activeMatch.id}>
            <MatchDetailPage
              data={data}
              loading={matchLoading}
              match={activeMatch}
              expandedPlayers={expandedPlayers}
              wardScrubberSeconds={wardScrubberSeconds}
              onPlayerToggle={onPlayerToggle}
              onWardSecondChange={onWardSecondChange}
              embedded
            />
          </div>
        ) : matchError && resolvedSelectedId ? (
          <div className="md-placeholder">
            <p>{matchError}</p>
            <button
              className="ghost-button"
              type="button"
              onClick={() => onRetryMatch(resolvedSelectedId)}
            >
              再试一次
            </button>
          </div>
        ) : (
          <div className="md-placeholder">
            <span className="data-notice-pulse" aria-hidden="true" />
            <p>{resolvedSelectedId ? "战报读取中" : "从左侧选择一场比赛"}</p>
            <p>
              <kbd>↑</kbd> <kbd>↓</kbd> 快速切换
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchListRow({
  record,
  selected,
  onSelect,
}: {
  record: MatchRecord;
  selected: boolean;
  onSelect: (matchId: string) => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const score =
    record.radiantScore === null || record.direScore === null
      ? "-:-"
      : `${record.radiantScore}:${record.direScore}`;

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <button
      ref={rowRef}
      className={`md-row ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={() => onSelect(record.matchId)}
      aria-current={selected}
    >
      <span className="mdr-teams">
        {record.radiantTeamName} vs {record.direTeamName}
      </span>
      <span className="mdr-score">{score}</span>
      <span className="mdr-meta">
        <span>#{record.matchId}</span>
        <span>{record.startTime}</span>
        <span>{record.duration}</span>
      </span>
      <span className="mdr-heroes" aria-hidden="true">
        {record.heroLineups.radiant.slice(0, 5).map((hero, index) => (
          <span key={`r${index}`}>
            <ImageWithFallback src={hero.icon} fallback={hero.portrait} alt="" loading="lazy" />
          </span>
        ))}
        <span className="mdr-vs">vs</span>
        {record.heroLineups.dire.slice(0, 5).map((hero, index) => (
          <span key={`d${index}`}>
            <ImageWithFallback src={hero.icon} fallback={hero.portrait} alt="" loading="lazy" />
          </span>
        ))}
      </span>
    </button>
  );
}
