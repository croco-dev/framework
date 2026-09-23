# AI SDK Calls And Usage Governance

Croco does not provide a general-purpose model engine, registry, decorator, or provider facade. Applications call the vendor SDK they choose and define only the feature-specific input, output, failure, cancellation, and usage contract they need.

The maintained AI SaaS preset demonstrates the supported boundary:

1. The application resolves a tenant-scoped SDK client or deterministic test function.
2. A prompt policy validates tenant scope, request size, and sensitive-data handling before any external call.
3. The application calls the official SDK directly with an `AbortSignal`, a bounded output size, and SDK retries disabled.
4. The provider result and usage state are stored before usage ingestion or completion-event delivery.
5. `@croco/ai-usage` records known token and cost usage through `@croco/metering-core`.
6. Failed downstream delivery resumes from the stored receipt. It does not invoke the model again.

## OpenAI Reference Integration

The reference path pins `openai` `6.44.0` and calls `client.responses.create` directly. The application injects the client for the current tenant; it does not use a process-global client or model registry.

The client is constructed with explicit credentials and context, `logLevel: "off"`, and `maxRetries: 0`. Each call also passes `maxRetries: 0`, `store: false`, and an application-owned cancellation signal. This prevents ambient `OPENAI_*` configuration from selecting another tenant's organization or project and prevents the SDK from retrying a request whose acceptance is unknown.

The Responses API returns generated text in `response.output_text` and token counts in `response.usage`. The application accepts only `status: "completed"`. Missing usage remains unknown; it is not converted into a zero-token or zero-cost record. The official API contract is documented here:

- https://developers.openai.com/api/reference/typescript/resources/responses/methods/create
- https://developers.openai.com/api/reference/typescript#request-ids

Provider response IDs and request IDs are diagnostic correlation values. They do not prove idempotency. A connection loss, aborted response body, or other failure after request dispatch can leave provider acceptance and cost unknown. The receipt store records that state and blocks automatic re-inference until an operator or provider reconciliation process resolves it.

## Usage Ingestion

`@croco/ai-usage` accepts application-supplied usage; it does not execute model calls. Known generation usage is ingested with `AiUsageIngestService.ingestGenerationUsage`:

```ts no-check
import { AiPricingTable, AiUsageIngestService } from "@croco/ai-usage";

const pricingTable = AiPricingTable.fromRegistry({
  version: "tenant-pricing-2026-09",
  source: "internal-price-book",
  entries: [
    {
      provider: "openai",
      modelId: "approved-model-id",
      inputPricePerToken: 0.000001,
      outputPricePerToken: 0.000002,
      currency: "USD",
      effectiveDate: "2026-09-22",
    },
  ],
});

const usageIngest = new AiUsageIngestService({
  meteringService,
  pricingTable,
  quotaPolicy,
});

await usageIngest.ingestGenerationUsage({
  tenantId,
  provider: "openai",
  modelId: "approved-model-id",
  usage: {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens,
    accuracy: "EXACT",
  },
  idempotencyKey,
});
```

Pricing data is application-owned and versioned. `samplePricingRegistry` exists only for tests and demos; it is not a current provider price book. Check the authoritative provider source before updating production pricing:

- https://developers.openai.com/api/docs/pricing

The package remains fail-closed for quota policy and meter-write failures. It preserves the existing storage meter IDs so deployed usage ledgers do not require a meter rename:

- `llm.prompt_tokens`
- `llm.completion_tokens`
- `llm.embedding_tokens`
- `llm.cost_usd_nanos`

`llm.cost_usd_nanos` stores integer nanodollars. Reusing the same ingestion idempotency key preserves the existing `:prompt`, `:completion`, `:tokens`, and `:cost` meter deduplication boundary. The `:tokens` suffix is used for embedding-token records.

## Result, Event, And Restart Recovery

The provider result and its usage state must cross a durable application boundary before usage or completion-event publication. A receipt distinguishes these states:

- provider outcome unknown;
- provider completed, usage known;
- provider completed, usage unknown;
- usage pending or recorded;
- completion event pending or published.

When metering or event delivery fails after provider completion, retry only the pending downstream step with the same receipt and idempotency key. Completed meter writes are excluded from replay quota checks; active or rejected writes remain explicit failures. Do not reconstruct the prompt and call the provider again. When provider acceptance is unknown, expose that state and require reconciliation; do not report a confirmed failure or zero cost.

Raw prompts and model output may be required in application business state for result recovery, but they must not be copied into default telemetry, usage events, or diagnostic logs. Apply the application's retention, delete, legal-hold, and tenant-scope policy to any durable receipt that stores content.

## Migration From The Retired Facades

The retired source-tree manifests were versioned at `@croco/llm-core@0.0.4`, `@croco/llm-metering@0.0.4`, and `@croco/llm-openai@0.0.1`. Those versions were not all published: the npm registry exposes `@croco/llm-core` and `@croco/llm-metering` through `0.0.2`, while `@croco/llm-openai` has no published release. Do not add a retired package as a new dependency. During a staged migration, keep the exact version already resolved in the application's lockfile until its replacement boundary is deployed.

Migrate consumers in this order:

1. Inventory every imported facade, decorator, provider operation, event, meter, error branch, and test helper.
2. Add a feature-local SDK function and its deterministic fake. Define cancellation, deadline, output, provider-failure, and unknown-outcome behavior before changing call sites.
3. Add durable result and usage receipts for provider calls that can cross a process restart. Resume only unfinished meter and event deliveries with their original idempotency keys.
4. Replace usage and cost recording with `@croco/ai-usage`, keeping the existing `llm.*` meter IDs and suffixes.
5. Replace provider conformance tests with feature-contract tests against both the deterministic fake and the real SDK connected to a local HTTP fixture.
6. Remove the retired packages and their problem-code branches only after the application no longer imports them.

| Retired surface                              | Migration                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `LlmService`, `LlmModel`, `LlmRegistry`      | Define and inject a feature-local SDK execution function.                                                              |
| `@Llm`, `setLlmService`, `runWithLlmService` | Inject the execution function through the application's composition root.                                              |
| `@croco/llm-openai`                          | Inject `openai@6.44.0` and call the required SDK resource directly. Unsupported feature operations remain unsupported. |
| `LlmMeteringService.recordUsage`             | Use `AiUsageIngestService.ingestGenerationUsage`.                                                                      |
| `LlmMeteringService.recordEmbeddingUsage`    | Use `AiUsageIngestService.ingestEmbeddingUsage`.                                                                       |
| `@AiMetered` and stream wrappers             | Extract final provider usage in feature code and ingest it explicitly.                                                 |
| `createLlmProviderConformanceSuite`          | Test the feature contract with both a deterministic fake and the actual vendor SDK against a local HTTP fixture.       |
| Generic completion events                    | Store a feature-owned result/usage receipt and pending event intent, then resume delivery without re-inference.        |

There is no replacement model registry, agent loop, cross-provider chat protocol, or embedding engine. Applications add only the SDK operations their product feature supports.

## Maintained Consumer Inventory

| Consumer                            | Model-call boundary                                                                                                                               | Usage, retry, and event behavior                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-croco-app` `ai-saas` preset | The default path injects a deterministic application function. The production reference injects a tenant-scoped `openai@6.44.0` Responses client. | Stores the provider result and usage receipt before downstream work, retries no SDK calls, resumes incomplete meter writes by status, and republishes only a pending completion event. |
| `create-croco-app` `saas` preset    | Uses a deterministic application-local `generateAiText` demo and makes no external model call.                                                    | Ingests its explicit token result through `@croco/ai-usage` and keeps entitlement checks and `llm.*` usage meters deterministic.                                                       |
| `@croco/ai-usage`                   | Does not call a model or choose a provider.                                                                                                       | Prices caller-supplied generation, embedding, and image usage; enforces caller-supplied quota policy; records stable meters; emits usage events and telemetry.                         |

No maintained consumer requires the retired generic registry, decorators, provider facade, streaming wrapper, tool-call loop, structured-output engine, or embedding execution API. Those surfaces are deleted instead of being mirrored behind a replacement abstraction.

## Verification

Default tests use deterministic functions and local HTTP fixtures. They do not require customer prompts, production credentials, or a live provider request. The maintained reference verifies completed responses, missing usage, incomplete results, tenant credential isolation, cancellation during response-body delivery, connection loss, downstream event failure, usage deduplication, and restart recovery.
