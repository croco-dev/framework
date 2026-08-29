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
import { HealthCheckService } from "@croco/health-core";

const service = new HealthCheckService({ timeout: 5000 });
service.register("redis", new RedisHealthIndicator(redis));
service.register("api", new ApiHealthIndicator());

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

---

### checkReadiness()

> **checkReadiness**(): `Promise`\<[`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)\>

#### Returns

`Promise`\<[`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)\>

---

### isLive()

> **isLive**(): `boolean`

#### Returns

`boolean`

---

### isReady()

> **isReady**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

---

### register()

#### Call Signature

> **register**(`id`, `indicator`, `options?`): [`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

Registers a health indicator under a stable component ID.

The ID replaces the indicator-returned name in reports. Duplicate IDs are rejected within the
health namespace. Disposing the returned handle removes only this registration.

##### Parameters

###### id

`string`

###### indicator

[`HealthIndicator`](/api/health-core/src/interfaces/healthindicator/)

###### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/)

##### Returns

[`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

#### Call Signature

> **register**(`indicator`, `options?`): [`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

:::caution[Deprecated]
Pass an explicit indicator ID as the first argument.
:::

##### Parameters

###### indicator

[`HealthIndicator`](/api/health-core/src/interfaces/healthindicator/)

###### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/)

##### Returns

[`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

---

### registerReadiness()

#### Call Signature

> **registerReadiness**(`id`, `indicator`, `options?`): [`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

Registers a readiness indicator under a stable component ID.

The ID replaces the indicator-returned name in reports. Duplicate IDs are rejected within the
readiness namespace. A health indicator may use the same ID because the namespaces are separate.

##### Parameters

###### id

`string`

###### indicator

[`ReadinessIndicator`](/api/health-core/src/interfaces/readinessindicator/)

###### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/)

##### Returns

[`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

#### Call Signature

> **registerReadiness**(`indicator`, `options?`): [`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)

:::caution[Deprecated]
Pass an explicit indicator ID as the first argument.
:::

##### Parameters

###### indicator

[`ReadinessIndicator`](/api/health-core/src/interfaces/readinessindicator/)

###### options?

[`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/)

##### Returns

[`HealthIndicatorRegistration`](/api/health-core/src/interfaces/healthindicatorregistration/)
