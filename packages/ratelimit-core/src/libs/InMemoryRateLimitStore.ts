import { FixedWindowStore, SlidingWindowStore, TokenBucketStore } from "./RateLimitStore";
import type {
  FixedWindowPolicy,
  RateLimitPolicy,
  RateLimitRefundReceipt,
  RateLimitRefundResult,
  RateLimitResult,
  SlidingWindowPolicy,
  TokenBucketPolicy,
} from "./types";
import { RateLimitRefundUnsupportedProblem } from "./problems/RateLimitConfigProblems";

export type InMemoryRateLimitStoreOptions = {
  readonly now?: () => number;
  readonly pruneIntervalMs?: number;
  readonly random?: () => number;
  readonly scheduler?: RateLimitPruneScheduler;
};

export interface RateLimitPruneScheduler {
  schedule(callback: () => void | Promise<void>, intervalMs: number): () => void;
}

const DEFAULT_PRUNE_INTERVAL_MS = 60000;

const DEFAULT_PRUNE_SCHEDULER: RateLimitPruneScheduler = {
  schedule(callback, intervalMs) {
    const timer = setTimeout(() => {
      void callback();
    }, intervalMs);
    timer.unref?.();
    return () => clearTimeout(timer);
  },
};

type MutableRateLimitStats = {
  allowed: number;
  denied: number;
  total: number;
};

function recordRefund(stats: MutableRateLimitStats): void {
  stats.allowed = Math.max(0, stats.allowed - 1);
  stats.total = Math.max(0, stats.total - 1);
}

function schedulePruning(
  options: InMemoryRateLimitStoreOptions,
  callback: () => void | Promise<void>,
): (() => void) | undefined {
  const pruneIntervalMs = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
  if (pruneIntervalMs <= 0) return undefined;
  const scheduler = options.scheduler ?? DEFAULT_PRUNE_SCHEDULER;
  let cancelScheduledWork: (() => void) | undefined;
  let closed = false;
  const scheduleNext = () => {
    cancelScheduledWork = scheduler.schedule(async () => {
      await callback();
      if (!closed) scheduleNext();
    }, pruneIntervalMs);
  };
  scheduleNext();
  return () => {
    closed = true;
    cancelScheduledWork?.();
  };
}

export class FixedWindowInMemoryStore extends FixedWindowStore {
  private readonly windows = new Map<
    string,
    { count: number; windowStart: number; windowMs: number }
  >();
  private readonly globalStats = { allowed: 0, denied: 0, total: 0 };
  private readonly cancelPruning?: () => void;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    super(options.now, options.random);

    this.cancelPruning = schedulePruning(options, async () => {
      await this.pruneExpired();
    });
  }

  close(): void {
    this.cancelPruning?.();
  }

  destroy(): void {
    this.close();
  }

  async check(key: string, policy: FixedWindowPolicy): Promise<RateLimitResult> {
    const result = await this.checkFixedWindow(key, policy);

    if (result.success) {
      this.globalStats.allowed++;
    } else {
      this.globalStats.denied++;
    }
    this.globalStats.total++;

    return result;
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    const result = await super.refund(key, policy, receipt);
    if (result.refunded) {
      recordRefund(this.globalStats);
    }
    return result;
  }

  protected async getWindowEntry(
    key: string,
    policy: FixedWindowPolicy,
  ): Promise<{ count: number; windowStart: number; windowMs: number } | null> {
    const entry = this.windows.get(key);
    if (!entry) return null;

    const windowStart = Math.floor(this.now() / policy.windowMs) * policy.windowMs;
    if (entry.windowStart !== windowStart) {
      return null;
    }

    return entry;
  }

  protected async setWindowEntry(
    key: string,
    entry: { count: number; windowStart: number; windowMs: number },
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
    this.clearFixedWindowRefundReceipts(key);
  }

  async expire(): Promise<void> {
    return;
  }

  async pruneExpired(): Promise<number> {
    const now = this.now();
    let deletedCount = 0;

    for (const [key, entry] of this.windows.entries()) {
      const windowEnd = entry.windowStart + entry.windowMs;
      if (now > windowEnd) {
        this.windows.delete(key);
        this.clearFixedWindowRefundReceipts(key);
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
  private readonly windows = new Map<
    string,
    { entries: Array<{ timestamp: number; receiptId: string }>; windowMs: number }
  >();
  private readonly _windowMsCache = new Map<string, number>();
  private readonly globalStats = { allowed: 0, denied: 0, total: 0 };
  private readonly cancelPruning?: () => void;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    super(options.now, options.random);

    this.cancelPruning = schedulePruning(options, async () => {
      await this.pruneExpired();
    });
  }

  close(): void {
    this.cancelPruning?.();
  }

  destroy(): void {
    this.close();
  }

  async check(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult> {
    this._windowMsCache.set(key, policy.windowMs);
    const result = await this.checkSlidingWindow(key, policy);
    this._windowMsCache.delete(key);

    if (result.success) {
      this.globalStats.allowed++;
    } else {
      this.globalStats.denied++;
    }
    this.globalStats.total++;

    return result;
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (policy.algorithm !== undefined && policy.algorithm !== "sliding") {
      throw new RateLimitRefundUnsupportedProblem();
    }
    if (!receipt || receipt.algorithm !== "sliding") {
      throw new RateLimitRefundUnsupportedProblem();
    }

    const now = this.now();
    const windowStart = now - policy.windowMs;

    await this.removeTimestamps(key, windowStart);
    const entry = this.windows.get(key);

    if (!entry || entry.entries.length === 0) {
      return {
        success: true,
        limit: policy.limit,
        remaining: policy.limit,
        resetAtMs: now + policy.windowMs,
        refunded: false,
      };
    }

    const refundIndex = entry.entries.findIndex((item) => item.receiptId === receipt.id);
    if (refundIndex < 0) {
      const oldestTimestamp = entry.entries[0]?.timestamp ?? now;

      return {
        success: true,
        limit: policy.limit,
        remaining: Math.max(0, policy.limit - entry.entries.length),
        resetAtMs: oldestTimestamp + policy.windowMs,
        refunded: false,
      };
    }

    entry.entries.splice(refundIndex, 1);

    if (entry.entries.length === 0) {
      this.windows.delete(key);
    } else {
      this.windows.set(key, entry);
    }

    recordRefund(this.globalStats);

    const oldestTimestamp = entry.entries[0]?.timestamp ?? now;

    return {
      success: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - entry.entries.length),
      resetAtMs: oldestTimestamp + policy.windowMs,
      refunded: true,
    };
  }

  protected async addTimestamp(
    key: string,
    timestamp: number,
    receiptId = `${timestamp}`,
  ): Promise<void> {
    let entry = this.windows.get(key);
    if (!entry) {
      const windowMs = this._windowMsCache.get(key) ?? 60000;
      entry = { entries: [], windowMs };
    }
    entry.entries.push({ timestamp, receiptId });
    this.windows.set(key, entry);
  }

  protected async getTimestamps(key: string, since: number): Promise<number[]> {
    const entry = this.windows.get(key);
    if (!entry) return [];
    return entry.entries.filter((item) => item.timestamp >= since).map((item) => item.timestamp);
  }

  protected async removeTimestamps(key: string, before: number): Promise<void> {
    const entry = this.windows.get(key);
    if (!entry) return;
    entry.entries = entry.entries.filter((item) => item.timestamp >= before);
    if (entry.entries.length === 0) {
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
    const now = this.now();
    let deletedCount = 0;

    for (const [key, entry] of this.windows.entries()) {
      const windowStart = now - entry.windowMs;
      const originalLength = entry.entries.length;
      entry.entries = entry.entries.filter((item) => item.timestamp >= windowStart);

      if (entry.entries.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, entry);
      }

      deletedCount += originalLength - entry.entries.length;
    }

    return deletedCount;
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class TokenBucketInMemoryStore extends TokenBucketStore {
  private readonly buckets = new Map<
    string,
    { tokens: number; lastRefill: number; ttlMs: number }
  >();
  private readonly globalStats = { allowed: 0, denied: 0, total: 0 };
  private readonly cancelPruning?: () => void;

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    super(options.now, options.random);

    this.cancelPruning = schedulePruning(options, async () => {
      await this.pruneExpired();
    });
  }

  close(): void {
    this.cancelPruning?.();
  }

  destroy(): void {
    this.close();
  }

  async check(key: string, policy: TokenBucketPolicy): Promise<RateLimitResult> {
    const result = await this.checkTokenBucket(key, policy);

    if (result.success) {
      this.globalStats.allowed++;
    } else {
      this.globalStats.denied++;
    }
    this.globalStats.total++;

    return result;
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    const result = await super.refund(key, policy, receipt);
    if (result.refunded) {
      recordRefund(this.globalStats);
    }
    return result;
  }

  protected async getBucket(key: string): Promise<{ tokens: number; lastRefill: number } | null> {
    return this.buckets.get(key) ?? null;
  }

  protected async setBucket(
    key: string,
    entry: { tokens: number; lastRefill: number },
    ttlMs: number,
  ): Promise<void> {
    this.buckets.set(key, { ...entry, ttlMs });
  }

  async increment(): Promise<number> {
    return 0;
  }

  async getCount(): Promise<number> {
    return 0;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
    this.clearTokenBucketRefundReceipts(key);
  }

  async expire(key: string, _ttlMs: number): Promise<void> {
    this.buckets.delete(key);
    this.clearTokenBucketRefundReceipts(key);
  }

  async pruneExpired(): Promise<number> {
    const now = this.now();
    let deletedCount = 0;

    for (const [key, entry] of this.buckets.entries()) {
      if (now <= entry.lastRefill + entry.ttlMs) {
        continue;
      }

      this.buckets.delete(key);
      this.clearTokenBucketRefundReceipts(key);
      deletedCount++;
    }

    return deletedCount;
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class InMemoryRateLimitStore extends SlidingWindowInMemoryStore {}
