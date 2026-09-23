---
editUrl: false
next: false
prev: false
title: "DrizzleTransactionCapability"
---

지정한 클라이언트와 옵션으로 트랜잭션을 실행하는 최소 Drizzle capability입니다.

## Extended by

- [`DrizzleDb`](/api/tx-drizzle/src/interfaces/drizzledb/)
- [`DrizzleTx`](/api/tx-drizzle/src/interfaces/drizzletx/)

## Type Parameters

### TClient

`TClient` = `unknown`

### TOptions

`TOptions` = `never`

## Properties

### transaction

> **transaction**: `TransactionFn`\<`TClient`, `TOptions`\>
