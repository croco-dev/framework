---
editUrl: false
next: false
prev: false
title: "LlmCompletionEventIntentStore"
---

Optional durable boundary for completion events. Recording the same intent twice must be idempotent.
`claimDelivery` must atomically grant at most one active claim for an intent. Claims should expire so
abandoned delivery can be retried. `releaseDelivery` and a claimed `markPublished` transition must
validate the claim fencing token.

## Methods

### claimDelivery()

> **claimDelivery**(`intentId`): `Promise`\<[`LlmCompletionEventDeliveryClaim`](/api/llm-core/src/type-aliases/llmcompletioneventdeliveryclaim/) \| `undefined`\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`LlmCompletionEventDeliveryClaim`](/api/llm-core/src/type-aliases/llmcompletioneventdeliveryclaim/) \| `undefined`\>

---

### loadDeliveryState()

> **loadDeliveryState**(`intentId`): `Promise`\<[`LlmCompletionEventDeliveryState`](/api/llm-core/src/type-aliases/llmcompletioneventdeliverystate/)\>

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`LlmCompletionEventDeliveryState`](/api/llm-core/src/type-aliases/llmcompletioneventdeliverystate/)\>

---

### markPublished()

> **markPublished**(`intentId`, `claim?`): `Promise`\<`void`\>

#### Parameters

##### intentId

`string`

##### claim?

[`LlmCompletionEventDeliveryClaim`](/api/llm-core/src/type-aliases/llmcompletioneventdeliveryclaim/)

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

---

### releaseDelivery()

> **releaseDelivery**(`claim`): `Promise`\<`void`\>

#### Parameters

##### claim

[`LlmCompletionEventDeliveryClaim`](/api/llm-core/src/type-aliases/llmcompletioneventdeliveryclaim/)

#### Returns

`Promise`\<`void`\>
