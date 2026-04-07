import type {
  FixedWindowPolicy,
  RateLimitPolicy,
  RateLimitResult,
  RateLimitStats,
  SlidingWindowPolicy,
  TokenBucketPolicy,
} from './types';

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
  protected abstract getWindowEntry(key: string, policy: FixedWindowPolicy): Promise<RateLimitEntry | null>;
  protected abstract setWindowEntry(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void>;

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

    return {
      success,
      limit: policy.limit,
      remaining: success ? remaining - 1 : 0,
      resetAtMs,
    };
  }
}

export abstract class SlidingWindowStore extends DistributedRateLimitStore {
  protected abstract addTimestamp(key: string, timestamp: number): Promise<void>;
  protected abstract getTimestamps(key: string, since: number): Promise<number[]>;
  protected abstract removeTimestamps(key: string, before: number): Promise<void>;

  async checkSlidingWindow(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - policy.windowMs;

    await this.removeTimestamps(key, windowStart);
    const timestamps = await this.getTimestamps(key, windowStart);
    const count = timestamps.length;

    const success = count < policy.limit;

    if (success) {
      await this.addTimestamp(key, now);
    }

    const oldestTimestamp = timestamps[0] ?? now;
    const resetAtMs = oldestTimestamp + policy.windowMs;

    return {
      success,
      limit: policy.limit,
      remaining: success ? policy.limit - count - 1 : 0,
      resetAtMs,
    };
  }
}

export abstract class TokenBucketStore extends DistributedRateLimitStore {
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
    await this.setBucket(key, bucket, ttlMs);

    const timeUntilNextToken = intervalMs / policy.refillRate;
    const resetAtMs = success ? now + timeUntilNextToken : now + (1 - bucket.tokens) * timeUntilNextToken;

    return {
      success,
      limit: policy.capacity,
      remaining: Math.floor(bucket.tokens),
      resetAtMs,
    };
  }
}
