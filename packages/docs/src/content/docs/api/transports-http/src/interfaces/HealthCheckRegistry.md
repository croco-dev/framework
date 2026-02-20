---
editUrl: false
next: false
prev: false
title: "HealthCheckRegistry"
---

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:17](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/HealthCheckRegistry.ts#L17)

## Methods

### check()

> **check**(): `Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:24](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/HealthCheckRegistry.ts#L24)

#### Returns

`Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

***

### register()

> **register**(`name`, `check`, `options?`): `void`

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:20](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/HealthCheckRegistry.ts#L20)

#### Parameters

##### name

`string`

##### check

[`HealthCheckFunction`](/api/transports-http/src/type-aliases/healthcheckfunction/)

##### options?

[`HealthCheckOptions`](/api/transports-http/src/interfaces/healthcheckoptions/) = `{}`

#### Returns

`void`
