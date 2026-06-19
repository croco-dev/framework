/**
 * @packageDocumentation
 *
 * OpenAI Responses API provider for the Croco LLM contract.
 */

export { OpenAiLlmModel } from "./libs/OpenAiLlmModel";
export { createOpenAiSdkTransport } from "./libs/OpenAiSdkTransport";
export {
  normalizeOpenAiError,
  OpenAiAbortProblem,
  OpenAiAuthenticationProblem,
  OpenAiInvalidResponseProblem,
  OpenAiMissingConfigProblem,
  OpenAiRateLimitProblem,
  OpenAiRetryableUpstreamProblem,
  OpenAiTerminalUpstreamProblem,
  OpenAiValidationProblem,
} from "./libs/problems/OpenAiProblems";

export type {
  OpenAiEmbeddingRequest,
  OpenAiEmbeddingResponse,
  OpenAiEnvironment,
  OpenAiInputMessage,
  OpenAiLlmModelConfig,
  OpenAiRequestOptions,
  OpenAiResponse,
  OpenAiResponseRequest,
  OpenAiSdkTransportOptions,
  OpenAiStreamEvent,
  OpenAiTransport,
  OpenAiUsage,
} from "./libs/types";
