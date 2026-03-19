---
editUrl: false
next: false
prev: false
title: "AuthProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/AuthProvider.ts:3](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/AuthProvider.ts#L3)

Contract for resolving authenticated user identities.

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/AuthProvider.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/AuthProvider.ts#L4)

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>
