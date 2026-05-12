import type { LlmEmbeddingUsageRecord, LlmUsageRecord, ModelPricing } from "./types";

const DEFAULT_PRICING_ENTRIES: Array<[string, Array<[string, ModelPricing]>]> = [
  [
    "openai",
    [
      [
        "gpt-4",
        {
          inputPricePerToken: 0.00003,
          outputPricePerToken: 0.00006,
          currency: "USD",
        },
      ],
      [
        "gpt-4-turbo",
        {
          inputPricePerToken: 0.00001,
          outputPricePerToken: 0.00003,
          currency: "USD",
        },
      ],
      [
        "gpt-3.5-turbo",
        {
          inputPricePerToken: 0.0000005,
          outputPricePerToken: 0.0000015,
          currency: "USD",
        },
      ],
      [
        "text-embedding-ada-002",
        {
          inputPricePerToken: 0.0000001,
          outputPricePerToken: 0,
          currency: "USD",
        },
      ],
      [
        "text-embedding-3-small",
        {
          inputPricePerToken: 0.00000002,
          outputPricePerToken: 0,
          currency: "USD",
        },
      ],
      [
        "text-embedding-3-large",
        {
          inputPricePerToken: 0.00000013,
          outputPricePerToken: 0,
          currency: "USD",
        },
      ],
    ],
  ],
  [
    "anthropic",
    [
      [
        "claude-3-opus-20240229",
        {
          inputPricePerToken: 0.000015,
          outputPricePerToken: 0.000075,
          currency: "USD",
        },
      ],
      [
        "claude-3-sonnet-20240229",
        {
          inputPricePerToken: 0.000003,
          outputPricePerToken: 0.000015,
          currency: "USD",
        },
      ],
      [
        "claude-3-haiku-20240307",
        {
          inputPricePerToken: 0.00000025,
          outputPricePerToken: 0.00000125,
          currency: "USD",
        },
      ],
    ],
  ],
];

function createDefaultPricing(): Map<string, Map<string, ModelPricing>> {
  return new Map(
    DEFAULT_PRICING_ENTRIES.map(([provider, entries]) => [
      provider,
      new Map(entries.map(([modelId, pricing]) => [modelId, { ...pricing }])),
    ]),
  );
}

export class PricingTable {
  private readonly pricing: Map<string, Map<string, ModelPricing>>;

  constructor(pricing: Map<string, Map<string, ModelPricing>> = createDefaultPricing()) {
    this.pricing = pricing;
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

export const defaultPricingTable = new PricingTable();
