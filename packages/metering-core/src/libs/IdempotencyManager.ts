import { ulid } from 'ulid';
import { DuplicateRecordProblem } from './problems/DuplicateRecordProblem';
import type { RedisClient } from './RedisClient';

/**
 * Idempotency 관리자
 *
 * @description
 * Redis SET NX 기반으로 중복 요청을 방지합니다.
 * - 사용자 제공 idempotencyKey가 있으면 사용
 * - 없으면 ULID 자동 생성
 */
export class IdempotencyManager {
  private static readonly DEFAULT_TTL_SECONDS = 86400; // 24시간
  private static readonly KEY_PREFIX = 'idem';

  constructor(
    private readonly redis: RedisClient,
    private readonly ttlSeconds: number = IdempotencyManager.DEFAULT_TTL_SECONDS
  ) {}

  /**
   * Idempotency key 확보 (없으면 생성)
   */
  ensureIdempotencyKey(providedKey?: string): string {
    return providedKey ?? ulid();
  }

  /**
   * 중복 체크 및 키 등록
   * @returns true: 새 요청 (처리 가능), false: 중복 (이미 처리됨)
   */
  async checkAndMark(tenantId: string, meterId: string, idempotencyKey: string): Promise<boolean> {
    const key = this.buildKey(tenantId, meterId, idempotencyKey);
    const result = await this.redis.set(key, '1', 'NX', 'EX', this.ttlSeconds);
    return result === 'OK';
  }

  /**
   * 중복 체크 - Problem throw 버전
   * @throws DuplicateRecordProblem 중복 시
   */
  async checkAndMarkOrThrow(tenantId: string, meterId: string, idempotencyKey: string): Promise<void> {
    const isNew = await this.checkAndMark(tenantId, meterId, idempotencyKey);
    if (!isNew) {
      throw new DuplicateRecordProblem(idempotencyKey);
    }
  }

  /**
   * Redis 키 생성
   * 패턴: idem:{tenantId}:{meterId}:{idempotencyKey}
   */
  private buildKey(tenantId: string, meterId: string, idempotencyKey: string): string {
    return `${IdempotencyManager.KEY_PREFIX}:${tenantId}:${meterId}:${idempotencyKey}`;
  }
}
