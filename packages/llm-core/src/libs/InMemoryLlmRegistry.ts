import type { LlmModel } from './LlmModel';
import { LlmRegistry } from './LlmRegistry';
import { ModelNotFoundError } from './problems/LlmServiceProblem';

export class InMemoryLlmRegistry extends LlmRegistry {
  private providers = new Map<string, () => LlmModel>();
  private models = new Map<string, LlmModel>();

  async getModel(modelId: string): Promise<LlmModel> {
    const cachedModel = this.models.get(modelId);
    if (cachedModel) {
      return cachedModel;
    }

    const factory = this.providers.get(modelId);
    if (!factory) {
      throw new ModelNotFoundError(modelId);
    }

    const model = factory();
    this.models.set(modelId, model);
    return model;
  }

  async listModels(): Promise<string[]> {
    return Array.from(this.providers.keys());
  }

  registerProvider(providerId: string, factory: () => LlmModel): void {
    this.providers.set(providerId, factory);
  }
}
