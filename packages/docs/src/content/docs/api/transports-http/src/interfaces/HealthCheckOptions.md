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

Timeout in milliseconds. Must be an integer from 1 through 2,147,483,647.
Invalid values throw an InvalidHealthCheckTimeoutProblem during service setup or indicator
registration.

#### Inherited from

`HealthCheckServiceOptions.timeout`
