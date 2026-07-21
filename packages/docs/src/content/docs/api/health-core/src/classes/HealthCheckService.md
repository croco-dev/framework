---
editUrl: false
next: false
prev: false
title: "HealthCheckService"
---

Service for orchestrating health checks across multiple indicators.

Manages a collection of health indicators and executes their checks in parallel with a configurable timeout.
The overall health status is 'up' only if all indicators report 'up'.

## Example

```typescript
import { HealthCheckService } from '@croco/health-core';

const service = new HealthCheckService({ timeout: 5000 });
service.register(new RedisHealthIndicator(redis));
service.register(new ApiHealthIndicator());

const result = await service.check();
// Returns overall status and detailed results from each indicator
```

## Constructors

### Constructor

> **new HealthCheckService**(`options?`): `HealthCheckService`

#### Parameters

##### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/) = `{}`

#### Returns

`HealthCheckService`

## Methods

### check()

> **check**(): `Promise`\<[`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)\>

#### Returns

`Promise`\<[`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)\>

***

### checkReadiness()

> **checkReadiness**(): `Promise`\<[`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)\>

#### Returns

`Promise`\<[`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)\>

***

### isLive()

> **isLive**(): `boolean`

#### Returns

`boolean`

***

### isReady()

> **isReady**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

***

### register()

> **register**(`indicator`, `options?`): `void`

#### Parameters

##### indicator

[`HealthIndicator`](/api/health-core/src/interfaces/healthindicator/)

##### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/) = `{}`

#### Returns

`void`

***

### registerReadiness()

> **registerReadiness**(`indicator`, `options?`): `void`

#### Parameters

##### indicator

[`ReadinessIndicator`](/api/health-core/src/interfaces/readinessindicator/)

##### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/) = `{}`

#### Returns

`void`
