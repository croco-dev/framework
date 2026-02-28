---
editUrl: false
next: false
prev: false
title: "ApiKeyProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts:3](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts#L3)

Contract for resolving API keys to principals.

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts#L4)

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
