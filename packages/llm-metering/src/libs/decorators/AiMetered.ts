import 'reflect-metadata';
import type { LlmMeteringService } from '../LlmMeteringService';

export const AI_METERED_METADATA_KEY = Symbol('llm-meter:ai-metered');

export type AiMeteredOptions = {
  /**
   * LlmMeteringService에서 자동으로 추출하므로 생략 가능
   */
  tenantId?: string;
  /**
   * 메서드에서 usage를 추출하는 함수
   */
  usageExtractor?: (
    args: unknown[],
    result: unknown
  ) => { promptTokens: number; completionTokens: number; accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN' } | null;
  /**
   * 메서드에서 embedding usage를 추출하는 함수
   */
  embeddingUsageExtractor?: (
    args: unknown[],
    result: unknown
  ) => { tokens: number; accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN' } | null;
  /**
   * idempotencyKey 추출기
   */
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  /**
   * 추가 메타데이터 추출기
   */
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

export type AiMeteredMetadata = {
  tenantId?: string;
  usageExtractor?: (
    args: unknown[],
    result: unknown
  ) => { promptTokens: number; completionTokens: number; accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN' } | null;
  embeddingUsageExtractor?: (
    args: unknown[],
    result: unknown
  ) => { tokens: number; accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN' } | null;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

// LlmMeteringService 인스턴스를 저장할 전역 변수
let llmMeteringServiceInstance: LlmMeteringService | null = null;

/**
 * LlmMeteringService 인스턴스 설정 (앱 부트스트랩에서 호출)
 */
export function setLlmMeteringService(service: LlmMeteringService): void {
  llmMeteringServiceInstance = service;
}

/**
 * LlmMeteringService 인스턴스 조회
 */
export function getLlmMeteringService(): LlmMeteringService | null {
  return llmMeteringServiceInstance;
}

/**
 * @AiMetered 메서드 데코레이터
 *
 * @description
 * 메서드 호출 시 자동으로 LLM 사용량을 기록합니다.
 * LlmService의 generate/stream/embed 메서드에서 사용됩니다.
 *
 * @example
 * ```typescript
 * class MyService {
 *   @AiMetered()
 *   async generateText(prompt: string): Promise<string> {
 *     // LlmService.generate() 호출
 *     return await llmService.generate({ prompt });
 *   }
 *
 *   @AiMetered({
 *     idempotencyKeyExtractor: (args) => args[0]?.id,
 *   })
 *   async embedWithKey(text: string, id: string): Promise<number[]> {
 *     // ...
 *   }
 * }
 * ```
 */
export function AiMetered(options: AiMeteredOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    const metadata: AiMeteredMetadata = {
      tenantId: options.tenantId,
      usageExtractor: options.usageExtractor,
      embeddingUsageExtractor: options.embeddingUsageExtractor,
      idempotencyKeyExtractor: options.idempotencyKeyExtractor,
      metadataExtractor: options.metadataExtractor,
    };

    // 메타데이터 저장
    Reflect.defineMetadata(AI_METERED_METADATA_KEY, metadata, _target, propertyKey);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // 원본 메서드 실행
      const result = await originalMethod.apply(this, args);

      // LlmMeteringService가 설정되어 있으면 기록
      const service = getLlmMeteringService();
      if (service) {
        try {
          // tenantId 추출 (옵션 또는 this.tenantId)
          const tenantId = metadata.tenantId ?? (this as { tenantId?: string }).tenantId ?? 'default';

          // idempotencyKey 추출
          const idempotencyKey = metadata.idempotencyKeyExtractor?.(args) ?? `${String(propertyKey)}:${Date.now()}`;

          // 추가 메타데이터 추출
          const additionalMetadata = metadata.metadataExtractor?.(args, result);

          // GenerateResult 타입 감지 (usage 필드 확인)
          if (result && typeof result === 'object' && 'usage' in result) {
            const usageData = (result as { usage: unknown }).usage;

            if (usageData && typeof usageData === 'object') {
              // LlmUsage 타입: promptTokens + completionTokens
              if ('promptTokens' in usageData && 'completionTokens' in usageData) {
                const usage = usageData as {
                  promptTokens: number;
                  completionTokens: number;
                  totalTokens: number;
                  accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN';
                };

                // metadata에서 modelId, provider 추출
                const resultMetadata =
                  (result as { metadata?: { modelId?: string; provider?: string } }).metadata ?? {};
                const modelId = resultMetadata.modelId ?? 'unknown';
                const provider = resultMetadata.provider ?? 'unknown';

                // recordUsage 호출
                await service.recordUsage({
                  tenantId,
                  modelId,
                  provider,
                  usage: {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                    accuracy: usage.accuracy,
                  },
                  idempotencyKey,
                  metadata: { ...additionalMetadata, operationType: 'generate' },
                });
              }
              // EmbedResult 타입: tokens (또는 embedding 존재)
              else if ('tokens' in usageData || 'embedding' in result) {
                const tokens = 'tokens' in usageData ? (usageData as { tokens: number }).tokens : 0;
                const accuracy =
                  'accuracy' in usageData
                    ? (usageData as { accuracy?: 'EXACT' | 'ESTIMATED' | 'UNKNOWN' }).accuracy
                    : undefined;

                // metadata에서 modelId, provider 추출
                const resultMetadata =
                  (result as { metadata?: { modelId?: string; provider?: string } }).metadata ?? {};
                const modelId = resultMetadata.modelId ?? 'unknown';
                const provider = resultMetadata.provider ?? 'unknown';

                // recordEmbeddingUsage 호출
                await service.recordEmbeddingUsage({
                  tenantId,
                  modelId,
                  provider,
                  embeddingTokens: tokens,
                  idempotencyKey,
                  accuracy,
                });
              }
            }
          }
        } catch (error) {
          // Fail-safe: metering 실패해도 원본 결과는 반환
          console.error(`AiMetered failed for ${String(propertyKey)}:`, error);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 메서드에서 AiMetered 메타데이터 조회
 */
export function getAiMeteredMetadata(target: object, propertyKey: string | symbol): AiMeteredMetadata | undefined {
  return Reflect.getMetadata(AI_METERED_METADATA_KEY, target, propertyKey);
}
