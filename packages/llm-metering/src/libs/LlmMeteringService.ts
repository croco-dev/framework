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
import type { LlmEmbeddingUsageRecord, LlmUsageRecord } from "./types";

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

  constructor(options: LlmMeteringServiceOptions) {
    this.meteringService = options.meteringService;
    this.eventBus = options.eventBus;
    this.pricingTable = options.pricingTable ?? defaultPricingTable;
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
   * - 3개 meter 동시 기록: prompt_tokens, completion_tokens, cost_usd
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
    const baseMetadata = {
      provider,
      model: modelId,
      accuracy: usage.accuracy ?? "UNKNOWN",
      operationType: metadata?.operationType ?? "generate",
      ...metadata,
    };

    const recordAttempts: MeterRecordAttempt[] = [
      // Prompt tokens
      {
        meterId: "llm.prompt_tokens",
        promise: this.meteringService.record({
          tenantId,
          meterId: "llm.prompt_tokens",
          value: usage.promptTokens,
          idempotencyKey: `${idempotencyKey}:prompt`,
          metadata: baseMetadata,
        }),
      },

      // Completion tokens
      {
        meterId: "llm.completion_tokens",
        promise: this.meteringService.record({
          tenantId,
          meterId: "llm.completion_tokens",
          value: usage.completionTokens,
          idempotencyKey: `${idempotencyKey}:completion`,
          metadata: baseMetadata,
        }),
      },

      // Cost USD
      {
        meterId: "llm.cost_usd",
        promise: this.meteringService.record({
          tenantId,
          meterId: "llm.cost_usd",
          value: costUsd,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        }),
      },
    ];

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
   * - 2개 meter 기록: embedding_tokens, cost_usd
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

    await this.assertRecordAttempts(
      [
        {
          meterId: "llm.embedding_tokens",
          promise: this.meteringService.record({
            tenantId,
            meterId: "llm.embedding_tokens",
            value: embeddingTokens,
            idempotencyKey: `${idempotencyKey}:tokens`,
            metadata: baseMetadata,
          }),
        },
        {
          meterId: "llm.cost_usd",
          promise: this.meteringService.record({
            tenantId,
            meterId: "llm.cost_usd",
            value: costUsd,
            idempotencyKey: `${idempotencyKey}:cost`,
            metadata: baseMetadata,
          }),
        },
      ],
      baseMetadata.operationType,
    );

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
   * - cost_usd meter 기록
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

    // 3. cost_usd meter 기록
    await this.assertRecordAttempts(
      [
        {
          meterId: "llm.cost_usd",
          promise: this.meteringService.record({
            tenantId,
            meterId: "llm.cost_usd",
            value: costUsd,
            idempotencyKey: `${idempotencyKey}:cost`,
            metadata: {
              provider,
              model: modelId,
              accuracy: usage.accuracy ?? "UNKNOWN",
              operationType: "cost_tracking",
            },
          }),
        },
      ],
      "cost_tracking",
    );

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
  async checkQuota(tenantId: string, meterId: string, quotaLimit: number): Promise<boolean> {
    const currentUsage = await this.meteringService.getUsage({
      tenantId,
      meterId,
      period: "billing_cycle",
    });

    if (currentUsage > quotaLimit) {
      throw new LlmQuotaExceededProblem(meterId, currentUsage, quotaLimit);
    }

    return true;
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
      throw new LlmMeteringRecordFailedProblem(operation, failedMeterIds, firstError.reason);
    }
  }
}
