---
editUrl: false
next: false
prev: false
title: "CrocoApp"
---

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:25](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/CrocoApp.ts#L25)

## Constructors

### Constructor

> **new CrocoApp**(`config`): `CrocoApp`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:32](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/CrocoApp.ts#L32)

#### Parameters

##### config

[`AppConfig`](/api/transports-http/src/interfaces/appconfig/)

#### Returns

`CrocoApp`

## Methods

### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:204](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/CrocoApp.ts#L204)

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### getHono()

> **getHono**(): `Hono`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:182](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/CrocoApp.ts#L182)

#### Returns

`Hono`

***

### lambdaHandler()

> **lambdaHandler**(): [`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:135](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/CrocoApp.ts#L135)

#### Returns

[`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

***

### listen()

> **listen**(`port`, `callback?`): `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:187](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/transports-http/src/libs/CrocoApp.ts#L187)

#### Parameters

##### port

`number`

##### callback?

() => `void`

#### Returns

`Promise`\<`void`\>
