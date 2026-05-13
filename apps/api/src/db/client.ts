import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const defaultDatabasePath = "var/mrjz.sqlite";

export function resolveDatabasePath(): string {
  const configuredPath = process.env.MRJZ_DB_PATH ?? defaultDatabasePath;

  return isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
}

export function databaseFileExists(): boolean {
  return existsSync(resolveDatabasePath());
}

export function openDatabase(options: { create?: boolean; readOnly?: boolean } = {}): DatabaseSync {
  const databasePath = resolveDatabasePath();

  if (options.create === true) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath, {
    enableForeignKeyConstraints: true,
    readOnly: options.readOnly ?? false,
    timeout: 5000,
  });
  database.exec("PRAGMA foreign_keys = ON;");

  return database;
}

export function readMigration(version: string): string {
  const migrationUrl = new URL(`../../db/migrations/${version}.sql`, import.meta.url);

  return readFileSync(fileURLToPath(migrationUrl), "utf8");
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
