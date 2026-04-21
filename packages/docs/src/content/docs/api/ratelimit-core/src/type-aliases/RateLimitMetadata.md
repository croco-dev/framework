---
editUrl: false
next: false
prev: false
title: "RateLimitMetadata"
---

> **RateLimitMetadata** = `object`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L9)

라우트 실행 시 레이트 리밋을 검사하는 가드와 메타데이터 타입입니다.

## Properties

### customKey()?

> `optional` **customKey**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L11)

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L10)
