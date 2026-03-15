---
editUrl: false
next: false
prev: false
title: "ErrorHandler"
---

Defined in: [packages/transports-http/src/libs/ErrorHandler.ts:7](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/ErrorHandler.ts#L7)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new ErrorHandler**(`logger`): `ErrorHandler`

Defined in: [packages/transports-http/src/libs/ErrorHandler.ts:8](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/ErrorHandler.ts#L8)

#### Parameters

##### logger

`Logger`

#### Returns

`ErrorHandler`

## Methods

### handleError()

> **handleError**(`error`, `ctx`): `Response`

Defined in: [packages/transports-http/src/libs/ErrorHandler.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/ErrorHandler.ts#L10)

#### Parameters

##### error

`unknown`

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Response`
