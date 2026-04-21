---
editUrl: false
next: false
prev: false
title: "Session"
---

> **Session** = `object`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:1](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L1)

세션 조회와 관리에 사용하는 타입과 공급자 계약입니다.

## Properties

### abandonedAt?

> `optional` **abandonedAt**: `Date`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L9)

***

### clientId

> **clientId**: `string`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L4)

***

### createdAt

> **createdAt**: `Date`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L6)

***

### expireAt?

> `optional` **expireAt**: `Date`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L8)

***

### id

> **id**: `string`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:2](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L2)

***

### lastActiveAt?

> `optional` **lastActiveAt**: `Date`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L10)

***

### status

> **status**: `"abandoned"` \| `"active"` \| `"pending"` \| `"ended"` \| `"expired"` \| `"removed"` \| `"replaced"` \| `"revoked"`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L5)

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L7)

***

### userId

> **userId**: `string`

Defined in: [packages/auth-core/src/libs/interfaces/SessionProvider.ts:3](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/SessionProvider.ts#L3)
