# LLM Usage Governance

Croco treats LLM usage as a tenant-governed metered resource, not only a model
call abstraction. The supported control path is:

1. Register a provider-backed `LlmModel` in `@croco/llm-core`.
2. Pass provider usage into `@croco/llm-metering`.
3. Use a versioned pricing registry for token and cost calculation.
4. Enforce tenant quota through `LlmMeteringService` `quotaPolicy` and
   `@croco/metering-core` meter quotas.
5. Export usage evidence through `LlmTelemetryBridge` GenAI attributes.

## Provider Decision

OpenAI is the first real provider target for a follow-up provider package because the
official API surface checked on 2026-06-18 covers the required Croco operations.
The links below are the official documentation paths used for that provider
decision and are validated by the docs link check:

- Text generation uses the Responses API and the official Node SDK
  (`client.responses.create`, `response.output_text`):
  https://developers.openai.com/api/docs/guides/text
- Responses include usage fields for input, output, and total tokens:
  https://developers.openai.com/api/reference/resources/responses/methods/create
- Streaming uses `stream=true` over server-sent events:
  https://developers.openai.com/api/docs/guides/streaming-responses
- Structured outputs use JSON schema response formats:
  https://developers.openai.com/api/docs/guides/structured-outputs
- Function tools are supported through Responses API `tools`:
  https://developers.openai.com/api/docs/guides/function-calling
- Embeddings remain a separate endpoint:
  https://developers.openai.com/api/reference/resources/embeddings/methods/create

This PR intentionally does not ship a partial `@croco/llm-openai` package. The
provider must normalize Responses events, function-tool outputs, structured output
schemas, embedding usage, provider errors, and abort behavior against the reusable
conformance suite before it becomes a publishable package.

## Provider Conformance

Future provider packages should import `createLlmProviderConformanceSuite` from
`@croco/testing` and run it against a deterministic provider test backend or mocked
transport. The suite covers:

- `generate`
- `stream`, including usage and abort behavior
- `generateObject`
- `callTool`
- `embed`
- `embedMany`
- provider error propagation

Provider tests should also add provider-specific cases for authentication, rate
limits, retryable errors, and live-smoke gates when credentials are available.

## Pricing Registry

Do not rely on built-in prices as current production prices. `samplePricingRegistry`
is versioned sample data for tests and demos. Applications should inject a current
registry:

```ts
import { LlmMeteringService, PricingTable } from "@croco/llm-metering";

const pricingTable = PricingTable.fromRegistry({
  version: "tenant-pricing-2026-06",
  source: "internal-price-book",
  entries: [
    {
      provider: "openai",
      modelId: "current-model-id",
      inputPricePerToken: 0.000001,
      outputPricePerToken: 0.000002,
      currency: "USD",
      effectiveDate: "2026-06-18",
    },
  ],
});

const llmMetering = new LlmMeteringService({
  meteringService,
  pricingTable,
});
```

The authoritative pricing source should be checked when the registry is refreshed:
https://developers.openai.com/api/docs/pricing

## Quota And Failure Policy

`LlmMeteringService` is fail-closed. If quota policy or any meter write fails, the
LLM usage operation fails with evidence instead of silently dropping usage.

Use `quotaPolicy` when an app needs pre-recording projected quota checks:

```ts
const llmMetering = new LlmMeteringService({
  meteringService,
  pricingTable,
  quotaPolicy: {
    async enforce(context) {
      for (const meter of context.meters) {
        await assertTenantCanSpend(context.tenantId, meter.meterId, meter.value);
      }
    },
  },
});
```

Also register the underlying meters in `@croco/metering-core` so during-recording
quota remains enforced:

- `llm.prompt_tokens`
- `llm.completion_tokens`
- `llm.embedding_tokens`
- `llm.cost_usd`

The generated SaaS preset includes a zero-credential AI usage example that records
one in-memory LLM call and proves an over-quota request fails before meter writes.

## Telemetry

`LlmTelemetryBridge` maps usage records onto GenAI-style span attributes:

- `gen_ai.system`
- `gen_ai.request.model`
- `gen_ai.usage.prompt_tokens`
- `gen_ai.usage.completion_tokens`
- `gen_ai.usage.cost_usd`
- `gen_ai.client.user`
- `gen_ai.usage.accuracy`

It also emits an `llm.usage` event with provider, model, and tenant ID. Use
`@croco/telemetry-sdk-node` at app startup and flush before serverless handler
return when running in Lambda-style runtimes.
