---
editUrl: false
next: false
prev: false
title: "LlmService"
---

Defined in: [packages/llm-core/src/libs/LlmService.ts:20](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L20)

## Constructors

### Constructor

> **new LlmService**(`registry`, `eventBus`): `LlmService`

Defined in: [packages/llm-core/src/libs/LlmService.ts:23](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L23)

#### Parameters

##### registry

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/)

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`LlmService`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`LlmService`\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:21](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L21)

## Methods

### callTool()

> **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:85](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L85)

#### Parameters

##### params

[`ToolCallParams`](/api/llm-core/src/type-aliases/toolcallparams/)

#### Returns

`Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

***

### embed()

> **embed**(`params`): `Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:55](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L55)

#### Parameters

##### params

[`EmbedParams`](/api/llm-core/src/type-aliases/embedparams/)

#### Returns

`Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

***

### embedMany()

> **embedMany**(`params`): `Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:65](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L65)

#### Parameters

##### params

[`EmbedManyParams`](/api/llm-core/src/type-aliases/embedmanyparams/)

#### Returns

`Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

***

### generate()

> **generate**(`params`): `Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:28](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L28)

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

#### Returns

`Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

***

### generateObject()

> **generateObject**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:75](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L75)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GenerateObjectParams`](/api/llm-core/src/type-aliases/generateobjectparams/)\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### stream()

> **stream**(`params`): `AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:42](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/LlmService.ts#L42)

#### Parameters

##### params

[`StreamParams`](/api/llm-core/src/type-aliases/streamparams/)

#### Returns

`AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>
