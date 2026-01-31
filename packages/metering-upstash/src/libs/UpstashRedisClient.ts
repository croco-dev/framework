import type { RedisClient } from '@croco/metering-core';
import type { Redis } from '@upstash/redis';

/**
 * Upstash Redis 어댑터
 *
 * @description
 * @upstash/redis SDK를 metering-core의 RedisClient 인터페이스에 맞게 래핑합니다.
 * 서버리스 환경(Vercel, Cloudflare Workers 등)에 최적화되어 있습니다.
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
}

/**
 * Upstash Redis 클라이언트 생성 헬퍼
 */
export function createUpstashRedisClient(redis: Redis): UpstashRedisClient {
  return new UpstashRedisClient(redis);
}
