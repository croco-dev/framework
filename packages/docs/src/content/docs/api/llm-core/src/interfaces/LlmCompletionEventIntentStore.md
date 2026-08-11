---
editUrl: false
next: false
prev: false
title: "LlmCompletionEventIntentStore"
---

Optional durable boundary for completion events. Recording the same intent twice must be idempotent.

## Methods

### loadDeliveryState()

> **loadDeliveryState**(`intentId`): `Promise`\<[`LlmCompletionEventDeliveryState`](/api/llm-core/src/type-aliases/llmcompletioneventdeliverystate/)\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`LlmCompletionEventDeliveryState`](/api/llm-core/src/type-aliases/llmcompletioneventdeliverystate/)\>

---

### markPublished()

> **markPublished**(`intentId`): `Promise`\<`void`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<`void`\>

---

### recordPending()

> **recordPending**(`intent`): `Promise`\<`void`\>

#### Parameters

##### intent

[`LlmCompletionEventIntent`](/api/llm-core/src/type-aliases/llmcompletioneventintent/)

#### Returns

`Promise`\<`void`\>
