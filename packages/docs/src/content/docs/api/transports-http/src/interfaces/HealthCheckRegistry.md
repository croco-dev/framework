---
editUrl: false
next: false
prev: false
title: "HealthCheckRegistry"
---

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HealthCheckRegistry.ts#L21)

HTTP 애플리케이션 구성과 라우트 실행에 사용하는 핵심 공개 API입니다.

## Methods

### check()

> **check**(): `Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:35](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HealthCheckRegistry.ts#L35)

#### Returns

`Promise`\<\{ `checks`: `Record`\<`string`, [`HealthCheckResult`](/api/transports-http/src/interfaces/healthcheckresult/) & `object`\>; `status`: `"error"` \| `"ok"`; \}\>

***

### register()

> **register**(`name`, `check`, `options?`): `void`

Defined in: [packages/transports-http/src/libs/HealthCheckRegistry.ts:24](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/HealthCheckRegistry.ts#L24)

#### Parameters

##### name

`string`

##### check

[`HealthCheckFunction`](/api/transports-http/src/type-aliases/healthcheckfunction/)

##### options?

[`HealthCheckOptions`](/api/transports-http/src/interfaces/healthcheckoptions/) = `{}`

#### Returns

`void`
