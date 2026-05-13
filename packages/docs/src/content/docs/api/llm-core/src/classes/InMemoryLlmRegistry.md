---
editUrl: false
next: false
prev: false
title: "InMemoryLlmRegistry"
---

테스트용 인메모리 레지스트리 구현체입니다.

## Extends

- [`LlmRegistry`](/api/llm-core/src/classes/llmregistry/)

## Constructors

### Constructor

> **new InMemoryLlmRegistry**(): `InMemoryLlmRegistry`

#### Returns

`InMemoryLlmRegistry`

#### Inherited from

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`constructor`](/api/llm-core/src/classes/llmregistry/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/)\>

#### Inherited from

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`token`](/api/llm-core/src/classes/llmregistry/#token)

## Methods

### getModel()

> **getModel**(`modelId`): `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

모델 조회

#### Parameters

##### modelId

`string`

모델 식별자

#### Returns

`Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

LLM 모델 인스턴스

#### Overrides

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`getModel`](/api/llm-core/src/classes/llmregistry/#getmodel)

***

### listModels()

> **listModels**(): `Promise`\<`string`[]\>

사용 가능한 모델 목록 조회

#### Returns

`Promise`\<`string`[]\>

모델 ID 목록

#### Overrides

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`listModels`](/api/llm-core/src/classes/llmregistry/#listmodels)

***

### registerProvider()

> **registerProvider**(`providerId`, `factory`): `void`

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

#### Overrides

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`registerProvider`](/api/llm-core/src/classes/llmregistry/#registerprovider)
