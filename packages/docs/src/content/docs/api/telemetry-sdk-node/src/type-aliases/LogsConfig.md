---
editUrl: false
next: false
prev: false
title: "LogsConfig"
---

> **LogsConfig** = `object`

Configuration for telemetry logs.

Defines how log data is collected and exported.
Currently disabled by default in Lambda environments.

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

Whether logs collection is enabled. Default: false

---

### exporterHeaders?

> `optional` **exporterHeaders?**: `Record`\<`string`, `string`\>

Additional HTTP headers for the exporter

---

### exporterUrl?

> `optional` **exporterUrl?**: `string`

OTLP logs exporter URL

---

### maxExportBatchSize?

> `optional` **maxExportBatchSize?**: `number`

Maximum batch size for export

---

### maxQueueSize?

> `optional` **maxQueueSize?**: `number`

Maximum queue size for log records
