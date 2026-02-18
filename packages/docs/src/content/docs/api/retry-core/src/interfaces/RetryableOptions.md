---
editUrl: false
next: false
prev: false
title: "RetryableOptions"
---

Defined in: [packages/retry-core/src/libs/Retryable.ts:11](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/Retryable.ts#L11)

Options for

## Retryable

decorator.

## Extends

- [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/)

## Properties

### backoff?

> `optional` **backoff**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

Defined in: [packages/retry-core/src/libs/Retryable.ts:13](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/Retryable.ts#L13)

Backoff configuration

***

### backoffPolicy?

> `optional` **backoffPolicy**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

Defined in: [packages/retry-core/src/libs/Retryable.ts:19](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/Retryable.ts#L19)

Custom backoff policy

***

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:31](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/RetryPolicy.ts#L31)

Maximum attempts (default: 3)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`maxAttempts`](/api/retry-core/src/interfaces/retrypolicyoptions/#maxattempts)

***

### noRetryFor?

> `optional` **noRetryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:25](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/RetryPolicy.ts#L25)

Exception classes to never retry

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`noRetryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#noretryfor)

***

### recover?

> `optional` **recover**: `string`

Defined in: [packages/retry-core/src/libs/Retryable.ts:25](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/Retryable.ts#L25)

Recovery method name on the same class

***

### retryFor?

> `optional` **retryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:22](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/RetryPolicy.ts#L22)

Exception classes to retry (empty = retry all except noRetryFor)

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryfor)

***

### retryForCategories?

> `optional` **retryForCategories**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:28](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/RetryPolicy.ts#L28)

ProblemCategory values to retry (croco integration)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryForCategories`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryforcategories)

***

### retryPolicy?

> `optional` **retryPolicy**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

Defined in: [packages/retry-core/src/libs/Retryable.ts:16](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/Retryable.ts#L16)

Custom retry policy

***

### wrapExhausted?

> `optional` **wrapExhausted**: `boolean`

Defined in: [packages/retry-core/src/libs/Retryable.ts:22](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/retry-core/src/libs/Retryable.ts#L22)

Wrap exhausted error instead of re-throwing last error
