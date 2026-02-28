---
editUrl: false
next: false
prev: false
title: "InMemoryLlmModel"
---

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:18](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L18)

LLM 모델 추상 클래스

## Description

특정 LLM 제공자(OpenAI, Anthropic 등)의 구현을 위한 추상화 계층입니다.
Token 기반 DI를 지원하며, 모든 구현체는 이 abstract class를 상속받아야 합니다.

## Extends

- [`LlmModel`](/api/llm-core/src/classes/llmmodel/)

## Constructors

### Constructor

> **new InMemoryLlmModel**(`modelId`, `responses?`): `InMemoryLlmModel`

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:30](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L30)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:20](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L20)

LLM 기능 플래그

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`capabilities`](/api/llm-core/src/classes/llmmodel/#capabilities)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:19](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L19)

모델 식별자

#### Overrides

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`modelId`](/api/llm-core/src/classes/llmmodel/#modelid)

***

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

Defined in: [packages/llm-core/src/libs/LlmModel.ts:25](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/LlmModel.ts#L25)

#### Inherited from

[`LlmModel`](/api/llm-core/src/classes/llmmodel/).[`token`](/api/llm-core/src/classes/llmmodel/#token)

## Methods

### callTool()

> **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:98](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L98)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:144](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L144)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:163](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L163)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:40](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L40)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:88](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L88)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmModel.ts:59](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/InMemoryLlmModel.ts#L59)

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
