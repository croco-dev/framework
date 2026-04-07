---
editUrl: false
next: false
prev: false
title: "RateLimitKeyBuilder"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L9)

## Constructors

### Constructor

> **new RateLimitKeyBuilder**(`segments`): `RateLimitKeyBuilder`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L12)

#### Parameters

##### segments

[`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

#### Returns

`RateLimitKeyBuilder`

## Methods

### build()

> **build**(`context`, `policyName`): `string`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L19)

#### Parameters

##### context

[`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/)

##### policyName

`string`

#### Returns

`string`
