#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const apiBaseUrl = trimTrailingSlash(process.env.MRJZ_VISUAL_PARITY_API_BASE_URL || "http://127.0.0.1:3001/api");
const h5Port = Number(process.env.MRJZ_VISUAL_PARITY_H5_PORT || 6174);
const miniPort = Number(process.env.MRJZ_VISUAL_PARITY_MINI_PORT || 6175);
const viewportWidth = Number(process.env.MRJZ_VISUAL_PARITY_WIDTH || 390);
const viewportHeight = Number(process.env.MRJZ_VISUAL_PARITY_HEIGHT || 844);
const diffThreshold = Number(process.env.MRJZ_VISUAL_PARITY_THRESHOLD || 0.08);
const strictMode = process.env.MRJZ_VISUAL_PARITY_STRICT === "1";
const skipBuild = process.env.MRJZ_VISUAL_PARITY_SKIP_BUILD === "1";
const artifactRoot = path.join(rootDir, "artifacts", "visual-parity");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(artifactRoot, timestamp);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const childProcesses = [];
const staticServers = [];

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  await main();
} finally {
  cleanup();
}

async function main() {
  await mkdir(runDir, { recursive: true });
  await Promise.all([
    mkdir(path.join(runDir, "h5"), { recursive: true }),
    mkdir(path.join(runDir, "miniprogram"), { recursive: true }),
    mkdir(path.join(runDir, "diff"), { recursive: true }),
  ]);

  if (!skipBuild) {
    await run("npm", ["--workspace", "@mrjz/mobile-web", "run", "build:local"]);
    await run("npm", ["--workspace", "@mrjz/miniprogram", "run", "build:h5-local"]);
  }

  await ensureApi();
  const snapshot = await loadApiSnapshot();
  const h5Root = path.join(rootDir, "apps", "mobile-web", "dist");
  const miniRoot = path.join(rootDir, "apps", "miniprogram", "dist-h5");

  if (!existsSync(h5Root) || !existsSync(miniRoot)) {
    throw new Error("Missing static build outputs. Run without MRJZ_VISUAL_PARITY_SKIP_BUILD or build both frontends first.");
  }

  await ensureMiniProgramH5Host(miniRoot);

  staticServers.push(await serveStatic(h5Root, h5Port));
  staticServers.push(await serveStatic(miniRoot, miniPort));

  const pages = buildPageSpecs(snapshot);
  const browser = await chromium.launch({
    executablePath: resolveChromeExecutable(),
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
  });

  const results = [];
  try {
    for (const pageSpec of pages) {
      const result = await captureAndCompare(browser, pageSpec, snapshot);
      results.push(result);
      const marker = result.diffRatio <= diffThreshold ? "pass" : "diff";
      console.log(
        `[visual:parity] ${marker} ${pageSpec.name}: ${(result.diffRatio * 100).toFixed(2)}% ` +
          `(${result.mismatchedPixels}/${result.comparedPixels})`,
      );
    }
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 2,
    },
    sample: snapshot,
    threshold: diffThreshold,
    results,
  };
  await writeFile(path.join(runDir, "report.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(runDir, "report.md"), renderMarkdownReport(summary));
  await updateLatestSymlink(runDir);

  const failed = results.filter((result) => result.diffRatio > diffThreshold);
  console.log(`[visual:parity] report: ${path.join(runDir, "report.md")}`);

  if (strictMode && failed.length > 0) {
    throw new Error(`${failed.length} pages exceed visual parity threshold ${diffThreshold}`);
  }
}

async function ensureApi() {
  if (await canFetch(`${apiOrigin()}/health`)) {
    return;
  }

  const child = spawn("npm", ["--workspace", "@mrjz/api", "run", "dev"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });
  childProcesses.push(child);
  await waitForUrl(`${apiOrigin()}/health`, 60_000);
}

async function loadApiSnapshot() {
  const tournaments = await fetchApi("/tournaments").catch(() => []);
  const tournamentId = tournaments[0]?.id ?? "";
  const [matches, players, teams] =
    tournamentId.length > 0
      ? await Promise.all([
          fetchApi(`/tournaments/${encodeURIComponent(tournamentId)}/matches?limit=12`).catch(() => []),
          fetchApi(`/tournaments/${encodeURIComponent(tournamentId)}/players`).catch(() => []),
          fetchApi(`/tournaments/${encodeURIComponent(tournamentId)}/teams`).catch(() => []),
        ])
      : [[], [], []];

  return {
    tournamentId,
    tournamentName: tournaments[0]?.name ?? "",
    matchId: firstString(matches, "matchId"),
    playerId: firstString(players, "id"),
    teamId: firstString(teams, "id"),
  };
}

function buildPageSpecs(snapshot) {
  const specs = [
    pageSpec("home", "#home", "/pages/index/index"),
    pageSpec("stage", "#stage", "/pages/stage/index"),
    pageSpec("schedule", "#schedule", "/pages/schedule/index"),
    pageSpec("records", "#records", "/pages/records/index"),
    pageSpec("players", "#players", "/pages/players/index"),
    pageSpec("teams", "#teams", "/pages/teams/index"),
  ];

  if (snapshot.matchId.length > 0) {
    specs.push(pageSpec("match-detail", "#match", `/pages/match-detail/index?matchId=${encodeURIComponent(snapshot.matchId)}`));
  }

  if (snapshot.tournamentId.length > 0 && snapshot.playerId.length > 0) {
    specs.push(
      pageSpec(
        "player-detail",
        `#player/${encodeURIComponent(snapshot.playerId)}`,
        `/pages/player-detail/index?tournamentId=${encodeURIComponent(snapshot.tournamentId)}&playerId=${encodeURIComponent(snapshot.playerId)}`,
      ),
    );
  }

  if (snapshot.tournamentId.length > 0 && snapshot.teamId.length > 0) {
    specs.push(
      pageSpec(
        "team-detail",
        `#team/${encodeURIComponent(snapshot.teamId)}`,
        `/pages/team-detail/index?tournamentId=${encodeURIComponent(snapshot.tournamentId)}&teamId=${encodeURIComponent(snapshot.teamId)}`,
      ),
    );
  }

  return specs;
}

function pageSpec(name, h5Hash, miniPath) {
  return {
    name,
    h5Url: `http://127.0.0.1:${h5Port}/?apiBaseUrl=${encodeURIComponent(apiBaseUrl)}${h5Hash}`,
    miniUrl: `http://127.0.0.1:${miniPort}/#${miniPath}`,
  };
}

async function captureAndCompare(browser, pageSpec, snapshot) {
  const h5Path = path.join(runDir, "h5", `${pageSpec.name}.png`);
  const miniPath = path.join(runDir, "miniprogram", `${pageSpec.name}.png`);
  const diffPath = path.join(runDir, "diff", `${pageSpec.name}.png`);

  await capture(browser, pageSpec.h5Url, h5Path, snapshot);
  await capture(browser, pageSpec.miniUrl, miniPath, snapshot);

  const diff = comparePng(h5Path, miniPath, diffPath);

  return {
    name: pageSpec.name,
    h5Url: pageSpec.h5Url,
    miniUrl: pageSpec.miniUrl,
    h5Screenshot: path.relative(rootDir, h5Path),
    miniScreenshot: path.relative(rootDir, miniPath),
    diffScreenshot: path.relative(rootDir, diffPath),
    ...diff,
  };
}

async function capture(browser, url, outputPath, snapshot) {
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  await context.addInitScript(
    ({ tournamentId }) => {
      window.localStorage.setItem("mrjz.selectedTournamentId", tournamentId);
    },
    { tournamentId: snapshot.tournamentId },
  );

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`[visual:parity:console] ${message.text()}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: outputPath, animations: "disabled", caret: "hide" });
  } finally {
    await context.close();
  }
}

function comparePng(h5Path, miniPath, diffPath) {
  const h5 = PNG.sync.read(readFileSync(h5Path));
  const mini = PNG.sync.read(readFileSync(miniPath));
  const width = Math.min(h5.width, mini.width);
  const height = Math.min(h5.height, mini.height);
  const croppedH5 = cropPng(h5, width, height);
  const croppedMini = cropPng(mini, width, height);
  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(croppedH5.data, croppedMini.data, diff.data, width, height, {
    threshold: 0.15,
    includeAA: false,
  });

  writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    comparedPixels: width * height,
    mismatchedPixels,
    diffRatio: (width * height === 0 ? 0 : mismatchedPixels / (width * height)),
  };
}

function cropPng(source, width, height) {
  if (source.width === width && source.height === height) {
    return source;
  }

  const output = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sourceStart = (y * source.width) * 4;
    const sourceEnd = sourceStart + width * 4;
    const targetStart = (y * width) * 4;
    source.data.copy(output.data, targetStart, sourceStart, sourceEnd);
  }
  return output;
}

async function serveStatic(staticRoot, port) {
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    const safePath = normalizeStaticPath(staticRoot, url.pathname);
    const filePath = existsSync(safePath) && statSync(safePath).isFile() ? safePath : path.join(staticRoot, "index.html");
    const type = contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";

    response.setHeader("content-type", type);
    createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return server;
}

async function ensureMiniProgramH5Host(miniRoot) {
  const indexPath = path.join(miniRoot, "index.html");
  if (existsSync(indexPath)) {
    return;
  }

  await writeFile(
    indexPath,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>MRJZ Mini Program H5 Preview</title>
    <link rel="stylesheet" href="/css/app.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/js/509.js"></script>
    <script src="/js/app.js"></script>
  </body>
</html>
`,
  );
}

function normalizeStaticPath(staticRoot, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relativePath = decoded.replace(/^\/+/, "") || "index.html";
  const fullPath = path.resolve(staticRoot, relativePath);

  return fullPath.startsWith(staticRoot) ? fullPath : path.join(staticRoot, "index.html");
}

async function run(command, args) {
  console.log(`[visual:parity] ${command} ${args.join(" ")}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function fetchApi(pathname) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`API ${pathname} failed with ${response.status}`);
  }

  const body = await response.json();
  return body?.success === true ? body.data : body;
}

async function canFetch(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canFetch(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function firstString(items, key) {
  const value = Array.isArray(items) ? items.find((item) => item?.[key] !== undefined)?.[key] : "";
  return value === undefined || value === null ? "" : String(value);
}

function apiOrigin() {
  return new URL(apiBaseUrl).origin;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);

  const chrome = candidates.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error("Chrome executable not found. Set CHROME_PATH to run visual parity screenshots.");
  }
  return chrome;
}

async function updateLatestSymlink(targetDir) {
  const latestPath = path.join(artifactRoot, "latest");
  await rm(latestPath, { recursive: true, force: true });
  await symlink(targetDir, latestPath, "dir").catch(async () => {
    await writeFile(path.join(artifactRoot, "latest.txt"), `${targetDir}\n`);
  });
}

function renderMarkdownReport(summary) {
  const rows = summary.results
    .map((result) => {
      const status = result.diffRatio <= summary.threshold ? "PASS" : "DIFF";
      return `| ${result.name} | ${status} | ${(result.diffRatio * 100).toFixed(2)}% | ${result.h5Screenshot} | ${result.miniScreenshot} | ${result.diffScreenshot} |`;
    })
    .join("\n");

  return `# MRJZ Visual Parity Report

- Generated: ${summary.generatedAt}
- API: ${summary.apiBaseUrl}
- Viewport: ${summary.viewport.width}x${summary.viewport.height} @${summary.viewport.deviceScaleFactor}x
- Sample tournament: ${summary.sample.tournamentName || summary.sample.tournamentId || "none"}
- Threshold: ${(summary.threshold * 100).toFixed(2)}%

| Page | Status | Diff | H5 | Mini Program H5 Preview | Diff Image |
| --- | --- | ---: | --- | --- | --- |
${rows}
`;
}

function cleanup() {
  for (const server of staticServers) {
    server.close();
  }

  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill();
    }
  }
}
