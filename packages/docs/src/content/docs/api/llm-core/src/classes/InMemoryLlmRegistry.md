---
editUrl: false
next: false
prev: false
title: "InMemoryLlmRegistry"
---

Defined in: [packages/llm-core/src/libs/InMemoryLlmRegistry.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/llm-core/src/libs/InMemoryLlmRegistry.ts#L5)

LLM 레지스트리 추상 클래스

## Description

LLM 모델의 등록, 조회를 위한 추상화 계층입니다.
Token 기반 DI를 지원하며, 다중 제공자 관리를 지원합니다.

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

Defined in: [packages/llm-core/src/libs/LlmRegistry.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/llm-core/src/libs/LlmRegistry.ts#L12)

#### Inherited from

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`token`](/api/llm-core/src/classes/llmregistry/#token)

## Methods

### getModel()

> **getModel**(`modelId`): `Promise`\<[`LlmModel`](/api/llm-core/src/classes/llmmodel/)\>

Defined in: [packages/llm-core/src/libs/InMemoryLlmRegistry.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/llm-core/src/libs/InMemoryLlmRegistry.ts#L9)

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

Defined in: [packages/llm-core/src/libs/InMemoryLlmRegistry.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/llm-core/src/libs/InMemoryLlmRegistry.ts#L25)

사용 가능한 모델 목록 조회

#### Returns

`Promise`\<`string`[]\>

모델 ID 목록

#### Overrides

[`LlmRegistry`](/api/llm-core/src/classes/llmregistry/).[`listModels`](/api/llm-core/src/classes/llmregistry/#listmodels)

***

### registerProvider()

> **registerProvider**(`providerId`, `factory`): `void`

Defined in: [packages/llm-core/src/libs/InMemoryLlmRegistry.ts:29](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/llm-core/src/libs/InMemoryLlmRegistry.ts#L29)

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
