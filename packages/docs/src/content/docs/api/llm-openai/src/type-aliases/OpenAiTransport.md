---
editUrl: false
next: false
prev: false
title: "OpenAiTransport"
---

> **OpenAiTransport** = `object`

## Methods

### createEmbedding()

> **createEmbedding**(`request`, `options?`): `Promise`\<[`OpenAiEmbeddingResponse`](/api/llm-openai/src/type-aliases/openaiembeddingresponse/)\>

#### Parameters

##### request

[`OpenAiEmbeddingRequest`](/api/llm-openai/src/type-aliases/openaiembeddingrequest/)

##### options?

[`OpenAiRequestOptions`](/api/llm-openai/src/type-aliases/openairequestoptions/)

#### Returns

`Promise`\<[`OpenAiEmbeddingResponse`](/api/llm-openai/src/type-aliases/openaiembeddingresponse/)\>

---

### createResponse()

> **createResponse**(`request`, `options?`): `Promise`\<[`OpenAiResponse`](/api/llm-openai/src/type-aliases/openairesponse/)\>

#### Parameters

##### request

[`OpenAiResponseRequest`](/api/llm-openai/src/type-aliases/openairesponserequest/)

##### options?

[`OpenAiRequestOptions`](/api/llm-openai/src/type-aliases/openairequestoptions/)

#### Returns

`Promise`\<[`OpenAiResponse`](/api/llm-openai/src/type-aliases/openairesponse/)\>

---

### streamResponse()

> **streamResponse**(`request`, `options?`): `Promise`\<`AsyncIterable`\<[`OpenAiStreamEvent`](/api/llm-openai/src/type-aliases/openaistreamevent/), `any`, `any`\>\>

#### Parameters

##### request

[`OpenAiResponseRequest`](/api/llm-openai/src/type-aliases/openairesponserequest/)

##### options?

[`OpenAiRequestOptions`](/api/llm-openai/src/type-aliases/openairequestoptions/)

#### Returns

`Promise`\<`AsyncIterable`\<[`OpenAiStreamEvent`](/api/llm-openai/src/type-aliases/openaistreamevent/), `any`, `any`\>\>
