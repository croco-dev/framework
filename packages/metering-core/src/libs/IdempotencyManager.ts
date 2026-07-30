import { ulid } from "ulid";
import { DuplicateRecordProblem } from "./problems/DuplicateRecordProblem";
import { buildMeteringRedisKey } from "./redisKey";
import type { RedisClient } from "./RedisClient";

declare const IDEMPOTENCY_CLAIM: unique symbol;

/**
 * 현재 idempotency lease의 소유권을 증명하는 opaque claim입니다.
 */
export type IdempotencyClaim = string & {
  readonly [IDEMPOTENCY_CLAIM]: "IdempotencyClaim";
};

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
  private static readonly KEY_NAMESPACE = "idem2";
  private static readonly STATUS_IN_PROGRESS_PREFIX = "IN_PROGRESS:";
  private static readonly STATUS_COMPLETED = "COMPLETED";

  constructor(
    private readonly redis: RedisClient,
    private readonly ttlSeconds: number = IdempotencyManager.DEFAULT_TTL_SECONDS,
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
    const result = await this.redis.set(
      key,
      IdempotencyManager.STATUS_COMPLETED,
      "NX",
      "EX",
      this.ttlSeconds,
    );
    return result === "OK";
  }

  /**
   * 처리 lease를 원자적으로 획득합니다.
   *
   * @returns 새 lease의 ownership claim, 중복 key이면 null
   */
  async beginProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyClaim | null> {
    const key = this.buildKey(tenantId, meterId, idempotencyKey);
    const claim = ulid() as IdempotencyClaim;
    const result = await this.redis.set(
      key,
      this.buildLeaseValue(claim),
      "NX",
      "EX",
      this.ttlSeconds,
    );

    return result === "OK" ? claim : null;
  }

  /**
   * 처리 lease를 획득하고 현재 소유권 claim을 반환합니다.
   *
   * @returns 새 lease의 claim
   * @throws DuplicateRecordProblem 동일한 idempotency key가 이미 처리 중이거나 완료된 경우
   */
  async beginProcessingOrThrow(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyClaim> {
    const claim = await this.beginProcessing(tenantId, meterId, idempotencyKey);
    if (claim === null) {
      throw new DuplicateRecordProblem(idempotencyKey);
    }
    return claim;
  }

  /**
   * 현재 claim이 소유한 lease만 완료 상태로 전환합니다.
   */
  async completeProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    claim: IdempotencyClaim,
  ): Promise<void> {
    const key = this.buildKey(tenantId, meterId, idempotencyKey);
    await this.redis.eval<[number]>(
      `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
        end
        return 1
      `,
      [key],
      [this.buildLeaseValue(claim), IdempotencyManager.STATUS_COMPLETED, String(this.ttlSeconds)],
    );
  }

  /**
   * 현재 claim이 소유한 처리 중 lease만 삭제합니다.
   */
  async abortProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    claim: IdempotencyClaim,
  ): Promise<void> {
    const key = this.buildKey(tenantId, meterId, idempotencyKey);
    await this.redis.eval<[number]>(
      `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          redis.call('DEL', KEYS[1])
        end
        return 1
      `,
      [key],
      [this.buildLeaseValue(claim)],
    );
  }

  /**
   * 중복 체크 - Problem throw 버전
   * @throws DuplicateRecordProblem 중복 시
   */
  async checkAndMarkOrThrow(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<void> {
    const isNew = await this.checkAndMark(tenantId, meterId, idempotencyKey);
    if (!isNew) {
      throw new DuplicateRecordProblem(idempotencyKey);
    }
  }

  /**
   * Redis 키 생성
   * 패턴: idem2:lifecycle:{encodedTenantId}:{encodedMeterId}:{encodedIdempotencyKey}
   */
  private buildKey(tenantId: string, meterId: string, idempotencyKey: string): string {
    return buildMeteringRedisKey(IdempotencyManager.KEY_NAMESPACE, [
      "lifecycle",
      tenantId,
      meterId,
      idempotencyKey,
    ]);
  }

  private buildLeaseValue(claim: IdempotencyClaim): string {
    return `${IdempotencyManager.STATUS_IN_PROGRESS_PREFIX}${claim}`;
  }
}
