---
editUrl: false
next: false
prev: false
title: "HealthCheckRegistry"
---

Defined in: packages/transports-http/src/libs/HealthCheckRegistry.ts:17

## Methods

### check()

> **check**(): `Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

Defined in: packages/transports-http/src/libs/HealthCheckRegistry.ts:24

#### Returns

`Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

***

### register()

> **register**(`name`, `check`, `options?`): `void`

Defined in: packages/transports-http/src/libs/HealthCheckRegistry.ts:20

#### Parameters

##### name

`string`

##### check

[`HealthCheckFunction`](/api/transports-http/src/type-aliases/healthcheckfunction/)

##### options?

[`HealthCheckOptions`](/api/transports-http/src/interfaces/healthcheckoptions/) = `{}`

#### Returns

`void`
