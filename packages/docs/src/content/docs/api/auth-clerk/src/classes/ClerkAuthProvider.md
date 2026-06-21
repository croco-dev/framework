---
editUrl: false
next: false
prev: false
title: "ClerkAuthProvider"
---

Clerk Bearer 토큰을 검증해 Croco 사용자로 변환하는 인증 제공자입니다.

## Implements

- [`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)\<[`AuthorizationHeaderCarrier`](/api/auth-clerk/src/type-aliases/authorizationheadercarrier/)\>

## Constructors

### Constructor

> **new ClerkAuthProvider**(`options`): `ClerkAuthProvider`

#### Parameters

##### options

[`ClerkAuthOptions`](/api/auth-clerk/src/type-aliases/clerkauthoptions/)

#### Returns

`ClerkAuthProvider`

## Methods

### authenticate()

> **authenticate**(`request`): `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>

#### Parameters

##### request

[`AuthorizationHeaderCarrier`](/api/auth-clerk/src/type-aliases/authorizationheadercarrier/)

#### Returns

`Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\>

#### Implementation of

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/).[`authenticate`](/api/auth-core/src/interfaces/authprovider/#authenticate)
