---
editUrl: false
next: false
prev: false
title: "LoggingInterceptor"
---

요청 처리 시간과 경로 정보를 로깅하는 기본 Interceptor입니다.

## Implements

- [`Interceptor`](/api/protocols-rest/src/interfaces/interceptor/)\<[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)\>

## Constructors

### Constructor

> **new LoggingInterceptor**(`logger`): `LoggingInterceptor`

#### Parameters

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`LoggingInterceptor`

## Methods

### intercept()

> **intercept**(`context`, `next`): `Promise`\<`unknown`\>

#### Parameters

##### context

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)

##### next

[`CallHandler`](/api/protocols-rest/src/interfaces/callhandler/)

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`Interceptor`](/api/protocols-rest/src/interfaces/interceptor/).[`intercept`](/api/protocols-rest/src/interfaces/interceptor/#intercept)
