---
editUrl: false
next: false
prev: false
title: "HealthCheckServiceOptions"
---

> **HealthCheckServiceOptions** = `object`

Configuration options for the health check service.

## Example

```typescript
const options: HealthCheckServiceOptions = {
  timeout: 10000, // 10 seconds
};
```

## Extended by

- [`HealthCheckOptions`](/api/transports-http/src/interfaces/healthcheckoptions/)

## Properties

### timeout?

> `optional` **timeout?**: `number`

Maximum time in milliseconds to wait for each health check. Defaults to 5000ms.
