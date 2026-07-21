---
editUrl: false
next: false
prev: false
title: "LogsConfig"
---

> **LogsConfig** = `object`

Configuration for telemetry logs.

Reserved configuration for future log runtime providers.
Setting enabled to true currently rejects TelemetryRuntime initialization.

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

Requests log collection. Must remain false until a runtime provider is available.

***

### exporterHeaders?

> `optional` **exporterHeaders?**: `Record`\<`string`, `string`\>

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl?**: `string`

OTLP logs exporter URL

***

### maxExportBatchSize?

> `optional` **maxExportBatchSize?**: `number`

Maximum batch size for export

***

### maxQueueSize?

> `optional` **maxQueueSize?**: `number`

Maximum queue size for log records
