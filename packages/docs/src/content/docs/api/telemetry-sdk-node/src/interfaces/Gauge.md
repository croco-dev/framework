---
editUrl: false
next: false
prev: false
title: "Gauge"
---

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:56](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L56)

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

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:64](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L64)

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
