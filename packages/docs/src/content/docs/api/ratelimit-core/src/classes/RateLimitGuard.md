---
editUrl: false
next: false
prev: false
title: "RateLimitGuard"
---

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L19)

라우트 실행 시 레이트 리밋을 검사하는 가드와 메타데이터 타입입니다.

## Constructors

### Constructor

> **new RateLimitGuard**(`rateLimiter`): `RateLimitGuard`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L20)

#### Parameters

##### rateLimiter

[`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

#### Returns

`RateLimitGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L22)

#### Parameters

##### context

[`GuardContext`](/api/ratelimit-core/src/type-aliases/guardcontext/)

#### Returns

`Promise`\<`boolean`\>
