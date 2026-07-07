import type { OpenDotaLeagueMatch, OpenDotaMatchDetail, OpenDotaPlayerMatchSummary, OpenDotaPlayerProfile } from "./types.js";

export type OpenDotaClientOptions = {
  baseUrl?: string;
  apiKey?: string;
};

const DEFAULT_BASE_URL = "https://api.opendota.com/api";

export class OpenDotaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: OpenDotaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.OPENDOTA_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? process.env.OPENDOTA_API_KEY;
  }

  getLeagueMatches(leagueId: number): Promise<OpenDotaLeagueMatch[]> {
    return this.getJson<OpenDotaLeagueMatch[]>(`/leagues/${leagueId}/matches`);
  }

  getLeagueMatchIds(leagueId: number): Promise<number[]> {
    return this.getJson<number[]>(`/leagues/${leagueId}/matchIds`);
  }

  getPlayerMatches(accountId: number, limit: number): Promise<OpenDotaPlayerMatchSummary[]> {
    return this.getJson<OpenDotaPlayerMatchSummary[]>(`/players/${accountId}/matches?limit=${limit}`);
  }

  getPlayerProfile(accountId: number): Promise<OpenDotaPlayerProfile> {
    return this.getJson<OpenDotaPlayerProfile>(`/players/${accountId}`);
  }

  getMatch(matchId: number): Promise<OpenDotaMatchDetail> {
    return this.getJson<OpenDotaMatchDetail>(`/matches/${matchId}`);
  }

  async requestParse(matchId: number): Promise<Record<string, unknown>> {
    return this.getJson<Record<string, unknown>>(`/request/${matchId}`, { method: "POST" });
  }

  private async getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (this.apiKey !== undefined && this.apiKey.length > 0) {
      url.searchParams.set("api_key", this.apiKey);
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenDota ${init.method ?? "GET"} ${path} failed with HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
