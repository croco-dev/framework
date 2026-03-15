---
editUrl: false
next: false
prev: false
title: "RateLimitDecoratorOptions"
---

> **RateLimitDecoratorOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:50](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L50)

Options for

## Rate Limit

decorator

## Properties

### key()?

> `optional` **key**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:58](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L58)

Custom key resolver function

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### limit?

> `optional` **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:52](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L52)

Maximum requests allowed (overrides policy)

***

### policy?

> `optional` **policy**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:56](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L56)

Pre-defined policy name to use

***

### window?

> `optional` **window**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:54](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L54)

Time window string ('1m', '1h', '1d')
