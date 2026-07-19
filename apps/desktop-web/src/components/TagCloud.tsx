import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerTag } from "../data";
import { clampNumber, cssVars } from "../utils";
import { EmptyState } from "./common";

type ScaledTag = PlayerTag & {
  heat: number;
  fontSize: number;
  accent: string;
  driftX: number;
  driftY: number;
  driftDuration: number;
  driftDelay: number;
  tilt: number;
};

type Cheer = { sequence: number; x: number; y: number; driftX: number };

const tagAccentPalette = [
  "#5eead4",
  "#7dd3fc",
  "#f0abfc",
  "#fda4af",
  "#fde68a",
  "#bef264",
  "#c4b5fd",
  "#6ee7b7",
];

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function scaleTags(tags: PlayerTag[]): ScaledTag[] {
  const positiveLikes = tags.map((tag) => tag.likeCount).filter((count) => count > 0);
  const minPositive = positiveLikes.length > 0 ? Math.min(...positiveLikes) : 1;
  const maxLikes = Math.max(1, ...tags.map((tag) => tag.likeCount));

  return tags.map((tag) => {
    const seed = hashSeed(tag.id);
    const ratio = tag.likeCount > 0 ? tag.likeCount / minPositive : 0.4;
    const heat = clampNumber(
      Math.log2(1 + Math.max(0, ratio)) / Math.log2(1 + Math.max(1, maxLikes / minPositive) || 2),
      0,
      1,
    );

    return {
      ...tag,
      heat,
      fontSize: 13 + Math.round(heat * 17),
      accent: tagAccentPalette[seed % tagAccentPalette.length]!,
      driftX: ((seed % 13) - 6) * 1.6,
      driftY: -6 - ((seed >> 3) % 9),
      driftDuration: 5.5 + ((seed >> 5) % 40) / 10,
      driftDelay: -(((seed >> 9) % 60) / 10),
      tilt: ((seed >> 4) % 9) - 4,
    };
  });
}

export function PlayerTagCloud({ tags }: { tags: PlayerTag[] }) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const cheerSequenceRef = useRef(0);
  const cheerTimersRef = useRef<number[]>([]);
  const [energizedTagId, setEnergizedTagId] = useState<string | null>(null);
  const [cheers, setCheers] = useState<Cheer[]>([]);
  const scaledTags = useMemo(() => scaleTags(tags), [tags]);

  useEffect(
    () => () => {
      for (const timer of cheerTimersRef.current) {
        window.clearTimeout(timer);
      }
      cheerTimersRef.current = [];
    },
    [],
  );

  const energizeTag = (tag: ScaledTag, target: HTMLElement) => {
    const field = fieldRef.current;
    setEnergizedTagId(tag.id);
    const resetTimer = window.setTimeout(
      () => setEnergizedTagId((current) => (current === tag.id ? null : current)),
      640,
    );
    cheerTimersRef.current.push(resetTimer);

    if (field) {
      const fieldRect = field.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const sequence = ++cheerSequenceRef.current;
      const cheer: Cheer = {
        sequence,
        x: rect.left - fieldRect.left + rect.width / 2,
        y: rect.top - fieldRect.top,
        driftX: ((hashSeed(tag.id) >> 2) % 17) - 8,
      };
      setCheers((current) => [...current.slice(-5), cheer]);
      const timer = window.setTimeout(() => {
        setCheers((current) => current.filter((item) => item.sequence !== sequence));
      }, 620);
      cheerTimersRef.current.push(timer);
    }
  };

  return (
    <section className="panel reveal tag-cloud-panel">
      <header className="panel-head">
        <div className="panel-title">
          <h2>应援标签</h2>
          <p>社区为选手打上的标签，点赞越多越耀眼</p>
        </div>
        <span className="pill">{tags.length} 枚</span>
      </header>
      {scaledTags.length === 0 ? (
        <EmptyState text="暂无应援标签" />
      ) : (
        <div className="tag-cloud-field" ref={fieldRef}>
          {scaledTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`cloud-tag ${energizedTagId === tag.id ? "is-energized" : ""}`}
              style={cssVars({
                "--tag-size": `${tag.fontSize}px`,
                "--tag-accent": tag.accent,
                "--tag-drift-x": `${tag.driftX}px`,
                "--tag-drift-y": `${tag.driftY}px`,
                "--tag-drift-duration": `${tag.driftDuration}s`,
                "--tag-drift-delay": `${tag.driftDelay}s`,
                "--tag-tilt": `${tag.tilt}deg`,
                "--tag-heat": tag.heat,
              })}
              title={`${tag.text} · ${tag.likeCount} 赞`}
              onClick={(event) => energizeTag(tag, event.currentTarget)}
            >
              <span>{tag.text}</span>
              <small>{tag.likeCount}</small>
            </button>
          ))}
          {cheers.map((cheer) => (
            <span
              key={cheer.sequence}
              className="tag-cheer"
              style={cssVars({
                "--cheer-x": `${cheer.x}px`,
                "--cheer-y": `${cheer.y}px`,
                "--cheer-drift": `${cheer.driftX}px`,
              })}
              aria-hidden="true"
            >
              +1
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
