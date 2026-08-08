import { LlmModel } from "@croco/llm-core";
import { recordEvent, withSpan } from "@croco/telemetry-api";
import { createOpenAiSdkTransport } from "./OpenAiSdkTransport";
import {
  normalizeOpenAiError,
  OpenAiAbortProblem,
  OpenAiInvalidResponseProblem,
  OpenAiMissingConfigProblem,
} from "./problems/OpenAiProblems";
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmCapabilities,
  LlmMetadata,
  LlmUsage,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
} from "@croco/llm-core";
import type {
  OpenAiEmbeddingResponse,
  OpenAiFunctionCallOutput,
  OpenAiInputMessage,
  OpenAiLlmModelConfig,
  OpenAiOutputItem,
  OpenAiResponse,
  OpenAiResponseRequest,
  OpenAiStreamEvent,
  OpenAiTransport,
  OpenAiUsage,
} from "./types";
import { toOpenAiFunctionTool } from "./types";

const DEFAULT_EMBEDDING_MODEL_ID = "text-embedding-3-small";
const DEFAULT_API_KEY_ENV_NAME = "OPENAI_API_KEY";
const DEFAULT_STRUCTURED_OUTPUT_NAME = "croco_response";

export class OpenAiLlmModel extends LlmModel {
  readonly capabilities: LlmCapabilities = {
    streaming: true,
    objectGeneration: true,
    toolCalling: true,
    embedding: true,
  };

  readonly modelId: string;

  private readonly embeddingModelId: string;
  private readonly structuredOutputName: string;
  private readonly transport: OpenAiTransport;

  constructor(config: OpenAiLlmModelConfig) {
    super();

    this.modelId = config.modelId;
    this.embeddingModelId = config.embeddingModelId ?? DEFAULT_EMBEDDING_MODEL_ID;
    this.structuredOutputName = config.structuredOutputName ?? DEFAULT_STRUCTURED_OUTPUT_NAME;
    this.transport =
      config.transport ??
      createOpenAiSdkTransport({
        apiKey: resolveApiKey(config),
        baseUrl: config.baseUrl,
        timeout: config.timeout,
      });
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const model = this.resolveModelId(params.modelId);

    return await this.withOpenAiSpan("llm.openai.generate", model, "generate", async () => {
      const response = await this.callResponseApi(
        "generate",
        this.createResponseRequest(model, params),
        params.signal,
      );
      const text = extractOutputText(response, "generate");
      const usage = mapUsage(response.usage, "generate");
      this.recordUsageEvent("generate", model, usage);

      return {
        text,
        usage,
        metadata: this.createMetadata(model, response),
      };
    });
  }

  async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    const model = this.resolveModelId(params.modelId);
    let completedUsage: LlmUsage | undefined;

    if (params.signal?.aborted) {
      throw new OpenAiAbortProblem("stream");
    }

    const stream = await this.withOpenAiSpan("llm.openai.stream", model, "stream", async () => {
      try {
        return await this.transport.streamResponse(this.createResponseRequest(model, params), {
          signal: params.signal,
        });
      } catch (error) {
        throw normalizeOpenAiError(error, "stream");
      }
    });

    try {
      for await (const event of stream) {
        if (params.signal?.aborted) {
          throw new OpenAiAbortProblem("stream");
        }

        if (event.type === "response.completed" && event.response?.usage) {
          completedUsage = mapUsage(event.response.usage, "stream");
        }

        const chunk = this.eventToStreamChunk(event);
        if (chunk) {
          yield chunk;
        }
      }

      if (params.signal?.aborted) {
        throw new OpenAiAbortProblem("stream");
      }

      if (completedUsage) {
        this.recordUsageEvent("stream", model, completedUsage);
      }
    } catch (error) {
      throw normalizeOpenAiError(error, "stream");
    }
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    const model = this.resolveModelId(params.modelId);

    return await this.withOpenAiSpan(
      "llm.openai.generate_object",
      model,
      "generateObject",
      async () => {
        const response = await this.callResponseApi(
          "generateObject",
          {
            ...this.createResponseRequest(model, params),
            text: {
              format: {
                type: "json_schema",
                name: this.structuredOutputName,
                strict: true,
                schema: params.schema,
              },
            },
          },
          params.signal,
        );

        const usage = mapUsage(response.usage, "generateObject");
        this.recordUsageEvent("generateObject", model, usage);

        if (response.output_parsed !== undefined) {
          return response.output_parsed as T;
        }

        const text = extractOutputText(response, "generateObject");
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new OpenAiInvalidResponseProblem(
            "generateObject",
            "structured output was not JSON",
          );
        }
      },
    );
  }

  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    const model = this.resolveModelId(params.modelId);

    return await this.withOpenAiSpan("llm.openai.call_tool", model, "callTool", async () => {
      const response = await this.callResponseApi(
        "callTool",
        {
          ...this.createResponseRequest(model, params),
          tools: params.tools.map(toOpenAiFunctionTool),
          tool_choice: "auto",
        },
        params.signal,
      );
      const usage = mapUsage(response.usage, "callTool");
      this.recordUsageEvent("callTool", model, usage);

      return {
        toolCalls: extractToolCalls(response.output ?? []),
        usage,
      };
    });
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    const model = this.resolveEmbeddingModelId(params.modelId);

    return await this.withOpenAiSpan("llm.openai.embed", model, "embed", async () => {
      const response = await this.callEmbeddingApi(
        "embed",
        {
          model,
          input: params.text,
          encoding_format: "float",
        },
        params.signal,
      );
      const embedding = extractEmbedding(response, 0, "embed");
      const usage = mapEmbeddingUsage(response.usage, "embed");
      this.recordUsageEvent("embed", model, usage);

      return {
        embedding,
        usage,
      };
    });
  }

  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    const model = this.resolveEmbeddingModelId(params.modelId);

    return await this.withOpenAiSpan("llm.openai.embed_many", model, "embedMany", async () => {
      const response = await this.callEmbeddingApi(
        "embedMany",
        {
          model,
          input: params.texts,
          encoding_format: "float",
        },
        params.signal,
      );
      const embeddings = params.texts.map((_text, index) =>
        extractEmbedding(response, index, "embedMany"),
      );
      const usage = mapEmbeddingUsage(response.usage, "embedMany");
      this.recordUsageEvent("embedMany", model, usage);

      return {
        embeddings,
        usage,
      };
    });
  }

  private resolveModelId(modelId: string | undefined): string {
    return modelId ?? this.modelId;
  }

  private resolveEmbeddingModelId(modelId: string | undefined): string {
    return modelId ?? this.embeddingModelId;
  }

  private createResponseRequest(
    model: string,
    params: Pick<
      GenerateParams,
      "maxTokens" | "metadata" | "prompt" | "stopSequences" | "systemPrompt" | "temperature"
    >,
  ): OpenAiResponseRequest {
    return {
      model,
      input: createInput(params.prompt, params.systemPrompt),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.maxTokens !== undefined ? { max_output_tokens: params.maxTokens } : {}),
      ...(params.stopSequences !== undefined ? { stop: params.stopSequences } : {}),
      store: false,
    };
  }

  private async callResponseApi(
    operation: string,
    request: OpenAiResponseRequest,
    signal?: AbortSignal,
  ): Promise<OpenAiResponse> {
    this.assertNotAborted(signal, operation);

    try {
      const response = await this.transport.createResponse(
        request,
        signal ? { signal } : undefined,
      );
      this.assertNotAborted(signal, operation);
      if (response.error) {
        throw new OpenAiInvalidResponseProblem(operation, "response contained an error payload");
      }

      return response;
    } catch (error) {
      throw normalizeOpenAiError(error, operation);
    }
  }

  private async callEmbeddingApi(
    operation: string,
    request: Parameters<OpenAiTransport["createEmbedding"]>[0],
    signal?: AbortSignal,
  ): Promise<OpenAiEmbeddingResponse> {
    this.assertNotAborted(signal, operation);

    try {
      const response = await this.transport.createEmbedding(
        request,
        signal ? { signal } : undefined,
      );
      this.assertNotAborted(signal, operation);
      return response;
    } catch (error) {
      throw normalizeOpenAiError(error, operation);
    }
  }

  private eventToStreamChunk(event: OpenAiStreamEvent): StreamChunk | null {
    if (event.type === "error") {
      throw normalizeOpenAiError(event.error ?? event, "stream");
    }

    if (event.type === "response.output_text.delta") {
      return {
        delta: event.delta ?? "",
      };
    }

    if (event.type === "response.completed" && event.response?.usage) {
      const usage = mapUsage(event.response.usage, "stream");
      return {
        delta: "",
        usage,
      };
    }

    if (event.type === "response.failed") {
      throw new OpenAiInvalidResponseProblem("stream", "stream ended with response.failed");
    }

    return null;
  }

  private async withOpenAiSpan<T>(
    spanName: string,
    model: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await withSpan(fn, {
      name: spanName,
      attributes: {
        "gen_ai.system": "openai",
        "gen_ai.request.model": model,
        "llm.operation": operation,
      },
    });
  }

  private createMetadata(model: string, response: OpenAiResponse): LlmMetadata {
    return {
      modelId: response.model ?? model,
      provider: "openai",
      ...(response.status ? { status: response.status } : {}),
    };
  }

  private recordUsageEvent(operation: string, model: string, usage: LlmUsage): void {
    recordEvent("llm.openai.usage", {
      provider: "openai",
      model,
      operation,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      accuracy: usage.accuracy ?? "UNKNOWN",
    });
  }

  private assertNotAborted(signal: AbortSignal | undefined, operation: string): void {
    if (signal?.aborted) {
      throw new OpenAiAbortProblem(operation);
    }
  }
}

function resolveApiKey(config: OpenAiLlmModelConfig): string {
  const envName = config.apiKeyEnvName ?? DEFAULT_API_KEY_ENV_NAME;
  const apiKey = config.apiKey ?? (config.env ?? process.env)[envName];

  if (!apiKey || apiKey.trim().length === 0) {
    throw new OpenAiMissingConfigProblem(envName);
  }

  return apiKey;
}

function createInput(
  prompt: string,
  systemPrompt: string | undefined,
): string | readonly OpenAiInputMessage[] {
  if (!systemPrompt) {
    return prompt;
  }

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

function extractOutputText(response: OpenAiResponse, operation: string): string {
  if (typeof response.output_text === "string" && response.output_text.length > 0) {
    return response.output_text;
  }

  const text = (response.output ?? [])
    .flatMap((item) => ("content" in item && item.content ? item.content : []))
    .map((content) => content.text ?? "")
    .join("");

  if (text.length === 0) {
    throw new OpenAiInvalidResponseProblem(operation, "missing output text");
  }

  return text;
}

function mapUsage(usage: OpenAiUsage | null | undefined, operation: string): LlmUsage {
  if (!usage) {
    throw new OpenAiInvalidResponseProblem(operation, "missing token usage");
  }

  const promptTokens = usage.input_tokens ?? usage.prompt_tokens;
  const completionTokens = usage.output_tokens ?? usage.completion_tokens;
  const totalTokens = usage.total_tokens;

  if (promptTokens === undefined || completionTokens === undefined || totalTokens === undefined) {
    throw new OpenAiInvalidResponseProblem(operation, "incomplete token usage");
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    accuracy: "EXACT",
  };
}

function mapEmbeddingUsage(usage: OpenAiUsage | null | undefined, operation: string): LlmUsage {
  if (!usage) {
    throw new OpenAiInvalidResponseProblem(operation, "missing embedding usage");
  }

  const promptTokens = usage.input_tokens ?? usage.prompt_tokens ?? usage.total_tokens;
  const totalTokens = usage.total_tokens ?? promptTokens;

  if (promptTokens === undefined || totalTokens === undefined) {
    throw new OpenAiInvalidResponseProblem(operation, "incomplete embedding usage");
  }

  return {
    promptTokens,
    completionTokens: 0,
    totalTokens,
    accuracy: "EXACT",
  };
}

function extractToolCalls(
  output: readonly OpenAiOutputItem[],
): Array<{ readonly name: string; readonly arguments: Record<string, unknown> }> {
  return output.flatMap((item) => {
    if (!isFunctionCallOutput(item)) {
      return [];
    }

    const rawArguments = typeof item.arguments === "string" ? item.arguments : "{}";
    try {
      const parsedArguments = JSON.parse(rawArguments) as unknown;
      if (!isRecord(parsedArguments)) {
        throw new OpenAiInvalidResponseProblem(
          "callTool",
          `tool arguments for ${item.name} were not an object`,
        );
      }

      return [
        {
          name: item.name,
          arguments: parsedArguments,
        },
      ];
    } catch (error) {
      if (error instanceof OpenAiInvalidResponseProblem) {
        throw error;
      }

      throw new OpenAiInvalidResponseProblem("callTool", `invalid tool arguments for ${item.name}`);
    }
  });
}

function isFunctionCallOutput(
  item: OpenAiOutputItem,
): item is OpenAiFunctionCallOutput & { readonly name: string } {
  return item.type === "function_call" && "name" in item && typeof item.name === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractEmbedding(
  response: OpenAiEmbeddingResponse,
  index: number,
  operation: string,
): number[] {
  const vector = response.data?.find((entry) => entry.index === index)?.embedding;

  if (!vector || vector.length === 0 || !vector.every((value) => typeof value === "number")) {
    throw new OpenAiInvalidResponseProblem(operation, `missing embedding at index ${index}`);
  }

  return [...vector];
}
