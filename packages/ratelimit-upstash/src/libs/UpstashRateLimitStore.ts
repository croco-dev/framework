import type {
  RateLimitPolicy,
  RateLimitRefundReceipt,
  RateLimitRefundResult,
  RateLimitResult,
  RateLimitStats,
  SlidingWindowPolicy,
  TokenBucketPolicy,
} from "@croco/ratelimit-core";
import {
  FixedWindowStore,
  isFixedWindowPolicy,
  isSlidingWindowPolicy,
  isTokenBucketPolicy,
  SlidingWindowStore,
  TokenBucketStore,
} from "@croco/ratelimit-core";
import type { Redis } from "@upstash/redis";

import { fixedWindowLua } from "./lua/fixed-window";
import { fixedWindowRefundLua } from "./lua/fixed-window-refund";
import { slidingWindowLua } from "./lua/sliding-window";
import { slidingWindowRefundLua } from "./lua/sliding-window-refund";
import { tokenBucketLua } from "./lua/token-bucket";
import { tokenBucketRefundLua } from "./lua/token-bucket-refund";
import { InvalidRateLimitPolicyProblem } from "./problems/RateLimitUpstashProblems";

/**
 * Upstash Redis 저장소에 사용할 공통 옵션입니다.
 */
export type UpstashRateLimitStoreOptions = {
  redis: Redis;
  prefix?: string;
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

/**
 * Upstash Redis와 Lua 스크립트로 슬라이딩 윈도우 제한을 수행하는 저장소입니다.
 */
export class UpstashSlidingWindowStore extends SlidingWindowStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private readonly stats: { allowed: number; denied: number; total: number } = {
    allowed: 0,
    denied: 0,
    total: 0,
  };

  constructor(options: UpstashRateLimitStoreOptions) {
    super();
    this.redis = options.redis;
    this.prefix = options.prefix ?? "ratelimit:sliding";
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (!isSlidingWindowPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem("sliding window");
    }

    const result = await this.checkSlidingWindow(key, policy);

    this.stats.total++;
    if (result.success) {
      this.stats.allowed++;
    } else {
      this.stats.denied++;
    }

    return result;
  }

  protected async addTimestamp(): Promise<void> {
    return;
  }

  protected async getTimestamps(): Promise<number[]> {
    return [];
  }

  protected async removeTimestamps(): Promise<void> {
    return;
  }

  async checkSlidingWindow(key: string, policy: SlidingWindowPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - policy.windowMs;
    const redisKey = `${this.prefix}:${key}`;
    const ttlSeconds = Math.ceil(policy.windowMs / 1000) + 1;
    const refundReceipt = {
      algorithm: "sliding",
      id: createRefundReceiptId("sliding", now),
      timestamp: now,
    } as const;

    const result = (await this.redis.eval(
      slidingWindowLua,
      [redisKey],
      [now, windowStart, policy.limit, refundReceipt.id, ttlSeconds],
    )) as [number, number, number];

    const success = result[0] === 1;
    const remaining = result[2];

    return {
      success,
      limit: policy.limit,
      remaining,
      resetAtMs: now + policy.windowMs,
      ...(success ? { refundReceipt } : {}),
    };
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (!isSlidingWindowPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem("sliding window");
    }
    if (!receipt || receipt.algorithm !== "sliding") {
      throw new InvalidRateLimitPolicyProblem("sliding window refund receipt");
    }

    const now = Date.now();
    const windowStart = now - policy.windowMs;
    const redisKey = `${this.prefix}:${key}`;
    const ttlSeconds = Math.ceil(policy.windowMs / 1000) + 1;

    const result = (await this.redis.eval(
      slidingWindowRefundLua,
      [redisKey],
      [windowStart, policy.limit, receipt.id, ttlSeconds],
    )) as [number, number, number];

    const refunded = result[0] === 1;
    if (refunded) {
      recordRefund(this.stats);
    }

    return {
      success: true,
      limit: policy.limit,
      remaining: result[2],
      resetAtMs: now + policy.windowMs,
      refunded,
    };
  }

  async increment(key: string, amount = 1): Promise<number> {
    const redisKey = `${this.prefix}:${key}:increment`;
    const current = await this.redis.get(redisKey);
    const newValue = (Number(current) || 0) + amount;
    await this.redis.set(redisKey, String(newValue));
    return newValue;
  }

  async getCount(): Promise<number> {
    return 0;
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await this.redis.del(redisKey);
  }

  async expire(): Promise<void> {
    return;
  }

  async getStats(): Promise<RateLimitStats> {
    return { ...this.stats };
  }

  async pruneExpired(): Promise<number> {
    return 0;
  }
}

/**
 * Upstash Redis와 Lua 스크립트로 토큰 버킷 제한을 수행하는 저장소입니다.
 */
export class UpstashTokenBucketStore extends TokenBucketStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private readonly stats: { allowed: number; denied: number; total: number } = {
    allowed: 0,
    denied: 0,
    total: 0,
  };

  constructor(options: UpstashRateLimitStoreOptions) {
    super();
    this.redis = options.redis;
    this.prefix = options.prefix ?? "ratelimit:bucket";
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (!isTokenBucketPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem("token bucket");
    }

    const result = await this.checkTokenBucket(key, policy);

    this.stats.total++;
    if (result.success) {
      this.stats.allowed++;
    } else {
      this.stats.denied++;
    }

    return result;
  }

  protected async getBucket(): Promise<{ tokens: number; lastRefill: number } | null> {
    return null;
  }

  protected async setBucket(): Promise<void> {
    return;
  }

  async checkTokenBucket(key: string, policy: TokenBucketPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const redisKey = `${this.prefix}:${key}`;
    const receiptKey = `${redisKey}:receipts`;
    const ttlMs = (policy.capacity * policy.refillIntervalMs) / policy.refillRate;
    const ttlSeconds = Math.ceil(ttlMs / 1000) + 1;
    const refundReceipt = {
      algorithm: "token-bucket",
      id: createRefundReceiptId("token-bucket", now),
      expiresAtMs: now + ttlMs,
    } as const;

    const result = (await this.redis.eval(
      tokenBucketLua,
      [redisKey, receiptKey],
      [
        now,
        policy.capacity,
        policy.refillIntervalMs,
        policy.refillRate,
        ttlSeconds,
        refundReceipt.id,
        refundReceipt.expiresAtMs,
      ],
    )) as [number, number, number];

    const success = result[0] === 1;
    const remaining = result[2];

    const timeUntilNextToken = policy.refillIntervalMs / policy.refillRate;
    const resetAtMs = success
      ? now + timeUntilNextToken
      : now + (1 - remaining) * timeUntilNextToken;

    return {
      success,
      limit: policy.capacity,
      remaining,
      resetAtMs,
      ...(success ? { refundReceipt } : {}),
    };
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (!isTokenBucketPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem("token bucket");
    }
    if (!receipt || receipt.algorithm !== "token-bucket") {
      throw new InvalidRateLimitPolicyProblem("token bucket refund receipt");
    }

    const now = Date.now();
    const redisKey = `${this.prefix}:${key}`;
    const receiptKey = `${redisKey}:receipts`;
    const ttlSeconds =
      Math.ceil((policy.capacity * policy.refillIntervalMs) / policy.refillRate / 1000) + 1;

    const result = (await this.redis.eval(
      tokenBucketRefundLua,
      [redisKey, receiptKey],
      [now, policy.capacity, policy.refillIntervalMs, policy.refillRate, ttlSeconds, receipt.id],
    )) as [number, number, number];

    const refunded = result[0] === 1;
    if (refunded) {
      recordRefund(this.stats);
    }

    return {
      success: true,
      limit: policy.capacity,
      remaining: result[2],
      resetAtMs: now + policy.refillIntervalMs / policy.refillRate,
      refunded,
    };
  }

  async increment(key: string, amount = 1): Promise<number> {
    const redisKey = `${this.prefix}:${key}:increment`;
    const current = await this.redis.get(redisKey);
    const newValue = (Number(current) || 0) + amount;
    await this.redis.set(redisKey, String(newValue));
    return newValue;
  }

  async getCount(): Promise<number> {
    return 0;
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await this.redis.del(redisKey);
    await this.redis.del(`${redisKey}:receipts`);
  }

  async expire(): Promise<void> {
    return;
  }

  async getStats(): Promise<RateLimitStats> {
    return { ...this.stats };
  }

  async pruneExpired(): Promise<number> {
    return 0;
  }
}

/**
 * Upstash Redis와 Lua 스크립트로 고정 윈도우 제한을 수행하는 저장소입니다.
 */
export class UpstashFixedWindowStore extends FixedWindowStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private readonly stats: { allowed: number; denied: number; total: number } = {
    allowed: 0,
    denied: 0,
    total: 0,
  };

  constructor(options: UpstashRateLimitStoreOptions) {
    super();
    this.redis = options.redis;
    this.prefix = options.prefix ?? "ratelimit:fixed";
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (!isFixedWindowPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem("fixed window");
    }

    const now = Date.now();
    const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
    const redisKey = `${this.prefix}:${key}`;
    const receiptKey = `${redisKey}:receipts`;
    const ttlSeconds = Math.ceil(policy.windowMs / 1000);
    const refundReceipt = {
      algorithm: "fixed",
      id: createRefundReceiptId("fixed", windowStart),
      windowStart,
    } as const;

    const result = (await this.redis.eval(
      fixedWindowLua,
      [redisKey, receiptKey],
      [policy.limit, ttlSeconds, windowStart, refundReceipt.id],
    )) as [number, number, number];

    const success = result[0] === 1;
    const remaining = result[2];

    this.stats.total++;
    if (success) {
      this.stats.allowed++;
    } else {
      this.stats.denied++;
    }

    return {
      success,
      limit: policy.limit,
      remaining,
      resetAtMs: windowStart + policy.windowMs,
      ...(success ? { refundReceipt } : {}),
    };
  }

  async refund(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (!isFixedWindowPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem("fixed window");
    }
    if (!receipt || receipt.algorithm !== "fixed") {
      throw new InvalidRateLimitPolicyProblem("fixed window refund receipt");
    }

    const redisKey = `${this.prefix}:${key}`;
    const receiptKey = `${redisKey}:receipts`;
    const ttlSeconds = Math.ceil(policy.windowMs / 1000);

    const result = (await this.redis.eval(
      fixedWindowRefundLua,
      [redisKey, receiptKey],
      [policy.limit, ttlSeconds, receipt.windowStart, receipt.id],
    )) as [number, number, number];

    const refunded = result[0] === 1;
    if (refunded) {
      recordRefund(this.stats);
    }

    return {
      success: true,
      limit: policy.limit,
      remaining: result[2],
      resetAtMs: receipt.windowStart + policy.windowMs,
      refunded,
    };
  }

  protected async getWindowEntry(): Promise<{
    count: number;
    windowStart: number;
    windowMs: number;
  } | null> {
    return null;
  }

  protected async setWindowEntry(): Promise<void> {
    return;
  }

  async increment(key: string, amount = 1): Promise<number> {
    const redisKey = `${this.prefix}:${key}:increment`;
    const current = await this.redis.get(redisKey);
    const newValue = (Number(current) || 0) + amount;
    await this.redis.set(redisKey, String(newValue));
    return newValue;
  }

  async getCount(key: string): Promise<number> {
    const redisKey = `${this.prefix}:${key}:increment`;
    const value = await this.redis.get(redisKey);
    return Number(value) || 0;
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await this.redis.del(redisKey);
    await this.redis.del(`${redisKey}:receipts`);
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    const redisKey = `${this.prefix}:${key}:expire`;
    await this.redis.expire(redisKey, Math.ceil(ttlMs / 1000));
  }

  async getStats(): Promise<RateLimitStats> {
    return { ...this.stats };
  }

  async pruneExpired(): Promise<number> {
    return 0;
  }
}

let refundReceiptSequence = 0;

function createRefundReceiptId(algorithm: string, timestamp: number): string {
  refundReceiptSequence = (refundReceiptSequence + 1) % Number.MAX_SAFE_INTEGER;
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${algorithm}:${timestamp}:${refundReceiptSequence}:${randomPart}`;
}
