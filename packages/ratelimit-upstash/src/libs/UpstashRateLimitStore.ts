import type {
  RateLimitPolicy,
  RateLimitResult,
  RateLimitStats,
  SlidingWindowPolicy,
  TokenBucketPolicy,
} from '@croco/ratelimit-core';
import {
  FixedWindowStore,
  isFixedWindowPolicy,
  isSlidingWindowPolicy,
  isTokenBucketPolicy,
  SlidingWindowStore,
  TokenBucketStore,
} from '@croco/ratelimit-core';
import type { Redis } from '@upstash/redis';

import { fixedWindowLua } from './lua/fixed-window';
import { slidingWindowLua } from './lua/sliding-window';
import { tokenBucketLua } from './lua/token-bucket';
import { InvalidRateLimitPolicyProblem } from './problems/RateLimitUpstashProblems';

/**
 * Upstash Redis 저장소에 사용할 공통 옵션입니다.
 */
export type UpstashRateLimitStoreOptions = {
  redis: Redis;
  prefix?: string;
};

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
    this.prefix = options.prefix ?? 'ratelimit:sliding';
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (!isSlidingWindowPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem('sliding window');
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

    const result = (await this.redis.eval(
      slidingWindowLua,
      [redisKey],
      [now, windowStart, policy.limit, String(now), ttlSeconds]
    )) as [number, number, number];

    const success = result[0] === 1;
    const remaining = result[2];

    return {
      success,
      limit: policy.limit,
      remaining,
      resetAtMs: now + policy.windowMs,
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
    this.prefix = options.prefix ?? 'ratelimit:bucket';
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (!isTokenBucketPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem('token bucket');
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
    const ttlSeconds = Math.ceil((policy.capacity * policy.refillIntervalMs) / policy.refillRate / 1000) + 1;

    const result = (await this.redis.eval(
      tokenBucketLua,
      [redisKey],
      [now, policy.capacity, policy.refillIntervalMs, policy.refillRate, ttlSeconds]
    )) as [number, number, number];

    const success = result[0] === 1;
    const remaining = result[2];

    const timeUntilNextToken = policy.refillIntervalMs / policy.refillRate;
    const resetAtMs = success ? now + timeUntilNextToken : now + (1 - remaining) * timeUntilNextToken;

    return {
      success,
      limit: policy.capacity,
      remaining,
      resetAtMs,
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
    this.prefix = options.prefix ?? 'ratelimit:fixed';
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (!isFixedWindowPolicy(policy)) {
      throw new InvalidRateLimitPolicyProblem('fixed window');
    }

    const now = Date.now();
    const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
    const redisKey = `${this.prefix}:${key}`;
    const ttlSeconds = Math.ceil(policy.windowMs / 1000);

    const result = (await this.redis.eval(fixedWindowLua, [redisKey], [policy.limit, ttlSeconds, windowStart])) as [
      number,
      number,
      number,
    ];

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
    };
  }

  protected async getWindowEntry(): Promise<{ count: number; windowStart: number; windowMs: number } | null> {
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
    await this.redis.del(`${this.prefix}:${key}`);
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
