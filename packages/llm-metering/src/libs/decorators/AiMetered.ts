import { createHash } from "node:crypto";
import "reflect-metadata";
import type { LlmMeteringService } from "../LlmMeteringService";
import { createMeteredAsyncIterable, isAsyncIterable } from "../streamMetering";

export const AI_METERED_METADATA_KEY = Symbol("llm-meter:ai-metered");

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
    result: unknown,
  ) => {
    promptTokens: number;
    completionTokens: number;
    accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
  } | null;
  /**
   * 메서드에서 embedding usage를 추출하는 함수
   */
  embeddingUsageExtractor?: (
    args: unknown[],
    result: unknown,
  ) => { tokens: number; accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN" } | null;
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
    result: unknown,
  ) => {
    promptTokens: number;
    completionTokens: number;
    accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
  } | null;
  embeddingUsageExtractor?: (
    args: unknown[],
    result: unknown,
  ) => { tokens: number; accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN" } | null;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

// LlmMeteringService 인스턴스를 저장할 전역 변수
let llmMeteringServiceInstance: LlmMeteringService | null = null;

function normalizeForIdempotency(value: unknown, seen: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "undefined") {
    return "[undefined]";
  }

  if (typeof value === "function") {
    return "[function]";
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForIdempotency(item, seen));
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[circular]";
  }

  seen.add(value);

  const normalizedEntries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nestedValue]) => [key, normalizeForIdempotency(nestedValue, seen)]);

  seen.delete(value);

  return Object.fromEntries(normalizedEntries);
}

function createDefaultIdempotencyKey(propertyKey: string | symbol, args: unknown[]): string {
  const normalizedArgs = normalizeForIdempotency(args, new WeakSet<object>());
  const hash = createHash("sha256").update(JSON.stringify(normalizedArgs)).digest("hex");

  return `${String(propertyKey)}:${hash}`;
}

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
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
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
      if (!service) {
        return result;
      }

      const tenantId = metadata.tenantId ?? (this as { tenantId?: string }).tenantId ?? "default";
      const idempotencyKey =
        metadata.idempotencyKeyExtractor?.(args) ?? createDefaultIdempotencyKey(propertyKey, args);
      const additionalMetadata = metadata.metadataExtractor?.(args, result);

      if (isAsyncIterable(result)) {
        return createMeteredAsyncIterable(result, {
          onComplete: async (usageInfo) => {
            if (!usageInfo) {
              return;
            }

            await service.recordUsage({
              tenantId,
              modelId: usageInfo.modelId,
              provider: usageInfo.provider,
              usage: usageInfo.usage,
              idempotencyKey,
              metadata: {
                ...additionalMetadata,
                operationType: "stream",
                modelId: usageInfo.modelId,
              },
            });
          },
        });
      }

      // GenerateResult 타입 감지 (usage 필드 확인)
      if (result && typeof result === "object" && "usage" in result) {
        const usageData = (result as { usage: unknown }).usage;

        if (usageData && typeof usageData === "object") {
          // LlmUsage 타입: promptTokens + completionTokens
          if ("promptTokens" in usageData && "completionTokens" in usageData) {
            const usage = usageData as {
              promptTokens: number;
              completionTokens: number;
              totalTokens: number;
              accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN";
            };

            // metadata에서 modelId, provider 추출
            const resultMetadata =
              (result as { metadata?: { modelId?: string; provider?: string } }).metadata ?? {};
            const modelId = resultMetadata.modelId ?? "unknown";
            const provider = resultMetadata.provider ?? "unknown";

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
              metadata: { ...additionalMetadata, operationType: "generate", modelId },
            });
          }
          // EmbedResult 타입: tokens (또는 embedding 존재)
          else if ("tokens" in usageData || "embedding" in result) {
            const tokens = "tokens" in usageData ? (usageData as { tokens: number }).tokens : 0;
            const accuracy =
              "accuracy" in usageData
                ? (usageData as { accuracy?: "EXACT" | "ESTIMATED" | "UNKNOWN" }).accuracy
                : undefined;

            // metadata에서 modelId, provider 추출
            const resultMetadata =
              (result as { metadata?: { modelId?: string; provider?: string } }).metadata ?? {};
            const modelId = resultMetadata.modelId ?? "unknown";
            const provider = resultMetadata.provider ?? "unknown";

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

      return result;
    };

    return descriptor;
  };
}

/**
 * 메서드에서 AiMetered 메타데이터 조회
 */
export function getAiMeteredMetadata(
  target: object,
  propertyKey: string | symbol,
): AiMeteredMetadata | undefined {
  return Reflect.getMetadata(AI_METERED_METADATA_KEY, target, propertyKey);
}
