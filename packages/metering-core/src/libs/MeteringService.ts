import type { EventBus } from "@croco/events-core";
import { Component } from "@croco/framework-context";
import type {
  BillableUsageEvent,
  BillableUsageJournal,
  BillableUsageJournalDiagnostics,
} from "./BillableUsageJournal";
import { QuotaExceededEvent } from "./events/QuotaExceededEvent";
import { UsageRecordedEvent } from "./events/UsageRecordedEvent";
import type {
  IdempotencyManager,
  MeteringProcessingClaim,
  PendingMeteringDelivery,
} from "./IdempotencyManager";
import type {
  MeterDimensionSchema,
  MeterDimensionValue,
  MeterRecordInput,
  MeterRef,
} from "./MeterRef";
import type { MeterRegistry } from "./MeterRegistry";
import { BillableUsageJournalRequiredProblem } from "./problems/BillableUsageJournalRequiredProblem";
import { InvalidUsageEnvelopeProblem } from "./problems/InvalidUsageEnvelopeProblem";
import { QuotaManager } from "./QuotaManager";
import type { MeterDefinition, RecordOptions, UsageQueryOptions, UsageRecord } from "./types";
import type { UsageStorage } from "./UsageStorage";
import { validateUsageValue } from "./validateUsageValue";

export type MeteringServiceOptions = {
  meterRegistry: MeterRegistry;
  usageStorage: UsageStorage;
  idempotencyManager: IdempotencyManager;
  eventBus?: EventBus;
};

type BillableMeterDescriptor = Pick<MeterRef, "aggregation" | "billing" | "unit">;

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
  private readonly billableUsageJournal?: BillableUsageJournal;
  private readonly quotaManager: QuotaManager;

  constructor(options: MeteringServiceOptions) {
    this.meterRegistry = options.meterRegistry;
    this.usageStorage = options.usageStorage;
    this.idempotencyManager = options.idempotencyManager;
    this.eventBus = options.eventBus;
    this.billableUsageJournal = options.meterRegistry.billableUsageJournal;
    this.quotaManager = new QuotaManager({
      usageStorage: options.usageStorage,
    });
  }

  /**
   * 타입이 지정된 meter 계약에 따라 사용량을 기록합니다.
   *
   * @throws QuotaExceededProblem quota 초과 시 (allowOverQuota=false)
   * @throws DuplicateRecordProblem 중복 idempotencyKey 시
   * @throws InvalidMeterProblem meter 없을 시
   * @throws InvalidUsageEnvelopeProblem typed usage envelope이 meter 계약과 일치하지 않을 시
   * @throws InvalidUsageValueProblem value가 1부터 Number.MAX_SAFE_INTEGER까지의 정수가 아닐 시
   */
  async record<Meter extends MeterRef>(
    meter: Meter,
    input: MeterRecordInput<Meter>,
  ): Promise<UsageRecord>;
  /**
   * 기존 문자열 meter ID 계약에 따라 사용량을 기록합니다.
   *
   * @throws QuotaExceededProblem quota 초과 시 (allowOverQuota=false)
   * @throws DuplicateRecordProblem 중복 idempotencyKey 시
   * @throws InvalidMeterProblem meter 없을 시
   * @throws InvalidUsageValueProblem value가 1부터 Number.MAX_SAFE_INTEGER까지의 정수가 아닐 시
   */
  async record(options: RecordOptions): Promise<UsageRecord>;
  async record<Meter extends MeterRef>(
    optionsOrMeter: RecordOptions | Meter,
    input?: MeterRecordInput<Meter>,
  ): Promise<UsageRecord> {
    if (input !== undefined) {
      this.validateTypedRecord(optionsOrMeter as Meter, input);
      const normalizedEventId = input.eventId?.trim() || undefined;
      return this.recordUsage(
        {
          tenantId: input.tenantId,
          meterId: (optionsOrMeter as Meter).key,
          value: input.value,
          idempotencyKey: normalizedEventId,
          eventId: normalizedEventId,
          dimensions:
            input.dimensions === undefined
              ? undefined
              : { ...(input.dimensions as Record<string, MeterDimensionValue>) },
          metadata: input.metadata,
        },
        optionsOrMeter as Meter,
      );
    }

    return this.recordUsage(optionsOrMeter as RecordOptions);
  }

  private async recordUsage(
    options: RecordOptions & {
      eventId?: string;
      dimensions?: Record<string, MeterDimensionValue>;
    },
    billableMeter?: BillableMeterDescriptor,
  ): Promise<UsageRecord> {
    const { tenantId, meterId, value = 1 } = options;

    validateUsageValue(value);
    const normalizedProvidedKey = options.idempotencyKey?.trim() || undefined;
    const normalizedEventId = options.eventId?.trim() || normalizedProvidedKey;
    const idempotencyKey = this.idempotencyManager.ensureIdempotencyKey(normalizedProvidedKey);
    const claim = await this.idempotencyManager.claimMeteringProcessingOrThrow(
      tenantId,
      meterId,
      idempotencyKey,
    );
    let publishingClaimed = claim.delivery !== undefined;
    let persistenceCompleted = claim.delivery !== undefined;
    let processingCompleted = false;

    try {
      let delivery = claim.delivery;
      if (!delivery) {
        const meter = await this.meterRegistry.getOrThrow(tenantId, meterId);
        const billingRequired = this.isBillingRequired(meter, billableMeter);
        if (billingRequired && !normalizedEventId) {
          throw new InvalidUsageEnvelopeProblem(
            meterId,
            "billing-required meters require a caller-supplied eventId or idempotencyKey",
          );
        }
        delivery = await this.persistUsage(
          options,
          idempotencyKey,
          claim.operationId,
          meter,
          normalizedEventId,
          billableMeter,
        );
        persistenceCompleted = true;
        await this.idempotencyManager.markMeteringEventsPublishing(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
          delivery,
        );
        publishingClaimed = true;
      }

      return await this.publishDelivery(claim, delivery, () => {
        processingCompleted = true;
      });
    } catch (error) {
      if (processingCompleted) {
        throw error;
      }
      if (publishingClaimed) {
        await this.idempotencyManager.releaseMeteringEvents(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
        );
      } else if (!persistenceCompleted) {
        await this.idempotencyManager.abortMeteringProcessing(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
        );
      } else {
        await this.idempotencyManager.releaseMeteringProcessing(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
        );
      }
      throw error;
    }
  }

  private async persistUsage(
    options: RecordOptions & {
      eventId?: string;
      dimensions?: Record<string, MeterDimensionValue>;
    },
    idempotencyKey: string,
    operationId: string,
    meter: MeterDefinition,
    normalizedEventId?: string,
    billableMeter?: BillableMeterDescriptor,
  ): Promise<PendingMeteringDelivery> {
    const { tenantId, meterId, value = 1, metadata } = options;
    const usageRecord: UsageRecord = {
      id: operationId,
      tenantId,
      meterId,
      value,
      timestamp: new Date(),
      idempotencyKey,
      eventId: options.eventId,
      dimensions: options.dimensions,
      metadata,
    };
    const serializedUsageRecord = {
      ...usageRecord,
      timestamp: usageRecord.timestamp.toISOString(),
    };

    const billing = this.isBillingRequired(meter, billableMeter) ? "required" : "local";
    let billableEventId: string | undefined;
    if (billing === "required") {
      const journal = this.billableUsageJournal;
      if (journal?.durability !== "persistent") {
        throw new BillableUsageJournalRequiredProblem(meterId);
      }
      if (meter.aggregation && billableMeter && meter.aggregation !== billableMeter.aggregation) {
        throw new InvalidUsageEnvelopeProblem(
          meterId,
          `aggregation '${billableMeter.aggregation}' does not match registered '${meter.aggregation}'`,
        );
      }
      if (meter.unit && billableMeter && meter.unit !== billableMeter.unit) {
        throw new InvalidUsageEnvelopeProblem(
          meterId,
          `unit '${billableMeter.unit}' does not match registered '${meter.unit}'`,
        );
      }
      const event: BillableUsageEvent = {
        eventId: normalizedEventId ?? idempotencyKey,
        tenantId,
        meterId,
        aggregation: billableMeter?.aggregation ?? meter.aggregation ?? "COUNT",
        unit: billableMeter?.unit ?? meter.unit ?? "event",
        value,
        dimensions: Object.freeze({ ...options.dimensions }),
      };
      await journal.append(event);
      billableEventId = event.eventId;
    }

    if (meter.quota === undefined) {
      await this.usageStorage.record(usageRecord);
      if (billableEventId) {
        await this.billableUsageJournal?.markDeliverable(billableEventId);
      }
      return { usageRecord: serializedUsageRecord };
    }

    const allowOverQuota = meter.allowOverQuota ?? false;
    const quotaResult = await this.quotaManager.checkAndRecord({
      tenantId,
      meterId,
      value,
      quota: meter.quota,
      allowOverQuota,
      usageRecord,
    });
    if (billableEventId) {
      if (quotaResult.exceeded && !allowOverQuota) {
        await this.billableUsageJournal?.markUndeliverable(billableEventId, {
          code: "metering/quota-exceeded",
          message: `Usage for meter '${meterId}' was rejected before provider delivery`,
        });
      } else {
        await this.billableUsageJournal?.markDeliverable(billableEventId);
      }
    }
    return {
      usageRecord: serializedUsageRecord,
      quota: {
        allowOverQuota,
        exceeded: quotaResult.exceeded,
        newUsage: quotaResult.newUsage,
        quota: meter.quota,
      },
    };
  }

  private async publishDelivery(
    claim: MeteringProcessingClaim,
    delivery: PendingMeteringDelivery,
    onCompleted: () => void,
  ): Promise<UsageRecord> {
    const usageRecord: UsageRecord = {
      ...delivery.usageRecord,
      timestamp: new Date(delivery.usageRecord.timestamp),
    };
    const { tenantId, meterId, value, idempotencyKey, metadata } = usageRecord;
    const quota = delivery.quota;

    if (quota?.exceeded && this.eventBus) {
      await this.eventBus.publish(
        new QuotaExceededEvent(
          tenantId,
          meterId,
          quota.newUsage,
          quota.quota,
          idempotencyKey,
          claim.operationId,
        ),
      );
    }

    if (quota?.exceeded && !quota.allowOverQuota) {
      await this.idempotencyManager.completeMeteringProcessing(
        tenantId,
        meterId,
        idempotencyKey,
        claim.token,
      );
      onCompleted();
      this.quotaManager.validateOrThrow({
        meterId,
        quota: quota.quota,
        allowOverQuota: quota.allowOverQuota,
        exceeded: quota.exceeded,
        newUsage: quota.newUsage,
      });
    }

    if (this.eventBus) {
      await this.eventBus.publish(
        new UsageRecordedEvent(
          tenantId,
          meterId,
          value,
          idempotencyKey,
          metadata,
          claim.operationId,
        ),
      );
    }

    await this.idempotencyManager.completeMeteringProcessing(
      tenantId,
      meterId,
      idempotencyKey,
      claim.token,
    );
    onCompleted();
    return usageRecord;
  }

  private validateTypedRecord<Meter extends MeterRef>(
    meter: Meter,
    input: MeterRecordInput<Meter>,
  ): void {
    if (input.eventId !== undefined && typeof input.eventId !== "string") {
      throw new InvalidUsageEnvelopeProblem(meter.key, "eventId must be a string");
    }
    if (meter.billing === "required" && !input.eventId?.trim()) {
      throw new InvalidUsageEnvelopeProblem(
        meter.key,
        "billing-required meters require a non-empty eventId",
      );
    }

    const dimensions = input.dimensions as Record<string, MeterDimensionValue> | undefined;
    this.validateDimensions(meter.key, meter.dimensions, dimensions);
  }

  private validateDimensions(
    meterKey: string,
    schema: MeterDimensionSchema,
    dimensions: Record<string, MeterDimensionValue> | undefined,
  ): void {
    const declaredKeys = Object.keys(schema);
    const providedKeys = Object.keys(dimensions ?? {});
    const missingKeys = declaredKeys.filter((key) => !providedKeys.includes(key));
    const extraKeys = providedKeys.filter((key) => !declaredKeys.includes(key));

    if (missingKeys.length > 0) {
      throw new InvalidUsageEnvelopeProblem(
        meterKey,
        `missing dimensions: ${missingKeys.join(", ")}`,
      );
    }
    if (extraKeys.length > 0) {
      throw new InvalidUsageEnvelopeProblem(
        meterKey,
        `undeclared dimensions: ${extraKeys.join(", ")}`,
      );
    }

    for (const key of declaredKeys) {
      const descriptor = schema[key];
      const value = dimensions?.[key];
      if (!descriptor?.values.includes(value as never)) {
        throw new InvalidUsageEnvelopeProblem(
          meterKey,
          `dimension '${key}' must be one of: ${descriptor?.values.join(", ")}`,
        );
      }
    }
  }

  /**
   * 사용량 조회
   */
  async getUsage(options: UsageQueryOptions): Promise<number> {
    return this.usageStorage.getUsage(options);
  }

  getBillableUsageRequirement(tenantId: string, meterId: string): "local" | "required" | "unknown" {
    return this.meterRegistry.getCachedBillingRequirement(tenantId, meterId);
  }

  async resolveBillableUsageRequirement(
    tenantId: string,
    meterId: string,
  ): Promise<"local" | "required"> {
    const meter = await this.meterRegistry.getOrThrow(tenantId, meterId);
    return meter.billing === "required" ? "required" : "local";
  }

  async getBillableUsageDiagnostics(): Promise<BillableUsageJournalDiagnostics | null> {
    return this.billableUsageJournal?.getDiagnostics() ?? null;
  }

  private isBillingRequired(
    meter: Pick<MeterDefinition, "billing">,
    billableMeter?: Pick<BillableMeterDescriptor, "billing">,
  ): boolean {
    return meter.billing === "required" || billableMeter?.billing === "required";
  }
}
