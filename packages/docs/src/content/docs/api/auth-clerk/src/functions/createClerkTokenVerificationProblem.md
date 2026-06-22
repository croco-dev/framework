---
editUrl: false
next: false
prev: false
title: "createClerkTokenVerificationProblem"
---

> **createClerkTokenVerificationProblem**(`error`, `operation?`): [`ClerkTokenVerificationProblem`](/api/auth-clerk/src/classes/clerktokenverificationproblem/) \| [`ClerkTokenVerificationUpstreamProblem`](/api/auth-clerk/src/classes/clerktokenverificationupstreamproblem/)

Clerk 토큰 검증 오류를 terminal 인증 실패와 retry 가능한 upstream 실패로 분류합니다.

## Parameters

### error

`unknown`

### operation?

[`ClerkTokenVerificationOperation`](/api/auth-clerk/src/type-aliases/clerktokenverificationoperation/) = `"verifyToken"`

## Returns

[`ClerkTokenVerificationProblem`](/api/auth-clerk/src/classes/clerktokenverificationproblem/) \| [`ClerkTokenVerificationUpstreamProblem`](/api/auth-clerk/src/classes/clerktokenverificationupstreamproblem/)
