import type { ILogger } from "@croco/framework-context";
import {
  type CacheGetOrSetOptions,
  type CachePattern,
  type CacheStats,
  CacheStore,
  type CacheWarmupEntry,
} from "./CacheStore";

type CacheEntry<V> = {
  value: V;
  expiresAt: number | null;
};

export type InMemoryCacheStoreOptions = {
  maxEntries?: number;
  cleanupIntervalMs?: number;
};

const DEFAULT_MAX_ENTRIES = 1000;
const WILDCARD_REGEX = /[.*+?^${}()|[\]\\]/g;

function escapePattern(pattern: string): string {
  return pattern.replace(WILDCARD_REGEX, "\\$&");
}

function createPatternRegex(pattern: CachePattern): RegExp {
  const escapedPattern = escapePattern(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escapedPattern}$`);
}

export class InMemoryCacheStore<V = unknown> extends CacheStore<string, V> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly inFlightLoads = new Map<string, Promise<V | undefined>>();
  private readonly maxEntries: number;
  private readonly stats: Omit<CacheStats, "size"> = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private readonly cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    options: InMemoryCacheStoreOptions = { maxEntries: DEFAULT_MAX_ENTRIES },
    logger?: ILogger,
  ) {
    super();

    void logger;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

    if (options.cleanupIntervalMs !== undefined) {
      this.cleanupTimer = setInterval(() => {
        this.pruneExpiredSync();
      }, options.cleanupIntervalMs);

      this.cleanupTimer.unref?.();
    }
  }

  async get(key: string): Promise<V | undefined> {
    const entry = this.store.get(key);

    if (entry === undefined) {
      this.stats.misses++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.deleteEntry(key);
      this.stats.misses++;
      return undefined;
    }

    this.touch(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  async set(key: string, value: V, ttlMs?: number): Promise<void> {
    this.pruneExpiredSync();
    this.store.delete(key);
    this.store.set(key, {
      value,
      expiresAt: ttlMs === undefined ? null : Date.now() + ttlMs,
    });
    this.evictOverflow();
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);

    if (entry === undefined) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.deleteEntry(key);
      return false;
    }

    this.touch(key, entry);
    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  close(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
    }
  }

  async invalidatePattern(pattern: CachePattern): Promise<number> {
    const matcher = createPatternRegex(pattern);
    let deletedCount = 0;

    for (const key of this.store.keys()) {
      if (!matcher.test(key)) {
        continue;
      }

      this.deleteEntry(key);
      deletedCount++;
    }

    return deletedCount;
  }

  async pruneExpired(): Promise<number> {
    return this.pruneExpiredSync();
  }

  async getOrSet(
    key: string,
    loader: () => Promise<V | undefined>,
    options: CacheGetOrSetOptions = {},
  ): Promise<V | undefined> {
    const cachedValue = await this.get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const pending = this.inFlightLoads.get(key);
    if (pending !== undefined) {
      return pending;
    }

    const loadPromise = (async () => {
      try {
        const loadedValue = await loader();

        if (loadedValue !== undefined) {
          await this.set(key, loadedValue, options.ttlMs);
        }

        return loadedValue;
      } finally {
        this.inFlightLoads.delete(key);
      }
    })();

    this.inFlightLoads.set(key, loadPromise);
    return loadPromise;
  }

  async warmup(entries: ReadonlyArray<CacheWarmupEntry<string, V>>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttlMs);
    }
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.store.size,
    };
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  private touch(key: string, entry: CacheEntry<V>): void {
    this.store.delete(key);
    this.store.set(key, entry);
  }

  private deleteEntry(key: string): void {
    if (this.store.delete(key)) {
      this.stats.evictions++;
    }
  }

  private pruneExpiredSync(): number {
    let deletedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (!this.isExpired(entry)) {
        continue;
      }

      this.deleteEntry(key);
      deletedCount++;
    }

    return deletedCount;
  }

  private evictOverflow(): void {
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      this.deleteEntry(oldestKey);
    }
  }
}
