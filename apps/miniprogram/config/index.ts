import { defineConfig } from "@tarojs/cli";

const LOCAL_API_BASE_URL = "http://127.0.0.1:3001/api";

function resolveBuildApiBaseUrl(): string {
  return (
    process.env.MRJZ_MINIPROGRAM_API_BASE_URL?.trim() ||
    process.env.PUBLIC_API_BASE_URL?.trim() ||
    process.env.VITE_PUBLIC_API_BASE_URL?.trim() ||
    LOCAL_API_BASE_URL
  ).replace(/\/+$/, "");
}

function resolveDeployEnv(): string {
  const configured = process.env.MRJZ_DEPLOY_ENV?.trim();

  if (configured) {
    return configured;
  }

  const apiBaseUrl = resolveBuildApiBaseUrl().toLowerCase();

  return apiBaseUrl.startsWith("http://127.0.0.1") || apiBaseUrl.startsWith("http://localhost")
    ? "local"
    : "production";
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
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  copy: {
    patterns: [{ from: "src/assets", to: "dist/assets" }],
    options: {},
  },
  defineConstants: {
    __MRJZ_MINIPROGRAM_API_BASE_URL__: JSON.stringify(resolveBuildApiBaseUrl()),
    __MRJZ_DEPLOY_ENV__: JSON.stringify(resolveDeployEnv()),
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
