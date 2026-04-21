---
editUrl: false
next: false
prev: false
title: "Counter"
---

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L13)

Counter is a synchronous instrument that records additive values.
Counters are typically used to count occurrences of an event.

## Example

```typescript
const counter = metrics.createCounter({ name: 'requests.count' });
counter.add(1, { method: 'GET' });
```

## Methods

### add()

> **add**(`value`, `attributes?`, `context?`): `void`

Defined in: [packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/metrics/MetricsApi.ts#L22)

Adds the given value to the current value.
Values are always non-negative.

#### Parameters

##### value

`number`

The value to add (must be non-negative)

##### attributes?

`Attributes`

Optional attributes to associate with this measurement

##### context?

`Context`

Optional context for the measurement

#### Returns

`void`
