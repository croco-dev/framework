import type { ToolDefinition } from "@croco/llm-core";

export type OpenAiEnvironment = Record<string, string | undefined>;

export type OpenAiRequestOptions = {
  readonly signal?: AbortSignal;
};

export type OpenAiInputMessage = {
  readonly role: "system" | "developer" | "user";
  readonly content: string;
};

export type OpenAiJsonSchemaTextFormat = {
  readonly type: "json_schema";
  readonly name: string;
  readonly strict: boolean;
  readonly schema: unknown;
};

export type OpenAiTextFormat =
  | {
      readonly type: "text";
    }
  | OpenAiJsonSchemaTextFormat;

export type OpenAiFunctionTool = {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly strict: boolean;
};

export type OpenAiResponseRequest = {
  readonly model: string;
  readonly input: string | readonly OpenAiInputMessage[];
  readonly instructions?: string;
  readonly temperature?: number;
  readonly max_output_tokens?: number;
  readonly stop?: readonly string[];
  readonly stream?: boolean;
  readonly store?: boolean;
  readonly text?: {
    readonly format: OpenAiTextFormat;
  };
  readonly tools?: readonly OpenAiFunctionTool[];
  readonly tool_choice?: "auto";
};

export type OpenAiUsage = {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly total_tokens?: number;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
};

export type OpenAiOutputTextContent = {
  readonly type?: string;
  readonly text?: string;
};

export type OpenAiFunctionCallOutput = {
  readonly type: "function_call";
  readonly name?: string;
  readonly arguments?: string;
};

export type OpenAiMessageOutput = {
  readonly type?: "message" | string;
  readonly content?: readonly OpenAiOutputTextContent[];
};

export type OpenAiOutputItem = OpenAiFunctionCallOutput | OpenAiMessageOutput;

export type OpenAiResponse = {
  readonly output_text?: string;
  readonly output_parsed?: unknown;
  readonly output?: readonly OpenAiOutputItem[];
  readonly usage?: OpenAiUsage | null;
  readonly model?: string;
  readonly status?: string | null;
  readonly error?: unknown;
  readonly incomplete_details?: unknown;
};

export type OpenAiStreamEvent = {
  readonly type?: string;
  readonly delta?: string;
  readonly response?: OpenAiResponse;
  readonly error?: unknown;
};

export type OpenAiEmbeddingRequest = {
  readonly model: string;
  readonly input: string | readonly string[];
  readonly encoding_format: "float";
};

export type OpenAiEmbeddingVector = {
  readonly embedding?: readonly number[];
  readonly index?: number;
};

export type OpenAiEmbeddingResponse = {
  readonly data?: readonly OpenAiEmbeddingVector[];
  readonly model?: string;
  readonly usage?: OpenAiUsage | null;
};

export type OpenAiTransport = {
  createResponse(
    request: OpenAiResponseRequest,
    options?: OpenAiRequestOptions,
  ): Promise<OpenAiResponse>;
  streamResponse(
    request: OpenAiResponseRequest,
    options?: OpenAiRequestOptions,
  ): Promise<AsyncIterable<OpenAiStreamEvent>>;
  createEmbedding(
    request: OpenAiEmbeddingRequest,
    options?: OpenAiRequestOptions,
  ): Promise<OpenAiEmbeddingResponse>;
};

export type OpenAiSdkTransportOptions = {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
};

export type OpenAiLlmModelConfig = {
  readonly modelId: string;
  readonly apiKey?: string;
  readonly apiKeyEnvName?: string;
  readonly env?: OpenAiEnvironment;
  readonly baseUrl?: string;
  readonly timeout?: number;
  readonly embeddingModelId?: string;
  readonly structuredOutputName?: string;
  readonly transport?: OpenAiTransport;
};

export function toOpenAiFunctionTool(tool: ToolDefinition): OpenAiFunctionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  };
}
