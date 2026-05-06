import { FixedWindowStore, SlidingWindowStore, TokenBucketStore } from './RateLimitStore';
import type { FixedWindowPolicy, SlidingWindowPolicy, TokenBucketPolicy } from './types';

export type InMemoryRateLimitStoreOptions = {
  pruneIntervalMs?: number;
};

const DEFAULT_PRUNE_INTERVAL_MS = 60000;

export class FixedWindowInMemoryStore extends FixedWindowStore {
  private readonly windows = new Map<string, { count: number; windowStart: number; windowMs: number }>();
  private readonly globalStats = { allowed: 0, denied: 0, total: 0 };
  private readonly pruneTimer?: ReturnType<typeof setInterval>;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    super();

    const pruneIntervalMs = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
    if (pruneIntervalMs > 0) {
      this.pruneTimer = setInterval(() => {
        void this.pruneExpired();
      }, pruneIntervalMs);
      this.pruneTimer.unref?.();
    }
  }

  close(): void {
    if (this.pruneTimer !== undefined) {
      clearInterval(this.pruneTimer);
    }
  }

  destroy(): void {
    this.close();
  }

  async check(
    key: string,
    policy: FixedWindowPolicy
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetAtMs: number;
  }> {
    const result = await this.checkFixedWindow(key, policy);

    if (result.success) {
      this.globalStats.allowed++;
    } else {
      this.globalStats.denied++;
    }
    this.globalStats.total++;

    return result;
  }

  protected async getWindowEntry(
    key: string,
    policy: FixedWindowPolicy
  ): Promise<{ count: number; windowStart: number; windowMs: number } | null> {
    const entry = this.windows.get(key);
    if (!entry) return null;

    const windowStart = Math.floor(Date.now() / policy.windowMs) * policy.windowMs;
    if (entry.windowStart !== windowStart) {
      return null;
    }

    return entry;
  }

  protected async setWindowEntry(
    key: string,
    entry: { count: number; windowStart: number; windowMs: number }
  ): Promise<void> {
    this.windows.set(key, entry);
  }

  async increment(key: string, amount = 1): Promise<number> {
    const entry = this.windows.get(key);
    if (entry) {
      entry.count += amount;
      return entry.count;
    }
    return amount;
  }

  async getCount(key: string): Promise<number> {
    return this.windows.get(key)?.count ?? 0;
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  async expire(): Promise<void> {
    return;
  }

  async pruneExpired(): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.windows.entries()) {
      const windowEnd = entry.windowStart + entry.windowMs;
      if (now > windowEnd) {
        this.windows.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class SlidingWindowInMemoryStore extends SlidingWindowStore {
  private readonly windows = new Map<string, { timestamps: number[]; windowMs: number }>();
  private readonly globalStats = { allowed: 0, denied: 0, total: 0 };
  private readonly pruneTimer?: ReturnType<typeof setInterval>;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    super();

    const pruneIntervalMs = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
    if (pruneIntervalMs > 0) {
      this.pruneTimer = setInterval(() => {
        void this.pruneExpired();
      }, pruneIntervalMs);
      this.pruneTimer.unref?.();
    }
  }

  close(): void {
    if (this.pruneTimer !== undefined) {
      clearInterval(this.pruneTimer);
    }
  }

  destroy(): void {
    this.close();
  }

  async check(
    key: string,
    policy: SlidingWindowPolicy
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetAtMs: number;
  }> {
    const result = await this.checkSlidingWindow(key, policy);

    if (result.success) {
      this.globalStats.allowed++;
    } else {
      this.globalStats.denied++;
    }
    this.globalStats.total++;

    return result;
  }

  protected async addTimestamp(key: string, timestamp: number): Promise<void> {
    let entry = this.windows.get(key);
    if (!entry) {
      const policy = this.windows.get(key);
      entry = { timestamps: [], windowMs: policy?.windowMs ?? 60000 };
    }
    entry.timestamps.push(timestamp);
    this.windows.set(key, entry);
  }

  protected async getTimestamps(key: string, since: number): Promise<number[]> {
    const entry = this.windows.get(key);
    if (!entry) return [];
    return entry.timestamps.filter((ts) => ts >= since);
  }

  protected async removeTimestamps(key: string, before: number): Promise<void> {
    const entry = this.windows.get(key);
    if (!entry) return;
    entry.timestamps = entry.timestamps.filter((ts) => ts >= before);
    if (entry.timestamps.length === 0) {
      this.windows.delete(key);
    } else {
      this.windows.set(key, entry);
    }
  }

  async increment(): Promise<number> {
    return 0;
  }

  async getCount(): Promise<number> {
    return 0;
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }

  async expire(): Promise<void> {
    return;
  }

  async pruneExpired(): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.windows.entries()) {
      const windowStart = now - entry.windowMs;
      const originalLength = entry.timestamps.length;
      entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

      if (entry.timestamps.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, entry);
      }

      deletedCount += originalLength - entry.timestamps.length;
    }

    return deletedCount;
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class TokenBucketInMemoryStore extends TokenBucketStore {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number; ttlMs: number }>();
  private readonly globalStats = { allowed: 0, denied: 0, total: 0 };
  private readonly pruneTimer?: ReturnType<typeof setInterval>;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    super();

    const pruneIntervalMs = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
    if (pruneIntervalMs > 0) {
      this.pruneTimer = setInterval(() => {
        void this.pruneExpired();
      }, pruneIntervalMs);
      this.pruneTimer.unref?.();
    }
  }

  close(): void {
    if (this.pruneTimer !== undefined) {
      clearInterval(this.pruneTimer);
    }
  }

  destroy(): void {
    this.close();
  }

  async check(
    key: string,
    policy: TokenBucketPolicy
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetAtMs: number;
  }> {
    const result = await this.checkTokenBucket(key, policy);

    if (result.success) {
      this.globalStats.allowed++;
    } else {
      this.globalStats.denied++;
    }
    this.globalStats.total++;

    return result;
  }

  protected async getBucket(key: string): Promise<{ tokens: number; lastRefill: number } | null> {
    return this.buckets.get(key) ?? null;
  }

  protected async setBucket(key: string, entry: { tokens: number; lastRefill: number }, ttlMs: number): Promise<void> {
    this.buckets.set(key, { ...entry, ttlMs });
  }

  async increment(): Promise<number> {
    return 0;
  }

  async getCount(): Promise<number> {
    return 0;
  }

  async reset(): Promise<void> {
    return;
  }

  async expire(): Promise<void> {
    return;
  }

  async pruneExpired(): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.buckets.entries()) {
      if (now <= entry.lastRefill + entry.ttlMs) {
        continue;
      }

      this.buckets.delete(key);
      deletedCount++;
    }

    return deletedCount;
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class InMemoryRateLimitStore extends SlidingWindowInMemoryStore {}
