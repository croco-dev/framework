import type { RedisClient } from "@croco/metering-core";
import { Problem } from "@croco/problems-core";
import { Redis } from "@upstash/redis";
import {
  MissingUpstashMeteringConfigProblem,
  UpstashMeteringUpstreamProblem,
} from "./problems/UpstashMeteringProblems";

export type UpstashRedisClientEnv = {
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
  readonly UPSTASH_REDIS_REST_URL?: string;
};

/**
 * `@upstash/redis`를 `@croco/metering-core`의 RedisClient로 감싸는 어댑터입니다.
 */
export class UpstashRedisClient implements RedisClient {
  readonly scriptKeyAccess = "multi-key" as const;

  private readonly redis: Redis;

  constructor(redis: Redis) {
    if (!redis) {
      throw new MissingUpstashMeteringConfigProblem("redis");
    }

    this.redis = redis;
  }

  /**
   * Sorted Set에 멤버 추가
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    const result = await runUpstashMeteringOperation("ZADD", () =>
      this.redis.zadd(key, { score, member }),
    );
    return typeof result === "number" ? result : 0;
  }

  /**
   * Sorted Set에서 점수 범위로 멤버 조회
   */
  async zrangebyscore(
    key: string,
    min: number,
    max: number,
    withScores?: "WITHSCORES",
  ): Promise<string[]> {
    const result = await runUpstashMeteringOperation("ZRANGEBYSCORE", () =>
      this.redis.zrange(key, min, max, {
        byScore: true,
        ...(withScores === "WITHSCORES" ? { withScores: true } : {}),
      }),
    );
    return result.map((item) => String(item));
  }

  /**
   * 키 설정 (NX: 존재하지 않을 때만, EX: TTL)
   */
  async set(
    key: string,
    value: string,
    _mode: "NX",
    _expireMode: "EX",
    expire: number,
  ): Promise<string | null> {
    const result = await runUpstashMeteringOperation("SET", () =>
      this.redis.set(key, value, { nx: true, ex: expire }),
    );
    return result;
  }

  /**
   * Lua 스크립트 실행
   */
  async eval<TResult extends unknown[]>(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<TResult> {
    return runUpstashMeteringOperation(
      "EVAL",
      () => this.redis.eval(script, keys, args) as Promise<TResult>,
    );
  }
}

/**
 * Upstash Redis 인스턴스를 어댑터로 감싸는 헬퍼 함수입니다.
 */
export function createUpstashRedisClient(redis: Redis): UpstashRedisClient {
  return new UpstashRedisClient(redis);
}

export function createUpstashRedisClientFromEnv(env: UpstashRedisClientEnv): UpstashRedisClient {
  const url = readRequiredEnv(env, "UPSTASH_REDIS_REST_URL");
  const token = readRequiredEnv(env, "UPSTASH_REDIS_REST_TOKEN");

  return new UpstashRedisClient(new Redis({ token, url }));
}

async function runUpstashMeteringOperation<T>(
  operation: string,
  action: () => Promise<T> | T,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Problem) {
      throw error;
    }

    throw new UpstashMeteringUpstreamProblem(operation, error);
  }
}

function readRequiredEnv(env: UpstashRedisClientEnv, key: keyof UpstashRedisClientEnv): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new MissingUpstashMeteringConfigProblem(key);
  }

  return value;
}
