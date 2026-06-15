---
editUrl: false
next: false
prev: false
title: "fireAndForgetWithRetry"
---

> **fireAndForgetWithRetry**\<`T`\>(`operation`, `config?`): `FireAndForgetResult`\<`T`\>

감사 로그 쓰기 실패 시 재시도하는 에러 핸들러와 헬퍼입니다.

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`\<`T`\>

### config?

`Partial`\<`AuditErrorHandlerConfig`\>

## Returns

`FireAndForgetResult`\<`T`\>
