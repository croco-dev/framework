import OpenAI from "openai";
import type { AiUsage } from "@croco/ai-usage";
import { AiProviderUnavailableProblem } from "./aiProblems";

export const MAX_AI_PROMPT_LENGTH = 4000;
export const MAX_AI_OUTPUT_TOKENS = 512;
export const MAX_AI_OUTPUT_LENGTH = 16000;
export type GenerationUsage = ({ state: "known" } & AiUsage) | { state: "unknown" };
export type GenerateInput = {
  tenantId: string;
  modelId: string;
  prompt: string;
  signal: AbortSignal;
  deadline: number;
};
export type Generation = {
  text: string;
  provider: string;
  modelId: string;
  providerResponseId: string;
  providerRequestId: string | null;
  usage: GenerationUsage;
};
export type Generate = (input: GenerateInput) => Promise<Generation>;
export type PromptPolicy = (input: GenerateInput) => Promise<void>;

export function assertGenerationReady(input: GenerateInput): void {
  if (input.signal.aborted) {
    throw new AiProviderUnavailableProblem(input.modelId, input.signal.reason);
  }
  if (input.deadline <= Date.now() || input.prompt.length > MAX_AI_PROMPT_LENGTH) {
    throw new AiProviderUnavailableProblem(input.modelId);
  }
}

export function createTenantOpenAIClient(config: {
  apiKey: string;
  baseURL: string;
  organization?: string;
  project?: string;
}): OpenAI {
  if (!config.apiKey.trim() || !config.baseURL.trim()) {
    throw new AiProviderUnavailableProblem("configuration");
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    organization: config.organization ?? null,
    project: config.project ?? null,
    logLevel: "off",
    maxRetries: 0,
  });
}

export function createOpenAIGenerate(resolveClient: (tenantId: string) => OpenAI): Generate {
  return async (input) => {
    assertGenerationReady(input);
    const remaining = input.deadline - Date.now();
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(remaining)]);
    const response = await resolveClient(input.tenantId).responses.create(
      {
        model: input.modelId,
        input: input.prompt,
        store: false,
        max_output_tokens: MAX_AI_OUTPUT_TOKENS,
      },
      { signal, timeout: remaining, maxRetries: 0 },
    );
    if (
      response.status !== "completed" ||
      !response.output_text.trim() ||
      response.output_text.length > MAX_AI_OUTPUT_LENGTH
    ) {
      throw new AiProviderUnavailableProblem(input.modelId);
    }
    return {
      text: response.output_text,
      provider: "openai",
      modelId: response.model,
      providerResponseId: response.id,
      providerRequestId: response._request_id ?? null,
      usage: response.usage
        ? {
            state: "known",
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
            accuracy: "EXACT",
          }
        : { state: "unknown" },
    };
  };
}

export const deterministicGenerate: Generate = async (input) => {
  assertGenerationReady(input);
  const text = "Welcome to the deterministic Croco AI SaaS demo.";
  const inputTokens = Math.ceil(input.prompt.length / 4);
  const outputTokens = Math.ceil(text.length / 4);
  return {
    text,
    provider: "in-memory",
    modelId: input.modelId,
    providerResponseId: "deterministic",
    providerRequestId: null,
    usage: {
      state: "known",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      accuracy: "ESTIMATED",
    },
  };
};

// Replace with the application's approved PII/data egress policy before using a live provider.
export const demoPromptPolicy: PromptPolicy = async (input) => {
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(input.prompt)) {
    throw new AiProviderUnavailableProblem("prompt-policy");
  }
};
