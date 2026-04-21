---
editUrl: false
next: false
prev: false
title: "TraceConfig"
---

> **TraceConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L11)

Configuration for telemetry traces.

Defines how trace data is collected and exported, including OTLP endpoint settings,
sampling strategy, and batching behavior.

## Properties

### autoInstrumentation?

> `optional` **autoInstrumentation**: [`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/)

Defined in: [packages/telemetry-sdk-node/src/config.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L31)

Auto-instrumentation configuration

***

### batchCount?

> `optional` **batchCount**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:25](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L25)

Maximum queue size. Default: 2048

***

### batchSize?

> `optional` **batchSize**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L27)

Maximum export batch size. Default: 512

***

### batchTimeout?

> `optional` **batchTimeout**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L23)

Batch timeout in milliseconds. Default: 5000

***

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [packages/telemetry-sdk-node/src/config.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L13)

Whether tracing is enabled. Default: true

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:17](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L17)

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:15](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L15)

OTLP exporter URL. Default: from env or localhost:4318

***

### instrumentations?

> `optional` **instrumentations**: `Instrumentation`[]

Defined in: [packages/telemetry-sdk-node/src/config.ts:29](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L29)

Custom instrumentation instances

***

### probability?

> `optional` **probability**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L21)

Sampling probability (0.0-1.0). Alternative to sampler

***

### sampler?

> `optional` **sampler**: `Sampler`

Defined in: [packages/telemetry-sdk-node/src/config.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L19)

Custom sampler instance. Takes precedence over probability
