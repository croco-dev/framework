# @croco/llm-openai

First-party OpenAI provider for the Croco `@croco/llm-core` contract.

## Install

```bash
pnpm add @croco/llm-openai @croco/llm-core @croco/telemetry-api
```

## Configure

Required environment variable for the SDK-backed provider:

- `OPENAI_API_KEY`

Optional constructor settings:

- `modelId`: Responses API model used for generation, streaming, structured output, and tools.
- `embeddingModelId`: embeddings model. Defaults to `text-embedding-3-small`.
- `baseUrl`: optional OpenAI-compatible base URL.
- `timeout`: optional SDK request timeout in milliseconds.

```typescript
import { OpenAiLlmModel } from "@croco/llm-openai";

const model = new OpenAiLlmModel({
  modelId: "gpt-5.5",
  embeddingModelId: "text-embedding-3-small",
});

const response = await model.generate({
  prompt: "Summarize Croco provider conformance in one sentence.",
});
```

## Supported Croco operations

| Croco operation    | OpenAI API path                         |
| ------------------ | --------------------------------------- |
| `generate()`       | Responses API text output               |
| `stream()`         | Responses API SSE events                |
| `generateObject()` | Responses API `text.format` JSON Schema |
| `callTool()`       | Responses API function tools            |
| `embed()`          | Embeddings API single input             |
| `embedMany()`      | Embeddings API array input              |

Streaming emits text deltas and a final usage chunk when OpenAI returns completed response usage.
Abort signals are passed to the OpenAI SDK and checked while consuming the stream.
Failures without an HTTP status, 408, 409, 429, and all 5xx responses use a bounded three-attempt policy. OpenAI
`Retry-After` hints are honored up to the configured `retryBackoff.maxDelay`. Streaming retries stop as soon as the
first response event arrives, so already-observed output is never replayed.

## Metering and usage

OpenAI usage is mapped into Croco `LlmUsage` fields:

- `input_tokens` -> `promptTokens`
- `output_tokens` -> `completionTokens`
- `total_tokens` -> `totalTokens`
- provider-reported usage uses `accuracy: "EXACT"`

The returned metadata includes `provider: "openai"`, the resolved OpenAI model, and the OpenAI finish/status fields when present. `@croco/llm-metering` can record those values through its existing usage APIs.

## Telemetry

The provider wraps generation, streaming setup, structured output, tool calling, and embeddings in `@croco/telemetry-api` spans. It records `llm.openai.usage` events for provider-reported usage and does not initialize any OpenTelemetry SDK globally. Applications remain responsible for SDK initialization and flushing.

## Failure semantics

The provider normalizes OpenAI SDK and transport failures into deterministic Croco Problems:

- `OpenAiMissingConfigProblem`
- `OpenAiAuthenticationProblem`
- `OpenAiRateLimitProblem`
- `OpenAiValidationProblem`
- `OpenAiAbortProblem`
- `OpenAiRetryableUpstreamProblem`
- `OpenAiTerminalUpstreamProblem`
- `OpenAiInvalidResponseProblem`

No upstream SDK error is surfaced directly from the public provider methods.

## Unsupported features

- Multimodal inputs are outside this package's current `@croco/llm-core` text-only contract.
- Tool execution is not performed by the provider. `callTool()` returns function tool call requests for the application to execute.
- Batch API jobs are not wrapped. `embedMany()` uses the synchronous embeddings endpoint with multiple inputs.

## Verification

Default CI uses deterministic mocked transport through `createLlmProviderConformanceSuite()`.

```bash
pnpm --filter @croco/llm-openai test
pnpm docs:catalog:check
pnpm public-api:check
pnpm check
```

Live smoke is optional and skipped when credentials are absent:

```bash
OPENAI_API_KEY=... pnpm --filter @croco/llm-openai test -- src/tests/OpenAiLiveSmoke.spec.ts
```
