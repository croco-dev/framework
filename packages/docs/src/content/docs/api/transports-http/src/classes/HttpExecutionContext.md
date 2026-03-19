---
editUrl: false
next: false
prev: false
title: "HttpExecutionContext"
---

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L9)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Implements

- `ExecutionContext`

## Constructors

### Constructor

> **new HttpExecutionContext**(`ctx`, `controllerClass`, `handlerName`): `HttpExecutionContext`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L10)

#### Parameters

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

##### controllerClass

`Constructor`

##### handlerName

`string` | `symbol`

#### Returns

`HttpExecutionContext`

## Methods

### getClass()

> **getClass**(): `Constructor`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:28](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L28)

컨트롤러 클래스 참조

#### Returns

`Constructor`

#### Implementation of

`ExecutionContext.getClass`

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:32](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L32)

핸들러 메서드 이름

#### Returns

`string` \| `symbol`

#### Implementation of

`ExecutionContext.getHandler`

***

### getHttpContext()

> **getHttpContext**(): [`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:44](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L44)

#### Returns

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

***

### getMethod()

> **getMethod**(): `string`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:40](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L40)

HTTP 메서드 (GET, POST 등)

#### Returns

`string`

#### Implementation of

`ExecutionContext.getMethod`

***

### getPath()

> **getPath**(): `string`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:36](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L36)

요청 URL 경로

#### Returns

`string`

#### Implementation of

`ExecutionContext.getPath`

***

### getRequest()

> **getRequest**(): `Request`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:16](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/HttpExecutionContext.ts#L16)

원본 HTTP Request 객체

#### Returns

`Request`

#### Implementation of

`ExecutionContext.getRequest`
