import React, { useState } from "react";
import { Plus } from "lucide-react";
import { sendAdminRequest, type TournamentDetail } from "../../api";
import { Field, Modal, Spinner } from "../../components/ui";

type CreateTournamentStatus = "draft" | "upcoming" | "running" | "completed" | "archived";

const statusOptions: Array<{ value: CreateTournamentStatus; label: string }> = [
  { value: "upcoming", label: "未开始" },
  { value: "running", label: "进行中" },
  { value: "draft", label: "草稿" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "归档" },
];

export function CreateTournamentModal({ runningNames, onClose, onCreated }: {
  runningNames: string[];
  onClose: () => void;
  onCreated: (created: TournamentDetail | null, syncOpenDota: boolean) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [status, setStatus] = useState<CreateTournamentStatus>("upcoming");
  const [syncOpenDota, setSyncOpenDota] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const trimmedLeagueId = leagueId.trim();
  const leagueIdValid = trimmedLeagueId === "" || (/^\d+$/.test(trimmedLeagueId) && Number(trimmedLeagueId) > 0);
  const canSubmit = Boolean(name.trim()) && leagueIdValid && !submitting;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (status === "running") {
      const message = runningNames.length > 0
        ? `创建为进行中后，已有进行中届次“${runningNames.join("、")}”会自动改为已完成。确认继续？`
        : "确认把新届次直接创建为进行中？";
      if (!window.confirm(message)) return;
    }

    setSubmitting(true);
    setError("");
    const startsAtIso = startsAt ? new Date(startsAt).toISOString() : undefined;
    const result = await sendAdminRequest("/tournaments", "POST", {
      name: name.trim(),
      seasonName: seasonName.trim() || undefined,
      opendotaLeagueId: trimmedLeagueId === "" ? null : Number(trimmedLeagueId),
      startsAt: startsAtIso,
      status,
    });

    if (!result.ok) {
      setSubmitting(false);
      setError(result.message);
      return;
    }

    const created = (result.data ?? null) as TournamentDetail | null;
    await onCreated(created, syncOpenDota && trimmedLeagueId !== "");
  };

  return (
    <Modal title="新建大联赛 / 届次" desc="只创建届次骨架；小组赛、瑞士轮和淘汰赛在赛事管理里继续搭建。" onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <Field label="联赛名称">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="每日节奏第四届" autoComplete="off" />
        </Field>
        <div className="form-row">
          <Field label="OpenDota league_id" hint="可留空；没有 league_id 时无法自动同步比赛记录。">
            <input inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} placeholder="例如 19483，可留空" autoComplete="off" />
          </Field>
          <Field label="赛季名">
            <input value={seasonName} onChange={(event) => setSeasonName(event.target.value)} placeholder="可选，默认同联赛名称" autoComplete="off" />
          </Field>
        </div>
        <div className="form-row">
          <Field label="开始时间">
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </Field>
          <Field label="状态">
            <select value={status} onChange={(event) => setStatus(event.target.value as CreateTournamentStatus)}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>
        {trimmedLeagueId !== "" ? (
          <label className="check-row">
            <input type="checkbox" checked={syncOpenDota} onChange={(event) => setSyncOpenDota(event.target.checked)} />
            <span>创建后立即从 OpenDota 拉取比赛记录</span>
          </label>
        ) : null}
        {!leagueIdValid ? <p className="form-error">league_id 必须是正整数，或留空。</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {submitting ? <Spinner size={15} /> : <Plus size={15} />} 创建届次
          </button>
        </div>
      </form>
    </Modal>
  );
}
