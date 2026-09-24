---
editUrl: false
next: false
prev: false
title: "Transactional"
---

> **Transactional**\<`TReceiver`, `TOptions`\>(`resolveManager`, `options?`): `MethodDecorator`

메서드 실행에 트랜잭션 전파 규칙과 타임아웃을 적용하는 데코레이터입니다.

## Type Parameters

### TReceiver

`TReceiver`

### TOptions

`TOptions` = `unknown`

## Parameters

### resolveManager

(`receiver`) => [`TxManager`](/api/tx-core/src/classes/txmanager/)\<`unknown`, `TOptions`\>

### options?

[`TransactionalOptions`](/api/tx-core/src/interfaces/transactionaloptions/)\<`TOptions`\>

## Returns

`MethodDecorator`
