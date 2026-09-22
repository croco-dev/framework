import type { EventBus } from "@croco/events-core";
import { Token } from "@croco/framework-context";
import { DuplicateRecordProblem } from "@croco/metering-core";
import type { MeteringService, RecordOptions } from "@croco/metering-core";
import { AiUsageRecordedEvent } from "./events/AiUsageRecordedEvent";
import { defaultAiPricingTable, type AiPricingTable } from "./AiPricingTable";
import {
  AiUsageRecordFailedProblem,
  AiUsageQuotaExceededProblem,
  AiPricingNotFoundProblem,
} from "./problems/AiUsageProblems";
import { AI_OUTPUT_TOKENS, AI_COST_USD_NANOS, AI_EMBEDDING_TOKENS, AI_INPUT_TOKENS } from "./types";
import type {
  AiUsage,
  AiEmbeddingUsageRecord,
  AiUsageFailurePolicy,
  AiMeterUsageDelta,
  AiUsageQuotaPolicy,
  AiUsageRecord,
  ModelPricing,
} from "./types";

const USD_NANOS_PER_USD = 1_000_000_000;

type MeterRecordAttempt = {
  meterId: string;
  promise: Promise<unknown>;
};

type MeterWrite = {
  meterId: AiMeterUsageDelta["meterId"];
  value: number;
  operation: string;
  options: RecordOptions & { idempotencyKey: string };
};

type MeterWriteSelection = {
  pendingWrites: MeterWrite[];
  quotaWrites: MeterWrite[];
};

export type AiUsageEvent = {
  tenantId: string;
  modelId: string;
  provider: string;
  usage: AiUsage;
  idempotencyKey: string;
  metadata?: Record<string, unknown> & {
    operationType?: string;
  };
};

export type AiCostRecord = {
  tenantId: string;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
  idempotencyKey: string;
  timestamp: Date;
};

export type AiUsageIngestServiceOptions = {
  meteringService: MeteringService;
  eventBus?: EventBus;
  pricingTable?: AiPricingTable;
  quotaPolicy?: AiUsageQuotaPolicy;
  failurePolicy?: AiUsageFailurePolicy;
  defaultPricing?: {
    inputPricePerToken: number;
    outputPricePerToken: number;
    currency: string;
  };
};

/**
 * AI Metering 서비스
 *
 * @description
 * - metering-core를 래핑하여 AI 토큰/비용 추적 제공
 * - ingestGenerationUsage: generate/stream 호출 후 사용량 기록
 * - ingestEmbeddingUsage: embed/embedMany 호출 후 사용량 기록
 * - trackCost: AiPricingTable 기반 비용 계산
 * - checkQuota: quota 초과 체크
 */
export class AiUsageIngestService {
  static readonly token = new Token<AiUsageIngestService>("AiUsageIngestService");

  private readonly meteringService: MeteringService;
  private readonly eventBus?: EventBus;
  private readonly pricingTable: AiPricingTable;
  private readonly defaultPricing: AiUsageIngestServiceOptions["defaultPricing"];
  private readonly quotaPolicy?: AiUsageQuotaPolicy;

  constructor(options: AiUsageIngestServiceOptions) {
    this.meteringService = options.meteringService;
    this.eventBus = options.eventBus;
    this.pricingTable = options.pricingTable ?? defaultAiPricingTable;
    this.quotaPolicy = options.quotaPolicy;
    this.defaultPricing = options.defaultPricing ?? {
      inputPricePerToken: 0.000001,
      outputPricePerToken: 0.000002,
      currency: "USD",
    };
  }

  /**
   * 텍스트 생성 사용량 기록
   *
   * @description
   * - 최대 3개 meter 기록: 0보다 큰 prompt_tokens, completion_tokens, cost_usd_nanos
   * - 멱등성 보장 (idempotencyKey:suffix)
   * - accuracy 플래그 전파 (EXACT | ESTIMATED | UNKNOWN)
   */
  async ingestGenerationUsage(event: AiUsageEvent): Promise<AiUsageRecord> {
    const { tenantId, modelId, provider, usage, idempotencyKey, metadata } = event;

    // 1. Pricing 조회
    const pricing = this.pricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new AiPricingNotFoundProblem(provider, modelId);
    }
    const costUsd = this.pricingTable.calculateCost(
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        modelId,
        provider,
        costUsd: 0,
        idempotencyKey,
        tenantId,
        timestamp: new Date(),
        accuracy: usage.accuracy,
      },
      pricing,
    );

    // 3. 3개 meter 기록 (병렬)
    const operationType = metadata?.operationType ?? "generate";
    const baseMetadata = {
      provider,
      model: modelId,
      accuracy: usage.accuracy ?? "UNKNOWN",
      ...metadata,
      operationType,
    };
    this.assertValidMeterValue(AI_INPUT_TOKENS, usage.inputTokens, operationType);
    this.assertValidMeterValue(AI_OUTPUT_TOKENS, usage.outputTokens, operationType);
    const costUsdNanos = this.calculateUsdNanos(
      pricing,
      usage.inputTokens,
      usage.outputTokens,
      operationType,
    );
    const meterWrites: MeterWrite[] = [];
    if (usage.inputTokens > 0) {
      meterWrites.push({
        meterId: AI_INPUT_TOKENS,
        value: usage.inputTokens,
        operation: baseMetadata.operationType,
        options: {
          tenantId,
          meterId: AI_INPUT_TOKENS,
          value: usage.inputTokens,
          idempotencyKey: `${idempotencyKey}:prompt`,
          metadata: baseMetadata,
        },
      });
    }
    if (usage.outputTokens > 0) {
      meterWrites.push({
        meterId: AI_OUTPUT_TOKENS,
        value: usage.outputTokens,
        operation: baseMetadata.operationType,
        options: {
          tenantId,
          meterId: AI_OUTPUT_TOKENS,
          value: usage.outputTokens,
          idempotencyKey: `${idempotencyKey}:completion`,
          metadata: baseMetadata,
        },
      });
    }
    if (costUsdNanos > 0) {
      meterWrites.push({
        meterId: AI_COST_USD_NANOS,
        value: costUsdNanos,
        operation: baseMetadata.operationType,
        options: {
          tenantId,
          meterId: AI_COST_USD_NANOS,
          value: costUsdNanos,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        },
      });
    }

    const { pendingWrites, quotaWrites } = await this.selectPendingMeterWrites(
      meterWrites,
      operationType,
    );

    await this.enforceQuota({
      tenantId,
      modelId,
      provider,
      operation: baseMetadata.operationType,
      idempotencyKey,
      meters: quotaWrites.map(({ meterId, value, operation }) => ({
        meterId,
        value,
        operation,
      })),
      metadata: baseMetadata,
    });

    const recordAttempts = pendingWrites.map(({ meterId, options }) => ({
      meterId,
      promise: this.recordMeter(options),
    }));

    await this.assertRecordAttempts(recordAttempts, baseMetadata.operationType);

    // 4. AiUsageRecord 생성
    const usageRecord: AiUsageRecord = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      modelId,
      provider,
      costUsd,
      accuracy: usage.accuracy,
      idempotencyKey,
      tenantId,
      timestamp: new Date(),
    };

    // 5. 이벤트 발행
    if (this.eventBus) {
      await this.eventBus.publish(new AiUsageRecordedEvent(tenantId, usageRecord));
    }

    return usageRecord;
  }

  /**
   * 임베딩 사용량 기록
   *
   * @description
   * - 최대 2개 meter 기록: 0보다 큰 embedding_tokens, cost_usd_nanos
   * - embed/embedMany 전용
   */
  async ingestEmbeddingUsage(event: {
    tenantId: string;
    modelId: string;
    provider: string;
    embeddingTokens: number;
    idempotencyKey: string;
    accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
  }): Promise<AiEmbeddingUsageRecord> {
    const { tenantId, modelId, provider, embeddingTokens, idempotencyKey, accuracy } = event;

    // 1. Pricing 조회
    const pricing = this.pricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new AiPricingNotFoundProblem(provider, modelId);
    }
    const costUsd = this.pricingTable.calculateCost(
      {
        embeddingTokens,
        modelId,
        provider,
        costUsd: 0,
        idempotencyKey,
        tenantId,
        timestamp: new Date(),
        accuracy,
      },
      pricing,
    );

    // 3. 2개 meter 기록
    const baseMetadata = {
      provider,
      model: modelId,
      accuracy: accuracy ?? "UNKNOWN",
      operationType: "embed",
    };
    this.assertValidMeterValue(AI_EMBEDDING_TOKENS, embeddingTokens, baseMetadata.operationType);
    const costUsdNanos = this.calculateUsdNanos(
      pricing,
      embeddingTokens,
      0,
      baseMetadata.operationType,
    );
    const meterWrites: MeterWrite[] = [];
    if (embeddingTokens > 0) {
      meterWrites.push({
        meterId: AI_EMBEDDING_TOKENS,
        value: embeddingTokens,
        operation: baseMetadata.operationType,
        options: {
          tenantId,
          meterId: AI_EMBEDDING_TOKENS,
          value: embeddingTokens,
          idempotencyKey: `${idempotencyKey}:tokens`,
          metadata: baseMetadata,
        },
      });
    }
    if (costUsdNanos > 0) {
      meterWrites.push({
        meterId: AI_COST_USD_NANOS,
        value: costUsdNanos,
        operation: baseMetadata.operationType,
        options: {
          tenantId,
          meterId: AI_COST_USD_NANOS,
          value: costUsdNanos,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        },
      });
    }

    const { pendingWrites, quotaWrites } = await this.selectPendingMeterWrites(
      meterWrites,
      "embed",
    );

    await this.enforceQuota({
      tenantId,
      modelId,
      provider,
      operation: baseMetadata.operationType,
      idempotencyKey,
      meters: quotaWrites.map(({ meterId, value, operation }) => ({
        meterId,
        value,
        operation,
      })),
      metadata: baseMetadata,
    });

    const recordAttempts = pendingWrites.map(({ meterId, options }) => ({
      meterId,
      promise: this.recordMeter(options),
    }));
    await this.assertRecordAttempts(recordAttempts, baseMetadata.operationType);

    // 4. AiEmbeddingUsageRecord 생성
    const usageRecord: AiEmbeddingUsageRecord = {
      embeddingTokens,
      modelId,
      provider,
      costUsd,
      accuracy,
      idempotencyKey,
      tenantId,
      timestamp: new Date(),
    };

    return usageRecord;
  }

  /**
   * 비용 추적 및 계산
   *
   * @description
   * - AiPricingTable 조회 → 비용 계산
   * - 비용이 0보다 클 때 cost_usd_nanos meter 기록
   */
  async trackCost(event: AiUsageEvent): Promise<AiCostRecord> {
    const { tenantId, modelId, provider, usage, idempotencyKey } = event;

    // 1. Pricing 조회
    const pricing = this.pricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new AiPricingNotFoundProblem(provider, modelId);
    }
    const costUsd = this.pricingTable.calculateCost(
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        modelId,
        provider,
        costUsd: 0,
        idempotencyKey,
        tenantId,
        timestamp: new Date(),
        accuracy: usage.accuracy,
      },
      pricing,
    );

    const costUsdNanos = this.calculateUsdNanos(
      pricing,
      usage.inputTokens,
      usage.outputTokens,
      "cost_tracking",
    );
    const meterWrites: MeterWrite[] = [];
    if (costUsdNanos > 0) {
      const metadata = {
        provider,
        model: modelId,
        accuracy: usage.accuracy ?? "UNKNOWN",
        operationType: "cost_tracking",
      };
      meterWrites.push({
        meterId: AI_COST_USD_NANOS,
        value: costUsdNanos,
        operation: "cost_tracking",
        options: {
          tenantId,
          meterId: AI_COST_USD_NANOS,
          value: costUsdNanos,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata,
        },
      });
    }

    const { pendingWrites, quotaWrites } = await this.selectPendingMeterWrites(
      meterWrites,
      "cost_tracking",
    );

    // 3. cost_usd_nanos meter 기록
    await this.enforceQuota({
      tenantId,
      modelId,
      provider,
      operation: "cost_tracking",
      idempotencyKey,
      meters: quotaWrites.map(({ meterId, value, operation }) => ({
        meterId,
        value,
        operation,
      })),
      metadata: {
        provider,
        model: modelId,
        accuracy: usage.accuracy ?? "UNKNOWN",
        operationType: "cost_tracking",
      },
    });

    const recordAttempts = pendingWrites.map(({ meterId, options }) => ({
      meterId,
      promise: this.recordMeter(options),
    }));
    await this.assertRecordAttempts(recordAttempts, "cost_tracking");

    return {
      tenantId,
      modelId,
      provider,
      costUsd,
      accuracy: usage.accuracy,
      idempotencyKey,
      timestamp: new Date(),
    };
  }

  /**
   * Quota 체크
   *
   * @description
   * - tenantId별 quota 조회
   * - 초과 시 AiUsageQuotaExceededProblem throw
   */
  async checkQuota(
    tenantId: string,
    meterId: string,
    quotaLimit: number,
    requestedUsage = 0,
  ): Promise<boolean> {
    if (!Number.isFinite(requestedUsage) || requestedUsage < 0) {
      throw new AiUsageQuotaExceededProblem(meterId, requestedUsage, quotaLimit);
    }

    const currentUsage = await this.meteringService.getUsage({
      tenantId,
      meterId,
      period: "billing_cycle",
    });
    const projectedUsage = currentUsage + requestedUsage;

    if (projectedUsage > quotaLimit) {
      throw new AiUsageQuotaExceededProblem(meterId, projectedUsage, quotaLimit);
    }

    return true;
  }

  private async enforceQuota(context: {
    tenantId: string;
    modelId: string;
    provider: string;
    operation: string;
    idempotencyKey: string;
    meters: readonly AiMeterUsageDelta[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.quotaPolicy) {
      return;
    }

    try {
      await this.quotaPolicy.enforce(context);
    } catch (error) {
      if (error instanceof AiUsageQuotaExceededProblem) {
        throw error;
      }

      throw new AiUsageRecordFailedProblem(
        context.operation,
        context.meters.map((meter) => meter.meterId),
        error,
      );
    }
  }

  private assertValidMeterValue(meterId: string, value: number, operation: string): void {
    if (Number.isSafeInteger(value) && value >= 0) {
      return;
    }

    throw new AiUsageRecordFailedProblem(
      operation,
      [meterId],
      new TypeError(`Invalid AI metering value for '${meterId}': ${String(value)}`),
    );
  }

  private calculateUsdNanos(
    pricing: ModelPricing,
    inputTokens: number,
    outputTokens: number,
    operation: string,
  ): number {
    if (pricing.currency !== "USD") {
      throw new AiUsageRecordFailedProblem(
        operation,
        [AI_COST_USD_NANOS],
        new TypeError(`Unsupported AI cost currency: ${pricing.currency}`),
      );
    }
    if (
      !Number.isSafeInteger(inputTokens) ||
      inputTokens < 0 ||
      !Number.isSafeInteger(outputTokens) ||
      outputTokens < 0
    ) {
      throw new AiUsageRecordFailedProblem(
        operation,
        [AI_COST_USD_NANOS],
        new TypeError("AI token counts must be non-negative safe integers"),
      );
    }
    const inputPriceNanos = this.toExactUsdNanos(pricing.inputPricePerToken);
    const outputPriceNanos = this.toExactUsdNanos(pricing.outputPricePerToken);
    const total = inputPriceNanos * BigInt(inputTokens) + outputPriceNanos * BigInt(outputTokens);
    if (total >= 0 && total <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(total);
    }

    throw new AiUsageRecordFailedProblem(
      operation,
      [AI_COST_USD_NANOS],
      new TypeError(
        `AI cost must be exactly representable as non-negative safe-integer USD nanodollars`,
      ),
    );
  }

  private toExactUsdNanos(priceUsd: number): bigint {
    const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(priceUsd).toLowerCase());
    if (!match) {
      return BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
    }

    const integerDigits = match[1] ?? "0";
    const fractionalDigits = match[2] ?? "";
    const exponent = Number(match[3] ?? "0");
    const digits = BigInt(`${integerDigits}${fractionalDigits}`);
    const scale = exponent - fractionalDigits.length + Math.log10(USD_NANOS_PER_USD);
    if (scale >= 0) {
      return digits * BigInt(10) ** BigInt(scale);
    }

    const divisor = BigInt(10) ** BigInt(-scale);
    return digits % divisor === BigInt(0)
      ? digits / divisor
      : BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
  }

  private async assertRecordAttempts(
    attempts: MeterRecordAttempt[],
    operation: string,
  ): Promise<void> {
    const results = await Promise.allSettled(attempts.map((attempt) => attempt.promise));
    const firstRejectedIndex = results.findIndex((result) => result.status === "rejected");

    if (firstRejectedIndex === -1) {
      return;
    }

    const failedMeterIds = results.flatMap((result, index) =>
      result.status === "rejected" ? [attempts[index]?.meterId ?? "unknown"] : [],
    );
    const firstError = results[firstRejectedIndex];

    if (firstError.status === "rejected") {
      throw new AiUsageRecordFailedProblem(operation, failedMeterIds, firstError.reason);
    }
  }

  private async selectPendingMeterWrites(
    writes: readonly MeterWrite[],
    operation: string,
  ): Promise<MeterWriteSelection> {
    const statuses = await Promise.all(
      writes.map(({ options }) =>
        this.meteringService.getRecordStatus(
          options.tenantId,
          options.meterId,
          options.idempotencyKey,
        ),
      ),
    );
    const blockedWrites: MeterWrite[] = [];
    const pendingWrites: MeterWrite[] = [];
    const quotaWrites: MeterWrite[] = [];
    for (const [index, write] of writes.entries()) {
      const status = statuses[index];
      if (status === "completed") continue;
      if (status === "missing" || status === "retryable") {
        pendingWrites.push(write);
        quotaWrites.push(write);
        continue;
      }
      if (status === "persistence-uncertain" || status === "delivery-pending") {
        pendingWrites.push(write);
        continue;
      }
      if (status === "active" || status === "rejected") {
        blockedWrites.push(write);
        continue;
      }
      throw new AiUsageRecordFailedProblem(
        operation,
        [write.meterId],
        new TypeError(`Unknown metering record status: ${String(status)}`),
      );
    }
    const firstBlockedWrite = blockedWrites[0];
    if (firstBlockedWrite) {
      throw new AiUsageRecordFailedProblem(
        operation,
        blockedWrites.map(({ meterId }) => meterId),
        new DuplicateRecordProblem(firstBlockedWrite.options.idempotencyKey),
      );
    }

    return { pendingWrites, quotaWrites };
  }

  private async recordMeter(options: RecordOptions & { idempotencyKey: string }): Promise<void> {
    const readStatus = () =>
      this.meteringService.getRecordStatus(
        options.tenantId,
        options.meterId,
        options.idempotencyKey,
      );
    if ((await readStatus()) === "completed") return;

    try {
      await this.meteringService.record(options);
    } catch (error) {
      if (error instanceof DuplicateRecordProblem && (await readStatus()) === "completed") return;
      throw error;
    }
  }
}
