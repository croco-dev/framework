---
editUrl: false
next: false
prev: false
title: "ApiKeyProvider"
---

API 키를 인증 주체로 해석하는 공급자 계약입니다.

## Type Parameters

### TRequest

`TRequest` = `unknown`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

#### Parameters

##### request

`TRequest`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
