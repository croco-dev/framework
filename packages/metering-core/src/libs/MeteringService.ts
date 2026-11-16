import type { EventBus } from "@croco/events-core";
import { Component, InjectOptional, LOGGER_TOKEN, type ILogger } from "@croco/framework-context";
import type {
  BillableUsageEvent,
  BillableUsageJournal,
  BillableUsageJournalDiagnostics,
} from "./BillableUsageJournal";
import { QuotaExceededEvent } from "./events/QuotaExceededEvent";
import { UsageRecordedEvent } from "./events/UsageRecordedEvent";
import type {
  IdempotencyManager,
  MeteringRecordStatus,
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
import { DuplicateRecordProblem } from "./problems/DuplicateRecordProblem";
import { InvalidUsageEnvelopeProblem } from "./problems/InvalidUsageEnvelopeProblem";
import { MeteringTransitionProblem } from "./problems/MeteringTransitionProblem";
import { RedisProblem } from "./problems/RedisProblem";
import { QuotaManager } from "./QuotaManager";
import type { MeterDefinition, RecordOptions, UsageQueryOptions, UsageRecord } from "./types";
import type { UsageStorage, UsageWriteReceipt } from "./UsageStorage";
import { stableStringify } from "./usageJson";
import { validateUsageValue } from "./validateUsageValue";

export type MeteringServiceOptions = {
  meterRegistry: MeterRegistry;
  usageStorage: UsageStorage;
  idempotencyManager: IdempotencyManager;
  eventBus?: EventBus;
};

type BillableMeterDescriptor = Pick<MeterRef, "aggregation" | "billing" | "unit">;
type BillableUsageIntent = { journal: BillableUsageJournal; event: BillableUsageEvent };
type UsageInput = Pick<UsageRecord, "value" | "eventId" | "dimensions" | "metadata">;

function normalizeUsageInput(input: UsageInput): UsageInput {
  try {
    const { metadata, ...normalized } = JSON.parse(JSON.stringify(input)) as Omit<
      UsageInput,
      "metadata"
    > & { metadata?: unknown };
    if (
      metadata !== undefined &&
      (metadata === null || typeof metadata !== "object" || Array.isArray(metadata))
    ) {
      throw new RedisProblem("SERIALIZE", "Usage metadata must serialize to a JSON object");
    }
    return { ...normalized, metadata: metadata as UsageInput["metadata"] };
  } catch (error) {
    if (error instanceof RedisProblem) {
      throw error;
    }
    throw new RedisProblem("SERIALIZE", error instanceof Error ? error : String(error));
  }
}

function restoreUsageRecord(record: PendingMeteringDelivery["usageRecord"]): UsageRecord {
  const { timestamp, eventId, dimensions, metadata, ...identity } = record;
  return { ...identity, timestamp: new Date(timestamp), eventId, dimensions, metadata };
}

function hasSharedBacking(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (typeof SharedArrayBuffer === "function" && value instanceof SharedArrayBuffer) {
    return true;
  }
  if (ArrayBuffer.isView(value)) {
    return hasSharedBacking(value.buffer, seen);
  }
  if (typeof WebAssembly === "object" && value instanceof WebAssembly.Memory) {
    return hasSharedBacking(value.buffer, seen);
  }
  if (value instanceof Map) {
    return Array.from(value).some(
      ([key, entry]) => hasSharedBacking(key, seen) || hasSharedBacking(entry, seen),
    );
  }
  if (value instanceof Set) {
    return Array.from(value).some((entry) => hasSharedBacking(entry, seen));
  }
  return Reflect.ownKeys(value).some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor !== undefined && "value" in descriptor && hasSharedBacking(descriptor.value, seen)
    );
  });
}

function restoreBufferTypes(
  original: unknown,
  snapshot: unknown,
  seen = new WeakSet<object>(),
): void {
  if (
    original === null ||
    typeof original !== "object" ||
    snapshot === null ||
    typeof snapshot !== "object" ||
    seen.has(snapshot)
  ) {
    return;
  }
  seen.add(snapshot);
  if (Buffer.isBuffer(original) && snapshot instanceof Uint8Array) {
    Object.setPrototypeOf(snapshot, Buffer.prototype);
  } else if (original instanceof Map && snapshot instanceof Map) {
    const originalEntries = original.entries();
    for (const [key, entry] of snapshot) {
      const originalEntry = originalEntries.next().value;
      restoreBufferTypes(originalEntry?.[0], key, seen);
      restoreBufferTypes(originalEntry?.[1], entry, seen);
    }
  } else if (original instanceof Set && snapshot instanceof Set) {
    const originalEntries = original.values();
    for (const entry of snapshot) {
      restoreBufferTypes(originalEntries.next().value, entry, seen);
    }
  } else if (!ArrayBuffer.isView(snapshot)) {
    for (const key of Reflect.ownKeys(snapshot)) {
      const before = Object.getOwnPropertyDescriptor(original, key);
      const after = Object.getOwnPropertyDescriptor(snapshot, key);
      if (before && "value" in before && after && "value" in after) {
        restoreBufferTypes(before.value, after.value, seen);
      }
    }
  }
}

function snapshotLiveInput(input: UsageInput, normalized: UsageInput): UsageInput {
  try {
    const snapshot = structuredClone(input);
    if (hasSharedBacking(snapshot)) {
      return normalized;
    }
    if (typeof Buffer !== "undefined") {
      restoreBufferTypes(input, snapshot);
    }
    return stableStringify(normalizeUsageInput(snapshot)) === stableStringify(normalized)
      ? snapshot
      : normalized;
  } catch {
    // JSON is the durable representation for values without an equivalent detached live shape.
    return normalized;
  }
}

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

  constructor(
    options: MeteringServiceOptions,
    @InjectOptional(LOGGER_TOKEN) private readonly logger?: ILogger,
  ) {
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
    let persistenceStarted = claim.delivery !== undefined || claim.persistence !== undefined;
    let claimSettled = false;
    let unstagedRejection: PendingMeteringDelivery | undefined;
    let liveRecord: PendingMeteringDelivery["usageRecord"] | undefined;

    try {
      let delivery = claim.delivery;
      if (!delivery) {
        const originalRecord = claim.persistence?.usageRecord;
        if (claim.persistence && !originalRecord) {
          throw new MeteringTransitionProblem(
            "resume-persistence",
            "USAGE_RECORD_UNAVAILABLE",
            idempotencyKey,
          );
        }
        const meter = await this.meterRegistry.getOrThrow(tenantId, meterId);
        const input = {
          value,
          eventId: options.eventId,
          dimensions: options.dimensions,
          metadata: options.metadata,
        };
        const normalizedInput = normalizeUsageInput(input);
        if (
          claim.rejectedInput &&
          stableStringify(claim.rejectedInput) !== stableStringify(normalizedInput)
        ) {
          throw new DuplicateRecordProblem(idempotencyKey);
        }
        const recordIdentity = {
          id: claim.operationId,
          tenantId,
          meterId,
          timestamp: originalRecord?.timestamp ?? new Date().toISOString(),
          idempotencyKey,
        };
        const receiptRecord = { ...recordIdentity, ...normalizedInput };
        if (originalRecord && stableStringify(originalRecord) !== stableStringify(receiptRecord)) {
          throw new DuplicateRecordProblem(idempotencyKey);
        }
        const previousWrite = originalRecord
          ? await this.recoverUsageWrite(receiptRecord)
          : undefined;
        const retryingRejectedWrite =
          previousWrite?.outcome === "rejected" &&
          previousWrite.operationId === receiptRecord.id &&
          previousWrite.writeGeneration === claim.writeGeneration;
        const continuingWrite = originalRecord !== undefined && !retryingRejectedWrite;
        const writeGeneration = (claim.writeGeneration ?? 0) + (continuingWrite ? 0 : 1);
        const currentTime = new Date().toISOString();
        if (
          continuingWrite &&
          previousWrite?.outcome !== "recorded" &&
          receiptRecord.timestamp.slice(0, 7) !== currentTime.slice(0, 7)
        ) {
          throw new MeteringTransitionProblem(
            "resume-persistence",
            "USAGE_RECORD_UNAVAILABLE",
            idempotencyKey,
          );
        }
        if (retryingRejectedWrite) {
          receiptRecord.timestamp = currentTime;
        }
        liveRecord = continuingWrite
          ? receiptRecord
          : { ...receiptRecord, ...snapshotLiveInput(input, normalizedInput) };
        if (previousWrite?.outcome !== "recorded") {
          this.usageStorage.validateRecord?.(restoreUsageRecord(receiptRecord));
        }
        const billableUsage = this.prepareBillableUsage(
          meter,
          liveRecord,
          normalizedEventId,
          billableMeter,
        );
        await this.idempotencyManager.markMeteringPersistenceStarted(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
          receiptRecord,
          retryingRejectedWrite,
        );
        persistenceStarted = true;
        const recovery = continuingWrite ? { previousWrite } : undefined;
        delivery = await this.persistUsage(
          receiptRecord,
          liveRecord,
          meter,
          billableUsage,
          writeGeneration,
          recovery,
        );
        const quota = delivery.quota;
        if (quota?.exceeded && !quota.allowOverQuota) {
          unstagedRejection = delivery;
        }
        if (billableUsage) {
          const { journal, event } = billableUsage;
          if (unstagedRejection) {
            await journal.markUndeliverable(event.eventId, {
              code: "metering/quota-exceeded",
              message: `Usage for meter '${meterId}' was rejected before provider delivery`,
            });
          } else {
            await journal.markDeliverable(event.eventId);
          }
        }
        await this.idempotencyManager.markMeteringEventsPublishing(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
          delivery,
        );
        publishingClaimed = true;
      }

      const publication = liveRecord ? { ...delivery, usageRecord: liveRecord } : delivery;
      return await this.publishDelivery(claim, publication, () => {
        claimSettled = true;
      });
    } catch (error) {
      if (claimSettled) {
        throw error;
      }
      if (publishingClaimed) {
        await this.runCleanup(error, () =>
          this.idempotencyManager.releaseMeteringEvents(
            tenantId,
            meterId,
            idempotencyKey,
            claim.token,
          ),
        );
      } else if (unstagedRejection) {
        await this.runCleanup(error, () =>
          this.idempotencyManager.releaseMeteringQuotaRejection(
            tenantId,
            meterId,
            idempotencyKey,
            claim.token,
            unstagedRejection,
          ),
        );
      } else if (!persistenceStarted && !claim.rejectedInput) {
        await this.runCleanup(error, () =>
          this.idempotencyManager.abortMeteringProcessing(
            tenantId,
            meterId,
            idempotencyKey,
            claim.token,
          ),
        );
      } else {
        await this.runCleanup(error, () =>
          this.idempotencyManager.releaseMeteringProcessing(
            tenantId,
            meterId,
            idempotencyKey,
            claim.token,
          ),
        );
      }
      throw error;
    }
  }

  private async runCleanup(originalError: unknown, cleanup: () => Promise<void>): Promise<void> {
    try {
      await cleanup();
    } catch (cleanupError) {
      this.reportCleanupFailure(originalError, cleanupError);
    }
  }

  private reportCleanupFailure(originalError: unknown, cleanupError: unknown): void {
    const message = "[MeteringService] Failed to clean up after a metering error";
    const context = { originalError, cleanupError };

    try {
      const logger = this.logger;
      if (logger) {
        const reportingResult: unknown = logger.error(message, context);
        void Promise.resolve(reportingResult).catch((reportingError: unknown) => {
          this.reportCleanupFailureToConsole(message, { ...context, reportingError });
        });
        return;
      }
    } catch (reportingError) {
      this.reportCleanupFailureToConsole(message, { ...context, reportingError });
      return;
    }

    this.reportCleanupFailureToConsole(message, context);
  }

  private reportCleanupFailureToConsole(message: string, context: Record<string, unknown>): void {
    try {
      const reportingResult: unknown = console.error(message, context);
      void Promise.resolve(reportingResult).catch(() => undefined);
    } catch {
      return;
    }
  }

  async getRecordStatus(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): Promise<MeteringRecordStatus> {
    return this.idempotencyManager.getMeteringRecordStatus(tenantId, meterId, idempotencyKey);
  }

  private prepareBillableUsage(
    meter: MeterDefinition,
    usageRecord: PendingMeteringDelivery["usageRecord"],
    eventId: string | undefined,
    billableMeter?: BillableMeterDescriptor,
  ): BillableUsageIntent | undefined {
    if (!this.isBillingRequired(meter, billableMeter)) {
      return undefined;
    }

    const { tenantId, meterId, value, dimensions } = usageRecord;
    if (!eventId) {
      throw new InvalidUsageEnvelopeProblem(
        meterId,
        "billing-required meters require a caller-supplied eventId or idempotencyKey",
      );
    }
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
    return {
      journal,
      event: {
        eventId,
        tenantId,
        meterId,
        aggregation: billableMeter?.aggregation ?? meter.aggregation ?? "COUNT",
        unit: billableMeter?.unit ?? meter.unit ?? "event",
        value,
        dimensions: Object.freeze({ ...dimensions }),
      },
    };
  }

  private async recoverUsageWrite(
    receiptRecord: PendingMeteringDelivery["usageRecord"],
  ): Promise<UsageWriteReceipt | undefined> {
    const receipt = await this.usageStorage.readWriteReceipt?.(receiptRecord);
    if (receipt?.outcome === "rejected" || receipt?.operationId === receiptRecord.id) {
      return receipt;
    }
    if (receipt?.operationId !== undefined) {
      throw new DuplicateRecordProblem(receiptRecord.idempotencyKey);
    }
    const { tenantId, meterId, id, idempotencyKey, value, timestamp } = receiptRecord;
    const recordedAt = new Date(timestamp);
    const records = await this.usageStorage.fetchUsageRecords({
      tenantId,
      meterId,
      period: "billing_cycle",
      startDate: recordedAt,
      endDate: recordedAt,
    });
    if (
      records.some(
        (record) =>
          record.id === id &&
          record.idempotencyKey === idempotencyKey &&
          record.value === value &&
          record.timestamp.getTime() === recordedAt.getTime(),
      )
    ) {
      // The write and its quota outcome may have committed while the row was being read.
      const recordedReceipt =
        receipt ?? (await this.usageStorage.readWriteReceipt?.(receiptRecord));
      if (recordedReceipt?.operationId !== undefined && recordedReceipt.operationId !== id) {
        throw new DuplicateRecordProblem(idempotencyKey);
      }
      return recordedReceipt?.outcome === "recorded" ? recordedReceipt : { outcome: "recorded" };
    }
    if (receipt?.outcome === "recorded") {
      throw new MeteringTransitionProblem(
        "resume-persistence",
        "USAGE_RECORD_UNAVAILABLE",
        idempotencyKey,
      );
    }
    return undefined;
  }

  private async persistUsage(
    receiptRecord: PendingMeteringDelivery["usageRecord"],
    liveRecord: PendingMeteringDelivery["usageRecord"],
    meter: MeterDefinition,
    billableUsage: BillableUsageIntent | undefined,
    writeGeneration: number,
    recovery?: { previousWrite?: UsageWriteReceipt },
  ): Promise<PendingMeteringDelivery> {
    if (billableUsage) {
      await billableUsage.journal.append(billableUsage.event);
    }

    const usageRecord = restoreUsageRecord(liveRecord);
    const { tenantId, meterId, value } = usageRecord;
    const previousWrite = recovery?.previousWrite;
    const recorded = previousWrite?.outcome === "recorded";
    if (meter.quota === undefined || (recorded && !previousWrite.quota)) {
      if (!recorded) {
        if (this.usageStorage.readWriteReceipt) {
          await this.usageStorage.record(usageRecord, writeGeneration);
        } else {
          await this.usageStorage.record(usageRecord);
        }
      }
      return { usageRecord: receiptRecord };
    }

    const allowOverQuota = meter.allowOverQuota ?? false;
    const quotaResult =
      (recorded && previousWrite.quota) ||
      (await this.quotaManager.checkAndRecord({
        tenantId,
        meterId,
        value,
        quota: meter.quota,
        allowOverQuota,
        usageRecord,
        ...(this.usageStorage.readWriteReceipt ? { resuming: true, writeGeneration } : {}),
      }));
    if (
      recovery &&
      !recorded &&
      quotaResult.recorded === undefined &&
      quotaResult.exceeded &&
      !allowOverQuota
    ) {
      throw new MeteringTransitionProblem(
        "resume-persistence",
        "QUOTA_OUTCOME_UNAVAILABLE",
        usageRecord.idempotencyKey,
      );
    }
    return {
      usageRecord: receiptRecord,
      quota: {
        allowOverQuota:
          quotaResult.recorded === false
            ? false
            : allowOverQuota ||
              ((recorded || quotaResult.recorded === true) && quotaResult.exceeded),
        exceeded: quotaResult.exceeded,
        newUsage: quotaResult.newUsage,
        quota: meter.quota,
      },
    };
  }

  private async publishDelivery(
    claim: MeteringProcessingClaim,
    delivery: PendingMeteringDelivery,
    onClaimSettled: () => void,
  ): Promise<UsageRecord> {
    const usageRecord = restoreUsageRecord(delivery.usageRecord);
    const { tenantId, meterId, value, idempotencyKey, metadata } = usageRecord;
    const quota = delivery.quota;

    if (quota?.exceeded && !quota.allowOverQuota) {
      const releaseRejectedClaim = async (): Promise<void> => {
        await this.idempotencyManager.releaseMeteringQuotaRejection(
          tenantId,
          meterId,
          idempotencyKey,
          claim.token,
        );
        onClaimSettled();
      };
      try {
        if (this.eventBus) {
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
      } catch (error) {
        await this.runCleanup(error, releaseRejectedClaim);
        throw error;
      }
      await releaseRejectedClaim();
      this.quotaManager.validateOrThrow({
        meterId,
        quota: quota.quota,
        allowOverQuota: quota.allowOverQuota,
        exceeded: quota.exceeded,
        newUsage: quota.newUsage,
      });
    }

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
    onClaimSettled();
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
