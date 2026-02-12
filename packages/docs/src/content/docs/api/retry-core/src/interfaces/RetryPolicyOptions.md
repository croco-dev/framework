---
editUrl: false
next: false
prev: false
title: "RetryPolicyOptions"
---

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:20](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryPolicy.ts#L20)

Options for configuring retry behavior.

## Extended by

- [`RetryableOptions`](/api/retry-core/src/interfaces/retryableoptions/)
- [`RetryTemplateOptions`](/api/retry-core/src/interfaces/retrytemplateoptions/)

## Properties

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:31](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryPolicy.ts#L31)

Maximum attempts (default: 3)

***

### noRetryFor?

> `optional` **noRetryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:25](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryPolicy.ts#L25)

Exception classes to never retry

#### Parameters

##### message?

`string`

#### Returns

`Error`

***

### retryFor?

> `optional` **retryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:22](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryPolicy.ts#L22)

Exception classes to retry (empty = retry all except noRetryFor)

#### Parameters

##### message?

`string`

#### Returns

`Error`

***

### retryForCategories?

> `optional` **retryForCategories**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:28](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/retry-core/src/libs/RetryPolicy.ts#L28)

ProblemCategory values to retry (croco integration)
