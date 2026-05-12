---
editUrl: false
next: false
prev: false
title: "Histogram"
---

Histogram is a synchronous instrument that records the distribution of values.
Histograms are useful for measuring things like request latency or response sizes.

## Example

```typescript
const histogram = metrics.createHistogram({ name: "request.duration" });
histogram.record(150, { method: "GET", status: 200 });
```

## Methods

### record()

> **record**(`value`, `attributes?`, `context?`): `void`

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
