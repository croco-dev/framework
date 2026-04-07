---
editUrl: false
next: false
prev: false
title: "ProbabilitySampler"
---

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:10](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L10)

## Implements

- `Sampler`

## Constructors

### Constructor

> **new ProbabilitySampler**(`options`): `ProbabilitySampler`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:14](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L14)

#### Parameters

##### options

`ProbabilitySamplerOptions`

#### Returns

`ProbabilitySampler`

## Methods

### shouldSample()

> **shouldSample**(`context`, `traceId`, `_spanName`, `_spanKind`, `_attributes`, `_links`): `SamplingResult`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L22)

Checks whether span needs to be created and tracked.

#### Parameters

##### context

`Context`

Parent Context which may contain a span.

##### traceId

`string`

of the span to be created. It can be different from the
    traceId in the SpanContext. Typically in situations when the
    span to be created starts a new trace.

##### \_spanName

`string`

##### \_spanKind

`SpanKind`

##### \_attributes

`Attributes`

##### \_links

`Link`[]

#### Returns

`SamplingResult`

a SamplingResult.

#### Implementation of

`Sampler.shouldSample`

***

### toString()

> **toString**(): `string`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:52](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L52)

Returns the sampler name or short description with the configuration.

#### Returns

`string`

#### Implementation of

`Sampler.toString`
