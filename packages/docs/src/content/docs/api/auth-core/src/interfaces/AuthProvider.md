---
editUrl: false
next: false
prev: false
title: "AuthProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/AuthProvider.ts:3](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/interfaces/AuthProvider.ts#L3)

Contract for resolving authenticated user identities.

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/AuthProvider.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/interfaces/AuthProvider.ts#L4)

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>
