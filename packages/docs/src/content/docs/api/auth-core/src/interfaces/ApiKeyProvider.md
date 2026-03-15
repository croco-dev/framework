---
editUrl: false
next: false
prev: false
title: "ApiKeyProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts:3](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts#L3)

Contract for resolving API keys to principals.

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts:4](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts#L4)

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
