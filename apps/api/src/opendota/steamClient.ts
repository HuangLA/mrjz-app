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

const DEFAULT_BASE_URL = "https://api.steampowered.com";

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
}
