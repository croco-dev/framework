---
editUrl: false
next: false
prev: false
title: "CrocoApp"
---

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:36](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/CrocoApp.ts#L36)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Constructors

### Constructor

> **new CrocoApp**(`config`): `CrocoApp`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:44](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/CrocoApp.ts#L44)

#### Parameters

##### config

[`AppConfig`](/api/transports-http/src/interfaces/appconfig/)

#### Returns

`CrocoApp`

## Methods

### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:240](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/CrocoApp.ts#L240)

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### getHono()

> **getHono**(): `Hono`

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:218](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/CrocoApp.ts#L218)

#### Returns

`Hono`

***

### lambdaHandler()

> **lambdaHandler**(): [`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:167](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/CrocoApp.ts#L167)

#### Returns

[`LambdaHandler`](/api/transports-http/src/type-aliases/lambdahandler/)

***

### listen()

> **listen**(`port`, `callback?`): `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/CrocoApp.ts:223](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/CrocoApp.ts#L223)

#### Parameters

##### port

`number`

##### callback?

() => `void`

#### Returns

`Promise`\<`void`\>
