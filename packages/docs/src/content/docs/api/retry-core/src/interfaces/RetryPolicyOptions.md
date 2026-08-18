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

***

### noRetryFor?

> `optional` **noRetryFor?**: (`message?`) => `Error`[]

Exception classes to never retry

#### Parameters

##### message?

`string`

#### Returns

`Error`

***

### retryFor?

> `optional` **retryFor?**: (`message?`) => `Error`[]

Exception classes to retry (empty = retry all except noRetryFor)

#### Parameters

##### message?

`string`

#### Returns

`Error`

***

### retryForCategories?

> `optional` **retryForCategories?**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)[]

ProblemCategory values to retry (croco integration)
