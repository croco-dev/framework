---
editUrl: false
next: false
prev: false
title: "ClerkAuthDiagnosticsOptions"
---

> **ClerkAuthDiagnosticsOptions** = `object`

Clerk 인증 readiness diagnostics provider입니다.

## Properties

### readinessCheck?

> `readonly` `optional` **readinessCheck?**: (`context`) => `Promise`\<[`ClerkAuthReadinessCheckResult`](/api/auth-clerk/src/type-aliases/clerkauthreadinesscheckresult/) \| `void`\>

#### Parameters

##### context

[`ClerkAuthReadinessCheckContext`](/api/auth-clerk/src/type-aliases/clerkauthreadinesscheckcontext/)

#### Returns

`Promise`\<[`ClerkAuthReadinessCheckResult`](/api/auth-clerk/src/type-aliases/clerkauthreadinesscheckresult/) \| `void`\>
