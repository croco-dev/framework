/**
 * @packageDocumentation
 *
 * LLM metering and cost tracking package for Croco framework.
 *
 * Provides decorators, events, and services for tracking LLM usage, calculating costs,
 * and enforcing budget limits. Integrates with {@link @croco/llm-core} to automatically
 * meter LLM calls and enforce cost quotas.
 *
 * @example
 * ```typescript
 * import { AiMetered, LlmMeteringService } from '@croco/llm-metering';
 *
 * @Service()
 * class MyService {
 *   constructor(private readonly metering: LlmMeteringService) {}
 *
 *   @AiMetered({ budgetName: 'default' })
 *   async generateText(prompt: string): Promise<string> {
 *     // LLM calls are automatically metered
 *     return 'result';
 *   }
 * }
 * ```
 */

// Decorator Types
export type { AiMeteredMetadata, AiMeteredOptions } from './libs/decorators/AiMetered';

// Decorators
export {
  AiMetered,
  getAiMeteredMetadata,
  getLlmMeteringService,
  setLlmMeteringService,
} from './libs/decorators/AiMetered';

// Events
export { LlmCostBudgetExceededEvent } from './libs/events/LlmCostBudgetExceededEvent';
export { LlmUsageRecordedEvent } from './libs/events/LlmUsageRecordedEvent';

// Core Service Types
export type { LlmCostRecord, LlmMeteringServiceOptions, LlmUsageEvent } from './libs/LlmMeteringService';

// Core Service
export { LlmMeteringService } from './libs/LlmMeteringService';

// Pricing
export { PricingTable } from './libs/PricingTable';

// Problem Classes (RFC 7807)
export {
  LlmCostLimitExceededProblem,
  LlmQuotaExceededProblem,
  PricingNotFoundProblem,
} from './libs/problems/LlmMeteringProblems';

// Stream Metering Utilities
export {
  createMeteredAsyncIterable,
  extractUsageFromChunk,
  isAsyncIterable,
  type UsageWithModelInfo,
} from './libs/streamMetering';

// Types
export type { LlmCostBudget, LlmEmbeddingUsageRecord, LlmUsageRecord, ModelPricing, UsageAccuracy } from './libs/types';

// Constants
export { COMPLETION_TOKENS, COST_USD, EMBEDDING_TOKENS, PROMPT_TOKENS } from './libs/types';
