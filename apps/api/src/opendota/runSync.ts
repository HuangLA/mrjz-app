import { runOpenDotaBackfillSync, runOpenDotaLeagueSync } from "./syncWorker.js";

const mode = process.argv.includes("--backfill") ? "backfill" : "running";
const summary = mode === "backfill" ? await runOpenDotaBackfillSync() : await runOpenDotaLeagueSync();

console.log(JSON.stringify(summary, null, 2));
