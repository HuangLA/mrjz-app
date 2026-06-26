import Taro from "@tarojs/taro";
import { getApiBaseUrl } from "./runtimeConfig";

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
  version: 1;
};

const PAGE_CACHE_PREFIX = "mrjz.pageCache.v1";
const DEFAULT_PAGE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export function pageCacheKey(scope: string, ...parts: Array<string | number | null | undefined>): string {
  const apiBase = sanitizeKeyPart(getApiBaseUrl());
  const suffix = parts.map((part) => sanitizeKeyPart(String(part ?? "default"))).join(":");

  return [PAGE_CACHE_PREFIX, apiBase, sanitizeKeyPart(scope), suffix].filter(Boolean).join(":");
}

export function readPageCache<T>(key: string): T | null {
  try {
    const stored = Taro.getStorageSync<CacheEnvelope<T> | "">(key);

    return typeof stored === "object" && stored !== null && stored.version === 1 ? stored.value : null;
  } catch {
    return null;
  }
}

export function isPageCacheFresh(key: string, maxAgeMs = DEFAULT_PAGE_CACHE_MAX_AGE_MS): boolean {
  try {
    const stored = Taro.getStorageSync<CacheEnvelope<unknown> | "">(key);

    return (
      typeof stored === "object" &&
      stored !== null &&
      stored.version === 1 &&
      Number.isFinite(stored.savedAt) &&
      Date.now() - stored.savedAt < maxAgeMs
    );
  } catch {
    return false;
  }
}

export function writePageCache<T>(key: string, value: T): void {
  try {
    Taro.setStorageSync(key, {
      savedAt: Date.now(),
      value,
      version: 1,
    } satisfies CacheEnvelope<T>);
  } catch {
    // Cache is best-effort; storage pressure should not block fresh data.
  }
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 96);
}
