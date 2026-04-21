---
editUrl: false
next: false
prev: false
title: "InMemoryLlmModel"
---

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L19)

테스트용 인메모리 모델 구현체입니다.

## Extends

- [`LlmModel`](/api/llm-core/src/classes/llmmodel/)

## Constructors

### Constructor

> **new InMemoryLlmModel**(`modelId`, `responses?`): `InMemoryLlmModel`

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:34](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L34)

#### Parameters

##### modelId

`string`

##### responses?

`Record`\<`string`, `string`\>

#### Returns

`InMemoryLlmModel`

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`constructor`](/api/llm-core/src/classes/llmmodel/#constructor)

## Properties

### capabilities

> `readonly` **capabilities**: [`LlmCapabilities`](/api/llm-core/src/type-aliases/llmcapabilities/)

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:24](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L24)

LLM 기능 플래그

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`capabilities`](/api/llm-core/src/classes/llmmodel/#capabilities)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L23)

모델 식별자

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`modelId`](/api/llm-core/src/classes/llmmodel/#modelid)

***

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

Defined in: [packages/llm-core/src/libs/LlmModel.ts:25](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/LlmModel.ts#L25)

#### Inherited from

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`token`](/api/llm-core/src/classes/llmmodel/#token)

## Methods

### callTool()

> **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:102](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L102)

툴 호출

#### Parameters

##### params

[`ToolCallParams`](/api/llm-core/src/type-aliases/toolcallparams/)

툴 호출 파라미터

#### Returns

`Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

툴 호출 결과

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`callTool`](/api/llm-core/src/classes/llmmodel/#calltool)

***

### embed()

> **embed**(`params`): `Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:151](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L151)

임베딩 생성 (단일 텍스트)

#### Parameters

##### params

[`EmbedParams`](/api/llm-core/src/type-aliases/embedparams/)

임베딩 파라미터

#### Returns

`Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

임베딩 결과

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`embed`](/api/llm-core/src/classes/llmmodel/#embed)

***

### embedMany()

> **embedMany**(`params`): `Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:165](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L165)

임베딩 생성 (배치)

#### Parameters

##### params

[`EmbedManyParams`](/api/llm-core/src/type-aliases/embedmanyparams/)

배치 임베딩 파라미터

#### Returns

`Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

배치 임베딩 결과

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`embedMany`](/api/llm-core/src/classes/llmmodel/#embedmany)

***

### generate()

> **generate**(`params`): `Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:44](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L44)

텍스트 생성

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

생성 파라미터

#### Returns

`Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

생성 결과

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`generate`](/api/llm-core/src/classes/llmmodel/#generate)

***

### generateObject()

> **generateObject**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:92](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L92)

객체 생성

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GenerateObjectParams`](/api/llm-core/src/type-aliases/generateobjectparams/)\<`T`\>

객체 생성 파라미터

#### Returns

`Promise`\<`T`\>

생성된 객체

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`generateObject`](/api/llm-core/src/classes/llmmodel/#generateobject)

***

### stream()

> **stream**(`params`): `AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:63](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/InMemoryLlmModel.ts#L63)

스트리밍 텍스트 생성

#### Parameters

##### params

[`StreamParams`](/api/llm-core/src/type-aliases/streamparams/)

스트리밍 파라미터

#### Returns

`AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>

스트리밍 청크 반복자

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`stream`](/api/llm-core/src/classes/llmmodel/#stream)
