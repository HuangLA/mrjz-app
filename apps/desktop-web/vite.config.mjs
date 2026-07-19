import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const defaultRemoteApiBaseUrl = "https://api.dota2mrjz.icu/api";

function resolveRemoteApiOrigin() {
  const configuredBaseUrl = process.env.MRJZ_REMOTE_API_BASE_URL ?? defaultRemoteApiBaseUrl;

  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return new URL(defaultRemoteApiBaseUrl).origin;
  }
}

export default defineConfig({
  publicDir: fileURLToPath(new URL("../mobile-web/public", import.meta.url)),
  server: {
    proxy:
      process.env.VITE_USE_REMOTE_API_PROXY === "1"
        ? {
            "/api": {
              target: resolveRemoteApiOrigin(),
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
  },
});
