---
editUrl: false
next: false
prev: false
title: "LlmService"
---

Defined in: [packages/llm-core/src/libs/LlmService.ts:23](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L23)

## Constructors

### Constructor

> **new LlmService**(`registry`, `eventBus`): `LlmService`

Defined in: [packages/llm-core/src/libs/LlmService.ts:26](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L26)

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

Defined in: [packages/llm-core/src/libs/LlmService.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L24)

## Methods

### callTool()

> **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:121](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L121)

#### Parameters

##### params

[`ToolCallParams`](/api/llm-core/src/type-aliases/toolcallparams/)

#### Returns

`Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

***

### embed()

> **embed**(`params`): `Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:88](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L88)

#### Parameters

##### params

[`EmbedParams`](/api/llm-core/src/type-aliases/embedparams/)

#### Returns

`Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

***

### embedMany()

> **embedMany**(`params`): `Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:99](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L99)

#### Parameters

##### params

[`EmbedManyParams`](/api/llm-core/src/type-aliases/embedmanyparams/)

#### Returns

`Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

***

### generate()

> **generate**(`params`): `Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:32](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L32)

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

#### Returns

`Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

***

### generateObject()

> **generateObject**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:110](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L110)

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

Defined in: [packages/llm-core/src/libs/LlmService.ts:52](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/LlmService.ts#L52)

#### Parameters

##### params

[`StreamParams`](/api/llm-core/src/type-aliases/streamparams/)

#### Returns

`AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>
