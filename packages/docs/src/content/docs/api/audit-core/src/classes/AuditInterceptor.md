---
editUrl: false
next: false
prev: false
title: "AuditInterceptor"
---

HTTP 요청 흐름을 감사 로그로 기록하는 인터셉터입니다.

## Implements

- [`Interceptor`](/api/audit-core/src/interfaces/interceptor/)\<[`AuditExecutionContext`](/api/audit-core/src/type-aliases/auditexecutioncontext/)\>

## Constructors

### Constructor

> **new AuditInterceptor**(`repository`): `AuditInterceptor`

#### Parameters

##### repository

[`AuditLogRepository`](/api/audit-core/src/classes/auditlogrepository/)

#### Returns

`AuditInterceptor`

## Methods

### intercept()

> **intercept**(`context`, `next`): `Promise`\<`unknown`\>

#### Parameters

##### context

[`AuditExecutionContext`](/api/audit-core/src/type-aliases/auditexecutioncontext/)

##### next

[`CallHandler`](/api/audit-core/src/interfaces/callhandler/)

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`Interceptor`](/api/audit-core/src/interfaces/interceptor/).[`intercept`](/api/audit-core/src/interfaces/interceptor/#intercept)
