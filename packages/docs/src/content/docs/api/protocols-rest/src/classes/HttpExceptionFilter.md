---
editUrl: false
next: false
prev: false
title: "HttpExceptionFilter"
---

예외를 Problem Details 형식의 HTTP 응답으로 변환하는 기본 필터입니다.

## Implements

- [`ExceptionFilter`](/api/protocols-rest/src/interfaces/exceptionfilter/)\<`unknown`, [`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)\>

## Constructors

### Constructor

> **new HttpExceptionFilter**(): `HttpExceptionFilter`

#### Returns

`HttpExceptionFilter`

## Methods

### catch()

> **catch**(`exception`, `_context`): [`HttpExceptionFilterResponse`](/api/protocols-rest/src/type-aliases/httpexceptionfilterresponse/)

#### Parameters

##### exception

`unknown`

##### \_context

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)

#### Returns

[`HttpExceptionFilterResponse`](/api/protocols-rest/src/type-aliases/httpexceptionfilterresponse/)

#### Implementation of

[`ExceptionFilter`](/api/protocols-rest/src/interfaces/exceptionfilter/).[`catch`](/api/protocols-rest/src/interfaces/exceptionfilter/#catch)
