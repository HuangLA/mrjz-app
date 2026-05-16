import { OpenDotaClient } from "./client.js";
import { cacheSteamAvatar } from "./steamAvatarCache.js";
import { accountIdToSteamId64, SteamDotaClient, steamId64ToAccountId, type SteamPlayerSummary } from "./steamClient.js";

export type ResolvedPlayerProfile = {
  accountId: number;
  steamId64: string;
  displayName: string | null;
  avatarUrl: string | null;
  source: "steam" | "opendota" | "fallback";
  errors: string[];
};

type ResolvePlayerProfileOptions = {
  openDotaClient?: OpenDotaClient;
  steamClient?: SteamDotaClient;
};

export async function resolvePlayerProfileBySteamId(
  rawSteamId: string,
  options: ResolvePlayerProfileOptions = {},
): Promise<ResolvedPlayerProfile> {
  const identity = parseSteamIdentity(rawSteamId);
  const openDotaClient = options.openDotaClient ?? new OpenDotaClient();
  const steamClient = options.steamClient ?? new SteamDotaClient();
  const errors: string[] = [];

  if (steamClient.available) {
    try {
      const [summary] = await steamClient.getPlayerSummariesBySteamIds([identity.steamId64]);

      if (summary !== undefined) {
        const avatarUrl = steamAvatarUrl(summary);
        await cacheAvatarBestEffort(identity.accountId, avatarUrl, errors);

        return {
          ...identity,
          displayName: summary.personaname?.trim() || null,
          avatarUrl,
          source: "steam",
          errors,
        };
      }
    } catch (error) {
      errors.push(`Steam profile lookup failed: ${errorMessage(error)}`);
    }
  }

  try {
    const profile = (await openDotaClient.getPlayerProfile(identity.accountId)).profile;

    if (profile !== undefined) {
      const avatarUrl = profile.avatarfull?.trim() || profile.avatarmedium?.trim() || profile.avatar?.trim() || null;
      await cacheAvatarBestEffort(identity.accountId, avatarUrl, errors);

      return {
        ...identity,
        displayName: profile.personaname?.trim() || profile.name?.trim() || null,
        avatarUrl,
        source: "opendota",
        errors,
      };
    }
  } catch (error) {
    errors.push(`OpenDota profile lookup failed: ${errorMessage(error)}`);
  }

  return {
    ...identity,
    displayName: null,
    avatarUrl: null,
    source: "fallback",
    errors,
  };
}

export function parseSteamIdentity(rawSteamId: string): { accountId: number; steamId64: string } {
  const value = rawSteamId.trim();
  const steam3Match = value.match(/^\[U:1:(\d+)]$/i);
  const normalized = steam3Match?.[1] ?? value.replace(/\D/g, "");

  if (normalized.length === 0) {
    throw new Error("steamId is required");
  }

  if (normalized.length >= 16) {
    const accountId = steamId64ToAccountId(normalized);

    if (accountId === null) {
      throw new Error("steamId must be a valid SteamID64 or Dota account_id");
    }

    return {
      accountId,
      steamId64: accountIdToSteamId64(accountId),
    };
  }

  const accountId = Number(normalized);

  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error("steamId must be a valid SteamID64 or Dota account_id");
  }

  return {
    accountId,
    steamId64: accountIdToSteamId64(accountId),
  };
}

function steamAvatarUrl(summary: SteamPlayerSummary): string | null {
  return summary.avatarfull?.trim() || summary.avatarmedium?.trim() || summary.avatar?.trim() || null;
}

async function cacheAvatarBestEffort(accountId: number, avatarUrl: string | null, errors: string[]): Promise<void> {
  if (avatarUrl === null) {
    return;
  }

  try {
    await cacheSteamAvatar(accountId, avatarUrl);
  } catch (error) {
    errors.push(`Steam avatar cache failed: ${errorMessage(error)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
