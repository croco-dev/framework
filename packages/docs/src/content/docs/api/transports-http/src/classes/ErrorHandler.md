---
editUrl: false
next: false
prev: false
title: "ErrorHandler"
---

Defined in: [packages/transports-http/src/libs/ErrorHandler.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/ErrorHandler.ts#L10)

HTTP 애플리케이션 구성과 라우트 실행에 사용하는 핵심 공개 API입니다.

## Constructors

### Constructor

> **new ErrorHandler**(`logger`): `ErrorHandler`

Defined in: [packages/transports-http/src/libs/ErrorHandler.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/ErrorHandler.ts#L11)

#### Parameters

##### logger

`Logger`

#### Returns

`ErrorHandler`

## Methods

### handleError()

> **handleError**(`error`, `ctx`): `Response`

Defined in: [packages/transports-http/src/libs/ErrorHandler.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/ErrorHandler.ts#L13)

#### Parameters

##### error

`unknown`

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Response`
