---
editUrl: false
next: false
prev: false
title: "ReadinessIndicator"
---

Success details for a passing health check.

Can include metrics, latency information, or other diagnostic data.

## Example

```typescript
const successDetails: HealthIndicatorSuccessDetails = {
  latency: 15,
  connections: 5,
  version: "1.2.3",
};
```

## Extends

- [`HealthIndicator`](/api/health-core/src/interfaces/healthindicator/)

## Properties

### name?

> `readonly` `optional` **name?**: `string`

#### Inherited from

[`HealthIndicator`](/api/health-core/src/interfaces/healthindicator/).[`name`](/api/health-core/src/interfaces/healthindicator/#name)

## Methods

### check()

> **check**(`signal?`): `Promise`\<[`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)\>

#### Inherited from

[`HealthIndicator`](/api/health-core/src/interfaces/healthindicator/).[`check`](/api/health-core/src/interfaces/healthindicator/#check)

---

### isReady()

> **isReady**(`signal?`): `Promise`\<[`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)\>
