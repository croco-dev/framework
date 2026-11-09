import { Buffer } from "node:buffer";
import type { Redis } from "ioredis";
import { AbstractCacheStoreAdapter } from "./abstractAdapter";

type SerializedEntry = {
  version: 1;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | null;
};

export class RedisCacheStoreAdapter extends AbstractCacheStoreAdapter {
  private readonly prefix: string;

  constructor(
    private readonly redis: Redis,
    prefix = "isr:",
  ) {
    super();
    // Old readers treat every body as text, so they must not see the byte format.
    this.prefix = `${prefix}response-v1:`;
  }

  async _get(key: string): Promise<Response | undefined> {
    const prefixedKey = `${this.prefix}${key}`;
    const raw = await this.redis.get(prefixedKey);
    if (!raw) {
      return undefined;
    }
    try {
      const entry: unknown = JSON.parse(raw);
      if (!isSerializedEntry(entry)) {
        return undefined;
      }
      const body = entry.body === null ? null : Buffer.from(entry.body, "base64");
      if (body !== null && body.toString("base64") !== entry.body) {
        return undefined;
      }
      return new Response(body, {
        status: entry.status,
        statusText: entry.statusText,
        headers: entry.headers,
      });
    } catch {
      return undefined;
    }
  }

  async _set(key: string, value: Response, ttlMs?: number): Promise<void> {
    const prefixedKey = `${this.prefix}${key}`;
    const body =
      value.body === null ? null : Buffer.from(await value.arrayBuffer()).toString("base64");
    const entry: SerializedEntry = {
      version: 1,
      status: value.status,
      statusText: value.statusText,
      headers: Object.fromEntries(value.headers.entries()),
      body,
    };
    const serialized = JSON.stringify(entry);
    if (ttlMs != null && ttlMs > 0) {
      await this.redis.setex(prefixedKey, Math.ceil(ttlMs / 1000), serialized);
    } else {
      await this.redis.set(prefixedKey, serialized);
    }
  }

  async _delete(key: string): Promise<void> {
    const prefixedKey = `${this.prefix}${key}`;
    await this.redis.del(prefixedKey);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const prefixedPattern = `${this.prefix}${pattern}`;
    const stream = this.redis.scanStream({
      match: prefixedPattern,
      count: 100,
    });

    const pipeline = this.redis.pipeline();
    let keyCount = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (keys: string[]) => {
        for (const key of keys) {
          pipeline.del(key);
          keyCount++;
        }
      });

      stream.on("end", () => {
        resolve();
      });

      stream.on("error", (err: Error) => {
        reject(err);
      });
    });

    if (keyCount > 0) {
      await pipeline.exec();
    }
  }
}

function isSerializedEntry(value: unknown): value is SerializedEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    entry.version === 1 &&
    typeof entry.status === "number" &&
    Number.isInteger(entry.status) &&
    typeof entry.statusText === "string" &&
    typeof entry.headers === "object" &&
    entry.headers !== null &&
    !Array.isArray(entry.headers) &&
    Object.values(entry.headers).every((header) => typeof header === "string") &&
    (entry.body === null || typeof entry.body === "string")
  );
}
