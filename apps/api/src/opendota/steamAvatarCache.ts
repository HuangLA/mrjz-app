import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONTENT_TYPE = "image/jpeg";

export type CachedSteamAvatar = {
  bytes: Buffer;
  contentType: string;
};

export function steamAvatarCachePath(accountId: number): string {
  return path.join(steamAvatarCacheDir(), `${accountId}.jpg`);
}

export async function readSteamAvatarCache(accountId: number): Promise<CachedSteamAvatar | null> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    return null;
  }

  try {
    return {
      bytes: await readFile(steamAvatarCachePath(accountId)),
      contentType: DEFAULT_CONTENT_TYPE,
    };
  } catch {
    return null;
  }
}

export async function cacheSteamAvatar(accountId: number, avatarUrl: string | null | undefined): Promise<boolean> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !avatarUrl) {
    return false;
  }

  const response = await fetch(avatarUrl, {
    headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
  });

  if (!response.ok) {
    return false;
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length === 0) {
    return false;
  }

  await mkdir(steamAvatarCacheDir(), { recursive: true });
  await writeFile(steamAvatarCachePath(accountId), bytes);
  return true;
}

function steamAvatarCacheDir(): string {
  if (process.env.STEAM_AVATAR_CACHE_DIR) {
    return process.env.STEAM_AVATAR_CACHE_DIR;
  }

  const databasePath = process.env.MRJZ_DB_PATH;

  if (databasePath) {
    return path.join(path.dirname(databasePath), "steam-avatars");
  }

  return path.resolve(process.cwd(), "var", "steam-avatars");
}
