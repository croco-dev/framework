import type { EventBus } from "@croco/events-core";
import { Token } from "@croco/framework-context";
import type { LlmMetadata, LlmUsage } from "@croco/llm-core";
import type { MeteringService } from "@croco/metering-core";
import { LlmUsageRecordedEvent } from "./events/LlmUsageRecordedEvent";
import { defaultPricingTable, type PricingTable } from "./PricingTable";
import {
  LlmMeteringRecordFailedProblem,
  LlmQuotaExceededProblem,
  PricingNotFoundProblem,
} from "./problems/LlmMeteringProblems";
import {
  COMPLETION_TOKENS,
  COST_USD_NANOS,
  EMBEDDING_TOKENS,
  PROMPT_TOKENS,
  type LlmEmbeddingUsageRecord,
  type LlmMeteringFailurePolicy,
  type LlmMeterUsageDelta,
  type ModelPricing,
  type LlmQuotaPolicy,
  type LlmUsageRecord,
} from "./types";

const USD_NANOS_PER_USD = 1_000_000_000;

type MeterRecordAttempt = {
  meterId: string;
  promise: Promise<unknown>;
};

export type LlmUsageEvent = {
  tenantId: string;
  modelId: string;
  provider: string;
  usage: LlmUsage;
  idempotencyKey: string;
  metadata?: Omit<LlmMetadata, "modelId"> & {
    operationType?: string;
  };
};

export type LlmCostRecord = {
  tenantId: string;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
  idempotencyKey: string;
  timestamp: Date;
};

export type LlmMeteringServiceOptions = {
  meteringService: MeteringService;
  eventBus?: EventBus;
  pricingTable?: PricingTable;
  quotaPolicy?: LlmQuotaPolicy;
  failurePolicy?: LlmMeteringFailurePolicy;
  defaultPricing?: {
    inputPricePerToken: number;
    outputPricePerToken: number;
    currency: string;
  };
};

/**
 * LLM Metering 서비스
 *
 * @description
 * - metering-core를 래핑하여 LLM 토큰/비용 추적 제공
 * - recordUsage: generate/stream 호출 후 사용량 기록
 * - recordEmbeddingUsage: embed/embedMany 호출 후 사용량 기록
 * - trackCost: PricingTable 기반 비용 계산
 * - checkQuota: quota 초과 체크
 */
export class LlmMeteringService {
  static readonly token = new Token<LlmMeteringService>("LlmMeteringService");

  private readonly meteringService: MeteringService;
  private readonly eventBus?: EventBus;
  private readonly pricingTable: PricingTable;
  private readonly defaultPricing: LlmMeteringServiceOptions["defaultPricing"];
  private readonly quotaPolicy?: LlmQuotaPolicy;
  private readonly failurePolicy: LlmMeteringFailurePolicy;

  constructor(options: LlmMeteringServiceOptions) {
    this.meteringService = options.meteringService;
    this.eventBus = options.eventBus;
    this.pricingTable = options.pricingTable ?? defaultPricingTable;
    this.quotaPolicy = options.quotaPolicy;
    this.failurePolicy = options.failurePolicy ?? "fail-closed";
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
   * - 3개 meter 동시 기록: prompt_tokens, completion_tokens, cost_usd_nanos
   * - 멱등성 보장 (idempotencyKey:suffix)
   * - accuracy 플래그 전파 (reported|estimated)
   */
  async recordUsage(event: LlmUsageEvent): Promise<LlmUsageRecord> {
    const { tenantId, modelId, provider, usage, idempotencyKey, metadata } = event;

    // 1. Pricing 조회
    const pricing = this.pricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new PricingNotFoundProblem(provider, modelId);
    }
    const costUsd = this.pricingTable.calculateCost(
      {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
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
    this.assertValidMeterValue(PROMPT_TOKENS, usage.promptTokens, operationType);
    this.assertValidMeterValue(COMPLETION_TOKENS, usage.completionTokens, operationType);
    const costUsdNanos = this.calculateUsdNanos(
      pricing,
      usage.promptTokens,
      usage.completionTokens,
      operationType,
    );
    const meterDeltas: LlmMeterUsageDelta[] = [];
    if (usage.promptTokens > 0) {
      meterDeltas.push({
        meterId: PROMPT_TOKENS,
        value: usage.promptTokens,
        operation: baseMetadata.operationType,
      });
    }
    if (usage.completionTokens > 0) {
      meterDeltas.push({
        meterId: COMPLETION_TOKENS,
        value: usage.completionTokens,
        operation: baseMetadata.operationType,
      });
    }
    if (costUsdNanos > 0) {
      meterDeltas.push({
        meterId: COST_USD_NANOS,
        value: costUsdNanos,
        operation: baseMetadata.operationType,
      });
    }

    await this.enforceQuota({
      tenantId,
      modelId,
      provider,
      operation: baseMetadata.operationType,
      idempotencyKey,
      meters: meterDeltas,
      metadata: baseMetadata,
    });

    const recordAttempts: MeterRecordAttempt[] = [];
    if (usage.promptTokens > 0) {
      recordAttempts.push({
        meterId: PROMPT_TOKENS,
        promise: this.meteringService.record({
          tenantId,
          meterId: PROMPT_TOKENS,
          value: usage.promptTokens,
          idempotencyKey: `${idempotencyKey}:prompt`,
          metadata: baseMetadata,
        }),
      });
    }
    if (usage.completionTokens > 0) {
      recordAttempts.push({
        meterId: COMPLETION_TOKENS,
        promise: this.meteringService.record({
          tenantId,
          meterId: COMPLETION_TOKENS,
          value: usage.completionTokens,
          idempotencyKey: `${idempotencyKey}:completion`,
          metadata: baseMetadata,
        }),
      });
    }
    if (costUsdNanos > 0) {
      recordAttempts.push({
        meterId: COST_USD_NANOS,
        promise: this.meteringService.record({
          tenantId,
          meterId: COST_USD_NANOS,
          value: costUsdNanos,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        }),
      });
    }

    await this.assertRecordAttempts(recordAttempts, baseMetadata.operationType);

    // 4. LlmUsageRecord 생성
    const usageRecord: LlmUsageRecord = {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
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
      await this.eventBus.publish(new LlmUsageRecordedEvent(tenantId, usageRecord));
    }

    return usageRecord;
  }

  /**
   * 임베딩 사용량 기록
   *
   * @description
   * - 2개 meter 기록: embedding_tokens, cost_usd_nanos
   * - embed/embedMany 전용
   */
  async recordEmbeddingUsage(event: {
    tenantId: string;
    modelId: string;
    provider: string;
    embeddingTokens: number;
    idempotencyKey: string;
    accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
  }): Promise<LlmEmbeddingUsageRecord> {
    const { tenantId, modelId, provider, embeddingTokens, idempotencyKey, accuracy } = event;

    // 1. Pricing 조회
    const pricing = this.pricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new PricingNotFoundProblem(provider, modelId);
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
    this.assertValidMeterValue(EMBEDDING_TOKENS, embeddingTokens, baseMetadata.operationType);
    const costUsdNanos = this.calculateUsdNanos(
      pricing,
      embeddingTokens,
      0,
      baseMetadata.operationType,
    );
    const meterDeltas: LlmMeterUsageDelta[] = [];
    if (embeddingTokens > 0) {
      meterDeltas.push({
        meterId: EMBEDDING_TOKENS,
        value: embeddingTokens,
        operation: baseMetadata.operationType,
      });
    }
    if (costUsdNanos > 0) {
      meterDeltas.push({
        meterId: COST_USD_NANOS,
        value: costUsdNanos,
        operation: baseMetadata.operationType,
      });
    }

    await this.enforceQuota({
      tenantId,
      modelId,
      provider,
      operation: baseMetadata.operationType,
      idempotencyKey,
      meters: meterDeltas,
      metadata: baseMetadata,
    });

    const recordAttempts: MeterRecordAttempt[] = [];
    if (embeddingTokens > 0) {
      recordAttempts.push({
        meterId: EMBEDDING_TOKENS,
        promise: this.meteringService.record({
          tenantId,
          meterId: EMBEDDING_TOKENS,
          value: embeddingTokens,
          idempotencyKey: `${idempotencyKey}:tokens`,
          metadata: baseMetadata,
        }),
      });
    }
    if (costUsdNanos > 0) {
      recordAttempts.push({
        meterId: COST_USD_NANOS,
        promise: this.meteringService.record({
          tenantId,
          meterId: COST_USD_NANOS,
          value: costUsdNanos,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        }),
      });
    }
    await this.assertRecordAttempts(recordAttempts, baseMetadata.operationType);

    // 4. LlmEmbeddingUsageRecord 생성
    const usageRecord: LlmEmbeddingUsageRecord = {
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
   * - PricingTable 조회 → 비용 계산
   * - cost_usd_nanos meter 기록
   */
  async trackCost(event: LlmUsageEvent): Promise<LlmCostRecord> {
    const { tenantId, modelId, provider, usage, idempotencyKey } = event;

    // 1. Pricing 조회
    const pricing = this.pricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new PricingNotFoundProblem(provider, modelId);
    }
    const costUsd = this.pricingTable.calculateCost(
      {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
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
      usage.promptTokens,
      usage.completionTokens,
      "cost_tracking",
    );
    const meterDeltas: LlmMeterUsageDelta[] = [];
    if (costUsdNanos > 0) {
      meterDeltas.push({
        meterId: COST_USD_NANOS,
        value: costUsdNanos,
        operation: "cost_tracking",
      });
    }

    // 3. cost_usd_nanos meter 기록
    await this.enforceQuota({
      tenantId,
      modelId,
      provider,
      operation: "cost_tracking",
      idempotencyKey,
      meters: meterDeltas,
      metadata: {
        provider,
        model: modelId,
        accuracy: usage.accuracy ?? "UNKNOWN",
        operationType: "cost_tracking",
      },
    });

    const recordAttempts: MeterRecordAttempt[] = [];
    if (costUsdNanos > 0) {
      recordAttempts.push({
        meterId: COST_USD_NANOS,
        promise: this.meteringService.record({
          tenantId,
          meterId: COST_USD_NANOS,
          value: costUsdNanos,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: {
            provider,
            model: modelId,
            accuracy: usage.accuracy ?? "UNKNOWN",
            operationType: "cost_tracking",
          },
        }),
      });
    }
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
   * - 초과 시 LlmQuotaExceededProblem throw
   */
  async checkQuota(
    tenantId: string,
    meterId: string,
    quotaLimit: number,
    requestedUsage = 0,
  ): Promise<boolean> {
    if (!Number.isFinite(requestedUsage) || requestedUsage < 0) {
      throw new LlmQuotaExceededProblem(meterId, requestedUsage, quotaLimit);
    }

    const currentUsage = await this.meteringService.getUsage({
      tenantId,
      meterId,
      period: "billing_cycle",
    });
    const projectedUsage = currentUsage + requestedUsage;

    if (projectedUsage > quotaLimit) {
      throw new LlmQuotaExceededProblem(meterId, projectedUsage, quotaLimit);
    }

    return true;
  }

  private async enforceQuota(context: {
    tenantId: string;
    modelId: string;
    provider: string;
    operation: string;
    idempotencyKey: string;
    meters: readonly LlmMeterUsageDelta[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.quotaPolicy) {
      return;
    }

    try {
      await this.quotaPolicy.enforce(context);
    } catch (error) {
      if (error instanceof LlmQuotaExceededProblem) {
        throw error;
      }

      throw new LlmMeteringRecordFailedProblem(
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

    throw new LlmMeteringRecordFailedProblem(
      operation,
      [meterId],
      new TypeError(`Invalid LLM metering value for '${meterId}': ${String(value)}`),
    );
  }

  private calculateUsdNanos(
    pricing: ModelPricing,
    inputTokens: number,
    outputTokens: number,
    operation: string,
  ): number {
    if (
      !Number.isSafeInteger(inputTokens) ||
      inputTokens < 0 ||
      !Number.isSafeInteger(outputTokens) ||
      outputTokens < 0
    ) {
      throw new LlmMeteringRecordFailedProblem(
        operation,
        [COST_USD_NANOS],
        new TypeError("LLM token counts must be non-negative safe integers"),
      );
    }
    const inputPriceNanos = this.toExactUsdNanos(pricing.inputPricePerToken);
    const outputPriceNanos = this.toExactUsdNanos(pricing.outputPricePerToken);
    const total = inputPriceNanos * BigInt(inputTokens) + outputPriceNanos * BigInt(outputTokens);
    if (total >= 0 && total <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(total);
    }

    throw new LlmMeteringRecordFailedProblem(
      operation,
      [COST_USD_NANOS],
      new TypeError(
        `LLM cost must be exactly representable as non-negative safe-integer USD nanodollars`,
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

    if (this.failurePolicy !== "fail-closed") {
      return;
    }

    const failedMeterIds = results.flatMap((result, index) =>
      result.status === "rejected" ? [attempts[index]?.meterId ?? "unknown"] : [],
    );
    const firstError = results[firstRejectedIndex];

    if (firstError.status === "rejected") {
      throw new LlmMeteringRecordFailedProblem(operation, failedMeterIds, firstError.reason);
    }
  }
}
