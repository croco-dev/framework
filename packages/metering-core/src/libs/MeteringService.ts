import type { EventBus } from "@croco/events-core";
import { Component } from "@croco/framework-context";
import { ulid } from "ulid";
import { QuotaExceededEvent } from "./events/QuotaExceededEvent";
import { UsageRecordedEvent } from "./events/UsageRecordedEvent";
import type { IdempotencyManager } from "./IdempotencyManager";
import type {
  MeterAggregationOf,
  MeterDimensionsOf,
  MeterRecordInput,
  MeterRef,
} from "./MeterDefinition";
import { isMeterRef } from "./MeterDefinition";
import type { MeterRegistry } from "./MeterRegistry";
import { InvalidMeterDefinitionProblem } from "./problems/InvalidMeterDefinitionProblem";
import { InvalidUsageEnvelopeProblem } from "./problems/InvalidUsageEnvelopeProblem";
import { QuotaManager } from "./QuotaManager";
import type { RecordOptions, UsageQueryOptions, UsageRecord } from "./types";
import type { UsageStorage } from "./UsageStorage";

export type MeteringServiceOptions = {
  meterRegistry: MeterRegistry;
  usageStorage: UsageStorage;
  idempotencyManager: IdempotencyManager;
  eventBus?: EventBus;
};

type MeterInputValidity<TMeter extends MeterRef, TInput> = TMeter extends unknown
  ? TInput extends MeterRecordInput<TMeter>
    ? true
    : false
  : never;

type OmittedMeterFieldValidity<TMeter extends MeterRef, TInput> = TMeter extends unknown
  ? MeterAggregationOf<TMeter> extends "COUNT"
    ? "value" extends keyof TInput
      ? false
      : keyof MeterDimensionsOf<TMeter> extends never
        ? "dimensions" extends keyof TInput
          ? false
          : true
        : true
    : keyof MeterDimensionsOf<TMeter> extends never
      ? "dimensions" extends keyof TInput
        ? false
        : true
      : true
  : never;

type StrictMeterInput<TMeter extends MeterRef, TInput> =
  false extends MeterInputValidity<TMeter, TInput>
    ? never
    : false extends OmittedMeterFieldValidity<TMeter, TInput>
      ? never
      : Exclude<keyof TInput, keyof MeterRecordInput<TMeter>> extends never
        ? TInput extends { readonly dimensions: infer TDimensions extends object }
          ? Exclude<keyof TDimensions, keyof MeterDimensionsOf<TMeter>> extends never
            ? unknown
            : never
          : unknown
        : never;

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
    this.quotaManager = new QuotaManager({
      usageStorage: options.usageStorage,
    });
  }

  /**
   * 사용량 기록
   *
   * @throws QuotaExceededProblem quota 초과 시 (allowOverQuota=false)
   * @throws DuplicateRecordProblem 중복 idempotencyKey 시
   * @throws InvalidMeterProblem meter 없을 시
   */
  async record<const TMeter extends MeterRef, const TInput>(
    meter: TMeter,
    input: TInput & StrictMeterInput<TMeter, TInput>,
  ): Promise<UsageRecord>;
  async record(options: RecordOptions): Promise<UsageRecord>;
  async record(meterOrOptions: MeterRef | RecordOptions, input?: unknown): Promise<UsageRecord> {
    if (isMeterRef(meterOrOptions)) {
      if (input === undefined) {
        throw new InvalidUsageEnvelopeProblem(
          meterOrOptions.descriptor.key,
          "input",
          "is required",
        );
      }

      const typed = this.normalizeTypedRecord(meterOrOptions, input);
      return this.recordUsage(typed);
    }

    if (input !== undefined) {
      throw new InvalidMeterDefinitionProblem(
        "meter",
        "must be a MeterRef returned by defineMeter()",
      );
    }

    return this.recordUsage(meterOrOptions);
  }

  private async recordUsage(options: RecordOptions): Promise<UsageRecord> {
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

        const shouldPublishQuotaExceeded = quotaResult.exceeded && this.eventBus !== undefined;

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

          await this.idempotencyManager.completeProcessing(tenantId, meterId, idempotencyKey);
          idempotencyCompleted = true;
        }

        if (shouldPublishQuotaExceeded) {
          await this.eventBus.publish(
            new QuotaExceededEvent(tenantId, meterId, quotaResult.newUsage, meter.quota),
          );
        }

        if (this.eventBus) {
          await this.eventBus.publish(
            new UsageRecordedEvent(tenantId, meterId, value, idempotencyKey, metadata),
          );
        }
      } else {
        await this.usageStorage.record(usageRecord);
        await this.idempotencyManager.completeProcessing(tenantId, meterId, idempotencyKey);
        idempotencyCompleted = true;

        if (this.eventBus) {
          await this.eventBus.publish(
            new UsageRecordedEvent(tenantId, meterId, value, idempotencyKey, metadata),
          );
        }
      }

      return usageRecord;
    } catch (error) {
      if (!idempotencyCompleted) {
        await this.idempotencyManager.abortProcessing(tenantId, meterId, idempotencyKey);
      }
      throw error;
    }
  }

  private normalizeTypedRecord(meter: MeterRef, input: unknown): RecordOptions {
    const { descriptor } = meter;
    if (!this.isPlainRecord(input)) {
      throw new InvalidUsageEnvelopeProblem(descriptor.key, "input", "must be an object");
    }

    const candidate = input;
    const allowedKeys = new Set(["tenantId", "eventId", "value", "dimensions", "metadata"]);
    const extraKey = Object.keys(candidate).find((key) => !allowedKeys.has(key));
    if (extraKey !== undefined) {
      throw new InvalidUsageEnvelopeProblem(descriptor.key, extraKey, "is not declared");
    }

    if (typeof candidate.tenantId !== "string" || candidate.tenantId.trim().length === 0) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "tenantId",
        "must be a non-empty string",
      );
    }

    if (descriptor.billing === "required" && !this.isStableEventId(candidate.eventId)) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "eventId",
        "must be a non-empty stable identifier for billing-required meters",
      );
    }

    if (candidate.eventId !== undefined && !this.isStableEventId(candidate.eventId)) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "eventId",
        "must be a non-empty stable identifier when provided",
      );
    }

    if (descriptor.aggregation === "SUM" && candidate.value === undefined) {
      throw new InvalidUsageEnvelopeProblem(descriptor.key, "value", "is required for SUM meters");
    }

    if (
      descriptor.aggregation === "SUM" &&
      (typeof candidate.value !== "number" || !Number.isFinite(candidate.value))
    ) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "value",
        "must be finite for SUM meters",
      );
    }

    if (
      descriptor.aggregation === "COUNT" &&
      Object.prototype.hasOwnProperty.call(candidate, "value")
    ) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "value",
        "must be omitted for COUNT meters",
      );
    }

    if (candidate.dimensions !== undefined && !this.isPlainRecord(candidate.dimensions)) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "dimensions",
        "must be an object when provided",
      );
    }
    if (candidate.metadata !== undefined && !this.isPlainRecord(candidate.metadata)) {
      throw new InvalidUsageEnvelopeProblem(
        descriptor.key,
        "metadata",
        "must be an object when provided",
      );
    }

    this.validateDimensions(descriptor.key, descriptor.dimensions, candidate.dimensions);

    return {
      tenantId: candidate.tenantId,
      meterId: descriptor.key,
      value: candidate.value as number | undefined,
      idempotencyKey: candidate.eventId as string | undefined,
      metadata: candidate.metadata,
    };
  }

  private validateDimensions(
    meterKey: string,
    schema: MeterRef["descriptor"]["dimensions"],
    input: Readonly<Record<string, unknown>> | undefined,
  ): void {
    const expectedKeys = Object.keys(schema).sort();
    const receivedKeys = input === undefined ? [] : Object.keys(input).sort();

    for (const key of expectedKeys) {
      if (!receivedKeys.includes(key)) {
        throw new InvalidUsageEnvelopeProblem(meterKey, `dimensions.${key}`, "is required");
      }
    }

    for (const key of receivedKeys) {
      if (!expectedKeys.includes(key)) {
        throw new InvalidUsageEnvelopeProblem(meterKey, `dimensions.${key}`, "is not declared");
      }
    }

    for (const key of expectedKeys) {
      const definition = schema[key];
      const value = input?.[key];

      if (!definition || typeof value !== "string" || !definition.values.includes(value)) {
        throw new InvalidUsageEnvelopeProblem(
          meterKey,
          `dimensions.${key}`,
          `must be one of: ${definition?.values.join(", ") ?? ""}`,
        );
      }
    }
  }

  private isStableEventId(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  /**
   * 사용량 조회
   */
  async getUsage(options: UsageQueryOptions): Promise<number> {
    return this.usageStorage.getUsage(options);
  }
}
