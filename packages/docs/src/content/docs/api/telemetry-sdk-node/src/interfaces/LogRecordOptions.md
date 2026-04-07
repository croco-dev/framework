---
editUrl: false
next: false
prev: false
title: "LogRecordOptions"
---

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:53](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L53)

Options for emitting a log record.

## Properties

### attributes?

> `optional` **attributes**: `Attributes`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:59](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L59)

Additional attributes

***

### body

> **body**: `string` \| `Record`\<`string`, `unknown`\>

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:57](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L57)

The log message body (string or structured object)

***

### context?

> `optional` **context**: `Context`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:61](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L61)

Context for trace correlation

***

### severity

> **severity**: [`LogSeverity`](/api/telemetry-sdk-node/src/enumerations/logseverity/)

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:55](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L55)

Severity level
