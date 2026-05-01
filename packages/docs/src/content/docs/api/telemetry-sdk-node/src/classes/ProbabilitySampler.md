---
editUrl: false
next: false
prev: false
title: "ProbabilitySampler"
---

확률 기반 샘플링을 수행하는 OpenTelemetry 샘플러 구현체입니다.

## Implements

- `Sampler`

## Constructors

### Constructor

> **new ProbabilitySampler**(`options`): `ProbabilitySampler`

#### Parameters

##### options

`ProbabilitySamplerOptions`

#### Returns

`ProbabilitySampler`

## Methods

### shouldSample()

> **shouldSample**(`context`, `traceId`, `_spanName`, `_spanKind`, `_attributes`, `_links`): `SamplingResult`

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

Returns the sampler name or short description with the configuration.

#### Returns

`string`

#### Implementation of

`Sampler.toString`
