import Taro from "@tarojs/taro";
import { getApiBaseUrl } from "./runtimeConfig";

const PAGE_CACHE_PREFIX = "mrjz.pageCache.v1";
const PAGE_CACHE_INDEX_KEY = `${PAGE_CACHE_PREFIX}:index`;
const PAGE_CACHE_VERSION = 1;
const MAX_PAGE_CACHE_ENTRIES = 80;
const DEFAULT_PAGE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const FAST_PAGE_CACHE_MAX_AGE_MS = 60 * 1000;
const DETAIL_PAGE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type PageCacheEnvelope<T> = {
  data: T;
  savedAt: number;
  version: typeof PAGE_CACHE_VERSION;
};

type PageCacheIndex = Record<string, number>;

const memoryCache = new Map<string, PageCacheEnvelope<unknown>>();

export function pageCacheKey(
  scope: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const apiBase = sanitizeKeyPart(getApiBaseUrl());
  const suffix = parts.map((part) => sanitizeKeyPart(String(part ?? "default"))).join(":");

  return [PAGE_CACHE_PREFIX, apiBase, sanitizeKeyPart(scope), suffix].filter(Boolean).join(":");
}

export function readPageCache<T>(key: string): T | null {
  const envelope = readPageCacheEnvelope<T>(key);

  return envelope ? envelope.data : null;
}

export function isPageCacheFresh(key: string, maxAgeMs?: number): boolean {
  const envelope = readPageCacheEnvelope<unknown>(key);

  if (!envelope) {
    return false;
  }

  return Date.now() - envelope.savedAt <= (maxAgeMs ?? defaultFreshnessMs(key));
}

export function writePageCache<T>(key: string, value: T): void {
  const envelope: PageCacheEnvelope<T> = {
    data: value,
    savedAt: Date.now(),
    version: PAGE_CACHE_VERSION,
  };

  memoryCache.set(key, envelope);
  persistCacheEnvelope(key, envelope);
  rememberCacheKey(key, envelope.savedAt);
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 96);
}

function readPageCacheEnvelope<T>(key: string): PageCacheEnvelope<T> | null {
  const memoryValue = memoryCache.get(key);

  if (isPageCacheEnvelope<T>(memoryValue)) {
    return memoryValue;
  }

  try {
    const storedValue = Taro.getStorageSync<unknown>(key);

    if (isPageCacheEnvelope<T>(storedValue)) {
      memoryCache.set(key, storedValue);
      return storedValue;
    }
  } catch {
    return null;
  }

  return null;
}

function persistCacheEnvelope<T>(key: string, envelope: PageCacheEnvelope<T>): void {
  try {
    Taro.setStorageSync(key, envelope);
  } catch {
    pruneOldestCacheEntries(Math.ceil(MAX_PAGE_CACHE_ENTRIES / 4));

    try {
      Taro.setStorageSync(key, envelope);
    } catch {
      // Keep the in-memory cache for the current session when local storage is full.
    }
  }
}

function rememberCacheKey(key: string, savedAt: number): void {
  const index = readCacheIndex();
  index[key] = savedAt;

  const entries = Object.entries(index).sort((left, right) => right[1] - left[1]);
  const nextIndex: PageCacheIndex = {};

  entries.forEach(([entryKey, entrySavedAt], indexInList) => {
    if (indexInList < MAX_PAGE_CACHE_ENTRIES) {
      nextIndex[entryKey] = entrySavedAt;
      return;
    }

    memoryCache.delete(entryKey);
    removeStorageEntry(entryKey);
  });

  writeCacheIndex(nextIndex);
}

function pruneOldestCacheEntries(count: number): void {
  const index = readCacheIndex();
  const entries = Object.entries(index).sort((left, right) => left[1] - right[1]);
  const nextIndex = { ...index };

  entries.slice(0, count).forEach(([entryKey]) => {
    delete nextIndex[entryKey];
    memoryCache.delete(entryKey);
    removeStorageEntry(entryKey);
  });

  writeCacheIndex(nextIndex);
}

function readCacheIndex(): PageCacheIndex {
  try {
    const value = Taro.getStorageSync<unknown>(PAGE_CACHE_INDEX_KEY);

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

function writeCacheIndex(index: PageCacheIndex): void {
  try {
    Taro.setStorageSync(PAGE_CACHE_INDEX_KEY, index);
  } catch {
    // The index is an optimization; page reads still work from known keys.
  }
}

function removeStorageEntry(key: string): void {
  try {
    Taro.removeStorageSync(key);
  } catch {
    // Best-effort cleanup only.
  }
}

function isPageCacheEnvelope<T>(value: unknown): value is PageCacheEnvelope<T> {
  return (
    isRecord(value) &&
    value.version === PAGE_CACHE_VERSION &&
    typeof value.savedAt === "number" &&
    "data" in value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultFreshnessMs(key: string): number {
  if (key.includes(":stage:") || key.includes(":schedule:")) {
    return FAST_PAGE_CACHE_MAX_AGE_MS;
  }

  if (
    key.includes(":match-detail:") ||
    key.includes(":player-detail:") ||
    key.includes(":team-detail:")
  ) {
    return DETAIL_PAGE_CACHE_MAX_AGE_MS;
  }

  return DEFAULT_PAGE_CACHE_MAX_AGE_MS;
}
