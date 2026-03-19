---
editUrl: false
next: false
prev: false
title: "AuthRequest"
---

> **AuthRequest** = `Request` & `object`

Defined in: [packages/auth-core/src/libs/interfaces/AuthRequest.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/AuthRequest.ts#L4)

Request contract enriched by auth guards.

## Type Declaration

### apiKey?

> `optional` **apiKey**: [`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/)

### principal?

> `optional` **principal**: [`Principal`](/api/auth-core/src/type-aliases/principal/)

### user?

> `optional` **user**: [`AuthUser`](/api/auth-core/src/type-aliases/authuser/)
