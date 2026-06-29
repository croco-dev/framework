---
editUrl: false
next: false
prev: false
title: "HealthCheckOptions"
---

Configuration options for the health check service.

## Example

```typescript
const options: HealthCheckServiceOptions = {
  timeout: 10000, // 10 seconds
};
```

## Extends

- [`HealthCheckServiceOptions`](/api/health-core/src/type-aliases/healthcheckserviceoptions/)

## Properties

### timeout?

> `optional` **timeout?**: `number`

Maximum time in milliseconds to wait for each health check. Defaults to 5000ms.

#### Inherited from

`HealthCheckServiceOptions.timeout`
