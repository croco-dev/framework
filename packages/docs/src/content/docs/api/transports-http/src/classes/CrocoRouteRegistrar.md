---
editUrl: false
next: false
prev: false
title: "CrocoRouteRegistrar"
---

컴파일된 라우트를 Hono 인스턴스에 등록하고 공통 미들웨어를 적용합니다.

## Constructors

### Constructor

> **new CrocoRouteRegistrar**(`hono`, `errorHandler`, `globalMiddlewares`, `logger`, `recordError?`): `CrocoRouteRegistrar`

#### Parameters

##### hono

`Hono`

##### errorHandler

[`ErrorHandler`](/api/transports-http/src/classes/errorhandler/)

##### globalMiddlewares

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)[]

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

##### recordError?

(`error`, `status`) => `void`

#### Returns

`CrocoRouteRegistrar`

## Methods

### register()

> **register**(`route`, `options?`): `void`

#### Parameters

##### route

[`CompiledRoute`](/api/transports-http/src/interfaces/compiledroute/)

##### options?

`RegisterRouteOptions` = `{}`

#### Returns

`void`

---

### registerPreflight()

> **registerPreflight**(`path`): `void`

#### Parameters

##### path

`string`

#### Returns

`void`

---

### setRuntimeInspector()

> **setRuntimeInspector**(`inspector`): `void`

#### Parameters

##### inspector

[`RuntimeInspector`](/api/framework-context/src/classes/runtimeinspector/)

#### Returns

`void`
