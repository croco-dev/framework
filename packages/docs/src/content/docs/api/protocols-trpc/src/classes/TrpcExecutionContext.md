---
editUrl: false
next: false
prev: false
title: "TrpcExecutionContext"
---

Adapts a tRPC procedure invocation to Croco's controller execution context.

## Type Parameters

### TContext

`TContext` = `unknown`

## Implements

- [`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/)

## Constructors

### Constructor

> **new TrpcExecutionContext**\<`TContext`\>(`trpcContext`, `controllerClass`, `handlerName`, `path`, `method`): `TrpcExecutionContext`\<`TContext`\>

#### Parameters

##### trpcContext

`TContext`

##### controllerClass

[`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)

##### handlerName

`string` \| `symbol`

##### path

`string`

##### method

`string`

#### Returns

`TrpcExecutionContext`\<`TContext`\>

## Methods

### getClass()

> **getClass**(): [`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)

컨트롤러 클래스 참조

#### Returns

[`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)

#### Implementation of

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/).[`getClass`](/api/protocols-rest/src/interfaces/executioncontext/#getclass)

***

### getHandler()

> **getHandler**(): `string` \| `symbol`

핸들러 메서드 이름

#### Returns

`string` \| `symbol`

#### Implementation of

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/).[`getHandler`](/api/protocols-rest/src/interfaces/executioncontext/#gethandler)

***

### getMethod()

> **getMethod**(): `string`

HTTP 메서드 (GET, POST 등)

#### Returns

`string`

#### Implementation of

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/).[`getMethod`](/api/protocols-rest/src/interfaces/executioncontext/#getmethod)

***

### getPath()

> **getPath**(): `string`

요청 URL 경로

#### Returns

`string`

#### Implementation of

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/).[`getPath`](/api/protocols-rest/src/interfaces/executioncontext/#getpath)

***

### getRequest()

> **getRequest**(): `Request`

원본 HTTP Request 객체

#### Returns

`Request`

#### Implementation of

[`ExecutionContext`](/api/protocols-rest/src/interfaces/executioncontext/).[`getRequest`](/api/protocols-rest/src/interfaces/executioncontext/#getrequest)

***

### getTrpcContext()

> **getTrpcContext**(): `TContext`

#### Returns

`TContext`
