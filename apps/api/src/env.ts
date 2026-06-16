import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const candidateRoots = [
  process.cwd(),
  resolve(moduleDir, "../../.."),
  resolve(moduleDir, "../../../.."),
];
const seen = new Set<string>();

for (const root of candidateRoots) {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(root, fileName);

    if (seen.has(filePath) || !existsSync(filePath)) {
      continue;
    }

    seen.add(filePath);
    loadEnvFile(filePath);
  }
}

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (isTruthy(process.env.MRJZ_ALLOW_DEV_WECHAT_LOGIN)) {
    throw new Error("MRJZ_ALLOW_DEV_WECHAT_LOGIN must not be enabled in production");
  }

  const allowedOrigins = parseCsvEnv(process.env.MRJZ_ALLOWED_ORIGINS);

  if (allowedOrigins.includes("*")) {
    throw new Error("MRJZ_ALLOWED_ORIGINS must not contain * in production");
  }

  const devOrigins = allowedOrigins.filter(isLocalDevelopmentOrigin);

  if (devOrigins.length > 0) {
    throw new Error("MRJZ_ALLOWED_ORIGINS must not include localhost or 127.0.0.1 in production");
  }
}

function loadEnvFile(filePath: string): void {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquote(trimmed.slice(separatorIndex + 1).trim());

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isTruthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}
