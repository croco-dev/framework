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

Integer milliseconds from 1 through 2_147_483_647. Defaults to 5000ms. Invalid values throw
InvalidHealthCheckTimeoutProblem during service setup or indicator registration.
