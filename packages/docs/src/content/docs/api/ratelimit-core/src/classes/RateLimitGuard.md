---
editUrl: false
next: false
prev: false
title: "RateLimitGuard"
---

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:39](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L39)

Guard that enforces rate limiting on decorated methods.
Reads metadata from

## Rate Limit

decorator and checks against RateLimiter.

## Implements

- `Guard`\<[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)\>

## Constructors

### Constructor

> **new RateLimitGuard**(`rateLimiter`): `RateLimitGuard`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:40](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L40)

#### Parameters

##### rateLimiter

[`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

#### Returns

`RateLimitGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:42](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L42)

#### Parameters

##### context

[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
