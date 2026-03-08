/**
 * @packageDocumentation
 *
 * LLM (Large Language Model) integration core package for Croco framework.
 *
 * Provides decorators, events, models, and services for integrating with LLM providers
 * such as OpenAI, Anthropic, and others. Supports streaming, tool calls, embeddings,
 * and structured output generation.
 *
 * @example
 * ```typescript
 * import { Llm, LlmService } from '@croco/llm-core';
 *
 * @Service()
 * class MyService {
 *   constructor(private readonly llmService: LlmService) {}
 *
 *   @Llm({ model: 'gpt-4' })
 *   async generateText(prompt: string): Promise<string> {
 *     return this.llmService.generate(prompt);
 *   }
 * }
 * ```
 */

// Decorators
export { getLlmMetadata, Llm, type LlmMethodMetadata, type LlmOptions, setLlmService } from './libs/decorators/Llm';

// Events
export { LlmGeneratedEvent } from './libs/events/LlmGeneratedEvent';
export { LlmStreamCompletedEvent } from './libs/events/LlmStreamCompletedEvent';
export { LlmToolCalledEvent, type ToolCall } from './libs/events/LlmToolCalledEvent';
export { LlmUsageRecordedEvent } from './libs/events/LlmUsageRecordedEvent';

// Core Classes
export { InMemoryLlmModel } from './libs/InMemoryLlmModel';
export { InMemoryLlmRegistry } from './libs/InMemoryLlmRegistry';
export { LlmModel } from './libs/LlmModel';
export { LlmRegistry } from './libs/LlmRegistry';
export { LlmService } from './libs/LlmService';

// Problem Classes (RFC 7807)
export {
  InvalidLlmPromptProblem,
  InvalidLlmResponseProblem,
  LlmProblem,
  LlmProviderNotFoundProblem,
  LlmRateLimitProblem,
  LlmServiceNotInitializedProblem,
  LlmTokenLimitExceededProblem,
} from './libs/problems/LlmProblems';
export {
  EmbeddingError,
  GenerationError,
  LlmServiceProblem,
  LlmStructuredOutputProblem,
  LlmToolExecutionProblem,
  ModelNotFoundError,
} from './libs/problems/LlmServiceProblem';

// Types
export type {
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
} from './libs/types';
