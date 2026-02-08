import type { EventBus } from '@croco/events-core';
import { Token } from '@croco/framework-context';
import type { LlmMetadata, LlmUsage } from '@croco/llm-core';
import type { MeteringService } from '@croco/metering-core';
import { LlmUsageRecordedEvent } from './events/LlmUsageRecordedEvent';
import { PricingTable } from './PricingTable';
import { LlmQuotaExceededProblem } from './problems/LlmMeteringProblems';
import type { LlmEmbeddingUsageRecord, LlmUsageRecord } from './types';

export type LlmUsageEvent = {
  tenantId: string;
  modelId: string;
  provider: string;
  usage: LlmUsage;
  idempotencyKey: string;
  metadata?: LlmMetadata;
};

export type LlmCostRecord = {
  tenantId: string;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN';
  idempotencyKey: string;
  timestamp: Date;
};

export type LlmMeteringServiceOptions = {
  meteringService: MeteringService;
  eventBus?: EventBus;
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
  static readonly token = new Token<LlmMeteringService>('LlmMeteringService');

  private readonly meteringService: MeteringService;
  private readonly eventBus?: EventBus;
  private readonly defaultPricing: LlmMeteringServiceOptions['defaultPricing'];

  constructor(options: LlmMeteringServiceOptions) {
    this.meteringService = options.meteringService;
    this.eventBus = options.eventBus;
    this.defaultPricing = options.defaultPricing ?? {
      inputPricePerToken: 0.000001,
      outputPricePerToken: 0.000002,
      currency: 'USD',
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
    const pricing = PricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new Error(`Pricing not found for provider ${provider} and model ${modelId}`);
    }
    const costUsd = PricingTable.calculateCost(
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
      pricing
    );

    // 3. 3개 meter 기록 (병렬)
    const baseMetadata = {
      provider,
      model: modelId,
      accuracy: usage.accuracy ?? 'UNKNOWN',
      operationType: metadata?.operationType ?? 'generate',
      ...metadata,
    };

    const recordPromises = [
      // Prompt tokens
      this.meteringService
        .record({
          tenantId,
          meterId: 'llm.prompt_tokens',
          value: usage.promptTokens,
          idempotencyKey: `${idempotencyKey}:prompt`,
          metadata: baseMetadata,
        })
        .catch((error) => {
          // Fail-safe: 기록 실패 시 로그만 남기고 계속 진행
          console.error(`Failed to record prompt tokens: ${error}`);
          return null;
        }),

      // Completion tokens
      this.meteringService
        .record({
          tenantId,
          meterId: 'llm.completion_tokens',
          value: usage.completionTokens,
          idempotencyKey: `${idempotencyKey}:completion`,
          metadata: baseMetadata,
        })
        .catch((error) => {
          console.error(`Failed to record completion tokens: ${error}`);
          return null;
        }),

      // Cost USD
      this.meteringService
        .record({
          tenantId,
          meterId: 'llm.cost_usd',
          value: costUsd,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        })
        .catch((error) => {
          console.error(`Failed to record cost: ${error}`);
          return null;
        }),
    ];

    await Promise.allSettled(recordPromises);

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
    accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN';
  }): Promise<LlmEmbeddingUsageRecord> {
    const { tenantId, modelId, provider, embeddingTokens, idempotencyKey, accuracy } = event;

    // 1. Pricing 조회
    const pricing = PricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new Error(`Pricing not found for provider ${provider} and model ${modelId}`);
    }
    const costUsd = PricingTable.calculateCost(
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
      pricing
    );

    // 3. 2개 meter 기록
    const baseMetadata = {
      provider,
      model: modelId,
      accuracy: accuracy ?? 'UNKNOWN',
      operationType: 'embed',
    };

    await Promise.allSettled([
      this.meteringService
        .record({
          tenantId,
          meterId: 'llm.embedding_tokens',
          value: embeddingTokens,
          idempotencyKey: `${idempotencyKey}:tokens`,
          metadata: baseMetadata,
        })
        .catch((error) => {
          console.error(`Failed to record embedding tokens: ${error}`);
          return null;
        }),

      this.meteringService
        .record({
          tenantId,
          meterId: 'llm.cost_usd',
          value: costUsd,
          idempotencyKey: `${idempotencyKey}:cost`,
          metadata: baseMetadata,
        })
        .catch((error) => {
          console.error(`Failed to record embedding cost: ${error}`);
          return null;
        }),
    ]);

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
    const pricing = PricingTable.getPrice(provider, modelId) ?? this.defaultPricing;

    // 2. 비용 계산
    if (!pricing) {
      throw new Error(`Pricing not found for provider ${provider} and model ${modelId}`);
    }
    const costUsd = PricingTable.calculateCost(
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
      pricing
    );

    // 3. cost_usd meter 기록
    await this.meteringService
      .record({
        tenantId,
        meterId: 'llm.cost_usd',
        value: costUsd,
        idempotencyKey: `${idempotencyKey}:cost`,
        metadata: {
          provider,
          model: modelId,
          accuracy: usage.accuracy ?? 'UNKNOWN',
          operationType: 'cost_tracking',
        },
      })
      .catch((error) => {
        console.error(`Failed to record cost: ${error}`);
      });

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
      period: 'billing_cycle',
    });

    if (currentUsage > quotaLimit) {
      throw new LlmQuotaExceededProblem(meterId, currentUsage, quotaLimit);
    }

    return true;
  }
}
