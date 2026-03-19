---
editUrl: false
next: false
prev: false
title: "RateLimitGuard"
---

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:39](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L39)

Guard that enforces rate limiting on decorated methods.
Reads metadata from

## Rate Limit

decorator and checks against RateLimiter.

## Implements

- `Guard`\<[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)\>

## Constructors

### Constructor

> **new RateLimitGuard**(`rateLimiter`): `RateLimitGuard`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:40](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L40)

#### Parameters

##### rateLimiter

[`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

#### Returns

`RateLimitGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:42](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L42)

#### Parameters

##### context

[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
