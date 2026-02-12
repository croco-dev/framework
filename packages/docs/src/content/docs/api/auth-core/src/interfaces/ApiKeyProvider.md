---
editUrl: false
next: false
prev: false
title: "ApiKeyProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts:3](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts#L3)

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts:4](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/interfaces/ApiKeyProvider.ts#L4)

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
