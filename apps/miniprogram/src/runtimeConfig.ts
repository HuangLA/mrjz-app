declare const __MRJZ_MINIPROGRAM_API_BASE_URL__: string | undefined;
declare const __MRJZ_MINIPROGRAM_DOTA_ASSET_BASE_URL__: string | undefined;
declare const __MRJZ_MINIPROGRAM_USE_LOCAL_DOTA_ASSETS__: boolean | undefined;

export function getApiBaseUrl(): string {
  return getBuildApiBaseUrl();
}

export function getDotaAssetBaseUrl(): string {
  if (typeof __MRJZ_MINIPROGRAM_USE_LOCAL_DOTA_ASSETS__ === "boolean" && __MRJZ_MINIPROGRAM_USE_LOCAL_DOTA_ASSETS__) {
    return "/assets/dota";
  }

  const configured =
    typeof __MRJZ_MINIPROGRAM_DOTA_ASSET_BASE_URL__ === "string"
      ? __MRJZ_MINIPROGRAM_DOTA_ASSET_BASE_URL__
      : "";

  return trimTrailingSlash(configured.trim() || `${getApiBaseUrl()}/assets/dota`);
}

export function getSvgAssetBaseUrl(): string {
  return "/assets/svg";
}

function getBuildApiBaseUrl(): string {
  const buildValue =
    typeof __MRJZ_MINIPROGRAM_API_BASE_URL__ === "string" ? __MRJZ_MINIPROGRAM_API_BASE_URL__ : "";

  return trimTrailingSlash(buildValue.trim());
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
