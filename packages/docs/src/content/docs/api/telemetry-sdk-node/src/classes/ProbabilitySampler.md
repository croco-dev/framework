---
editUrl: false
next: false
prev: false
title: "ProbabilitySampler"
---

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L8)

Probability-based sampler for OpenTelemetry traces.

## Remarks

Implements consistent sampling based on trace ID. This ensures that the same trace
is always sampled or not sampled, regardless of which service in the distributed
system makes the sampling decision.

Uses the lower 32 bits of the trace ID to make deterministic sampling decisions,
providing consistent sampling across all spans in a trace.

## Example

```ts
import { ProbabilitySampler } from '@croco/telemetry-sdk-node';

// Sample 10% of traces
const sampler = new ProbabilitySampler({ probability: 0.1 });

await telemetry.init({
  serviceName: 'my-service',
  trace: { sampler },
});
```

## Implements

- `Sampler`

## Constructors

### Constructor

> **new ProbabilitySampler**(`options`): `ProbabilitySampler`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L12)

#### Parameters

##### options

`ProbabilitySamplerOptions`

#### Returns

`ProbabilitySampler`

## Methods

### shouldSample()

> **shouldSample**(`context`, `traceId`, `_spanName`, `_spanKind`, `_attributes`, `_links`): `SamplingResult`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:20](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L20)

Checks whether span needs to be created and tracked.

#### Parameters

##### context

`unknown`

Parent Context which may contain a span.

##### traceId

`string`

of the span to be created. It can be different from the
    traceId in the SpanContext. Typically in situations when the
    span to be created starts a new trace.

##### \_spanName

`string`

##### \_spanKind

`unknown`

##### \_attributes

`unknown`

##### \_links

`unknown`

#### Returns

`SamplingResult`

a SamplingResult.

#### Implementation of

`Sampler.shouldSample`

***

### toString()

> **toString**(): `string`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:50](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L50)

Returns the sampler name or short description with the configuration.

#### Returns

`string`

#### Implementation of

`Sampler.toString`
