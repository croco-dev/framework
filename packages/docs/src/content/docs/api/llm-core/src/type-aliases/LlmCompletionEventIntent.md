---
editUrl: false
next: false
prev: false
title: "LlmCompletionEventIntent"
---

> **LlmCompletionEventIntent** = \{ `eventId`: `string`; `eventName`: `"llm.generated"`; `id`: `string`; `metadata?`: [`LlmMetadata`](/api/llm-core/src/type-aliases/llmmetadata/); `modelId`: `string`; `occurredAt`: `string`; `operation`: `"generate"`; `prompt`: `string`; `text`: `string`; `usage`: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/); \} \| \{ `chunkCount`: `number`; `eventId`: `string`; `eventName`: `"llm.stream_completed"`; `id`: `string`; `modelId`: `string`; `occurredAt`: `string`; `operation`: `"stream"`; `text`: `string`; `textTruncated`: `boolean`; `usage`: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/); \}
