import type { LlmUsageRecord } from "./types";

export interface LlmTelemetrySpanAdapter {
  setAttribute(key: string, value: string | number): void;
  addEvent(name: string, attributes: Record<string, unknown>): void;
}

/**
 * OTel GenAI Semantic Conventions 상수
 *
 * @description
 * - OTel semconv 변경 시 이 계층만 수정하면 됨
 * - https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */
const GEN_AI_SYSTEM = "gen_ai.system";
const GEN_AI_REQUEST_MODEL = "gen_ai.request.model";
const GEN_AI_USAGE_PROMPT_TOKENS = "gen_ai.usage.prompt_tokens";
const GEN_AI_USAGE_COMPLETION_TOKENS = "gen_ai.usage.completion_tokens";
const GEN_AI_USAGE_COST_USD = "gen_ai.usage.cost_usd";
const GEN_AI_CLIENT_USER = "gen_ai.client.user";
const GEN_AI_USAGE_ACCURACY = "gen_ai.usage.accuracy";

export class LlmTelemetryBridge {
  /**
   * LLM 사용량 기록을 OTel GenAI Span으로 변환
   *
   * @description
   * - GenAI Semantic Conventions 준수
   * - Span에 attributes 설정
   * - recordEvent를 사용하여 llm.usage 이벤트 기록
   */
  async recordLlmUsage(usageRecord: LlmUsageRecord, span: LlmTelemetrySpanAdapter): Promise<void> {
    const attributes = this.mapToGenAiAttributes(usageRecord);

    (Object.entries(attributes) as Array<[string, string | number]>).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });

    span.addEvent("llm.usage", {
      provider: usageRecord.provider,
      model: usageRecord.modelId,
      tenantId: usageRecord.tenantId,
    });
  }

  /**
   * LlmUsageRecord를 GenAI attributes로 매핑
   *
   * @description
   * - 낮춤 attribute mapper 계층 (OTel semconv 변경 시 격리)
   * - GenAI Semantic Conventions 준수
   */
  mapToGenAiAttributes(usageRecord: LlmUsageRecord): Record<string, unknown> {
    const attributes: Record<string, unknown> = {
      [GEN_AI_SYSTEM]: usageRecord.provider,
      [GEN_AI_REQUEST_MODEL]: usageRecord.modelId,
      [GEN_AI_USAGE_PROMPT_TOKENS]: usageRecord.promptTokens,
      [GEN_AI_USAGE_COMPLETION_TOKENS]: usageRecord.completionTokens,
      [GEN_AI_USAGE_COST_USD]: usageRecord.costUsd,
      [GEN_AI_CLIENT_USER]: usageRecord.tenantId,
    };

    if (usageRecord.accuracy !== undefined) {
      attributes[GEN_AI_USAGE_ACCURACY] = usageRecord.accuracy;
    }

    return attributes;
  }
}
