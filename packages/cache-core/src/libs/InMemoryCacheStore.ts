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
  private generation = 0;

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
    this.generation++;
    const inFlight = this.inFlightLoads.get(key);
    if (inFlight !== undefined) {
      inFlight.catch(() => {
        // inFlight 가 reject 되어도 inFlightLoads 에서 제거
      });
    }
    this.store.delete(key);
    this.inFlightLoads.delete(key);
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
    this.generation++;
    this.store.clear();
    this.inFlightLoads.clear();
  }

  close(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
    }
  }

  async invalidatePattern(pattern: CachePattern): Promise<number> {
    this.generation++;
    const matcher = createPatternRegex(pattern);
    let deletedCount = 0;

    const inFlightToRemove = new Set<string>();
    for (const key of this.store.keys()) {
      if (!matcher.test(key)) {
        continue;
      }
      inFlightToRemove.add(key);
    }

    for (const key of this.store.keys()) {
      if (!matcher.test(key)) {
        continue;
      }

      const inFlight = this.inFlightLoads.get(key);
      if (inFlight !== undefined) {
        inFlightToRemove.add(key);
        inFlight.catch(() => {
          // inFlight 가 reject 되어도 inFlightLoads 에서 제거
        });
      }

      this.deleteEntry(key);
      deletedCount++;
    }

    for (const key of inFlightToRemove) {
      this.inFlightLoads.delete(key);
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

    const gen = this.generation;

    const loadPromise = (async () => {
      try {
        const loadedValue = await loader();

        if (loadedValue !== undefined) {
          // Store was cleared/deleted during load — don't restore
          if (this.generation !== gen) {
            return undefined;
          }

          // 현재 캐시 값을 먼저 확인하여 늦은 loader 결과가 새 값으로 덮어쓰는지 확인
          const currentEntry = this.store.get(key);
          if (currentEntry !== undefined) {
            // 현재 캐시에 값이 있다면 저장하지 않음 (다른 set() 이 중간에 호출됨)
            return currentEntry.value;
          }

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
