---
editUrl: false
next: false
prev: false
title: "AuthRequest"
---

> **AuthRequest** = `Request` & `object`

Defined in: [packages/auth-core/src/libs/interfaces/AuthRequest.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/AuthRequest.ts#L4)

인증 가드가 확장하는 요청 타입입니다.

## Type Declaration

### apiKey?

> `optional` **apiKey**: [`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/)

### principal?

> `optional` **principal**: [`Principal`](/api/auth-core/src/type-aliases/principal/)

### user?

> `optional` **user**: [`AuthUser`](/api/auth-core/src/type-aliases/authuser/)
