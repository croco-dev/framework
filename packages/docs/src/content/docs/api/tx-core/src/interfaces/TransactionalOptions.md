---
editUrl: false
next: false
prev: false
title: "TransactionalOptions"
---

트랜잭션 훅과 실행 옵션, 전파 규칙을 설명하는 공개 타입 모음입니다.

## Type Parameters

### TOptions

`TOptions` = `unknown`

## Properties

### managerKey?

> `optional` **managerKey?**: [`TxManagerKey`](/api/tx-core/src/type-aliases/txmanagerkey/)

***

### nesting?

> `optional` **nesting?**: [`NestingStrategy`](/api/tx-core/src/type-aliases/nestingstrategy/)

***

### options?

> `optional` **options?**: `TOptions`

***

### propagation?

> `optional` **propagation?**: [`Propagation`](/api/tx-core/src/type-aliases/propagation/)

***

### timeout?

> `optional` **timeout?**: `number`

Positive integer milliseconds up to 2,147,483,647. Omit for no timeout.
