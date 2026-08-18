---
editUrl: false
next: false
prev: false
title: "GracefulShutdownController"
---

> **GracefulShutdownController** = `object`

graceful shutdown 상태를 관리하는 미들웨어와 제어 함수입니다.

## Properties

### getActiveRequestCount

> **getActiveRequestCount**: () => `number`

#### Returns

`number`

***

### isShuttingDown

> **isShuttingDown**: () => `boolean`

#### Returns

`boolean`

***

### middleware

> **middleware**: [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

***

### reset

> **reset**: () => `void`

#### Returns

`void`

***

### shutdown

> **shutdown**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
