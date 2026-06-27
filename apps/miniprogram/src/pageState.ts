import Taro, { useDidHide, usePageScroll } from "@tarojs/taro";
import { useRef } from "react";
import { getApiBaseUrl } from "./runtimeConfig";

const PAGE_VIEW_STATE_PREFIX = "mrjz.pageViewState.v1";
const PAGE_VIEW_STATE_INDEX_KEY = `${PAGE_VIEW_STATE_PREFIX}:index`;
const PAGE_VIEW_STATE_VERSION = 1;
const MAX_PAGE_VIEW_STATE_ENTRIES = 80;
const SCROLL_SAVE_THROTTLE_MS = 500;

type PageViewStateEnvelope<T> = {
  data: T;
  savedAt: number;
  version: typeof PAGE_VIEW_STATE_VERSION;
};

type PageViewStateIndex = Record<string, number>;

type PageScrollSnapshot = {
  scrollTop?: number;
};

type PageScrollEvent = {
  scrollTop?: number;
};

const memoryState = new Map<string, PageViewStateEnvelope<unknown>>();

export function pageViewStateKey(
  scope: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const apiBase = sanitizeKeyPart(getApiBaseUrl());
  const suffix = parts.map((part) => sanitizeKeyPart(String(part ?? "default"))).join(":");

  return [PAGE_VIEW_STATE_PREFIX, apiBase, sanitizeKeyPart(scope), suffix]
    .filter(Boolean)
    .join(":");
}

export function readPageViewState<T extends object>(key: string): T | null {
  const envelope = readPageViewStateEnvelope<T>(key);

  return envelope ? envelope.data : null;
}

export function writePageViewState<T extends object>(key: string, value: T): void {
  const envelope: PageViewStateEnvelope<T> = {
    data: value,
    savedAt: Date.now(),
    version: PAGE_VIEW_STATE_VERSION,
  };

  memoryState.set(key, envelope);
  persistStateEnvelope(key, envelope);
  rememberStateKey(key, envelope.savedAt);
}

export function mergePageViewState<T extends object>(key: string, patch: Partial<T>): T {
  const current = readPageViewState<T>(key) ?? ({} as T);
  const next = {
    ...current,
    ...patch,
  };

  writePageViewState(key, next);
  return next;
}

export function usePageScrollMemory(key: string, options?: { enabled?: boolean }): void {
  const keyRef = useRef(key);
  const enabledRef = useRef(options?.enabled !== false);
  const lastSavedAtRef = useRef(0);
  const latestScrollTopRef = useRef<number | null>(null);

  keyRef.current = key;
  enabledRef.current = options?.enabled !== false;

  usePageScroll((event: PageScrollEvent) => {
    if (!enabledRef.current || typeof event.scrollTop !== "number") {
      return;
    }

    const now = Date.now();
    const scrollTop = Math.max(0, event.scrollTop);
    latestScrollTopRef.current = scrollTop;

    if (now - lastSavedAtRef.current < SCROLL_SAVE_THROTTLE_MS) {
      return;
    }

    lastSavedAtRef.current = now;
    savePageScroll(keyRef.current, scrollTop);
  });

  useDidHide(() => {
    if (!enabledRef.current || latestScrollTopRef.current === null) {
      return;
    }

    savePageScroll(keyRef.current, latestScrollTopRef.current);
  });
}

function savePageScroll(key: string, scrollTop: number): void {
  mergePageViewState<PageScrollSnapshot>(key, {
    scrollTop,
  });
}

export function restorePageScroll(key: string): void {
  const state = readPageViewState<PageScrollSnapshot>(key);
  const scrollTop =
    typeof state?.scrollTop === "number" && Number.isFinite(state.scrollTop)
      ? Math.max(0, state.scrollTop)
      : null;

  if (scrollTop === null) {
    return;
  }

  schedulePageScrollTo(scrollTop, 0);
  schedulePageScrollTo(scrollTop, 80);
}

function schedulePageScrollTo(scrollTop: number, delayMs: number): void {
  setTimeout(() => {
    void Taro.pageScrollTo({
      duration: 0,
      scrollTop,
    });
  }, delayMs);
}

function readPageViewStateEnvelope<T extends object>(key: string): PageViewStateEnvelope<T> | null {
  const memoryValue = memoryState.get(key);

  if (isPageViewStateEnvelope<T>(memoryValue)) {
    return memoryValue;
  }

  try {
    const storedValue = Taro.getStorageSync<unknown>(key);

    if (isPageViewStateEnvelope<T>(storedValue)) {
      memoryState.set(key, storedValue);
      return storedValue;
    }
  } catch {
    return null;
  }

  return null;
}

function persistStateEnvelope<T extends object>(
  key: string,
  envelope: PageViewStateEnvelope<T>,
): void {
  try {
    Taro.setStorageSync(key, envelope);
  } catch {
    pruneOldestStateEntries(Math.ceil(MAX_PAGE_VIEW_STATE_ENTRIES / 4));

    try {
      Taro.setStorageSync(key, envelope);
    } catch {
      // Keep the in-memory state for the current session when local storage is full.
    }
  }
}

function rememberStateKey(key: string, savedAt: number): void {
  const index = readStateIndex();
  index[key] = savedAt;

  const entries = Object.entries(index).sort((left, right) => right[1] - left[1]);
  const nextIndex: PageViewStateIndex = {};

  entries.forEach(([entryKey, entrySavedAt], indexInList) => {
    if (indexInList < MAX_PAGE_VIEW_STATE_ENTRIES) {
      nextIndex[entryKey] = entrySavedAt;
      return;
    }

    memoryState.delete(entryKey);
    removeStorageEntry(entryKey);
  });

  writeStateIndex(nextIndex);
}

function pruneOldestStateEntries(count: number): void {
  const index = readStateIndex();
  const entries = Object.entries(index).sort((left, right) => left[1] - right[1]);
  const nextIndex = { ...index };

  entries.slice(0, count).forEach(([entryKey]) => {
    delete nextIndex[entryKey];
    memoryState.delete(entryKey);
    removeStorageEntry(entryKey);
  });

  writeStateIndex(nextIndex);
}

function readStateIndex(): PageViewStateIndex {
  try {
    const value = Taro.getStorageSync<unknown>(PAGE_VIEW_STATE_INDEX_KEY);

    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, number] => {
          return typeof entry[0] === "string" && typeof entry[1] === "number";
        }),
      );
    }
  } catch {
    return {};
  }

  return {};
}

function writeStateIndex(index: PageViewStateIndex): void {
  try {
    Taro.setStorageSync(PAGE_VIEW_STATE_INDEX_KEY, index);
  } catch {
    // The index is best-effort cleanup metadata.
  }
}

function removeStorageEntry(key: string): void {
  try {
    Taro.removeStorageSync(key);
  } catch {
    // Best-effort cleanup only.
  }
}

function isPageViewStateEnvelope<T extends object>(
  value: unknown,
): value is PageViewStateEnvelope<T> {
  return (
    isRecord(value) &&
    value.version === PAGE_VIEW_STATE_VERSION &&
    typeof value.savedAt === "number" &&
    isRecord(value.data)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 96);
}
