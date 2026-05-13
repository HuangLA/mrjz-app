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
import { databaseFileExists, resolveDatabasePath } from "../db/client.js";
import { SqliteTournamentRepository } from "./sqliteRepository.js";

type DataSourceInfo =
  | {
      dataSource: "sqlite";
      databasePath: string;
    }
  | {
      dataSource: "mock";
      databasePath: string;
      reason: string;
    };

type Repository = {
  info: DataSourceInfo;
  getMatchDetail(matchIdParam: string): ReturnType<typeof getMockMatchDetail>;
  listTournaments(): ReturnType<typeof listTournamentSummaries>;
  getTournamentDetail(id: string): ReturnType<typeof getTournamentById>;
  getStageStandings(stageId: string): ReturnType<typeof getStandingsByStageId>;
  getStageRounds(stageId: string): ReturnType<typeof getRoundsByStageId>;
  getStageBracket(stageId: string): ReturnType<typeof getBracketByStageId>;
};

const repository = createRepository();

export function getRepositoryInfo(): DataSourceInfo {
  return repository.info;
}

export function getMatchDetail(matchIdParam: string) {
  return repository.getMatchDetail(matchIdParam);
}

export function listTournaments() {
  return repository.listTournaments();
}

export function getTournamentDetail(id: string) {
  return repository.getTournamentDetail(id);
}

export function getStageStandings(stageId: string) {
  return repository.getStageStandings(stageId);
}

export function getStageRounds(stageId: string) {
  return repository.getStageRounds(stageId);
}

export function getStageBracket(stageId: string) {
  return repository.getStageBracket(stageId);
}

function createRepository(): Repository {
  if (databaseFileExists()) {
    try {
      return new SqliteTournamentRepository();
    } catch (error) {
      return createMockRepository(`SQLite open failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return createMockRepository("Database file has not been initialized");
}

function createMockRepository(reason: string): Repository {
  return {
    info: {
      dataSource: "mock",
      databasePath: resolveDatabasePath(),
      reason,
    },
    getMatchDetail: getMockMatchDetail,
    listTournaments: listTournamentSummaries,
    getTournamentDetail: getTournamentById,
    getStageStandings: getStandingsByStageId,
    getStageRounds: getRoundsByStageId,
    getStageBracket: getBracketByStageId,
  };
}

function getMockMatchDetail(matchIdParam: string) {
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
