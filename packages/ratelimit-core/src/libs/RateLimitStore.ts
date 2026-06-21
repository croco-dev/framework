import type {
  FixedWindowRefundReceipt,
  FixedWindowPolicy,
  RateLimitPolicy,
  RateLimitRefundReceipt,
  RateLimitRefundResult,
  RateLimitResult,
  RateLimitStats,
  SlidingWindowRefundReceipt,
  SlidingWindowPolicy,
  TokenBucketRefundReceipt,
  TokenBucketPolicy,
} from "./types";
import { RateLimitRefundUnsupportedProblem } from "./problems/RateLimitConfigProblems";

export type RateLimitEntry = {
  count: number;
  windowStart: number;
  windowMs: number;
};

export type SlidingWindowEntry = {
  timestamps: number[];
  windowMs: number;
};

export type TokenBucketEntry = {
  tokens: number;
  lastRefill: number;
};

export type DistributedRateLimitStoreOptions = {
  ttlMs: number;
};

export abstract class RateLimitStore {
  abstract check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult>;
  async refund(
    _key: string,
    _policy: RateLimitPolicy,
    _receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    throw new RateLimitRefundUnsupportedProblem();
  }
  abstract getStats(key?: string): Promise<RateLimitStats>;
  abstract pruneExpired(): Promise<number>;
}

export abstract class DistributedRateLimitStore extends RateLimitStore {
  abstract increment(key: string, amount?: number): Promise<number>;
  abstract getCount(key: string): Promise<number>;
  abstract reset(key: string): Promise<void>;
  abstract expire(key: string, ttlMs: number): Promise<void>;
}

export abstract class FixedWindowStore extends DistributedRateLimitStore {
  private readonly refundReceipts = new Map<
    string,
    { windowStart: number; receiptIds: Set<string> }
  >();

  protected abstract getWindowEntry(
    key: string,
    policy: FixedWindowPolicy,
  ): Promise<RateLimitEntry | null>;
  protected abstract setWindowEntry(
    key: string,
    entry: RateLimitEntry,
    ttlMs: number,
  ): Promise<void>;

  async checkFixedWindow(key: string, policy: FixedWindowPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
    const resetAtMs = windowStart + policy.windowMs;

    let entry = await this.getWindowEntry(key, policy);

    if (!entry || entry.windowStart !== windowStart) {
      entry = { count: 0, windowStart, windowMs: policy.windowMs };
    }

    const remaining = Math.max(0, policy.limit - entry.count);
    const success = remaining > 0;

    if (success) {
      entry.count += 1;
      await this.setWindowEntry(key, entry, policy.windowMs);
    }

    const refundReceipt = success
      ? this.recordFixedWindowRefundReceipt(key, windowStart)
      : undefined;

    return {
      success,
      limit: policy.limit,
      remaining: success ? remaining - 1 : 0,
      resetAtMs,
      ...(refundReceipt ? { refundReceipt } : {}),
    };
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (policy.algorithm !== "fixed") {
      throw new RateLimitRefundUnsupportedProblem();
    }

    return this.refundFixedWindow(key, policy as FixedWindowPolicy, receipt);
  }

  protected async refundFixedWindow(
    key: string,
    policy: FixedWindowPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (!receipt || receipt.algorithm !== "fixed") {
      throw new RateLimitRefundUnsupportedProblem();
    }

    const entry = await this.getWindowEntry(key, policy);
    const noRefundResult = this.createFixedWindowRefundResult(policy, receipt, entry, false);

    if (!this.consumeFixedWindowRefundReceipt(key, receipt)) {
      return noRefundResult;
    }

    if (!entry || entry.windowStart !== receipt.windowStart || entry.count <= 0) {
      return noRefundResult;
    }

    const nextCount = Math.max(0, entry.count - 1);
    if (nextCount === 0) {
      await this.reset(key);
    } else {
      await this.setWindowEntry(key, { ...entry, count: nextCount }, policy.windowMs);
    }

    return {
      success: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - nextCount),
      resetAtMs: receipt.windowStart + policy.windowMs,
      refunded: true,
    };
  }

  private recordFixedWindowRefundReceipt(
    key: string,
    windowStart: number,
  ): FixedWindowRefundReceipt {
    const receipt: FixedWindowRefundReceipt = {
      algorithm: "fixed",
      id: createRefundReceiptId("fixed", windowStart),
      windowStart,
    };
    const current = this.refundReceipts.get(key);

    if (!current || current.windowStart !== windowStart) {
      this.refundReceipts.set(key, { windowStart, receiptIds: new Set([receipt.id]) });
      return receipt;
    }

    current.receiptIds.add(receipt.id);
    return receipt;
  }

  private consumeFixedWindowRefundReceipt(key: string, receipt: FixedWindowRefundReceipt): boolean {
    const current = this.refundReceipts.get(key);
    if (!current || current.windowStart !== receipt.windowStart) {
      return false;
    }

    const consumed = current.receiptIds.delete(receipt.id);
    if (current.receiptIds.size === 0) {
      this.refundReceipts.delete(key);
    }

    return consumed;
  }

  private createFixedWindowRefundResult(
    policy: FixedWindowPolicy,
    receipt: FixedWindowRefundReceipt,
    entry: RateLimitEntry | null,
    refunded: boolean,
  ): RateLimitRefundResult {
    return {
      success: true,
      limit: policy.limit,
      remaining: entry ? Math.max(0, policy.limit - entry.count) : policy.limit,
      resetAtMs: entry ? entry.windowStart + entry.windowMs : receipt.windowStart + policy.windowMs,
      refunded,
    };
  }

  protected clearFixedWindowRefundReceipts(key?: string): void {
    if (key) {
      this.refundReceipts.delete(key);
      return;
    }

    this.refundReceipts.clear();
  }
}

export abstract class SlidingWindowStore extends DistributedRateLimitStore {
  protected abstract addTimestamp(
    key: string,
    timestamp: number,
    receiptId?: string,
  ): Promise<void>;
  protected abstract getTimestamps(key: string, since: number): Promise<number[]>;
  protected abstract removeTimestamps(key: string, before: number): Promise<void>;

  async checkSlidingWindow(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - policy.windowMs;

    await this.removeTimestamps(key, windowStart);
    const timestamps = await this.getTimestamps(key, windowStart);
    const count = timestamps.length;

    const success = count < policy.limit;
    const refundReceipt: SlidingWindowRefundReceipt | undefined = success
      ? {
          algorithm: "sliding",
          id: createRefundReceiptId("sliding", now),
          timestamp: now,
        }
      : undefined;

    if (success) {
      await this.addTimestamp(key, now, refundReceipt?.id);
    }

    const oldestTimestamp = timestamps[0] ?? now;
    const resetAtMs = oldestTimestamp + policy.windowMs;

    return {
      success,
      limit: policy.limit,
      remaining: success ? policy.limit - count - 1 : 0,
      resetAtMs,
      ...(refundReceipt ? { refundReceipt } : {}),
    };
  }

  async refund(
    _key: string,
    _policy: RateLimitPolicy,
    _receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    throw new RateLimitRefundUnsupportedProblem();
  }
}

export abstract class TokenBucketStore extends DistributedRateLimitStore {
  private readonly refundReceipts = new Map<string, Map<string, number>>();

  protected abstract getBucket(key: string): Promise<TokenBucketEntry | null>;
  protected abstract setBucket(key: string, entry: TokenBucketEntry, ttlMs: number): Promise<void>;

  async checkTokenBucket(key: string, policy: TokenBucketPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const intervalMs = policy.refillIntervalMs;

    let bucket = await this.getBucket(key);

    if (!bucket) {
      bucket = {
        tokens: policy.capacity,
        lastRefill: now,
      };
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / intervalMs) * policy.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(policy.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    const success = bucket.tokens >= 1;

    if (success) {
      bucket.tokens -= 1;
    }

    const ttlMs = (policy.capacity * intervalMs) / policy.refillRate;
    const refundReceipt = success
      ? this.recordTokenBucketRefundReceipt(key, now + ttlMs)
      : undefined;
    await this.setBucket(key, bucket, ttlMs);

    const timeUntilNextToken = intervalMs / policy.refillRate;
    const resetAtMs = success
      ? now + timeUntilNextToken
      : now + (1 - bucket.tokens) * timeUntilNextToken;

    return {
      success,
      limit: policy.capacity,
      remaining: Math.floor(bucket.tokens),
      resetAtMs,
      ...(refundReceipt ? { refundReceipt } : {}),
    };
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (policy.algorithm !== "token-bucket") {
      throw new RateLimitRefundUnsupportedProblem();
    }

    return this.refundTokenBucket(key, policy as TokenBucketPolicy, receipt);
  }

  protected async refundTokenBucket(
    key: string,
    policy: TokenBucketPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (!receipt || receipt.algorithm !== "token-bucket") {
      throw new RateLimitRefundUnsupportedProblem();
    }

    const now = Date.now();
    const intervalMs = policy.refillIntervalMs;
    const ttlMs = (policy.capacity * intervalMs) / policy.refillRate;
    const resetAtMs = now + intervalMs / policy.refillRate;
    let bucket = await this.getBucket(key);

    if (!this.consumeTokenBucketRefundReceipt(key, receipt, now)) {
      return this.createTokenBucketRefundResult(key, policy, bucket, ttlMs, resetAtMs, false);
    }

    if (!bucket) {
      return {
        success: true,
        limit: policy.capacity,
        remaining: policy.capacity,
        resetAtMs,
        refunded: false,
      };
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / intervalMs) * policy.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(policy.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    bucket.tokens = Math.min(policy.capacity, bucket.tokens + 1);
    await this.setBucket(key, bucket, ttlMs);

    return {
      success: true,
      limit: policy.capacity,
      remaining: Math.floor(bucket.tokens),
      resetAtMs,
      refunded: true,
    };
  }

  private async createTokenBucketRefundResult(
    key: string,
    policy: TokenBucketPolicy,
    bucket: TokenBucketEntry | null,
    ttlMs: number,
    resetAtMs: number,
    refunded: boolean,
  ): Promise<RateLimitRefundResult> {
    if (!bucket) {
      return {
        success: true,
        limit: policy.capacity,
        remaining: policy.capacity,
        resetAtMs,
        refunded,
      };
    }

    const now = Date.now();
    const tokensToAdd = Math.floor(
      ((now - bucket.lastRefill) / policy.refillIntervalMs) * policy.refillRate,
    );

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(policy.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
      await this.setBucket(key, bucket, ttlMs);
    }

    return {
      success: true,
      limit: policy.capacity,
      remaining: Math.floor(bucket.tokens),
      resetAtMs,
      refunded,
    };
  }

  private recordTokenBucketRefundReceipt(
    key: string,
    expiresAtMs: number,
  ): TokenBucketRefundReceipt {
    const now = Date.now();
    this.pruneTokenBucketRefundReceipts(key, now);

    const receipt: TokenBucketRefundReceipt = {
      algorithm: "token-bucket",
      id: createRefundReceiptId("token-bucket", now),
      expiresAtMs,
    };
    const receipts = this.refundReceipts.get(key) ?? new Map<string, number>();
    receipts.set(receipt.id, expiresAtMs);
    this.refundReceipts.set(key, receipts);
    return receipt;
  }

  private consumeTokenBucketRefundReceipt(
    key: string,
    receipt: TokenBucketRefundReceipt,
    now: number,
  ): boolean {
    this.pruneTokenBucketRefundReceipts(key, now);

    const receipts = this.refundReceipts.get(key);
    if (!receipts || !receipts.has(receipt.id)) {
      return false;
    }

    receipts.delete(receipt.id);
    if (receipts.size === 0) {
      this.refundReceipts.delete(key);
    }

    return receipt.expiresAtMs > now;
  }

  protected clearTokenBucketRefundReceipts(key?: string): void {
    if (key) {
      this.refundReceipts.delete(key);
      return;
    }

    this.refundReceipts.clear();
  }

  protected pruneTokenBucketRefundReceipts(key: string, now: number): void {
    const receipts = this.refundReceipts.get(key);
    if (!receipts) {
      return;
    }

    for (const [receiptId, expiresAtMs] of receipts) {
      if (expiresAtMs <= now) {
        receipts.delete(receiptId);
      }
    }

    if (receipts.size === 0) {
      this.refundReceipts.delete(key);
    }
  }
}

let refundReceiptSequence = 0;

function createRefundReceiptId(algorithm: string, timestamp: number): string {
  refundReceiptSequence = (refundReceiptSequence + 1) % Number.MAX_SAFE_INTEGER;
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${algorithm}:${timestamp}:${refundReceiptSequence}:${randomPart}`;
}
