---
editUrl: false
next: false
prev: false
title: "Gauge"
---

Gauge is a synchronous instrument that records the last value it receives.
Gauges are useful for measuring values that can go up and down, like queue depth.

## Example

```typescript
const gauge = metrics.createGauge({ name: 'queue.size' });
gauge.record(42, { queue: 'orders' });
```

## Methods

### record()

> **record**(`value`, `attributes?`, `context?`): `void`

Records the current value.

#### Parameters

##### value

`number`

The value to record

##### attributes?

`Attributes`

Optional attributes to associate with this measurement

##### context?

`Context`

Optional context for the measurement

#### Returns

`void`
