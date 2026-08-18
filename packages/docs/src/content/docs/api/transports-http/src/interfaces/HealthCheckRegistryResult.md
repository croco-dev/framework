---
editUrl: false
next: false
prev: false
title: "HealthCheckRegistryResult"
---

Configuration options for the health check service.

## Example

```typescript
const options: HealthCheckServiceOptions = {
  timeout: 10000, // 10 seconds
};
```

## Extends

- [`HealthCheckResult`](/api/health-core/src/type-aliases/healthcheckresult/)

## Properties

### results

> **results**: [`HealthIndicatorResult`](/api/health-core/src/type-aliases/healthindicatorresult/)[]

#### Inherited from

`HealthCheckResult.results`

***

### status

> **status**: [`HealthStatus`](/api/health-core/src/type-aliases/healthstatus/)

#### Inherited from

`HealthCheckResult.status`
