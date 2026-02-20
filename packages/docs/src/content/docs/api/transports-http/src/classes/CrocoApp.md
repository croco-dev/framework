---
editUrl: false
next: false
prev: false
title: "CrocoApp"
---

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:72](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/CrocoApp.ts#L72)

## Constructors

### Constructor

> **new CrocoApp**(`config`): `CrocoApp`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:80](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/CrocoApp.ts#L80)

#### Parameters

##### config

[`AppConfig`](/api/transports-http/src/interfaces/appconfig/)

#### Returns

`CrocoApp`

## Methods

### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:274](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/CrocoApp.ts#L274)

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### getHono()

> **getHono**(): `Hono`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:252](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/CrocoApp.ts#L252)

#### Returns

`Hono`

***

### lambdaHandler()

> **lambdaHandler**(): [`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:201](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/CrocoApp.ts#L201)

#### Returns

[`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

***

### listen()

> **listen**(`port`, `callback?`): `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:257](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/CrocoApp.ts#L257)

#### Parameters

##### port

`number`

##### callback?

() => `void`

#### Returns

`Promise`\<`void`\>
