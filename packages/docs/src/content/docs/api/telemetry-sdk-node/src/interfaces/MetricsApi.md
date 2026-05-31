---
editUrl: false
next: false
prev: false
title: "MetricsApi"
---

Metrics API provides methods to create and use metric instruments.
This is a Croco abstraction over OpenTelemetry Metrics API.

## Example

```typescript
const metrics = TelemetryRuntime.getInstance().getMetrics();

const counter = metrics.createCounter({ name: "requests.total" });
const histogram = metrics.createHistogram({ name: "request.duration_ms" });
const gauge = metrics.createGauge({ name: "active.connections" });
```

## Methods

### createCounter()

> **createCounter**(`options`): [`Counter`](/api/telemetry-sdk-node/src/interfaces/counter/)

Creates a new Counter instrument.

#### Parameters

##### options

[`CounterOptions`](/api/telemetry-sdk-node/src/interfaces/counteroptions/)

Configuration options for the counter

#### Returns

[`Counter`](/api/telemetry-sdk-node/src/interfaces/counter/)

A Counter instance

---

### createGauge()

> **createGauge**(`options`): [`Gauge`](/api/telemetry-sdk-node/src/interfaces/gauge/)

Creates a new Gauge instrument.

#### Parameters

##### options

[`GaugeOptions`](/api/telemetry-sdk-node/src/interfaces/gaugeoptions/)

Configuration options for the gauge

#### Returns

[`Gauge`](/api/telemetry-sdk-node/src/interfaces/gauge/)

A Gauge instance

---

### createHistogram()

> **createHistogram**(`options`): [`Histogram`](/api/telemetry-sdk-node/src/interfaces/histogram/)

Creates a new Histogram instrument.

#### Parameters

##### options

[`HistogramOptions`](/api/telemetry-sdk-node/src/interfaces/histogramoptions/)

Configuration options for the histogram

#### Returns

[`Histogram`](/api/telemetry-sdk-node/src/interfaces/histogram/)

A Histogram instance
