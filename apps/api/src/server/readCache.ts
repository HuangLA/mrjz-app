type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const MAX_ENTRIES = 500;
const store = new Map<string, CacheEntry>();

export function cached<T>(key: string, ttlMs: number, producer: () => T): T {
  const now = Date.now();
  const hit = store.get(key);

  if (hit !== undefined && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = producer();
  evictIfNeeded(now);
  store.set(key, { value, expiresAt: now + ttlMs });

  return value;
}

export function invalidateReadCache(): void {
  store.clear();
}

export function readCacheStats(): { size: number } {
  return { size: store.size };
}

function evictIfNeeded(now: number): void {
  if (store.size < MAX_ENTRIES) {
    return;
  }

  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }

  while (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;

    if (oldestKey === undefined) {
      return;
    }

    store.delete(oldestKey);
  }
}
