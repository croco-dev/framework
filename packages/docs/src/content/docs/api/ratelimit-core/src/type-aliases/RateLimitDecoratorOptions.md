---
editUrl: false
next: false
prev: false
title: "RateLimitDecoratorOptions"
---

> **RateLimitDecoratorOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:49](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/ratelimit-core/src/libs/types.ts#L49)

Options for

## Rate Limit

decorator

## Properties

### key()?

> `optional` **key**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:57](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/ratelimit-core/src/libs/types.ts#L57)

Custom key resolver function

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### limit?

> `optional` **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:51](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/ratelimit-core/src/libs/types.ts#L51)

Maximum requests allowed (overrides policy)

***

### policy?

> `optional` **policy**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:55](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/ratelimit-core/src/libs/types.ts#L55)

Pre-defined policy name to use

***

### window?

> `optional` **window**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:53](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/ratelimit-core/src/libs/types.ts#L53)

Time window string ('1m', '1h', '1d')
