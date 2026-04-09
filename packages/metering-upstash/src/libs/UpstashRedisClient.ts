import type { RedisClient } from '@croco/metering-core';
import type { Redis } from '@upstash/redis';

/**
 * `@upstash/redis`를 `@croco/metering-core`의 RedisClient로 감싸는 어댑터입니다.
 */
export class UpstashRedisClient implements RedisClient {
  constructor(private readonly redis: Redis) {}

  /**
   * Sorted Set에 멤버 추가
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    const result = await this.redis.zadd(key, { score, member });
    return typeof result === 'number' ? result : 0;
  }

  /**
   * Sorted Set에서 점수 범위로 멤버 조회
   */
  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    const result = await this.redis.zrange(key, min, max, { byScore: true });
    return result.map((item) => String(item));
  }

  /**
   * 키 설정 (NX: 존재하지 않을 때만, EX: TTL)
   */
  async set(key: string, value: string, _mode: 'NX', _expireMode: 'EX', expire: number): Promise<string | null> {
    const result = await this.redis.set(key, value, { nx: true, ex: expire });
    return result;
  }

  /**
   * Lua 스크립트 실행
   */
  async eval<TResult extends unknown[]>(
    script: string,
    keys: string[],
    args: Array<string | number>
  ): Promise<TResult> {
    return this.redis.eval(script, keys, args) as Promise<TResult>;
  }
}

/**
 * Upstash Redis 인스턴스를 어댑터로 감싸는 헬퍼 함수입니다.
 */
export function createUpstashRedisClient(redis: Redis): UpstashRedisClient {
  return new UpstashRedisClient(redis);
}
