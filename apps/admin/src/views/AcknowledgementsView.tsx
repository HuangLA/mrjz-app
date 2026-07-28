import { useState } from "react";
import { Check, ImagePlus, Plus, Trash2, X } from "lucide-react";
import type { AcknowledgementCategory, AcknowledgementItem, AcknowledgementStatus } from "../api";
import { ConfirmButton, EmptyPanel, SectionCard } from "../components/ui";
import { resolveAdminAssetUrl } from "../components/TeamChip";
import type { TournamentCtx } from "./tournament/context";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

interface Draft {
  category: AcknowledgementCategory;
  displayName: string;
  imageDataUrl: string | null;
  imagePreviewUrl: string | null;
  imageUrl: string | null;
  sortOrder: string;
  status: AcknowledgementStatus;
}

const emptyDraft = (category: AcknowledgementCategory = "community"): Draft => ({
  category,
  displayName: "",
  imageDataUrl: null,
  imagePreviewUrl: null,
  imageUrl: null,
  sortOrder: "",
  status: "visible",
});

const toDraft = (item: AcknowledgementItem): Draft => ({
  category: item.category,
  displayName: item.displayName,
  imageDataUrl: null,
  imagePreviewUrl: null,
  imageUrl: resolveAdminAssetUrl(item.imageUrl),
  sortOrder: String(item.sortOrder),
  status: item.status,
});

export function AcknowledgementsView({ data, reload, runAction, notify }: {
  data: TournamentCtx["data"];
  reload: () => Promise<void>;
  runAction: TournamentCtx["runAction"];
  notify: TournamentCtx["notify"];
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [createDrafts, setCreateDrafts] = useState<Record<AcknowledgementCategory, Draft>>({ sponsor: emptyDraft("sponsor"), community: emptyDraft("community") });
  const sponsors = sorted(data.acknowledgements.filter((item) => item.category === "sponsor"));
  const supporters = sorted(data.acknowledgements.filter((item) => item.category === "community"));

  const draftFor = (item: AcknowledgementItem): Draft => drafts[item.id] ?? toDraft(item);
  const patchDraft = (item: AcknowledgementItem, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [item.id]: { ...draftFor(item), ...patch } }));
  };

  const chooseImage = async (file: File | undefined, input: HTMLInputElement, apply: (dataUrl: string) => void) => {
    input.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      notify("warn", "头像图片不能超过 2MB。");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("warn", "头像只支持 PNG、JPG 或 WebP。");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => apply(String(reader.result ?? "")));
    reader.readAsDataURL(file);
  };

  const save = async (item: AcknowledgementItem) => {
    const draft = draftFor(item);
    if (!draft.displayName.trim()) {
      notify("warn", "展示 ID / 名称不能为空。");
      return;
    }
    const sortOrder = draft.sortOrder.trim() ? Number(draft.sortOrder) : undefined;
    const result = await runAction("保存鸣谢", "PATCH", `/admin/acknowledgements/${encodeURIComponent(item.id)}`, {
      category: draft.category,
      displayName: draft.displayName.trim(),
      status: draft.status,
      ...(sortOrder !== undefined && Number.isSafeInteger(sortOrder) ? { sortOrder } : {}),
      ...(draft.imageDataUrl !== null
        ? { imageDataUrl: draft.imageDataUrl }
        : draft.imageUrl !== resolveAdminAssetUrl(item.imageUrl)
          ? { imageUrl: draft.imageUrl }
          : {}),
    });
    if (result.ok) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  };

  const create = async (category: AcknowledgementCategory) => {
    const draft = createDrafts[category];
    if (!draft.displayName.trim()) {
      notify("warn", "请填写展示 ID / 名称。");
      return;
    }
    const sortOrder = draft.sortOrder.trim() ? Number(draft.sortOrder) : undefined;
    const result = await runAction("新增鸣谢", "POST", "/admin/acknowledgements", {
      category: draft.category,
      displayName: draft.displayName.trim(),
      status: draft.status,
      ...(sortOrder !== undefined && Number.isSafeInteger(sortOrder) ? { sortOrder } : {}),
      ...(draft.imageDataUrl !== null ? { imageDataUrl: draft.imageDataUrl } : {}),
    });
    if (result.ok) {
      setCreateDrafts((current) => ({ ...current, [category]: emptyDraft(category) }));
    }
  };

  const renderSection = (category: AcknowledgementCategory, title: string, items: AcknowledgementItem[]) => {
    const createDraft = createDrafts[category];
    return (
      <section className="ack-section">
        <div className="ack-section-head">
          <h3>{title}（{items.length}）</h3>
        </div>
        {items.length === 0 ? <EmptyPanel title={`还没有${title}`} text="新增后会自动同步到 H5 和小程序首页。" /> : (
          <div className="ack-list">
            {items.map((item) => {
              const draft = draftFor(item);
              const previewUrl = draft.imagePreviewUrl ?? draft.imageUrl;
              const dirty = drafts[item.id] !== undefined;
              return (
                <article key={item.id} className={draft.status === "hidden" ? "ack-row is-hidden" : "ack-row"}>
                  <div className="ack-preview">
                    {previewUrl ? <img src={previewUrl} alt="" /> : <span>{draft.displayName.slice(0, 1).toUpperCase() || "?"}</span>}
                  </div>
                  <div className="ack-fields">
                    <div className="form-row">
                      <label className="field"><span className="field-label">ID / 名称</span><input value={draft.displayName} onChange={(event) => patchDraft(item, { displayName: event.target.value })} /></label>
                      <label className="field"><span className="field-label">排序</span><input inputMode="numeric" value={draft.sortOrder} onChange={(event) => patchDraft(item, { sortOrder: event.target.value })} /></label>
                      <label className="field"><span className="field-label">状态</span>
                        <select value={draft.status} onChange={(event) => patchDraft(item, { status: event.target.value as AcknowledgementStatus })}>
                          <option value="visible">显示</option>
                          <option value="hidden">隐藏</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="ack-actions">
                    <label className="btn btn-ghost btn-sm file-btn"><ImagePlus size={13} /> 换图<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseImage(event.currentTarget.files?.[0], event.currentTarget, (dataUrl) => patchDraft(item, { imageDataUrl: dataUrl, imagePreviewUrl: dataUrl, imageUrl: null }))} /></label>
                    {previewUrl ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => patchDraft(item, { imageDataUrl: null, imagePreviewUrl: null, imageUrl: null })}><X size={13} /></button> : null}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void save(item)} disabled={!dirty}><Check size={13} /> 保存</button>
                    <ConfirmButton className="btn btn-ghost-danger btn-sm" confirmText={`确认删除“${item.displayName}”？`} onConfirm={() => runAction("删除鸣谢", "DELETE", `/admin/acknowledgements/${encodeURIComponent(item.id)}`)}>
                      <Trash2 size={13} />
                    </ConfirmButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <form className="ack-create" onSubmit={(event) => { event.preventDefault(); void create(category); }}>
          <div className="ack-preview is-create">
            {createDraft.imagePreviewUrl ? <img src={createDraft.imagePreviewUrl} alt="" /> : <span>{createDraft.displayName.slice(0, 1).toUpperCase() || "+"}</span>}
          </div>
          <input value={createDraft.displayName} onChange={(event) => setCreateDrafts((current) => ({ ...current, [category]: { ...createDraft, displayName: event.target.value } }))} placeholder={`新增${title} ID / 名称`} />
          <input className="ack-sort-input" inputMode="numeric" value={createDraft.sortOrder} onChange={(event) => setCreateDrafts((current) => ({ ...current, [category]: { ...createDraft, sortOrder: event.target.value } }))} placeholder="排序" title="排序（可留空）" />
          <label className="btn btn-ghost btn-sm file-btn"><ImagePlus size={13} /> 头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseImage(event.currentTarget.files?.[0], event.currentTarget, (dataUrl) => setCreateDrafts((current) => ({ ...current, [category]: { ...createDraft, imageDataUrl: dataUrl, imagePreviewUrl: dataUrl } })))} /></label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!createDraft.displayName.trim()}><Plus size={13} /> 新增</button>
        </form>
      </section>
    );
  };

  return (
    <div className="view-stack">
      <SectionCard title="鸣谢名单" desc="赞助商和社区支持会同步展示在 H5 与小程序首页；隐藏后不再展示。">
        {renderSection("sponsor", "赞助商", sponsors)}
        {renderSection("community", "社区支持", supporters)}
      </SectionCard>
    </div>
  );
}

function sorted(items: AcknowledgementItem[]): AcknowledgementItem[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}
