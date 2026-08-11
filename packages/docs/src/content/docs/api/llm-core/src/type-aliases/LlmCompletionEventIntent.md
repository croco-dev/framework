---
editUrl: false
next: false
prev: false
title: "LlmCompletionEventIntent"
---

> **LlmCompletionEventIntent** = \{ `eventId`: `string`; `eventName`: `"llm.generated"`; `id`: `string`; `metadata?`: [`LlmMetadata`](/api/llm-core/src/type-aliases/llmmetadata/); `modelId`: `string`; `occurredAt`: `string`; `operation`: `"generate"`; `prompt`: `string`; `text`: `string`; `usage`: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/); \} \| \{ `chunkCount`: `number`; `eventId`: `string`; `eventName`: `"llm.stream_completed"`; `id`: `string`; `modelId`: `string`; `occurredAt`: `string`; `operation`: `"stream"`; `text`: `string`; `textTruncated`: `boolean`; `usage`: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/); \}

Stable completion-event data persisted for recovery. Generate intents retain the prompt unchanged,
so external stores must encrypt it as appropriate, define a retention period, and delete it after
delivery according to their data policy. Stream intents deliberately do not persist the prompt.
