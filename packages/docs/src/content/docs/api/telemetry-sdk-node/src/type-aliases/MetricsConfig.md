---
editUrl: false
next: false
prev: false
title: "MetricsConfig"
---

> **MetricsConfig** = `object`

Configuration for telemetry metrics.

Defines how metric data is collected and exported.
Currently disabled by default in Lambda environments.

## Properties

### enabled?

> `optional` **enabled**: `boolean`

Whether metrics collection is enabled. Default: false

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

OTLP metrics exporter URL

***

### exportIntervalMillis?

> `optional` **exportIntervalMillis**: `number`

Export interval in milliseconds

***

### exportTimeoutMillis?

> `optional` **exportTimeoutMillis**: `number`

Export timeout in milliseconds
