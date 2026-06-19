---
editUrl: false
next: false
prev: false
title: "LlmModel"
---

LLM 모델 추상 클래스

## Description

특정 LLM 제공자(OpenAI, Anthropic 등)의 구현을 위한 추상화 계층입니다.
Token 기반 DI를 지원하며, 모든 구현체는 이 abstract class를 상속받아야 합니다.

## Extended by

- [`InMemoryLlmModel`](/api/llm-core/src/classes/inmemoryllmmodel/)
- [`OpenAiLlmModel`](/api/llm-openai/src/classes/openaillmmodel/)

## Constructors

### Constructor

> **new LlmModel**(): `LlmModel`

#### Returns

`LlmModel`

## Properties

### capabilities

> `abstract` `readonly` **capabilities**: [`LlmCapabilities`](/api/llm-core/src/type-aliases/llmcapabilities/)

LLM 기능 플래그

***

### modelId

> `abstract` `readonly` **modelId**: `string`

모델 식별자

***

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`LlmModel`\>

## Methods

### callTool()

> `abstract` **callTool**(`params`): `Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

툴 호출

#### Parameters

##### params

[`ToolCallParams`](/api/llm-core/src/type-aliases/toolcallparams/)

툴 호출 파라미터

#### Returns

`Promise`\<[`ToolCallResult`](/api/llm-core/src/type-aliases/toolcallresult/)\>

툴 호출 결과

***

### embed()

> `abstract` **embed**(`params`): `Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

임베딩 생성 (단일 텍스트)

#### Parameters

##### params

[`EmbedParams`](/api/llm-core/src/type-aliases/embedparams/)

임베딩 파라미터

#### Returns

`Promise`\<[`EmbedResult`](/api/llm-core/src/type-aliases/embedresult/)\>

임베딩 결과

***

### embedMany()

> `abstract` **embedMany**(`params`): `Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

임베딩 생성 (배치)

#### Parameters

##### params

[`EmbedManyParams`](/api/llm-core/src/type-aliases/embedmanyparams/)

배치 임베딩 파라미터

#### Returns

`Promise`\<[`EmbedManyResult`](/api/llm-core/src/type-aliases/embedmanyresult/)\>

배치 임베딩 결과

***

### generate()

> `abstract` **generate**(`params`): `Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

텍스트 생성

#### Parameters

##### params

[`GenerateParams`](/api/llm-core/src/type-aliases/generateparams/)

생성 파라미터

#### Returns

`Promise`\<[`GenerateResult`](/api/llm-core/src/type-aliases/generateresult/)\>

생성 결과

***

### generateObject()

> `abstract` **generateObject**\<`T`\>(`params`): `Promise`\<`T`\>

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

***

### stream()

> `abstract` **stream**(`params`): `AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>

스트리밍 텍스트 생성

#### Parameters

##### params

[`StreamParams`](/api/llm-core/src/type-aliases/streamparams/)

스트리밍 파라미터

#### Returns

`AsyncIterable`\<[`StreamChunk`](/api/llm-core/src/type-aliases/streamchunk/)\>

스트리밍 청크 반복자
