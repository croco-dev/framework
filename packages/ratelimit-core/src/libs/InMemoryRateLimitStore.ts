import { validateRateLimitPolicy } from "./validateRateLimitPolicy";
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
import {
  RateLimitPruneIntervalProblem,
  RateLimitRefundUnsupportedProblem,
} from "./problems/RateLimitConfigProblems";

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
const MAX_NATIVE_TIMER_DELAY_MS = 2_147_483_647;

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

type InMemoryCounterEntry = {
  count: number;
  expiresAtMs?: number;
};

function getActiveCounter(
  counters: Map<string, InMemoryCounterEntry>,
  key: string,
  now: number,
): InMemoryCounterEntry | undefined {
  const entry = counters.get(key);
  if (entry?.expiresAtMs !== undefined && entry.expiresAtMs <= now) {
    counters.delete(key);
    return undefined;
  }
  return entry;
}

function incrementCounter(
  counters: Map<string, InMemoryCounterEntry>,
  key: string,
  amount: number,
  now: number,
): number {
  const entry = getActiveCounter(counters, key, now);
  if (entry) {
    entry.count += amount;
    return entry.count;
  }

  counters.set(key, { count: amount });
  return amount;
}

function expireCounter(
  counters: Map<string, InMemoryCounterEntry>,
  key: string,
  ttlMs: number,
  now: number,
): void {
  const entry = getActiveCounter(counters, key, now);
  if (!entry) return;
  if (ttlMs <= 0) {
    counters.delete(key);
    return;
  }
  entry.expiresAtMs = now + ttlMs;
}

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
  if (
    options.scheduler === undefined &&
    (!Number.isFinite(pruneIntervalMs) || pruneIntervalMs > MAX_NATIVE_TIMER_DELAY_MS)
  ) {
    throw new RateLimitPruneIntervalProblem(pruneIntervalMs);
  }
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

// One queue per key: asynchronous storage steps must finish before the next mutation starts.
// Rejections reach the caller but do not poison subsequent operations or retain idle keys.
class KeyedOperations {
  private readonly pending = new Map<string, Promise<void>>();

  run<T>(key: string, operation: () => T | Promise<T>): Promise<T> {
    const result = (this.pending.get(key) ?? Promise.resolve()).then(operation);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.pending.set(key, settled);
    void settled.then(() => {
      if (this.pending.get(key) === settled) this.pending.delete(key);
    });
    return result;
  }

  async prune(keys: Iterable<string>, cleanup: (key: string) => number): Promise<number> {
    let deletedCount = 0;
    const queued: Promise<number>[] = [];
    for (const key of keys) {
      if (this.pending.has(key)) {
        queued.push(this.run(key, () => cleanup(key)));
      } else {
        // Synchronous cleanup cannot interleave with a new operation on an idle key.
        deletedCount += cleanup(key);
      }
    }
    for (const count of await Promise.all(queued)) deletedCount += count;
    return deletedCount;
  }

  keys(): IterableIterator<string> {
    return this.pending.keys();
  }
}

export class FixedWindowInMemoryStore extends FixedWindowStore {
  private readonly operations = new KeyedOperations();
  private readonly windows = new Map<
    string,
    { count: number; windowStart: number; windowMs: number }
  >();
  private readonly counters = new Map<string, InMemoryCounterEntry>();
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

  async checkFixedWindow(key: string, policy: FixedWindowPolicy): Promise<RateLimitResult> {
    return this.operations.run(key, () => super.checkFixedWindow(key, policy));
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
    return this.operations.run(key, async () => {
      const result = await super.refund(key, policy, receipt);
      if (result.refunded) {
        recordRefund(this.globalStats);
      }
      return result;
    });
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
    this.counters.delete(key);
    this.windows.set(key, entry);
  }

  async increment(key: string, amount = 1): Promise<number> {
    return this.operations.run(key, async () => {
      const entry = this.windows.get(key);
      if (entry) {
        entry.count += amount;
        return entry.count;
      }
      return incrementCounter(this.counters, key, amount, this.now());
    });
  }

  async getCount(key: string): Promise<number> {
    return this.operations.run(key, async () => {
      return (
        this.windows.get(key)?.count ?? getActiveCounter(this.counters, key, this.now())?.count ?? 0
      );
    });
  }

  async reset(key: string): Promise<void> {
    return this.operations.run(key, async () => {
      await this.resetFixedWindowEntry(key);
    });
  }

  protected async resetFixedWindowEntry(key: string): Promise<void> {
    this.windows.delete(key);
    this.counters.delete(key);
    this.clearFixedWindowRefundReceipts(key);
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    return this.operations.run(key, async () => {
      expireCounter(this.counters, key, ttlMs, this.now());
    });
  }

  async pruneExpired(): Promise<number> {
    const keys = new Set([
      ...this.windows.keys(),
      ...this.counters.keys(),
      ...this.operations.keys(),
    ]);
    return this.operations.prune(keys, (key) => {
      const now = this.now();
      let deletedCount = 0;
      const entry = this.windows.get(key);
      if (entry && now > entry.windowStart + entry.windowMs) {
        this.windows.delete(key);
        this.clearFixedWindowRefundReceipts(key);
        deletedCount++;
      }
      const counter = this.counters.get(key);
      if (counter?.expiresAtMs !== undefined && counter.expiresAtMs <= now) {
        this.counters.delete(key);
        deletedCount++;
      }
      return deletedCount;
    });
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class SlidingWindowInMemoryStore extends SlidingWindowStore {
  private readonly operations = new KeyedOperations();
  private readonly windows = new Map<
    string,
    { entries: Array<{ timestamp: number; receiptId: string }>; windowMs: number }
  >();
  private readonly counters = new Map<string, InMemoryCounterEntry>();
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

  async checkSlidingWindow(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult> {
    return this.operations.run(key, () => this.checkSlidingWindowUnlocked(key, policy));
  }

  private async checkSlidingWindowUnlocked(
    key: string,
    policy: SlidingWindowPolicy,
  ): Promise<RateLimitResult> {
    validateRateLimitPolicy(policy);
    this._windowMsCache.set(key, policy.windowMs);
    try {
      return await super.checkSlidingWindow(key, policy);
    } finally {
      this._windowMsCache.delete(key);
    }
  }

  async check(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult> {
    const result = await this.checkSlidingWindow(key, policy);
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
    return this.operations.run(key, async () => {
      if (policy.algorithm !== undefined && policy.algorithm !== "sliding") {
        throw new RateLimitRefundUnsupportedProblem();
      }
      if (!receipt || receipt.algorithm !== "sliding") {
        throw new RateLimitRefundUnsupportedProblem();
      }

      validateRateLimitPolicy(policy);
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
    });
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
    return entry.entries.filter((item) => item.timestamp > since).map((item) => item.timestamp);
  }

  protected async removeTimestamps(key: string, before: number): Promise<void> {
    const entry = this.windows.get(key);
    if (!entry) return;
    entry.entries = entry.entries.filter((item) => item.timestamp > before);
    if (entry.entries.length === 0) {
      this.windows.delete(key);
    } else {
      this.windows.set(key, entry);
    }
  }

  async increment(key: string, amount = 1): Promise<number> {
    return this.operations.run(key, async () => {
      return incrementCounter(this.counters, key, amount, this.now());
    });
  }

  async getCount(key: string): Promise<number> {
    return this.operations.run(key, async () => {
      return getActiveCounter(this.counters, key, this.now())?.count ?? 0;
    });
  }

  async reset(key?: string): Promise<void> {
    const keys =
      key === undefined
        ? new Set([...this.windows.keys(), ...this.counters.keys(), ...this.operations.keys()])
        : new Set([key]);
    await Promise.all(
      [...keys].map((currentKey) =>
        this.operations.run(currentKey, () => {
          this.windows.delete(currentKey);
          this.counters.delete(currentKey);
        }),
      ),
    );
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    return this.operations.run(key, async () => {
      expireCounter(this.counters, key, ttlMs, this.now());
    });
  }

  async pruneExpired(): Promise<number> {
    const keys = new Set([
      ...this.windows.keys(),
      ...this.counters.keys(),
      ...this.operations.keys(),
    ]);
    return this.operations.prune(keys, (key) => {
      const now = this.now();
      let deletedCount = 0;
      const entry = this.windows.get(key);
      if (entry) {
        const originalLength = entry.entries.length;
        entry.entries = entry.entries.filter((item) => item.timestamp > now - entry.windowMs);
        if (entry.entries.length === 0) this.windows.delete(key);
        deletedCount += originalLength - entry.entries.length;
      }
      const counter = this.counters.get(key);
      if (counter?.expiresAtMs !== undefined && counter.expiresAtMs <= now) {
        this.counters.delete(key);
        deletedCount++;
      }
      return deletedCount;
    });
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class TokenBucketInMemoryStore extends TokenBucketStore {
  private readonly operations = new KeyedOperations();
  private readonly buckets = new Map<
    string,
    { tokens: number; lastRefill: number; ttlMs: number }
  >();
  private readonly counters = new Map<string, InMemoryCounterEntry>();
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

  async checkTokenBucket(key: string, policy: TokenBucketPolicy): Promise<RateLimitResult> {
    return this.operations.run(key, () => super.checkTokenBucket(key, policy));
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
    return this.operations.run(key, async () => {
      const result = await super.refund(key, policy, receipt);
      if (result.refunded) {
        recordRefund(this.globalStats);
      }
      return result;
    });
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

  async increment(key: string, amount = 1): Promise<number> {
    return this.operations.run(key, async () => {
      return incrementCounter(this.counters, key, amount, this.now());
    });
  }

  async getCount(key: string): Promise<number> {
    return this.operations.run(key, async () => {
      return getActiveCounter(this.counters, key, this.now())?.count ?? 0;
    });
  }

  async reset(key: string): Promise<void> {
    return this.operations.run(key, async () => {
      this.buckets.delete(key);
      this.counters.delete(key);
      this.clearTokenBucketRefundReceipts(key);
    });
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    return this.operations.run(key, async () => {
      this.buckets.delete(key);
      expireCounter(this.counters, key, ttlMs, this.now());
      this.clearTokenBucketRefundReceipts(key);
    });
  }

  async pruneExpired(): Promise<number> {
    const keys = new Set([
      ...this.buckets.keys(),
      ...this.counters.keys(),
      ...this.operations.keys(),
    ]);
    return this.operations.prune(keys, (key) => {
      const now = this.now();
      let deletedCount = 0;
      const entry = this.buckets.get(key);
      if (entry && now > entry.lastRefill + entry.ttlMs) {
        this.buckets.delete(key);
        this.clearTokenBucketRefundReceipts(key);
        deletedCount++;
      }
      const counter = this.counters.get(key);
      if (counter?.expiresAtMs !== undefined && counter.expiresAtMs <= now) {
        this.counters.delete(key);
        deletedCount++;
      }
      return deletedCount;
    });
  }

  async getStats(): Promise<{ allowed: number; denied: number; total: number }> {
    return { ...this.globalStats };
  }
}

export class InMemoryRateLimitStore extends SlidingWindowInMemoryStore {}
