import type { EmbeddingModel, LanguageModelV1 } from 'ai';
import { generateText, streamText } from 'ai';
import type { LlmModel } from '../LlmModel';
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
} from '../types';

export class VercelAdapter {
  static async generateText(model: LlmModel, params: GenerateParams): Promise<GenerateResult> {
    const vercelModel = model as unknown as LanguageModelV1;

    const result = await generateText({
      model: vercelModel,
      prompt: params.prompt,
      system: params.systemPrompt,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      stopSequences: params.stopSequences,
    });

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        accuracy: 'EXACT',
      },
      metadata: {
        modelId: model.modelId,
        finishReason: result.finishReason,
        ...params.metadata,
      },
    };
  }

  static async *streamText(model: LlmModel, params: StreamParams): AsyncIterable<StreamChunk> {
    const vercelModel = model as unknown as LanguageModelV1;

    const result = await streamText({
      model: vercelModel,
      prompt: params.prompt,
      system: params.systemPrompt,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      stopSequences: params.stopSequences,
    });

    for await (const chunk of result.textStream) {
      yield {
        delta: chunk,
      };
    }

    const usage = await result.usage;
    yield {
      delta: '',
      usage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      },
    };
  }

  static async generateObject<T>(model: LlmModel, params: GenerateObjectParams<T>): Promise<T> {
    const { generateObject } = await import('ai');
    const vercelModel = model as unknown as LanguageModelV1;

    const result = await generateObject<T>({
      model: vercelModel,
      prompt: params.prompt,
      system: params.systemPrompt,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      schema: params.schema as any,
      mode: params.mode === 'tool' ? 'tool' : 'json',
    });

    return result.object;
  }

  static async callTool(model: LlmModel, params: ToolCallParams): Promise<ToolCallResult> {
    const { generateText } = await import('ai');
    const vercelModel = model as unknown as LanguageModelV1;

    const result = await generateText({
      model: vercelModel,
      prompt: params.prompt,
      system: params.systemPrompt,
      tools: params.tools.reduce(
        (acc, tool) => ({
          ...acc,
          [tool.name]: {
            description: tool.description,
            parameters: tool.parameters as any,
          },
        }),
        {}
      ),
    });

    const toolCalls = (result.toolCalls ?? []).map((call: any) => ({
      name: call.toolName,
      arguments: call.args as Record<string, unknown>,
    }));

    return {
      toolCalls,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        accuracy: 'EXACT',
      },
    };
  }

  static async embed(model: LlmModel, params: EmbedParams): Promise<EmbedResult> {
    const { embed } = await import('ai');
    const vercelModel = model as unknown as EmbeddingModel<string>;

    const result = await embed({
      model: vercelModel,
      value: params.text,
    });

    return {
      embedding: result.embedding,
      usage: {
        promptTokens: (result.usage as any)?.tokens ?? 0,
        completionTokens: 0,
        totalTokens: (result.usage as any)?.tokens ?? 0,
        accuracy: result.usage ? 'EXACT' : 'ESTIMATED',
      },
    };
  }

  static async embedMany(model: LlmModel, params: EmbedManyParams): Promise<EmbedManyResult> {
    const { embedMany } = await import('ai');
    const vercelModel = model as unknown as EmbeddingModel<string>;

    const result = await embedMany({
      model: vercelModel,
      values: params.texts,
    });

    return {
      embeddings: result.embeddings,
      usage: {
        promptTokens: (result.usage as any)?.tokens ?? 0,
        completionTokens: 0,
        totalTokens: (result.usage as any)?.tokens ?? 0,
        accuracy: result.usage ? 'EXACT' : 'ESTIMATED',
      },
    };
  }
}
