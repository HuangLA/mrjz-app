import { getApiBaseUrl } from "./runtimeConfig";

const PAGE_CACHE_PREFIX = "mrjz.pageCache.v1";

export function pageCacheKey(
  scope: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const apiBase = sanitizeKeyPart(getApiBaseUrl());
  const suffix = parts.map((part) => sanitizeKeyPart(String(part ?? "default"))).join(":");

  return [PAGE_CACHE_PREFIX, apiBase, sanitizeKeyPart(scope), suffix].filter(Boolean).join(":");
}

export function readPageCache<T>(key: string): T | null {
  void key;
  return null;
}

export function isPageCacheFresh(key: string, maxAgeMs?: number): boolean {
  void key;
  void maxAgeMs;
  return false;
}

export function writePageCache<T>(key: string, value: T): void {
  void key;
  void value;
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 96);
}
