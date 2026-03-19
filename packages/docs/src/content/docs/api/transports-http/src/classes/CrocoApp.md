---
editUrl: false
next: false
prev: false
title: "CrocoApp"
---

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:13](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/CrocoApp.ts#L13)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new CrocoApp**(`config`, `logger`, `errorHandler`, `healthCheckRegistry`): `CrocoApp`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:20](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/CrocoApp.ts#L20)

#### Parameters

##### config

[`AppConfig`](/api/transports-http/src/interfaces/appconfig/)

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

##### errorHandler

[`ErrorHandler`](/api/transports-http/src/classes/errorhandler/)

##### healthCheckRegistry

[`HealthCheckRegistry`](/api/transports-http/src/interfaces/healthcheckregistry/)

#### Returns

`CrocoApp`

## Methods

### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:88](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/CrocoApp.ts#L88)

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### getHono()

> **getHono**(): `Hono`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:66](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/CrocoApp.ts#L66)

#### Returns

`Hono`

***

### lambdaHandler()

> **lambdaHandler**(): [`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:61](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/CrocoApp.ts#L61)

#### Returns

[`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

***

### listen()

> **listen**(`port`, `callback?`): `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:71](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/CrocoApp.ts#L71)

#### Parameters

##### port

`number`

##### callback?

() => `void`

#### Returns

`Promise`\<`void`\>
