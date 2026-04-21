---
editUrl: false
next: false
prev: false
title: "HttpExecutionContext"
---

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L12)

Guard, Interceptor, Filter가 사용할 REST 실행 컨텍스트 구현체입니다.

## Implements

- `ExecutionContext`

## Constructors

### Constructor

> **new HttpExecutionContext**(`ctx`, `controllerClass`, `handlerName`): `HttpExecutionContext`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L13)

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

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L31)

컨트롤러 클래스 참조

#### Returns

`Constructor`

#### Implementation of

`ExecutionContext.getClass`

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:35](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L35)

핸들러 메서드 이름

#### Returns

`string` \| `symbol`

#### Implementation of

`ExecutionContext.getHandler`

***

### getHttpContext()

> **getHttpContext**(): [`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:47](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L47)

#### Returns

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

***

### getMethod()

> **getMethod**(): `string`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:43](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L43)

HTTP 메서드 (GET, POST 등)

#### Returns

`string`

#### Implementation of

`ExecutionContext.getMethod`

***

### getPath()

> **getPath**(): `string`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:39](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L39)

요청 URL 경로

#### Returns

`string`

#### Implementation of

`ExecutionContext.getPath`

***

### getRequest()

> **getRequest**(): `Request`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HttpExecutionContext.ts#L19)

원본 HTTP Request 객체

#### Returns

`Request`

#### Implementation of

`ExecutionContext.getRequest`
