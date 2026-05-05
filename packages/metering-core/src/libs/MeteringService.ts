import type { EventBus } from '@croco/events-core';
import { Component } from '@croco/framework-context';
import { ulid } from 'ulid';
import { QuotaExceededEvent } from './events/QuotaExceededEvent';
import { UsageRecordedEvent } from './events/UsageRecordedEvent';
import type { IdempotencyManager } from './IdempotencyManager';
import type { MeterRegistry } from './MeterRegistry';
import { QuotaManager } from './QuotaManager';
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
@Component()
export class MeteringService {
  private readonly meterRegistry: MeterRegistry;
  private readonly usageStorage: UsageStorage;
  private readonly idempotencyManager: IdempotencyManager;
  private readonly eventBus?: EventBus;
  private readonly quotaManager: QuotaManager;

  constructor(options: MeteringServiceOptions) {
    this.meterRegistry = options.meterRegistry;
    this.usageStorage = options.usageStorage;
    this.idempotencyManager = options.idempotencyManager;
    this.eventBus = options.eventBus;
    this.quotaManager = new QuotaManager({ usageStorage: options.usageStorage });
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

    const meter = await this.meterRegistry.getOrThrow(tenantId, meterId);

    const idempotencyKey = this.idempotencyManager.ensureIdempotencyKey(options.idempotencyKey);
    await this.idempotencyManager.beginProcessingOrThrow(tenantId, meterId, idempotencyKey);

    const usageRecord: UsageRecord = {
      id: ulid(),
      tenantId,
      meterId,
      value,
      timestamp: new Date(),
      idempotencyKey,
      metadata,
    };

    let idempotencyCompleted = false;

    try {
      if (meter.quota !== undefined) {
        const allowOverQuota = meter.allowOverQuota ?? false;
        const quotaResult = await this.quotaManager.checkAndRecord({
          tenantId,
          meterId,
          value,
          quota: meter.quota,
          allowOverQuota,
          usageRecord,
        });

        if (quotaResult.exceeded && this.eventBus) {
          await this.eventBus.publish(new QuotaExceededEvent(tenantId, meterId, quotaResult.newUsage, meter.quota));
        }

        if (quotaResult.exceeded && !allowOverQuota) {
          // Quota exceeded is not retryable - complete idempotency so the same key is never replayed
          await this.idempotencyManager.completeProcessing(tenantId, meterId, idempotencyKey);
          idempotencyCompleted = true;
          this.quotaManager.validateOrThrow({
            meterId,
            quota: meter.quota,
            allowOverQuota,
            exceeded: quotaResult.exceeded,
            newUsage: quotaResult.newUsage,
          });
        } else {
          this.quotaManager.validateOrThrow({
            meterId,
            quota: meter.quota,
            allowOverQuota,
            exceeded: quotaResult.exceeded,
            newUsage: quotaResult.newUsage,
          });
        }
      } else {
        await this.usageStorage.record(usageRecord);
      }

      if (this.eventBus) {
        await this.eventBus.publish(new UsageRecordedEvent(tenantId, meterId, value, idempotencyKey, metadata));
      }

      await this.idempotencyManager.completeProcessing(tenantId, meterId, idempotencyKey);
      idempotencyCompleted = true;

      return usageRecord;
    } catch (error) {
      if (!idempotencyCompleted) {
        await this.idempotencyManager.abortProcessing(tenantId, meterId, idempotencyKey);
      }
      throw error;
    }
  }

  /**
   * 사용량 조회
   */
  async getUsage(options: UsageQueryOptions): Promise<number> {
    return this.usageStorage.getUsage(options);
  }
}
