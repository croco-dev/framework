import type { EventBus } from '@croco/events-core';
import { Token } from '@croco/framework-context';
import { LlmGeneratedEvent } from './events/LlmGeneratedEvent';
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

  async generate(params: GenerateParams): Promise<GenerateResult> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      const result = await model.generate(params);

      await this.eventBus.publish(new LlmGeneratedEvent(model.modelId, params.prompt, result.text, result.usage));

      return result;
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);

      for await (const chunk of model.stream(params)) {
        yield chunk;
      }
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    try {
      const model = params.model ?? 'default';
      const llmModel = await this.registry.getModel(model);
      return await llmModel.embed(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    try {
      const model = params.model ?? 'default';
      const llmModel = await this.registry.getModel(model);
      return await llmModel.embedMany(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      return await model.generateObject(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    try {
      const modelId = params.modelId ?? 'default';
      const model = await this.registry.getModel(modelId);
      return await model.callTool(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }
}
