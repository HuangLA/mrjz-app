import type { OpenDotaMatchDetail } from "./types.js";

const IGNORED_OPENDOTA_MATCH_IDS = new Set([
  8882609976,
  8882633285,
  8882635063,
]);

export function isIgnoredOpenDotaMatchId(matchId: number): boolean {
  return Number.isSafeInteger(matchId) && IGNORED_OPENDOTA_MATCH_IDS.has(matchId);
}

export function isIgnoredOpenDotaMatch(
  match: OpenDotaMatchDetail,
  fallbackMatchId = match.match_id,
): boolean {
  return isIgnoredOpenDotaMatchId(fallbackMatchId) || hasZeroZeroScore(match);
}

function hasZeroZeroScore(match: OpenDotaMatchDetail): boolean {
  return match.radiant_score === 0 && match.dire_score === 0;
}
