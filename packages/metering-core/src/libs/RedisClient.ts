/**
 * Redis 클라이언트 인터페이스 (ioredis, upstash 등 구현체와 분리)
 */
export interface RedisClient {
  /**
   * Sorted Set에 멤버 추가
   */
  zadd(key: string, score: number, member: string): Promise<number>;

  /**
   * Sorted Set에서 점수 범위로 멤버 조회
   */
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;

  /**
   * 키 설정 (NX: 존재하지 않을 때만, EX: TTL)
   */
  set(key: string, value: string, mode: 'NX', expireMode: 'EX', expire: number): Promise<string | null>;

  /**
   * Lua 스크립트 실행
   */
  eval<TResult extends unknown[]>(script: string, keys: string[], args: Array<string | number>): Promise<TResult>;
}
