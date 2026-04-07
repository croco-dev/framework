---
editUrl: false
next: false
prev: false
title: "MetricsConfig"
---

> **MetricsConfig** = `object`

Defined in: [packages/telemetry-sdk-node/src/config.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L40)

Configuration for telemetry metrics.

Defines how metric data is collected and exported.
Currently disabled by default in Lambda environments.

## Properties

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [packages/telemetry-sdk-node/src/config.ts:42](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L42)

Whether metrics collection is enabled. Default: false

***

### exporterHeaders?

> `optional` **exporterHeaders**: `Record`\<`string`, `string`\>

Defined in: [packages/telemetry-sdk-node/src/config.ts:46](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L46)

Additional HTTP headers for the exporter

***

### exporterUrl?

> `optional` **exporterUrl**: `string`

Defined in: [packages/telemetry-sdk-node/src/config.ts:44](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L44)

OTLP metrics exporter URL

***

### exportIntervalMillis?

> `optional` **exportIntervalMillis**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:48](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L48)

Export interval in milliseconds

***

### exportTimeoutMillis?

> `optional` **exportTimeoutMillis**: `number`

Defined in: [packages/telemetry-sdk-node/src/config.ts:50](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/config.ts#L50)

Export timeout in milliseconds
