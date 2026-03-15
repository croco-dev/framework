---
editUrl: false
next: false
prev: false
title: "RetryTemplateOptions"
---

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryTemplate.ts#L10)

Options for RetryTemplate.

## Extends

- [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/)

## Properties

### backoff?

> `optional` **backoff**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:12](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryTemplate.ts#L12)

Backoff configuration

***

### backoffPolicy?

> `optional` **backoffPolicy**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryTemplate.ts#L18)

Custom backoff policy (overrides backoff options)

***

### listeners?

> `optional` **listeners**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:24](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryTemplate.ts#L24)

Retry listeners for lifecycle hooks

***

### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:31](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryPolicy.ts#L31)

Maximum attempts (default: 3)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`maxAttempts`](/api/retry-core/src/interfaces/retrypolicyoptions/#maxattempts)

***

### noRetryFor?

> `optional` **noRetryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:25](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryPolicy.ts#L25)

Exception classes to never retry

#### Parameters

##### message?

`string`

#### Returns

`Error`

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`noRetryFor`](/api/retry-core/src/interfaces/retrypolicyoptions/#noretryfor)

***

### retryFor?

> `optional` **retryFor**: (`message?`) => `Error`[]

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:22](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryPolicy.ts#L22)

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

Defined in: [packages/retry-core/src/libs/RetryPolicy.ts:28](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryPolicy.ts#L28)

ProblemCategory values to retry (croco integration)

#### Inherited from

[`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/).[`retryForCategories`](/api/retry-core/src/interfaces/retrypolicyoptions/#retryforcategories)

***

### retryPolicy?

> `optional` **retryPolicy**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:15](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryTemplate.ts#L15)

Custom retry policy (overrides retryFor/noRetryFor)

***

### wrapExhausted?

> `optional` **wrapExhausted**: `boolean`

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:21](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryTemplate.ts#L21)

Wrap exhausted error instead of re-throwing last error
