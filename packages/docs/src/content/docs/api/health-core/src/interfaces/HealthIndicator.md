---
editUrl: false
next: false
prev: false
title: "HealthIndicator"
---

Success details for a passing health check.

Can include metrics, latency information, or other diagnostic data.

## Example

```typescript
const successDetails: HealthIndicatorSuccessDetails = {
  latency: 15,
  connections: 5,
  version: '1.2.3',
};
```

## Extended by

- [`ReadinessIndicator`](/api/health-core/src/interfaces/readinessindicator/)

## Properties

### name?

> `readonly` `optional` **name?**: `string`

## Methods

### check()

> **check**(`signal?`): `Promise`\<[`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)\>
