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

> `optional` **backoff**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

Backoff configuration

---

### backoffPolicy?

> `optional` **backoffPolicy**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

Custom backoff policy (overrides backoff options)

---

### listeners?

> `optional` **listeners**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

Retry listeners for lifecycle hooks

---

### maxAttempts?

> `optional` **maxAttempts**: `number`

Maximum attempts (default: 3)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`maxAttempts`](/api/retry-core/src/interfaces/retrypolicyoptions/#maxattempts)

---

### noRetryFor?

> `optional` **noRetryFor**: (`message?`) => `Error`[]

Exception classes to never retry

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`noRetryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#noretryfor)

---

### retryFor?

> `optional` **retryFor**: (`message?`) => `Error`[]

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

> `optional` **retryForCategories**: `ProblemCategory`[]

ProblemCategory values to retry (croco integration)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryForCategories`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryforcategories)

---

### retryPolicy?

> `optional` **retryPolicy**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

Custom retry policy (overrides retryFor/noRetryFor)

---

### wrapExhausted?

> `optional` **wrapExhausted**: `boolean`

Wrap exhausted error instead of re-throwing last error
