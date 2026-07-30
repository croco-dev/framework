/**
 * Redis 클라이언트 인터페이스 (ioredis, upstash 등 구현체와 분리)
 */
export interface RedisClient {
  /**
   * Metering의 원자적 스크립트는 여러 키에 접근하므로 단일 노드/단일 슬롯 실행 모델이 필요합니다.
   * Redis Cluster처럼 서로 다른 슬롯의 키 접근을 거부하는 클라이언트는 지원하지 않습니다.
   */
  readonly scriptKeyAccess: "multi-key";

  /**
   * Sorted Set에 멤버 추가
   */
  zadd(key: string, score: number, member: string): Promise<number>;

  /**
   * Sorted Set에서 점수 범위로 멤버 조회
   */
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zrangebyscore(key: string, min: number, max: number, withScores: "WITHSCORES"): Promise<string[]>;

  /**
   * 키 설정 (NX: 존재하지 않을 때만, EX: TTL)
   */
  set(
    key: string,
    value: string,
    mode: "NX",
    expireMode: "EX",
    expire: number,
  ): Promise<string | null>;

  /**
   * Lua 스크립트 실행
   */
  eval<TResult extends unknown[]>(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<TResult>;
}
