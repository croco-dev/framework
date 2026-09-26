---
editUrl: false
next: false
prev: false
title: "RetryTemplateOptions"
---

Options for RetryTemplate.

## Extends

- [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/)

## Properties

### backoff?

> `optional` **backoff?**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

Backoff configuration

---

### backoffPolicy?

> `optional` **backoffPolicy?**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)\<`unknown`\>

Custom backoff policy (overrides backoff options)

---

### listeners?

> `optional` **listeners?**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

Retry listeners for lifecycle hooks

---

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Positive safe-integer maximum attempts (default: 3).

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`maxAttempts`](/api/retry-core/src/interfaces/retrypolicyoptions/#maxattempts)

---

### noRetryFor?

> `optional` **noRetryFor?**: (`message?`) => `Error`[]

Exception classes to never retry, even when the error declares `retryable: true`

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`noRetryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#noretryfor)

---

### retryFor?

> `optional` **retryFor?**: (`message?`) => `Error`[]

Exception classes to always retry. Other Problems follow `retryForCategories`, and other errors
retry only while this list is empty. `noRetryFor` and an explicit `retryable` flag on the error win.

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

ProblemCategory values to retry (croco integration); an explicit `retryable` flag on the error wins

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryForCategories`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryforcategories)

---

### retryPolicy?

> `optional` **retryPolicy?**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

Custom retry policy (overrides retryFor/noRetryFor)

---

### signal?

> `optional` **signal?**: `AbortSignal`

Caller cancellation signal

---

### wrapExhausted?

> `optional` **wrapExhausted?**: `boolean`

Wrap exhausted error instead of re-throwing last error
