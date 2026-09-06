import { ulid } from "ulid";
import { DuplicateRecordProblem } from "./problems/DuplicateRecordProblem";
import { MeteringTransitionProblem } from "./problems/MeteringTransitionProblem";
import { buildMeteringRedisKey } from "./redisKey";
import type { RedisClient } from "./RedisClient";
import type { UsageRecord } from "./types";

export type PendingMeteringDelivery = {
  usageRecord: Omit<UsageRecord, "timestamp"> & {
    timestamp: string;
  };
  quota?: {
    allowOverQuota: boolean;
    exceeded: boolean;
    newUsage: number;
    quota: number;
  };
};

export type MeteringProcessingClaim = {
  delivery?: PendingMeteringDelivery;
  operationId: string;
  token: IdempotencyClaim;
};

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
  private static readonly DEFAULT_PROCESSING_LEASE_MILLISECONDS = 30_000;
  private static readonly KEY_NAMESPACE = "idem2";
  private static readonly STATUS_IN_PROGRESS_PREFIX = "IN_PROGRESS:";
  private static readonly STATUS_COMPLETED = "COMPLETED";

  constructor(
    private readonly redis: RedisClient,
    private readonly ttlSeconds: number = IdempotencyManager.DEFAULT_TTL_SECONDS,
    private readonly processingLeaseMilliseconds: number = IdempotencyManager.DEFAULT_PROCESSING_LEASE_MILLISECONDS,
  ) {}

  /**
   * Idempotency key 확보 (없으면 생성)
   */
  ensureIdempotencyKey(providedKey?: string): string {
    return providedKey ?? ulid();
  }

  /**
   * 짧은 처리 lease를 획득합니다. 내구성 있는 커밋 후 반환된 claim으로 completeProcessing을 호출해야 합니다.
   * 작업이 확인된 실패로 끝나면 반환된 claim으로 abortProcessing을 호출해야 합니다.
   * @returns 새 lease의 ownership claim, 이미 처리 중이거나 완료된 key이면 null
   */
  async checkAndMark(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyClaim | null> {
    return this.beginProcessing(tenantId, meterId, idempotencyKey);
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
      Math.ceil(this.processingLeaseMilliseconds / 1000),
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

  async claimMeteringProcessingOrThrow(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<MeteringProcessingClaim> {
    const key = this.buildDeliveryKey(tenantId, meterId, idempotencyKey);
    const legacyKey = this.buildKey(tenantId, meterId, idempotencyKey);
    const token = ulid() as IdempotencyClaim;
    const operationId = ulid();
    const [claimed, deliveryJson, claimedOperationId] = await this.redis.eval<
      [number, string, string]
    >(
      `
        local time = redis.call('TIME')
        local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
        local stateJson = redis.call('GET', KEYS[1])

        if not stateJson then
          local legacyStatus = redis.call('GET', KEYS[2])
          if legacyStatus == ARGV[6] or
            (legacyStatus and string.sub(legacyStatus, 1, string.len(ARGV[5])) == ARGV[5]) then
            return { 0, '', '' }
          end

          local state = {
            status = 'PROCESSING',
            token = ARGV[1],
            leaseExpiresAt = now + tonumber(ARGV[2]),
            operationId = ARGV[4]
          }
          redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[3])
          if not legacyStatus then
            redis.call('SET', KEYS[2], ARGV[7], 'EX', ARGV[3])
          end
          return { 1, '', state.operationId }
        end

        local state = cjson.decode(stateJson)
        if state.status == 'EVENTS_PENDING' or
          ((state.status == 'PROCESSING' or state.status == 'PUBLISHING') and
            tonumber(state.leaseExpiresAt) <= now) then
          local hasDelivery = state.delivery ~= nil
          state.status = hasDelivery and 'PUBLISHING' or 'PROCESSING'
          state.token = ARGV[1]
          state.operationId = state.operationId or ARGV[4]
          state.leaseExpiresAt = now + tonumber(ARGV[2])
          redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[3])
          redis.call('SET', KEYS[2], ARGV[7], 'EX', ARGV[3])
          return { 1, hasDelivery and state.delivery or '', state.operationId }
        end

        return { 0, '', '' }
      `,
      [key, legacyKey],
      [
        token,
        this.processingLeaseMilliseconds,
        this.activeStateTtlSeconds,
        operationId,
        IdempotencyManager.STATUS_IN_PROGRESS_PREFIX,
        IdempotencyManager.STATUS_COMPLETED,
        this.buildLeaseValue(token),
      ],
    );

    if (claimed !== 1) {
      throw new DuplicateRecordProblem(idempotencyKey);
    }

    return {
      operationId: claimedOperationId,
      token,
      delivery:
        deliveryJson.length === 0
          ? undefined
          : (JSON.parse(deliveryJson) as PendingMeteringDelivery),
    };
  }

  async markMeteringEventsPublishing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    token: IdempotencyClaim,
    delivery: PendingMeteringDelivery,
  ): Promise<void> {
    const key = this.buildDeliveryKey(tenantId, meterId, idempotencyKey);
    const [transitioned, reason] = await this.redis.eval<[number, string]>(
      `
        local stateJson = redis.call('GET', KEYS[1])
        if not stateJson then
          return { 0, 'MISSING' }
        end

        local state = cjson.decode(stateJson)
        if state.status ~= 'PROCESSING' then
          return { 0, 'STATUS:' .. tostring(state.status) }
        end
        if state.token ~= ARGV[1] then
          return { 0, 'TOKEN' }
        end

        local time = redis.call('TIME')
        local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
        state.status = 'PUBLISHING'
        state.delivery = ARGV[2]
        state.leaseExpiresAt = now + tonumber(ARGV[3])
        redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[4])
        return { 1, 'OK' }
      `,
      [key],
      [
        token,
        JSON.stringify(delivery),
        this.processingLeaseMilliseconds,
        this.activeStateTtlSeconds,
      ],
    );
    this.requireStagedTransition(transitioned, reason, idempotencyKey, "mark-events-publishing");
  }

  async releaseMeteringProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    token: IdempotencyClaim,
  ): Promise<void> {
    const key = this.buildDeliveryKey(tenantId, meterId, idempotencyKey);
    const [transitioned, reason] = await this.redis.eval<[number, string]>(
      `
        local stateJson = redis.call('GET', KEYS[1])
        if not stateJson then
          return { 0, 'MISSING' }
        end

        local state = cjson.decode(stateJson)
        if state.status ~= 'PROCESSING' then
          return { 0, 'STATUS:' .. tostring(state.status) }
        end
        if state.token ~= ARGV[1] then
          return { 0, 'TOKEN' }
        end

        state.token = nil
        state.leaseExpiresAt = 0
        redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[2])
        return { 1, 'OK' }
      `,
      [key],
      [token, this.activeStateTtlSeconds],
    );
    this.requireStagedTransition(transitioned, reason, idempotencyKey, "release-processing");
  }

  async releaseMeteringEvents(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    token: IdempotencyClaim,
  ): Promise<void> {
    const key = this.buildDeliveryKey(tenantId, meterId, idempotencyKey);
    const [transitioned, reason] = await this.redis.eval<[number, string]>(
      `
        local stateJson = redis.call('GET', KEYS[1])
        if not stateJson then
          return { 0, 'MISSING' }
        end

        local state = cjson.decode(stateJson)
        if state.status == 'COMPLETED' then
          return { 1, 'ALREADY_COMPLETED' }
        end
        if state.status ~= 'PUBLISHING' then
          return { 0, 'STATUS:' .. tostring(state.status) }
        end
        if state.token ~= ARGV[1] then
          return { 0, 'TOKEN' }
        end

        state.status = 'EVENTS_PENDING'
        state.token = nil
        state.leaseExpiresAt = nil
        redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[2])
        return { 1, 'OK' }
      `,
      [key],
      [token, this.ttlSeconds],
    );
    this.requireStagedTransition(transitioned, reason, idempotencyKey, "release-events");
  }

  async completeMeteringProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    token: IdempotencyClaim,
  ): Promise<void> {
    const key = this.buildDeliveryKey(tenantId, meterId, idempotencyKey);
    const legacyKey = this.buildKey(tenantId, meterId, idempotencyKey);
    const [transitioned, reason] = await this.redis.eval<[number, string]>(
      `
        local stateJson = redis.call('GET', KEYS[1])
        if not stateJson then
          return { 0, 'MISSING' }
        end

        local state = cjson.decode(stateJson)
        if state.status == 'COMPLETED' then
          return { 1, 'ALREADY_COMPLETED' }
        end
        if state.status ~= 'PUBLISHING' then
          return { 0, 'STATUS:' .. tostring(state.status) }
        end
        if state.token ~= ARGV[1] then
          return { 0, 'TOKEN' }
        end

        redis.call('SET', KEYS[1], '{"status":"COMPLETED"}', 'EX', ARGV[2])
        redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
        return { 1, 'OK' }
      `,
      [key, legacyKey],
      [token, this.ttlSeconds, IdempotencyManager.STATUS_COMPLETED],
    );
    this.requireStagedTransition(transitioned, reason, idempotencyKey, "complete-processing");
  }

  async abortMeteringProcessing(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    token: IdempotencyClaim,
  ): Promise<void> {
    const key = this.buildDeliveryKey(tenantId, meterId, idempotencyKey);
    const legacyKey = this.buildKey(tenantId, meterId, idempotencyKey);
    const [deleted, reason] = await this.redis.eval<[number, string]>(
      `
        local stateJson = redis.call('GET', KEYS[1])
        if not stateJson then
          return { 0, 'MISSING' }
        end

        local state = cjson.decode(stateJson)
        if state.status ~= 'PROCESSING' then
          return { 0, 'STATUS:' .. tostring(state.status) }
        end
        if state.token ~= ARGV[1] then
          return { 0, 'TOKEN' }
        end
        if redis.call('GET', KEYS[2]) ~= ARGV[2] then
          return { 0, 'LIFECYCLE' }
        end

        redis.call('DEL', KEYS[1])
        redis.call('DEL', KEYS[2])
        return { 1, 'OK' }
      `,
      [key, legacyKey],
      [token, this.buildLeaseValue(token)],
    );
    this.requireStagedTransition(deleted, reason, idempotencyKey, "abort-processing");
  }

  /**
   * 처리 lease를 획득하고 완료 또는 중단에 사용할 ownership claim을 반환합니다.
   * @throws DuplicateRecordProblem 동일한 key가 처리 중이거나 완료된 경우
   */
  async checkAndMarkOrThrow(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyClaim> {
    return this.beginProcessingOrThrow(tenantId, meterId, idempotencyKey);
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

  private buildDeliveryKey(tenantId: string, meterId: string, idempotencyKey: string): string {
    return buildMeteringRedisKey(IdempotencyManager.KEY_NAMESPACE, [
      "delivery",
      tenantId,
      meterId,
      idempotencyKey,
    ]);
  }

  private get activeStateTtlSeconds(): number {
    return Math.max(this.ttlSeconds, Math.ceil(this.processingLeaseMilliseconds / 1000) + 1);
  }

  private requireStagedTransition(
    transitioned: number,
    reason: string,
    idempotencyKey: string,
    transition: string,
  ): void {
    if (transitioned !== 1) {
      throw new MeteringTransitionProblem(transition, reason, idempotencyKey);
    }
  }
}
