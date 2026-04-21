---
editUrl: false
next: false
prev: false
title: "RouteExecutionContext"
---

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/Guard.ts#L6)

라우트 가드 실행 컨텍스트 타입입니다.

## Methods

### getClass()

> **getClass**(): `object`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/Guard.ts#L7)

#### Returns

`object`

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/Guard.ts#L8)

#### Returns

`string` \| `symbol`

***

### getRequest()

> **getRequest**(): [`AuthRequest`](/api/auth-core/src/type-aliases/authrequest/)

Defined in: [packages/auth-core/src/libs/interfaces/Guard.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/Guard.ts#L9)

#### Returns

[`AuthRequest`](/api/auth-core/src/type-aliases/authrequest/)
