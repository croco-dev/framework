---
editUrl: false
next: false
prev: false
title: "RateLimitGuard"
---

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:35](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L35)

Guard that enforces rate limiting on decorated methods.
Reads metadata from

## Rate Limit

decorator and checks against RateLimiter.

## Implements

- `Guard`\<[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)\>

## Constructors

### Constructor

> **new RateLimitGuard**(`rateLimiter`): `RateLimitGuard`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:36](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L36)

#### Parameters

##### rateLimiter

[`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

#### Returns

`RateLimitGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:38](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L38)

#### Parameters

##### context

[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
