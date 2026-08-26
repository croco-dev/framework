/**
 * @packageDocumentation
 *
 * 생성, 스트리밍, 도구 호출, 임베딩을 제공하는 LLM 코어 패키지입니다.
 */

/**
 * LLM 데코레이터, 메타데이터 조회, 실행 scope 및 기본 서비스 바인딩 유틸리티입니다.
 */
export {
  clearLlmService,
  getLlmService,
  getLlmMetadata,
  Llm,
  runWithLlmService,
  setLlmService,
  type LlmMethodMetadata,
  type LlmInvocationOptions,
  type LlmOptions,
} from "./libs/decorators/Llm";

/**
 * 텍스트 생성 완료 시 발행되는 이벤트입니다.
 */
export { LlmGeneratedEvent } from "./libs/events/LlmGeneratedEvent";

/**
 * 스트리밍 생성 완료 시 발행되는 이벤트입니다.
 */
export { LlmStreamCompletedEvent } from "./libs/events/LlmStreamCompletedEvent";

/**
 * 도구 호출 이벤트와 도구 호출 정보 타입입니다.
 */
export { LlmToolCalledEvent, type ToolCall } from "./libs/events/LlmToolCalledEvent";

/**
 * LLM 사용량 기록 이벤트입니다.
 */
export { LlmUsageRecordedEvent } from "./libs/events/LlmUsageRecordedEvent";

/**
 * 테스트용 인메모리 모델 구현체입니다.
 */
export { InMemoryLlmModel } from "./libs/InMemoryLlmModel";

/**
 * 테스트용 인메모리 레지스트리 구현체입니다.
 */
export { InMemoryLlmRegistry } from "./libs/InMemoryLlmRegistry";

/**
 * 공급자 구현이 상속해야 하는 추상 LLM 모델 계약입니다.
 */
export { LlmModel } from "./libs/LlmModel";

/**
 * 모델 등록과 조회를 담당하는 추상 레지스트리입니다.
 */
export { LlmRegistry } from "./libs/LlmRegistry";

/**
 * 생성, 스트리밍, 임베딩, 도구 호출을 통합 제공하는 핵심 서비스입니다.
 */
export { LlmService } from "./libs/LlmService";

/**
 * LLM 호출 전반에서 사용하는 Problem 하위 타입들입니다.
 */
export {
  InvalidLlmPromptProblem,
  InvalidLlmResponseProblem,
  LlmOperationAbortedProblem,
  LlmProblem,
  LlmProviderNotFoundProblem,
  LlmRateLimitProblem,
  LlmServiceNotInitializedProblem,
  LlmTokenLimitExceededProblem,
} from "./libs/problems/LlmProblems";

/**
 * 서비스 계층에서 발생하는 Problem 하위 타입들입니다.
 */
export {
  EmbeddingError,
  GenerationError,
  LlmCompletionEventPublicationProblem,
  LlmServiceProblem,
  LlmStructuredOutputProblem,
  LlmToolExecutionProblem,
  ModelNotFoundError,
} from "./libs/problems/LlmServiceProblem";

/**
 * 생성, 임베딩, 스트리밍, 도구 호출에 사용하는 핵심 타입들입니다.
 */
export type {
  CancellableRequestOptions,
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmCapabilities,
  LlmMetadata,
  LlmModelConfig,
  LlmUsage,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
  ToolDefinition,
  UsageAccuracy,
} from "./libs/types";
export type {
  LlmCompletion,
  LlmCompletionEventDeliveryClaim,
  LlmCompletionEvent,
  LlmCompletionEventIntent,
  LlmCompletionEventIntentStore,
  LlmGenerateCompletion,
  LlmServiceOptions,
  LlmStreamCompletion,
} from "./libs/LlmCompletionEvents";
export type {
  LlmCompletionEventDeliveryState,
  LlmCompletionEventFailureStage,
} from "./libs/problems/LlmServiceProblem";
