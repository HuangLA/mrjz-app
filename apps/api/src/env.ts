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
