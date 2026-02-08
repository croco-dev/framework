import { LlmModel } from './LlmModel';
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
} from './types';

export class InMemoryLlmModel extends LlmModel {
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
    const response = this.responses.get(params.prompt) ?? `Mock response to: ${params.prompt}`;
    const promptTokens = params.prompt.length;
    const completionTokens = response.length;

    return {
      text: response,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        accuracy: 'ESTIMATED',
      },
      metadata: {
        modelId: this.modelId,
      },
    };
  }

  async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    const response = this.responses.get(params.prompt) ?? `Mock response to: ${params.prompt}`;

    if (!response || response.trim().length === 0) {
      return;
    }

    const chunks = response.split(' ');
    const promptTokens = params.prompt.length;

    for (let i = 0; i < chunks.length; i++) {
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
    const response = this.responses.get(params.prompt) ?? `Mock response to: ${params.prompt}`;

    try {
      return JSON.parse(response) as T;
    } catch {
      throw new Error(`Invalid JSON response: ${response}`);
    }
  }

  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    const response = this.responses.get(params.prompt) ?? '';

    if (!response || !response.includes(':')) {
      return {
        toolCalls: [],
        usage: {
          promptTokens: params.prompt.length,
          completionTokens: 0,
          totalTokens: params.prompt.length,
          accuracy: 'ESTIMATED',
        },
      };
    }

    const toolCalls = response
      .split('|')
      .map((call) => {
        const colonIndex = call.indexOf(':');
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
        } catch {
          return null;
        }
      })
      .filter((call): call is { name: string; arguments: Record<string, unknown> } => call !== null);

    return {
      toolCalls,
      usage: {
        promptTokens: params.prompt.length,
        completionTokens: response.length,
        totalTokens: params.prompt.length + response.length,
        accuracy: 'ESTIMATED',
      },
    };
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    let embedding = this.embeddingCache.get(params.text);

    if (!embedding) {
      embedding = Array.from({ length: 1536 }, () => Math.random());
      this.embeddingCache.set(params.text, embedding);
    }

    return {
      embedding,
      usage: {
        promptTokens: params.text.length,
        completionTokens: 0,
        totalTokens: params.text.length,
        accuracy: 'ESTIMATED',
      },
    };
  }

  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    const embeddings = params.texts.map((text) => {
      let embedding = this.embeddingCache.get(text);

      if (!embedding) {
        embedding = Array.from({ length: 1536 }, () => Math.random());
        this.embeddingCache.set(text, embedding);
      }

      return embedding;
    });

    const totalTokens = params.texts.reduce((sum, text) => sum + text.length, 0);

    return {
      embeddings,
      usage: {
        promptTokens: totalTokens,
        completionTokens: 0,
        totalTokens,
        accuracy: 'ESTIMATED',
      },
    };
  }
}
