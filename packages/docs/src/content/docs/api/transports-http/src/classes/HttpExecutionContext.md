---
editUrl: false
next: false
prev: false
title: "HttpExecutionContext"
---

Guard, Interceptor, Filter가 사용할 REST 실행 컨텍스트 구현체입니다.

## Implements

- `ExecutionContext`

## Constructors

### Constructor

> **new HttpExecutionContext**(`ctx`, `controllerClass`, `handlerName`): `HttpExecutionContext`

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

컨트롤러 클래스 참조

#### Returns

`Constructor`

#### Implementation of

`ExecutionContext.getClass`

---

### getHandler()

> **getHandler**(): `string` \| `symbol`

핸들러 메서드 이름

#### Returns

`string` \| `symbol`

#### Implementation of

`ExecutionContext.getHandler`

---

### getHttpContext()

> **getHttpContext**(): [`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

---

### getMethod()

> **getMethod**(): `string`

HTTP 메서드 (GET, POST 등)

#### Returns

`string`

#### Implementation of

`ExecutionContext.getMethod`

---

### getPath()

> **getPath**(): `string`

요청 URL 경로

#### Returns

`string`

#### Implementation of

`ExecutionContext.getPath`

---

### getRequest()

> **getRequest**(): `Request`

원본 HTTP Request 객체

#### Returns

`Request`

#### Implementation of

`ExecutionContext.getRequest`
