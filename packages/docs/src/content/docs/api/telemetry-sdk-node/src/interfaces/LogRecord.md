---
editUrl: false
next: false
prev: false
title: "LogRecord"
---

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

> `optional` **attributes?**: `Attributes`

Additional attributes associated with the log

***

### body

> **body**: `string` \| `Record`\<`string`, `unknown`\>

The log message body

***

### observedTimestamp?

> `optional` **observedTimestamp?**: `number`

The observed timestamp (when the event was observed)

***

### severity?

> `optional` **severity?**: [`LogSeverity`](/api/telemetry-sdk-node/src/enumerations/logseverity/)

Severity level of the log

***

### severityText?

> `optional` **severityText?**: `string`

Severity text (e.g., 'INFO', 'ERROR')

***

### timestamp?

> `optional` **timestamp?**: `number`

The timestamp when the log was emitted

***

### traceContext?

> `optional` **traceContext?**: `object`

Trace context for correlation with traces

#### spanId

> **spanId**: `string`

#### traceFlags

> **traceFlags**: `number`

#### traceId

> **traceId**: `string`
