import { ulid } from "ulid";
import { DuplicateRecordProblem } from "./problems/DuplicateRecordProblem";
import { buildMeteringRedisKey } from "./redisKey";
import type { RedisClient } from "./RedisClient";

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
  private static readonly STATUS_IN_PROGRESS = "IN_PROGRESS";
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

  async beginProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    const key = this.buildKey(tenantId, meterId, idempotencyKey);
    const [result] = await this.redis.eval<[number]>(
      `
        if redis.call('EXISTS', KEYS[1]) == 1 then
          return 0
        end

        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return 1
      `,
      [key],
      [IdempotencyManager.STATUS_IN_PROGRESS, String(this.ttlSeconds)],
    );

    return result === 1;
  }

  async beginProcessingOrThrow(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<void> {
    const isNew = await this.beginProcessing(tenantId, meterId, idempotencyKey);
    if (!isNew) {
      throw new DuplicateRecordProblem(idempotencyKey);
    }
  }

  async completeProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
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
      [
        IdempotencyManager.STATUS_IN_PROGRESS,
        IdempotencyManager.STATUS_COMPLETED,
        String(this.ttlSeconds),
      ],
    );
  }

  async abortProcessing(tenantId: string, meterId: string, idempotencyKey: string): Promise<void> {
    const key = this.buildKey(tenantId, meterId, idempotencyKey);
    await this.redis.eval<[number]>(
      `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          redis.call('DEL', KEYS[1])
        end
        return 1
      `,
      [key],
      [IdempotencyManager.STATUS_IN_PROGRESS],
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
}
