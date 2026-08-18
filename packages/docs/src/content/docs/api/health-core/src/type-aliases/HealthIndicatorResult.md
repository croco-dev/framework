---
editUrl: false
next: false
prev: false
title: "HealthIndicatorResult"
---

> **HealthIndicatorResult** = `object`

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

## Properties

### details?

> `optional` **details?**: [`HealthIndicatorErrorDetails`](/api/health-core/src/type-aliases/healthindicatorerrordetails/) \| [`HealthIndicatorSuccessDetails`](/api/health-core/src/type-aliases/healthindicatorsuccessdetails/)

***

### name

> **name**: `string`

***

### status

> **status**: [`HealthStatus`](/api/health-core/src/type-aliases/healthstatus/)
