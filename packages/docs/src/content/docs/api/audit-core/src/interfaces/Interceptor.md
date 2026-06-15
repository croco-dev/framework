---
editUrl: false
next: false
prev: false
title: "Interceptor"
---

감사 인터셉터 실행 컨텍스트와 인터셉터 타입입니다.

## Type Parameters

### TContext

`TContext` = `unknown`

### THandler

`THandler` = [`CallHandler`](/api/audit-core/src/interfaces/callhandler/)

## Methods

### intercept()

> **intercept**(`context`, `next`): `Promise`\<`unknown`\>

#### Parameters

##### context

`TContext`

##### next

`THandler`

#### Returns

`Promise`\<`unknown`\>
