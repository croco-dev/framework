---
editUrl: false
next: false
prev: false
title: "createTransactionalEventDiagnostic"
---

> **createTransactionalEventDiagnostic**(`code`, `message`, `at`, `details?`): [`TransactionalEventDiagnostic`](/api/events-tx/src/type-aliases/transactionaleventdiagnostic/)

Outbox append, relay, inbox idempotency를 제공하는 런타임 서비스입니다.

## Parameters

### code

`string`

### message

`string`

### at

`Date`

### details?

`Record`\<`string`, `unknown`\>

## Returns

[`TransactionalEventDiagnostic`](/api/events-tx/src/type-aliases/transactionaleventdiagnostic/)
