/**
 * AI provider가 보고한 사용량 값의 정확도 수준입니다.
 */
export type UsageAccuracy = "EXACT" | "ESTIMATED" | "UNKNOWN";

/** SDK-independent token usage supplied by the application. */
export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  accuracy?: UsageAccuracy;
};

export const AI_INPUT_TOKENS = "llm.prompt_tokens";
export const AI_OUTPUT_TOKENS = "llm.completion_tokens";
export const AI_EMBEDDING_TOKENS = "llm.embedding_tokens";
export const AI_COST_USD_NANOS = "llm.cost_usd_nanos";

/**
 * 토큰 및 비용 메터링에 사용하는 AI 사용량 메트릭 식별자 타입입니다.
 */
export type AiMeterId =
  | typeof AI_INPUT_TOKENS
  | typeof AI_OUTPUT_TOKENS
  | typeof AI_EMBEDDING_TOKENS
  | typeof AI_COST_USD_NANOS;

/**
 * 텍스트 생성 호출에서 기록된 토큰 사용량과 비용입니다.
 */
export type AiUsageRecord = {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: UsageAccuracy;
  idempotencyKey: string;
  tenantId: string;
  timestamp: Date;
};

/**
 * 임베딩 호출에서 기록된 토큰 사용량과 비용입니다.
 */
export type AiEmbeddingUsageRecord = {
  embeddingTokens: number;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: UsageAccuracy;
  idempotencyKey: string;
  tenantId: string;
  timestamp: Date;
};

/**
 * 모델별 입력/출력 토큰 단가와 가격 메타데이터입니다.
 */
export type ModelPricing = {
  /** 입력 토큰 하나에 적용되는 단가입니다. */
  inputPricePerToken: number;
  /** 출력 토큰 하나에 적용되는 단가입니다. */
  outputPricePerToken: number;
  /** 가격 통화 코드입니다. */
  currency: string;
  /** 가격 데이터의 출처입니다. */
  source?: string;
  /** 가격이 적용되기 시작하는 날짜입니다. */
  effectiveDate?: string;
};

/**
 * 가격 레지스트리에 저장되는 모델 단가 항목입니다.
 */
export interface PricingRegistryEntry extends ModelPricing {
  /** AI 제공자 식별자입니다. */
  provider: string;
  /** 제공자 안에서 사용하는 모델 식별자입니다. */
  modelId: string;
}

/**
 * 버전과 출처를 포함하는 가격 레지스트리 정의입니다.
 */
export type PricingRegistryDefinition = {
  /** 가격 레지스트리 버전입니다. */
  version: string;
  /** provider/model 단위 가격 항목 목록입니다. */
  entries: readonly PricingRegistryEntry[];
  /** 레지스트리 전체 가격 데이터의 출처입니다. */
  source?: string;
  /** 레지스트리 가격이 적용되기 시작하는 날짜입니다. */
  effectiveDate?: string;
  /** 운영자가 참고할 추가 설명입니다. */
  notes?: string;
};

/**
 * 테넌트별 AI 비용 제한입니다.
 */
export type AiCostBudget = {
  /** 하루 동안 허용되는 최대 비용입니다. */
  dailyLimit: number;
  /** 한 달 동안 허용되는 최대 비용입니다. */
  monthlyLimit?: number;
  /** 제한을 적용할 테넌트 식별자입니다. */
  tenantId: string;
};

/**
 * AI 메터링 기록 실패 시 적용하는 처리 정책입니다.
 */
export type AiUsageFailurePolicy = "fail-closed";

/**
 * 메터링 기록에 더할 사용량 변화(delta)를 나타내는 타입입니다.
 */
export type AiMeterUsageDelta = {
  /** 변화량이 적용될 메트릭 식별자입니다. */
  meterId: AiMeterId;
  /** 메트릭에 더할 값입니다. */
  value: number;
  /**
   * 사용량을 만든 작업 이름입니다. 내장 기록 경로는 generate, embed, cost_tracking을 명시
   * 값으로 사용하며 스트리밍이나 통합 코드는 stream 같은 추가 작업 이름을 문자열 확장값으로
   * 전달할 수 있습니다.
   */
  operation: "generate" | "embed" | "cost_tracking" | string;
};

/**
 * 쿼터 정책을 실행할 때 전달하는 AI 사용량 컨텍스트입니다.
 */
export type AiUsageQuotaPolicyContext = {
  /** 쿼터를 적용할 테넌트 식별자입니다. */
  tenantId: string;
  /** 사용량이 발생한 모델 식별자입니다. */
  modelId: string;
  /** 사용량이 발생한 AI 제공자 식별자입니다. */
  provider: string;
  /** 쿼터 검사 대상 작업 이름입니다. */
  operation: string;
  /** 중복 기록을 방지하기 위한 멱등성 키입니다. */
  idempotencyKey: string;
  /** 이번 작업에서 기록하려는 메터 사용량 변화 목록입니다. */
  meters: readonly AiMeterUsageDelta[];
  /** 정책 구현체가 참고할 수 있는 추가 메타데이터입니다. */
  metadata?: Record<string, unknown>;
};

/**
 * AI 사용량 기록 전 quota를 검사하는 정책 인터페이스입니다.
 */
export interface AiUsageQuotaPolicy {
  /** 전달된 사용량 컨텍스트가 quota를 초과하면 Problem을 던집니다. */
  enforce(context: AiUsageQuotaPolicyContext): Promise<void>;
}
