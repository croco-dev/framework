---
editUrl: false
next: false
prev: false
title: "LogsConfig"
---

> **LogsConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:59](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L59)

Configuration for telemetry logs.

Defines how log data is collected and exported.
Currently disabled by default in Lambda environments.

## Properties

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [packages/telemetry-sdk-node/src/config.ts:61](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L61)

Whether logs collection is enabled. Default: false

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:65](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L65)

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:63](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L63)

OTLP logs exporter URL

***

### maxExportBatchSize?

> `optional` **maxExportBatchSize**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:69](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L69)

Maximum batch size for export

***

### maxQueueSize?

> `optional` **maxQueueSize**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:67](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/config.ts#L67)

Maximum queue size for log records
