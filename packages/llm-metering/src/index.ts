/**
 * @packageDocumentation
 *
 * LLM 토큰 사용량과 비용을 기록하고 quota를 강제하는 미터링 패키지입니다.
 */

/**
 * @AiMetered 데코레이터가 사용하는 메타데이터 타입입니다.
 */
export type { AiMeteredMetadata, AiMeteredOptions } from "./libs/decorators/AiMetered";

/**
 * LLM 호출 결과를 자동으로 계량하는 데코레이터와 서비스 바인딩 유틸리티입니다.
 */
export {
  AiMetered,
  getAiMeteredMetadata,
  getLlmMeteringService,
  setLlmMeteringService,
} from "./libs/decorators/AiMetered";

/**
 * 비용 예산 초과 시 발행되는 이벤트입니다.
 */
export { LlmCostBudgetExceededEvent } from "./libs/events/LlmCostBudgetExceededEvent";

/**
 * LLM 사용량 기록 완료 시 발행되는 이벤트입니다.
 */
export { LlmUsageRecordedEvent } from "./libs/events/LlmUsageRecordedEvent";

/**
 * LlmMeteringService 입력과 결과에 사용하는 타입입니다.
 */
export type {
  LlmCostRecord,
  LlmMeteringServiceOptions,
  LlmUsageEvent,
} from "./libs/LlmMeteringService";

/**
 * 토큰 사용량 기록, 비용 계산, quota 확인을 담당하는 핵심 서비스입니다.
 */
export { LlmMeteringService } from "./libs/LlmMeteringService";

/**
 * 기본 가격표와 가격 계산기 구현체입니다.
 */
export { defaultPricingTable, PricingTable, samplePricingRegistry } from "./libs/PricingTable";

/**
 * LLM 미터링 과정에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  LlmCostLimitExceededProblem,
  LlmMeteringRecordFailedProblem,
  LlmQuotaExceededProblem,
  PricingNotFoundProblem,
  PricingRegistryConflictProblem,
} from "./libs/problems/LlmMeteringProblems";

/**
 * 스트리밍 응답에서 사용량을 추출하고 계량하는 유틸리티입니다.
 */
export {
  createMeteredAsyncIterable,
  extractUsageFromChunk,
  isAsyncIterable,
  type UsageWithModelInfo,
} from "./libs/streamMetering";

export type {
  LlmMeterId,
  LlmMeteringFailurePolicy,
  LlmMeterUsageDelta,
  LlmCostBudget,
  LlmEmbeddingUsageRecord,
  LlmQuotaPolicy,
  LlmQuotaPolicyContext,
  LlmUsageRecord,
  ModelPricing,
  PricingRegistryDefinition,
  PricingRegistryEntry,
  UsageAccuracy,
} from "./libs/types";

/**
 * 기본 meter 이름 상수입니다.
 */
export {
  COMPLETION_TOKENS,
  COST_USD,
  COST_USD_NANOS,
  EMBEDDING_TOKENS,
  PROMPT_TOKENS,
} from "./libs/types";
