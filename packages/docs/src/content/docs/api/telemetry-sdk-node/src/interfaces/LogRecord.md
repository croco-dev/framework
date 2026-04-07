---
editUrl: false
next: false
prev: false
title: "LogRecord"
---

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:29](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L29)

Represents a log record in the OpenTelemetry Log Data Model.
Structured logging interface for consistent log output.

## Example

```typescript
logger.emit({
  severity: LogSeverity.INFO,
  body: 'User logged in',
  attributes: { userId: '123' }
});
```

## Properties

### attributes?

> `optional` **attributes**: `Attributes`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:41](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L41)

Additional attributes associated with the log

***

### body

> **body**: `string` \| `Record`\<`string`, `unknown`\>

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:39](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L39)

The log message body

***

### observedTimestamp?

> `optional` **observedTimestamp**: `number`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:33](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L33)

The observed timestamp (when the event was observed)

***

### severity?

> `optional` **severity**: [`LogSeverity`](/api/telemetry-sdk-node/src/enumerations/logseverity/)

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:35](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L35)

Severity level of the log

***

### severityText?

> `optional` **severityText**: `string`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:37](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L37)

Severity text (e.g., 'INFO', 'ERROR')

***

### timestamp?

> `optional` **timestamp**: `number`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:31](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L31)

The timestamp when the log was emitted

***

### traceContext?

> `optional` **traceContext**: `object`

Defined in: [packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts:43](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/logs/LogsApi.ts#L43)

Trace context for correlation with traces

#### spanId

> **spanId**: `string`

#### traceFlags

> **traceFlags**: `number`

#### traceId

> **traceId**: `string`
