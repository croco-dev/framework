---
editUrl: false
next: false
prev: false
title: "HealthIndicatorSuccessDetails"
---

> **HealthIndicatorSuccessDetails** = `object`

Success details for a passing health check.

Can include metrics, latency information, or other diagnostic data.

## Index Signature

\[`key`: `string`\]: `unknown`

## Example

```typescript
const successDetails: HealthIndicatorSuccessDetails = {
  latency: 15,
  connections: 5,
  version: "1.2.3",
};
```
