---
editUrl: false
next: false
prev: false
title: "MetricsApi"
---

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:118](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L118)

Metrics API provides methods to create and use metric instruments.
This is a Croco abstraction over OpenTelemetry Metrics API.

## Example

```typescript
const metrics = TelemetryRuntime.getInstance().getMetrics();

const counter = metrics.createCounter({ name: 'requests.total' });
const histogram = metrics.createHistogram({ name: 'request.duration_ms' });
const gauge = metrics.createGauge({ name: 'active.connections' });
```

## Methods

### createCounter()

> **createCounter**(`options`): [`Counter`](/api/telemetry-sdk-node/src/interfaces/counter/)

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:125](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L125)

Creates a new Counter instrument.

#### Parameters

##### options

[`CounterOptions`](/api/telemetry-sdk-node/src/interfaces/counteroptions/)

Configuration options for the counter

#### Returns

[`Counter`](/api/telemetry-sdk-node/src/interfaces/counter/)

A Counter instance

***

### createGauge()

> **createGauge**(`options`): [`Gauge`](/api/telemetry-sdk-node/src/interfaces/gauge/)

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:141](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L141)

Creates a new Gauge instrument.

#### Parameters

##### options

[`GaugeOptions`](/api/telemetry-sdk-node/src/interfaces/gaugeoptions/)

Configuration options for the gauge

#### Returns

[`Gauge`](/api/telemetry-sdk-node/src/interfaces/gauge/)

A Gauge instance

***

### createHistogram()

> **createHistogram**(`options`): [`Histogram`](/api/telemetry-sdk-node/src/interfaces/histogram/)

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:133](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L133)

Creates a new Histogram instrument.

#### Parameters

##### options

[`HistogramOptions`](/api/telemetry-sdk-node/src/interfaces/histogramoptions/)

Configuration options for the histogram

#### Returns

[`Histogram`](/api/telemetry-sdk-node/src/interfaces/histogram/)

A Histogram instance
