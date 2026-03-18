---
editUrl: false
next: false
prev: false
title: "RetryOrchestrator"
---

Defined in: [packages/retry-core/src/libs/RetryOrchestrator.ts:17](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/RetryOrchestrator.ts#L17)

Shared orchestrator that wires policies, backoff, listeners, and recovery handling.

## Constructors

### Constructor

> **new RetryOrchestrator**(): `RetryOrchestrator`

#### Returns

`RetryOrchestrator`

## Methods

### execute()

> `static` **execute**\<`T`\>(`methodName`, `args`, `callback`, `options`, `additionalHooks?`, `recovery?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryOrchestrator.ts:18](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/RetryOrchestrator.ts#L18)

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
