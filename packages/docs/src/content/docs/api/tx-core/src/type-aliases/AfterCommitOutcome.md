---
editUrl: false
next: false
prev: false
title: "AfterCommitOutcome"
---

> **AfterCommitOutcome** = \{ `hookCount`: `number`; `status`: `"succeeded"`; \} \| \{ `failures`: readonly [`AfterCommitFailure`](/api/tx-core/src/type-aliases/aftercommitfailure/)[]; `hookCount`: `number`; `problem`: [`AfterCommitHooksProblem`](/api/tx-core/src/classes/aftercommithooksproblem/); `status`: `"failed"`; \}

트랜잭션 훅과 실행 옵션, 전파 규칙을 설명하는 공개 타입 모음입니다.
