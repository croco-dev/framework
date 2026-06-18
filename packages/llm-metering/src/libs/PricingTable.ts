import type {
  LlmEmbeddingUsageRecord,
  LlmUsageRecord,
  ModelPricing,
  PricingRegistryDefinition,
  PricingRegistryEntry,
} from "./types";
import { PricingRegistryConflictProblem } from "./problems/LlmMeteringProblems";

/**
 * 로컬 테스트와 예제에 사용하는 버전 고정 샘플 가격 레지스트리입니다.
 */
export const samplePricingRegistry: PricingRegistryDefinition = {
  version: "sample-openai-anthropic-2024-legacy",
  source:
    "Croco sample data for local tests and demos; applications should inject current pricing.",
  effectiveDate: "2024-01-01",
  notes:
    "This registry is intentionally versioned sample data. Do not treat it as current provider pricing.",
  entries: [
    {
      provider: "openai",
      modelId: "gpt-4",
      inputPricePerToken: 0.00003,
      outputPricePerToken: 0.00006,
      currency: "USD",
    },
    {
      provider: "openai",
      modelId: "gpt-4-turbo",
      inputPricePerToken: 0.00001,
      outputPricePerToken: 0.00003,
      currency: "USD",
    },
    {
      provider: "openai",
      modelId: "gpt-3.5-turbo",
      inputPricePerToken: 0.0000005,
      outputPricePerToken: 0.0000015,
      currency: "USD",
    },
    {
      provider: "openai",
      modelId: "text-embedding-ada-002",
      inputPricePerToken: 0.0000001,
      outputPricePerToken: 0,
      currency: "USD",
    },
    {
      provider: "openai",
      modelId: "text-embedding-3-small",
      inputPricePerToken: 0.00000002,
      outputPricePerToken: 0,
      currency: "USD",
    },
    {
      provider: "openai",
      modelId: "text-embedding-3-large",
      inputPricePerToken: 0.00000013,
      outputPricePerToken: 0,
      currency: "USD",
    },
    {
      provider: "anthropic",
      modelId: "claude-3-opus-20240229",
      inputPricePerToken: 0.000015,
      outputPricePerToken: 0.000075,
      currency: "USD",
    },
    {
      provider: "anthropic",
      modelId: "claude-3-sonnet-20240229",
      inputPricePerToken: 0.000003,
      outputPricePerToken: 0.000015,
      currency: "USD",
    },
    {
      provider: "anthropic",
      modelId: "claude-3-haiku-20240307",
      inputPricePerToken: 0.00000025,
      outputPricePerToken: 0.00000125,
      currency: "USD",
    },
  ],
};

function createPricingFromRegistry(
  registry: PricingRegistryDefinition,
): Map<string, Map<string, ModelPricing>> {
  const pricing = new Map<string, Map<string, ModelPricing>>();

  for (const entry of registry.entries) {
    let providerPricing = pricing.get(entry.provider);
    if (!providerPricing) {
      providerPricing = new Map();
      pricing.set(entry.provider, providerPricing);
    }

    if (providerPricing.has(entry.modelId)) {
      throw new PricingRegistryConflictProblem(entry.provider, entry.modelId, registry.version);
    }

    const modelPricing: ModelPricing = {
      inputPricePerToken: entry.inputPricePerToken,
      outputPricePerToken: entry.outputPricePerToken,
      currency: entry.currency,
    };

    if (entry.source !== undefined) {
      modelPricing.source = entry.source;
    }
    if (entry.effectiveDate !== undefined) {
      modelPricing.effectiveDate = entry.effectiveDate;
    }

    providerPricing.set(entry.modelId, modelPricing);
  }

  return pricing;
}

export class PricingTable {
  readonly version: string;
  readonly source?: string;
  readonly effectiveDate?: string;
  readonly notes?: string;
  private readonly pricing: Map<string, Map<string, ModelPricing>>;

  constructor(
    pricing: Map<string, Map<string, ModelPricing>> = createPricingFromRegistry(
      samplePricingRegistry,
    ),
    options: { version?: string; source?: string; effectiveDate?: string; notes?: string } = {},
  ) {
    this.pricing = pricing;
    this.version = options.version ?? samplePricingRegistry.version;
    this.source = options.source ?? samplePricingRegistry.source;
    this.effectiveDate = options.effectiveDate ?? samplePricingRegistry.effectiveDate;
    this.notes = options.notes ?? samplePricingRegistry.notes;
  }

  static fromRegistry(registry: PricingRegistryDefinition): PricingTable {
    return new PricingTable(createPricingFromRegistry(registry), {
      effectiveDate: registry.effectiveDate,
      notes: registry.notes,
      source: registry.source,
      version: registry.version,
    });
  }

  public toRegistry(): PricingRegistryDefinition {
    const entries: PricingRegistryEntry[] = [];

    for (const [provider, providerPricing] of this.pricing.entries()) {
      for (const [modelId, pricing] of providerPricing.entries()) {
        entries.push({
          provider,
          modelId,
          ...pricing,
        });
      }
    }

    return {
      version: this.version,
      source: this.source,
      effectiveDate: this.effectiveDate,
      notes: this.notes,
      entries,
    };
  }

  public getPrice(provider: string, modelId: string): ModelPricing | null {
    const providerPricing = this.pricing.get(provider);
    if (!providerPricing) {
      return null;
    }
    return providerPricing.get(modelId) ?? null;
  }

  public calculateCost(usage: LlmUsageRecord, pricing: ModelPricing): number;
  public calculateCost(usage: LlmEmbeddingUsageRecord, pricing: ModelPricing): number;
  public calculateCost(
    usage: LlmUsageRecord | LlmEmbeddingUsageRecord,
    pricing: ModelPricing,
  ): number {
    if ("embeddingTokens" in usage) {
      return usage.embeddingTokens * pricing.inputPricePerToken;
    }

    return (
      usage.promptTokens * pricing.inputPricePerToken +
      usage.completionTokens * pricing.outputPricePerToken
    );
  }

  public setPrice(provider: string, modelId: string, pricing: ModelPricing): void {
    let providerPricing = this.pricing.get(provider);
    if (!providerPricing) {
      providerPricing = new Map();
      this.pricing.set(provider, providerPricing);
    }

    providerPricing.set(modelId, pricing);
  }
}

export const defaultPricingTable = PricingTable.fromRegistry(samplePricingRegistry);
