# @croco/ai-usage

SDK-independent AI usage ingestion for Croco metering. Applications call their chosen
provider SDK directly, normalize its reported usage, and submit that usage here.

## Generation usage

```typescript
import { AiPricingTable, AiUsageIngestService } from "@croco/ai-usage";
import type { MeteringService } from "@croco/metering-core";

export async function ingestReportedUsage(meteringService: MeteringService) {
  const pricingTable = AiPricingTable.fromRegistry({
    version: "application-pricing-v1",
    entries: [
      {
        provider: "example",
        modelId: "generation-model",
        inputPricePerToken: 0.000001,
        outputPricePerToken: 0.000002,
        currency: "USD",
      },
    ],
  });
  const usage = new AiUsageIngestService({ meteringService, pricingTable });
  return usage.ingestGenerationUsage({
    tenantId: "tenant-1",
    provider: "example",
    modelId: "generation-model",
    idempotencyKey: "example",
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      accuracy: "EXACT",
    },
  });
}
```

The application owns provider calls, streaming, cancellation, retries, and mapping
SDK results. Submit final usage once a generation completes; ingestion does not
wrap a provider or consume a stream.

## Embedding usage

Call `ingestEmbeddingUsage` with `tenantId`, `provider`, `modelId`,
`embeddingTokens`, `idempotencyKey`, and optional `accuracy`. It records embedding
tokens and their cost using the model's input-token price.

## Pricing, quota, and persistence

- `AiPricingTable` accepts a versioned registry or individual prices. The bundled
  `samplePricingRegistry` is historical sample data, not current provider pricing.
- The existing default price for unknown models is USD 0.000001 per input token and
  USD 0.000002 per output token. Supply `defaultPricing` and an application-owned
  `pricingTable` for your billing policy.
- `AiUsageQuotaPolicy.enforce` runs before meter writes. Policy and persistence
  failures reject ingestion with `AiUsageRecordFailedProblem`; quota rejections
  retain `AiUsageQuotaExceededProblem`.
- Token counts must be non-negative safe integers. USD costs must be exactly
  representable as non-negative safe-integer nanodollars.
- `AI_INPUT_TOKENS`, `AI_OUTPUT_TOKENS`, `AI_EMBEDDING_TOKENS`, and
  `AI_COST_USD_NANOS` preserve the stored meter IDs `llm.prompt_tokens`,
  `llm.completion_tokens`, `llm.embedding_tokens`, and `llm.cost_usd_nanos`.
  Existing idempotency-key suffixes (`:prompt`, `:completion`, `:tokens`,
  `:cost`) are preserved so a package migration does not duplicate usage.
- `AiUsageRecordedEvent` publishes after successful generation meter writes.
  `AiCostBudgetExceededEvent` and `AiCostLimitExceededProblem` model application
  budget enforcement. Event names and Problem codes use the `ai-usage/` namespace.
- `AiTelemetryBridge` maps usage records to the existing GenAI telemetry
  attributes through an SDK-independent `AiTelemetrySpanAdapter`.
