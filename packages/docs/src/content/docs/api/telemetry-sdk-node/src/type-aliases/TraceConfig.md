---
editUrl: false
next: false
prev: false
title: "TraceConfig"
---

> **TraceConfig** = `object`

Configuration for telemetry traces.

Defines how trace data is collected and exported, including OTLP endpoint settings,
sampling strategy, and batching behavior.

## Properties

### autoInstrumentation?

> `optional` **autoInstrumentation?**: [`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/)

Auto-instrumentation configuration

***

### batchCount?

> `optional` **batchCount?**: `number`

Maximum queue size. Default: 2048

***

### batchSize?

> `optional` **batchSize?**: `number`

Maximum export batch size. Default: 512

***

### batchTimeout?

> `optional` **batchTimeout?**: `number`

Batch timeout in milliseconds. Default: 5000

***

### enabled?

> `optional` **enabled?**: `boolean`

Whether tracing is enabled. Default: true

***

### exporterHeaders?

> `optional` **exporterHeaders?**: `Record`\<`string`, `string`\>

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl?**: `string`

OTLP exporter URL. Default: from env or localhost:4318

***

### instrumentations?

> `optional` **instrumentations?**: `Instrumentation`[]

Custom instrumentation instances

***

### probability?

> `optional` **probability?**: `number`

Sampling probability (0.0-1.0). Alternative to sampler

***

### sampler?

> `optional` **sampler?**: `Sampler`

Custom sampler instance. Takes precedence over probability
