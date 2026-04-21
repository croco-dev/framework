---
editUrl: false
next: false
prev: false
title: "RetryOrchestrator"
---

Defined in: [packages/retry-core/src/libs/RetryOrchestrator.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryOrchestrator.ts#L20)

재시도 정책, 백오프, 리스너, 복구 로직을 묶어 실행하는 공용 오케스트레이터입니다.

## Constructors

### Constructor

> **new RetryOrchestrator**(): `RetryOrchestrator`

#### Returns

`RetryOrchestrator`

## Methods

### execute()

> `static` **execute**\<`T`\>(`methodName`, `args`, `callback`, `options`, `additionalHooks?`, `recovery?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryOrchestrator.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryOrchestrator.ts#L21)

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
