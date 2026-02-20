---
editUrl: false
next: false
prev: false
title: "LlmService"
---

Defined in: [packages/llm-core/src/libs/LlmService.ts:22](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L22)

## Constructors

### Constructor

> **new LlmService**(`registry`, `eventBus`): `LlmService`

Defined in: [packages/llm-core/src/libs/LlmService.ts:25](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L25)

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

Defined in: [packages/llm-core/src/libs/LlmService.ts:23](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L23)

## Methods

### callTool()

> **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:115](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L115)

#### Parameters

##### params

[`ToolCallParams`](/api/llm-core/src/type-aliases/toolcallparams/)

#### Returns

`Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

***

### embed()

> **embed**(`params`): `Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:85](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L85)

#### Parameters

##### params

[`EmbedParams`](/api/llm-core/src/type-aliases/embedparams/)

#### Returns

`Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

***

### embedMany()

> **embedMany**(`params`): `Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:95](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L95)

#### Parameters

##### params

[`EmbedManyParams`](/api/llm-core/src/type-aliases/embedmanyparams/)

#### Returns

`Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

***

### generate()

> **generate**(`params`): `Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:30](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L30)

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

#### Returns

`Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

***

### generateObject()

> **generateObject**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [packages/llm-core/src/libs/LlmService.ts:105](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L105)

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

Defined in: [packages/llm-core/src/libs/LlmService.ts:50](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/llm-core/src/libs/LlmService.ts#L50)

#### Parameters

##### params

[`StreamParams`](/api/llm-core/src/type-aliases/streamparams/)

#### Returns

`AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>
