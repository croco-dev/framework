---
editUrl: false
next: false
prev: false
title: "MetricsConfig"
---

> **MetricsConfig** = `object`

Configuration for telemetry metrics.

Reserved configuration for future metric runtime providers.
Setting enabled to true currently rejects TelemetryRuntime initialization.

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

Requests metrics collection. Must remain false until a runtime provider is available.

***

### exporterHeaders?

> `optional` **exporterHeaders?**: `Record`\<`string`, `string`\>

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl?**: `string`

OTLP metrics exporter URL

***

### exportIntervalMillis?

> `optional` **exportIntervalMillis?**: `number`

Export interval in milliseconds

***

### exportTimeoutMillis?

> `optional` **exportTimeoutMillis?**: `number`

Export timeout in milliseconds
