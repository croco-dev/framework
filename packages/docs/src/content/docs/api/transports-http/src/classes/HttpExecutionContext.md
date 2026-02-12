---
editUrl: false
next: false
prev: false
title: "HttpExecutionContext"
---

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:4](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L4)

## Implements

- `ExecutionContext`

## Constructors

### Constructor

> **new HttpExecutionContext**(`ctx`, `controllerClass`, `handlerName`): `HttpExecutionContext`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:5](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L5)

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

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:16](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L16)

컨트롤러 클래스 참조

#### Returns

`Constructor`

#### Implementation of

`ExecutionContext.getClass`

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:20](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L20)

핸들러 메서드 이름

#### Returns

`string` \| `symbol`

#### Implementation of

`ExecutionContext.getHandler`

***

### getHttpContext()

> **getHttpContext**(): [`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:32](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L32)

#### Returns

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

***

### getMethod()

> **getMethod**(): `string`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:28](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L28)

HTTP 메서드 (GET, POST 등)

#### Returns

`string`

#### Implementation of

`ExecutionContext.getMethod`

***

### getPath()

> **getPath**(): `string`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:24](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L24)

요청 URL 경로

#### Returns

`string`

#### Implementation of

`ExecutionContext.getPath`

***

### getRequest()

> **getRequest**(): `Request`

Defined in: [packages/transports-http/src/libs/HttpExecutionContext.ts:11](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/HttpExecutionContext.ts#L11)

원본 HTTP Request 객체

#### Returns

`Request`

#### Implementation of

`ExecutionContext.getRequest`
