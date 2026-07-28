import React, { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { Tone } from "../api";

export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Spinner({ size = 15 }: { size?: number }) {
  return <Loader2 size={size} className="spin" aria-hidden="true" />;
}

export function EmptyPanel({ title, text, action }: { title: string; text?: string | undefined; action?: React.ReactNode }) {
  return (
    <div className="empty-panel">
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
      {action}
    </div>
  );
}

export function SectionCard({ id, title, desc, aside, children, tone }: {
  id?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <section id={id} className={tone ? `card card-tone-${tone}` : "card"}>
      <header className="card-head">
        <div className="card-head-main">
          <h2>{title}</h2>
          {desc ? <p>{desc}</p> : null}
        </div>
        {aside ? <div className="card-head-aside">{aside}</div> : null}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Modal({ title, desc, onClose, children, wide }: {
  title: string;
  desc?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={wide ? "modal-panel is-wide" : "modal-panel"} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {desc ? <p>{desc}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, disabled }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="search-input">
      <Search size={14} aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ?? "搜索"} disabled={disabled} />
      {value ? <button type="button" onClick={() => onChange("")} aria-label="清除搜索"><X size={13} /></button> : null}
    </div>
  );
}

export function ConfirmButton({ className, confirmText, onConfirm, disabled, children, title }: {
  className?: string;
  confirmText: string;
  onConfirm: () => void | Promise<unknown>;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(confirmText)) void onConfirm();
      }}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`progress progress-${tone ?? "info"}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export function FilterTabs<T extends string>({ options, value, onChange, ariaLabel }: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="filter-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? "is-active" : ""}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.count !== undefined ? <b>{option.count}</b> : null}
        </button>
      ))}
    </div>
  );
}
