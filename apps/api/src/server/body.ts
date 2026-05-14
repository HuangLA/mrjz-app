import type { IncomingMessage } from "node:http";

const MAX_BODY_BYTES = 1024 * 1024;

export async function readJsonBody<T extends Record<string, unknown>>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body is too large");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (raw.trim().length === 0) {
    return {} as T;
  }

  const parsed: unknown = JSON.parse(raw);

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }

  return parsed as T;
}
