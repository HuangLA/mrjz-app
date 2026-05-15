import type { SteamLeagueMatch } from "./types.js";

export type SteamDotaClientOptions = {
  baseUrl?: string;
  apiKey?: string;
};

type SteamMatchHistoryResponse = {
  result?: {
    status?: number;
    total_results?: number;
    num_results?: number;
    results_remaining?: number;
    matches?: SteamLeagueMatch[];
  };
};

export type SteamPlayerSummary = {
  steamid: string;
  personaname?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
};

type SteamPlayerSummariesResponse = {
  response?: {
    players?: SteamPlayerSummary[];
  };
};

const DEFAULT_BASE_URL = "https://api.steampowered.com";
const STEAM_ID_BASE = 76561197960265728n;

export function accountIdToSteamId64(accountId: number): string {
  return (STEAM_ID_BASE + BigInt(accountId)).toString();
}

export function steamId64ToAccountId(steamId64: string): number | null {
  const parsed = BigInt(steamId64);
  const accountId = parsed - STEAM_ID_BASE;

  if (accountId <= 0n || accountId > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(accountId);
}

export class SteamDotaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: SteamDotaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.STEAM_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? process.env.STEAM_API_KEY;
  }

  get available(): boolean {
    return this.apiKey !== undefined && this.apiKey.length > 0;
  }

  async getLeagueMatches(leagueId: number, matchesRequested = 100): Promise<SteamLeagueMatch[]> {
    if (!this.available) {
      return [];
    }

    const url = new URL(`${this.baseUrl}/IDOTA2Match_570/GetMatchHistory/v1/`);
    url.searchParams.set("key", this.apiKey ?? "");
    url.searchParams.set("league_id", String(leagueId));
    url.searchParams.set("matches_requested", String(matchesRequested));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Steam GetMatchHistory failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as SteamMatchHistoryResponse;

    if (body.result?.status !== undefined && body.result.status !== 1) {
      throw new Error(`Steam GetMatchHistory returned status ${body.result.status}`);
    }

    return body.result?.matches ?? [];
  }

  async getPlayerSummariesByAccountIds(accountIds: number[]): Promise<Array<SteamPlayerSummary & { accountId: number }>> {
    if (!this.available || accountIds.length === 0) {
      return [];
    }

    const steamIdToAccountId = new Map<string, number>();
    const steamIds = [...new Set(accountIds)]
      .filter((accountId) => Number.isSafeInteger(accountId) && accountId > 0)
      .map((accountId) => {
        const steamId = accountIdToSteamId64(accountId);
        steamIdToAccountId.set(steamId, accountId);
        return steamId;
      });
    const summaries: Array<SteamPlayerSummary & { accountId: number }> = [];

    for (let index = 0; index < steamIds.length; index += 100) {
      const batch = steamIds.slice(index, index + 100);
      const players = await this.getPlayerSummaries(batch);

      for (const player of players) {
        const accountId = steamIdToAccountId.get(player.steamid) ?? steamId64ToAccountId(player.steamid);

        if (accountId !== null && accountId !== undefined) {
          summaries.push({ ...player, accountId });
        }
      }
    }

    return summaries;
  }

  private async getPlayerSummaries(steamIds: string[]): Promise<SteamPlayerSummary[]> {
    if (!this.available || steamIds.length === 0) {
      return [];
    }

    const url = new URL(`${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`);
    url.searchParams.set("key", this.apiKey ?? "");
    url.searchParams.set("steamids", steamIds.join(","));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Steam GetPlayerSummaries failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as SteamPlayerSummariesResponse;

    return body.response?.players ?? [];
  }
}
