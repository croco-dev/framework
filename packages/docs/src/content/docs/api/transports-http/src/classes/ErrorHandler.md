---
editUrl: false
next: false
prev: false
title: "ErrorHandler"
---

HTTP 애플리케이션 구성과 라우트 실행에 사용하는 핵심 공개 API입니다.

## Constructors

### Constructor

> **new ErrorHandler**(`logger`): `ErrorHandler`

#### Parameters

##### logger

`Logger`

#### Returns

`ErrorHandler`

## Methods

### handleError()

> **handleError**(`error`, `ctx`): `Response`

#### Parameters

##### error

`unknown`

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Response`
