---
editUrl: false
next: false
prev: false
title: "RateLimitGuard"
---

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L19)

## Constructors

### Constructor

> **new RateLimitGuard**(`rateLimiter`): `RateLimitGuard`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:20](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L20)

#### Parameters

##### rateLimiter

[`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

#### Returns

`RateLimitGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L22)

#### Parameters

##### context

[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)

#### Returns

`Promise`\<`boolean`\>
