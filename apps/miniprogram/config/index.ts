import { defineConfig } from "@tarojs/cli";

const outputRoot = process.env.MRJZ_MINIPROGRAM_OUTPUT_ROOT?.trim() || "dist";
const useLocalDotaAssets = isEnabled(process.env.MRJZ_MINIPROGRAM_LOCAL_DOTA_ASSETS);

function resolveBuildApiBaseUrl(): string {
  const configured =
    process.env.MRJZ_MINIPROGRAM_API_BASE_URL?.trim() ||
    process.env.PUBLIC_API_BASE_URL?.trim() ||
    process.env.VITE_PUBLIC_API_BASE_URL?.trim() ||
    "";

  if (configured.length === 0) {
    throw new Error("Set MRJZ_MINIPROGRAM_API_BASE_URL, PUBLIC_API_BASE_URL, or VITE_PUBLIC_API_BASE_URL before building the mini program.");
  }

  return configured.replace(/\/+$/, "");
}

function resolveDotaAssetBaseUrl(): string {
  if (useLocalDotaAssets) {
    return "/assets/dota";
  }

  return (process.env.MRJZ_MINIPROGRAM_DOTA_ASSET_BASE_URL?.trim() || "").replace(/\/+$/, "");
}

function assetCopyPatterns() {
  const patterns = [{ from: "src/assets/svg", to: `${outputRoot}/assets/svg` }];

  if (useLocalDotaAssets) {
    patterns.push({ from: "src/assets/dota", to: `${outputRoot}/assets/dota` });
  }

  return patterns;
}

function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export default defineConfig({
  projectName: "mrjz-miniprogram",
  date: "2026-06-07",
  designWidth: 375,
  deviceRatio: {
    375: 2,
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot,
  framework: "react",
  compiler: "webpack5",
  copy: {
    patterns: assetCopyPatterns(),
    options: {},
  },
  defineConstants: {
    __MRJZ_MINIPROGRAM_API_BASE_URL__: JSON.stringify(resolveBuildApiBaseUrl()),
    __MRJZ_MINIPROGRAM_DOTA_ASSET_BASE_URL__: JSON.stringify(resolveDotaAssetBaseUrl()),
    __MRJZ_MINIPROGRAM_USE_LOCAL_DOTA_ASSETS__: JSON.stringify(useLocalDotaAssets),
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
      },
    },
  },
});
