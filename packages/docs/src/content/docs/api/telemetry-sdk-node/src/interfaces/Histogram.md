---
editUrl: false
next: false
prev: false
title: "Histogram"
---

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:35](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L35)

Histogram is a synchronous instrument that records the distribution of values.
Histograms are useful for measuring things like request latency or response sizes.

## Example

```typescript
const histogram = metrics.createHistogram({ name: 'request.duration' });
histogram.record(150, { method: 'GET', status: 200 });
```

## Methods

### record()

> **record**(`value`, `attributes?`, `context?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:43](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L43)

Records a value in the histogram.

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
