import type { EventBus } from '@croco/events-core';
import { Token } from '@croco/framework-context';
import { Trace } from '@croco/telemetry-api';
import { LlmGeneratedEvent } from './events/LlmGeneratedEvent';
import { LlmStreamCompletedEvent } from './events/LlmStreamCompletedEvent';
import type { LlmRegistry } from './LlmRegistry';
import { LlmServiceProblem } from './problems/LlmServiceProblem';
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmUsage,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
} from './types';

export class LlmService {
  static readonly token = new Token<LlmService>('LlmService');

  constructor(
    private readonly registry: LlmRegistry,
    private readonly eventBus: EventBus
  ) {}

  @Trace({ name: 'llm.generate' })
  async generate(params: GenerateParams): Promise<GenerateResult> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      const result = await model.generate(params);

      await this.publishCompletionEvent({
        operation: 'generate',
        modelId: model.modelId,
        prompt: params.prompt,
        text: result.text,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      const streamedChunks: string[] = [];
      const streamUsage: Partial<LlmUsage> = {};
      let chunkCount = 0;

      for await (const chunk of model.stream(params)) {
        chunkCount += 1;
        streamedChunks.push(chunk.delta);

        if (chunk.usage) {
          Object.assign(streamUsage, chunk.usage);
        }

        yield chunk;
      }

      const text = streamedChunks.join('');
      const usage = this.buildStreamUsage(params.prompt, text, streamUsage);

      await this.publishCompletionEvent({
        operation: 'stream',
        modelId: model.modelId,
        prompt: params.prompt,
        text,
        usage,
        chunkCount,
      });
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  @Trace({ name: 'llm.embed' })
  async embed(params: EmbedParams): Promise<EmbedResult> {
    try {
      const model = params.model ?? 'default';
      const llmModel = await this.registry.getModel(model);
      return await llmModel.embed(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  @Trace({ name: 'llm.embed_many' })
  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    try {
      const model = params.model ?? 'default';
      const llmModel = await this.registry.getModel(model);
      return await llmModel.embedMany(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  @Trace({ name: 'llm.generate_object' })
  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      return await model.generateObject(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  @Trace({ name: 'llm.call_tool' })
  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      return await model.callTool(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  private async publishCompletionEvent(params: {
    operation: 'generate' | 'stream';
    modelId: string;
    prompt: string;
    text: string;
    usage: LlmUsage;
    chunkCount?: number;
  }): Promise<void> {
    const event =
      params.operation === 'stream'
        ? new LlmStreamCompletedEvent(params.modelId, params.text, params.usage, params.chunkCount)
        : new LlmGeneratedEvent(params.modelId, params.prompt, params.text, params.usage);

    await this.eventBus.publish(event);
  }

  private buildStreamUsage(prompt: string, text: string, usage: Partial<LlmUsage>): LlmUsage {
    const promptTokens = usage.promptTokens ?? prompt.length;
    const completionTokens = usage.completionTokens ?? text.length;
    const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      accuracy: usage.accuracy,
    };
  }
}
