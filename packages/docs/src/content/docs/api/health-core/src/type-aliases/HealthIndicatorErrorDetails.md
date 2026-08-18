---
editUrl: false
next: false
prev: false
title: "HealthIndicatorErrorDetails"
---

> **HealthIndicatorErrorDetails** = `object`

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

## Properties

### code?

> `optional` **code?**: `string`

---

### error

> **error**: `string`

---

### message?

> `optional` **message?**: `string`
