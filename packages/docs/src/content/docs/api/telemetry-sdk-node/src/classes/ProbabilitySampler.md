---
editUrl: false
next: false
prev: false
title: "ProbabilitySampler"
---

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:8](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L8)

## Implements

- `Sampler`

## Constructors

### Constructor

> **new ProbabilitySampler**(`options`): `ProbabilitySampler`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:12](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L12)

#### Parameters

##### options

`ProbabilitySamplerOptions`

#### Returns

`ProbabilitySampler`

## Methods

### shouldSample()

> **shouldSample**(`context`, `traceId`, `_spanName`, `_spanKind`, `_attributes`, `_links`): `SamplingResult`

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:20](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L20)

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

Defined in: [packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts:52](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/telemetry-sdk-node/src/libs/samplers/ProbabilitySampler.ts#L52)

Returns the sampler name or short description with the configuration.

#### Returns

`string`

#### Implementation of

`Sampler.toString`
