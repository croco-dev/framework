---
editUrl: false
next: false
prev: false
title: "RetryableOptions"
---

Options for

## Retryable

decorator.

## Extends

- [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/)

## Properties

### backoff?

> `optional` **backoff?**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

Backoff configuration

---

### backoffPolicy?

> `optional` **backoffPolicy?**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)\<`unknown`\>

Custom backoff policy. When provided, it overrides and bypasses validation of `backoff`.

---

### circuitBreaker?

> `optional` **circuitBreaker?**: [`CircuitBreakerConfig`](/api/retry-core/src/interfaces/circuitbreakerconfig/)

CircuitBreaker options

---

### circuitIdResolver?

> `optional` **circuitIdResolver?**: (`context`) => `string`

Custom circuit ID resolver

#### Parameters

##### context

[`CircuitIdResolverContext`](/api/retry-core/src/type-aliases/circuitidresolvercontext/)

#### Returns

`string`

---

### lambdaTimeoutReserveMs?

> `optional` **lambdaTimeoutReserveMs?**: `number`

Non-negative integer Lambda reserve time up to 2,147,483,647ms.

---

### listeners?

> `optional` **listeners?**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

Custom retry listeners

---

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Positive safe-integer maximum attempts (default: 3).

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`maxAttempts`](/api/retry-core/src/interfaces/retrypolicyoptions/#maxattempts)

---

### noRetryFor?

> `optional` **noRetryFor?**: (`message?`) => `Error`[]

Exception classes to never retry

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`noRetryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#noretryfor)

---

### recover?

> `optional` **recover?**: `string`

Recovery method name on the same class

---

### retryFor?

> `optional` **retryFor?**: (`message?`) => `Error`[]

Exception classes to retry (empty = retry all except noRetryFor)

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryfor)

---

### retryForCategories?

> `optional` **retryForCategories?**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)[]

ProblemCategory values to retry (croco integration)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryForCategories`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryforcategories)

---

### retryPolicy?

> `optional` **retryPolicy?**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

Custom retry policy

---

### signal?

> `optional` **signal?**: `AbortSignal`

Caller cancellation signal

---

### signalResolver?

> `optional` **signalResolver?**: (`context`) => `AbortSignal` \| `undefined`

Resolve a caller cancellation signal for each invocation

#### Parameters

##### context

[`RetrySignalResolverContext`](/api/retry-core/src/type-aliases/retrysignalresolvercontext/)

#### Returns

`AbortSignal` \| `undefined`

---

### trace?

> `optional` **trace?**: `boolean`

Disable telemetry (default: true)

---

### wrapExhausted?

> `optional` **wrapExhausted?**: `boolean`

Wrap exhausted error instead of re-throwing last error
