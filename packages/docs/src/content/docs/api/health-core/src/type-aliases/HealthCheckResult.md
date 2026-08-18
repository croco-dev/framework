---
editUrl: false
next: false
prev: false
title: "HealthCheckResult"
---

> **HealthCheckResult** = `object`

Configuration options for the health check service.

## Example

```typescript
const options: HealthCheckServiceOptions = {
  timeout: 10000, // 10 seconds
};
```

## Extended by

- [`HealthCheckRegistryResult`](/api/transports-http/src/interfaces/healthcheckregistryresult/)

## Properties

### results

> **results**: [`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)[]

---

### status

> **status**: [`HealthStatus`](/api/health-core/src/type-aliases/healthstatus/)
