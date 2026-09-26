---
editUrl: false
next: false
prev: false
title: "RetryPolicyOptions"
---

Options for configuring retry behavior.

## Extended by

- [`RetryableOptions`](/api/retry-core/src/interfaces/retryableoptions/)
- [`RetryTemplateOptions`](/api/retry-core/src/interfaces/retrytemplateoptions/)

## Properties

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Positive safe-integer maximum attempts (default: 3).

---

### noRetryFor?

> `optional` **noRetryFor?**: (`message?`) => `Error`[]

Exception classes to never retry, even when the error declares `retryable: true`

#### Parameters

##### message?

`string`

#### Returns

`Error`

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

---

### retryForCategories?

> `optional` **retryForCategories?**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)[]

ProblemCategory values to retry (croco integration); an explicit `retryable` flag on the error wins
