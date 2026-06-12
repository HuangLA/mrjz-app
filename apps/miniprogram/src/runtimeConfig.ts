import Taro from "@tarojs/taro";

declare const __MRJZ_MINIPROGRAM_API_BASE_URL__: string | undefined;
declare const __MRJZ_MINIPROGRAM_DOTA_ASSET_BASE_URL__: string | undefined;
declare const __MRJZ_MINIPROGRAM_USE_LOCAL_DOTA_ASSETS__: boolean | undefined;
declare const __MRJZ_DEPLOY_ENV__: string | undefined;

const LOCAL_API_BASE_URL = "http://127.0.0.1:3001/api";
const API_BASE_STORAGE_KEY = "mrjz.apiBaseUrl";

export function getApiBaseUrl(): string {
  const stored = Taro.getStorageSync<string>(API_BASE_STORAGE_KEY);

  return stored && stored.trim().length > 0 ? trimTrailingSlash(stored) : getBuildApiBaseUrl();
}

export function setApiBaseUrl(value: string): void {
  const nextValue = trimTrailingSlash(value.trim());

  if (nextValue.length === 0) {
    Taro.removeStorageSync(API_BASE_STORAGE_KEY);
    return;
  }

  Taro.setStorageSync(API_BASE_STORAGE_KEY, nextValue);
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

export function getDeployEnv(): string {
  return typeof __MRJZ_DEPLOY_ENV__ === "string" && __MRJZ_DEPLOY_ENV__.trim().length > 0
    ? __MRJZ_DEPLOY_ENV__.trim()
    : "local";
}

export function isLocalDeployEnv(): boolean {
  return getDeployEnv() === "local";
}

function getBuildApiBaseUrl(): string {
  const buildValue =
    typeof __MRJZ_MINIPROGRAM_API_BASE_URL__ === "string" ? __MRJZ_MINIPROGRAM_API_BASE_URL__ : "";

  return trimTrailingSlash(buildValue.trim() || LOCAL_API_BASE_URL);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
