import "../env.js";
import { runSteamProfileSync } from "./syncWorker.js";

console.log(JSON.stringify(await runSteamProfileSync(), null, 2));
