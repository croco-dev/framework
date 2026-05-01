---
editUrl: false
next: false
prev: false
title: "RetryOrchestrator"
---

재시도 정책, 백오프, 리스너, 복구 로직을 묶어 실행하는 공용 오케스트레이터입니다.

## Constructors

### Constructor

> **new RetryOrchestrator**(): `RetryOrchestrator`

#### Returns

`RetryOrchestrator`

## Methods

### execute()

> `static` **execute**\<`T`\>(`methodName`, `args`, `callback`, `options`, `additionalHooks?`, `recovery?`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### methodName

`string`

##### args

`unknown`[]

##### callback

() => `Promise`\<`T`\>

##### options

[`RetryOrchestratorOptions`](/api/retry-core/src/type-aliases/retryorchestratoroptions/)

##### additionalHooks?

###### beforeWait?

(`delay`, `ctx`) => `boolean` \| `Promise`\<`boolean`\>

###### onExhausted?

(`err`, `ctx`) => `void` \| `Promise`\<`void`\>

###### onRetryError?

(`err`, `ctx`) => `void` \| `Promise`\<`void`\>

###### onStart?

(`ctx`) => `boolean` \| `Promise`\<`boolean`\>

###### onSuccess?

(`ctx`) => `void` \| `Promise`\<`void`\>

##### recovery?

(`context`) => `T` \| `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
