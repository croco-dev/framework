---
editUrl: false
next: false
prev: false
title: "RetryableOptions"
---

Defined in: [packages/retry-core/src/libs/Retryable.ts:34](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L34)

Options for

## Retryable

decorator.

## Extends

- [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/)

## Properties

### backoff?

> `optional` **backoff**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

Defined in: [packages/retry-core/src/libs/Retryable.ts:36](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L36)

Backoff configuration

***

### backoffPolicy?

> `optional` **backoffPolicy**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)\<`unknown`\>

Defined in: [packages/retry-core/src/libs/Retryable.ts:42](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L42)

Custom backoff policy

***

### circuitBreaker?

> `optional` **circuitBreaker**: [`CircuitBreakerConfig`](/api/retry-core/src/interfaces/circuitbreakerconfig/)

Defined in: [packages/retry-core/src/libs/Retryable.ts:57](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L57)

CircuitBreaker options

***

### circuitIdResolver()?

> `optional` **circuitIdResolver**: (`context`) => `string`

Defined in: [packages/retry-core/src/libs/Retryable.ts:60](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L60)

Custom circuit ID resolver

#### Parameters

##### context

[`CircuitIdResolverContext`](/api/retry-core/src/type-aliases/circuitidresolvercontext/)

#### Returns

`string`

***

### lambdaTimeoutReserveMs?

> `optional` **lambdaTimeoutReserveMs**: `number`

Defined in: [packages/retry-core/src/libs/Retryable.ts:63](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L63)

Reserve time for Lambda timeout (ms)

***

### listeners?

> `optional` **listeners**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

Defined in: [packages/retry-core/src/libs/Retryable.ts:54](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L54)

Custom retry listeners

***

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:31](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/RetryPolicy.ts#L31)

Maximum attempts (default: 3)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`maxAttempts`](/api/retry-core/src/interfaces/retrypolicyoptions/#maxattempts)

***

### noRetryFor?

> `optional` **noRetryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/RetryPolicy.ts#L25)

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

Defined in: [packages/retry-core/src/libs/Retryable.ts:48](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L48)

Recovery method name on the same class

***

### retryFor?

> `optional` **retryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/RetryPolicy.ts#L22)

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

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:28](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/RetryPolicy.ts#L28)

ProblemCategory values to retry (croco integration)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryForCategories`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryforcategories)

***

### retryPolicy?

> `optional` **retryPolicy**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

Defined in: [packages/retry-core/src/libs/Retryable.ts:39](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L39)

Custom retry policy

***

### trace?

> `optional` **trace**: `boolean`

Defined in: [packages/retry-core/src/libs/Retryable.ts:51](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L51)

Disable telemetry (default: true)

***

### wrapExhausted?

> `optional` **wrapExhausted**: `boolean`

Defined in: [packages/retry-core/src/libs/Retryable.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Retryable.ts#L45)

Wrap exhausted error instead of re-throwing last error
