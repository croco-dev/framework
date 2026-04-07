---
editUrl: false
next: false
prev: false
title: "RateLimitDecoratorOptions"
---

> **RateLimitDecoratorOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:17](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L17)

## Properties

### algorithm?

> `optional` **algorithm**: [`RateLimitAlgorithm`](/api/ratelimit-core/src/type-aliases/ratelimitalgorithm/)

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:21](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L21)

***

### key()?

> `optional` **key**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L22)

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### limit?

> `optional` **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L18)

***

### policy?

> `optional` **policy**: `string`

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:20](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L20)

***

### window?

> `optional` **window**: `string`

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L19)
