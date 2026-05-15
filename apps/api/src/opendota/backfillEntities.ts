import "../env.js";
import { backfillCachedTournamentEntities } from "../data/repository.js";

const tournamentId = process.argv[2];
const summary = backfillCachedTournamentEntities(tournamentId);

console.log(JSON.stringify(summary, null, 2));
