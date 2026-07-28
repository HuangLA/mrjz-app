import { useEffect, useState } from "react";
import { Check, ImagePlus, Plus, Trash2, UserPlus, X } from "lucide-react";
import type { PlayerBrief, TournamentTeamListItem } from "../api";
import { percentOrDash } from "../app/format";
import { ConfirmButton, EmptyPanel, Modal, SearchInput, SectionCard, Spinner } from "../components/ui";
import { PlayerAvatar, TeamIdentity, resolveAdminAssetUrl } from "../components/TeamChip";
import type { TournamentCtx } from "./tournament/context";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

interface TeamDraftForm {
  name: string;
  shortName: string;
  logoUrl: string;
  logoImageDataUrl: string | null;
  logoPreviewUrl: string | null;
  color: string;
  opendotaTeamId: string;
}

const emptyDraft = (): TeamDraftForm => ({ name: "", shortName: "", logoUrl: "", logoImageDataUrl: null, logoPreviewUrl: null, color: "#2f7d57", opendotaTeamId: "" });

const teamToDraft = (team: TournamentTeamListItem): TeamDraftForm => ({
  name: team.name,
  shortName: team.shortName,
  logoUrl: team.logoUrl ?? "",
  logoImageDataUrl: null,
  logoPreviewUrl: resolveAdminAssetUrl(team.logoUrl ?? null),
  color: team.color || "#64748b",
  opendotaTeamId: team.opendotaTeamId?.toString() ?? "",
});

export function TeamsView({ data, reload, runAction, notify }: {
  data: TournamentCtx["data"];
  reload: () => Promise<void>;
  runAction: TournamentCtx["runAction"];
  notify: TournamentCtx["notify"];
}) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleTeams = data.teams.filter((team) => {
    if (!normalizedQuery) return true;
    return [team.name, team.shortName, team.opendotaTeamId?.toString() ?? "", ...team.members.map((member) => `${member.displayName} ${member.steamId64 ?? ""} ${member.accountId ?? ""}`)]
      .join(" ").toLowerCase().includes(normalizedQuery);
  });
  const selectedTeam = visibleTeams.find((team) => team.id === selectedId) ?? visibleTeams[0] ?? null;

  useEffect(() => {
    if (selectedTeam && selectedTeam.id !== selectedId) setSelectedId(selectedTeam.id);
  }, [selectedTeam, selectedId]);

  return (
    <div className="view-stack">
      <SectionCard
        title="战队与选手"
        desc={`${data.teams.length} 支战队 · ${data.players.length} 名选手（当前届次）`}
        aside={
          <div className="row-actions">
            <SearchInput value={query} onChange={setQuery} placeholder="搜索战队、队员、SteamID" />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> 新建战队</button>
          </div>
        }
      >
        {data.teams.length === 0 ? (
          <EmptyPanel title="当前届次暂无战队" text="创建战队后可继续添加队员，再回赛事管理锁定参赛名单。" />
        ) : (
          <div className="teams-layout">
            <div className="teams-list" role="list">
              {visibleTeams.map((team) => (
                <button key={team.id} type="button" className={selectedTeam?.id === team.id ? "team-list-row is-active" : "team-list-row"} onClick={() => setSelectedId(team.id)}>
                  <TeamIdentity team={team} />
                  <span className="muted">{team.memberCount} 人 · 胜率 {percentOrDash(team.stats.winRate)}</span>
                </button>
              ))}
              {visibleTeams.length === 0 ? <p className="muted">没有匹配的战队。</p> : null}
            </div>
            <div className="teams-detail">
              {selectedTeam ? (
                <TeamDetail
                  key={selectedTeam.id}
                  team={selectedTeam}
                  runAction={runAction}
                  notify={notify}
                />
              ) : null}
            </div>
          </div>
        )}
      </SectionCard>
      {createOpen ? (
        <CreateTeamModal
          tournamentId={data.selectedTournamentId}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await reload();
          }}
          runAction={runAction}
          notify={notify}
        />
      ) : null}
    </div>
  );
}

function TeamDetail({ team, runAction, notify }: {
  team: TournamentTeamListItem;
  runAction: TournamentCtx["runAction"];
  notify: TournamentCtx["notify"];
}) {
  const [draft, setDraft] = useState<TeamDraftForm>(() => teamToDraft(team));
  const [memberId, setMemberId] = useState("");
  const [saving, setSaving] = useState(false);

  const chooseLogo = async (file: File | undefined, input: HTMLInputElement) => {
    input.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      notify("warn", "战队 Logo 不能超过 2MB。");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("warn", "战队 Logo 只支持 PNG、JPG 或 WebP。");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setDraft((current) => ({ ...current, logoImageDataUrl: dataUrl, logoPreviewUrl: dataUrl, logoUrl: "" }));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      notify("warn", "战队名称不能为空。");
      return;
    }
    setSaving(true);
    try {
      await runAction("保存战队资料", "PATCH", `/teams/${encodeURIComponent(team.id)}`, {
        name: draft.name.trim(),
        shortName: draft.shortName.trim() || draft.name.trim(),
        color: draft.color || "#64748b",
        opendotaTeamId: parseOptionalPositiveInt(draft.opendotaTeamId),
        ...(draft.logoImageDataUrl !== null ? { logoImageDataUrl: draft.logoImageDataUrl } : { logoUrl: draft.logoUrl.trim() || null }),
      });
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    const steamId = memberId.trim();
    if (!steamId) {
      notify("warn", "请输入 SteamID64 或 Dota account_id。");
      return;
    }
    const result = await runAction("添加队员", "POST", `/teams/${encodeURIComponent(team.id)}/members`, { steamId });
    if (result.ok) setMemberId("");
  };

  const removeMember = async (player: PlayerBrief) => {
    await runAction("移除队员", "DELETE", `/teams/${encodeURIComponent(team.id)}/members/${encodeURIComponent(player.id)}`);
  };

  const previewUrl = draft.logoPreviewUrl ?? resolveAdminAssetUrl(draft.logoUrl);

  return (
    <div className="team-detail">
      <div className="team-detail-head">
        <TeamIdentity team={team} size="large" />
        <div className="tournament-metrics">
          <div><span>成员</span><strong>{team.memberCount}</strong></div>
          <div><span>战绩</span><strong>{team.stats.seriesWins}-{team.stats.seriesLosses}</strong></div>
          <div><span>真实比赛</span><strong>{team.stats.linkedMatches}</strong></div>
        </div>
      </div>

      <div className="team-edit-grid">
        <label className="field"><span className="field-label">队名</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="field"><span className="field-label">简称</span><input value={draft.shortName} onChange={(event) => setDraft((current) => ({ ...current, shortName: event.target.value }))} /></label>
        <label className="field"><span className="field-label">颜色</span><input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} /></label>
        <label className="field"><span className="field-label">OpenDota 队伍 ID</span><input inputMode="numeric" value={draft.opendotaTeamId} onChange={(event) => setDraft((current) => ({ ...current, opendotaTeamId: event.target.value }))} placeholder="可选" /></label>
        <label className="field"><span className="field-label">Logo URL</span><input value={draft.logoUrl} onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value, logoImageDataUrl: null, logoPreviewUrl: null }))} placeholder="可留空" /></label>
        <div className="field">
          <span className="field-label">Logo 预览</span>
          <div className="logo-picker">
            {previewUrl ? <img src={previewUrl} alt="" /> : <span className="logo-fallback" style={{ background: draft.color }}>{(draft.shortName || draft.name || "?").slice(0, 2).toUpperCase()}</span>}
            <label className="btn btn-ghost btn-sm file-btn"><ImagePlus size={13} /> 上传<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseLogo(event.currentTarget.files?.[0], event.currentTarget)} /></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft((current) => ({ ...current, logoImageDataUrl: null, logoPreviewUrl: null, logoUrl: "" }))}><X size={13} /> 清除</button>
          </div>
        </div>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>{saving ? <Spinner size={13} /> : <Check size={13} />} 保存资料</button>
      </div>

      <div className="member-section">
        <h3>成员（{team.members.length}）</h3>
        <div className="member-add">
          <input value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="SteamID64 或 Dota account_id" onKeyDown={(event) => { if (event.key === "Enter") void addMember(); }} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void addMember()}><UserPlus size={13} /> 添加并同步</button>
        </div>
        <div className="member-list">
          {team.members.length === 0 ? <span className="muted">还没有成员。</span> : team.members.map((member) => (
            <div key={member.id} className="member-chip">
              <PlayerAvatar player={member} />
              <div><strong>{member.displayName}</strong><small>{member.steamId64 ?? member.accountId ?? "未绑定 ID"}</small></div>
              <ConfirmButton className="icon-btn" confirmText={`确认从“${team.name}”移除 ${member.displayName}？选手档案会保留。`} onConfirm={() => removeMember(member)} title={`移除 ${member.displayName}`}>
                <Trash2 size={13} />
              </ConfirmButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateTeamModal({ tournamentId, onClose, onCreated, runAction, notify }: {
  tournamentId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
  runAction: TournamentCtx["runAction"];
  notify: TournamentCtx["notify"];
}) {
  const [draft, setDraft] = useState<TeamDraftForm>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      notify("warn", "战队名称不能为空。");
      return;
    }
    setSubmitting(true);
    try {
      const result = await runAction("创建战队", "POST", "/teams", {
        tournamentId,
        name: draft.name.trim(),
        shortName: draft.shortName.trim() || undefined,
        color: draft.color || "#2f7d57",
        opendotaTeamId: parseOptionalPositiveInt(draft.opendotaTeamId),
        ...(draft.logoImageDataUrl !== null ? { logoImageDataUrl: draft.logoImageDataUrl } : { logoUrl: draft.logoUrl.trim() || null }),
      }, { silent: true });
      notify(result.ok ? "good" : "warn", `创建战队：${result.message}`);
      if (result.ok) await onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="新建战队" desc="创建后会加入当前届次。" onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <label className="field"><span className="field-label">完整队名</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：每日节奏一队" /></label>
        <div className="form-row">
          <label className="field"><span className="field-label">简称</span><input value={draft.shortName} onChange={(event) => setDraft((current) => ({ ...current, shortName: event.target.value }))} placeholder="可留空" /></label>
          <label className="field"><span className="field-label">颜色</span><input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} /></label>
        </div>
        <div className="form-row">
          <label className="field"><span className="field-label">Logo URL</span><input value={draft.logoUrl} onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="可留空" /></label>
          <label className="field"><span className="field-label">OpenDota 队伍 ID</span><input inputMode="numeric" value={draft.opendotaTeamId} onChange={(event) => setDraft((current) => ({ ...current, opendotaTeamId: event.target.value }))} placeholder="可选" /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn btn-primary" type="submit" disabled={submitting || !draft.name.trim()}>{submitting ? <Spinner size={14} /> : <Plus size={14} />} 创建战队</button>
        </div>
      </form>
    </Modal>
  );
}

function parseOptionalPositiveInt(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("文件读取失败")));
    reader.readAsDataURL(file);
  });
}
