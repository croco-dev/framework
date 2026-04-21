---
editUrl: false
next: false
prev: false
title: "AuthProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/AuthProvider.ts:3](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/AuthProvider.ts#L3)

사용자 인증 정보를 조회하는 공급자 계약입니다.

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/AuthProvider.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/AuthProvider.ts#L4)

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>
