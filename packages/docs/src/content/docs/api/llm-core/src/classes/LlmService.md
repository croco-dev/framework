---
editUrl: false
next: false
prev: false
title: "LlmService"
---

생성, 스트리밍, 임베딩, 도구 호출을 통합 제공하는 핵심 서비스입니다.

## Constructors

### Constructor

> **new LlmService**(`registry`, `eventBus`, `options?`): `LlmService`

#### Parameters

##### registry

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/)

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

##### options?

[`LlmServiceOptions`](/api/llm-core/src/type-aliases/llmserviceoptions/) = `{}`

#### Returns

`LlmService`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`LlmService`\>

## Methods

### callTool()

> **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

#### Parameters

##### params

[`ToolCallParams`](/api/llm-core/src/type-aliases/toolcallparams/)

#### Returns

`Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

---

### embed()

> **embed**(`params`): `Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

#### Parameters

##### params

[`EmbedParams`](/api/llm-core/src/type-aliases/embedparams/)

#### Returns

`Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

---

### embedMany()

> **embedMany**(`params`): `Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

#### Parameters

##### params

[`EmbedManyParams`](/api/llm-core/src/type-aliases/embedmanyparams/)

#### Returns

`Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

---

### generate()

> **generate**(`params`): `Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

#### Returns

`Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

---

### generateObject()

> **generateObject**\<`T`\>(`params`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GenerateObjectParams`](/api/llm-core/src/type-aliases/generateobjectparams/)\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### retryCompletionEvent()

> **retryCompletionEvent**(`recovery`): `Promise`\<`void`\>

#### Parameters

##### recovery

[`LlmCompletionEventIntent`](/api/llm-core/src/type-aliases/llmcompletioneventintent/) \| [`LlmCompletionEventPublicationProblem`](/api/llm-core/src/classes/llmcompletioneventpublicationproblem/)

#### Returns

`Promise`\<`void`\>

---

### stream()

> **stream**(`params`): `AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

#### Returns

`AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>
