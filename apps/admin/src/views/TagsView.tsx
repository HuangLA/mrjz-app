import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { sendAdminRequest, type AdminTagPlayerItem, type PlayerTagModerationItem, type PlayerTagStatus, type TeamBrief } from "../api";
import { formatDateTime, labelTagStatus, toneForStatus } from "../app/format";
import { ConfirmButton, EmptyPanel, FilterTabs, SearchInput, SectionCard, StatusPill } from "../components/ui";
import type { AdminData } from "../app/store";
import type { TournamentCtx } from "./tournament/context";

type TagPlayerFilter = PlayerTagStatus | "needs_review" | "untagged" | "all";

export function TagsView({ data, reload, notify }: { data: AdminData; reload: () => Promise<void>; notify: TournamentCtx["notify"] }) {
  const [statusFilter, setStatusFilter] = useState<TagPlayerFilter>("needs_review");
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [createText, setCreateText] = useState("");

  const fallbackPlayers = useMemo<AdminTagPlayerItem[]>(
    () => data.players.map((player) => ({
      ...player,
      tournamentIds: [data.selectedTournamentId].filter(Boolean),
      tags: [],
      tagCounts: { pending_review: 0, approved: 0, rejected: 0, hidden: 0 },
    })),
    [data.players, data.selectedTournamentId],
  );
  const players = data.tagPlayers.length > 0 ? data.tagPlayers : fallbackPlayers;
  const scopedPlayers = useMemo(
    () => players.filter((player) => tournamentFilter === "all" || player.tournamentIds.includes(tournamentFilter)),
    [players, tournamentFilter],
  );
  const teamOptions = useMemo(() => {
    const teams = new Map<string, TeamBrief>();
    scopedPlayers.forEach((player) => {
      const target = player.teams.length > 0 ? player.teams : player.currentTeam ? [player.currentTeam] : [];
      target.forEach((team) => teams.set(team.id, team));
    });
    return [...teams.values()].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [scopedPlayers]);

  const counts = useMemo(() => {
    const statusCounts = { pending_review: 0, approved: 0, rejected: 0, hidden: 0 };
    scopedPlayers.forEach((player) => {
      statusCounts.pending_review += player.tagCounts.pending_review;
      statusCounts.approved += player.tagCounts.approved;
      statusCounts.rejected += player.tagCounts.rejected;
      statusCounts.hidden += player.tagCounts.hidden;
    });
    return {
      statusCounts,
      playersWithPending: scopedPlayers.filter((player) => player.tagCounts.pending_review > 0).length,
      playersWithoutTags: scopedPlayers.filter((player) => player.tags.length === 0).length,
    };
  }, [scopedPlayers]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlayers = useMemo(
    () => scopedPlayers
      .filter((player) => matchesFilters(player, statusFilter, teamFilter, normalizedQuery))
      .sort((left, right) =>
        right.tagCounts.pending_review - left.tagCounts.pending_review
        || right.tags.length - left.tags.length
        || left.displayName.localeCompare(right.displayName, "zh-CN")
        || left.id.localeCompare(right.id)),
    [scopedPlayers, normalizedQuery, statusFilter, teamFilter],
  );
  const selectedPlayer = filteredPlayers.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0] ?? null;

  const updateTagStatus = async (tag: PlayerTagModerationItem, status: PlayerTagStatus) => {
    notify("info", "标签审核处理中...");
    const result = await sendAdminRequest(`/admin/tags/${encodeURIComponent(tag.id)}`, "PATCH", { status, reviewReason: null, actor: "admin" });
    notify(result.ok ? "good" : "warn", `标签审核：${result.message}`);
    if (result.ok) await reload();
  };

  const deleteTag = async (tag: PlayerTagModerationItem) => {
    notify("info", "正在删除标签...");
    const result = await sendAdminRequest(`/admin/tags/${encodeURIComponent(tag.id)}`, "DELETE", { actor: "admin" });
    notify(result.ok ? "good" : "warn", `删除标签：${result.message}`);
    if (result.ok) await reload();
  };

  const adjustLikes = async (tag: PlayerTagModerationItem, delta: number) => {
    const result = await sendAdminRequest(`/admin/tags/${encodeURIComponent(tag.id)}/likes/adjust`, "POST", { delta, actor: "admin" });
    notify(result.ok ? "good" : "warn", `调整点赞数：${result.message}`);
    if (result.ok) await reload();
  };

  const createTag = async () => {
    const text = createText.trim();
    if (!selectedPlayer || !text) {
      notify("warn", "请先选择选手并输入标签文本。");
      return;
    }
    const sourceTournamentId = tournamentFilter !== "all"
      ? tournamentFilter
      : selectedPlayer.tournamentIds.includes(data.selectedTournamentId)
        ? data.selectedTournamentId
        : selectedPlayer.tournamentIds[0] ?? data.selectedTournamentId;
    const result = await sendAdminRequest(
      `/admin/tournaments/${encodeURIComponent(sourceTournamentId)}/players/${encodeURIComponent(selectedPlayer.id)}/tags`,
      "POST",
      { text, status: "approved", actor: "admin" },
    );
    notify(result.ok ? "good" : "warn", `新增标签：${result.message}`);
    if (result.ok) {
      setCreateText("");
      await reload();
    }
  };

  return (
    <div className="view-stack">
      <SectionCard
        title="标签审核"
        desc="审核小程序用户提交的选手标签；待审标签会在导航入口提醒。"
        aside={
          <div className="tournament-metrics">
            <div><span>待审核</span><strong>{counts.statusCounts.pending_review}</strong></div>
            <div><span>已通过</span><strong>{counts.statusCounts.approved}</strong></div>
            <div><span>已隐藏</span><strong>{counts.statusCounts.hidden}</strong></div>
            <div><span>已拒绝</span><strong>{counts.statusCounts.rejected}</strong></div>
          </div>
        }
      >
        <div className="series-board-bar">
          <FilterTabs
            ariaLabel="标签状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "needs_review", label: "有待审", count: counts.playersWithPending },
              { value: "pending_review", label: "待审核", count: counts.statusCounts.pending_review },
              { value: "approved", label: "已通过", count: counts.statusCounts.approved },
              { value: "hidden", label: "已隐藏", count: counts.statusCounts.hidden },
              { value: "rejected", label: "已拒绝", count: counts.statusCounts.rejected },
              { value: "untagged", label: "无标签", count: counts.playersWithoutTags },
              { value: "all", label: "全部", count: scopedPlayers.length },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="选手、队伍、标签或创建人" />
          <select value={tournamentFilter} onChange={(event) => setTournamentFilter(event.target.value)} aria-label="届次筛选" className="inline-select">
            <option value="all">全部届次</option>
            {data.tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
          </select>
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} aria-label="队伍筛选" className="inline-select">
            <option value="all">全部队伍</option>
            <option value="none">暂未归队</option>
            {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>

        <div className="tag-layout">
          <aside className="tag-queue" aria-label="选手队列">
            {filteredPlayers.length === 0 ? <EmptyPanel title="没有匹配的选手" text="调整筛选条件后再查看。" /> : (
              <div className="tag-player-list">
                {filteredPlayers.map((player) => (
                  <button key={player.id} type="button" className={selectedPlayer?.id === player.id ? "tag-player-row is-active" : "tag-player-row"} onClick={() => setSelectedPlayerId(player.id)}>
                    <div>
                      <strong>{player.displayName}</strong>
                      <small>{(player.currentTeam ?? player.teams[0])?.name ?? "暂未归队"} · {player.tags.length} 个标签</small>
                    </div>
                    <span className={player.tagCounts.pending_review > 0 ? "tag-pending-badge is-hot" : "tag-pending-badge"}>
                      {player.tagCounts.pending_review > 0 ? `${player.tagCounts.pending_review} 待审` : "无待审"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="tag-detail">
            {selectedPlayer === null ? <EmptyPanel title="请选择选手" text="左侧队列选择选手后处理标签。" /> : (
              <>
                <header className="tag-detail-head">
                  <div>
                    <h3>{selectedPlayer.displayName}</h3>
                    <p className="muted">Account {selectedPlayer.accountId ?? "-"} · 参与 {selectedPlayer.tournamentIds.length} 届 · {selectedPlayer.tags.length} 个标签</p>
                  </div>
                  {selectedPlayer.tagCounts.pending_review > 0
                    ? <StatusPill tone="warn">{selectedPlayer.tagCounts.pending_review} 个待审</StatusPill>
                    : <StatusPill tone="good">无待审</StatusPill>}
                </header>
                <div className="tag-create-row">
                  <input value={createText} onChange={(event) => setCreateText(event.target.value)} placeholder="为该选手新增标签（直接通过）" onKeyDown={(event) => { if (event.key === "Enter") void createTag(); }} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void createTag()} disabled={!createText.trim()}><Plus size={13} /> 新增</button>
                </div>
                {selectedPlayer.tags.length === 0 ? (
                  <EmptyPanel title="该选手暂无标签" text="可用上方输入框直接新增标签。" />
                ) : (
                  <div className="tag-card-list">
                    {groupTags(selectedPlayer.tags).map((section) => (
                      <div key={section.status} className="tag-section">
                        <div className="tag-section-head"><strong>{labelTagStatus(section.status)}</strong><span>{section.tags.length}</span></div>
                        {section.tags.map((tag) => (
                          <TagCard key={tag.id} tag={tag} onUpdateStatus={updateTagStatus} onAdjustLikes={adjustLikes} onDelete={deleteTag} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </SectionCard>
    </div>
  );
}

function TagCard({ tag, onUpdateStatus, onAdjustLikes, onDelete }: {
  tag: PlayerTagModerationItem;
  onUpdateStatus: (tag: PlayerTagModerationItem, status: PlayerTagStatus) => Promise<void>;
  onAdjustLikes: (tag: PlayerTagModerationItem, delta: number) => Promise<void>;
  onDelete: (tag: PlayerTagModerationItem) => Promise<void>;
}) {
  return (
    <article className="tag-card">
      <div className="tag-card-main">
        <span className={`tag-cloud tag-cloud-${tag.sizeLevel}`}>{tag.text}</span>
        <div className="tag-card-meta">
          <strong>{tag.targetName}</strong>
          <small>由 {tag.createdBy.nickname} 提交 · {formatDateTime(tag.createdAt)}</small>
        </div>
        <StatusPill tone={toneForStatus(tag.status)}>{labelTagStatus(tag.status)}</StatusPill>
      </div>
      <div className="tag-card-actions">
        <span className="tag-likes" aria-label={`${tag.likeCount} 赞`}>
          <button type="button" className="icon-btn" disabled={tag.likeCount <= 0} title="减少 1 赞" onClick={() => void onAdjustLikes(tag, -1)}><Minus size={12} /></button>
          <strong>{tag.likeCount}</strong>
          <button type="button" className="icon-btn" title="增加 1 赞" onClick={() => void onAdjustLikes(tag, 1)}><Plus size={12} /></button>
        </span>
        {tag.status !== "approved" ? <button type="button" className="btn btn-secondary btn-xs" onClick={() => void onUpdateStatus(tag, "approved")}><Check size={12} /> {tag.status === "pending_review" ? "通过" : "恢复"}</button> : null}
        {tag.status === "pending_review" ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => void onUpdateStatus(tag, "rejected")}><X size={12} /> 拒绝</button> : null}
        {tag.status !== "hidden" ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => void onUpdateStatus(tag, "hidden")}><ShieldCheck size={12} /> 隐藏</button> : null}
        <ConfirmButton className="btn btn-ghost-danger btn-xs" confirmText={`确认删除标签「${tag.text}」？删除后不会在前端展示。`} onConfirm={() => onDelete(tag)}>
          <Trash2 size={12} />
        </ConfirmButton>
      </div>
    </article>
  );
}

function matchesFilters(player: AdminTagPlayerItem, statusFilter: TagPlayerFilter, teamFilter: string, normalizedQuery: string): boolean {
  if (teamFilter === "none") {
    if (player.currentTeam !== null || player.teams.length > 0) return false;
  } else if (teamFilter !== "all") {
    const teamIds = new Set([player.currentTeam?.id, ...player.teams.map((team) => team.id)].filter(Boolean));
    if (!teamIds.has(teamFilter)) return false;
  }

  if (statusFilter === "needs_review" && player.tagCounts.pending_review === 0) return false;
  if (statusFilter === "untagged" && player.tags.length > 0) return false;
  if (["pending_review", "approved", "rejected", "hidden"].includes(statusFilter) && player.tagCounts[statusFilter as PlayerTagStatus] === 0) return false;

  if (!normalizedQuery) return true;
  return [
    player.displayName,
    player.accountId === null ? "" : String(player.accountId),
    player.currentTeam?.name ?? "",
    ...player.teams.map((team) => `${team.name} ${team.shortName}`),
    ...player.tags.map((tag) => `${tag.text} ${tag.createdBy.nickname} ${tag.reviewReason ?? ""}`),
  ].join(" ").toLowerCase().includes(normalizedQuery);
}

function groupTags(tags: PlayerTagModerationItem[]): Array<{ status: PlayerTagStatus; tags: PlayerTagModerationItem[] }> {
  const order: PlayerTagStatus[] = ["pending_review", "approved", "hidden", "rejected"];
  return order
    .map((status) => ({
      status,
      tags: tags
        .filter((tag) => tag.status === status)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)),
    }))
    .filter((section) => section.tags.length > 0);
}
