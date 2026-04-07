---
editUrl: false
next: false
prev: false
title: "HealthCheckRegistry"
---

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/HealthCheckRegistry.ts#L18)

## Methods

### check()

> **check**(): `Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:32](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/HealthCheckRegistry.ts#L32)

#### Returns

`Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

***

### register()

> **register**(`name`, `check`, `options?`): `void`

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:21](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/HealthCheckRegistry.ts#L21)

#### Parameters

##### name

`string`

##### check

[`HealthCheckFunction`](/api/transports-http/src/type-aliases/healthcheckfunction/)

##### options?

[`HealthCheckOptions`](/api/transports-http/src/interfaces/healthcheckoptions/) = `{}`

#### Returns

`void`
