---
editUrl: false
next: false
prev: false
title: "LlmRegistry"
---

Defined in: [packages/llm-core/src/libs/LlmRegistry.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/LlmRegistry.ts#L11)

LLM 레지스트리 추상 클래스

## Description

LLM 모델의 등록, 조회를 위한 추상화 계층입니다.
Token 기반 DI를 지원하며, 다중 제공자 관리를 지원합니다.

## Extended by

- [`InMemoryLlmRegistry`](/api/llm-core/src/classes/inmemoryllmregistry/)

## Constructors

### Constructor

> **new LlmRegistry**(): `LlmRegistry`

#### Returns

`LlmRegistry`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`LlmRegistry`\>

Defined in: [packages/llm-core/src/libs/LlmRegistry.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/LlmRegistry.ts#L12)

## Methods

### getModel()

> `abstract` **getModel**(`modelId`): `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

Defined in: [packages/llm-core/src/libs/LlmRegistry.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/LlmRegistry.ts#L20)

모델 조회

#### Parameters

##### modelId

`string`

모델 식별자

#### Returns

`Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

LLM 모델 인스턴스

***

### listModels()

> `abstract` **listModels**(): `Promise`\<`string`[]\>

Defined in: [packages/llm-core/src/libs/LlmRegistry.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/LlmRegistry.ts#L27)

사용 가능한 모델 목록 조회

#### Returns

`Promise`\<`string`[]\>

모델 ID 목록

***

### registerProvider()

> `abstract` **registerProvider**(`providerId`, `factory`): `void`

Defined in: [packages/llm-core/src/libs/LlmRegistry.ts:35](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/LlmRegistry.ts#L35)

제공자 등록

#### Parameters

##### providerId

`string`

제공자 식별자

##### factory

() => [`LlmModel`](/api/llm-core/src/classes/llmmodel/)

모델 생성 팩토리 함수

#### Returns

`void`
