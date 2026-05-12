import type { Redis } from "ioredis";
import { AbstractCacheStoreAdapter } from "./abstractAdapter";

type SerializedEntry = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export class RedisCacheStoreAdapter extends AbstractCacheStoreAdapter {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "isr:",
  ) {
    super();
  }

  async _get(key: string): Promise<Response | undefined> {
    const prefixedKey = `${this.prefix}${key}`;
    const raw = await this.redis.get(prefixedKey);
    if (!raw) {
      return undefined;
    }
    try {
      const entry: SerializedEntry = JSON.parse(raw as string);
      return new Response(entry.body, { status: entry.status, headers: entry.headers });
    } catch {
      return undefined;
    }
  }

  async _set(key: string, value: Response, ttlMs?: number): Promise<void> {
    const prefixedKey = `${this.prefix}${key}`;
    const body = await value.text();
    const entry: SerializedEntry = {
      status: value.status,
      headers: Object.fromEntries(value.headers.entries()),
      body,
    };
    const serialized = JSON.stringify(entry);
    if (ttlMs) {
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
