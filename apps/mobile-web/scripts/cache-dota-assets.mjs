import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const publicRoot = path.join(appRoot, "public", "static", "dota");
const constantsRoot = path.join(publicRoot, "constants");
const heroRoot = path.join(publicRoot, "heroes");
const heroIconRoot = path.join(publicRoot, "hero-icons");
const itemRoot = path.join(publicRoot, "items");
const abilityRoot = path.join(publicRoot, "abilities");

const constantsBaseUrl = "https://raw.githubusercontent.com/odota/dotaconstants/master/build";
const steamCdnBaseUrl = "https://cdn.cloudflare.steamstatic.com";
const constantNames = ["heroes", "item_ids", "ability_ids", "hero_abilities"];
const concurrency = Number.parseInt(process.env.DOTA_ASSET_CONCURRENCY ?? "16", 10);

await Promise.all([constantsRoot, heroRoot, heroIconRoot, itemRoot, abilityRoot].map((dir) => mkdir(dir, { recursive: true })));

const constants = Object.fromEntries(
  await Promise.all(constantNames.map(async (name) => [name, await loadConstant(name)])),
);
const assets = collectAssets(constants);
const results = await mapLimit([...assets.values()], Number.isFinite(concurrency) ? concurrency : 16, downloadAsset);
const summary = summarize(results);

await writeFile(path.join(publicRoot, "asset-manifest.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), ...summary }, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));

async function loadConstant(name) {
  const localPath = path.join(constantsRoot, `${name}.json`);
  const response = await fetch(`${constantsBaseUrl}/${name}.json`);

  if (!response.ok) {
    return JSON.parse(await readFile(localPath, "utf8"));
  }

  const json = await response.json();
  await writeFile(localPath, `${JSON.stringify(json)}\n`);
  return json;
}

function collectAssets({ heroes, item_ids: itemIds, ability_ids: abilityIds }) {
  const assetsByFile = new Map();

  for (const hero of Object.values(heroes)) {
    if (!hero || typeof hero.img !== "string") {
      continue;
    }

    const sourcePath = normalizeDotaAssetPath(hero.img);
    const filename = path.basename(sourcePath);
    addAsset(assetsByFile, {
      type: "hero",
      url: `${steamCdnBaseUrl}${sourcePath}`,
      file: path.join(heroRoot, filename),
    });

    if (typeof hero.icon === "string") {
      const iconSourcePath = normalizeDotaAssetPath(hero.icon);
      const iconFilename = path.basename(iconSourcePath);
      addAsset(assetsByFile, {
        type: "heroIcon",
        url: `${steamCdnBaseUrl}${iconSourcePath}`,
        file: path.join(heroIconRoot, iconFilename),
      });
    }
  }

  for (const itemName of Object.values(itemIds)) {
    if (!isAssetName(itemName)) {
      continue;
    }

    addAsset(assetsByFile, {
      type: "item",
      url: `${steamCdnBaseUrl}/apps/dota2/images/dota_react/items/${itemName}.png`,
      file: path.join(itemRoot, `${itemName}.png`),
    });
  }

  for (const abilityName of Object.values(abilityIds)) {
    if (!isAbilityImageName(abilityName)) {
      continue;
    }

    addAsset(assetsByFile, {
      type: "ability",
      url: `${steamCdnBaseUrl}/apps/dota2/images/dota_react/abilities/${abilityName}.png`,
      file: path.join(abilityRoot, `${abilityName}.png`),
    });
  }

  return assetsByFile;
}

function addAsset(assetsByFile, asset) {
  assetsByFile.set(asset.file, asset);
}

function normalizeDotaAssetPath(value) {
  return value.replace(/\?.*$/, "");
}

function isAssetName(value) {
  return typeof value === "string" && value.length > 0 && /^[a-z0-9_]+$/.test(value);
}

function isAbilityImageName(value) {
  return (
    isAssetName(value) &&
    value !== "ability_base" &&
    value !== "dota_base_ability" &&
    value !== "generic_hidden" &&
    value !== "attribute_bonus" &&
    !value.startsWith("special_bonus")
  );
}

async function downloadAsset(asset) {
  const existing = await fileExists(asset.file);

  if (existing) {
    return { status: "cached", type: asset.type };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(asset.url, { signal: controller.signal });

    if (!response.ok) {
      return { status: "missing", type: asset.type, url: asset.url, httpStatus: response.status };
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length === 0) {
      return { status: "missing", type: asset.type, url: asset.url, httpStatus: 0 };
    }

    await writeFile(asset.file, bytes);
    return { status: "downloaded", type: asset.type };
  } catch (error) {
    return { status: "failed", type: asset.type, url: asset.url, message: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function fileExists(file) {
  try {
    const fileStat = await stat(file);
    return fileStat.isFile() && fileStat.size > 0;
  } catch {
    return false;
  }
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.max(1, limit) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index]);
      }
    }),
  );

  return results;
}

function summarize(results) {
  const summary = {
    total: results.length,
    downloaded: 0,
    cached: 0,
    missing: 0,
    failed: 0,
    byType: {},
  };

  for (const result of results) {
    summary[result.status] += 1;
    summary.byType[result.type] ??= { downloaded: 0, cached: 0, missing: 0, failed: 0 };
    summary.byType[result.type][result.status] += 1;
  }

  return summary;
}
