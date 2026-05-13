import {
  getBracketByStageId,
  getMatchContextByMatchId,
  getRoundsByStageId,
  getStandingsByStageId,
  getTournamentById,
  listTournamentSummaries,
} from "./mock/tournaments.js";
import { openDotaMatches } from "./mock/opendotaMatches.js";
import { normalizeOpenDotaMatchDetail } from "../opendota/normalizers/matchDetail.js";

export function getMatchDetail(matchIdParam: string) {
  const matchId = Number(matchIdParam);

  if (!Number.isSafeInteger(matchId)) {
    return undefined;
  }

  const rawMatch = openDotaMatches[matchId];

  if (rawMatch === undefined) {
    return undefined;
  }

  return normalizeOpenDotaMatchDetail(rawMatch, getMatchContextByMatchId(matchId));
}

export function listTournaments() {
  return listTournamentSummaries();
}

export function getTournamentDetail(id: string) {
  return getTournamentById(id);
}

export function getStageStandings(stageId: string) {
  return getStandingsByStageId(stageId);
}

export function getStageRounds(stageId: string) {
  return getRoundsByStageId(stageId);
}

export function getStageBracket(stageId: string) {
  return getBracketByStageId(stageId);
}
