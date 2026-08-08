import { LlmModel } from "./LlmModel";
import { InvalidLlmResponseProblem, LlmOperationAbortedProblem } from "./problems/LlmProblems";
import { LlmToolExecutionProblem } from "./problems/LlmServiceProblem";
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmCapabilities,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
} from "./types";

export class InMemoryLlmModel extends LlmModel {
  private static readonly EMBEDDING_DIMENSION = 1536;
  private static readonly MAX_EMBEDDING_CACHE_SIZE = 1000;

  readonly modelId: string;
  readonly capabilities: LlmCapabilities = {
    streaming: true,
    objectGeneration: true,
    toolCalling: true,
    embedding: true,
  };

  private responses = new Map<string, string>();
  private embeddingCache = new Map<string, number[]>();

  constructor(modelId: string, responses?: Record<string, string>) {
    super();
    this.modelId = modelId;
    if (responses) {
      Object.entries(responses).forEach(([key, value]) => {
        this.responses.set(key, value);
      });
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    assertNotAborted(params.signal, "generate");
    const response = this.responses.get(params.prompt) ?? `Mock response to: ${params.prompt}`;
    const promptTokens = params.prompt.length;
    const completionTokens = response.length;

    return {
      text: response,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        accuracy: "ESTIMATED",
      },
      metadata: {
        modelId: this.modelId,
      },
    };
  }

  async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    assertNotAborted(params.signal, "stream");
    const response = this.responses.get(params.prompt) ?? `Mock response to: ${params.prompt}`;

    if (!response || response.trim().length === 0) {
      return;
    }

    const chunks = response.split(" ");
    const promptTokens = params.prompt.length;

    for (let i = 0; i < chunks.length; i++) {
      if (params.signal?.aborted) {
        throw new LlmOperationAbortedProblem("stream");
      }

      const chunk = chunks[i];
      if (chunk) {
        yield {
          delta: `${chunk} `,
          usage:
            i === chunks.length - 1
              ? {
                  promptTokens,
                  completionTokens: response.length,
                  totalTokens: promptTokens + response.length,
                }
              : undefined,
        };
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    assertNotAborted(params.signal, "generateObject");
    const response = this.responses.get(params.prompt) ?? `Mock response to: ${params.prompt}`;

    try {
      return JSON.parse(response) as T;
    } catch {
      throw new InvalidLlmResponseProblem(response);
    }
  }

  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    assertNotAborted(params.signal, "callTool");
    const response = this.responses.get(params.prompt) ?? "";

    if (!response || !response.includes(":")) {
      return {
        toolCalls: [],
        usage: {
          promptTokens: params.prompt.length,
          completionTokens: 0,
          totalTokens: params.prompt.length,
          accuracy: "ESTIMATED",
        },
      };
    }

    const toolCalls = response
      .split("|")
      .map((call) => {
        const colonIndex = call.indexOf(":");
        if (colonIndex === -1) {
          return null;
        }
        const name = call.substring(0, colonIndex);
        const argsStr = call.substring(colonIndex + 1);
        try {
          return {
            name,
            arguments: JSON.parse(argsStr) as Record<string, unknown>,
          };
        } catch (error) {
          throw new LlmToolExecutionProblem(
            `Failed to parse tool arguments for '${name}'`,
            error instanceof Error ? error : undefined,
          );
        }
      })
      .filter(
        (call): call is { name: string; arguments: Record<string, unknown> } => call !== null,
      );

    return {
      toolCalls,
      usage: {
        promptTokens: params.prompt.length,
        completionTokens: response.length,
        totalTokens: params.prompt.length + response.length,
        accuracy: "ESTIMATED",
      },
    };
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    assertNotAborted(params.signal, "embed");
    const embedding = this.getOrCreateEmbedding(params.text);

    return {
      embedding: [...embedding],
      usage: {
        promptTokens: params.text.length,
        completionTokens: 0,
        totalTokens: params.text.length,
        accuracy: "ESTIMATED",
      },
    };
  }

  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    assertNotAborted(params.signal, "embedMany");
    const embeddings = params.texts.map((text) => [...this.getOrCreateEmbedding(text)]);

    const totalTokens = params.texts.reduce((sum, text) => sum + text.length, 0);

    return {
      embeddings,
      usage: {
        promptTokens: totalTokens,
        completionTokens: 0,
        totalTokens,
        accuracy: "ESTIMATED",
      },
    };
  }

  private getOrCreateEmbedding(text: string): number[] {
    const cached = this.embeddingCache.get(text);

    if (cached) {
      return cached;
    }

    const embedding = this.createDeterministicEmbedding(text);
    this.embeddingCache.set(text, embedding);

    if (this.embeddingCache.size > InMemoryLlmModel.MAX_EMBEDDING_CACHE_SIZE) {
      const oldestKey = this.embeddingCache.keys().next().value;
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
      }
    }

    return embedding;
  }

  private createDeterministicEmbedding(text: string): number[] {
    let state = 2166136261;

    for (let i = 0; i < text.length; i++) {
      state ^= text.charCodeAt(i);
      state = Math.imul(state, 16777619);
    }

    return Array.from({ length: InMemoryLlmModel.EMBEDDING_DIMENSION }, () => {
      state = Math.imul(state, 1664525) + 1013904223;
      return (state >>> 0) / 4294967296;
    });
  }
}

function assertNotAborted(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) {
    throw new LlmOperationAbortedProblem(operation);
  }
}
