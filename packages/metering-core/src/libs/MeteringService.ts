import type { EventBus } from '@croco/events-core';
import { ulid } from 'ulid';
import { QuotaExceededEvent } from './events/QuotaExceededEvent';
import { UsageRecordedEvent } from './events/UsageRecordedEvent';
import type { IdempotencyManager } from './IdempotencyManager';
import type { MeterRegistry } from './MeterRegistry';
import { QuotaExceededProblem } from './problems/QuotaExceededProblem';
import type { RecordOptions, UsageQueryOptions, UsageRecord } from './types';
import type { UsageStorage } from './UsageStorage';

export type MeteringServiceOptions = {
  meterRegistry: MeterRegistry;
  usageStorage: UsageStorage;
  idempotencyManager: IdempotencyManager;
  eventBus?: EventBus;
};

/**
 * Usage Metering 핵심 서비스
 *
 * @description
 * - record(): 사용량 기록 (핵심 메서드)
 * - getUsage(): 사용량 조회
 * - Quota 초과 시 QuotaExceededProblem throw 또는 이벤트 발행
 */
export class MeteringService {
  private readonly meterRegistry: MeterRegistry;
  private readonly usageStorage: UsageStorage;
  private readonly idempotencyManager: IdempotencyManager;
  private readonly eventBus?: EventBus;

  constructor(options: MeteringServiceOptions) {
    this.meterRegistry = options.meterRegistry;
    this.usageStorage = options.usageStorage;
    this.idempotencyManager = options.idempotencyManager;
    this.eventBus = options.eventBus;
  }

  /**
   * 사용량 기록
   *
   * @throws QuotaExceededProblem quota 초과 시 (allowOverQuota=false)
   * @throws DuplicateRecordProblem 중복 idempotencyKey 시
   * @throws InvalidMeterProblem meter 없을 시
   */
  async record(options: RecordOptions): Promise<UsageRecord> {
    const { tenantId, meterId, value = 1, metadata } = options;

    // 1. Meter 정의 조회
    const meter = await this.meterRegistry.getOrThrow(tenantId, meterId);

    // 2. Idempotency key 확보 및 중복 체크
    const idempotencyKey = this.idempotencyManager.ensureIdempotencyKey(options.idempotencyKey);
    await this.idempotencyManager.checkAndMarkOrThrow(tenantId, meterId, idempotencyKey);

    // 3. Quota 체크 (quota가 설정된 경우만)
    if (meter.quota !== undefined) {
      const currentUsage = await this.usageStorage.getUsage({
        tenantId,
        meterId,
        period: 'billing_cycle',
      });

      const newUsage = currentUsage + value;

      if (newUsage > meter.quota) {
        // QuotaExceeded 이벤트 발행
        if (this.eventBus) {
          await this.eventBus.publish(new QuotaExceededEvent(tenantId, meterId, newUsage, meter.quota));
        }

        // allowOverQuota가 false면 throw
        if (!meter.allowOverQuota) {
          throw new QuotaExceededProblem(meterId, newUsage, meter.quota);
        }
      }
    }

    // 4. Usage 기록
    const usageRecord: UsageRecord = {
      id: ulid(),
      tenantId,
      meterId,
      value,
      timestamp: new Date(),
      idempotencyKey,
      metadata,
    };

    await this.usageStorage.record(usageRecord);

    // 5. UsageRecorded 이벤트 발행
    if (this.eventBus) {
      await this.eventBus.publish(new UsageRecordedEvent(tenantId, meterId, value, idempotencyKey, metadata));
    }

    return usageRecord;
  }

  /**
   * 사용량 조회
   */
  async getUsage(options: UsageQueryOptions): Promise<number> {
    return this.usageStorage.getUsage(options);
  }
}
