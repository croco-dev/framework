---
editUrl: false
next: false
prev: false
title: "HealthCheckRegistry"
---

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/HealthCheckRegistry.ts#L17)

Croco HTTP 앱의 핵심 런타임 API입니다.

## Methods

### check()

> **check**(): `Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:24](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/HealthCheckRegistry.ts#L24)

#### Returns

`Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

***

### register()

> **register**(`name`, `check`, `options?`): `void`

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:20](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/HealthCheckRegistry.ts#L20)

#### Parameters

##### name

`string`

##### check

[`HealthCheckFunction`](/api/transports-http/src/type-aliases/healthcheckfunction/)

##### options?

[`HealthCheckOptions`](/api/transports-http/src/interfaces/healthcheckoptions/) = `{}`

#### Returns

`void`
